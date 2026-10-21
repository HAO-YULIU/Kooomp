// 技術雛形的主程式：樣品教室＋艾洛拉＋第一人稱＋魔杖（三種施咒方式）＋手機掃 QR code 當魔杖。
import * as THREE from 'three';
import { buildClassroom, ROOM } from './scene.mjs';
import { buildElora } from './character.mjs';
import { createControls } from './controls.mjs';
import { SPELLS, recognize, attachRuneCanvas, requestMotionPermission, watchGestures } from './spells.mjs';
import { isTouch, initOrientation, requireOrientation, enterFullscreen, onOrientation, current } from './orient.mjs';
import { joinWandLink, makeCode } from './link.mjs';
import * as sfx from './audio.mjs';
import { loadCC } from './cc.mjs';
import { loadCyril } from './cyril.mjs';
import { loadWarden } from './warden.mjs';
import { loadMoonStaff, loadDragonStaff } from './staffs.mjs';

const $ = (id) => document.getElementById(id);
document.body.classList.toggle('touch', isTouch);

// ---------- 3D ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
const room = buildClassroom(scene, { lowQuality: isTouch });
const elora = buildElora(scene);
elora.root.position.set(-5.4, 0, -1.0); elora.root.rotation.y = 1.0; // 站在窗邊，月光和燭光都照得到
room.colliders.push({ minX: -5.8, maxX: -5.0, minZ: -1.4, maxZ: -0.6 });
// 角色模型（製作人提供的免費模型）。艾洛拉可以用按鈕切換「寫實模型／程式繪製」，比較美術風格
let realModel = null, useModel = new URLSearchParams(location.search).get('char') !== 'code'; // 預設用寫實模型；網址加 ?char=code 改成程式繪製
const npcs = {}; // 名字 → { root, update, setMood, talk }
function placeNPC(name, loader, pos, rotY, label, kind = name) {
  return loader.then((c) => {
    c.root.position.copy(pos); c.root.rotation.y = rotY; c.setRest?.(rotY); npcs[name] = c;
    room.colliders.push({ minX: pos.x - 0.4, maxX: pos.x + 0.4, minZ: pos.z - 0.4, maxZ: pos.z + 0.4 });
    targets.push({ object: c.root, label, kind });
    return c;
  }).catch((e) => console.warn(name + '模型載入失敗', e));
}
// 艾洛拉：艾爾德林（銀白＋淡藍），站在窗邊。模型附的眼鏡先不戴
placeNPC('艾洛拉', loadCC(scene, { body: 'elora', house: { main: '#cdd3df', trim: '#7fa7d6' }, hair: '#9a7444', hairTip: '#dcc08a', skin: '#f2d2bd', height: 0.9, cloakScale: 0.9 }),
  new THREE.Vector3(-5.4, 0, -1.0), 1.0, '和艾洛拉說話', 'elora').then((c) => { if (!c) return; realModel = c.root; $('btn-style').hidden = false; applyStyle(); });
// 月晞：格里莫瓦（深紅＋羊皮紙色），黑髮丸子頭，站在書架旁
placeNPC('月晞', loadCC(scene, { body: 'female', house: { main: '#2a0c10', trim: '#d8c49a' }, hair: '#0d0a0a', hairTip: '#2a2226', skin: '#efcdb4', cloakScale: 0.92 }),
  new THREE.Vector3(5.2, 0, 0.2), -1.75, '和月晞說話');
// 沃恩：貝爾蒙特（黑＋金），站在老師桌子旁
placeNPC('沃恩', loadCC(scene, { body: 'male', house: { main: '#121214', trim: '#b8902e' }, hair: '#1e1510', hairTip: '#4a3426', skin: '#e8bfa2' }),
  new THREE.Vector3(4.4, 0, -5.4), -0.35, '和沃恩說話');
// 西里爾：烏洛波斯（墨綠＋銀），站在後面的窗邊，離大家有點距離
placeNPC('西里爾', loadCyril(scene), new THREE.Vector3(-5.2, 0, 5.2), 2.4, '和西里爾說話');
// 守夜人：顯影咒之後的驚嚇，出現在玩家面前的就是他
let warden = null;
loadWarden(scene).then((w) => { warden = w; room.setScareFigure(w.root, '#4dff7a'); }).catch((e) => console.warn('守夜人模型載入失敗', e));

