// 《魔蝕milner》主程式（第 1 批）：18+ 提示 → 登入 → 選單 → 等待室 → 測試場景（隊友同步、聊天、標記、測試作答）。
import { t, errText, getLang, setLang } from './logic/i18n.mjs';
import { HOUSES, CHARS, charOfHouse } from './logic/chars.mjs';
import { signIn, lobbyGate, testPanel, isTest, devLogin } from './net/platform.mjs';
import { createRoom, roomInfo, connectRoom, mySave } from './net/room.mjs';
import { openSorting } from './ui/sorting.mjs';
import { DefaultLoadingManager } from 'three';
import { setMusic, setMusicVolume, getMusicVolume } from './art/sfx.mjs';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEV = params.has('dev') || testPanel; // ?dev（本機）或測試登入加 &panel：顯示測試作答面板
document.body.classList.toggle('touch', matchMedia('(pointer: coarse)').matches);
// 手機：不小心點兩下、兩指捏都不要放大畫面（iPhone 的 Safari 不理會 viewport 的 user-scalable=no）
// 按鈕不擋（轉環、敲節奏要能快速連點；按鈕本身有 touch-action: manipulation 不會放大）
{ let lastTap = 0;
  document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTap < 350 && !e.target.closest('button, a, input, textarea, select, canvas, [onclick], .choice')) e.preventDefault(); lastTap = now; }, { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || (e.scale ?? 1) !== 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false }); }

// ---------- 畫面切換與文字 ----------
const screens = ['s-age', 's-login', 's-menu', 's-wait'];
function show(id) { for (const s of screens) $(s).hidden = s !== id; }
function paintText() {
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
  $('join-code').placeholder = t('join_ph'); $('chat-input').placeholder = t('chat_ph');
  for (const b of document.querySelectorAll('[data-lang]')) b.classList.toggle('on', b.dataset.lang === getLang());
  if (state) renderWait();
}
for (const b of document.querySelectorAll('[data-lang]')) b.onclick = () => { setLang(b.dataset.lang); $('plang').value = getLang(); paintText(); paintMusic(); };
setLang(getLang()); $('plang').value = getLang(); paintText();

let toastTimer;
function toast(text) { const el = $('toast'); el.textContent = text; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 2600); }

// ---------- 18+ ----------
// 每次打開遊戲（新的分頁）都要再確認一次年齡（2026-10-22 製作人：要提示年齡限制）
const AGE_KEY = 'ml_age_ok';
const ageOk = () => { try { return sessionStorage.getItem(AGE_KEY) === '1'; } catch { return false; } };
$('age-ok').onclick = () => { try { sessionStorage.setItem(AGE_KEY, '1'); } catch { /* 無痕模式 */ } boot(); };
$('age-no').onclick = () => { $('age-bye').hidden = false; $('age-ok').hidden = true; $('age-no').hidden = true; };
if (ageOk() && !params.has('age')) boot(); else show('s-age');
setMusic('menu'); // 主選單的配樂（玩家點過畫面才會響）
// 右上角：音樂開關（遊戲裡的設定可以細調）
const musicBtn = document.createElement('button'); musicBtn.id = 'music-toggle'; musicBtn.className = 'chip';
const paintMusic = () => { const on = getMusicVolume() > 0; musicBtn.textContent = `${on ? '♪' : '✕'} ${t('music_volume')}`; musicBtn.classList.toggle('on', on); };
musicBtn.onclick = () => { setMusicVolume(getMusicVolume() > 0 ? 0 : 1); paintMusic(); };
paintMusic(); document.body.append(musicBtn);

