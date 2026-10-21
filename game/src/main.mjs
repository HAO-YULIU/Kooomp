// 《魔蝕milner》主程式（第 1 批）：18+ 提示 → 登入 → 選單 → 等待室 → 測試場景（隊友同步、聊天、標記、測試作答）。
import { t, errText, getLang, setLang } from './logic/i18n.mjs';
import { HOUSES, CHARS, charOfHouse } from './logic/chars.mjs';
import { signIn, lobbyGate } from './net/platform.mjs';
import { createRoom, roomInfo, connectRoom } from './net/room.mjs';
import { createSender, createReceiver } from './net/sync.mjs';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEV = params.has('dev');
document.body.classList.toggle('touch', matchMedia('(pointer: coarse)').matches);

// ---------- 畫面切換與文字 ----------
const screens = ['s-age', 's-login', 's-menu', 's-wait'];
function show(id) { for (const s of screens) $(s).hidden = s !== id; }
function paintText() {
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
  $('join-code').placeholder = t('join_ph'); $('chat-input').placeholder = t('chat_ph');
  for (const b of document.querySelectorAll('[data-lang]')) b.classList.toggle('on', b.dataset.lang === getLang());
  if (state) renderWait();
}
for (const b of document.querySelectorAll('[data-lang]')) b.onclick = () => { setLang(b.dataset.lang); $('plang').value = getLang(); paintText(); };
setLang(getLang()); $('plang').value = getLang(); paintText();

let toastTimer;
function toast(text) { const el = $('toast'); el.textContent = text; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 2600); }

// ---------- 18+ ----------
const AGE_KEY = 'ml_age_ok';
const ageOk = () => { try { return localStorage.getItem(AGE_KEY) === '1'; } catch { return false; } };
$('age-ok').onclick = () => { try { localStorage.setItem(AGE_KEY, '1'); } catch { /* 無痕模式 */ } boot(); };
if (ageOk() && !params.has('age')) boot(); else show('s-age');

// ---------- 登入 ----------
let me = null;
async function boot() {
  if (!window.supabase && !DEV) await new Promise((r) => addEventListener('load', r, { once: true }));
  me = await signIn().catch(() => null);
  if (!me || !me.name) {
    $('login-body').textContent = me ? t('need_player_body') : t('need_login_body');
    $('to-lobby').href = lobbyGate();
    return show('s-login');
  }
  $('hello').textContent = t('hello', { name: me.name });
  show('s-menu');
  const code = (params.get('room') || '').toUpperCase();
  if (/^[A-Z0-9]{4}$/.test(code)) { $('join-code').value = code; join(code); }
}

// ---------- 選單 ----------
const menuErr = (e) => { $('menu-err').textContent = e ? errText(e) : ''; };
async function create(mode) {
  menuErr();
  for (const b of ['btn-solo', 'btn-create', 'btn-join']) $(b).disabled = true;
  try { await enter(await createRoom(mode, $('plang').value)); }
  catch (e) { menuErr(e.message); }
  finally { for (const b of ['btn-solo', 'btn-create', 'btn-join']) $(b).disabled = false; }
}
$('btn-solo').onclick = () => create('solo');
$('btn-create').onclick = () => create('multi');
$('btn-join').onclick = () => join($('join-code').value.trim().toUpperCase());
$('join-code').onkeydown = (e) => { if (e.key === 'Enter') $('btn-join').click(); };
async function join(code) {
  menuErr();
  if (!/^[A-Z0-9]{4}$/.test(code)) return menuErr('room_not_found');
  const info = await roomInfo(code);
  if (info.error) return menuErr(info.error);
  if (info.count >= info.max) return menuErr('room_full');
  if (info.phase !== 'lobby') return menuErr('room_started');
  enter(code);
}

// ---------- 房間 ----------
let conn = null, state = null, myUid = null;
function enter(code) {
  state = null;
  conn = connectRoom(code, {
    uiLang: getLang(),
    onStatus(s) {
      $('status').textContent = s === 'open' ? '' : s === 'failed' ? errText('network') : t(s === 'reconnecting' ? 'reconnecting' : 'connecting');
      if (s === 'failed') { show('s-menu'); menuErr('network'); }
    },
    onMessage,
  });
  history.replaceState(null, '', `?${new URLSearchParams({ ...Object.fromEntries(params), room: code })}`);
}

