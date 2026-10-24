// 場景美術（帳號二）：序幕（碼頭、大廳、典禮廳）與第一幕（星盤廳、四間交誼廳）。
// 透過 game/src/world/art-hooks.mjs 的掛鉤，在灰盒的同一個位置換上材質與擺設；位置、大小、碰撞都照場景配置，不改玩法。
// 貼圖都是程式畫的（textures.mjs）。為了手機：不加燈（蠟燭、火爐用會發光的材質）、同一組擺設的同種材質合成一個物件。
import * as THREE from 'three';
import { mergeGeometries } from '../../../prototype/vendor/addons/utils/BufferGeometryUtils.js';
import { decorators } from '../world/art-hooks.mjs';
import { DOORS } from '../data/world-ch1.mjs';
import * as T from './textures.mjs';
import * as P from './props.mjs';
import { dressRoom, dressRoof, dressDock, chandelierFlames } from './dress.mjs';
import { placeProp } from './models.mjs';

// ---------- 材質 ----------
const M = {};
export const std = (key, opt) => (M[key] ||= new THREE.MeshStandardMaterial({ name: key, roughness: 0.85, ...opt }));
export const glow = (key, color, k = 1) => (M[key] ||= new THREE.MeshBasicMaterial({ name: key, color: new THREE.Color(color).multiplyScalar(k), fog: false }));
export const MAT = {
  wood: () => std('wood', { map: T.tile(T.planks('#4a2e1a'), 0.5, 0.5), roughness: 0.7 }),
  darkWood: () => std('darkWood', { map: T.tile(T.planks('#2a1a10'), 0.5, 0.5), roughness: 0.65 }),
  brass: () => std('brass', { map: T.metal('#b08a3a'), metalness: 0.85, roughness: 0.35 }),
  iron: () => std('iron', { map: T.metal('#3a3a3e'), metalness: 0.7, roughness: 0.5 }),
  stone: () => std('stoneDeco', { map: T.tile(T.stoneWall('#7a746a'), 0.5, 0.5) }),
  pale: () => std('pale', { color: '#d8d2c4', roughness: 0.6 }),
  wax: () => std('wax', { color: '#e8e0c8', roughness: 0.5 }),
  flame: () => glow('flame', '#ffb24a', 1.6),
  ember: () => glow('ember', '#ff6a1a', 1.2),
  glass: () => std('glass', { map: T.nightSky(), emissive: '#1a2240', emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.3 }),
  mirror: () => std('mirror', { color: '#1a1e24', metalness: 1, roughness: 0.08 }),
  parchment: () => std('parchment', { map: T.parchment(), roughness: 0.9 }),
  water: () => std('water', { map: T.tile(T.water(), 40, 40), metalness: 0.6, roughness: 0.22 }),
  cloth: (c) => std('cloth' + c, { color: c, roughness: 0.95 }),
  velvet: (c) => std('velvet' + c, { color: c, roughness: 0.9, side: THREE.DoubleSide }),
};

P.setMaterials({ MAT, std, glow });
// 謎題的場景反應（react.mjs）會自己蓋會動的版本：這些東西這裡只藏起灰盒，不蓋靜態的
export const REPLACE = new Set(['P03:lock_eldrin', 'P05:scale', 'P06:hourglass', 'P08:disk', 'P20:statues', 'P21:scale', 'P25:well', 'P26:ironDoor', 'P27:gearwall']);

// ---------- 組裝工具：同材質的形狀先收集起來，最後合成一個物件 ----------
class Kit {
  constructor() { this.parts = new Map(); }
  add(geo, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return this;
  }
  box(w, h, d, mat, x, y, z, ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry); }
  cyl(rt, rb, h, mat, x, y, z, seg = 10) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z); }
  build(parent, { shadow = false } = {}) {
    const g = new THREE.Group();
    for (const [mat, geos] of this.parts) {
      const m = new THREE.Mesh(mergeGeometries(geos), mat);
      m.castShadow = shadow; m.receiveShadow = true; g.add(m);
    }
    parent.add(g);
    return g;
  }
}

// 蠟燭：很多根時用 InstancedMesh（一次畫完）
function candles(parent, spots, { h = 0.18, r = 0.025 } = {}) {
  if (!spots.length) return;
  const wax = new THREE.InstancedMesh(new THREE.CylinderGeometry(r, r, h, 6), MAT.wax(), spots.length);
  const fl = new THREE.InstancedMesh(new THREE.ConeGeometry(r * 0.8, r * 3, 6), MAT.flame(), spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, y, z], i) => { wax.setMatrixAt(i, m.makeTranslation(x, y + h / 2, z)); fl.setMatrixAt(i, m.makeTranslation(x, y + h + r * 1.5, z)); });
  parent.add(wax, fl);
}

// ---------- 每個房間的樣子 ----------
const HOUSE = {
  eldrin: { wall: '#24345a', accent: '#c8d4ea', rug: ['#2a3a6a', '#c8d4ea'], banner: '#9fc4ff' },
  grimoire: { wall: '#4a161c', accent: '#d8c49a', rug: ['#5a1a1e', '#d8c49a'], banner: '#c0454f' },
  belmont: { wall: '#3a2c14', accent: '#d1a640', rug: ['#3a2410', '#d1a640'], banner: '#d1a640' },
  ouroboros: { wall: '#143424', accent: '#c0c4c8', rug: ['#123322', '#c0c4c8'], banner: '#4fa37a' },
};
// wainscot：下半截木護牆板高度（0＝沒有）；upper：上半截的貼圖
const STYLE = {
  hall: { wall: () => T.stoneWall('#6e675e'), wainscot: 0 },
  banquet: { wall: () => T.stoneWall('#5e574e'), wainscot: 1.4 },
  starhall: { wall: () => T.plaster('#1c2238'), wainscot: 1.0 },
  dorm_eldrin: { house: 'eldrin', wainscot: 1.1 },
  dorm_grimoire: { house: 'grimoire', wainscot: 1.1 },
  dorm_belmont: { house: 'belmont', wainscot: 1.1 },
  dorm_ouroboros: { house: 'ouroboros', wall: () => T.stoneWall('#3e4a40'), wainscot: 0.9 },
  // 第二幕：長廊只換牆、地、天花板，不放會動、會數的東西（蠟燭、畫像、盔甲都是找異常用的，由帳號一的 corridor.mjs 管）
  north_hall: { wall: () => T.stoneWall('#4a4640'), wainscot: 0 },
  corridor: { paper: ['#2a1214', '#5a4020'], wainscot: 1.2 },
  founder: { paper: ['#1e1a12', '#6a5022'], wainscot: 1.6 },
  north_stairs: { wall: () => T.stoneWall('#3e3a36'), wainscot: 0 },
  // 第三幕：沉眠圖書館（書架迷宮、血跡等由帳號一的 library.mjs 畫，這裡只換牆面）
  lib_entry: { wall: () => T.stoneWall('#5a544a'), wainscot: 1.8 },
  lib_maze: { paper: ['#1e1a14', '#4a3a20'], wainscot: 2.2 },
  lib_reading: { paper: ['#22180e', '#6a5022'], wainscot: 1.4 },
  lib_ante: { wall: () => T.stoneWall('#3a3e4a'), wainscot: 0 },
  lib_well: { wall: () => T.stoneWall('#34383e'), wainscot: 0 },
  // 第四幕：通道、機械室、蝕巢（石牆，越往裡越暗、越髒）
  a4_pass: { wall: () => T.stoneWall('#3a3832'), wainscot: 0 },
  a4_gears: { wall: () => T.stoneWall('#4a443a'), wainscot: 0 },
  a4_nest: { wall: () => T.stoneWall('#2a1416'), wainscot: 0 },
};

// 牆面內側的貼面（每個房間自己那一面，避開門）
function cladding(group, r, st) {
  const inset = 0.17, h = r.h;
  const upperTex = st.wall ? st.wall() : st.paper ? T.wallpaper(...st.paper) : T.wallpaper(HOUSE[st.house].wall, HOUSE[st.house].accent);
  const repeatScale = st.wall ? 2 : 1; // 石牆一張＝2 公尺，壁紙一張＝1 公尺
  const sides = [
    { axis: 'x', at: r.z[0], from: r.x[0], to: r.x[1], n: 1 }, { axis: 'x', at: r.z[1], from: r.x[0], to: r.x[1], n: -1 },
    { axis: 'z', at: r.x[0], from: r.z[0], to: r.z[1], n: 1 }, { axis: 'z', at: r.x[1], from: r.z[0], to: r.z[1], n: -1 },
  ];
  const kitW = new Kit(), kitL = new Kit();
  const upMat = std('upper_' + r.id, { map: T.tile(upperTex, 1, 1) }); // 每間的重複次數由 UV 決定（下面直接改 UV）
  const loMat = MAT.darkWood(); const loPanel = std('wainscot', { map: T.panelling('#3a2616') });
  for (const s of sides) {
    const gaps = DOORS.filter((d) => d.axis === s.axis && Math.abs((s.axis === 'x' ? d.z : d.x) - s.at) < 0.01).map((d) => { const c = s.axis === 'x' ? d.x : d.z; return [c - d.w / 2 - 0.25, c + d.w / 2 + 0.25]; }).sort((a, b) => a[0] - b[0]);
    let cur = s.from + inset; const spans = [];
    for (const [g0, g1] of gaps) { if (g0 > cur) spans.push([cur, g0]); cur = Math.max(cur, g1); }
    if (cur < s.to - inset) spans.push([cur, s.to - inset]);
    for (const [a, b] of spans) {
      const len = b - a, mid = (a + b) / 2, off = s.at + s.n * inset;
      const place = (geo, mat, y) => { if (s.axis === 'x') kitW.add(geo, mat, mid, y, off, s.n > 0 ? 0 : Math.PI); else kitW.add(geo, mat, off, y, mid, s.n > 0 ? Math.PI / 2 : -Math.PI / 2); };
      const wsc = st.wainscot;
      // 上半截：一片平面，UV 照實際大小
      const up = new THREE.PlaneGeometry(len, h - wsc); const uv = up.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / repeatScale, (uv.getY(i) * (h - wsc)) / repeatScale);
      place(up, upMat, wsc + (h - wsc) / 2);
      if (wsc > 0) {
        const lo = new THREE.PlaneGeometry(len, wsc); const u2 = lo.attributes.uv;
        for (let i = 0; i < u2.count; i++) u2.setXY(i, (u2.getX(i) * len) / 2, u2.getY(i));
        place(lo, loPanel, wsc / 2);
        // 護牆板上緣的橫條、地上的踢腳板
        const rail = new THREE.BoxGeometry(len, 0.07, 0.05); place(rail, loMat, wsc);
        const skirt = new THREE.BoxGeometry(len, 0.14, 0.04); place(skirt, loMat, 0.07);
      }
      // 天花板下的線板
      place(new THREE.BoxGeometry(len, 0.18, 0.12), st.wall ? MAT.stone() : loMat, h - 0.09);
    }
  }
  kitW.build(group);
}