// 第一人稱的法杖：星月法杖（女生）、龍首法杖（男生），右上角按鈕切換
const staff = new THREE.Group(); let staffs = {}, staffKind = 'moon', staffGlow = [];
scene.add(camera); camera.add(staff);
staff.position.set(0.42, -0.5, -0.8); staff.rotation.set(0.3, 0.3, -0.22);
const STAFF_NAMES = { moon: '星月法杖', dragon: '龍首法杖' };
function showStaff() {
  for (const [k, v] of Object.entries(staffs)) v.object.visible = k === staffKind;
  staffGlow = staffs[staffKind]?.glow || [];
  $('btn-staff').textContent = '🔁 ' + STAFF_NAMES[staffKind];
}
for (const [kind, load] of [['moon', loadMoonStaff], ['dragon', loadDragonStaff]]) {
  load().then((st) => { st.object.scale.setScalar(0.5); st.object.position.y = -0.36; staff.add(st.object); staffs[kind] = st; showStaff(); })
    .catch((e) => console.warn('法杖載入失敗', e));
}
function applyStyle() {
  elora.root.visible = !useModel; if (realModel) realModel.visible = useModel;
  $('btn-style').textContent = useModel ? '🎨 艾洛拉：寫實模型' : '🎨 艾洛拉：程式繪製';
}
const controls = createControls(camera, renderer.domElement, {
  colliders: room.colliders, isTouch, onStep: sfx.step,
  bounds: { minX: -ROOM.w / 2, maxX: ROOM.w / 2, minZ: -ROOM.d / 2, maxZ: ROOM.d / 2 },
});
controls.state.yaw = 0.15;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w < h ? 85 : 70; // 直向時視野拉寬一點，魔杖模式背景還看得到教室
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// 魔杖光：施咒時從畫面下方亮一下
const wandLight = new THREE.PointLight('#9fc4ff', 0, 8, 1.5); scene.add(wandLight);
let wandFlash = 0;

// ---------- 調查 ----------
const ray = new THREE.Raycaster(); ray.far = 3.4;
const targets = [
  { object: elora.root, label: '和艾洛拉說話', kind: 'elora' },
  ...room.interactables,
];
let focus = null;
function pickFocus() {
  ray.setFromCamera({ x: 0, y: 0 }, camera);
  const hits = ray.intersectObjects(targets.map((t) => t.object), true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o) { const t = targets.find((x) => x.object === o); if (t) return t; o = o.parent; }
  return null;
}
function interact() {
  if (!focus || mode !== 'walk') return;
  if (focus.kind === 'elora') talkToElora();
  else if (focus.kind === '月晞') {
    const Y = (text, mood = 'calm') => ({ who: '月晞', text, mood });
    say(room.state.revealed
      ? [Y('……黑板上的字，是用血寫的。', 'scared'), Y('筆畫是從右往左寫的。寫字的人，可能不太習慣用右手。'), Y('我們不該待在這裡。', 'scared')]
      : [Y('噓。'), Y('……這排書，每一本都被翻到同一頁。'), Y('第十三頁。', 'smile')]);
  }
  else if (focus.kind === '西里爾') {
    const C = (text) => ({ who: '西里爾', text });
    say(room.state.revealed
      ? [C('……「午夜之前離開」。'), C('有人想嚇我們。或是，想警告我們。'), C('不管是哪一個，都不是什麼好消息。')]
      : [C('別看我，我只是剛好路過。'), C('你們要闖禍，我不攔。只是別把我的名字扯進去。')]);
  }
  else if (focus.kind === '沃恩') {
    const V = (text, mood = 'calm') => ({ who: '沃恩', text, mood });
    say(room.state.revealed
      ? [V('剛剛那個黑影……你也看到了吧？', 'scared'), V('……沒事。要是它再出現，我會擋在前面。', 'smile')]
      : [V('你也偷溜出來了？哈，我就知道。', 'smile'), V('這間教室晚上比白天有趣多了。'), V('要不要試試黑板上的咒語？我剛剛畫了十次都沒成功。', 'smile')]);
  }
  else if (focus.kind === 'board') say([{ text: room.state.revealed ? '黑板下方浮出了血紅色的字：「午夜之前離開」。角落還寫著「十三」。' : '黑板上寫著三種咒語的畫法。最下面一行：「隱藏的字，只有顯影才看得見。」' }]);
  else if (focus.kind === 'portrait') say([{ text: room.state.distorted ? '肖像畫的臉像蠟一樣融化了，嘴巴一直往下拉長。' : '米爾納學校第一任院長的肖像。不管你走到哪裡，他的眼睛都跟著你。' }]);
}