// ---------- 登入 ----------
let me = null;
async function boot() {
  if (!window.supabase && !DEV) await new Promise((r) => addEventListener('load', r, { once: true }));
  me = await signIn().catch(() => null);
  if (!me || !me.name) {
    $('login-body').textContent = me ? t('need_player_body') : t('need_login_body');
    $('to-lobby').href = lobbyGate();
    $('dev-email').placeholder = t('dev_email'); $('dev-pass').placeholder = t('dev_pass');
    $('dev-login-form').onsubmit = async (e) => { // 開發者（大廳管理員）直接登入：遊戲還沒上架大廳時用
      e.preventDefault(); $('dev-login-err').textContent = '';
      const r = await devLogin($('dev-email').value.trim(), $('dev-pass').value).catch(() => ({ error: 'bad_login' }));
      if (r.error) return ($('dev-login-err').textContent = t(r.error === 'not_dev' ? 'dev_not_dev' : 'dev_bad_login'));
      boot();
    };
    return show('s-login');
  }
  $('hello').textContent = t('hello', { name: me.name });
  show('s-menu');
  showSave();
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
  if (info.member) return enter(code); // 已經是成員：回來繼續玩（從最近的段落開始）
  if (info.count >= info.max) return menuErr('room_full');
  if (info.phase !== 'lobby') return menuErr('room_started');
  enter(code);
}
// 選單：繼續上次的遊戲、第一章通關過
async function showSave() {
  const save = await mySave();
  $('save-info').textContent = save.cleared?.includes(1) ? t('cleared_ch1') : '';
  const last = save.last, btn = $('btn-continue');
  btn.hidden = !last;
  if (!last) return;
  btn.querySelector('small').textContent = `${t(last.mode === 'solo' ? 'solo' : 'create')} · ${t(`seg_name.${last.segment}`)}${last.mode === 'solo' ? '' : ` · ${last.code}`}`;
  btn.onclick = () => join(last.code);
}

// ---------- 房間 ----------
let conn = null, state = null, myUid = null, devUser = false; // devUser：伺服器說是開發者（顯示 🛠 測試工具）
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
    case 'hello': myUid = msg.you; devUser = !!msg.dev; break;
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
    case 'npc': case 'grab': case 'escaped': case 'revived': case 'captured': case 'freed': case 'repel': case 'noise': case 'lost': case 'retry': game?.onAct4(msg); break;
    case 'chat': addChat(msg); break;
    case 'mark': game?.world.addMark(msg.kind, msg.p); if (msg.uid !== myUid) toast(`${nameOf(msg.uid)}：${t(`mark_${msg.kind}`)}`); break;
    case 'solved': game?.onSolved(msg.pid, msg.by); toast(`${nameOf(msg.by)}：${t('solved', { pid: msg.pid })}`); devOut(msg); break;
    case 'hint': if (state) (state.hints[msg.pid] ??= []).push(msg.text); toast(`${nameOf(msg.by)}：${t('hint')}`); break;
    case 'error': if (!msg.id) toast(errText(msg.error)); break;
  }
}
// 括號、冒號：中文用全形，英文用半形
const paren = (x) => (getLang() === 'en' ? ` (${x})` : `（${x}）`);
const colon = () => (getLang() === 'en' ? ': ' : '：');
const nameOf = (uid) => state?.members.find((m) => m.uid === uid)?.name ?? '?';

// 等待室：① 分院鏡（一定要做）→ ② 選角色（左邊的展示台看得到角色）→ ③ 準備
let preview = null, peek = null, autoSorted = false, sortingOpen = false;
async function stage(c) { // 展示台換角色
  if (!c) return;
  const info = CHARS[c], H = HOUSES[info.house], L = getLang();
  $('stage-name').textContent = info[L]; $('stage-house').textContent = `${H.sigil} ${H[L]}・${H.motto[L]}`;
  $('stage-blurb').textContent = info.blurb[L]; $('stage-power').textContent = H.power[L];
  $('s-wait').style.setProperty('--hc', H.color);
  if (!preview) { const { createPreview } = await import('./art/preview.mjs'); preview ??= createPreview($('char-stage')); }
  preview.show(c, H.color);
}
function closeStage() { preview?.dispose(); preview = null; peek = null; autoSorted = false; }
function sortNow() {
  sortingOpen = true;
  openSorting(async (h) => {
    sortingOpen = false;
    const r = await conn.request({ t: 'house', house: h });
    if (r.t === 'error') return ($('wait-err').textContent = errText(r.error));
    const me = state.members.find((m) => m.uid === myUid);
    if (!me?.char && !state.members.some((m) => m.char === charOfHouse(h))) { await conn.request({ t: 'char', char: charOfHouse(h) }); preview?.mood('smile'); }
  });
  // 中途關掉視窗：還是沒分學院，之後按按鈕可以再來
  const close = document.getElementById('panel-close'), prev = close.onclick;
  close.onclick = (e) => { sortingOpen = false; close.onclick = prev; prev?.(e); };
}