// ---------- 亮度（製作人：太暗）----------
// 1. 整個場景加一層柔和的環境光（半球光：上面偏冷、下面偏暖），不會投影，手機也不吃力。
// 2. 房間燈調亮、照得遠一點（光變暗得慢一點）。
// 熄燈的劇情（world.setDark：房間燈關掉）時，環境光也跟著關，暗的地方還是暗。
const BRIGHT = { ambient: 2.3, room: 2.6, decay: 1.0 }; // 2026-10-22 製作人：還是有點暗，再調亮（原本 1.6、2.2、1.1）
function brighten(group) {
  const roomLight = group.children.find((o) => o.isPointLight); if (!roomLight) return;
  roomLight.intensity *= BRIGHT.room; roomLight.decay = BRIGHT.decay;
  const on = roomLight.intensity;
  const hemi = new THREE.HemisphereLight('#9aa0b8', '#4a3a2c', BRIGHT.ambient); group.add(hemi);
  const oldHemi = group.parent?.children.find((o) => o.isHemisphereLight); if (oldHemi) oldHemi.parent.remove(oldHemi); // 灰盒原本的環境光（很暗）拿掉，少一盞燈
  // 每一格看房間燈有沒有被關掉（不加新的燈、不切換 visible，只改強度，畫面不會重新編譯而卡一下）
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  const tick = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })); tick.frustumCulled = false;
  const lit = [new THREE.Color('#9aa0b8'), new THREE.Color('#4a3a2c')], dim = [new THREE.Color('#334'), new THREE.Color('#110d0a')]; // 熄燈時換回灰盒原本那盞很暗的環境光
  tick.onBeforeRender = () => { const on2 = roomLight.intensity > on * 0.05, c = on2 ? lit : dim; hemi.intensity = on2 ? BRIGHT.ambient : 0.35; hemi.color.copy(c[0]); hemi.groundColor.copy(c[1]); };
  group.add(tick);
}

// ---------- 灰盒本身的牆、地板、天花板換材質（全部蓋好之後做一次） ----------
const retextured = new WeakSet();
function retexture(group) {
  if (retextured.has(group)) return; retextured.add(group);
  brighten(group);
  const wallTex = T.stoneWall('#57524c'), stoneFloor = T.flagstone('#56514b'), woodFloor = T.planks('#4a3020'), ceil = T.plaster('#1e1a16');
  group.traverse((o) => {
    if (!o.isMesh || !o.material?.color || o.userData.thing) return;
    const hex = o.material.color.getHexString(), p = o.geometry.parameters;
    if (hex === '57524c' && p?.height) { // 牆
      const len = Math.max(p.width, p.depth);
      o.material = new THREE.MeshStandardMaterial({ map: T.tile(wallTex, len / 2, p.height / 2), roughness: 0.95 });
      // 碼頭沒有牆（露天），只留碰撞
      const x = o.position.x, z = o.position.z;
      if (z > 140.5 && z <= 170.5 && x >= -6.5 && x <= 6.5) o.visible = false;
    } else if (hex === '4a4744' && p?.width) o.material = new THREE.MeshStandardMaterial({ map: T.tile(stoneFloor, p.width / 3, p.height / 3), roughness: 0.9 });
    else if (hex === '3a2a1c' && p?.width) o.material = new THREE.MeshStandardMaterial({ map: T.tile(woodFloor, p.width / 2, p.height / 2), roughness: 0.75 });
    else if (hex === '211c18' && p?.width) o.material = new THREE.MeshStandardMaterial({ map: T.tile(ceil, p.width / 4, p.height / 4), roughness: 1 });
  });
}