// ---------- 對話 ----------
let mode = 'start'; // start | walk | talk | wand
let lines = [], lineI = 0, typing = null;
function say(list) {
  lines = list; lineI = 0; mode = 'talk'; controls.setEnabled(false);
  $('dialog').hidden = false; showLine();
}
function showLine() {
  const L = lines[lineI];
  $('dlg-name').textContent = L.who || ''; $('dlg-name').hidden = !L.who;
  if (L.mood) elora.setMood(L.mood);
  const el = $('dlg-text'); el.textContent = '';
  clearInterval(typing); let i = 0;
  if (L.who === '艾洛拉') elora.talk(L.text.length * 0.045);
  const npc = npcs[L.who]; if (npc) { npc.talk(L.text.length * 0.045); if (L.mood) npc.setMood(L.mood); }
  typing = setInterval(() => { el.textContent = L.text.slice(0, ++i); if (i % 2) sfx.blip(); if (i >= L.text.length) { clearInterval(typing); typing = null; } }, 40);
}
function advance() {
  if (typing) { clearInterval(typing); typing = null; $('dlg-text').textContent = lines[lineI].text; elora.talk(0); return; }
  if (++lineI < lines.length) return showLine();
  $('dialog').hidden = true; mode = 'walk'; controls.setEnabled(true); elora.setMood(room.state.revealed ? 'scared' : 'calm');
  for (const c of Object.values(npcs)) c.setMood(room.state.revealed ? 'scared' : 'calm');
  lines.onDone?.();
}
$('dialog').addEventListener('click', (e) => { e.stopPropagation(); advance(); });
let talkedFirst = false;
function talkToElora() {
  const E = (text, mood = 'calm') => ({ who: '艾洛拉', text, mood });
  const s = room.state;
  if (s.distorted) return say([E('那幅畫……剛剛是不是在動？', 'scared'), E('黑板上寫著退散咒——畫一道閃電，或把魔杖往上舉。試試看。', 'scared')]);
  if (s.revealed) return say([E('門口剛剛那個……你也看到了，對吧？', 'scared'), E('「午夜之前離開」……到底是誰寫的？'), { text: '（她把左手的手套拉緊了一點。）' }, E('……沒事。我們回宿舍吧。別跟別人說我們來過這裡，好嗎？', 'smile')]);
  if (s.lit) return say([E('好溫暖……謝謝你。', 'smile'), E('教授說過，有些字要用顯影咒才看得見。那塊黑板下面，好像還有別的字。'), E('畫一個三角形，或是把魔杖往前刺。')]);
  if (!talkedFirst) { talkedFirst = true; return say([E('你也睡不著嗎？……我也是。', 'smile'), E('開學第一晚，總覺得這座學校一直在看著我們。'), E('這裡太暗了。黑板上有寫光照咒的畫法——畫一個圓，或揮一下魔杖。'), E(isTouch ? '把手機轉成直向，就能拿出魔杖。' : '按 F 拿出魔杖，用滑鼠畫。也可以點右上角，用手機掃 QR code 當魔杖。')]); }
  return say([E('光照咒：畫一個圓，或揮一下魔杖。'), E(isTouch ? '把手機轉成直向就能施咒。' : '按 F 拿出魔杖。')]);
}