function onMessage(msg) {
  switch (msg.t) {
    case 'hello': myUid = msg.you; break;
    case 'state': {
      const before = state;
      state = msg;
      if (state.phase === 'lobby') { show('s-wait'); renderWait(); }
      else { startPlay(); renderTeam(); world?.syncAvatars(state.members, myUid); }
      // 有新隊友加入：送一次自己的位置，讓他看得到你
      if (before && before.members.length < state.members.length) sender?.resend();
      for (const line of (!before ? state.chat : [])) addChat(line);
      break;
    }
    case 'pos': receiver.onPos(msg); break;
    case 'zone': {
      const m = state?.members.find((x) => x.uid === msg.uid); if (m) m.zone = msg.z;
      receiver.onZone(msg.uid, msg.z);
      if (world && msg.z === world.me().z) sender?.resend(); // 隊友走進你的區域
      renderTeam();
      break;
    }
    case 'chat': addChat(msg); break;
    case 'mark': world?.addMark(msg.kind, msg.p); if (msg.uid !== myUid) toast(`${nameOf(msg.uid)}：${t(`mark_${msg.kind}`)}`); break;
    case 'solved': toast(t('solved', { pid: msg.pid })); devOut(msg); break;
    case 'hint': devOut(msg); break;
    case 'error': if (!msg.id) toast(errText(msg.error)); break;
  }
}
const nameOf = (uid) => state?.members.find((m) => m.uid === uid)?.name ?? '?';

function renderWait() {
  if (!state || state.phase !== 'lobby') return;
  const mine = state.members.find((m) => m.uid === myUid);
  $('room-code').textContent = state.mode === 'solo' ? '—' : state.code;
  $('member-list').innerHTML = '';
  for (const m of state.members) {
    const li = document.createElement('li');
    const c = m.char ? CHARS[m.char][getLang()] : '—';
    li.innerHTML = `<span></span><span class="tag"></span>`;
    li.firstChild.textContent = `${m.name}　${c}`;
    li.lastChild.textContent = [m.uid === state.host ? t('host') : '', m.ready ? '✔' : '', m.online ? '' : t('offline')].filter(Boolean).join(' · ');
    $('member-list').append(li);
  }
  // 分學院（第 2 批換成分院鏡的問答）
  $('house-pick').innerHTML = '';
  for (const [h, info] of Object.entries(HOUSES)) {
    const b = document.createElement('button');
    b.style.setProperty('--hc', info.color);
    b.classList.toggle('on', mine?.sorted === charOfHouse(h));
    b.innerHTML = '<b></b>'; b.firstChild.textContent = info[getLang()];
    b.onclick = async () => {
      const r = await conn.request({ t: 'house', house: h });
      if (r.t === 'error') return ($('wait-err').textContent = errText(r.error));
      if (!mine?.char && !state.members.some((m) => m.char === charOfHouse(h))) conn.send({ t: 'char', char: charOfHouse(h) });
    };
    $('house-pick').append(b);
  }
  $('sorted-hint').textContent = mine?.sorted ? t('sorted_hint', { house: HOUSES[CHARS[mine.sorted].house][getLang()] }) : '';
  // 角色
  $('char-pick').innerHTML = '';
  for (const [c, info] of Object.entries(CHARS)) {
    const takenBy = state.members.find((m) => m.char === c && m.uid !== myUid);
    const b = document.createElement('button');
    b.style.setProperty('--hc', HOUSES[info.house].color);
    b.classList.toggle('on', mine?.char === c); b.disabled = !!takenBy || !!mine?.ready;
    b.innerHTML = '<b></b><small></small>';
    b.firstChild.textContent = info[getLang()];
    b.lastChild.textContent = takenBy ? `${t('taken')}（${takenBy.name}）` : HOUSES[info.house][getLang()];
    b.onclick = async () => { const r = await conn.request({ t: 'char', char: mine?.char === c ? null : c }); $('wait-err').textContent = r.t === 'error' ? errText(r.error) : ''; };
    $('char-pick').append(b);
  }
  $('btn-ready').textContent = mine?.ready ? t('not_ready') : t('ready');
  $('btn-ready').onclick = async () => { const r = await conn.request({ t: 'ready', ready: !mine?.ready }); $('wait-err').textContent = r.t === 'error' ? errText(r.error) : ''; };
  $('btn-start').hidden = state.host !== myUid;
  $('btn-start').onclick = async () => { const r = await conn.request({ t: 'start' }); $('wait-err').textContent = r.t === 'error' ? errText(r.error) : ''; };
}
$('btn-leave').onclick = () => { conn?.close(); conn = null; state = null; history.replaceState(null, '', location.pathname + (DEV ? `?dev=${params.get('dev')}` : '')); show('s-menu'); };