// ---------- 房間的擺設 ----------
// 木桶、望遠鏡：有製作人給的模型就用模型
function barrel(k, group, x, z, y = 0) { if (!placeProp(group, 'barrel', x, y, z, x * 3 + z, [0.6, 0.85, 0.6])) P.barrel(k, x, z, y); }
function telescope(k, group, x, z, ry) { if (!placeProp(group, 'telescope', x, 0, z, ry + Math.PI / 2, [1.3, 1.5, 0.6])) P.telescope(k, x, z, ry); }
// 木箱：有製作人給的模型就用模型（open＝打開的那個）
function crate(k, group, x, z, s = 0.6, y = 0, ry = 0, open = false) { if (!placeProp(group, open ? 'crate_open' : 'crate', x, y, z, ry, [s, s, s])) P.crate(k, x, z, s, y, ry); }
function banner(kit, color, x, y, z, ry, w = 1.2, h = 3) {
  kit.box(w, h, 0.03, MAT.cloth(color), x, y, z, ry);
  kit.box(w + 0.2, 0.06, 0.06, MAT.brass(), x, y + h / 2 + 0.03, z, ry);
}
function fireplace(kit, x, z, ry) { // 背靠牆，ry＝面向
  const s = Math.sin(ry), c = Math.cos(ry), at = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  const P = (w, h, d, mat, dx, y, dz) => { const [px, pz] = at(dx, dz); kit.box(w, h, d, mat, px, y, pz, ry); };
  P(2.2, 1.4, 0.5, MAT.stone(), 0, 0.7, 0.05); // 爐身
  P(1.3, 0.9, 0.1, std('soot', { color: '#0a0806' }), 0, 0.45, 0.33); // 爐口（黑）
  P(2.5, 0.12, 0.62, MAT.stone(), 0, 1.46, 0.05); // 爐台
  P(1.6, 1.6, 0.25, MAT.stone(), 0, 2.3, 0.18); // 煙囪
  P(0.9, 0.1, 0.3, MAT.ember(), 0, 0.08, 0.42); // 炭火（爐口前面一點，看得到）
  for (let i = 0; i < 3; i++) P(0.16, 0.34 - (i % 2) * 0.1, 0.12, MAT.flame(), -0.25 + i * 0.25, 0.3, 0.4);
}
function armchair(kit, color, x, z, ry) { // 扶手椅：木腳、坐墊、高椅背（上緣圓的）、捲起來的扶手、釘扣
  const s = Math.sin(ry), c = Math.cos(ry), W = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  const P = (w, h, d, mat, dx, y, dz) => { const [px, pz] = W(dx, dz); kit.box(w, h, d, mat, px, y, pz, ry); };
  const A = (geo, mat, dx, y, dz, rx = 0, rz = 0) => { const [px, pz] = W(dx, dz); kit.add(geo, mat, px, y, pz, ry, rx, rz); };
  const cl = MAT.velvet(color), dark = std('velvetDark' + color, { color: new THREE.Color(color).multiplyScalar(0.6), roughness: 0.9 }), wd = MAT.darkWood(), b = MAT.brass();
  for (const sx of [-0.32, 0.32]) for (const sz of [-0.28, 0.28]) A(new THREE.CylinderGeometry(0.03, 0.022, 0.16, 6), wd, sx, 0.08, sz);
  P(0.78, 0.2, 0.72, dark, 0, 0.26, 0.02); // 底座
  A(new THREE.BoxGeometry(0.6, 0.12, 0.6, 2, 1, 2), cl, 0, 0.42, -0.02); // 坐墊
  P(0.74, 0.72, 0.16, cl, 0, 0.78, 0.3); A(new THREE.CylinderGeometry(0.08, 0.08, 0.74, 10), cl, 0, 1.14, 0.3, 0, Math.PI / 2); // 椅背＋上緣
  for (const sx of [-1, 1]) { P(0.12, 0.26, 0.66, cl, sx * 0.36, 0.48, 0.0); A(new THREE.CylinderGeometry(0.075, 0.075, 0.7, 10), cl, sx * 0.37, 0.62, 0.0, Math.PI / 2); } // 扶手（捲起來）
  for (let i = 0; i < 6; i++) A(new THREE.SphereGeometry(0.015, 5, 4), b, -0.25 + (i % 3) * 0.25, 0.68 + Math.floor(i / 3) * 0.24, 0.215); // 釘扣
}
function bookshelf(kit, x, z, ry, w = 1.8, h = 2.4) { // 背靠牆，正面朝 ry 的方向（dz 正的＝房間那一邊）
  const s = Math.sin(ry), c = Math.cos(ry), P = (bw, bh, bd, mat, dx, y, dz) => kit.box(bw, bh, bd, mat, x + dx * c + dz * s, y, z - dx * s + dz * c, ry);
  const D = 0.38, rows = 5, wood = MAT.darkWood();
  P(w, h, 0.03, wood, 0, h / 2, -D / 2); // 背板
  for (const sx of [-1, 1]) P(0.05, h, D, wood, sx * (w / 2 - 0.025), h / 2, 0); // 側板
  for (let r = 0; r <= rows; r++) P(w, 0.04, D, wood, 0, 0.06 + r * (h - 0.12) / rows, 0); // 層板
  const colors = ['#5a1a1a', '#1a3a2a', '#2a2a4a', '#4a3a1a', '#3a2a2a', '#6a5a3a'];
  const rnd = (a, b) => { const v = Math.sin(a * 91.7 + b * 47.3) * 43758.5; return v - Math.floor(v); };
  for (let r = 0; r < rows; r++) {
    let bx = -w / 2 + 0.07; const y = 0.08 + r * (h - 0.12) / rows, room = (h - 0.12) / rows - 0.05;
    for (let i = 0; bx < w / 2 - 0.1; i++) {
      const bw = 0.035 + rnd(r, i) * 0.045, bh = room * (0.65 + rnd(i, r) * 0.33);
      if (rnd(r * 3, i * 7) > 0.08) P(bw, bh, D * 0.75, MAT.cloth(colors[Math.floor(rnd(i, r * 5) * colors.length)]), bx + bw / 2, y + bh / 2, 0.02);
      bx += bw + 0.006;
    }
  }
}
function rugAt(group, house, cx, cz, w, d) {
  const [b, e] = HOUSE[house].rug;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std('rug' + house, { map: T.rug(b, e), roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.012, cz); m.receiveShadow = true; group.add(m);
}

const ROOM_DECOR = {
  dock(r, group) {
    const k = new Kit();
    // 月光：很淡的藍光從高處照碼頭和城堡正面（不投影），一開場看得出身在哪裡
    const moonFill = new THREE.PointLight('#8aa0d8', 70, 50, 1.0); moonFill.position.set(-8, 14, 152); group.add(moonFill);
    // 碼頭四周的黑湖
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), MAT.water()); lake.rotation.x = -Math.PI / 2; lake.position.set(0, -0.6, 150); group.add(lake);
    // 木樁、欄杆、燈籠
    for (let z = 143; z <= 169; z += 4) for (const x of [-5.85, 5.85]) {
      k.cyl(0.14, 0.16, 2.2, MAT.darkWood(), x, -0.1, z, 8);
      if ((z - 143) % 8 === 0 && !placeProp(group, 'lantern', x, 1.0, z, x > 0 ? -Math.PI / 2 : Math.PI / 2, [0.32, 0.65, 0.32])) { k.box(0.24, 0.3, 0.24, MAT.iron(), x, 1.25, z); k.box(0.16, 0.2, 0.16, MAT.flame(), x, 1.25, z); } // 碼頭燈柱上的提燈（製作人給的模型）
    }
    for (const x of [-5.85, 5.85]) k.box(0.06, 0.06, 27, MAT.darkWood(), x, 0.95, 156);
    // 城堡正門（大廳那面牆的外側）：拱門、兩邊的火把
    k.box(13, 1, 1, MAT.stone(), 0, 11.5, 140.6);
    for (const x of [-3.2, 3.2]) { k.box(0.8, 11, 0.9, MAT.stone(), x, 5.5, 140.6); k.box(0.14, 0.5, 0.14, MAT.iron(), x, 2.4, 141.2); k.box(0.16, 0.3, 0.16, MAT.flame(), x, 2.8, 141.2); }
    k.box(5.6, 0.7, 0.9, MAT.stone(), 0, 3.0, 140.6);
    k.build(group);
    const gate = new THREE.PointLight('#ff9a50', 14, 16, 1.4); gate.position.set(0, 2.6, 142); group.add(gate); // 城門的火光：讓玩家一眼看到要往哪走（不投影）
    // 遠方的城堡：大廳後面往北一片黑色的塔，最高的是鐘塔；窗戶有一點光
    const far = new Kit(), dark = std('castle', { color: '#0d0e14', roughness: 1 }), win = glow('farWin', '#ffcf8a', 0.7);
    const towers = [[-18, 105, 6, 34], [18, 108, 7, 30], [-30, 120, 5, 24], [30, 118, 5, 26], [0, 92, 5, 52], [-9, 98, 9, 26], [10, 96, 9, 28]];
    for (const [x, z, w, h] of towers) {
      far.box(w, h, w, dark, x, h / 2, z);
      far.add(new THREE.ConeGeometry(w * 0.75, w * 1.2, 4), dark, x, h + w * 0.6, z, Math.PI / 4);
      for (let i = 0; i < 4; i++) far.box(0.6, 1.1, 0.1, win, x + (i % 2 ? 1 : -1) * w * 0.22, h * (0.45 + i * 0.12), z + w / 2 + 0.06);
    }
    far.cyl(2.2, 2.2, 0.3, glow('clock', '#d8d0b0', 0.5), 0, 46, 94.6, 24); // 鐘塔的鐘面
    far.build(group);
    // 月亮
    const moon = new THREE.Mesh(new THREE.CircleGeometry(4, 32), glow('moon', '#dfe6ff', 1)); moon.position.set(-40, 48, 60); moon.lookAt(0, 2, 160); group.add(moon);
  },
  hall(r, group) {
    const k = new Kit(), cx = 0;
    // 兩排石柱
    for (let z = 114; z <= 136; z += 5.5) for (const x of [-7.5, 7.5]) {
      k.cyl(0.55, 0.55, r.h - 1.2, MAT.stone(), x, (r.h - 1.2) / 2 + 0.6, z, 12);
      k.box(1.5, 0.6, 1.5, MAT.stone(), x, 0.3, z); k.box(1.6, 0.6, 1.6, MAT.stone(), x, r.h - 0.3, z);
    }
    // 四個學院的旗子
    const hs = ['eldrin', 'grimoire', 'belmont', 'ouroboros'];
    hs.forEach((h, i) => banner(k, HOUSE[h].banner, i < 2 ? -9.75 : 9.75, 8, 116 + (i % 2) * 14, i < 2 ? Math.PI / 2 : -Math.PI / 2, 1.6, 5));
    // 吊燈（一圈蠟燭）
    const ch = placeProp(group, 'chandelier', cx, 7.2, 126, 0, [4.6, 7.8, 4.6]);
    if (ch) candles(group, chandelierFlames(cx, 7.2, 126, ch), { h: 0.02, r: 0.03 });
    else { // 製作人給的吊燈模型；沒有就用一圈蠟燭
      k.add(new THREE.TorusGeometry(2.2, 0.06, 6, 32), MAT.iron(), cx, 9, 126, 0, Math.PI / 2);
      for (let i = 0; i < 4; i++) k.box(0.03, 6, 0.03, MAT.iron(), cx + Math.cos(i * Math.PI / 2) * 2.2, 12, 126 + Math.sin(i * Math.PI / 2) * 2.2);
      candles(group, Array.from({ length: 16 }, (_, i) => [cx + Math.cos(i / 16 * Math.PI * 2) * 2.2, 9.05, 126 + Math.sin(i / 16 * Math.PI * 2) * 2.2]));
    }
    k.build(group);
    // 紅地毯：從大門到分院鏡
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(3, 20), std('runner', { map: T.tile(T.rug('#5a1418', '#c8a24a'), 1, 1), roughness: 1 }));
    runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.012, 129); group.add(runner);
  },
  banquet(r, group) {
    const k = new Kit();
    // 西牆高高的窗戶
    for (let z = 106; z <= 144; z += 6) { k.box(0.06, 5, 1.8, MAT.glass(), r.x[0] + 0.2, 6.5, z); k.box(0.12, 5.2, 0.1, MAT.iron(), r.x[0] + 0.24, 6.5, z); k.box(0.12, 0.1, 2, MAT.iron(), r.x[0] + 0.24, 6.5, z); }
    // 北牆：四個學院的旗子，對著四張長桌
    ['eldrin', 'grimoire', 'belmont', 'ouroboros'].forEach((h, i) => banner(k, HOUSE[h].banner, -30 + i * 5.5, 8, r.z[0] + 0.25, 0, 2, 5.5));
    // 教師席的高台
    k.box(14, 0.4, 5, MAT.wood(), -22, 0.2, 105.5);
    if (placeProp(group, 'table', -22, 0.4, 105.8, 0, [11, 0.8, 1.2])) for (let i = 0; i < 7; i++) placeProp(group, 'chair', -27.4 + i * 1.8, 0.4, 104.6, 0, [0.6, 1.5, 0.6]); // 教師席（有模型才有）
    k.build(group);
    // 漂浮的蠟燭（典禮廳的招牌）
    const spots = []; for (let i = 0; i < 90; i++) spots.push([r.x[0] + 2 + ((i * 37) % 100) / 100 * (r.x[1] - r.x[0] - 4), 6 + ((i * 53) % 100) / 100 * 3.5, r.z[0] + 3 + ((i * 71) % 100) / 100 * (r.z[1] - r.z[0] - 6)]);
    candles(group, spots, { h: 0.3, r: 0.035 });
  },
  corridor(r, group) { // 尖拱的肋拱天花板（每 2.7 公尺一道，跟畫像對齊）；不加會被當成異常的東西
    const k = new Kit(), rib = MAT.stone();
    for (let z = r.z[1] - 1.65; z > r.z[0] + 1; z -= 2.7) {
      k.add(new THREE.TorusGeometry(2.3, 0.1, 6, 20, Math.PI), rib, 0, r.h - 2.4, z);
      for (const sx of [-1, 1]) k.box(0.3, r.h - 2.4, 0.22, rib, sx * 2.2, (r.h - 2.4) / 2, z);
    }
    k.build(group);
  },
  north_hall(r, group) { ROOM_DECOR.corridor(r, group); },
  founder(r, group) { // 創辦人的房間：方格天花板、深色木地板邊框（畫像、羅盤、燭台由 corridor.mjs 畫）
    const k = new Kit(), w = r.x[1] - r.x[0], d = r.z[1] - r.z[0], cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2;
    for (let x = r.x[0] + 2; x < r.x[1] - 1; x += 2.33) k.box(0.18, 0.3, d - 0.4, MAT.darkWood(), x, r.h - 0.15, cz);
    for (let z = r.z[0] + 2; z < r.z[1] - 1; z += 2.66) k.box(w - 0.4, 0.3, 0.18, MAT.darkWood(), cx, r.h - 0.15, z);
    k.build(group);
  },
  starhall(r, group) {
    // 地上的星圖（星盤底下的一大圈）
    const tex = T.drawn('starfloor', (g, s) => {
      g.fillStyle = '#1a1c26'; g.fillRect(0, 0, s, s);
      g.strokeStyle = '#b08a3a'; g.lineWidth = 6; for (const rr of [0.48, 0.44, 0.3]) { g.beginPath(); g.arc(s / 2, s / 2, s * rr, 0, Math.PI * 2); g.stroke(); }
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.beginPath(); g.moveTo(s / 2 + Math.cos(a) * s * 0.3, s / 2 + Math.sin(a) * s * 0.3); g.lineTo(s / 2 + Math.cos(a) * s * 0.44, s / 2 + Math.sin(a) * s * 0.44); g.stroke(); }
      g.fillStyle = '#d8c48a'; for (let i = 0; i < 160; i++) { const a = Math.random() * Math.PI * 2, rr = Math.random() * s * 0.47; g.fillRect(s / 2 + Math.cos(a) * rr, s / 2 + Math.sin(a) * rr, 2, 2); }
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(4.6, 48), std('starfloor', { map: tex, roughness: 0.6, metalness: 0.2 }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(0, 0.011, 0); group.add(disc);
    // 天花板：夜空
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(r.x[1] - r.x[0] - 0.4, r.z[1] - r.z[0] - 0.4), std('skyCeil', { map: T.tile(T.nightSky(), 2, 2), emissive: '#ffffff', emissiveMap: T.tile(T.nightSky(), 2, 2), emissiveIntensity: 0.5 }));
    sky.rotation.x = Math.PI / 2; sky.position.set(0, r.h - 0.02, 0); group.add(sky);
  },
};
for (const h of ['eldrin', 'grimoire', 'belmont', 'ouroboros']) {
  ROOM_DECOR['dorm_' + h] = (r, group) => {
    const k = new Kit(), cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2;
    // 火爐：艾爾德林、格里莫瓦在北牆中間；貝爾蒙特、烏洛波斯在南牆中間
    const north = h === 'eldrin' || h === 'grimoire';
    const fz = north ? r.z[0] + 0.45 : r.z[1] - 0.45, fry = north ? 0 : Math.PI;
    fireplace(k, cx, fz, fry);
    const toward = north ? 1 : -1;
    for (const s of [-1, 1]) { const ry = fry - s * (north ? 0.5 : -0.5) + Math.PI; if (!placeProp(group, 'armchair', cx + s * 1.6, 0, fz + toward * 1.6, ry - Math.PI, [0.9, 1.2, 0.9])) armchair(k, HOUSE[h].rug[0], cx + s * 1.6, fz + toward * 1.6, ry); } // 有製作人給的模型就用模型
    // 書架：靠在火爐那面牆的兩邊
    for (const dx of [-3.4, 3.4]) if (Math.abs(dx) + 1 < (r.x[1] - r.x[0]) / 2) { const bz = north ? r.z[0] + 0.4 : r.z[1] - 0.4; if (!placeProp(group, 'bookshelf', cx + dx, 0, bz, fry, [1.7, Math.min(2.6, r.h - 0.6), 0.5])) bookshelf(k, cx + dx, bz, fry, 1.6, Math.min(2.4, r.h - 0.8)); }
    placeProp(group, 'sofa', cx, 0, fz + toward * 3.75, fry + Math.PI, [2.1, 1.0, 1.0]); // 沙發：在小圓桌後面、面向火爐（有模型才有）
    // 學院旗：火爐上方
    banner(k, HOUSE[h].banner, cx, Math.min(r.h - 1.4, 3.9), north ? r.z[0] + 0.2 : r.z[1] - 0.2, fry, 1.2, 1.6);
    k.build(group);
    rugAt(group, h, cx, fz + toward * 2.4, 3.6, 2.6);
    candles(group, [[cx - 0.8, 1.52, fz + toward * 0.1], [cx + 0.8, 1.52, fz + toward * 0.1]]);
  };
}


