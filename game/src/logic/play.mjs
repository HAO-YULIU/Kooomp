// 遊戲進行中：場景、劇情、謎題、赫爾嘉夫人、電腦同伴、筆記本。由 main.mjs 在遊戲開始時呼叫 startPlay()。
import { createWorld, patrolAt, helgaSees } from '../world/world.mjs';
import { createSender, createReceiver } from '../net/sync.mjs';
import { say, talking, advanceDialog, setPauseHandler, panelOpen, openPanel, closePanel, el, L } from '../ui/overlay.mjs';
import { openPuzzle } from '../ui/puzzles.mjs';
import { openWand } from '../ui/wand.mjs';
import { t, getLang } from './i18n.mjs';
import { CHARS, HOUSES } from './chars.mjs';
import { SCRIPT } from '../data/story-ch1.mjs';
import { SPAWNS, DOORS, ROOMS, RUMORS, THINGS } from '../data/world-ch1.mjs';
const THINGS_BY_ID = Object.fromEntries(THINGS.map((x) => [x.id, x]));
import { HEADMASTERS } from '../data/story-ch1.mjs';
import { createAct2 } from './act2.mjs';
import { createAct3 } from './act3.mjs';

const $ = (id) => document.getElementById(id);
const HOUR_PID = { P03: 'eldrin', P04: 'grimoire', P05: 'belmont', P06: 'ouroboros' };

