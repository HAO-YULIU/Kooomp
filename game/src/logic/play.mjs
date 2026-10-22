// 遊戲進行中：場景、劇情、謎題、赫爾嘉夫人、電腦同伴、筆記本。由 main.mjs 在遊戲開始時呼叫 startPlay()。
import { createWorld, patrolAt, helgaSees } from '../world/world.mjs';
import { createSender, createReceiver } from '../net/sync.mjs';
import { say, talking, advanceDialog, setPauseHandler, panelOpen, openPanel, closePanel, el, L, LP, setPuzzleLang, setPanelHooks } from '../ui/overlay.mjs';
import { openPuzzle } from '../ui/puzzles.mjs';
import { openWand } from '../ui/wand.mjs';
import { openTutorial, tutorialSeen } from '../ui/tutorial.mjs';
import { createDevTools } from '../ui/devtools.mjs';
import { setStaff, staffCast, setVolume, getVolume, setMusicVolume, getMusicVolume } from '../art/index.mjs';
import { setSoundVolume } from '../world/sound.mjs';
import { t, getLang } from './i18n.mjs';
import { CHARS, HOUSES } from './chars.mjs';
import { SCRIPT } from '../data/story-ch1.mjs';
import { SPAWNS, DOORS, ROOMS, RUMORS, THINGS } from '../data/world-ch1.mjs';
const THINGS_BY_ID = Object.fromEntries(THINGS.map((x) => [x.id, x]));
import { HEADMASTERS } from '../data/story-ch1.mjs';
import { createAct2 } from './act2.mjs';
import { createAct3 } from './act3.mjs';
import { createAct4 } from './act4.mjs';

const $ = (id) => document.getElementById(id);
const HOUR_PID = { P03: 'eldrin', P04: 'grimoire', P05: 'belmont', P06: 'ouroboros' };