// ---------- 小裝飾、小細節（props.mjs）：每個房間額外擺的東西。只是外觀，不擋路 ----------
// 天花板四個角的蜘蛛網
function cobwebs(k, r, s = 0.7) {
  const y = r.h - 0.02;
  [[r.x[0] + 0.17, r.z[0] + 0.17, 0], [r.x[1] - 0.17, r.z[0] + 0.17, -Math.PI / 2], [r.x[1] - 0.17, r.z[1] - 0.17, Math.PI], [r.x[0] + 0.17, r.z[1] - 0.17, Math.PI / 2]]
    .forEach(([x, z, ry], i) => { if (P.rnd(x, z, i) > 0.35) P.cobweb(k, x, y, z, ry, s * (0.7 + P.rnd(z, x) * 0.6)); });
}
const DORM_EXTRA = {
  eldrin(k, ctx) { telescope(k, ctx.group, ctx.cornerX, ctx.cornerZ, ctx.fry + Math.PI); if (!placeProp(ctx.group, 'globe', ctx.deskX - 0.4, ctx.deskTop, ctx.deskZ, ctx.fry, [0.3, 0.42, 0.3])) P.globe(k, ctx.deskX - 0.4, ctx.deskTop, ctx.deskZ); P.starChart(k, ctx.cx + 5.5, 2.4, ctx.oppZ, ctx.fry + Math.PI); },
  grimoire(k, ctx) { P.crystalBall(k, ctx.tableX, ctx.tableTop, ctx.tableZ + 0.1); P.runeStones(k, ctx.deskX - 0.3, ctx.deskTop, ctx.deskZ, 4); P.bottles(k, ctx.cornerX, 0, ctx.cornerZ, 7, 5); P.skull(k, ctx.deskX + 0.45, ctx.deskTop, ctx.deskZ, ctx.fry); },
  belmont(k, ctx) { P.antlers(k, ctx.cx + 2.2, 2.6, ctx.fireZ - ctx.toward * 0.25, ctx.fry); P.crossedSwords(k, ctx.cx - 2.2, 2.4, ctx.fireZ - ctx.toward * 0.25, ctx.fry); barrel(k, ctx.group, ctx.cornerX, ctx.cornerZ); P.coatRack(k, ctx.rackX, ctx.rackZ, ['#d1a640', '#3a2410']); },
  ouroboros(k, ctx) { P.serpent(k, ctx.deskX - 0.35, ctx.deskTop, ctx.deskZ); if (!placeProp(ctx.group, 'cauldron', ctx.cornerX, 0, ctx.cornerZ, ctx.fry, [0.9, 0.75, 0.9])) P.cauldron(k, ctx.cornerX, ctx.cornerZ); P.bottles(k, ctx.tableX, ctx.tableTop, ctx.tableZ, 11, 3); P.skull(k, ctx.deskX + 0.4, ctx.deskTop, ctx.deskZ, ctx.fry); },
};
function dormDetails(r, group, h) {
  const k = new Kit(), flames = [];
  const cx = (r.x[0] + r.x[1]) / 2, north = h === 'eldrin' || h === 'grimoire', toward = north ? 1 : -1;
  const fireZ = north ? r.z[0] + 0.45 : r.z[1] - 0.45, fry = north ? 0 : Math.PI;
  const oppZ = north ? r.z[1] - 0.2 : r.z[0] + 0.2; // 對面那面牆
  // 火爐前的小圓桌：茶壺、茶杯、一本攤開的書
  const tableX = cx, tableZ = fireZ + toward * 2.3, tableTop = P.roundTable(k, tableX, tableZ, 0.32, 0.5);
  P.teapot(k, tableX - 0.1, tableTop, tableZ - 0.08); P.teacup(k, tableX + 0.14, tableTop, tableZ + 0.05); P.teacup(k, tableX - 0.12, tableTop, tableZ + 0.15);
  // 對面牆邊的書桌（門在對面那面牆的中間，書桌放旁邊）
  const deskX = cx + (r.x[1] - r.x[0] > 10 ? 3.6 : 2.6), deskZ = oppZ - toward * 0.55;
  let deskTop = 0.8; // 模型書桌的桌面高度（學院的小東西放上面）
  if (placeProp(group, 'desk', deskX, 0, deskZ, north ? Math.PI : 0, [1.4, 0.95, 0.75])) placeProp(group, 'chair', deskX, 0, deskZ - toward * 0.75, north ? 0 : Math.PI, [0.55, 1.3, 0.55]); // 書桌前的椅子（面向書桌）
  else { // 製作人給的書桌模型（上面本來就有書、紙、羽毛筆）；沒有就用拼的
    deskTop = P.desk(k, deskX, deskZ, north ? Math.PI : 0);
    P.openBook(k, deskX, deskTop, deskZ, fry); P.inkQuill(k, deskX + 0.35, deskTop, deskZ - toward * 0.15); P.bookStack(k, deskX - 0.5, deskTop, deskZ + toward * 0.1, 4, r.x[0]);
    P.candleStick(k, deskX + 0.5, deskTop, deskZ + toward * 0.15, flames);
  }
  // 書架前地上的書、捲軸
  P.bookStack(k, cx - 3.4 + 0.7, 0, fireZ + toward * 0.75, 3, r.z[0]); P.scroll(k, cx - 3.4 - 0.2, 0, fireZ + toward * 0.9, 0.6);
  // 角落的箱子（行李）
  P.chest(k, r.x[0] + 0.7, oppZ - toward * 0.5, fry, HOUSE[h].rug[0]);
  // 爐台上的小東西：燭台、小畫框
  P.candleStick(k, cx - 0.9, 1.52, fireZ + toward * 0.1, flames); P.candleStick(k, cx + 0.9, 1.52, fireZ + toward * 0.1, flames);
  // 學院的特色小物
  const cornerX = h === 'ouroboros' ? r.x[0] + 0.8 : r.x[1] - 0.8, cornerZ = fireZ + toward * 1.4;
  DORM_EXTRA[h](k, { group, cx, fry, toward, fireZ, oppZ, tableX, tableZ, tableTop, deskX, deskZ, deskTop, cornerX, cornerZ, rackX: r.x[0] + 0.5, rackZ: fireZ + toward * 2.8 });
  cobwebs(k, r, 0.5);
  k.build(group); candles(group, flames, { h: 0.12, r: 0.018 });
}
const DETAILS = {
  dock(r, group) { // 新生的行李、木箱、木桶、繩子
    const k = new Kit();
    [[-4.6, 144], [4.5, 145.2], [-4.4, 152], [4.7, 158]].forEach(([x, z], i) => P.trunk(k, x, z, P.rnd(i) * 0.6, ['#5a2a1a', '#2a3a5a', '#3a2a10', '#1a3a2a'][i]));
    crate(k, group, 4.6, 147, 0.7); crate(k, group, 4.6, 147, 0.5, 0.7, 0.4, true); crate(k, group, -4.7, 160, 0.6);
    barrel(k, group, -4.8, 147.5); barrel(k, group, -4.3, 148.4); P.ropeCoil(k, 4.3, 163);
    k.build(group);
  },
  hall(r, group) { // 石柱之間的長凳、角落的石甕、門邊的公告板
    const k = new Kit();
    for (const z of [116.75, 127.75]) for (const s of [-1, 1]) P.bench(k, s * 9.4, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, 2.4);
    for (const [x, z] of [[-9.3, 111], [9.3, 111], [-9.3, 139.2], [9.3, 139.2]]) P.urn(k, x, z);
    // 公告板：一塊木板＋幾張羊皮紙
    k.box(1.6, 1.1, 0.06, MAT.darkWood(), 5.5, 1.7, 139.7);
    for (let i = 0; i < 4; i++) k.add(new THREE.PlaneGeometry(0.32, 0.42), MAT.parchment(), 4.95 + i * 0.37, 1.72 + (i % 2) * 0.12, 139.66, Math.PI, 0, (P.rnd(i) - 0.5) * 0.2);
    cobwebs(k, r, 1.2);
    k.build(group);
  },
  banquet(r, group) { const k = new Kit(); cobwebs(k, r, 1.2); k.build(group); },
  starhall(r, group) { // 牆角的望遠鏡、牆上的星圖、書架上的地球儀
    const k = new Kit();
    telescope(k, group, -8.2, 8.2, Math.PI * 0.75); telescope(k, group, 8.2, -8.2, -Math.PI * 0.25);
    P.starChart(k, -5, 2.6, -8.8, 0); P.starChart(k, 5, 2.6, -8.8, 0); P.starChart(k, -8.8, 2.6, -1, Math.PI / 2); P.starChart(k, 8.8, 2.6, 1, -Math.PI / 2);
    const t1 = P.roundTable(k, 8.2, 8.2, 0.35, 0.8); P.globe(k, 8.2, t1, 8.2);
    const t2 = P.roundTable(k, -8.2, -8.2, 0.35, 0.8); P.bookStack(k, -8.25, t2, -8.2, 3, 9); P.scroll(k, -8.1, t2 + 0.1, -8.05, 1);
    cobwebs(k, r, 0.9);
    k.build(group);
  },
};
// 第三、四幕的小細節
Object.assign(DETAILS, {
  lib_entry(r, group) { // 靠牆的書架、倒在地上的椅子、散落的書
    const k = new Kit();
    for (let z = 7; z <= 12; z += 1.8) bookshelf(k, r.x[1] - 0.4, z, -Math.PI / 2, 1.6, 2.6);
    for (let x = 102.5; x <= 108; x += 1.8) bookshelf(k, x, r.z[1] - 0.4, Math.PI, 1.6, 2.6);
    k.add(new THREE.BoxGeometry(0.42, 0.04, 0.42), MAT.darkWood(), 106, 0.22, 9, 0.4, 0, Math.PI / 2 - 0.1); // 倒下的椅子
    for (let i = 0; i < 6; i++) P.bookStack(k, 104 + P.rnd(i) * 7, 0, 6 + P.rnd(i, 1) * 6, 1 + Math.floor(P.rnd(i, 2) * 2), i);
    cobwebs(k, r, 1.4); k.build(group);
  },
  lib_reading(r, group) { // 閱覽室：長桌、綠色檯燈、書
    const k = new Kit(), flames = [];
    for (const z of [-40, -36]) {
      k.box(3, 0.06, 1, MAT.wood(), 126.5, 0.76, z); for (const sx of [-1, 1]) k.box(0.08, 0.73, 0.9, MAT.darkWood(), 126.5 + sx * 1.4, 0.365, z);
      for (const sx of [-0.9, 0.9]) { k.cyl(0.07, 0.08, 0.02, MAT.brass(), 126.5 + sx, 0.8, z, 10); k.cyl(0.01, 0.01, 0.3, MAT.brass(), 126.5 + sx, 0.95, z, 6); k.add(new THREE.CylinderGeometry(0.06, 0.13, 0.1, 10, 1, true), std('bankerGreen', { color: '#1a5a2a', emissive: '#0a3a14', emissiveIntensity: 0.5, side: THREE.DoubleSide }), 126.5 + sx, 1.1, z); }
      P.openBook(k, 126.2, 0.79, z, P.rnd(z)); if (!placeProp(group, 'books', 127.3, 0.79, z, z, [0.3, 0.25, 0.3])) P.bookStack(k, 127.3, 0.79, z, 3, z);
      for (const sx of [-0.8, 0.8]) for (const sd of [-1, 1]) placeProp(group, 'chair', 126.5 + sx, 0, z + sd * 0.75, sd > 0 ? Math.PI : 0, [0.5, 1.2, 0.5]); // 椅子（有模型才有）
    }
    placeProp(group, 'rug', 126.5, 0.008, -38, 0, [3.6, 0.05, 6]); // 長桌下的波斯地毯（有模型才有）
    cobwebs(k, r, 1); k.build(group); candles(group, flames);
  },
  lib_ante(r, group) { const k = new Kit(); cobwebs(k, r, 1.2); P.skull(k, 125.5, 0, -59.4, 0.4); P.bookStack(k, 122, 0, -51, 2, 3); k.build(group); },
  lib_well(r, group) { const k = new Kit(); cobwebs(k, r, 1.6); P.ropeCoil(k, 132.5, -60); barrel(k, group, 138, -65); k.build(group); },
  a4_pass(r, group) { const k = new Kit(); crate(k, group, 120, 7.9, 0.5, 0, 0, true); barrel(k, group, 136, 7.9); P.broom(k, 141, 8.2); cobwebs(k, r, 0.6); k.build(group); },
  a4_gears(r, group) { // 機械室：工作台、油桶、齒輪零件
    const k = new Kit(); k.box(2, 0.08, 0.8, MAT.wood(), 163, 0.9, 1); for (const sx of [-0.9, 0.9]) k.box(0.08, 0.86, 0.7, MAT.darkWood(), 163 + sx, 0.43, 1);
    for (let i = 0; i < 4; i++) k.add(new THREE.TorusGeometry(0.12 + i * 0.03, 0.03, 4, 12), std('gearIron', { color: '#4a3e30', metalness: 0.6, roughness: 0.5 }), 162.4 + i * 0.35, 0.97, 1, 0, Math.PI / 2);
    barrel(k, group, 147, 8); barrel(k, group, 147.6, 8.7); crate(k, group, 163.5, 12, 0.7);
    cobwebs(k, r, 2); k.build(group);
  },
});
for (const h of ['eldrin', 'grimoire', 'belmont', 'ouroboros']) DETAILS['dorm_' + h] = (r, group) => dormDetails(r, group, h);