// ---------- 施咒 ----------
let toastT = 0;
function toast(text, color = '#e8e2d0') { const t = $('toast'); t.textContent = text; t.style.color = color; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
function castSpell(id, via) {
  const sp = SPELLS[id];
  if (!sp) { sfx.chime('fail'); toast('符文沒有成形……再畫一次', '#a89c8a'); return { ok: false, text: '沒有成形' }; }
  sfx.chime(id); wandFlash = 1; wandLight.color.set(sp.color);
  navigator.vibrate?.(id === 'revela' ? [40, 40, 120] : 60);
  let text = '';
  if (id === 'lumen') text = room.lumen() ? '燭火一盞一盞亮了起來' : '燭火已經亮著了';
  if (id === 'revela') {
    if (room.reveal()) {
      text = '黑板上浮出血紅色的字……';
      elora.setMood('scared');
      setTimeout(() => { room.scare(1.4, camera.position, camera.getWorldDirection(new THREE.Vector3())); sfx.scare(); navigator.vibrate?.([200, 60, 300]); $('flash').classList.add('on'); setTimeout(() => $('flash').classList.remove('on'), 120); }, 1600);
    } else text = '沒有其他隱藏的東西了';
  }
  if (id === 'expel') text = room.expel(camera.position) === 'portrait' ? '肖像畫的臉恢復原狀了' : '一陣風把漂浮的書吹開';
  toast(`${sp.name}　${sp.en}｜${text}`, sp.color);
  $('last-via').textContent = { mouse: '滑鼠畫符文', finger: '手指畫符文', gesture: '揮動手機', remote: '魔杖手機' }[via] || '';
  return { ok: true, text, spell: id };
}

// 魔杖畫面（電腦：滑鼠畫；手機：轉直向後手指畫或揮動）
const rune = attachRuneCanvas($('rune'), (pts) => {
  const r = recognize(pts);
  castSpell(r?.id, isTouch ? 'finger' : 'mouse');
});
let stopGestures = null;
async function openWand() {
  if (mode !== 'walk') return;
  mode = 'wand'; controls.setEnabled(false); $('wand').hidden = false; $('hud').classList.add('dim');
  if (isTouch) {
    wandReached = current() === 'portrait';
    requireOrientation('portrait', { text: '請把手機轉成直向，拿出魔杖', onCancel: closeWand });
    const p = await requestMotionPermission();
    $('wand-motion').textContent = p === 'granted' ? '可以畫符文，也可以直接揮動手機' : '沒有取得動作感測器，請用手指畫符文';
    if (p === 'granted') stopGestures = watchGestures((id) => castSpell(id, 'gesture'));
  } else $('wand-motion').textContent = '用滑鼠在畫面上畫符文（按 Esc 收起）';
}
function closeWand() {
  if (mode !== 'wand') return;
  stopGestures?.(); stopGestures = null;
  $('wand').hidden = true; $('hud').classList.remove('dim'); mode = 'walk'; controls.setEnabled(true);
  if (isTouch) requireOrientation('landscape', { text: '請把手機轉回橫向', onCancel: null });
}
$('btn-wand').addEventListener('click', (e) => { e.stopPropagation(); openWand(); });
$('wand-close').addEventListener('click', (e) => { e.stopPropagation(); closeWand(); });
$('rotate-wand').addEventListener('click', () => openWand());

// 手機轉成直向：走路中就提示（也可以直接拿出魔杖）；魔杖模式中轉回橫向就收起魔杖
let wandReached = false;
onOrientation((o) => {
  if (!isTouch) return;
  if (mode !== 'wand') wandReached = false;
  else if (o === 'portrait') wandReached = true;
  else if (wandReached) closeWand(); // 已經拿出魔杖、又轉回橫向 → 收起魔杖
  $('rotate-wand').hidden = !(mode === 'walk' && o === 'portrait');
});

// ---------- 掃 QR code：手機當魔杖 ----------
let link = null;
$('btn-qr').addEventListener('click', (e) => {
  e.stopPropagation();
  if (document.pointerLockElement) document.exitPointerLock();
  $('qr').hidden = false;
  if (link) return;
  const code = makeCode();
  const url = new URL(`wand.html?r=${code}`, location.href).href;
  const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
  $('qr-img').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  $('qr-code').textContent = code; $('qr-url').textContent = url; $('qr-url').href = url;
  const st = $('qr-status');
  link = joinWandLink(code, 'host', {
    onStatus: (s) => { if (s === 'connecting') st.textContent = '正在建立頻道……'; if (s === 'ready') st.textContent = '等待手機掃描……'; if (s === 'error') st.textContent = '連不上伺服器（請檢查網路）'; },
    onMessage: (m) => {
      if (m.type === 'hello' && m.role === 'wand') { st.textContent = '✔ 魔杖手機已連上'; $('btn-qr').classList.add('linked'); $('btn-qr').textContent = '🪄 魔杖手機已連上'; link.send({ type: 'hello', role: 'host' }); setTimeout(() => ($('qr').hidden = true), 900); }
      if (m.type === 'cast') { const r = castSpell(m.spell, 'remote'); link.send({ type: 'result', ...r }); }
    },
  });
});
$('qr-close').addEventListener('click', (e) => { e.stopPropagation(); $('qr').hidden = true; });

// ---------- 鍵盤、點擊 ----------
addEventListener('keydown', (e) => {
  if (mode === 'talk' && ['KeyE', 'Space', 'Enter'].includes(e.code)) { e.preventDefault(); advance(); }
  else if (mode === 'walk' && e.code === 'KeyE') interact();
  else if (mode === 'walk' && e.code === 'KeyF') openWand();
  else if (mode === 'wand' && e.code === 'Escape') closeWand();
});
renderer.domElement.addEventListener('click', () => {
  if (mode === 'walk' && !isTouch) { if (document.pointerLockElement) interact(); else controls.lockPointer(); }
});
$('btn-staff').addEventListener('click', (e) => { e.stopPropagation(); staffKind = staffKind === 'moon' ? 'dragon' : 'moon'; showStaff(); });
$('btn-style').addEventListener('click', (e) => { e.stopPropagation(); useModel = !useModel; applyStyle(); });
$('btn-act').addEventListener('click', (e) => { e.stopPropagation(); interact(); });

// ---------- 開始 ----------
initOrientation($('rotate'));
$('start-btn').addEventListener('click', async () => {
  sfx.initAudio();
  $('start').hidden = true; $('hud').hidden = false; mode = 'walk';
  if (isTouch) { await enterFullscreen(); requireOrientation('landscape'); $('rotate-wand').hidden = current() !== 'portrait'; }
  else controls.lockPointer();
});

// ---------- 主迴圈 ----------
const clock = new THREE.Clock();
let fpsT = performance.now(), fpsN = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  controls.update(dt);
  room.update(t, dt, camera.position);
  elora.update(t, dt, camera.position);
  for (const c of Object.values(npcs)) if (c.root.visible) c.update(t, dt, camera.position);
  warden?.update(t);
  // 魔杖光
  wandFlash = Math.max(0, wandFlash - dt * 1.2);
  wandLight.intensity = wandFlash * 6;
  wandLight.position.copy(camera.position).add(new THREE.Vector3(0.3, -0.3, -0.6).applyEuler(camera.rotation));
  // 法杖：走路時跟著晃，施咒時往上舉、發出咒語的顏色
  staff.position.y = -0.5 + Math.sin(controls.state.bob) * 0.012 + wandFlash * 0.12;
  staff.rotation.x = 0.35 - wandFlash * 0.35;
  for (const m of staffGlow) { m.emissive.copy(wandLight.color); m.emissiveIntensity = 0.06 + wandFlash * 2.5; }
  staff.visible = mode !== 'start';
  if (mode === 'walk') {
    const f = pickFocus();
    if (f !== focus) { focus = f; $('prompt').textContent = f ? (isTouch ? f.label : `[E] ${f.label}`) : ''; $('btn-act').hidden = !f || !isTouch; $('cross').classList.toggle('on', !!f); }
  }
  renderer.render(scene, camera);
  fpsN++; const now = performance.now(); // 用真實時間算，不用被夾住的 dt
  if (now - fpsT > 1000) { $('fps').textContent = `${Math.round((fpsN * 1000) / (now - fpsT))} fps`; fpsT = now; fpsN = 0; }
}
frame();
window.__proto = { room, elora, controls, castSpell, camera, openWand, closeWand, get mode() { return mode; } }; // 測試用