function renderWait() {
  if (!state || state.phase !== 'lobby') return;
  const mine = state.members.find((m) => m.uid === myUid), L = getLang();
  const sortedHouse = mine?.sorted ? CHARS[mine.sorted].house : null;
  $('room-code').textContent = state.mode === 'solo' ? '—' : state.code;
  $('member-list').innerHTML = '';
  for (const m of state.members) {
    const li = document.createElement('li');
    if (m.char) li.style.setProperty('--hc', HOUSES[CHARS[m.char].house].color);
    li.innerHTML = `<span></span><span class="tag"></span>`;
    li.firstChild.textContent = `${m.name}　${m.char ? CHARS[m.char][L] : '—'}`;
    li.lastChild.textContent = [m.uid === state.host ? t('host') : '', m.ready ? '✔' : '', m.online ? '' : t('offline')].filter(Boolean).join(' · ');
    $('member-list').append(li);
  }
  // ① 分院鏡（P01）：一定要先做；結果把對應學院的角色設成預設，可以改選
  $('house-pick').innerHTML = '';
  const sb = document.createElement('button');
  if (sortedHouse) {
    const H = HOUSES[sortedHouse];
    sb.className = 'house-badge'; sb.style.setProperty('--hc', H.color); sb.disabled = !!mine?.ready;
    sb.innerHTML = '<i></i><b></b><small></small>';
    sb.children[0].textContent = H.sigil; sb.children[1].textContent = H[L]; sb.children[2].textContent = `${t('sorting_done')} ${paren('↻')}`;
  } else { sb.className = 'primary small glow'; sb.textContent = t('sorting_open'); }
  sb.onclick = sortNow;
  $('house-pick').append(sb);
  $('sorted-hint').textContent = sortedHouse ? t('sorted_hint', { house: HOUSES[sortedHouse][L] }) : '';
  $('step-sort').className = sortedHouse ? 'done' : 'now';
  $('step-char').className = !sortedHouse ? 'locked' : mine?.char ? 'done' : 'now';
  $('step-ready').className = mine?.ready ? 'done' : mine?.char ? 'now' : 'locked';
  $('char-lock').textContent = sortedHouse ? '' : t('sort_first');
  // ② 角色卡片：還沒分學院時只能看、不能選
  $('char-pick').innerHTML = '';
  for (const [c, info] of Object.entries(CHARS)) {
    const takenBy = state.members.find((m) => m.char === c && m.uid !== myUid);
    const b = document.createElement('button');
    b.style.setProperty('--hc', HOUSES[info.house].color);
    b.classList.toggle('on', mine?.char === c); b.classList.toggle('locked', !sortedHouse); b.classList.toggle('mine', info.house === sortedHouse);
    b.disabled = !!takenBy || !!mine?.ready;
    b.innerHTML = `<img alt="" src="img/chars/${c}.webp"><b></b><small></small>`;
    b.children[1].textContent = info[L];
    b.children[2].textContent = takenBy ? `${t('taken')}${paren(takenBy.name)}` : `${HOUSES[info.house].sigil} ${HOUSES[info.house][L]}`;
    b.onpointerenter = () => { peek = c; stage(c); };
    b.onpointerleave = () => { peek = null; stage(mine?.char || mine?.sorted || 'elora'); };
    b.onclick = async () => {
      peek = c; stage(c);
      if (!sortedHouse) return ($('wait-err').textContent = t('sort_first'));
      const r = await conn.request({ t: 'char', char: mine?.char === c ? null : c });
      $('wait-err').textContent = r.t === 'error' ? errText(r.error) : '';
      if (r.t !== 'error' && mine?.char !== c) { preview?.mood('smile'); $('step-ready').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    };
    $('char-pick').append(b);
  }
  stage(peek || mine?.char || mine?.sorted || 'elora');
  if (!sortedHouse && !autoSorted && !sortingOpen) { autoSorted = true; setTimeout(sortNow, 400); } // 第一次進等待室就站到分院鏡前
  $('btn-ready').textContent = mine?.ready ? t('not_ready') : t('ready');
  $('btn-ready').className = mine?.char && !mine?.ready ? 'primary small' : '';
  $('btn-ready').onclick = async () => { fullscreen(); const r = await conn.request({ t: 'ready', ready: !mine?.ready }); $('wait-err').textContent = r.t === 'error' ? errText(r.error) : ''; };
  $('btn-start').hidden = state.host !== myUid;
  $('btn-start').onclick = async () => { fullscreen(); const r = await conn.request({ t: 'start' }); $('wait-err').textContent = r.t === 'error' ? errText(r.error) : ''; };
}
// 手機：全螢幕（Android 會藏起網址列；要在玩家按按鈕時呼叫才有效）
const fullscreen = () => import('../../prototype/src/orient.mjs').then((o) => o.enterFullscreen());
$('btn-leave').onclick = () => { closeStage(); conn?.close(); conn = null; state = null; history.replaceState(null, '', location.pathname + (params.has('dev') ? `?dev=${params.get('dev')}` : '')); show('s-menu'); };

// 手機：右上角的全螢幕按鈕。不在全螢幕時才出現；iPhone 不支援網頁全螢幕，就說明「加入主畫面」
function setupFullscreen() {
  if (!document.body.classList.contains('touch')) return;
  const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone;
  const can = !!document.documentElement.requestFullscreen;
  const upd = () => { $('btn-full').hidden = standalone || !!document.fullscreenElement; };
  $('btn-full').onclick = () => { if (can) fullscreen(); else toast(t('full_tip')); };
  document.addEventListener('fullscreenchange', upd); upd();
  if (!standalone && !document.fullscreenElement) setTimeout(() => toast(t('full_tip')), 4000);
  if (can) $('view').addEventListener('pointerup', () => { if (!document.fullscreenElement) fullscreen(); }, { once: true }); // 第一次點畫面就進全螢幕
}

// ---------- 遊戲 ----------
let game = null, starting = false, pendingNotes = null;
// 載入畫面（2026-10-22 製作人：按出發後看起來像卡住）：
// 蓋整座學校時電腦會忙到沒空畫畫面，所以 1) 先讓載入畫面畫出來再開始蓋 2) 每一步換一句說明、進度往前跳
// 3) 轉圈的魔法陣和進度條上的流光用 CSS 的 transform 動畫——電腦在忙的時候也會繼續動，不會看起來當掉
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
function loadingScreen() {
  const el = $('loading'), tips = t('loading_tips').split('|');
  el.hidden = false; el.classList.remove('failed');
  let tip = Math.floor(Math.random() * tips.length);
  const showTip = () => { $('loading-tip').textContent = '✧ ' + tips[tip++ % tips.length] + ' ✧'; };
  showTip(); const tipTimer = setInterval(showTip, 3500);
  const safety = setTimeout(() => { el.hidden = true; }, 90000); // 萬一出錯，最多 90 秒也會打開，不會一直卡在載入畫面
  // 每一步：[說明, 起點, 終點]
  const STEPS = { script: ['loading_script', 0.03, 0.15], build: ['loading_build', 0.15, 0.4], models: ['loading_models', 0.4, 0.9], gpu: ['loading_gpu', 0.9, 1] };
  let shown = 0, stage = 'script', stageT0 = performance.now(), models = { done: 0, total: 0 };
  DefaultLoadingManager.onProgress = (_, done, total) => { models = { done, total }; };
  const setStage = (s) => { stage = s; stageT0 = performance.now(); $('loading-text').textContent = t(STEPS[s][0]); paint(); };
  const target = () => {
    const [, a, b] = STEPS[stage];
    if (stage === 'models') return a + (b - a) * (models.total ? models.done / models.total : 0);
    return a + (b - a) * (1 - Math.exp(-(performance.now() - stageT0) / 2500)); // 不知道還要多久的步驟：慢慢往終點靠
  };
  const paint = () => { shown = Math.max(shown, shown + (target() - shown) * 0.2); $('loading-bar').style.width = `${(shown * 100).toFixed(1)}%`; $('loading-pct').textContent = `${Math.round(shown * 100)}%`; };
  const anim = setInterval(paint, 50);
  setStage('script');
  return {
    stage: async (s) => { setStage(s); shown = Math.max(shown, STEPS[s][1]); paint(); await nextPaint(); }, // 換一步，等畫面畫出來再繼續
    fail() { clearInterval(anim); clearInterval(tipTimer); clearTimeout(safety); el.classList.add('failed'); $('loading-text').textContent = t('loading_fail'); $('loading-tip').innerHTML = ''; const b = document.createElement('button'); b.className = 'primary small'; b.textContent = t('loading_retry'); b.onclick = () => location.reload(); $('loading-tip').append(b); },
    // 等模型都載完（0.8 秒內沒有新的要載），最多等 30 秒
    async ready() {
      await this.stage('models');
      const t0 = performance.now(); let idle = 0;
      while (performance.now() - t0 < 30000) {
        await new Promise((r) => setTimeout(r, 100));
        idle = models.total && models.done >= models.total ? idle + 100 : 0;
        if (idle >= 800 || (!models.total && performance.now() - t0 > 3000)) break;
      }
      await this.stage('gpu');
      await new Promise((r) => setTimeout(r, 300));
      await Promise.race([game?.world?.ready?.(), new Promise((r) => setTimeout(r, 20000))]); // 等材質在背景編譯好（最多 20 秒）
      clearInterval(anim); clearInterval(tipTimer); clearTimeout(safety); $('loading-bar').style.width = '100%'; $('loading-pct').textContent = '100%';
      el.classList.add('out'); setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 600);
    },
  };
}