// 美術出錯時只印警告，不要讓遊戲壞掉（灰盒照樣能玩）
const safe = (fn) => (arg) => { try { fn(arg); } catch (e) { console.warn('場景美術出錯（先用灰盒）', e); } };
decorators.room.push(safe(({ room, group }) => {
  const st = STYLE[room.id];
  if (st) cladding(group, room, st);
  ROOM_DECOR[room.id]?.(room, group);
  DETAILS[room.id]?.(room, group);
  const lib = { Kit, MAT, std, glow, candles, bookshelf, armchair, banner, P };
  dressRoom(room, group, lib); // 沿著牆再多擺一些家具、牆上的東西（dress.mjs）
  if (room.id === 'a4_roof') dressRoof(room, group, lib); // 屋頂看起來要像露天
  if (room.id === 'dock') dressDock(room, group, lib); // 碼頭：小船、湖上的燈和霧
}));

// ---------- 門：木門＋鐵條，跟著灰盒門板一起開關；門框一直都在 ----------
decorators.door.push(safe(({ door: d, mesh, group }) => {
  retexture(group); // 第一扇門的時候，牆都已經蓋好了
  const invisible = (M.invis ||= new THREE.MeshBasicMaterial({ visible: false }));
  const k = new Kit(), w = d.w, h = 2.6;
  k.box(w, h, 0.1, MAT.darkWood(), 0, 0, 0);
  for (const y of [-0.8, 0.8]) k.box(w * 0.98, 0.08, 0.13, MAT.iron(), 0, y, 0);
  k.box(0.06, 0.2, 0.16, MAT.brass(), w * 0.32, 0, 0);
  const g = k.build(new THREE.Group());
  if (d.axis === 'z') g.rotation.y = Math.PI / 2;
  mesh.material = invisible; mesh.add(g); // 開門時灰盒門板 visible＝false，木門也跟著消失
  // 門框
  const f = new Kit(), fx = d.axis === 'x' ? 1 : 0, fz = 1 - fx;
  for (const s of [-1, 1]) f.box(fx ? 0.25 : 0.42, h + 0.2, fx ? 0.42 : 0.25, MAT.stone(), d.x + s * fx * (w / 2 + 0.12), (h + 0.2) / 2, d.z + s * fz * (w / 2 + 0.12));
  f.box(fx ? w + 0.5 : 0.42, 0.35, fx ? 0.42 : w + 0.5, MAT.stone(), d.x, h + 0.25, d.z);
  f.build(group);
}));

// ---------- 可以調查的東西 ----------
export const hideBox = (mesh) => { mesh.material = (M.invis ||= new THREE.MeshBasicMaterial({ visible: false })); };
function curtain(t, mesh, group) { // 厚窗簾：一片一片的布褶
  const [w, h, d] = t.size, k = new Kit(), mat = MAT.velvet('#3a0e14'), n = 9;
  const along = d >= w, len = along ? d : w;
  for (let i = 0; i < n; i++) {
    const off = -len / 2 + (i + 0.5) * len / n, wob = (i % 2 ? 0.08 : -0.08);
    if (along) k.box(0.08, h, len / n + 0.05, mat, t.x + wob, h / 2, t.z + off); else k.box(len / n + 0.05, h, 0.08, mat, t.x + off, h / 2, t.z + wob);
  }
  if (along) k.box(0.1, 0.1, len + 0.4, MAT.brass(), t.x, h + 0.05, t.z); else k.box(len + 0.4, 0.1, 0.1, MAT.brass(), t.x, h + 0.05, t.z);
  k.build(group); hideBox(mesh);
}
// 第三、四幕的躲藏點（人要站得進去：只在旁邊、後面放東西，中間留空）
const toolCabinet = (t, mesh, group) => { // 工具櫃：門開著
  const k = new Kit(), [w, h, d] = t.size, back = t.z < 8 ? -1 : 1; // 靠牆那一邊
  k.box(w, h, 0.05, MAT.darkWood(), t.x, h / 2, t.z + back * d / 2);
  for (const sx of [-1, 1]) k.box(0.05, h, d, MAT.darkWood(), t.x + sx * w / 2, h / 2, t.z);
  k.box(w, 0.05, d, MAT.darkWood(), t.x, h, t.z);
  k.box(w * 0.5, h * 0.95, 0.04, MAT.darkWood(), t.x + w * 0.75, h / 2, t.z - back * d * 0.3, 0); // 開著的門
  for (let i = 0; i < 3; i++) k.box(0.04, 0.4, 0.02, MAT.iron(), t.x - w * 0.3 + i * 0.25, h * 0.75, t.z + back * (d / 2 - 0.05)); // 掛著的工具
  k.build(group); hideBox(mesh);
};
const gearHide = (t, mesh, group) => { // 大齒輪後面：一個斜靠的大齒輪
  const k = new Kit(), r = 1.1;
  k.add(new THREE.CylinderGeometry(r, r, 0.18, 20), std('gearIron', { color: '#4a3e30', metalness: 0.6, roughness: 0.5 }), t.x, r, t.z - 0.6, 0, Math.PI / 2 - 0.15, 0);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.box(0.22, 0.22, 0.2, std('gearIron', {}), t.x + Math.cos(a) * (r + 0.08), r + Math.sin(a) * (r + 0.08), t.z - 0.6); }
  k.build(group); hideBox(mesh);
};
const shelfGap = (t, mesh, group) => { const k = new Kit(); for (const dz of [-0.95, 0.95]) bookshelf(k, t.x - 0.3, t.z + dz, Math.PI / 2, 0.8, 2.4); k.build(group); hideBox(mesh); };
const niche = (t, mesh, group) => { const k = new Kit(); k.add(new THREE.TorusGeometry(0.6, 0.1, 6, 16, Math.PI), MAT.stone(), t.x, 1.4, t.z + 0.2); for (const sx of [-0.6, 0.6]) k.box(0.2, 1.4, 0.3, MAT.stone(), t.x + sx, 0.7, t.z + 0.2); k.build(group); hideBox(mesh); };
const chimney = (t, mesh, group) => { // 屋頂的煙囪：人躲在後面（煙囪在靠走道那邊）
  const k = new Kit(), side = t.x < 155 ? 1 : -1, brick = std('brick', { map: T.tile(T.stoneWall('#5a3a2c'), 0.5, 0.5) });
  k.box(1.2, 2.6, 0.9, brick, t.x + side * 0.6, 1.3, t.z); k.box(1.35, 0.15, 1.05, MAT.stone(), t.x + side * 0.6, 2.65, t.z);
  k.build(group); hideBox(mesh);
};
const HIDE = { hide_g1: toolCabinet, hide_g2: toolCabinet, hide_g3: toolCabinet, hide_g4: gearHide, hide_g5: gearHide, hide_e1: shelfGap, hide_e2: shelfGap, hide_p1: niche, hide_r1: chimney, hide_r2: chimney };