// ---------- 遊戲（第 1 批：測試場景） ----------
let world = null, sender = null;
const receiver = createReceiver();
async function startPlay() {
  if (world) return;
  for (const s of screens) $(s).hidden = true;
  $('view').hidden = false; $('hud').hidden = false; $('dev').hidden = !DEV;
  const { createWorld } = await import('./world/world.mjs');
  world = createWorld($('view'));
  // 每個人站的位置錯開一點，不會疊在一起
  const idx = Math.max(0, state.members.findIndex((m) => m.uid === myUid));
  world.controls.state.pos.x += (idx - 1.5) * 1.4;
  world.syncAvatars(state.members, myUid);
  sender = createSender((m) => { conn?.send(m); if (window.__ml) window.__ml.sent++; });
  if (DEV) window.__ml = { receiver, world, sent: 0 }; // 測試用
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const mine = world.me();
    sender.update(mine, now);
    world.frame(dt, receiver.update(dt, now), mine.z);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function renderTeam() {
  if (!state) return;
  $('team').innerHTML = '';
  for (const m of state.members) {
    const d = document.createElement('div');
    const zone = m.uid === myUid ? world?.me().z : m.zone;
    d.textContent = `${m.name}（${m.char ? CHARS[m.char][getLang()] : '—'}）${zone ? ' · ' + zone : ''}${m.online ? '' : ' · ' + t('offline')}`;
    $('team').append(d);
  }
}

// 聊天與標記
function addChat(line) {
  const li = document.createElement('li'); li.innerHTML = '<b></b> <span></span>';
  li.firstChild.textContent = line.name + '：'; li.lastChild.textContent = line.text;
  $('chat-log').append(li); $('chat-log').scrollTop = 1e9;
  while ($('chat-log').children.length > 40) $('chat-log').firstChild.remove();
}
$('chat-input').onkeydown = async (e) => {
  e.stopPropagation();
  if (e.key !== 'Enter') return;
  const text = e.target.value.trim(); if (!text) return;
  e.target.value = '';
  const r = await conn.request({ t: 'chat', text });
  if (r.t === 'error') toast(errText(r.error));
};
addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !$('hud').hidden && document.activeElement !== $('chat-input')) { document.exitPointerLock?.(); $('chat-input').focus(); }
});
const placeMark = (kind) => { if (world) conn.send({ t: 'mark', kind, z: world.me().z, p: world.lookPoint() }); };
for (const b of document.querySelectorAll('[data-mark]')) b.onclick = () => placeMark(b.dataset.mark);
// 電腦：滑鼠鎖定時點不到按鈕，用 1／2／3 放標記
const MARK_KEYS = { Digit1: 'here', Digit2: 'danger', Digit3: 'help' };
addEventListener('keydown', (e) => { if (MARK_KEYS[e.code] && !$('hud').hidden && document.activeElement?.tagName !== 'INPUT') placeMark(MARK_KEYS[e.code]); });

// 測試作答（網址加 ?dev）
function devOut(m) { if (DEV) $('dev-out').textContent = JSON.stringify(m, null, 1) + '\n' + $('dev-out').textContent.slice(0, 2000); }
const devValue = () => { const v = $('dev-val').value.trim(); try { return JSON.parse(v); } catch { return v; } };
$('dev-answer').onclick = async () => { const r = await conn.request({ t: 'answer', pid: $('dev-pid').value.trim().toUpperCase(), value: devValue() }); devOut(r); if (r.solved) toast(t('solved', { pid: r.pid })); else if (r.t === 'result') toast(t('wrong')); else if (r.t === 'error') toast(errText(r.error, { s: Math.ceil((r.wait ?? 0) / 1000) })); };
$('dev-hint').onclick = async () => devOut(await conn.request({ t: 'hint', pid: $('dev-pid').value.trim().toUpperCase() }));
$('dev-peek').onclick = async () => devOut(await conn.request({ t: 'peek', pid: $('dev-pid').value.trim().toUpperCase() }));
for (const id of ['dev-pid', 'dev-val']) $(id).onkeydown = (e) => e.stopPropagation();