export function startPlay({ conn, getState, myUid, toast, dev, devUser }) {
  let devtools = null; // 開發者測試工具（下面建立）
  const world = createWorld($('view'), getLang());
  if (dev) window.__w = world; // 本機測試用
  const sender = createSender((m) => { conn.send(m); if (window.__ml) window.__ml.sent++; });
  const receiver = createReceiver();
  const S = () => getState();
  setPuzzleLang(S().lang); // 線索用房間的謎題語言
  const me = () => S().members.find((m) => m.uid === myUid);
  const myHouse = () => CHARS[me()?.char]?.house;
  const code = S().code;
  setStaff(['elora', 'yuexi'].includes(me()?.char) ? 'moon' : 'dragon'); // 第一人稱的法杖：女生星月法杖、男生龍首法杖

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
  // 謎題連進場景（2026-10-22 製作人）：調查打開的視窗，鏡頭滑到那個東西前面、視窗靠右；
  // 在視窗裡每次操作，場景裡那個東西閃一下藍光；答錯紅光；解開金光、光點往上飄，鎖住的門轉開
  let focusNext = null, focused = null, lastFx = 0;
  setPanelHooks({
    open() { $('panel').dataset.skin = skinOf(focusNext); if (!focusNext) return; focused = focusNext; world.focus(focused); document.body.classList.add('focus'); },
    close() { if (!focused) return; focused = null; world.unfocus(); document.body.classList.remove('focus'); },
  });
  const panelFx = (kind) => { if (focused) world.fx(focused, kind); };
  // 視窗外觀跟著東西：紙（傳聞、筆記、書）、石頭（門鎖、符文、石像、井）、黃銅（天平、沙漏、齒輪、星盤）、玻璃（窗、水晶、鏡子）
  const SKINS = [['stone', /lock|door|rune|statue|braille|well|tiles|gate|mark|painting|plaque|roots|nest/], ['brass', /scale|hourglass|gear|pendulum|disk|lamp|pass|roof|sign/],
    ['glass', /window|crystal|mirror|ball|vial/], ['paper', /note|letter|roster|notice|book|seat|chart|desk|sketch|eastern|badge|senior|cat|ladder/]];
  const skinOf = (th) => (th ? (SKINS.find(([, re]) => re.test(th.id))?.[0] ?? '') : '');
  for (const ev of ['click', 'input']) $('panel-body').addEventListener(ev, (e) => {
    if (!focused || !(e.target.closest('button, input, select, canvas, .rune'))) return;
    const now = performance.now(); if (now - lastFx < 250) return; lastFx = now; panelFx('input');
  });
  const act2 = createAct2({ world, conn, toast, play, S, house: myHouse(), solo: S().mode === 'solo', lang: getLang() });
  $('btn-familiar').hidden = S().mode !== 'solo';
  const act3 = createAct3({ world, conn, toast, say, S, myChar: () => me()?.char, solvedByMe: (pid, r) => { onSolved(pid, myUid, r.reveal); toast(t('solved', { pid })); }, serverNow: () => Date.now() + clockOffset });
  const act4 = createAct4({ world, conn, toast, say, talking, S, myUid, myChar: () => me()?.char, receiver, serverNow: () => Date.now() + clockOffset, holding: () => holding, dev, playScript: (k) => play(k),
    solvedByMe: (pid, r) => { onSolved(pid, myUid, r.reveal); toast(t('solved', { pid })); } });
  if (dev) window.__ml = { receiver, world, conn, sent: 0, notes, heard, act2, act3, act4, get state() { return S(); } };

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
    else if (seg === 'act4') act4.begin(false);
    else if (seg === 'epilogue') return act4.end(); // 尾聲的劇情由 act4 排順序
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
    devtools?.refresh();
    world.syncSolved(st.solved ?? []);
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
    if (!st.solved.includes(pid) && !focused) { const th = Object.values(THINGS_BY_ID).find((x) => x.puzzle === pid && x.room === world.zone()); if (th) world.fx(th, 'solved'); } // 隊友解開：同一個房間看得到金光
    if (!st.solved.includes(pid)) st.solved.push(pid);
    if (reveal) notes[pid] = reveal;
    updateDoors();
    act2.onSolved(pid);
    if (pid === 'P29') return; // 屋頂的高潮由 act4.end() 播（守夜人最後那句話只有西里爾聽清楚）
    if (by === myUid || !['P03', 'P04', 'P05', 'P06', 'P07'].includes(pid)) play(`solved:${pid}`); // 宿舍門鎖只有解開的人看得到
  }

  // ---- 調查 ----
  function interact() {
    if (talking()) return advanceDialog();
    if (panelOpen()) return;
    const tg = world.target();
    if (!tg) return;
    focusNext = tg; setTimeout(() => { focusNext = null; }); // 這次調查打開的視窗，鏡頭看著這個東西
    if (act2.interact(tg) || act3.interact(tg) || act4.interact(tg)) return;
    if (tg.kind === 'plaques') return openPanel(L(tg.label), (body) => body.append(el('ul', { class: 'plaques' }, ...HEADMASTERS.map((h) => el('li', { text: L(h) })))));
    if (tg.kind === 'prop' && tg.text) return say([[null, tg.text.zh, tg.text.en]]);
    if (tg.kind === 'rumor') {
      heard.add(tg.rumor);
      const text = RUMORS[tg.rumor].map(LP).join(' '); // 線索用房間的謎題語言（答案跟著它）
      return say([['student', text, text]]);
    }
    if (tg.kind === 'puzzle') {
      if (tg.needsAi && !S().ai?.length) return toast(t('p07_none'));
      if (tg.house && S().mode !== 'solo' && myHouse() !== tg.house && !S().ai?.includes(tg.house)) return toast(t('err.not_your_house')); // 電腦控制的學院：誰都可以做
      return openPuzzle(tg.puzzle, tg, {
        conn, state: S(), notes, heard, revealed, toast, getLang, lib: act3.lib, solo: S().mode === 'solo',
        items: () => S().items ?? [], myHouse, aiHouse: (h) => S().mode !== 'solo' && !!S().ai?.includes(h), myChar: () => me()?.char, noise: () => conn.send({ t: 'noise', p: world.me().p }),
        near: (id, r) => { const th = THINGS_BY_ID[id]; const p = world.controls.state.pos; return !!th && Math.hypot(p.x - th.x, p.z - th.z) <= r; },
        onSolved: (pid, r) => onSolved(pid, myUid, r.reveal), fx: panelFx, react: (n, d) => { if (focused) world.react(focused, n, d); },
      });
    }
  }

  // ---- 魔杖 ----
  function castWand() {
    if (panelOpen() || talking()) return;
    if (segment === 'act4' && act4.canRepel()) { staffCast('#ffd27a'); return act4.repel(); } // 貝爾蒙特：擊退守夜人
    openWand((spell) => {
      if (spell !== 'lumen') return;
      staffCast('#9fc4ff'); // 法杖往前一揮、杖頭發光
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
      // 符文大門（P18）的線索：P04 門上的 ᛁ，P19～P21 各一個符文
      const runes = [['P04', 'ᛁ'], ['P19', 'ᛚ'], ['P20', 'ᚷ'], ['P21', 'ᛏ']].filter(([p]) => S().solved.includes(p) || (p === 'P04' && S().ai?.includes('grimoire')));
      if (runes.length) body.append(el('h4', { text: t('note_runes') }), el('p', { class: 'cipher', text: runes.map(([, r]) => r).join('　') }));
      const libNotes = act3.notebook();
      if (libNotes.length) body.append(el('h4', { text: t('liana_notes') }), el('ul', {}, ...libNotes));
      if (heard.size) {
        body.append(el('h4', { text: t('note_rumor') }));
        body.append(el('ul', {}, ...[...heard].sort().flatMap((i) => RUMORS[i].map((h) => el('li', { text: LP(h) })))));
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
  // 開發者測試工具（右上角 🛠）
  devtools = devUser ? createDevTools({ conn, world, S, things: THINGS, toast, onSolved: (pid, r) => onSolved(pid, myUid, r.reveal) }) : null;
  // 設定：亮度、重看入學指南
  const touch = document.body.classList.contains('touch');
  $('btn-settings').onclick = () => openPanel(t('settings'), (body) => {
    const val = el('b', { text: `${Math.round(world.brightness * 100)}%` });
    const slider = el('input', { type: 'range', min: '0.6', max: '1.8', step: '0.05', value: String(world.brightness), class: 'bright' });
    slider.oninput = () => { world.setBrightness(+slider.value); val.textContent = `${Math.round(+slider.value * 100)}%`; };
    const vval = el('b', { text: `${Math.round(getVolume() * 100)}%` });
    const vol = el('input', { type: 'range', min: '0', max: '1.5', step: '0.05', value: String(getVolume()), class: 'bright' });
    vol.oninput = () => { setVolume(+vol.value); setSoundVolume(+vol.value); vval.textContent = `${Math.round(+vol.value * 100)}%`; };
    const mval = el('b', { text: `${Math.round(getMusicVolume() * 100)}%` });
    const mus = el('input', { type: 'range', min: '0', max: '1.5', step: '0.05', value: String(getMusicVolume()), class: 'bright' });
    mus.oninput = () => { setMusicVolume(+mus.value); mval.textContent = `${Math.round(+mus.value * 100)}%`; };
    body.append(el('div', { class: 'row' }, el('span', { text: t('brightness') }), slider, val), el('div', { class: 'row' }, el('span', { text: t('volume') }), vol, vval),
      el('div', { class: 'row' }, el('span', { text: t('music_volume') }), mus, mval),
      el('button', { text: t('replay_tut'), onclick: () => { closePanel(); openTutorial({ touch }); } }));
  });
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
    const hideState = act4.frame(dt, mine, segment);
    // 「調查」提示
    const tg = !panelOpen() && !talking() ? world.target() : null;
    $('prompt').hidden = !tg; if (tg) $('prompt').textContent = `${matchMedia('(pointer: coarse)').matches ? '' : 'E　'}${L(tg.label)}`;
    $('btn-inspect').classList.toggle('ready', !!tg);
    // 同步、畫面
    sender.update({ ...mine, h: hideState }, now);
    world.haunting = !!segment && segment !== 'act4' && segment !== 'epilogue' && segment !== 'prologue'; world.busy = panelOpen() || talking();
    world.frame(dt, receiver.update(dt, now), mine.z);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return {
    world, sender, receiver, onState, onSolved,
    onCorridor: (msg) => act2.onCorridor(msg),
    onVote: (msg) => act2.onVote(msg),
    onAct4: (msg) => act4.onMessage(msg),
    zoneName: (z) => L(ROOMS.find((r) => r.id === z)?.name) || z,
    setNotes(n) { Object.assign(notes, n); },
    // 第一次進遊戲：載入完自動打開入學指南（劇情對話先等它關掉）
    tutorial() { if (!tutorialSeen()) openTutorial({ touch }); },
  };
}
