// 鬧鬼的小事件（帳號二，2026-10-22）：第四幕以外，每隔一兩分鐘隨機發生一件（只有自己看得到、聽得到，不影響遊戲進行）：
//   遠處的敲門聲、燈忽明忽暗、門重重關上、後面有人走路、耳語、小孩的笑聲；
//   還有「黑影」：在你沒在看的地方站著一個高高的黑影，你轉頭看到它一下子就不見了。
// world.frame 每一格呼叫 tickHaunt；world.haunting＝false 時不發生（第四幕、尾聲）。
import * as THREE from 'three';
import { sfx, sfxPan } from './sfx.mjs';
import { placeProp } from './models.mjs';

const H = { next: 45 + Math.random() * 45, figure: null, shade: null, flicker: null, force: null };
const rnd = (a, b) => a + Math.random() * (b - a);

// 製作人給的「戴兜帽的恐怖女人」：走廊很暗會看不到她，讓她自己微微發出慘白的光（材質複製一份，不影響別的地方）。也用在 P30（world/northhall.mjs）
export function ghostWoman(parent, name = 'horror_woman') {
  const woman = placeProp(parent, name, 0, 0, 0, 0, [2.2, 1.85, 1]); // 依身高縮放（張開雙臂的模型不會被縮矮）
  if (woman) woman.obj.traverse((o) => { if (!o.isMesh) return; const ms = [o.material].flat().map((m) => { const c = m.clone(); if (c.emissive) { c.emissive.set('#9aa4b0'); if (c.map) c.emissiveMap = c.map; c.emissiveIntensity = 0.55; } c.fog = false; return c; }); o.material = Array.isArray(o.material) ? ms : ms[0]; });
  return woman;
}

function makeShade(scene, name) {
  const g = new THREE.Group(), black = new THREE.MeshBasicMaterial({ color: '#020203' }); g.name = 'haunt-shade';
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.42, 1.95, 10, 1, true), black); body.position.y = 0.98;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8), black); head.position.set(0, 2.08, 0.03); head.scale.set(1, 1.25, 1);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffb08a', fog: false });
  const eyes = [-0.065, 0.065].map((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), eyeMat); e.position.set(x, 2.12, 0.19); return e; });
  // 製作人給的嚇人人物（戴兜帽的女人、長髮鬼女人、無臉男）：有的話就用（比黑影嚇人很多），沒有才用黑影
  if (!ghostWoman(g, name)) { if (name !== 'horror_woman') return null; g.add(body, head, ...eyes); }
  g.position.set(0, -100, 0); // 先放在地底下讓畫面先編譯好材質，出現時才不會卡一下
  scene.add(g); return g;
}
const FIGURES = ['horror_woman', 'ghost_woman', 'faceless'];

// 在同一個房間裡、玩家現在沒在看的地方，找一個離玩家 6～12 公尺的點
function spotFor(room, cam) {
  const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  const p = cam.position;
  // 先找視線外（旁邊或後面，轉頭才會看到）；窄的走廊找不到，就站在前面遠遠的盡頭（一看到就消失）
  for (const any of [false, true]) for (let i = 0; i < 32; i++) {
    const a = rnd(0, Math.PI * 2), d = rnd(any ? 5 : 6, 12), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    if (x < room.x[0] + 0.8 || x > room.x[1] - 0.8 || z < room.z[0] + 0.8 || z > room.z[1] - 0.8) continue;
    const dot = (Math.cos(a) * fwd.x + Math.sin(a) * fwd.z);
    if (!any && dot > 0.2) continue;
    return new THREE.Vector3(x, 0, z);
  }
  return null;
}

const EVENTS = [
  ['knock', 3], ['flicker', 2], ['shade', 3], ['whisper', 1.5], ['steps', 1.5], ['slam', 1], ['giggle', 1],
];
function pick() { let s = Math.random() * EVENTS.reduce((a, e) => a + e[1], 0); for (const [k, w] of EVENTS) if ((s -= w) < 0) return k; return 'knock'; }

/** 每一格：dt、現在的房間（{x:[..], z:[..]}）、相機、場景、房間的燈、現在忙不忙（看謎題、對話中就不嚇） */
export function tickHaunt(dt, { room, camera, scene, roomLight, busy, on }) {
  if (!H.shades && scene) { H.shades = FIGURES.map((n) => makeShade(scene, n)).filter(Boolean); H.shade = H.shades[0]; } // 每次出現的人輪流挑
  // 燈忽明忽暗（1.5 秒）
  if (H.flicker) {
    const f = H.flicker; f.t += dt;
    if (roomLight.intensity !== f.last) H.flicker = null; // 中途被別的事改了燈（熄燈）：不管它
    else if (f.t > 1.5) { roomLight.intensity = f.base; H.flicker = null; }
    else { f.last = roomLight.intensity = f.base * (Math.random() < 0.35 ? rnd(0.08, 0.3) : rnd(0.7, 1)); }
  }
  // 黑影：被看到 0.5 秒就不見；最多站 10 秒
  if (H.figure) {
    const f = H.figure; f.t += dt;
    const to = f.pos.clone().sub(camera.position); to.y = 0; const dist = to.length(); to.normalize();
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    H.shade.lookAt(camera.position.x, 0, camera.position.z);
    if (!f.seen && to.dot(fwd) > 0.82) { f.seen = f.t; }
    if ((f.seen && f.t - f.seen > 0.5) || dist < 3.5 || f.t > 10 || !on) {
      H.shade.position.y = -100; H.figure = null;
      if (f.seen) { sfx('whisper'); if (roomLight.intensity > 0) H.flicker = { t: 0.9, base: roomLight.intensity, last: roomLight.intensity }; }
    }
  }
  if (!on || busy || !room) return;
  H.next -= dt; if (H.next > 0) return;
  H.next = rnd(60, 150);
  const side = Math.random() < 0.5 ? -1 : 1;
  const kind = H.force ?? pick(); H.force = null;
  switch (kind) {
    case 'knock': for (let i = 0; i < 3; i++) setTimeout(() => sfxPan('knock', side * 0.8, { vol: 0.5, arg: true }), i * 520 + (i === 2 ? 300 : 0)); break;
    case 'flicker': if (roomLight.intensity > 0) { H.flicker = { t: 0, base: roomLight.intensity, last: roomLight.intensity }; sfx('hum'); } break;
    case 'shade': { const p = spotFor(room, camera); if (!p) { H.next = 5; break; } H.shade.position.y = -100; H.shade = H.shades[Math.floor(Math.random() * H.shades.length)]; H.shade.position.copy(p); H.figure = { pos: p, t: 0, seen: 0 }; break; }
    case 'whisper': sfxPan('whisper', side, { vol: 0.8 }); break;
    case 'steps': sfxPan('steps', side * 0.3, { vol: 1 }); break;
    case 'slam': sfxPan('slam', side * 0.6, { vol: 0.5 }); break;
    case 'giggle': sfxPan('giggle', side * 0.9, { vol: 0.8 }); break;
  }
}
/** 開發者測試：馬上發生一件（不給名稱就隨機） */
export function hauntNow(kind) { H.next = 0; H.force = kind ?? null; }
