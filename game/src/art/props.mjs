// 小裝飾、小細節（帳號二）：茶杯、書堆、墨水瓶、藥水瓶、地球儀、箱子、木桶、蜘蛛網……
// 每個函式把形狀加進 scene.mjs 的 Kit（同材質合成一個物件，手機才畫得動）；只是外觀，不擋路、不能調查。
// 用法：P.teacup(k, x, y, z)。y＝放在多高（桌面、地板）。ry＝面向。
import * as THREE from 'three';

let M = null; // scene.mjs 給的材質：{ MAT, std, glow }
export const setMaterials = (m) => { M = m; };

// 固定的「亂數」：同一個位置每次都一樣（大家看到的房間一樣）
export const rnd = (a, b = 0, c = 0) => { const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return v - Math.floor(v); };
const BOOK_COLORS = ['#5a1a1a', '#1a3a2a', '#2a2a4a', '#4a3a1a', '#3a2a2a', '#6a5a3a', '#2a1a2a'];
const rot = (ry, dx, dz) => [dx * Math.cos(ry) + dz * Math.sin(ry), -dx * Math.sin(ry) + dz * Math.cos(ry)];

// ---------- 桌上的小東西 ----------
export function teacup(k, x, y, z) {
  k.cyl(0.06, 0.06, 0.008, M.MAT.pale(), x, y + 0.004, z, 12); // 碟子
  k.cyl(0.04, 0.03, 0.05, M.MAT.pale(), x, y + 0.033, z, 10);
  k.add(new THREE.TorusGeometry(0.015, 0.004, 4, 8), M.MAT.pale(), x + 0.045, y + 0.035, z);
  k.cyl(0.035, 0.035, 0.002, M.std('tea', { color: '#3a1e0c', roughness: 0.2 }), x, y + 0.055, z, 10);
}
export function teapot(k, x, y, z) {
  const p = M.std('porcelain', { color: '#e8e2d8', roughness: 0.35 });
  k.add(new THREE.SphereGeometry(0.08, 12, 8), p, x, y + 0.08, z);
  k.cyl(0.03, 0.03, 0.02, p, x, y + 0.16, z, 8);
  k.add(new THREE.CylinderGeometry(0.008, 0.015, 0.1, 6), p, x + 0.09, y + 0.1, z, 0, 0, -0.9);
  k.add(new THREE.TorusGeometry(0.04, 0.008, 4, 10, Math.PI), p, x - 0.08, y + 0.09, z, 0, 0, Math.PI / 2);
}
export function bookStack(k, x, y, z, n = 3, seed = 0) {
  let h = y;
  for (let i = 0; i < n; i++) {
    const w = 0.16 + rnd(seed, i) * 0.06, d = 0.22 + rnd(i, seed) * 0.06, t = 0.03 + rnd(seed, i, 1) * 0.025;
    k.add(new THREE.BoxGeometry(w, t, d), M.MAT.cloth(BOOK_COLORS[Math.floor(rnd(seed, i, 2) * BOOK_COLORS.length)]), x, h + t / 2, z, (rnd(i, seed, 3) - 0.5) * 0.6);
    h += t;
  }
  return h;
}
export function openBook(k, x, y, z, ry = 0) {
  const [ax, az] = rot(ry, 0.09, 0);
  k.add(new THREE.BoxGeometry(0.17, 0.015, 0.23), M.MAT.cloth('#3a1a12'), x, y + 0.008, z, ry);
  k.add(new THREE.BoxGeometry(0.15, 0.02, 0.21), M.MAT.parchment(), x + ax * 0.45, y + 0.02, z + az * 0.45, ry, 0, -0.08);
  k.add(new THREE.BoxGeometry(0.15, 0.02, 0.21), M.MAT.parchment(), x - ax * 0.45, y + 0.02, z - az * 0.45, ry, 0, 0.08);
}
export function inkQuill(k, x, y, z) {
  k.cyl(0.025, 0.03, 0.05, M.std('inkglass', { color: '#101418', roughness: 0.1, metalness: 0.3 }), x, y + 0.025, z, 8);
  k.add(new THREE.ConeGeometry(0.012, 0.28, 4), M.std('feather', { color: '#e8e4dc', roughness: 0.8 }), x + 0.03, y + 0.16, z, 0, 0.3, -0.35);
}
export function scroll(k, x, y, z, ry = 0) {
  k.add(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), M.MAT.parchment(), x, y + 0.025, z, ry, 0, Math.PI / 2);
  k.add(new THREE.BoxGeometry(0.012, 0.055, 0.012), M.MAT.cloth('#7a1a1a'), x, y + 0.025, z, ry);
}
export function bottles(k, x, y, z, seed = 0, n = 4) { // 藥水瓶：一點點發光，暗處看得到
  const colors = ['#4cff9a', '#a04cff', '#ff4c6a', '#4cc8ff', '#ffd24c'];
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * 0.09 + (rnd(seed, i) - 0.5) * 0.03, dz = (rnd(i, seed) - 0.5) * 0.08, h = 0.1 + rnd(seed, i, 1) * 0.1, c = colors[Math.floor(rnd(seed, i, 2) * colors.length)];
    k.cyl(0.03, 0.035, h, M.std('potion' + c, { color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.15, transparent: true, opacity: 0.85 }), x + dx, y + h / 2, z + dz, 8);
    k.cyl(0.012, 0.012, 0.04, M.std('cork', { color: '#8a6a44' }), x + dx, y + h + 0.02, z + dz, 6);
  }
}
export function goblet(k, x, y, z) {
  k.cyl(0.035, 0.035, 0.006, M.MAT.brass(), x, y + 0.003, z, 10);
  k.cyl(0.006, 0.006, 0.08, M.MAT.brass(), x, y + 0.045, z, 6);
  k.cyl(0.04, 0.02, 0.07, M.MAT.brass(), x, y + 0.12, z, 10);
}
export function candleStick(k, x, y, z, flames) { // 黃銅燭台；flames：蠟燭的位置收集起來，最後一次畫
  k.cyl(0.05, 0.06, 0.015, M.MAT.brass(), x, y + 0.008, z, 10);
  k.cyl(0.01, 0.014, 0.12, M.MAT.brass(), x, y + 0.07, z, 6);
  k.cyl(0.03, 0.02, 0.02, M.MAT.brass(), x, y + 0.14, z, 8);
  flames?.push([x, y + 0.15, z]);
}
export function crystalBall(k, x, y, z) {
  k.cyl(0.05, 0.07, 0.05, M.MAT.brass(), x, y + 0.025, z, 10);
  k.add(new THREE.SphereGeometry(0.08, 14, 10), M.std('crystal', { color: '#b8a0ff', emissive: '#4a3a8a', emissiveIntensity: 0.6, roughness: 0.05, transparent: true, opacity: 0.8 }), x, y + 0.13, z);
}
export function skull(k, x, y, z, ry = 0) {
  const b = M.std('bone', { color: '#d6cbb0', roughness: 0.7 }), d = M.std('socket', { color: '#120c08' });
  k.add(new THREE.SphereGeometry(0.075, 12, 9), b, x, y + 0.08, z);
  const [fx, fz] = rot(ry, 0, 0.055);
  k.add(new THREE.BoxGeometry(0.08, 0.05, 0.07), b, x + fx * 0.5, y + 0.035, z + fz * 0.5, ry);
  for (const s of [-1, 1]) { const [ex, ez] = rot(ry, s * 0.028, 0.065); k.add(new THREE.SphereGeometry(0.018, 6, 5), d, x + ex, y + 0.085, z + ez); }
}
export function globe(k, x, y, z) {
  k.cyl(0.08, 0.1, 0.03, M.MAT.darkWood(), x, y + 0.015, z, 10);
  k.cyl(0.01, 0.01, 0.1, M.MAT.brass(), x, y + 0.08, z, 6);
  k.add(new THREE.SphereGeometry(0.12, 14, 10), M.std('globe', { color: '#3a5a6a', roughness: 0.6 }), x, y + 0.24, z);
  k.add(new THREE.TorusGeometry(0.135, 0.006, 4, 24), M.MAT.brass(), x, y + 0.24, z, 0, 0, 0.4);
}
export function apple(k, x, y, z, c = '#8a1a14') { k.add(new THREE.SphereGeometry(0.035, 8, 6), M.std('fruit' + c, { color: c, roughness: 0.4 }), x, y + 0.035, z); }
export function bread(k, x, y, z) { k.add(new THREE.SphereGeometry(0.07, 10, 6), M.std('bread', { color: '#a8743a', roughness: 0.9 }), x, y + 0.03, z, 0, 0, 0); }
export function plateFood(k, x, y, z, seed = 0) {
  k.cyl(0.12, 0.1, 0.015, M.MAT.pale(), x, y + 0.008, z, 14);
  const r = rnd(seed, 3);
  if (r < 0.4) { bread(k, x, y + 0.015, z); } else if (r < 0.75) { apple(k, x - 0.03, y + 0.015, z); apple(k, x + 0.04, y + 0.015, z + 0.02, '#6a8a2a'); }
  else k.add(new THREE.BoxGeometry(0.1, 0.04, 0.07), M.std('meat', { color: '#6a2a14', roughness: 0.6 }), x, y + 0.035, z);
}
export function pitcher(k, x, y, z) {
  const p = M.MAT.iron();
  k.cyl(0.06, 0.07, 0.2, p, x, y + 0.1, z, 12);
  k.add(new THREE.TorusGeometry(0.05, 0.01, 4, 10, Math.PI), p, x - 0.07, y + 0.12, z, 0, 0, Math.PI / 2);
}

