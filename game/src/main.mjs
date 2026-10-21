// 《魔蝕milner》主程式（第 1 批）：18+ 提示 → 登入 → 選單 → 等待室 → 測試場景（隊友同步、聊天、標記、測試作答）。
import { t, errText, getLang, setLang } from './logic/i18n.mjs';
import { HOUSES, CHARS, charOfHouse } from './logic/chars.mjs';
import { signIn, lobbyGate, testPanel, isTest } from './net/platform.mjs';
import { createRoom, roomInfo, connectRoom } from './net/room.mjs';
import { openSorting } from './ui/sorting.mjs';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEV = params.has('dev') || testPanel; // ?dev（本機）或測試登入加 &panel：顯示測試作答面板
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
const menuErr = (e) => { $('menu-err').textContent = e ? errText(isTest && e === 'need_login' ? 'test_pass' : e) : ''; };
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
    case 'notes': pendingNotes = msg.notes; game?.setNotes(msg.notes); break;
    case 'state': {
      const before = state;
      state = msg;
      if (state.phase === 'lobby') { show('s-wait'); renderWait(); }
      else { startGame(); game?.onState(state, before); renderTeam(); }
      for (const line of (!before ? state.chat : [])) addChat(line);
      break;
    }
    case 'pos': game?.receiver.onPos(msg); break;
    case 'zone': {
      const m = state?.members.find((x) => x.uid === msg.uid); if (m) m.zone = msg.z;
      game?.receiver.onZone(msg.uid, msg.z);
      if (game && msg.z === game.world.zone()) game.sender.resend(); // 隊友走進你的區域
      renderTeam();
      break;
    }
    case 'corridor': game?.onCorridor(msg); break;
    case 'vote': game?.onVote(msg); break;
    case 'chat': addChat(msg); break;
    case 'mark': game?.world.addMark(msg.kind, msg.p); if (msg.uid !== myUid) toast(`${nameOf(msg.uid)}：${t(`mark_${msg.kind}`)}`); break;
    case 'solved': game?.onSolved(msg.pid, msg.by); toast(`${nameOf(msg.by)}：${t('solved', { pid: msg.pid })}`); devOut(msg); break;
    case 'hint': if (state) (state.hints[msg.pid] ??= []).push(msg.text); toast(`${nameOf(msg.by)}：${t('hint')}`); break;
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
  // 分院鏡的問答（P01）：結果把對應學院的角色設成預設，可以改選
  $('house-pick').innerHTML = '';
  const sb = document.createElement('button');
  sb.className = 'primary small';
  sb.textContent = mine?.sorted ? `${t('sorting_done')}：${HOUSES[CHARS[mine.sorted].house][getLang()]}（↻）` : t('sorting_open');
  sb.onclick = () => openSorting(async (h) => {
    const r = await conn.request({ t: 'house', house: h });
    if (r.t === 'error') return ($('wait-err').textContent = errText(r.error));
    const me = state.members.find((m) => m.uid === myUid);
    if (!me?.char && !state.members.some((m) => m.char === charOfHouse(h))) conn.send({ t: 'char', char: charOfHouse(h) });
  });
  $('house-pick').append(sb);
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
  $('btn-start').onclick = async () => { import('../../prototype/src/orient.mjs').then((o) => o.enterFullscreen()); const r = await conn.request({ t: 'start' }); $('wait-err').textContent = r.t === 'error' ? errText(r.error) : ''; };
}
$('btn-leave').onclick = () => { conn?.close(); conn = null; state = null; history.replaceState(null, '', location.pathname + (params.has('dev') ? `?dev=${params.get('dev')}` : '')); show('s-menu'); };

