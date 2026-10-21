// 一個遊戲房間（Cloudflare Durable Object）。單人也是一個房間，只是最多一人。
// 房間的狀態（成員、進度、解開的題目）存在這個物件的儲存空間；即時訊息（位置、聊天、標記）只轉送不存。
// 用 WebSocket 休眠：沒有人傳訊息時不算運作時間（省免費額度）。
//
// 省額度的做法（docs/07-system.md 第 13 節）：
//   A. 玩家只在開始走、轉彎、停下時送位置，其他人的畫面自己推算中間的位置（game/src/net/sync.mjs）
//   B. 詳細位置只轉送給「同一個區域」的人；換區域時才通知所有人
import { DurableObject } from 'cloudflare:workers';
import { PUZZLES, HOUSES, judge, hint, rescueContent, corridorLoop, corridorFocus, morseHours, bookPage, brailleDoor, rng } from './judge.mjs';
import { ACT4 } from '../data/puzzles/ch1.mjs';

export const CHARS = { yuexi: 'grimoire', vaughn: 'belmont', elora: 'eldrin', cyril: 'ouroboros' };
const MARKS = ['here', 'danger', 'help'];
const MAX = { solo: 1, multi: 4 };
const WRONG_COOLDOWN = 3000; // 答錯後同一題要等多久（毫秒）
// 第一章的段落（docs/07-system.md 第 5 節）。解開「結尾題」就進到下一段
export const SEGMENTS = ['prologue', 'act1', 'act2', 'act3a', 'act3b', 'act3c', 'act4', 'epilogue'];
const SEG_END = { P02: 'act1', P08: 'act2', P10: 'act3a', P29: 'epilogue' };
const ACT4_PUZZLES = ['P26', 'P27', 'P28', 'P29'];
const RESCUE_IDS = ['R1', 'R2', 'R3', 'R4'], SELF_IDS = ['S1', 'S2', 'S3', 'S4'];
// 第三幕：這一段的題目全部解開，才進到下一段（P22 是西里爾的抉擇，不算）
const SEG_GATES = {
  act3a: { need: ['P11', 'P12', 'P13', 'P14'], next: 'act3b' },
  act3b: { need: ['P15', 'P16', 'P17'], next: 'act3c' },
  act3c: { need: ['P18', 'P19', 'P20', 'P21', 'P23', 'P24', 'P25'], next: 'act4' },
};
// 玩家自己撿到的東西（莉安娜的筆記、髮夾）；其他道具由解開題目得到（data/puzzles/ch1.mjs 的 gives）
const PICKUPS = ['note1', 'note2', 'note4', 'hairclip'];

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    this.rate = new Map(); // uid → { pos: [時間…], chat: 上次時間 }
    ctx.blockConcurrencyWhile(async () => { this.room = (await ctx.storage.get('room')) ?? null; });
  }

  save() { return this.ctx.storage.put('room', this.room); }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/init') {
      if (this.room) return new Response('taken', { status: 409 });
      const { code, mode, lang, host } = await req.json();
      this.room = {
        code, mode, lang, host, sim: host, phase: 'lobby', created: Date.now(),
        seed: crypto.getRandomValues(new Uint32Array(2)).join('-'),
        members: {}, order: [],
        segment: 'prologue', solved: {}, flags: {}, hints: {}, puz: {}, cool: {}, // hints：題號 → 已經給出的提示文字
        revives: 3, captured: {}, chat: [], notes: {}, items: {}, segAt: 0, // notes：每個人自己知道的資訊（例如宿舍門鎖的時辰）
      };
      await this.save();
      return new Response('ok', { status: 201 });
    }

    if (url.pathname === '/info') {
      const r = this.room;
      if (!r) return Response.json({ error: 'room_not_found' }, { status: 404 });
      return Response.json({ mode: r.mode, phase: r.phase, lang: r.lang, count: r.order.length, max: MAX[r.mode] });
    }

    if (url.pathname === '/join') {
      const r = this.room;
      if (!r) return new Response(JSON.stringify({ error: 'room_not_found' }), { status: 404 });
      const uid = req.headers.get('x-uid'), name = decodeURIComponent(req.headers.get('x-name') ?? '');
      const uiLang = req.headers.get('x-ui-lang') === 'en' ? 'en' : 'zh';
      let m = r.members[uid];
      if (!m) {
        if (r.phase !== 'lobby') return new Response(JSON.stringify({ error: 'room_started' }), { status: 409 });
        if (r.order.length >= MAX[r.mode]) return new Response(JSON.stringify({ error: 'room_full' }), { status: 409 });
        m = r.members[uid] = { name, char: null, sorted: null, ready: false, online: true, zone: null };
        r.order.push(uid);
      }
      m.name = name; m.online = true;
      // 同一個帳號重複連線：關掉舊的
      for (const old of this.ctx.getWebSockets(uid)) { try { old.close(4000, 'replaced'); } catch { /* 已關閉 */ } }
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1], [uid]);
      pair[1].serializeAttachment({ uid, uiLang });
      if (!r.members[r.sim]?.online) r.sim = uid;
      await this.save();
      this.send(pair[1], { t: 'hello', you: uid });
      this.send(pair[1], { t: 'notes', notes: r.notes?.[uid] ?? {} });
      this.broadcastState();
      return new Response(null, { status: 101, webSocket: pair[0], headers: { 'sec-websocket-protocol': 'milner' } });
    }
    return new Response('not found', { status: 404 });
  }

  // ---------- 傳送 ----------
  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch { /* 對方已斷線 */ } }
  sockets(filter) {
    return this.ctx.getWebSockets().filter((ws) => {
      const a = ws.deserializeAttachment();
      return a && (!filter || filter(a.uid));
    });
  }
  broadcast(msg, filter) { const s = JSON.stringify(msg); for (const ws of this.sockets(filter)) { try { ws.send(s); } catch { /* 略過 */ } } }

  snapshot() {
    const r = this.room;
    return {
      t: 'state', code: r.code, mode: r.mode, lang: r.lang, host: r.host, sim: r.sim, phase: r.phase, segment: r.segment, segAt: r.segAt, now: Date.now(), ai: this.aiHouses(),
      members: r.order.map((uid) => ({ uid, ...r.members[uid] })),
      solved: Object.keys(r.solved), flags: r.flags, items: Object.keys(r.items ?? {}), revives: r.revives, captured: Object.keys(r.captured),
      hints: r.hints,
      chat: r.chat.slice(-20),
      // 第四幕：倒數的截止時間、判定輸的原因；蝕巢裡每個被抓的人要解哪一題
      act4: r.act4 ? { deadline: r.act4.deadline, lost: r.act4.lost ?? null, bonus: !!r.act4.bonus } : null,
      nest: Object.fromEntries(Object.entries(r.captured).map(([u, c]) => [u, { r: c.r, s: c.s, at: c.at }])),
    };
  }
  broadcastState() { this.broadcast(this.snapshot()); }
  // 進到新的一段。第三幕前廳開始時，沒有人扮演西里爾，就由電腦替他做抉擇（第一章預設：收起徽章）
  enterSegment(seg) {
    const r = this.room; r.segment = seg; r.segAt = Date.now();
    if (seg === 'act4') this.startAct4();
    if (seg === 'act3c' && !r.order.some((u) => r.members[u].char === 'cyril') && !r.solved.P22) { r.solved.P22 = { by: 'ai', at: Date.now() }; r.flags.P22 = 'hide'; }
  }
  // 第四幕開始（或判定輸之後重來）：倒數 35 分鐘、復活 3 次、清掉第四幕的進度
  startAct4() {
    const r = this.room;
    for (const p of ACT4_PUZZLES) { delete r.solved[p]; delete r.puz[p]; delete r.hints[p]; }
    r.captured = {}; r.revives = 3; r.segAt = Date.now();
    r.act4 = { deadline: Date.now() + ACT4.duration, lost: null, bonus: false, repelAt: 0, grab: {}, n: 0 };
    this.ctx.storage.setAlarm(r.act4.deadline);
  }
  lose(reason) {
    const r = this.room; if (!r.act4 || r.act4.lost) return;
    r.act4.lost = reason; r.act4.grab = {};
    this.broadcast({ t: 'lost', reason });
  }
  // 時間到：第十三響的餘音結束
  async alarm() {
    const r = this.room;
    if (r?.phase !== 'playing' || r.segment !== 'act4' || !r.act4 || r.act4.lost) return;
    if (Date.now() < r.act4.deadline - 100) { this.ctx.storage.setAlarm(r.act4.deadline); return; } // 截止時間被延後了（卡住齒輪）
    this.lose('time'); await this.save(); this.broadcastState();
  }
  // 被抓到（掙脫失敗）：單人用掉一次復活；多人被拖進蝕巢，抽一題救援題、一題自救題
  caught(uid) {
    const r = this.room;
    if (r.mode === 'solo') {
      if (r.revives <= 0) return this.lose('revives');
      r.revives--; this.broadcast({ t: 'revived', uid, left: r.revives }); return;
    }
    const n = r.act4.n++;
    const pick = (list, k) => list[Math.floor(rng(r.seed, `nest:${uid}:${n}:${k}`)() * list.length)];
    r.captured[uid] = { at: Date.now(), n, r: pick(RESCUE_IDS, 'r'), s: pick(SELF_IDS, 's'), sAt: Date.now(), sn: 0 };
    this.broadcast({ t: 'captured', uid });
    const online = r.order.filter((u) => r.members[u].online);
    if (online.every((u) => r.captured[u])) this.lose('captured');
  }
  free(uid, by) { delete this.room.captured[uid]; this.broadcast({ t: 'freed', uid, by }); }

  // 沒有玩家選的角色由電腦控制；回傳他們的學院
  aiHouses() {
    const r = this.room; if (r.phase === 'lobby') return [];
    const taken = new Set(r.order.map((u) => CHARS[r.members[u]?.char]).filter(Boolean));
    return HOUSES.filter((h) => !taken.has(h));
  }

  // ---------- 收到訊息 ----------
  async webSocketMessage(ws, raw) {
    const a = ws.deserializeAttachment(); if (!a) return;
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const r = this.room, uid = a.uid, me = r?.members[uid];
    if (!me) return;
    const reply = (m) => this.send(ws, { ...m, id: msg.id });
    const err = (error) => reply({ t: 'error', error });

    switch (msg.t) {
      // ----- 即時：位置、聊天、標記（不存） -----
      case 'pos': {
        if (!this.allow(uid, 'pos', 12)) return;
        const z = String(msg.z ?? '').slice(0, 24) || null;
        if (z !== me.zone) { me.zone = z; await this.save(); this.broadcast({ t: 'zone', uid, z }, (u) => u !== uid); }
        // 第四幕：負責算守夜人的人（sim）要知道每個人在哪裡，不管在哪一區
        const sim = r.segment === 'act4' ? r.sim : null;
        this.broadcast({ t: 'pos', uid, z, p: msg.p, v: msg.v, y: msg.y, s: msg.s, h: msg.h, at: msg.at }, (u) => u !== uid && (r.members[u]?.zone === z || u === sim));
        return;
      }
      case 'npc': { // 守夜人等由「負責計算的人」（sim）送出，轉給同一區的人
        if (uid !== r.sim || !this.allow(uid, 'npc', 12)) return;
        this.broadcast({ t: 'npc', ...msg, id: undefined }, (u) => u !== uid && (r.segment === 'act4' || r.members[u]?.zone === msg.z)); // 第四幕：守夜人在哪裡，大家都要知道
        return;
      }
      case 'chat': {
        const text = String(msg.text ?? '').trim().slice(0, 200);
        if (!text) return;
        const last = this.rate.get(uid)?.chat ?? 0;
        if (Date.now() - last < 700) return err('too_fast');
        (this.rate.get(uid) ?? this.rate.set(uid, {}).get(uid)).chat = Date.now();
        const line = { uid, name: me.name, text, at: Date.now() };
        r.chat.push(line); if (r.chat.length > 30) r.chat.shift();
        await this.save();
        this.broadcast({ t: 'chat', ...line });
        return reply({ t: 'ok' });
      }
      case 'mark': {
        if (!MARKS.includes(msg.kind) || !this.allow(uid, 'mark', 2)) return;
        this.broadcast({ t: 'mark', uid, kind: msg.kind, z: msg.z, p: msg.p });
        return;
      }

      // ----- 等待室 -----
      case 'house': { // 分學院儀式的結果 → 預設角色
        const char = Object.keys(CHARS).find((c) => CHARS[c] === msg.house);
        if (!char) return err('bad_value');
        me.sorted = char;
        await this.save(); this.broadcastState(); return reply({ t: 'ok' });
      }
      case 'char': {
        if (r.phase !== 'lobby') return err('not_now');
        if (msg.char !== null && !(msg.char in CHARS)) return err('bad_value');
        if (msg.char && r.order.some((u) => u !== uid && r.members[u].char === msg.char)) return err('character_taken');
        me.char = msg.char; if (!me.char) me.ready = false;
        await this.save(); this.broadcastState(); return reply({ t: 'ok' });
      }
      case 'ready': {
        if (r.phase !== 'lobby') return err('not_now');
        if (msg.ready && !me.char) return err('need_character');
        me.ready = !!msg.ready;
        await this.save(); this.broadcastState(); return reply({ t: 'ok' });
      }
      case 'start': {
        if (uid !== r.host) return err('not_host');
        if (r.phase !== 'lobby') return err('not_now');
        const online = r.order.filter((u) => r.members[u].online);
        if (r.mode === 'multi' && online.length < 2) return err('need_players');
        if (online.some((u) => !r.members[u].ready)) return err('not_ready');
        // 離線的人移出房間
        for (const u of r.order) if (!r.members[u].online) delete r.members[u];
        r.order = r.order.filter((u) => r.members[u]);
        r.phase = 'playing'; r.started = Date.now(); r.segment = 'prologue'; r.segAt = Date.now();
        await this.save(); this.broadcastState(); return reply({ t: 'ok' });
      }

      // ----- 作答 -----
      case 'answer': {
        if (r.phase !== 'playing') return err('not_playing');
        const pid = String(msg.pid ?? ''); const def = PUZZLES[pid];
        if (!def) return err('bad_puzzle');
        if (r.solved[pid]) return err('already_solved');
        if (def.seg === 'act4' && (r.act4?.lost || r.captured[uid])) return err(r.act4?.lost ? 'lost' : 'captured');
        if (!def.seg && (RESCUE_IDS.includes(pid) || SELF_IDS.includes(pid))) return err('bad_puzzle'); // 救援題用 rescue／selfrescue
        if (def.seg && SEGMENTS.indexOf(def.seg) > SEGMENTS.indexOf(r.segment)) return err('not_yet');
        if (def.gather && r.order.some((u) => r.members[u].online && r.members[u].zone !== def.gather)) return err('gather_first');
        if (def.needs && !r.items?.[def.needs]) return err('need_item');
        if (pid === 'P22' && me.char !== 'cyril') return err('not_yours'); // 西里爾的抉擇只有扮演西里爾的人能做
        const coolKey = `${pid}:${uid}`;
        if ((r.cool[coolKey] ?? 0) > Date.now()) return reply({ t: 'error', error: 'cooldown', wait: r.cool[coolKey] - Date.now() });
        const state = (r.puz[pid] ??= {});
        // 異常長廊（多人）：每個人的決定是一票，過半數同意才算數（2 人要兩票、3 人兩票、4 人三票）
        if (def.kind === 'corridor' && r.mode === 'multi') {
          if (+msg.value?.loop !== (state.n ?? 0)) return reply({ t: 'error', error: 'bad_value', reply: { loop: state.n ?? 0 } });
          const choice = msg.value?.choice === 'back' ? 'back' : 'forward';
          state.votes = { ...(state.votes?.loop === state.n ? state.votes : { loop: state.n ?? 0 }), [uid]: choice };
          const online = r.order.filter((u) => r.members[u].online);
          const need = Math.floor(online.length / 2) + 1;
          const count = (c) => online.filter((u) => state.votes[u] === c).length;
          const tally = { forward: count('forward'), back: count('back'), need };
          if (tally[choice] < need) {
            await this.save();
            this.broadcast({ t: 'vote', pid, by: uid, choice, ...tally }, (u) => u !== uid);
            return reply({ t: 'result', pid, solved: false, pending: true, ...tally });
          }
          state.votes = null; // 決定了：照多數的選擇判斷
        }
        const res = judge(pid, msg.value, {
          seed: r.seed, lang: r.lang, house: CHARS[me.char], solo: r.mode === 'solo', aiHouses: this.aiHouses(), state, key: state.key ?? pid, uid,
        });
        if (res.error) { await this.save(); return reply({ t: 'error', error: res.error, ...(res.reply ? { reply: res.reply } : {}) }); }
        // 異常長廊：全隊同一條長廊，誰做決定都算；結果告訴所有人（大家一起被送回長廊起點）
        if (def.kind === 'corridor') this.broadcast({ t: 'corridor', by: uid, ...res.reply }, (u) => u !== uid);
        if (res.solved) {
          r.solved[pid] = { by: uid, at: Date.now() };
          if (res.flag) r.flags[pid] = res.flag;
          if (res.reveal) ((r.notes ??= {})[uid] ??= {})[pid] = res.reveal; // 只有作答者知道
          if (def.gives) (r.items ??= {})[def.gives] = uid;
          if (pid === 'P27' && r.act4 && !r.act4.bonus) { r.act4.bonus = true; r.act4.deadline += ACT4.gearBonus; this.ctx.storage.setAlarm(r.act4.deadline); } // 卡住鐘槌：多 90 秒
          const gate = SEG_GATES[r.segment];
          const next = SEG_END[pid] ?? (gate && gate.need.every((p) => r.solved[p]) ? gate.next : null);
          if (next && SEGMENTS.indexOf(next) > SEGMENTS.indexOf(r.segment)) this.enterSegment(next);
          await this.save();
          this.broadcast({ t: 'solved', pid, by: uid, gives: def.gives ?? null }, (u) => u !== uid);
          if (next || def.gives || pid === 'P27') this.broadcastState();
          return reply({ t: 'result', pid, solved: true, reveal: res.reveal ?? null, reply: res.reply ?? null });
        }
        const sim = ['corridor', 'balance', 'roof'].includes(def.kind);
        if (!sim) r.cool[coolKey] = Date.now() + WRONG_COOLDOWN;
        await this.save();
        return reply({ t: 'result', pid, solved: false, reply: res.reply ?? null });
      }
      case 'peek': { // 需要伺服器提供內容的題目：長廊的這一趟、救援題的密文…（不含答案）
        const pid = String(msg.pid ?? ''); const def = PUZZLES[pid];
        if (pid === 'R' || pid === 'S') { // 蝕巢：R＝救別人（target），S＝自己解
          const target = pid === 'R' ? String(msg.target ?? '') : uid, c = r.captured[target];
          if (!c) return err('not_captured');
          if (pid === 'S' && Date.now() - c.sAt > ACT4.selfSwap) { c.sn++; c.sAt = Date.now(); c.s = SELF_IDS[(SELF_IDS.indexOf(c.s) + 1 + (c.sn % 3)) % 4]; await this.save(); } // 解太久：換一題
          const q = pid === 'R' ? c.r : c.s;
          return reply({ t: 'peek', pid: q, target, content: rescueContent(q, r.seed, this.nestKey(target, pid), { house: CHARS[r.members[target]?.char] }) });
        }
        if (!def) return err('bad_puzzle');
        const st = (r.puz[pid] ??= {});
        if (def.kind === 'hours') return reply({ t: 'peek', pid, content: { morse: morseHours(this.aiHouses()) } });
        if (pid === 'P14') { const b = Math.trunc(+msg.value?.book), p = Math.trunc(+msg.value?.page); if (!(b >= 1 && b <= 12 && p >= 1 && p <= 120)) return err('bad_value'); return reply({ t: 'peek', pid, content: { words: bookPage(r.seed, r.lang, b, p) } }); }
        if (pid === 'P12') { if (!r.items?.lantern) return err('need_item'); return reply({ t: 'peek', pid, content: { shadows: def.ans.split(',') } }); } // 站在標記上舉燈才看得到影子
        if (pid === 'P24') return reply({ t: 'peek', pid, content: { cells: brailleDoor() } });
        if (def.kind === 'corridor') return reply({ t: 'peek', pid, loop: st.n ?? 0, streak: st.streak ?? 0, next: corridorLoop(r.seed, st.attempt ?? 0, st.n ?? 0, { rate: def.rate }) });
        return err('bad_puzzle');
      }

      // ----- 第四幕：守夜人、被抓、蝕巢 -----
      case 'catch': { // 守夜人抓到人（由 sim 判斷）：被抓的人有 1.5 秒可以掙脫
        const v = String(msg.uid ?? ''), a4 = r.act4;
        if (uid !== r.sim || r.segment !== 'act4' || !a4 || a4.lost || !r.members[v] || r.captured[v] || (a4.grab[v] ?? 0) + 3000 > Date.now()) return err('bad_args'); // 上一次抓的結果還沒回報（斷線）就等 3 秒
        a4.grab[v] = Date.now() + ACT4.grab;
        await this.save(); this.broadcast({ t: 'grab', uid: v, until: a4.grab[v] }); return reply({ t: 'ok' });
      }
      case 'escape': case 'caught': { // 被抓的人自己回報：掙脫成功，或沒掙脫
        const a4 = r.act4; if (!a4?.grab?.[uid]) return err('bad_args');
        const ok = msg.t === 'escape' && Date.now() <= a4.grab[uid] + 800; // 給網路一點時間
        delete a4.grab[uid];
        if (ok) this.broadcast({ t: 'escaped', uid }); else this.caught(uid);
        await this.save(); this.broadcastState(); return reply({ t: 'ok', escaped: ok });
      }
      case 'rescue': case 'selfrescue': { // 解開束縛：rescue＝同伴來救（target），selfrescue＝自己解
        const target = msg.t === 'rescue' ? String(msg.target ?? '') : uid, c = r.captured[target];
        if (!c || r.act4?.lost) return err('not_captured');
        if (msg.t === 'rescue' && (target === uid || r.captured[uid])) return err('bad_args');
        const kind = msg.t === 'rescue' ? 'R' : 'S', pid = kind === 'R' ? c.r : c.s;
        const coolKey = `${kind}:${target}:${uid}`;
        if ((r.cool[coolKey] ?? 0) > Date.now()) return reply({ t: 'error', error: 'cooldown', wait: r.cool[coolKey] - Date.now() });
        const res = judge(pid, msg.value, { seed: r.seed, lang: r.lang, house: CHARS[r.members[target]?.char], key: this.nestKey(target, kind), state: {}, uid });
        if (res.error) return err(res.error);
        if (res.solved) { this.free(target, uid); await this.save(); this.broadcastState(); return reply({ t: 'result', pid, solved: true }); }
        r.cool[coolKey] = Date.now() + WRONG_COOLDOWN; await this.save();
        return reply({ t: 'result', pid, solved: false });
      }
      case 'repel': { // 貝爾蒙特：讓守夜人停 5 秒，冷卻 60 秒
        const a4 = r.act4;
        if (r.segment !== 'act4' || !a4 || a4.lost || CHARS[me.char] !== 'belmont' || r.captured[uid]) return err('bad_args');
        if (Date.now() < a4.repelAt) return reply({ t: 'error', error: 'cooldown', wait: a4.repelAt - Date.now() });
        a4.repelAt = Date.now() + ACT4.repelCool;
        await this.save(); this.broadcast({ t: 'repel', by: uid, until: Date.now() + ACT4.repelFor }); return reply({ t: 'ok', next: a4.repelAt });
      }
      case 'noise': { // 答錯節奏（P28）、踩碎石板：聲音引來守夜人（轉給 sim）
        if (r.segment !== 'act4' || !this.allow(uid, 'noise', 2)) return;
        this.broadcast({ t: 'noise', uid, z: me.zone, p: msg.p }, (u) => u === r.sim); return;
      }
      case 'retry': { // 判定輸之後，從第四幕開頭重來
        if (!r.act4?.lost) return err('not_now');
        this.startAct4(); await this.save(); this.broadcast({ t: 'retry' }); this.broadcastState(); return reply({ t: 'ok' });
      }
      case 'hint': {
        if (r.phase !== 'playing') return err('not_playing');
        const pid = String(msg.pid ?? ''); if (!PUZZLES[pid]?.hints) return err('bad_puzzle');
        const n = r.hints[pid]?.length ?? 0;
        if (n >= 3) return err('no_more_hints');
        let focus;
        if (PUZZLES[pid].kind === 'corridor') { const st = r.puz[pid] ?? {}; focus = corridorFocus(corridorLoop(r.seed, st.attempt ?? 0, st.n ?? 0, { rate: PUZZLES[pid].rate }), r.lang); }
        const text = hint(pid, n, r.lang, { focus });
        (r.hints[pid] ??= []).push(text);
        await this.save();
        this.broadcast({ t: 'hint', pid, n, text, by: uid }, (u) => u !== uid);
        return reply({ t: 'hint', pid, n, text, by: uid });
      }
      case 'collect': { // 撿起地上的東西（全隊共用）
        if (!PICKUPS.includes(msg.item)) return err('bad_value');
        if (!(r.items ??= {})[msg.item]) { r.items[msg.item] = uid; await this.save(); this.broadcastState(); }
        return reply({ t: 'ok' });
      }
      case 'ping': return reply({ t: 'pong' });
      case 'dev': { // 測試用：直接跳到某一段（本機，或製作人的測試登入）
        if (this.env.DEV_AUTH !== '1' && !uid.startsWith('test-')) return err('bad_args'); // 製作人的測試帳號也可以跳段
        if (msg.seed && this.env.DEV_AUTH === '1') return reply({ t: 'ok', seed: r.seed }); // 只有本機測試：救援題的答案要用種子算
        if (msg.deadline && r.act4) { r.act4.deadline = Date.now() + Math.max(0, +msg.deadline); this.ctx.storage.setAlarm(r.act4.deadline); } // 測試：倒數快轉
        else if (SEGMENTS.includes(msg.segment)) this.enterSegment(msg.segment); else return err('bad_args');
        await this.save(); this.broadcastState(); return reply({ t: 'ok' });
      }
      default: return err('bad_args');
    }
  }

  async webSocketClose(ws) { await this.left(ws); }
  async webSocketError(ws) { await this.left(ws); }
  async left(ws) {
    const a = ws.deserializeAttachment(); const r = this.room;
    if (!a || !r?.members[a.uid]) return;
    if (this.ctx.getWebSockets(a.uid).some((w) => w !== ws && w.readyState === 1)) return; // 換了新的連線
    const m = r.members[a.uid];
    if (r.phase === 'lobby') { delete r.members[a.uid]; r.order = r.order.filter((u) => u !== a.uid); } else m.online = false;
    const online = r.order.filter((u) => r.members[u]?.online);
    if (a.uid === r.host && online.length) r.host = r.phase === 'lobby' ? online[0] : r.host;
    if (!r.members[r.sim]?.online && online.length) r.sim = online[0]; // 負責算守夜人的人換手
    if (r.segment === 'act4' && r.mode === 'multi' && online.length && online.every((u) => r.captured[u])) this.lose('captured');
    await this.save();
    this.broadcastState();
  }

  // 蝕巢題目的亂數鑰匙：同一次被抓、同一題，內容固定
  nestKey(target, kind) { const c = this.room.captured[target]; return `${target}:${c.n}:${kind}${kind === 'S' ? c.sn : ''}`; }

  // 每秒最多 n 則
  allow(uid, kind, n) {
    const rec = this.rate.get(uid) ?? this.rate.set(uid, {}).get(uid);
    const now = Date.now(); const list = (rec[kind] ??= []);
    while (list.length && now - list[0] > 1000) list.shift();
    if (list.length >= n) return false;
    list.push(now); return true;
  }
}