async function startGame() {
  if (game || starting) return;
  starting = true; setMusic(null); musicBtn.hidden = true;
  const loading = loadingScreen();
  closeStage(); $('backdrop').hidden = true;
  for (const s of screens) $(s).hidden = true;
  await nextPaint(); // 先讓載入畫面出來
  try {
    setupFullscreen();
    $('view').hidden = false; $('hud').hidden = false; $('dev').hidden = !DEV;
    const { startPlay } = await import('./logic/play.mjs');
    // 手機：遊戲中強制橫向（Android 全螢幕時會真的鎖住；iPhone 只能蓋提示）
    const orient = await import('../../prototype/src/orient.mjs');
    orient.initOrientation($('rotate'));
    orient.requireOrientation('landscape', { text: t('rotate_landscape') });
    await (await import('./art/models.mjs')).preloadProps().catch(() => {}); // 製作人給的擺設模型（有的話）
    await loading.stage('build'); // 蓋學校（最久、畫面會停住，但魔法陣和流光會繼續轉）
    const t0 = performance.now();
    game = startPlay({ conn, getState: () => state, myUid, toast, dev: DEV, devUser: devUser || DEV });
    if (DEV) console.log(`蓋學校花了 ${Math.round(performance.now() - t0)} 毫秒`);
    if (pendingNotes) game.setNotes(pendingNotes);
    game.onState(state, null);
    renderTeam();
  } catch (e) { console.error(e); loading.fail(); return; }
  loading.ready().then(() => game.tutorial());
}
function renderTeam() {
  if (!state) return;
  $('team').innerHTML = '';
  const seg = t(`seg_name.${state.segment}`);
  if (seg && !seg.startsWith('seg_name')) $('team').append(Object.assign(document.createElement('div'), { className: 'seg', textContent: seg }));
  for (const m of state.members) {
    const d = document.createElement('div');
    const zone = m.uid === myUid ? game?.world.zone() : m.zone;
    d.textContent = `${m.name}${paren(m.char ? CHARS[m.char][getLang()] : '—')}${zone && game ? ' · ' + game.zoneName(zone) : ''}${m.online ? '' : ' · ' + t('offline')}`;
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