// ---------- 遊戲 ----------
let game = null, starting = false, pendingNotes = null;
async function startGame() {
  if (game || starting) return;
  starting = true;
  for (const s of screens) $(s).hidden = true;
  $('view').hidden = false; $('hud').hidden = false; $('dev').hidden = !DEV;
  const { startPlay } = await import('./logic/play.mjs');
  // 手機：遊戲中強制橫向（Android 全螢幕時會真的鎖住；iPhone 只能蓋提示）
  const orient = await import('../../prototype/src/orient.mjs');
  orient.initOrientation($('rotate'));
  orient.requireOrientation('landscape', { text: t('rotate_landscape') });
  game = startPlay({ conn, getState: () => state, myUid, toast, dev: DEV });
  if (pendingNotes) game.setNotes(pendingNotes);
  game.onState(state, null);
  renderTeam();
}
function renderTeam() {
  if (!state) return;
  $('team').innerHTML = '';
  const seg = t(`seg_name.${state.segment}`);
  if (seg && !seg.startsWith('seg_name')) $('team').append(Object.assign(document.createElement('div'), { className: 'seg', textContent: seg }));
  for (const m of state.members) {
    const d = document.createElement('div');
    const zone = m.uid === myUid ? game?.world.zone() : m.zone;
    d.textContent = `${m.name}（${m.char ? CHARS[m.char][getLang()] : '—'}）${zone && game ? ' · ' + game.zoneName(zone) : ''}${m.online ? '' : ' · ' + t('offline')}`;
    $('team').append(d);
  }
}
setInterval(() => { if (game) renderTeam(); }, 1500);

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
  const text = e.target.value.trim(); if (!text) { e.target.blur(); return; }
  e.target.value = '';
  const r = await conn.request({ t: 'chat', text });
  if (r.t === 'error') toast(errText(r.error));
};
addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !$('hud').hidden && document.activeElement?.tagName !== 'INPUT' && $('panel').hidden && $('dialog').hidden) { document.exitPointerLock?.(); $('chat-input').focus(); }
});
const placeMark = (kind) => { if (game) conn.send({ t: 'mark', kind, z: game.world.zone(), p: game.world.lookPoint() }); };
for (const b of document.querySelectorAll('[data-mark]')) b.onclick = () => placeMark(b.dataset.mark);
// 電腦：滑鼠鎖定時點不到按鈕，用 1／2／3 放標記
const MARK_KEYS = { Digit1: 'here', Digit2: 'danger', Digit3: 'help' };
addEventListener('keydown', (e) => { if (MARK_KEYS[e.code] && !$('hud').hidden && document.activeElement?.tagName !== 'INPUT') placeMark(MARK_KEYS[e.code]); });

// 測試作答（網址加 ?dev）。題號填 SEG、值填段落名稱（例如 act1）可以直接跳段（只有本機）
function devOut(m) { if (DEV) $('dev-out').textContent = JSON.stringify(m, null, 1) + '\n' + $('dev-out').textContent.slice(0, 2000); }
const devValue = () => { const v = $('dev-val').value.trim(); try { return JSON.parse(v); } catch { return v; } };
$('dev-answer').onclick = async () => {
  const pid = $('dev-pid').value.trim().toUpperCase();
  if (pid === 'SEG') return devOut(await conn.request({ t: 'dev', segment: $('dev-val').value.trim() }));
  const r = await conn.request({ t: 'answer', pid, value: devValue() }); devOut(r);
  if (r.solved) { game?.onSolved(pid, myUid, r.reveal); toast(t('solved', { pid: r.pid })); }
  else if (r.t === 'result') toast(t('wrong')); else if (r.t === 'error') toast(errText(r.error, { s: Math.ceil((r.wait ?? 0) / 1000) }));
};
$('dev-hint').onclick = async () => devOut(await conn.request({ t: 'hint', pid: $('dev-pid').value.trim().toUpperCase() }));
$('dev-peek').onclick = async () => devOut(await conn.request({ t: 'peek', pid: $('dev-pid').value.trim().toUpperCase() }));
for (const id of ['dev-pid', 'dev-val']) $(id).onkeydown = (e) => e.stopPropagation();
