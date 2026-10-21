// 角色一覽：所有已經做好的角色站成一排，按上一位／下一位（或上面的名字）切換。
import * as THREE from 'three';
import { loadCC } from './cc.mjs';
import { loadCyril } from './cyril.mjs';
import { loadWarden } from './warden.mjs';
import { loadMan, loadHoodedWoman } from './extras.mjs';
import { loadHairSet } from './hairbank.mjs';

const $ = (id) => document.getElementById(id);
const HOUSES = {
  eldrin: { main: '#cdd3df', trim: '#7fa7d6' }, grimoire: { main: '#2a0c10', trim: '#d8c49a' },
  belmont: { main: '#121214', trim: '#b8902e' }, ouroboros: { main: '#0f2a1e', trim: '#c0c4c8' },
};
// 名單：名字、英文、說明、怎麼載入
const CAST = [
  { name: '艾洛拉', en: 'Elora・艾爾德林', desc: '主角。開朗溫柔的大姊姊，一直戴著手套。模型附的眼鏡沒有戴。', load: (s) => loadCC(s, { body: 'elora', house: HOUSES.eldrin, hair: '#9a7444', hairTip: '#dcc08a', skin: '#f2d2bd', height: 0.9, cloakScale: 0.9 }) },
  { name: '月晞', en: 'Yuexi・格里莫瓦', desc: '主角。東方交換生，安靜、觀察力強。', load: (s) => loadCC(s, { body: 'female', house: HOUSES.grimoire, hair: '#0d0a0a', hairTip: '#2a2226', skin: '#efcdb4', cloakScale: 0.92 }) },
  { name: '沃恩', en: 'Vaughn・貝爾蒙特', desc: '主角。熱血衝動的獵人世家子弟。', load: (s) => loadCC(s, { body: 'male', house: HOUSES.belmont, hair: '#1e1510', hairTip: '#4a3426', skin: '#e8bfa2' }) },
  { name: '西里爾', en: 'Cyril・烏洛波斯', desc: '主角。嘴毒的銜尾會之子。模型沒有骨架和表情，不會眨眼、說話。', load: (s) => loadCyril(s) },
  { name: '守夜人 葛雷', en: 'Greer the Night Warden', desc: '第一章的追逐者。駝背、提著綠色的燈。原檔貼圖沒有附上，全部用程式上色。', load: (s) => loadWarden(s) },
  { name: '校長 奧德里克', en: 'Headmaster Aldric Milner', desc: '白髮白鬍子、紫金色長袍。用「72」男生模型改的，沒有骨架。', load: (s) => loadMan(s, { hair: '#e4e0d8', beard: '#ece8e0', skin: '#e8c4aa', robe: { main: '#2e1a3a', trim: '#c8a24a' }, height: 1.8 }) },
  { name: '副校長 塞巴斯汀', en: 'Vice-Principal Sebastian Moray', desc: '西里爾的父親，用西里爾的模型改的：更高、深色頭髮夾著灰白、黑銀長袍。', load: (s) => loadCyril(s, { house: { main: '#0c0c10', trim: '#9aa0a8' }, hair: '#22201e', hairTip: '#8a857c', iris: '#5a6a62', skin: '#e8c8b2', height: 1.88 }) },
  { name: '舍監 赫爾嘉夫人', en: 'Madam Helga', desc: '月晞的臉，換上艾洛拉模型的短捲髮（灰白色）和眼鏡，看不出是同一個人。', load: async (s) => loadCC(s, { body: 'female', house: { main: '#3a3a40', trim: '#e8e4dc' }, hair: '#6a655c', hairTip: '#c8c2b8', skin: '#e8c8b4', cloakScale: 0.98, height: 1.02, hideHair: true,
    headGear: await loadHairSet([{ from: 'elora', parts: ['Scalp'], hair: '#6a655c', hairTip: '#c8c2b8' }, { from: 'elora', parts: ['glasses'] }]) }) },
  { name: '魔藥學教授 薇拉', en: 'Professor Vera Knox', desc: '艾洛拉的臉，換上月晞模型的長髮和空氣瀏海（深紅棕色），看不出是同一個人。', load: async (s) => loadCC(s, { body: 'elora', house: { main: '#1a2a20', trim: '#7a6a3a' }, hair: '#3a1610', hairTip: '#6a2a1a', skin: '#ecc8b0', height: 0.93, cloakScale: 0.92, hideHair: true,
    headGear: await loadHairSet([{ from: 'female', parts: ['Double_high', 'Air_bangs'], hair: '#3a1610', hairTip: '#6a2a1a' }]) }) },
  { name: '男學生', en: 'Student（艾爾德林）', desc: '背景學生。跟校長同一張臉，換上沃恩模型的油頭，再加學院長袍。', load: async (s) => loadMan(s, { hair: '#6a4a2a', robe: HOUSES.eldrin, height: 1.74, gear: await loadHairSet([{ from: 'male', parts: ['Slicked_Back'], hair: '#6a4a2a', hairTip: '#a07a50' }]) }) },
  { name: '男學生（兜帽）', en: 'Student（貝爾蒙特）', desc: '背景學生，戴兜帽。', load: (s) => loadMan(s, { hair: '#1a1410', robe: HOUSES.belmont, hood: true, height: 1.78 }) },
  { name: '女學生（兜帽）', en: 'Student（格里莫瓦）', desc: '背景學生。女性人體雛形沒有五官，所以一定戴兜帽，臉藏在陰影裡。', load: (s) => loadHoodedWoman(s, { robe: HOUSES.grimoire }) },
  { name: '女學生（兜帽）', en: 'Student（烏洛波斯）', desc: '背景學生，同上。', load: (s) => loadHoodedWoman(s, { robe: HOUSES.ouroboros, height: 1.62 }) },
];

const renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#0a0b10'); scene.fog = new THREE.Fog('#0a0b10', 6, 18);
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
scene.add(new THREE.HemisphereLight('#6a7aa0', '#2a1a10', 0.7));
const key = new THREE.SpotLight('#ffc890', 60, 12, 0.5, 0.6, 1.4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key, key.target);
const rim = new THREE.DirectionalLight('#8fb0ff', 1.4); rim.position.set(-3, 4, -5); scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), new THREE.MeshStandardMaterial({ color: '#17120e', roughness: 0.85 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const GAP = 1.4, slots = CAST.map((c, i) => ({ ...c, x: i * GAP, obj: null }));
let cur = 0, camX = 0, close = false, camD = 4, camY = 1.4, lookY = 1.1;
slots.forEach((c, i) => {
  const b = document.createElement('button'); b.textContent = c.name.replace(/^.* /, ''); b.onclick = () => go(i); $('chips').append(b); c.chip = b;
  c.load(scene).then((o) => { o.root.position.set(c.x, 0, 0); o.setRest?.(0); c.obj = o; if (i === cur) $('loading').hidden = true; })
    .catch((e) => { console.warn(c.name, e); c.failed = true; });
});
function go(i, instant = false) {
  cur = (i + slots.length) % slots.length; const c = slots[cur];
  if (instant) { camX = c.x; camD = close ? 0.95 : 4.6; camY = close ? 1.58 : 1.55; lookY = close ? 1.52 : 0.95; }
  $('name').textContent = c.name; $('en').textContent = c.en; $('desc').textContent = c.desc;
  slots.forEach((s, k) => s.chip.classList.toggle('on', k === cur));
  $('loading').hidden = !!c.obj || c.failed; $('loading').textContent = c.failed ? '這個模型載入失敗' : '模型載入中……';
}
$('prev').onclick = () => go(cur - 1); $('next').onclick = () => go(cur + 1);
$('zoom').onclick = () => { close = !close; $('zoom').textContent = close ? '看全身' : '近看臉'; };
addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') go(cur - 1); if (e.key === 'ArrowRight') go(cur + 1); });
let sx = null; addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }); addEventListener('touchend', (e) => { if (sx == null) return; const d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 50) go(cur + (d < 0 ? 1 : -1)); sx = null; });
go(0);

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  const target = slots[cur].x; camX += (target - camX) * Math.min(1, dt * 4);
  // 全身：鏡頭在胸口高度往下看一點；近看：對準臉（大約 1.55 公尺高）
  const portrait = innerWidth < innerHeight, k = Math.min(1, dt * 3);
  camD += ((close ? (portrait ? 1.3 : 0.95) : (portrait ? 6.0 : 4.6)) - camD) * k;
  camY += ((close ? 1.58 : 1.55) - camY) * k; lookY += ((close ? 1.52 : 0.95) - lookY) * k;
  camera.position.set(camX + Math.sin(t * 0.2) * (close ? 0.05 : 0.25), camY, camD); camera.lookAt(camX, lookY, 0);
  key.position.set(camX + 1.6, 3.6, 2.6); key.target.position.set(camX, 1, 0);
  for (const s of slots) if (s.obj && Math.abs(s.x - camX) < 4) s.obj.update(t, dt, camera.position);
  if (slots[cur].obj && !$('loading').hidden) $('loading').hidden = true;
  renderer.render(scene, camera);
});
window.__cast = { slots, go };