export function startPlay({ conn, getState, myUid, toast, dev }) {
  const world = createWorld($('view'), getLang());
  const sender = createSender((m) => { conn.send(m); if (window.__ml) window.__ml.sent++; });
  const receiver = createReceiver();
  const S = () => getState();
  const me = () => S().members.find((m) => m.uid === myUid);
  const myHouse = () => CHARS[me()?.char]?.house;
  const code = S().code;

  // 看過的劇情（同一個房間重新連線不會再播一次）
  const seenKey = `ml_seen_${code}_${myUid}`;
  const seen = new Set((() => { try { return JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch { return []; } })());
  const play = (key) => { if (seen.has(key) || !SCRIPT[key]) return; seen.add(key); try { localStorage.setItem(seenKey, JSON.stringify([...seen])); } catch { /* 無痕 */ } say(SCRIPT[key]); };

  const notes = {}; // 自己知道的資訊（伺服器只告訴作答者的時辰）
  const heard = new Set(); // 聽過的傳聞（第幾張長桌）
  const revealed = new Set(); // 用光照咒照出來的東西
  let clockOffset = 0; // 伺服器時間－本機時間
  let segment = null;

  setPauseHandler((p) => { world.controls.setEnabled(!p); });
  const act2 = createAct2({ world, conn, toast, play, S, house: myHouse(), solo: S().mode === 'solo', lang: getLang() });
  $('btn-familiar').hidden = S().mode !== 'solo';
  const act3 = createAct3({ world, conn, toast, say, S, myChar: () => me()?.char, solvedByMe: (pid, r) => { onSolved(pid, myUid, r.reveal); toast(t('solved', { pid })); }, serverNow: () => Date.now() + clockOffset });
  if (dev) window.__ml = { receiver, world, conn, sent: 0, notes, heard, act2, act3, get state() { return S(); } };

  // ---- 段落開始：移到出發點、播劇情 ----
  function enterSegment(seg, first) {
    segment = seg;
    if (seg === 'prologue' && first) {
      const i = Math.max(0, S().members.findIndex((m) => m.uid === myUid));
      world.teleport({ ...SPAWNS.prologue, x: SPAWNS.prologue.x + (i - 1.5) * 1.4 });
    } else if (seg === 'act1') world.teleport(SPAWNS.act1[myHouse()] ?? SPAWNS.act1.eldrin);
    else if (seg === 'act2') { world.teleport(SPAWNS.act2); act2.enter(); }
    else if (seg === 'act3a') { act2.leave(); world.teleport(SPAWNS.act3a); }
    else if ((seg === 'act3b' || seg === 'act3c') && first) world.teleport(SPAWNS[seg]); // 重新連線時才傳送（平常是走過去的）
    else if (seg === 'act4') { world.teleport(SPAWNS.act4); toast(t('act_end')); }
    play(`segment:${seg}`);
    sender.resend();
  }

  // ---- 門：依解開的題目、目前的段落 ----
  const SEGS = ['prologue', 'act1', 'act2', 'act3a', 'act3b', 'act3c', 'act4', 'epilogue'];
  function updateDoors() {
    const st = S();
    for (const d of DOORS) {
      const open = !d.lock || (d.lock.puzzle && st.solved.includes(d.lock.puzzle)) || (d.lock.segment && SEGS.indexOf(st.segment) >= SEGS.indexOf(d.lock.segment));
      world.setDoor(d.id, !!open);
    }
  }

  // ---- 狀態更新（由 main 轉來） ----
  function onState(st, before) {
    clockOffset = (st.now ?? Date.now()) - Date.now();
    const people = st.members.filter((m) => m.uid !== myUid).map((m) => ({ key: m.uid, label: m.name, char: m.char }));
    for (const c of aiChars()) people.push({ key: `ai:${c}`, label: CHARS[c][getLang()], char: c });
    world.syncAvatars(people);
    updateDoors();
    if (st.segment !== segment) enterSegment(st.segment, !before);
    if (before && before.members.length < st.members.length) sender.resend();
  }
  const aiChars = () => Object.keys(CHARS).filter((c) => S().ai?.includes(CHARS[c].house));

  function onSolved(pid, by, reveal) {
    const st = S();
    if (!st.solved.includes(pid)) st.solved.push(pid);
    if (reveal) notes[pid] = reveal;
    updateDoors();
    act2.onSolved(pid);
    if (by === myUid || !['P03', 'P04', 'P05', 'P06', 'P07'].includes(pid)) play(`solved:${pid}`); // 宿舍門鎖只有解開的人看得到
  }

  // ---- 調查 ----
  function interact() {
    if (talking()) return advanceDialog();
    if (panelOpen()) return;
    const tg = world.target();
    if (!tg) return;
    if (act2.interact(tg) || act3.interact(tg)) return;
    if (tg.kind === 'plaques') return openPanel(L(tg.label), (body) => body.append(el('ul', { class: 'plaques' }, ...HEADMASTERS.map((h) => el('li', { text: L(h) })))));
    if (tg.kind === 'prop' && tg.text) return say([[null, tg.text.zh, tg.text.en]]);
    if (tg.kind === 'rumor') {
      heard.add(tg.rumor);
      return say([['student', RUMORS[tg.rumor].map((h) => h.zh).join(' '), RUMORS[tg.rumor].map((h) => h.en).join(' ')]]);
    }
    if (tg.kind === 'puzzle') {
      if (tg.needsAi && !S().ai?.length) return toast(t('p07_none'));
      if (tg.house && S().mode !== 'solo' && myHouse() !== tg.house) return toast(t('err.not_your_house'));
      return openPuzzle(tg.puzzle, tg, {
        conn, state: S(), notes, heard, revealed, toast, getLang, lib: act3.lib, solo: S().mode === 'solo',
        items: () => S().items ?? [], myHouse, myChar: () => me()?.char,
        near: (id, r) => { const th = THINGS_BY_ID[id]; const p = world.controls.state.pos; return !!th && Math.hypot(p.x - th.x, p.z - th.z) <= r; },
        onSolved: (pid, r) => onSolved(pid, myUid, r.reveal),
      });
    }
  }

  // ---- 魔杖 ----
  function castWand() {
    if (panelOpen() || talking()) return;
    openWand((spell) => {
      if (spell !== 'lumen') return;
      const tg = world.target((x) => x.id === 'lock_eldrin');
      if (tg) { revealed.add('lock_eldrin'); toast(t('revealed')); } else toast(t('wand_nothing'));
    });
  }

  // ---- 筆記本 ----
  function notebook() {
    if (panelOpen()) return closePanel();
    openPanel(t('notebook'), (body) => {
      const items = [];
      for (const [pid, h] of Object.entries(HOUR_PID)) if (notes[pid]) items.push(t('note_hour', { house: HOUSES[h][getLang()], n: notes[pid] }));
      if (!items.length && !heard.size) body.append(el('p', { class: 'dim', text: t('notebook_empty') }));
      if (items.length) body.append(el('ul', {}, ...items.map((x) => el('li', { text: x }))));
      const libNotes = act3.notebook();
      if (libNotes.length) body.append(el('h4', { text: t('liana_notes') }), el('ul', {}, ...libNotes));
      if (heard.size) {
        body.append(el('h4', { text: t('note_rumor') }));
        body.append(el('ul', {}, ...[...heard].sort().flatMap((i) => RUMORS[i].map((h) => el('li', { text: L(h) })))));
      }
    });
  }

  // ---- 按鍵與按鈕 ----
  let holding = false;
  addEventListener('keydown', (e) => {
    if (document.activeElement?.tagName === 'INPUT' || $('hud').hidden) return;
    if (e.code === 'KeyE' || (e.code === 'Space' && talking())) { e.preventDefault(); interact(); }
    if (e.code === 'KeyF') castWand();
    if (e.code === 'KeyN') notebook();
    if (e.code === 'KeyQ') holding = true;
    if (e.code === 'KeyV') act2.toggleFamiliar();
    if (e.code === 'Escape' && panelOpen()) closePanel();
  });
  addEventListener('keyup', (e) => { if (e.code === 'KeyQ') holding = false; });
  $('btn-inspect').onclick = interact;
  $('btn-wand').onclick = castWand;
  $('btn-notebook').onclick = notebook;
  $('btn-familiar').onclick = () => act2.toggleFamiliar();
  const hb = $('btn-breath');
  hb.onpointerdown = () => { holding = true; }; hb.onpointerup = hb.onpointerleave = () => { holding = false; };

  // ---- 每一幀 ----
  const entered = new Set();
  let last = performance.now(), caughtCool = 0;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const mine = world.me();
    const st = S();
    // 第一次走進房間的劇情
    if (mine.z && !entered.has(mine.z)) { entered.add(mine.z); play(`enter:${mine.z}`); }
    // 赫爾嘉夫人（第一幕，在星盤廳巡邏）
    if (segment === 'act1') {
      const h = patrolAt((Date.now() + clockOffset - (st.segAt ?? 0)) / 1000);
      world.setHelga(h);
      const speed = Math.hypot(mine.v[0], mine.v[1]);
      if (mine.z === 'starhall' && now > caughtCool && !panelOpen() && !talking() &&
          helgaSees(h, { x: mine.p[0], z: mine.p[1] }, { moving: speed > 0.3, running: speed > 2.6, holding, hidden: world.hidden() })) {
        caughtCool = now + 3000;
        world.teleport(SPAWNS.act1[myHouse()] ?? SPAWNS.act1.eldrin);
        say(SCRIPT.caught); toast(t('caught'));
      }
    } else world.setHelga(null);
    // 電腦控制的同伴：序幕跟在身邊；第一幕解開燭光（P07）後在星盤廳等
    const ai = aiChars();
    ai.forEach((c, i) => {
      const key = `ai:${c}`;
      if (segment === 'prologue' || segment === 'act2') {
        const s = world.controls.state, off = (i - (ai.length - 1) / 2) * 0.7; // 站在玩家身後，左右散開
        world.placeAvatar(key, s.pos.x + Math.sin(s.yaw + off) * 1.8, s.pos.z + Math.cos(s.yaw + off) * 1.8, s.yaw);
      } else if (segment === 'act1') {
        const spot = [[-1.5, 3], [1.5, 3], [0, 4]][i] ?? [0, 3];
        world.placeAvatar(key, spot[0], spot[1], Math.PI, st.solved.includes('P07'));
      } else world.placeAvatar(key, 0, 0, 0, false);
    });
    if (segment === 'act2') act2.frame(dt, mine);
    if (segment?.startsWith('act3')) act3.frame(dt, mine, segment);
    // 「調查」提示
    const tg = !panelOpen() && !talking() ? world.target() : null;
    $('prompt').hidden = !tg; if (tg) $('prompt').textContent = `${matchMedia('(pointer: coarse)').matches ? '' : 'E　'}${L(tg.label)}`;
    $('btn-inspect').classList.toggle('ready', !!tg);
    // 同步、畫面
    sender.update(mine, now);
    world.frame(dt, receiver.update(dt, now), mine.z);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return {
    world, sender, receiver, onState, onSolved,
    onCorridor: (msg) => act2.onCorridor(msg),
    onVote: (msg) => act2.onVote(msg),
    zoneName: (z) => L(ROOMS.find((r) => r.id === z)?.name) || z,
    setNotes(n) { Object.assign(notes, n); },
  };
}