// 第三幕：沉眠圖書館的謎題物件（位置、大小照配置；外觀不暗示答案）
const ACT3 = {
  cat(t, mesh, group) { // 貓的屍體：身上長滿黑色結晶
    const k = new Kit(), fur = std('deadfur', { color: '#2a2622', roughness: 1 }), xtal = std('blightXtal', { color: '#0d0d18', emissive: '#08081a', roughness: 0.2, metalness: 0.6 });
    k.add(new THREE.SphereGeometry(0.16, 10, 7), fur, t.x, 0.1, t.z, 0, 0, Math.PI / 2); k.add(new THREE.SphereGeometry(0.08, 8, 6), fur, t.x + 0.2, 0.08, t.z);
    for (let i = 0; i < 7; i++) k.add(new THREE.ConeGeometry(0.025, 0.12 + P.rnd(i) * 0.12, 5), xtal, t.x - 0.12 + i * 0.05, 0.2, t.z + (P.rnd(i, 1) - 0.5) * 0.1, 0, (P.rnd(i, 2) - 0.5), (P.rnd(i, 3) - 0.5));
    k.build(group); hideBox(mesh);
  },
  senior(t, mesh) { hideBox(mesh); }, // 屍體由帳號一的 library.mjs 畫
  tiles(t, mesh) { hideBox(mesh); }, // 暗室的石板由 library.mjs 畫
  notice(t, mesh, group) { // 搜救公告：釘在牆上的紙
    const m = new THREE.Mesh(new THREE.PlaneGeometry(t.size[2] * 0.8, t.size[1]), MAT.parchment()); m.position.set(t.x + 0.12, (t.y ?? 0) + t.size[1] / 2, t.z); m.rotation.y = Math.PI / 2; group.add(m); hideBox(mesh);
  },
  lampbox(t, mesh, group) { // 上鎖的提燈箱
    const [w, h, d] = t.size; const k = new Kit(); k.box(w, h, d, MAT.darkWood(), t.x, h / 2, t.z); for (const s of [-1, 1]) k.box(0.04, h + 0.02, d + 0.02, MAT.iron(), t.x + s * w * 0.35, h / 2, t.z);
    k.box(0.12, 0.14, 0.04, MAT.brass(), t.x, h * 0.6, t.z - d / 2 - 0.02); k.build(group, { shadow: true }); hideBox(mesh);
  },
  gate(t, mesh, group) { // 鐵柵門＋中間的元素鎖（圓盤）
    const [w, h] = t.size, k = new Kit();
    for (let i = 0; i <= 10; i++) k.cyl(0.025, 0.025, h, MAT.iron(), t.x - w / 2 + i * w / 10, h / 2, t.z, 6);
    for (const y of [0.15, h * 0.5, h - 0.1]) k.box(w, 0.06, 0.06, MAT.iron(), t.x, y, t.z);
    k.add(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 20), MAT.brass(), t.x, h * 0.5, t.z + 0.05, 0, Math.PI / 2, 0);
    ['#ff6a3a', '#4cc8ff', '#8ad04c', '#d8d0b0'].forEach((c, i) => { const a = i / 4 * Math.PI * 2 + Math.PI / 4; k.add(new THREE.SphereGeometry(0.05, 8, 6), glow('elem' + c, c, 0.8), t.x + Math.cos(a) * 0.18, h * 0.5 + Math.sin(a) * 0.18, t.z + 0.1); });
    k.build(group); hideBox(mesh);
  },
  mark(t, mesh, group) { const m = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 24), MAT.brass()); m.rotation.x = -Math.PI / 2; m.position.set(t.x, 0.013, t.z); group.add(m); hideBox(mesh); },
  ladder(t, mesh, group) { // 圖書館的滑軌梯
    const [w, h] = t.size, k = new Kit();
    for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.06, h + 0.4, 0.06), MAT.wood(), t.x + s * w * 0.35, (h + 0.4) / 2, t.z, 0, -0.2, 0);
    for (let y = 0.3; y < h; y += 0.32) k.box(w * 0.7, 0.04, 0.05, MAT.wood(), t.x, y, t.z - Math.sin(0.2) * (y - h / 2));
    k.build(group, { shadow: true }); hideBox(mesh);
  },
  sign(t, mesh, group) { const k = new Kit(); k.box(t.size[0], t.size[1], 0.05, MAT.darkWood(), t.x, (t.y ?? 0) + t.size[1] / 2, t.z); k.box(t.size[0] * 0.85, t.size[1] * 0.7, 0.02, MAT.parchment(), t.x, (t.y ?? 0) + t.size[1] / 2, t.z + 0.03); k.build(group); hideBox(mesh); },
  books(t, mesh, group) { // 有編號的書：一張長桌上排成一排（書背上的號碼由謎題畫面顯示）
    const [w, , d] = t.size, k = new Kit(), top = 0.78;
    k.box(w, 0.05, d, MAT.wood(), t.x, top, t.z); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.06, top, 0.06, MAT.darkWood(), t.x + sx * (w / 2 - 0.06), top / 2, t.z + sz * (d / 2 - 0.06));
    for (let i = 0; i < 9; i++) k.box(0.06, 0.26, 0.2, MAT.cloth(['#5a1a1a', '#1a3a2a', '#2a2a4a', '#4a3a1a'][i % 4]), t.x - w * 0.4 + i * w * 0.1, top + 0.155, t.z);
    k.build(group); hideBox(mesh);
  },
  crystal(t, mesh, group) { // 留聲水晶：石座上的一塊發光水晶
    const k = new Kit(); k.cyl(0.2, 0.25, 0.9, MAT.stone(), t.x, 0.45, t.z, 8);
    k.add(new THREE.OctahedronGeometry(0.18), std('songXtal', { color: '#9fd8ff', emissive: '#3a7aa8', emissiveIntensity: 0.8, roughness: 0.05, transparent: true, opacity: 0.85 }), t.x, 1.1, t.z);
    k.build(group); hideBox(mesh);
  },
  desk7(t, mesh, group) { const k = new Kit(); const top = P.desk(k, t.x, t.z, Math.PI, t.size[0]); P.bookStack(k, t.x - 0.4, top, t.z, 3, 7); P.inkQuill(k, t.x + 0.4, top, t.z); k.build(group); hideBox(mesh); },
  flipbook(t, mesh, group) { // 自己翻頁的書：放在書架台上，攤開
    const k = new Kit(); k.box(0.12, 0.85, 0.12, MAT.darkWood(), t.x, 0.42, t.z); k.add(new THREE.BoxGeometry(0.5, 0.04, 0.4), MAT.darkWood(), t.x, 0.88, t.z, 0, -0.35); P.openBook(k, t.x, 0.9, t.z, 0); k.build(group); hideBox(mesh);
  },
  eastern(t, mesh, group) { // 「東方典藏」櫃：紅漆木櫃、很多小抽屜
    const [, h, d] = t.size, k = new Kit(), lac = std('lacquer', { color: '#6a1414', roughness: 0.4 });
    k.box(0.4, h, d, lac, t.x - 0.1, h / 2, t.z);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { k.box(0.02, h / 6 - 0.04, d / 4 - 0.04, std('lacquerDrawer', { color: '#8a1e1a', roughness: 0.4 }), t.x - 0.31, (r + 0.5) * h / 6, t.z - d / 2 + (c + 0.5) * d / 4); k.cyl(0.015, 0.015, 0.03, MAT.brass(), t.x - 0.33, (r + 0.5) * h / 6, t.z - d / 2 + (c + 0.5) * d / 4, 6); }
    k.build(group); hideBox(mesh);
  },
  familychart(t, mesh, group) { const m = new THREE.Mesh(new THREE.PlaneGeometry(t.size[2], t.size[1]), MAT.parchment()); m.position.set(t.x - 0.12, (t.y ?? 0) + t.size[1] / 2, t.z); m.rotation.y = -Math.PI / 2; group.add(m); hideBox(mesh); },
  letter(t, mesh, group) { const k = new Kit(); P.trunk(k, t.x, t.z, 0.3, '#3a1418'); k.add(new THREE.PlaneGeometry(0.2, 0.14), std('envelope', { color: '#e8dcc0', side: THREE.DoubleSide }), t.x, 0.58, t.z, 0.3, -Math.PI / 2); k.build(group); hideBox(mesh); },
  runedoor(t, mesh, group) { // 刻滿盧恩符文的大門：石門＋發光的符文
    const [, h, d] = t.size, k = new Kit(); k.box(0.25, h, d, MAT.stone(), t.x, h / 2, t.z);
    const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'; const tex = T.drawn('runedoor', (g, S) => { g.fillStyle = '#2a2a30'; g.fillRect(0, 0, S, S); g.fillStyle = '#7ab0ff'; g.font = `${S / 9}px serif`; g.textAlign = 'center'; for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) g.fillText(RUNES[(r * 4 + c * 5) % RUNES.length], (c + 0.5) * S / 4, (r + 0.75) * S / 6); });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.9, h * 0.9), std('runeFace', { map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 })); face.position.set(t.x - 0.13, h / 2, t.z); face.rotation.y = -Math.PI / 2; group.add(face);
    k.build(group); hideBox(mesh);
  },
  mirrors(t, mesh, group) { // 月光與鏡座：一圈立著的小圓鏡
    const k = new Kit(); k.cyl(t.size[0] / 2, t.size[0] / 2, 0.1, MAT.stone(), t.x, 0.05, t.z, 20);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2, x = t.x + Math.cos(a) * 0.7, z = t.z + Math.sin(a) * 0.7; k.cyl(0.03, 0.04, 0.9, MAT.brass(), x, 0.5, z, 6); k.add(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16), MAT.mirror(), x, 1.0, z, -a, Math.PI / 2, 0); }
    k.build(group); hideBox(mesh);
  },
  statues(t, mesh, group) { // 四座石像鬼
    const k = new Kit(), st = MAT.stone();
    for (let i = 0; i < 4; i++) { const x = t.x - 0.75 + i * 0.5; k.box(0.32, 0.4, 0.32, st, x, 0.2, t.z); k.add(new THREE.SphereGeometry(0.15, 8, 6), st, x, 0.55, t.z); k.add(new THREE.ConeGeometry(0.05, 0.14, 4), st, x - 0.08, 0.72, t.z); k.add(new THREE.ConeGeometry(0.05, 0.14, 4), st, x + 0.08, 0.72, t.z); k.add(new THREE.BoxGeometry(0.03, 0.3, 0.25), st, x - 0.17, 0.5, t.z + 0.05, 0, 0, 0.5); k.add(new THREE.BoxGeometry(0.03, 0.3, 0.25), st, x + 0.17, 0.5, t.z + 0.05, 0, 0, -0.5); }
    k.build(group, { shadow: true }); hideBox(mesh);
  },
  badge(t, mesh, group) { const k = new Kit(); k.cyl(0.05, 0.05, 0.01, glow('badgeGlow', '#ffd060', 1), t.x, 0.02, t.z, 12); k.build(group); hideBox(mesh); },
  sketch(t, mesh, group) { const k = new Kit(); k.box(t.size[0] + 0.1, t.size[1] + 0.1, 0.05, MAT.brass(), t.x, (t.y ?? 0) + t.size[1] / 2, t.z); k.box(t.size[0], t.size[1], 0.02, MAT.mirror(), t.x, (t.y ?? 0) + t.size[1] / 2, t.z + 0.03); k.build(group); hideBox(mesh); },
  braille(t, mesh, group) { const k = new Kit(); bookshelf(k, t.x + 0.15, t.z, -Math.PI / 2, t.size[2], 2.2); k.build(group); hideBox(mesh); },
  ball(t, mesh, group) { const k = new Kit(); k.cyl(0.18, 0.25, 0.9, MAT.darkWood(), t.x, 0.45, t.z, 10); P.crystalBall(k, t.x, 0.9, t.z); k.build(group); hideBox(mesh); },
  exitdoor(t, mesh, group) { const k = new Kit(); k.box(t.size[0], t.size[1], 0.1, MAT.darkWood(), t.x, t.size[1] / 2, t.z); k.add(new THREE.SphereGeometry(0.05, 8, 6), MAT.brass(), t.x + 0.55, 1.1, t.z + 0.08); k.build(group); hideBox(mesh); },
  well(t, mesh, group) { // 井：石砌的井口、鐵蓋上三個圓環
    const k = new Kit(), R = t.size[0] / 2; k.cyl(R, R * 1.05, t.size[1], MAT.stone(), t.x, t.size[1] / 2, t.z, 20);
    k.cyl(R * 0.85, R * 0.85, 0.06, MAT.iron(), t.x, t.size[1] + 0.03, t.z, 20);
    for (const r of [0.3, 0.55, 0.8]) k.add(new THREE.TorusGeometry(R * r, 0.03, 4, 32), MAT.brass(), t.x, t.size[1] + 0.07, t.z, 0, Math.PI / 2);
    k.build(group, { shadow: true }); hideBox(mesh);
  },
  note(t, mesh, group) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), MAT.parchment()); m.rotation.set(-Math.PI / 2, 0, P.rnd(t.x, t.z) * 3); m.position.set(t.x, 0.014, t.z); group.add(m); hideBox(mesh); },
};
// 第四幕
const ACT4 = {
  ironDoor(t, mesh, group) { // 卡住的鐵門＋四根拉桿
    const [, h, d] = t.size, k = new Kit(); k.box(0.12, h, d, MAT.iron(), t.x, h / 2, t.z);
    for (let i = 0; i < 6; i++) k.cyl(0.03, 0.03, 0.05, MAT.iron(), t.x - 0.08, 0.3 + i * 0.36, t.z - d / 2 + 0.1, 6);
    for (let i = 0; i < 4; i++) { const z = t.z - d * 0.3 + i * d * 0.2; k.box(0.06, 0.06, 0.06, MAT.iron(), t.x - 0.1, 1.2, z); k.add(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), MAT.iron(), t.x - 0.22, 1.35, z, 0, 0, 0.6); k.add(new THREE.SphereGeometry(0.04, 6, 5), std('leverKnob', { color: '#6a1a14' }), t.x - 0.35, 1.53, z); }
    k.build(group); hideBox(mesh);
  },
  gearwall(t, mesh, group) { // 鐘槌的齒輪組：牆上一組咬在一起的齒輪
    const [w, h, d] = t.size, k = new Kit(), iron = std('gearIron', { color: '#4a3e30', metalness: 0.6, roughness: 0.5 });
    k.box(w, h, 0.15, MAT.darkWood(), t.x, (t.y ?? 0) + h / 2, t.z + d / 2 - 0.08);
    for (const [dx, dy, r] of [[-0.8, 0.9, 0.55], [0.15, 1.6, 0.45], [0.85, 0.8, 0.6], [0, 0.4, 0.3]]) {
      k.add(new THREE.CylinderGeometry(r, r, 0.08, 18), iron, t.x + dx, (t.y ?? 0) + dy, t.z + d / 2 - 0.2, 0, Math.PI / 2);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; k.box(0.1, 0.1, 0.08, iron, t.x + dx + Math.cos(a) * (r + 0.04), (t.y ?? 0) + dy + Math.sin(a) * (r + 0.04), t.z + d / 2 - 0.2); }
      k.cyl(0.06, 0.06, 0.12, MAT.brass(), t.x + dx, (t.y ?? 0) + dy, t.z + d / 2 - 0.25, 8);
    }
    k.build(group, { shadow: true }); hideBox(mesh);
  },
  pendulum(t, mesh, group) { // 鐘擺室的出口：刻著童謠的石框門
    const [w, h] = t.size, k = new Kit(); k.box(w, h, 0.12, MAT.darkWood(), t.x, h / 2, t.z);
    for (const s of [-1, 1]) k.box(0.3, h + 0.3, 0.3, MAT.stone(), t.x + s * (w / 2 + 0.15), (h + 0.3) / 2, t.z);
    k.box(w + 0.9, 0.35, 0.3, MAT.stone(), t.x, h + 0.2, t.z); k.box(w * 0.8, 0.25, 0.02, MAT.parchment(), t.x, h - 0.3, t.z + 0.07);
    k.build(group); hideBox(mesh);
  },
  roofsign(t, mesh, group) { const k = new Kit(); k.box(t.size[0], t.size[1], 0.15, MAT.stone(), t.x, (t.y ?? 0) + t.size[1] / 2, t.z); k.build(group); hideBox(mesh); },
  roots(t, mesh) { hideBox(mesh); }, // 黑根由帳號一的 act4scene.mjs 畫
};

