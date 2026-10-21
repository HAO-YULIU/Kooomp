// 一個遊戲房間（Cloudflare Durable Object）。單人也是一個房間，只是最多一人。
// 房間的狀態（成員、進度、解開的題目）存在這個物件的儲存空間；即時訊息（位置、聊天、標記）只轉送不存。
// 用 WebSocket 休眠：沒有人傳訊息時不算運作時間（省免費額度）。
//
// 省額度的做法（docs/07-system.md 第 13 節）：
//   A. 玩家只在開始走、轉彎、停下時送位置，其他人的畫面自己推算中間的位置（game/src/net/sync.mjs）
//   B. 詳細位置只轉送給「同一個區域」的人；換區域時才通知所有人
import { DurableObject } from 'cloudflare:workers';
import { PUZZLES, HOUSES, judge, hint, rescueContent, corridorLoop, corridorFocus, morseHours } from './judge.mjs';

export const CHARS = { yuexi: 'grimoire', vaughn: 'belmont', elora: 'eldrin', cyril: 'ouroboros' };
const MARKS = ['here', 'danger', 'help'];
const MAX = { solo: 1, multi: 4 };
const WRONG_COOLDOWN = 3000; // 答錯後同一題要等多久（毫秒）
// 第一章的段落（docs/07-system.md 第 5 節）。解開「結尾題」就進到下一段
export const SEGMENTS = ['prologue', 'act1', 'act2', 'act3a', 'act3b', 'act3c', 'act4', 'epilogue'];
const SEG_END = { P02: 'act1', P08: 'act2', P10: 'act3a' };

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
        revives: 3, captured: {}, chat: [], notes: {}, segAt: 0, // notes：每個人自己知道的資訊（例如宿舍門鎖的時辰）
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
      solved: Object.keys(r.solved), flags: r.flags, revives: r.revives, captured: Object.keys(r.captured),
      hints: r.hints,
      chat: r.chat.slice(-20),
    };
  }
  broadcastState() { this.broadcast(this.snapshot()); }
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
        this.broadcast({ t: 'pos', uid, z, p: msg.p, v: msg.v, y: msg.y, s: msg.s, at: msg.at }, (u) => u !== uid && r.members[u]?.zone === z);
        return;
      }
      case 'npc': { // 守夜人等由「負責計算的人」（sim）送出，轉給同一區的人
        if (uid !== r.sim || !this.allow(uid, 'npc', 12)) return;
        this.broadcast({ t: 'npc', ...msg, id: undefined }, (u) => u !== uid && r.members[u]?.zone === msg.z);
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
        if (def.seg && SEGMENTS.indexOf(def.seg) > SEGMENTS.indexOf(r.segment)) return err('not_yet');
        if (def.gather && r.order.some((u) => r.members[u].online && r.members[u].zone !== def.gather)) return err('gather_first');
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
          seed: r.seed, lang: r.lang, house: CHARS[me.char], solo: r.mode === 'solo', aiHouses: this.aiHouses(), state, key: state.key ?? pid,
        });
        if (res.error) { await this.save(); return reply({ t: 'error', error: res.error, ...(res.reply ? { reply: res.reply } : {}) }); }
        // 異常長廊：全隊同一條長廊，誰做決定都算；結果告訴所有人（大家一起被送回長廊起點）
        if (def.kind === 'corridor') this.broadcast({ t: 'corridor', by: uid, ...res.reply }, (u) => u !== uid);
        if (res.solved) {
          r.solved[pid] = { by: uid, at: Date.now() };
          if (res.flag) r.flags[pid] = res.flag;
          if (res.reveal) ((r.notes ??= {})[uid] ??= {})[pid] = res.reveal; // 只有作答者知道
          const next = SEG_END[pid];
          if (next && SEGMENTS.indexOf(next) > SEGMENTS.indexOf(r.segment)) { r.segment = next; r.segAt = Date.now(); }
          await this.save();
          this.broadcast({ t: 'solved', pid, by: uid }, (u) => u !== uid);
          if (next) this.broadcastState();
          return reply({ t: 'result', pid, solved: true, reveal: res.reveal ?? null, reply: res.reply ?? null });
        }
        const sim = ['corridor', 'balance'].includes(def.kind);
        if (!sim) r.cool[coolKey] = Date.now() + WRONG_COOLDOWN;
        await this.save();
        return reply({ t: 'result', pid, solved: false, reply: res.reply ?? null });
      }
      case 'peek': { // 需要伺服器提供內容的題目：長廊的這一趟、救援題的密文…（不含答案）
        const pid = String(msg.pid ?? ''); const def = PUZZLES[pid];
        if (!def) return err('bad_puzzle');
        const st = (r.puz[pid] ??= {});
        if (def.kind === 'hours') return reply({ t: 'peek', pid, content: { morse: morseHours(this.aiHouses()) } });
        if (def.kind === 'corridor') return reply({ t: 'peek', pid, loop: st.n ?? 0, streak: st.streak ?? 0, next: corridorLoop(r.seed, st.attempt ?? 0, st.n ?? 0, { rate: def.rate }) });
        return reply({ t: 'peek', pid, content: rescueContent(pid, r.seed, st.key ?? pid, { house: CHARS[me.char] }) });
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
      case 'ping': return reply({ t: 'pong' });
      case 'dev': { // 測試用：直接跳到某一段（本機，或製作人的測試登入）
        if ((this.env.DEV_AUTH !== '1' && !uid.startsWith('test-')) || !SEGMENTS.includes(msg.segment)) return err('bad_args'); // 製作人的測試帳號也可以跳段
        r.segment = msg.segment; r.segAt = Date.now();
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
    await this.save();
    this.broadcastState();
  }

  // 每秒最多 n 則
  allow(uid, kind, n) {
    const rec = this.rate.get(uid) ?? this.rate.set(uid, {}).get(uid);
    const now = Date.now(); const list = (rec[kind] ??= []);
    while (list.length && now - list[0] > 1000) list.shift();
    if (list.length >= n) return false;
    list.push(now); return true;
  }
}