// ---------- 家具與擺在地上的東西 ----------
export function roundTable(k, x, z, r = 0.35, h = 0.6) { // 回傳桌面高度
  k.cyl(r, r, 0.04, M.MAT.wood(), x, h - 0.02, z, 16);
  k.cyl(0.04, 0.05, h - 0.04, M.MAT.darkWood(), x, (h - 0.04) / 2, z, 8);
  k.cyl(0.2, 0.22, 0.03, M.MAT.darkWood(), x, 0.015, z, 12);
  return h;
}
export function desk(k, x, z, ry = 0, w = 1.3) { // 書桌＋椅子（椅子在桌子前面）；回傳桌面高度
  const P = (bw, bh, bd, mat, dx, y, dz) => { const [ox, oz] = rot(ry, dx, dz); k.add(new THREE.BoxGeometry(bw, bh, bd), mat, x + ox, y, z + oz, ry); };
  P(w, 0.05, 0.65, M.MAT.wood(), 0, 0.75, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P(0.06, 0.73, 0.06, M.MAT.darkWood(), sx * (w / 2 - 0.06), 0.365, sz * 0.26);
  P(0.4, 0.2, 0.5, M.MAT.darkWood(), w / 2 - 0.25, 0.62, 0); // 抽屜
  P(0.42, 0.04, 0.42, M.MAT.darkWood(), 0, 0.46, 0.55); P(0.42, 0.5, 0.04, M.MAT.darkWood(), 0, 0.73, 0.75); // 椅子
  for (const sx of [-1, 1]) for (const sz of [0.37, 0.73]) P(0.04, 0.46, 0.04, M.MAT.darkWood(), sx * 0.18, 0.23, sz);
  return 0.775;
}
export function chest(k, x, z, ry = 0, color = '#4a2c18') { // 木箱（金屬包角）
  const P = (bw, bh, bd, mat, dx, y, dz) => { const [ox, oz] = rot(ry, dx, dz); k.add(new THREE.BoxGeometry(bw, bh, bd), mat, x + ox, y, z + oz, ry); };
  P(0.8, 0.45, 0.48, M.std('chest' + color, { map: M.MAT.wood().map, color }), 0, 0.225, 0);
  P(0.82, 0.12, 0.5, M.std('chest' + color, { map: M.MAT.wood().map, color }), 0, 0.5, 0);
  for (const sx of [-0.3, 0.3]) P(0.05, 0.6, 0.52, M.MAT.iron(), sx, 0.28, 0);
  P(0.08, 0.1, 0.03, M.MAT.brass(), 0, 0.42, 0.26);
}
export function crate(k, x, z, s = 0.6, y = 0, ry = 0) {
  k.add(new THREE.BoxGeometry(s, s, s), M.std('crate', { map: M.MAT.wood().map, color: '#b89a70' }), x, y + s / 2, z, ry);
  for (const dy of [-0.4, 0.4]) k.add(new THREE.BoxGeometry(s + 0.02, s * 0.1, s + 0.02), M.MAT.darkWood(), x, y + s / 2 + dy * s, z, ry);
}
export function barrel(k, x, z, y = 0) {
  k.add(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 14), M.std('barrel', { map: M.MAT.wood().map, color: '#9a7a5a' }), x, y + 0.4, z);
  k.add(new THREE.CylinderGeometry(0.33, 0.33, 0.6, 14), M.std('barrel', { map: M.MAT.wood().map, color: '#9a7a5a' }), x, y + 0.4, z);
  for (const dy of [0.12, 0.68]) k.add(new THREE.TorusGeometry(0.315, 0.012, 4, 20), M.MAT.iron(), x, y + dy, z, 0, Math.PI / 2);
}
export function trunk(k, x, z, ry = 0, color = '#5a2a1a') { chest(k, x, z, ry, color); } // 新生的行李箱
export function ropeCoil(k, x, z) { for (let i = 0; i < 4; i++) k.add(new THREE.TorusGeometry(0.22 - i * 0.03, 0.025, 5, 16), M.std('rope', { color: '#8a7450', roughness: 1 }), x, 0.03 + i * 0.045, z, 0, Math.PI / 2); }
export function urn(k, x, z) {
  k.cyl(0.2, 0.25, 0.1, M.MAT.stone(), x, 0.05, z, 10);
  k.add(new THREE.SphereGeometry(0.3, 12, 9), M.MAT.stone(), x, 0.45, z);
  k.cyl(0.18, 0.12, 0.25, M.MAT.stone(), x, 0.82, z, 10);
}
export function bench(k, x, z, ry = 0, w = 2) {
  const P = (bw, bh, bd, mat, dx, y, dz) => { const [ox, oz] = rot(ry, dx, dz); k.add(new THREE.BoxGeometry(bw, bh, bd), mat, x + ox, y, z + oz, ry); };
  P(w, 0.08, 0.45, M.MAT.stone(), 0, 0.45, 0); for (const sx of [-1, 1]) P(0.2, 0.41, 0.4, M.MAT.stone(), sx * (w / 2 - 0.2), 0.205, 0);
}
export function telescope(k, x, z, ry = 0) {
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.add(new THREE.CylinderGeometry(0.015, 0.015, 1.25, 5), M.MAT.darkWood(), x + Math.cos(a) * 0.22, 0.6, z + Math.sin(a) * 0.22, 0, Math.sin(a) * 0.18, -Math.cos(a) * 0.18); }
  const [dx, dz] = rot(ry, 0, 0.3);
  k.add(new THREE.CylinderGeometry(0.05, 0.08, 1.1, 10), M.MAT.brass(), x + dx * 0.2, 1.35, z + dz * 0.2, ry, 0.9, 0);
}
export function coatRack(k, x, z, colors) {
  k.cyl(0.025, 0.03, 1.8, M.MAT.darkWood(), x, 0.9, z, 8); k.cyl(0.2, 0.22, 0.04, M.MAT.darkWood(), x, 0.02, z, 10);
  colors.forEach((c, i) => { const a = i * 2.1; k.add(new THREE.BoxGeometry(0.08, 0.7, 0.02), M.MAT.velvet(c), x + Math.cos(a) * 0.08, 1.4, z + Math.sin(a) * 0.08, a); }); // 掛著的圍巾
}
export function broom(k, x, z, lean = 0.2) {
  k.add(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 6), M.MAT.darkWood(), x, 0.75, z, 0, 0, lean);
  k.add(new THREE.ConeGeometry(0.1, 0.3, 8), M.std('straw', { color: '#a88a50', roughness: 1 }), x + Math.sin(lean) * 0.6, 0.12, z, 0, 0, Math.PI + lean);
}
export function cauldron(k, x, z) {
  k.add(new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), M.std('cauldron', { color: '#1a1a1c', metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }), x, 0.42, z);
  k.cyl(0.26, 0.26, 0.02, M.glow('brew', '#4cff7a', 0.5), x, 0.6, z, 16);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.cyl(0.03, 0.03, 0.2, M.MAT.iron(), x + Math.cos(a) * 0.22, 0.1, z + Math.sin(a) * 0.22, 6); }
}
export function antlers(k, x, y, z, ry) { // 牆上的鹿角獎盃（貝爾蒙特）
  const [fx, fz] = rot(ry, 0, 0.05), b = M.std('antler', { color: '#c8b896', roughness: 0.7 });
  k.add(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 6), M.MAT.darkWood(), x, y, z, ry, Math.PI / 2);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const [ox, oz] = rot(ry, s * (0.08 + i * 0.07), 0.08); k.add(new THREE.CylinderGeometry(0.012, 0.02, 0.3 - i * 0.05, 5), b, x + ox + fx, y + 0.12 + i * 0.08, z + oz + fz, ry, 0, -s * (0.5 + i * 0.25)); }
}
export function crossedSwords(k, x, y, z, ry) {
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.04, 0.9, 0.01), M.std('blade', { color: '#c8ccd0', metalness: 0.9, roughness: 0.25 }), x, y, z, ry, 0, s * 0.6);
  k.add(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), M.MAT.cloth('#5a1a14'), x, y - 0.05, z, ry, Math.PI / 2);
}
export function serpent(k, x, y, z) { // 銜尾蛇的小雕像（烏洛波斯）
  k.add(new THREE.TorusGeometry(0.12, 0.03, 6, 20, Math.PI * 1.9), M.std('serpent', { color: '#3a6a4a', metalness: 0.5, roughness: 0.35 }), x, y + 0.16, z);
  k.cyl(0.07, 0.08, 0.04, M.MAT.stone(), x, y + 0.02, z, 10);
}
export function runeStones(k, x, y, z, seed = 0) { // 刻了符文的小石頭（格里莫瓦）
  for (let i = 0; i < 5; i++) k.add(new THREE.BoxGeometry(0.05, 0.025, 0.04), M.std('runestone', { color: '#6a6458', emissive: '#a03030', emissiveIntensity: 0.25 }), x + (rnd(seed, i) - 0.5) * 0.25, y + 0.013, z + (rnd(i, seed) - 0.5) * 0.18, rnd(i, i) * 3);
}
export function wallFrame(k, x, y, z, ry, w = 0.5, h = 0.65, tex = null) { // 牆上的小畫框（不放在長廊：長廊的畫像是找異常用的）
  const [fx, fz] = rot(ry, 0, 0.025);
  k.add(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.04), M.MAT.brass(), x, y, z, ry);
  k.add(new THREE.PlaneGeometry(w, h), tex ?? M.std('canvasDark', { color: '#2a2418' }), x + fx, y, z + fz, ry);
}
export function starChart(k, x, y, z, ry) { // 掛在牆上的星圖（羊皮紙）
  const [fx, fz] = rot(ry, 0, 0.01);
  k.add(new THREE.PlaneGeometry(0.9, 1.1), M.MAT.parchment(), x + fx, y, z + fz, ry);
  for (const dy of [-0.57, 0.57]) k.add(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), M.MAT.darkWood(), x + fx * 2, y + dy, z + fz * 2, ry, 0, Math.PI / 2);
}
export function cobweb(k, x, y, z, ry, s = 0.6) { // 天花板角落的蜘蛛網（三角形的半透明面）
  // 一片斜斜跨過牆角的三角形（角落在原點，牆往 +x、+z，天花板在上面）
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([s, 0, 0, 0, -s * 0.8, 0, 0, 0, s, s * 0.35, -s * 0.25, s * 0.35, s, 0, 0, 0, 0, s], 3)); g.computeVertexNormals();
  k.add(g, M.std('cobweb', { color: '#c8c8c8', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }), x, y, z, ry);
}