const THING = {
  boat(t, mesh, group) {
    const k = new Kit(), [w, , d] = t.size;
    const hull = new THREE.CylinderGeometry(w / 2, w / 2.6, d, 12, 1, true, 0, Math.PI); hull.rotateZ(Math.PI); hull.rotateX(Math.PI / 2); hull.scale(1, 0.5, 1);
    k.add(hull, std('hull', { map: T.tile(T.planks('#3a2414'), 0.6, 2), side: THREE.DoubleSide, roughness: 0.75 }), t.x, 0.65, t.z);
    for (const dz of [-1.5, 0, 1.5]) k.box(w * 0.9, 0.06, 0.3, MAT.wood(), t.x, 0.55, t.z + dz);
    // 船尾（南邊，玩家一開始背對的那一頭）的燈籠；整個碼頭只有這盞燈和城門的火把會照亮四周
    const lz = t.z + d / 2 - 0.5;
    k.cyl(0.03, 0.03, 1.4, MAT.iron(), t.x, 1.2, lz, 6);
    k.box(0.2, 0.26, 0.2, MAT.iron(), t.x, 1.95, lz); k.box(0.13, 0.18, 0.13, MAT.flame(), t.x, 1.95, lz);
    k.build(group); hideBox(mesh);
    const lantern = new THREE.PointLight('#ffb060', 8, 12, 1.5); lantern.position.set(t.x, 1.95, lz); group.add(lantern); // 不投影
  },
  mirror(t, mesh, group) {
    const k = new Kit(), [w, h, d] = t.size;
    k.box(w * 0.8, h * 0.85, 0.04, MAT.mirror(), t.x, h * 0.5, t.z + d / 2 - 0.02);
    for (const s of [-1, 1]) k.box(0.18, h, d, MAT.brass(), t.x + s * w * 0.45, h / 2, t.z);
    k.box(w, 0.2, d, MAT.brass(), t.x, h - 0.1, t.z); k.box(w, 0.2, d, MAT.brass(), t.x, 0.1, t.z);
    k.add(new THREE.TorusGeometry(w * 0.32, 0.06, 6, 24, Math.PI), MAT.brass(), t.x, h, t.z);
    k.build(group, { shadow: true }); hideBox(mesh);
  },
  podium(t, mesh, group) {
    const k = new Kit(), [w, h, d] = t.size;
    k.box(w * 3.5, 0.08, d * 1.4, MAT.wood(), t.x, 0.4 + 0.76, t.z); // 長桌
    for (const s of [-1, 1]) k.box(0.12, 0.76, d * 1.2, MAT.darkWood(), t.x + s * w * 1.6, 0.4 + 0.38, t.z);
    k.box(w * 3.5, 0.6, 0.04, MAT.cloth('#3a1a40'), t.x, 0.4 + 0.5, t.z + d * 0.7);
    for (let i = 0; i < 7; i++) { const x = t.x - w * 1.5 + i * w / 2; k.box(0.55, 1.6, 0.1, MAT.darkWood(), x, 0.4 + 0.8, t.z - d * 0.9); k.box(0.55, 0.08, 0.5, MAT.darkWood(), x, 0.4 + 0.5, t.z - d * 0.6); }
    k.build(group, { shadow: true }); hideBox(mesh);
    candles(group, [-1, 0, 1].map((i) => [t.x + i * w, 0.4 + 0.8, t.z]));
  },
  seat(t, mesh, group) {
    const k = new Kit();
    k.box(0.45, 0.06, 0.45, MAT.wood(), t.x, 0.48, t.z); k.box(0.45, 0.6, 0.06, MAT.wood(), t.x, 0.78, t.z + 0.2);
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) k.box(0.05, 0.48, 0.05, MAT.wood(), t.x + dx, 0.24, t.z + dz);
    k.build(group); hideBox(mesh);
  },
  disk(t, mesh, group) { // 星盤：石座＋三層黃銅環
    const k = new Kit(), R = t.size[0] / 2;
    k.cyl(R, R * 1.05, 0.25, MAT.stone(), t.x, 0.125, t.z, 32);
    k.add(new THREE.TorusGeometry(R * 0.92, 0.05, 6, 48), MAT.brass(), t.x, 0.3, t.z, 0, Math.PI / 2);
    k.add(new THREE.TorusGeometry(R * 0.65, 0.04, 6, 48), MAT.brass(), t.x, 0.32, t.z, 0, Math.PI / 2);
    k.add(new THREE.TorusGeometry(R * 0.38, 0.04, 6, 48), MAT.brass(), t.x, 0.34, t.z, 0, Math.PI / 2);
    k.cyl(0.06, 0.12, 1.2, MAT.brass(), t.x, 0.85, t.z, 8);
    k.add(new THREE.TorusGeometry(0.5, 0.02, 6, 32), MAT.brass(), t.x, 1.5, t.z, 0.4, 0.3);
    k.add(new THREE.TorusGeometry(0.5, 0.02, 6, 32), MAT.brass(), t.x, 1.5, t.z, -0.6, 1.2);
    k.add(new THREE.SphereGeometry(0.12, 12, 8), glow('orb', '#9fb4ff', 0.8), t.x, 1.5, t.z);
    k.build(group, { shadow: true }); hideBox(mesh);
  },
  north_door(t, mesh, group) { // 往北翼的門：四個學院的徽章
    const k = new Kit(), [w, h] = t.size;
    ['eldrin', 'grimoire', 'belmont', 'ouroboros'].forEach((hh, i) => k.cyl(0.22, 0.22, 0.05, MAT.cloth(HOUSE[hh].banner), t.x - 0.9 + i * 0.6, h * 0.62, t.z + 0.12, 16));
    k.add(new THREE.TorusGeometry(w * 0.5, 0.12, 6, 24, Math.PI), MAT.stone(), t.x, h - 0.2, t.z + 0.05);
    k.build(group); hideBox(mesh);
  },
  scale(t, mesh, group) { // 貝爾蒙特的大秤
    const k = new Kit(), [w, h] = t.size;
    k.box(w * 0.5, 0.12, 0.5, MAT.darkWood(), t.x, 0.06, t.z); k.cyl(0.05, 0.07, h, MAT.brass(), t.x, h / 2, t.z, 8);
    k.box(w, 0.05, 0.05, MAT.brass(), t.x, h, t.z);
    for (const s of [-1, 1]) { k.cyl(0.005, 0.005, 0.4, MAT.iron(), t.x + s * w * 0.48, h - 0.2, t.z, 4); k.cyl(0.24, 0.18, 0.05, MAT.brass(), t.x + s * w * 0.48, h - 0.42, t.z, 16); }
    k.build(group, { shadow: true }); hideBox(mesh);
  },
  huntlog(t, mesh, group) { // 狩獵日誌：放在斜面的書架上
    const k = new Kit(), [, h] = t.size;
    k.box(0.12, h * 0.9, 0.12, MAT.darkWood(), t.x, h * 0.45, t.z); k.box(0.5, 0.04, 0.4, MAT.darkWood(), t.x, h * 0.92, t.z);
    k.add(new THREE.BoxGeometry(0.45, 0.04, 0.32), MAT.parchment(), t.x, h * 0.95, t.z, 0, -0.35);
    k.build(group); hideBox(mesh);
  },
  hourglass(t, mesh, group) { // 兩個沙漏（沙子不暗示答案：都是一半）
    const k = new Kit(), [w, h, d] = t.size;
    k.box(w, 0.06, d, MAT.darkWood(), t.x, h * 0.6, t.z); for (const s of [-1, 1]) k.box(0.08, h * 0.6, 0.08, MAT.darkWood(), t.x + s * w * 0.42, h * 0.3, t.z);
    const glass = std('hgGlass', { color: '#cfe6ff', transparent: true, opacity: 0.25, roughness: 0.05 }), sand = std('sand', { color: '#c8a868' });
    for (const s of [-1, 1]) {
      const x = t.x + s * w * 0.24, y0 = h * 0.6 + 0.03;
      k.cyl(0.12, 0.12, 0.03, MAT.brass(), x, y0 + 0.015, t.z, 12); k.cyl(0.12, 0.12, 0.03, MAT.brass(), x, y0 + 0.45, t.z, 12);
      k.cyl(0.1, 0.02, 0.21, glass, x, y0 + 0.33, t.z, 12); k.cyl(0.02, 0.1, 0.21, glass, x, y0 + 0.13, t.z, 12);
      k.cyl(0.07, 0.02, 0.07, sand, x, y0 + 0.27, t.z, 10); k.cyl(0.04, 0.08, 0.06, sand, x, y0 + 0.06, t.z, 10);
    }
    k.build(group); hideBox(mesh);
  },
  runechart(t, mesh, group) { // 燒焦的符文表：掛在牆上的羊皮紙
    const [, h, d] = t.size, m = new THREE.Mesh(new THREE.PlaneGeometry(d, h), MAT.parchment());
    m.position.set(t.x + 0.12, (t.y ?? 0) + 0.9 + h / 2, t.z); m.rotation.y = -Math.PI / 2 * Math.sign(t.x); group.add(m); hideBox(mesh);
  },
  ceiling_eldrin(t, mesh, group) { // 天花板的星空：一圈像時鐘（從下面看，12 點在北邊）
    const tex = T.drawn('zodiacCeil', (g, s) => {
      const c = s / 2; g.fillStyle = '#101830'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#c8d4ea'; for (let i = 0; i < 300; i++) g.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5);
      g.strokeStyle = '#c8a24a'; g.lineWidth = 4; g.beginPath(); g.arc(c, c, s * 0.46, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(c, c, s * 0.3, 0, Math.PI * 2); g.stroke();
      // 貼圖朝下貼：畫布的下方＝北、右方＝東；字要上下翻，從下面看才是正的
      const R = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      for (let hh = 0; hh < 12; hh++) {
        const a = hh / 12 * Math.PI * 2, x = c + Math.sin(a) * s * 0.38, y = c + Math.cos(a) * s * 0.38;
        // 每格一個小星座（點和線；跟答案無關，只是裝飾）
        g.strokeStyle = 'rgba(200,212,234,0.7)'; g.lineWidth = 1.5; g.beginPath();
        for (let j = 0; j < 4; j++) { const px = x + Math.sin(hh * 7 + j * 2.1) * 14, py = y + Math.cos(hh * 5 + j * 1.7) * 14; j ? g.lineTo(px, py) : g.moveTo(px, py); g.fillRect(px - 2, py - 2, 4, 4); }
        g.stroke();
        g.save(); g.translate(c + Math.sin(a) * s * 0.44 * 0.93, c + Math.cos(a) * s * 0.44 * 0.93); g.scale(1, -1);
        g.fillStyle = '#d8c48a'; g.font = 'bold 18px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(R[hh], 0, 0); g.restore();
      }
    });
    const m = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), std('zodiacCeil', { map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 }));
    m.rotation.x = Math.PI / 2; m.position.set(t.x, (t.y ?? 5.9) + 0.07, t.z); group.add(m); hideBox(mesh);
  },
};
const KIND = {
  rumor(t, mesh, group) { // 典禮廳的長桌：桌面、桌腳、兩邊長椅、盤子、燭台
    const k = new Kit(), [w, , d] = t.size;
    const n = Math.max(1, Math.floor(d / 5.6)), seg = d / n; // 製作人給的長桌模型：一段一段接起來
    let model = true; for (let i = 0; i < n && model; i++) model = !!placeProp(group, 'table', t.x, 0, t.z - d / 2 + seg * (i + 0.5), Math.PI / 2, [seg, 0.78, w + 0.1]);
    if (!model) {
      k.box(w, 0.08, d, MAT.wood(), t.x, 0.76, t.z);
      for (let z = -d / 2 + 1; z <= d / 2 - 1; z += 3) for (const s of [-1, 1]) k.box(0.1, 0.72, 0.1, MAT.darkWood(), t.x + s * (w / 2 - 0.15), 0.36, t.z + z);
    }
    for (const s of [-1, 1]) { k.box(0.35, 0.06, d, MAT.darkWood(), t.x + s * (w / 2 + 0.45), 0.45, t.z); for (let z = -d / 2 + 1; z <= d / 2 - 1; z += 4) k.box(0.3, 0.45, 0.08, MAT.darkWood(), t.x + s * (w / 2 + 0.45), 0.22, t.z + z); }
    for (let z = -d / 2 + 0.8; z <= d / 2 - 0.8; z += 1.2) for (const s of [-1, 1]) k.cyl(0.13, 0.11, 0.02, MAT.pale(), t.x + s * (w / 2 - 0.3), 0.81, t.z + z, 12);
    // 盤子上的食物、高腳杯、水壺
    for (let z = -d / 2 + 0.8, i = 0; z <= d / 2 - 0.8; z += 1.2, i++) for (const sd of [-1, 1]) {
      const x = t.x + sd * (w / 2 - 0.3); P.plateFood(k, x, 0.81, t.z + z, i * 2 + sd + t.x); P.goblet(k, x - sd * 0.22, 0.8, t.z + z + 0.2);
    }
    for (let z = -d / 2 + 4; z <= d / 2 - 4; z += 4) { P.pitcher(k, t.x + 0.15, 0.8, t.z + z); P.bread(k, t.x - 0.15, 0.8, t.z + z + 0.6); }
    k.build(group); hideBox(mesh);
    const c = []; for (let z = -d / 2 + 2; z <= d / 2 - 2; z += 4) c.push([t.x, 0.8, t.z + z]); candles(group, c, { h: 0.25 });
  },
  pillar(t, mesh, group) {
    const k = new Kit(), [w, h] = t.size;
    k.cyl(w * 0.38, w * 0.42, h - 1, MAT.stone(), t.x, (h - 1) / 2 + 0.5, t.z, 16);
    k.box(w, 0.5, w, MAT.stone(), t.x, 0.25, t.z); k.box(w * 1.1, 0.5, w * 1.1, MAT.stone(), t.x, h - 0.25, t.z);
    k.build(group, { shadow: true }); hideBox(mesh);
  },
  hide(t, mesh, group) { // 躲藏點：依房間換樣子（星盤廳是厚窗簾）
    if (HIDE[t.id]) return HIDE[t.id](t, mesh, group);
    return curtain(t, mesh, group);
  },
  curtainUnused(t, mesh, group) {
    const [w, h, d] = t.size, k = new Kit(), mat = MAT.velvet('#3a0e14'), n = 9;
    const along = d >= w, len = along ? d : w;
    for (let i = 0; i < n; i++) {
      const off = -len / 2 + (i + 0.5) * len / n, wob = (i % 2 ? 0.08 : -0.08);
      if (along) k.box(0.08, h, len / n + 0.05, mat, t.x + wob, h / 2, t.z + off); else k.box(len / n + 0.05, h, 0.08, mat, t.x + off, h / 2, t.z + wob);
    }
    if (along) k.box(0.1, 0.1, len + 0.4, MAT.brass(), t.x, h + 0.05, t.z); else k.box(len + 0.4, 0.1, 0.1, MAT.brass(), t.x, h + 0.05, t.z);
    k.build(group); hideBox(mesh);
  },
  puzzle(t, mesh, group) {
    if (t.puzzle === 'P07') { // 宿舍的窗戶：窗框＋夜空
      const [, h, d] = t.size, k = new Kit(), s = t.x > 0 ? -1 : 1, y = (t.y ?? 0) + h / 2;
      k.box(0.05, h, d, MAT.glass(), t.x - s * 0.02, y, t.z);
      for (const dz of [-d / 2, 0, d / 2]) k.box(0.12, h, 0.08, MAT.darkWood(), t.x + s * 0.03, y, t.z + dz);
      for (const dy of [-h / 2, 0, h / 2]) k.box(0.12, 0.08, d, MAT.darkWood(), t.x + s * 0.03, y + dy, t.z);
      k.box(0.3, 0.06, d + 0.2, MAT.darkWood(), t.x + s * 0.12, y - h / 2 - 0.03, t.z);
      k.build(group); hideBox(mesh); return true;
    }
    if (/^lock_/.test(t.id)) { // 宿舍門上的鎖：一塊黃銅（星座）或石板（符文）面板
      const [w, h, d] = t.size, s = t.x > 0 ? 1 : -1, k = new Kit(), y = h * 0.55;
      if (t.house === 'eldrin') { // 圓形的黃銅星座盤（立在門上，面向房間）
        k.add(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 24), MAT.brass(), t.x + s * 0.02, y, t.z, 0, 0, Math.PI / 2);
        k.add(new THREE.TorusGeometry(0.26, 0.02, 6, 24), MAT.iron(), t.x + s * 0.05, y, t.z, Math.PI / 2);
      } else k.box(0.06, 0.6, 0.45, MAT.stone(), t.x + s * 0.02, y, t.z);
      k.build(group);
      hideBox(mesh); return true;
    }
    return false;
  },
};

decorators.thing.push(safe(({ thing: t, mesh, group }) => {
  if (t.hidden) return;
  if (REPLACE.has(`${t.puzzle}:${t.id}`)) return hideBox(mesh);
  if (t.kind === 'hide' || t.kind === 'pillar') return KIND[t.kind](t, mesh, group);
  const inLib = /^lib_/.test(t.room), inA4 = /^a4_/.test(t.room);
  if (inLib && (ACT3[t.id] || ACT3[t.kind])) return (ACT3[t.id] || ACT3[t.kind])(t, mesh, group);
  if (inA4 && ACT4[t.id]) return ACT4[t.id](t, mesh, group);
  if (THING[t.id]) return THING[t.id](t, mesh, group);
  KIND[t.kind]?.(t, mesh, group);
}));
