// 房間的擺設加強（帳號二，2026-10-22 製作人：「場景都幫我做好一點」「全部都可以多一點東西」）
// 每個房間沿著牆走一圈：避開門、謎題物件、原本就有的擺設，依房間的種類擺上家具（衣櫃、邊櫃、落地鐘、盔甲、雕像、盆栽、書架…）
// 和牆上的東西（畫像、燭台、掛毯、窗戶、鐵鍊、管線…）；再加上整個房間的東西（漂浮的蠟燭、吊燈、天花板木樑）。
// 全部只是外觀：不擋路、不能調查。同一種材質合成一個物件（Kit），蠟燭用 InstancedMesh，手機才畫得動。
// 用法：scene.mjs 在每個房間原本的擺設之後呼叫 dressRoom(room, group, lib)
import * as THREE from 'three';
import { DOORS, THINGS } from '../data/world-ch1.mjs';
import * as T from './textures.mjs';
import { placeProp, variant } from './models.mjs';

let G = null; // 這個房間的擺設放在哪
// 有製作人給的模型就用模型：(x, z)＝靠牆那一點，往前 D/2 擺在中間；回傳 true＝擺好了
const prop = (name, x, z, ry, w, h, d, y = 0) => placeProp(G, name, x + Math.sin(ry) * d / 2, y, z + Math.cos(ry) * d / 2, ry, [w, h, d]);
let L = null; // scene.mjs 給的工具：{ Kit, MAT, std, glow, candles, bookshelf, armchair, banner, P }
const rnd = (a, b = 0) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

// ---------- 畫像、風景畫（程式畫的，幾種輪流用） ----------
const PAINT = [
  ['#1a1410', '#6a5a48', 'portrait'], ['#141a1e', '#5a6a70', 'portrait'], ['#1e1012', '#7a5a50', 'portrait'],
  ['#0e1420', '#30405a', 'moon'], ['#16120c', '#4a3a24', 'still'], ['#121612', '#3a4a34', 'forest'], ['#1a0e10', '#5a2a24', 'lady'],
];
function paintingTex(i) {
  const [bg, fg, kind] = PAINT[i % PAINT.length];
  return T.drawn('paint' + i, (g, s) => {
    const gr = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.75); gr.addColorStop(0, fg); gr.addColorStop(1, bg); g.fillStyle = gr; g.fillRect(0, 0, s, s);
    g.globalAlpha = 0.9;
    if (kind === 'portrait' || kind === 'lady') { // 半身像：黑衣、蒼白的臉、看著你
      g.fillStyle = '#0a0808'; g.beginPath(); g.ellipse(s * 0.5, s * 0.98, s * 0.36, s * 0.38, 0, Math.PI, 0); g.fill();
      if (kind === 'lady') { g.fillStyle = '#1a0c0a'; g.beginPath(); g.ellipse(s * 0.5, s * 0.36, s * 0.17, s * 0.22, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#c8b49a'; g.beginPath(); g.ellipse(s * 0.5, s * 0.4, s * 0.11, s * 0.15, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(40,20,10,0.6)'; g.beginPath(); g.ellipse(s * 0.5, s * 0.47, s * 0.1, s * 0.07, 0, 0, Math.PI); g.fill();
      g.fillStyle = '#1a1210'; for (const dx of [-0.04, 0.04]) { g.beginPath(); g.ellipse(s * (0.5 + dx), s * 0.38, s * 0.014, s * 0.009, 0, 0, Math.PI * 2); g.fill(); }
      if (kind === 'portrait') { g.fillStyle = '#2a1a10'; g.beginPath(); g.ellipse(s * 0.5, s * 0.28, s * 0.12, s * 0.06, 0, Math.PI, 0); g.fill(); }
      g.fillStyle = '#d8c8a0'; g.fillRect(s * 0.44, s * 0.6, s * 0.12, s * 0.04); // 白領子
    } else if (kind === 'moon') { // 月夜下的城堡
      g.fillStyle = '#dfe6ff'; g.beginPath(); g.arc(s * 0.7, s * 0.25, s * 0.08, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#05070c'; for (const [x, w, h] of [[0.2, 0.12, 0.5], [0.35, 0.18, 0.35], [0.55, 0.1, 0.6], [0.7, 0.2, 0.3]]) { g.fillRect(s * x, s * (1 - h), s * w, s * h); g.beginPath(); g.moveTo(s * x, s * (1 - h)); g.lineTo(s * (x + w / 2), s * (1 - h - 0.1)); g.lineTo(s * (x + w), s * (1 - h)); g.fill(); }
      g.fillStyle = '#ffcf8a'; g.fillRect(s * 0.58, s * 0.55, s * 0.02, s * 0.03);
    } else if (kind === 'forest') { // 黑森林
      g.fillStyle = '#060806'; for (let k = 0; k < 9; k++) { const x = (k / 9) * s + rnd(k, i) * 30, h = s * (0.4 + rnd(k) * 0.4); g.beginPath(); g.moveTo(x - s * 0.06, s); g.lineTo(x, s - h); g.lineTo(x + s * 0.06, s); g.fill(); }
    } else { // 靜物：燭台、頭骨、書
      g.fillStyle = '#d8ccb0'; g.beginPath(); g.ellipse(s * 0.4, s * 0.68, s * 0.09, s * 0.08, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0a0806'; for (const dx of [-0.03, 0.03]) { g.beginPath(); g.arc(s * (0.4 + dx), s * 0.67, s * 0.018, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#3a1a10'; g.fillRect(s * 0.52, s * 0.7, s * 0.25, s * 0.06); g.fillStyle = '#e8d8b0'; g.fillRect(s * 0.66, s * 0.42, s * 0.03, s * 0.28);
      g.fillStyle = '#ffcf6a'; g.beginPath(); g.ellipse(s * 0.675, s * 0.4, s * 0.012, s * 0.03, 0, 0, Math.PI * 2); g.fill();
    }
    // 舊油畫：裂紋與暗角
    g.globalAlpha = 1; const v = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.65)'); g.fillStyle = v; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let k = 0; k < 40; k++) { g.beginPath(); let x = rnd(k, i + 1) * s, y = rnd(i + 2, k) * s; g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (rnd(k, j) - 0.5) * 30; y += (rnd(j, k) - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  }, { size: 256 });
}
const tapestryTex = (c1, c2) => T.drawn('tap' + c1 + c2, (g, s) => {
  g.fillStyle = c1; g.fillRect(0, 0, s, s); g.strokeStyle = c2; g.lineWidth = 6; g.strokeRect(14, 14, s - 28, s - 28); g.lineWidth = 2; g.strokeRect(26, 26, s - 52, s - 52);
  g.fillStyle = c2; g.globalAlpha = 0.85; // 中間的紋章：盾＋星
  g.beginPath(); g.moveTo(s * 0.32, s * 0.3); g.lineTo(s * 0.68, s * 0.3); g.lineTo(s * 0.68, s * 0.55); g.quadraticCurveTo(s * 0.5, s * 0.78, s * 0.32, s * 0.55); g.closePath(); g.fill();
  g.fillStyle = c1; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? s * 0.04 : s * 0.1; g.lineTo(s / 2 + Math.cos(a) * rr, s * 0.46 + Math.sin(a) * rr); } g.fill();
  g.globalAlpha = 0.25; g.fillStyle = '#000'; for (let y = 0; y < s; y += 4) g.fillRect(0, y, s, 1); // 織布的橫紋
}, { size: 256 });

// ---------- 擺東西的工具：x、z＝靠牆那一點，ry＝面向房間；回傳的函式用「自己的座標」（+z＝前面） ----------
function at(k, x, z, ry) {
  const s = Math.sin(ry), c = Math.cos(ry), W = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  return {
    box: (w, h, d, mat, dx, y, dz, r2 = 0) => { const [px, pz] = W(dx, dz); k.box(w, h, d, mat, px, y, pz, ry + r2); },
    cyl: (rt, rb, h, mat, dx, y, dz, seg = 10) => { const [px, pz] = W(dx, dz); k.cyl(rt, rb, h, mat, px, y, pz, seg); },
    add: (geo, mat, dx, y, dz, r2 = 0, rx = 0, rz = 0) => { const [px, pz] = W(dx, dz); k.add(geo, mat, px, y, pz, ry + r2, rx, rz); },
    pt: (dx, y, dz) => { const [px, pz] = W(dx, dz); return [px, y, pz]; },
  };
}

// ---------- 靠牆的家具（深度 D：背貼牆）。每個回傳 { w：佔的寬度 } ----------
const FLOOR = {
  wardrobe(k, x, z, ry, ctx) { // 雕花衣櫃
    if (prop('wardrobe', x, z, ry, 1.25, 2.35, 0.65)) return 1.3;
    const p = at(k, x, z, ry), wd = L.MAT.darkWood(), w2 = L.MAT.wood(), b = L.MAT.brass(), D = 0.6;
    p.box(1.2, 2.1, D, wd, 0, 1.12, D / 2); p.box(1.32, 0.12, D + 0.08, wd, 0, 2.22, D / 2); p.box(1.26, 0.06, D + 0.04, w2, 0, 2.3, D / 2);
    for (const sx of [-0.29, 0.29]) { p.box(0.52, 1.6, 0.03, w2, sx, 1.22, D + 0.01); p.box(0.4, 0.6, 0.02, wd, sx, 1.5, D + 0.03); p.box(0.4, 0.55, 0.02, wd, sx, 0.8, D + 0.03); }
    for (const sx of [-0.05, 0.05]) p.box(0.03, 0.12, 0.04, b, sx, 1.2, D + 0.05);
    p.box(1.16, 0.24, 0.03, w2, 0, 0.22, D + 0.01); for (const sx of [-0.55, 0.55]) p.box(0.1, 0.08, 0.1, wd, sx, 0.04, D - 0.05);
    return 1.3;
  },
  sideboard(k, x, z, ry, ctx, seed) { // 邊櫃：上面擺燭台、書、瓶子、頭骨
    const p = at(k, x, z, ry), wd = L.MAT.darkWood(), w2 = L.MAT.wood(), b = L.MAT.brass(), D = 0.5;
    // 製作人給的邊櫃模型兩款輪流（維多利亞邊櫃：檯面在 62% 高、後面是鏡子；綠色老櫥櫃：檯面在最上面）
    const name = variant('sideboard', seed), m = prop(name, x, z, ry, 1.6, name === 'sideboard' ? 1.45 : 0.95, 0.55);
    let top = 0.91;
    if (m) top = name === 'sideboard' ? 1.45 * 0.6 : 0.95;
    else {
      p.box(1.5, 0.78, D, wd, 0, 0.47, D / 2); p.box(1.6, 0.05, D + 0.06, w2, 0, 0.885, D / 2);
      for (let i = 0; i < 3; i++) { p.box(0.44, 0.2, 0.02, w2, -0.48 + i * 0.48, 0.7, D + 0.01); p.box(0.08, 0.025, 0.03, b, -0.48 + i * 0.48, 0.7, D + 0.03); }
      p.box(1.4, 0.36, 0.02, w2, 0, 0.36, D + 0.01);
      for (const sx of [-0.7, 0.7]) p.box(0.06, 0.08, 0.06, wd, sx, 0.04, D - 0.06);
    }
    const [cx, , cz] = p.pt(-0.45, 0, D / 2 + (m && name === 'sideboard' ? 0.06 : 0));
    const cm = placeProp(G, 'candelabra', cx, top, cz, ry, [0.4, 0.5, 0.3]); // 製作人給的燭台模型：三根蠟燭的頂端點火
    if (cm) { const s = Math.sin(ry), c = Math.cos(ry); for (const [dx, dy] of [[0, 1], [-0.43, 0.8], [0.43, 0.8]]) ctx.flames.push([cx + dx * cm.w * c, top + cm.h * dy + 0.005, cz - dx * cm.w * s]); }
    else candelabra(k, cx, top, cz, ctx.flames);
    const [bx, , bz] = p.pt(0.15, 0, D / 2); if (!placeProp(G, 'books', bx, top, bz, ry + seed, [0.3, 0.25, 0.3])) L.P.bookStack(k, bx, top, bz, 2 + (seed % 3), seed);
    const [ox, , oz] = p.pt(0.55, 0, D / 2 + 0.05);
    // 檯面右邊：頭骨／藥水／巫毒娃娃（製作人給的模型），沒有就用拼的
    if (seed % 3 === 0) { if (!placeProp(G, 'skull', ox, top, oz, ry + 0.3, [0.16, 0.2, 0.2])) L.P.skull(k, ox, top, oz, ry); }
    else if (seed % 3 === 1) { if (!placeProp(G, variant('potions', seed >> 2), ox, top, oz, ry, [0.3, 0.3, 0.2])) L.P.bottles(k, ox, top, oz, seed, 3); }
    else if (!placeProp(G, 'voodoo', ox, top, oz, ry + seed, [0.22, 0.1, 0.22])) L.P.goblet(k, ox, top, oz);
    return 1.7;
  },
  clock(k, x, z, ry, ctx) { // 落地鐘
    if (prop('clock', x, z, ry, 0.6, 2.2, 0.45)) return 0.7;
    const p = at(k, x, z, ry), wd = L.MAT.darkWood(), b = L.MAT.brass(), D = 0.38;
    p.box(0.5, 1.4, D, wd, 0, 0.7, D / 2); p.box(0.56, 0.6, D + 0.04, wd, 0, 1.7, D / 2); p.box(0.6, 0.1, D + 0.08, wd, 0, 2.05, D / 2);
    p.add(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20), L.std('clockFace', { color: '#d8ccb0', roughness: 0.6 }), 0, 1.7, D + 0.03, 0, Math.PI / 2);
    p.box(0.012, 0.15, 0.01, L.std('ink', { color: '#111' }), 0, 1.75, D + 0.045); p.box(0.1, 0.012, 0.01, L.std('ink', { color: '#111' }), 0.04, 1.7, D + 0.045);
    p.box(0.3, 0.8, 0.02, L.MAT.glass(), 0, 0.85, D + 0.01); p.box(0.01, 0.5, 0.01, b, 0, 0.95, D - 0.02); p.add(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 14), b, 0, 0.66, D - 0.02, 0, Math.PI / 2);
    return 0.7;
  },
  armor(k, x, z, ry) { // 盔甲：底座、腿、胸甲、肩甲、頭盔、長戟
    if (prop('armor', x, z, ry, 0.85, 2.2, 0.6)) return 0.9;
    const p = at(k, x, z, ry), st = L.MAT.stone(), steel = L.std('steel', { color: '#8a8c92', metalness: 0.9, roughness: 0.3 }), D = 0.6;
    p.box(0.7, 0.2, 0.6, st, 0, 0.1, D / 2);
    for (const sx of [-0.1, 0.1]) { p.cyl(0.07, 0.06, 0.8, steel, sx, 0.6, D / 2); p.box(0.12, 0.06, 0.2, steel, sx, 0.23, D / 2 + 0.04); }
    p.cyl(0.2, 0.16, 0.6, steel, 0, 1.3, D / 2, 12); p.box(0.36, 0.14, 0.28, steel, 0, 1.0, D / 2);
    for (const sx of [-0.26, 0.26]) { p.add(new THREE.SphereGeometry(0.1, 10, 8), steel, sx, 1.55, D / 2); p.cyl(0.05, 0.045, 0.55, steel, sx * 1.05, 1.2, D / 2); }
    p.cyl(0.11, 0.12, 0.26, steel, 0, 1.78, D / 2, 12); p.add(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0, 1.9, D / 2);
    p.box(0.16, 0.025, 0.02, L.std('soot', { color: '#0a0806' }), 0, 1.8, D / 2 + 0.115); // 頭盔的眼縫
    p.cyl(0.015, 0.015, 2.4, L.MAT.darkWood(), 0.32, 1.2, D / 2 + 0.05, 6); p.box(0.02, 0.3, 0.14, steel, 0.32, 2.3, D / 2 + 0.1);
    return 0.9;
  },
  bust(k, x, z, ry, ctx, seed) { // 大理石底座＋胸像（製作人給的胸像有好幾款，輪流）
    const p = at(k, x, z, ry), mar = L.std('marble', { color: '#cfc8bc', roughness: 0.35 }), D = 0.45;
    p.box(0.4, 0.06, 0.4, mar, 0, 0.03, D / 2); p.cyl(0.13, 0.15, 1.0, mar, 0, 0.56, D / 2, 12); p.box(0.36, 0.06, 0.36, mar, 0, 1.09, D / 2);
    if (prop(variant('bust', seed), x, z, ry, 0.42, 0.75, 0.42, 1.12)) return 0.6; // 製作人給的胸像模型放在大理石柱上
    p.add(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mar, 0, 1.3, D / 2); // 肩膀
    p.cyl(0.05, 0.06, 0.1, mar, 0, 1.35, D / 2); p.add(new THREE.SphereGeometry(0.11, 14, 10), mar, 0, 1.48, D / 2);
    return 0.6;
  },
  plant(k, x, z, ry, ctx, seed) { // 盆栽（深色的葉子，有點枯）
    if (prop('plant', x, z, ry, 0.6, 1.1, 0.6)) return 0.6;
    const p = at(k, x, z, ry), pot = L.std('pot', { color: '#5a3424', roughness: 0.8 }), leaf = L.std('leaf', { color: '#1e3018', roughness: 0.8, side: THREE.DoubleSide }), D = 0.5;
    p.cyl(0.2, 0.15, 0.4, pot, 0, 0.2, D / 2, 12); p.cyl(0.21, 0.21, 0.04, pot, 0, 0.4, D / 2, 12);
    for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2 + seed, l = 0.3 + rnd(i, seed) * 0.3; const g = new THREE.SphereGeometry(1, 6, 5); g.scale(0.07, l / 2, 0.015); g.translate(0, l / 2, 0); p.add(g, leaf, Math.cos(a) * 0.05, 0.38, D / 2 + Math.sin(a) * 0.05, a, 0.45 + rnd(seed, i) * 0.5, 0); } // 葉子：橢圓的、往外垂
    return 0.6;
  },
  candelabraFloor(k, x, z, ry, ctx) { // 落地的大燭台
    if (prop('candelabra', x, z, ry, 0.5, 1.7, 0.45)) return 0.5;
    const p = at(k, x, z, ry), b = L.MAT.iron(), D = 0.4;
    p.cyl(0.18, 0.2, 0.05, b, 0, 0.025, D / 2, 10); p.cyl(0.025, 0.03, 1.5, b, 0, 0.78, D / 2, 8);
    p.add(new THREE.TorusGeometry(0.18, 0.015, 4, 16, Math.PI), b, 0, 1.5, D / 2, 0, 0, Math.PI);
    for (const dx of [-0.18, 0, 0.18]) { const [px, py, pz] = p.pt(dx, dx ? 1.52 : 1.56, D / 2); p.cyl(0.035, 0.03, 0.04, b, dx, py - 0.02, D / 2, 8); ctx.flames.push([px, py, pz]); }
    return 0.5;
  },
  bookshelf(k, x, z, ry, ctx) { if (prop('bookshelf', x, z, ry, 1.6, Math.min(2.5, ctx.h - 0.6), 0.45)) return 1.7; const p = at(k, x, z, ry); const [bx, , bz] = p.pt(0, 0, 0.2); L.bookshelf(k, bx, bz, ry, 1.6, Math.min(2.5, ctx.h - 0.6)); return 1.7; },
  tallShelf(k, x, z, ry, ctx) { if (prop('bookshelf', x, z, ry, 1.8, Math.min(4.2, ctx.h - 0.8), 0.5)) return 1.9; const p = at(k, x, z, ry); const [bx, , bz] = p.pt(0, 0, 0.2); L.bookshelf(k, bx, bz, ry, 1.8, Math.min(4.2, ctx.h - 0.8)); if (ctx.h > 4.5 && ctx.i % 2 === 0) ladder(k, x, z, ry, Math.min(4, ctx.h - 1)); return 1.9; },
  chairs(k, x, z, ry, ctx, seed) { // 兩張扶手椅＋小圓桌
    const p = at(k, x, z, ry), col = ctx.cloth ?? '#3a1a1a';
    for (const sx of [-0.65, 0.65]) { const [ax, , az] = p.pt(sx, 0, 0.75); if (!placeProp(G, 'armchair', ax, 0, az, ry - sx * 0.5, [0.85, 1.2, 0.85])) L.armchair(k, col, ax, az, ry + Math.PI - sx * 0.5); }
    const [tx, , tz] = p.pt(0, 0, 0.55); const top = L.P.roundTable(k, tx, tz, 0.25, 0.55);
    if (seed % 2) L.P.teacup(k, tx, top, tz); else L.P.openBook(k, tx, top, tz, ry);
    return 2.1;
  },
  bench(k, x, z, ry) { const p = at(k, x, z, ry); const [bx, , bz] = p.pt(0, 0, 0.3); if (!placeProp(G, 'bench', bx, 0, bz, ry, [1.9, 1.0, 0.7])) L.P.bench(k, bx, bz, ry, 1.8); return 2.0; },
  crates(k, x, z, ry, ctx, seed) { // 木箱、木桶、麻袋
    const p = at(k, x, z, ry), sack = L.std('sack', { color: '#4a3e2a', roughness: 1 });
    const [a, , b] = p.pt(-0.4, 0, 0.4); if (!placeProp(G, 'crate', a, 0, b, ry + rnd(seed), [0.7, 0.7, 0.7])) L.P.crate(k, a, b, 0.7, 0, rnd(seed));
    if (seed % 2) { const [c, , d] = p.pt(-0.4, 0, 0.4); if (!placeProp(G, 'crate_open', c, 0.7, d, ry + rnd(seed, 2), [0.5, 0.5, 0.5])) L.P.crate(k, c, d, 0.45, 0.7, rnd(seed, 2)); }
    const [e, , f] = p.pt(0.45, 0, 0.35); if (!placeProp(G, 'barrel', e, 0, f, seed, [0.6, 0.85, 0.6])) L.P.barrel(k, e, f);
    p.add(new THREE.SphereGeometry(0.25, 8, 6), sack, 0.1, 0.18, 0.85, 0, 0, 0); p.add(new THREE.SphereGeometry(0.22, 8, 6), sack, -0.25, 0.16, 0.95, 0, 0, 0.3);
    return 1.5;
  },
  statue(k, x, z, ry) { // 披斗篷的石像（大廳、典禮廳）
    if (prop('statue', x, z, ry, 1.0, 2.9, 0.9)) return 1.3;
    const p = at(k, x, z, ry), st = L.std('statueStone', { color: '#8a8478', roughness: 0.75 }), D = 0.9;
    p.box(0.9, 0.5, 0.9, st, 0, 0.25, D / 2); p.box(1.0, 0.08, 1.0, st, 0, 0.54, D / 2);
    p.cyl(0.18, 0.42, 1.7, st, 0, 1.43, D / 2, 12); p.add(new THREE.SphereGeometry(0.16, 12, 10), st, 0, 2.42, D / 2);
    p.add(new THREE.ConeGeometry(0.2, 0.32, 12, 1, true), st, 0, 2.5, D / 2 - 0.02); // 兜帽
    p.cyl(0.05, 0.05, 0.6, st, 0.26, 1.85, D / 2 + 0.15); p.cyl(0.02, 0.02, 2.2, st, 0.34, 1.6, D / 2 + 0.25, 6); // 手和法杖
    p.add(new THREE.SphereGeometry(0.06, 8, 6), L.std('orb', { color: '#9fc4ff', emissive: '#4a70c0', emissiveIntensity: 0.8 }), 0.34, 2.75, D / 2 + 0.25);
    return 1.3;
  },
  weapons(k, x, z, ry) { // 武器架（貝爾蒙特）
    const p = at(k, x, z, ry), wd = L.MAT.darkWood(), steel = L.std('steel', { color: '#8a8c92', metalness: 0.9, roughness: 0.3 }), D = 0.4;
    p.box(1.2, 0.08, 0.3, wd, 0, 0.3, D / 2); p.box(1.2, 0.08, 0.15, wd, 0, 1.5, 0.1); for (const sx of [-0.55, 0.55]) p.box(0.06, 1.6, 0.06, wd, sx, 0.8, 0.12);
    for (let i = 0; i < 4; i++) { const dx = -0.4 + i * 0.27; p.cyl(0.015, 0.015, 1.7, wd, dx, 1.1, 0.15, 6); p.box(0.05, 0.22, 0.015, steel, dx, 2.05, 0.15); }
    return 1.4;
  },
  cauldronStand(k, x, z, ry) { if (prop('cauldron', x, z, ry, 0.9, 0.9, 0.9)) return 1.0; const p = at(k, x, z, ry); const [cx, , cz] = p.pt(0, 0, 0.5); L.P.cauldron(k, cx, cz); return 1.0; },
  globeStand(k, x, z, ry) { if (prop('globe', x, z, ry, 0.6, 1.2, 0.6)) return 0.8; const p = at(k, x, z, ry), wd = L.MAT.darkWood(); p.cyl(0.04, 0.06, 0.8, wd, 0, 0.4, 0.4, 8); for (let i = 0; i < 3; i++) p.box(0.05, 0.03, 0.4, wd, 0, 0.03, 0.4, i * 2.1); const [gx, , gz] = p.pt(0, 0, 0.4); L.P.globe(k, gx, 0.8, gz); return 0.8; },
  coffin(k, x, z, ry, ctx, seed) { // 棺材（製作人給的模型；沒有就不放）：直立靠牆的兩具，或倒在地上的破棺材
    if (seed % 2) return prop('coffins', x, z, ry, 1.5, 2.0, 0.6) ? 1.6 : 0.6;
    return placeProp(G, 'coffin_broken', x + Math.sin(ry) * 0.5, 0, z + Math.cos(ry) * 0.5, ry + Math.PI / 2, [1.8, 0.5, 0.9]) ? 1.9 : 0.6;
  },
  bones(k, x, z, ry, ctx, seed) { // 角落的骨頭（蝕巢、井室）
    if (prop('bones', x, z, ry, 0.9, 0.5, 0.8)) return 1.0;
    const p = at(k, x, z, ry), bm = L.std('boneMat', { color: '#c8bca4', roughness: 0.6 });
    for (let i = 0; i < 6; i++) p.add(new THREE.CylinderGeometry(0.025, 0.03, 0.35 + rnd(i, seed) * 0.2, 6), bm, -0.4 + rnd(seed, i) * 0.8, 0.03, 0.3 + rnd(i, seed + 1) * 0.4, rnd(i) * 3, Math.PI / 2, 0);
    const [sx, , sz] = p.pt(0.1, 0, 0.45); L.P.skull(k, sx, 0, sz, ry + rnd(seed) * 2);
    return 1.0;
  },
};
// 小燭台（桌上用）：三根蠟燭
function candelabra(k, x, y, z, flames) {
  const b = L.MAT.brass(); k.cyl(0.07, 0.08, 0.02, b, x, y + 0.01, z, 10); k.cyl(0.012, 0.015, 0.28, b, x, y + 0.15, z, 6);
  k.add(new THREE.TorusGeometry(0.09, 0.008, 4, 12, Math.PI), b, x, y + 0.28, z, 0, 0, Math.PI);
  for (const dx of [-0.09, 0, 0.09]) flames.push([x + dx, y + (dx ? 0.28 : 0.3), z]);
}
function ladder(k, x, z, ry, h) { // 靠在書架上的梯子
  const p = at(k, x, z, ry), wd = L.MAT.wood(), lean = 0.25;
  for (const sx of [-0.22, 0.22]) p.add(new THREE.BoxGeometry(0.05, h, 0.05), wd, sx + 0.6, h / 2, 0.55, 0, -lean, 0);
  for (let y = 0.3; y < h - 0.2; y += 0.35) p.box(0.44, 0.03, 0.04, wd, 0.6, y, 0.55 + Math.sin(lean) * (h / 2 - y));
}

// ---------- 牆上的東西（不佔地板）----------
const WALL = {
  painting(k, x, z, ry, ctx, seed) {
    const p = at(k, x, z, ry), w = 0.7 + (seed % 3) * 0.25, h = w * (seed % 2 ? 1.25 : 0.8), y = Math.min(ctx.h - h / 2 - 0.4, 1.9 + h / 2 - 0.3);
    if (placeProp(G, variant('painting', seed >> 1), x + Math.sin(ry) * 0.04, y - h / 2, z + Math.cos(ry) * 0.04, ry, [w + 0.2, h + 0.2, 0.1])) return w + 0.6; // 製作人給的畫（四幅輪流）
    const gold = L.std('frameGold', { color: '#8a6a2a', metalness: 0.7, roughness: 0.4 });
    for (const sy of [-1, 1]) p.box(w + 0.16, 0.08, 0.06, gold, 0, y + sy * (h / 2 + 0.04), 0.04);
    for (const sx of [-1, 1]) p.box(0.08, h + 0.08, 0.06, gold, sx * (w / 2 + 0.04), y, 0.04);
    p.add(new THREE.PlaneGeometry(w, h), L.std('paintMat' + (seed % PAINT.length), { map: paintingTex(seed % PAINT.length), roughness: 0.75 }), 0, y, 0.03);
    return w + 0.6;
  },
  sconce(k, x, z, ry, ctx, seed = 0) { // 壁燈：鐵架＋兩根蠟燭（製作人給的壁燈模型兩款輪流：鐵架蠟燭點火、提燈自己發光）
    const y = Math.min(2.1, ctx.h - 0.8), name = variant('sconce', seed);
    const m = placeProp(G, name, x + Math.sin(ry) * 0.12, y - 0.3, z + Math.cos(ry) * 0.12, ry, [0.3, 0.5, 0.25]);
    if (m) { if (name === 'sconce' && m.top) ctx.flames.push([m.top.x, m.top.y, m.top.z]); return 0.6; }
    const p = at(k, x, z, ry), ir = L.MAT.iron();
    p.box(0.12, 0.3, 0.03, ir, 0, y, 0.015); p.box(0.04, 0.04, 0.22, ir, 0, y - 0.05, 0.12); p.box(0.3, 0.03, 0.04, ir, 0, y - 0.05, 0.22);
    for (const dx of [-0.13, 0.13]) { p.cyl(0.035, 0.03, 0.03, ir, dx, y - 0.03, 0.22, 8); ctx.flames.push(p.pt(dx, y - 0.02, 0.22)); }
    return 0.6;
  },
  tapestry(k, x, z, ry, ctx, seed) {
    const p = at(k, x, z, ry), [c1, c2] = ctx.tap ?? ['#3a1a1a', '#c8a24a'], h = Math.min(2.6, ctx.h - 1.2), w = 1.3, y = 1.0 + h / 2;
    p.add(new THREE.PlaneGeometry(w, h, 1, 6), L.std('tapMat' + c1 + c2, { map: tapestryTex(c1, c2), roughness: 1, side: THREE.DoubleSide }), 0, y, 0.04);
    p.box(w + 0.2, 0.04, 0.04, L.MAT.brass(), 0, y + h / 2 + 0.02, 0.06);
    return w + 0.7;
  },
  window(k, x, z, ry, ctx) { // 尖拱窗：窗框、窗格、外面的夜空
    const p = at(k, x, z, ry), st = L.MAT.stone(), ir = L.MAT.iron(), w = 1.1, h = Math.min(2.2, ctx.h - 2), y = 1.4 + h / 2;
    const wm = placeProp(G, variant('window', x + z), x + Math.sin(ry) * 0.1, 1.3, z + Math.cos(ry) * 0.1, ry, [w + 0.3, h + w / 2 + 0.3, 0.3]); // 製作人給的哥德式窗（三款輪流）
    if (wm) { p.add(new THREE.PlaneGeometry(wm.w * 0.85, wm.h * 0.9), L.MAT.glass(), 0, 1.3 + wm.h / 2, 0.015); return w + 1.2; } // 窗後面的夜空
    p.add(new THREE.PlaneGeometry(w, h), L.MAT.glass(), 0, y, 0.02);
    p.add(new THREE.CircleGeometry(w / 2, 16, 0, Math.PI), L.MAT.glass(), 0, y + h / 2, 0.02);
    for (const sx of [-1, 1]) p.box(0.14, h + 0.1, 0.16, st, sx * (w / 2 + 0.07), y, 0.06);
    p.add(new THREE.TorusGeometry(w / 2 + 0.07, 0.07, 5, 16, Math.PI), st, 0, y + h / 2, 0.06);
    p.box(w + 0.4, 0.12, 0.3, st, 0, y - h / 2 - 0.06, 0.12); // 窗台
    p.box(0.03, h + w / 2, 0.03, ir, 0, y + w / 4, 0.04); for (let i = 1; i < 4; i++) p.box(w, 0.025, 0.03, ir, 0, y - h / 2 + (i * h) / 4, 0.04);
    return w + 1.2;
  },
  shelf(k, x, z, ry, ctx, seed) { // 牆上的小架子：瓶瓶罐罐、書
    const p = at(k, x, z, ry), y = 1.6;
    p.box(1.0, 0.04, 0.25, L.MAT.darkWood(), 0, y, 0.13); for (const sx of [-0.4, 0.4]) p.box(0.04, 0.16, 0.2, L.MAT.darkWood(), sx, y - 0.1, 0.1);
    const [bx, by, bz] = p.pt(-0.2, y + 0.02, 0.13); if (!placeProp(G, variant('potions', seed), bx, by, bz, ry, [0.45, 0.35, 0.22])) L.P.bottles(k, bx, by, bz, seed, 4);
    const [cx, cy, cz] = p.pt(0.28, y + 0.02, 0.13); L.P.bookStack(k, cx, cy, cz, 2, seed + 3);
    return 1.4;
  },
  mirror(k, x, z, ry, ctx) {
    const p = at(k, x, z, ry), gold = L.std('frameGold', { color: '#8a6a2a', metalness: 0.7, roughness: 0.4 }), y = 1.7;
    p.add(new THREE.CircleGeometry(0.45, 24), L.MAT.mirror(), 0, y, 0.03); p.add(new THREE.TorusGeometry(0.47, 0.04, 6, 28), gold, 0, y, 0.04);
    return 1.3;
  },
  chains(k, x, z, ry, ctx, seed) { // 從天花板垂下的鐵鍊
    { const len = Math.min(ctx.h - 0.6, 1.4 + rnd(seed) * 2.2), s = Math.sin(ry), c = Math.cos(ry); let ok = false; for (const dx of [-0.2, 0.25]) ok = !!placeProp(G, 'chain', x + dx * c + 0.25 * s, ctx.h - len * (dx > 0 ? 0.8 : 1), z - dx * s + 0.25 * c, ry + dx, [0.1, len * (dx > 0 ? 0.8 : 1), 0.1]) || ok; if (ok) return 1.2; }
    const p = at(k, x, z, ry), ir = L.MAT.iron(), n = Math.floor(6 + rnd(seed) * 8);
    for (const dx of [-0.2, 0.25]) for (let i = 0; i < n; i++) p.add(new THREE.TorusGeometry(0.05, 0.012, 4, 8), ir, dx, ctx.h - 0.1 - i * 0.085, 0.25, (i % 2) * Math.PI / 2);
    p.box(0.1, 0.25, 0.04, ir, 0.02, ctx.h - 0.3, 0.02);
    return 1.2;
  },
  pipes(k, x, z, ry, ctx) { // 機械室、通道：沿牆的銅管
    const p = at(k, x, z, ry), cu = L.std('copper', { color: '#6a4a2a', metalness: 0.8, roughness: 0.45 });
    for (const y of [ctx.h - 0.7, ctx.h - 0.45]) p.add(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8), cu, 0, y, 0.12, 0, 0, Math.PI / 2);
    for (const dx of [-0.9, 0.9]) p.box(0.06, 0.4, 0.2, L.MAT.iron(), dx, ctx.h - 0.58, 0.1);
    return 2.2;
  },
  gearWall(k, x, z, ry, ctx, seed) { // 牆上的大齒輪
    const p = at(k, x, z, ry), ir = L.std('gearIron', { color: '#4a3e30', metalness: 0.6, roughness: 0.5 }), r = 0.5 + rnd(seed) * 0.4, y = Math.min(ctx.h - r - 0.5, 2.4 + r);
    p.add(new THREE.TorusGeometry(r, 0.06, 6, 24), ir, 0, y, 0.08); p.cyl(0.1, 0.1, 0.12, ir, 0, y, 0.08);
    for (let i = 0; i < 6; i++) p.add(new THREE.BoxGeometry(0.04, r * 2, 0.04), ir, 0, y, 0.08, 0, 0, (i * Math.PI) / 6);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; p.add(new THREE.BoxGeometry(0.1, 0.1, 0.08), ir, Math.cos(a) * (r + 0.06), y + Math.sin(a) * (r + 0.06), 0.08, 0, 0, a); }
    return r * 2 + 0.8;
  },
  roots(k, x, z, ry, ctx, seed) { // 蝕巢：牆上爬滿黑色的根、結晶
    const p = at(k, x, z, ry), m = L.std('rootBlack', { color: '#08070a', roughness: 0.4, metalness: 0.3 }), cr = L.std('crystalBlack', { color: '#07060c', emissive: '#0d0820', roughness: 0.15, metalness: 0.6, flatShading: true });
    for (let i = 0; i < 5; i++) { const pts = []; let px = (rnd(i, seed) - 0.5) * 1.2, py = 0; for (let j = 0; j < 6; j++) { pts.push(new THREE.Vector3(px, py, 0.05 + rnd(j, i) * 0.12)); px += (rnd(j, i + seed) - 0.5) * 0.6; py += 0.4 + rnd(i, j) * 0.4; } p.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.04 + rnd(i) * 0.03, 5), m, 0, 0, 0); }
    for (let i = 0; i < 5; i++) { const l = 0.2 + rnd(i, seed) * 0.4; const g = new THREE.ConeGeometry(0.05, l, 5); g.translate(0, l / 2, 0); p.add(g, cr, (rnd(seed, i) - 0.5) * 1.2, 0.3 + rnd(i, 3) * 2, 0.08, 0, 1.2, (rnd(i, 9) - 0.5)); }
    return 1.4;
  },
};

// ---------- 每種房間要擺什麼（權重） ----------
const KINDS = {
  dorm: { floor: [['wardrobe', 2], ['sideboard', 3], ['clock', 1], ['plant', 2], ['candelabraFloor', 1], ['chairs', 1]], wall: [['painting', 6], ['sconce', 3], ['shelf', 1], ['mirror', 1], ['window', 2]], beams: true, floatN: 10 },
  hall: { floor: [['armor', 3], ['statue', 2], ['candelabraFloor', 2], ['plant', 1], ['bust', 2]], wall: [['painting', 4], ['sconce', 4], ['tapestry', 2]], floatN: 60, chandelier: true },
  banquet: { floor: [['armor', 2], ['candelabraFloor', 2], ['sideboard', 2], ['statue', 1]], wall: [['painting', 4], ['sconce', 3], ['tapestry', 2]] },
  starhall: { floor: [['bookshelf', 2], ['globeStand', 1], ['candelabraFloor', 2], ['bust', 1], ['sideboard', 1]], wall: [['painting', 3], ['sconce', 3], ['shelf', 1]], floatN: 24 },
  founder: { floor: [['bookshelf', 3], ['armor', 1], ['bust', 2], ['candelabraFloor', 1]], wall: [['painting', 2], ['sconce', 3]], beams: true },
  stairs: { floor: [], wall: [['sconce', 3], ['chains', 1], ['painting', 1]] },
  library: { floor: [['tallShelf', 6], ['candelabraFloor', 1], ['globeStand', 1], ['sideboard', 1]], wall: [['sconce', 2]] },
  maze: { floor: [['tallShelf', 1]], wall: [] },
  ante: { floor: [['tallShelf', 2], ['bust', 2], ['candelabraFloor', 1]], wall: [['sconce', 2], ['chains', 1]] },
  well: { floor: [['crates', 2], ['bones', 2], ['coffin', 2]], wall: [['chains', 3], ['sconce', 1]] },
  pass: { floor: [], wall: [['pipes', 3], ['sconce', 1], ['chains', 1]] },
  gears: { floor: [['crates', 3], ['bones', 1]], wall: [['gearWall', 3], ['pipes', 2], ['chains', 2]] },
  nest: { floor: [['bones', 4], ['coffin', 2]], wall: [['roots', 5], ['chains', 1]] },
  dock: { floor: [['crates', 3]], wall: [] },
};
const ROOM_KIND = {
  dorm_eldrin: 'dorm', dorm_grimoire: 'dorm', dorm_belmont: 'dorm', dorm_ouroboros: 'dorm', hall: 'hall', banquet: 'banquet', starhall: 'starhall', founder: 'founder', north_stairs: 'stairs', north_hall: 'stairs',
  lib_entry: 'library', lib_reading: 'library', lib_maze: 'maze', lib_ante: 'ante', lib_well: 'well', a4_pass: 'pass', a4_gears: 'gears', a4_nest: 'nest', dock: 'dock',
};
// 原本就有擺設的地方（不要疊上去）：[x0, z0, x1, z1]；walls：只擺這幾面牆（N＝z 小的那面、S、W＝x 小、E）
const DORM_SIDE = (r, north) => ({ walls: ['W', 'E'], wallWalls: ['W', 'E', north ? 'S' : 'N'], keep: [[r.x[0], north ? r.z[0] : r.z[1] - 2.4, r.x[1], north ? r.z[0] + 2.4 : r.z[1]], [r.x[0], north ? r.z[1] - 1.6 : r.z[0], r.x[1], north ? r.z[1] : r.z[0] + 1.6]] });
const EXTRA = {
  dorm_eldrin: (r) => DORM_SIDE(r, true), dorm_grimoire: (r) => DORM_SIDE(r, true), dorm_belmont: (r) => DORM_SIDE(r, false), dorm_ouroboros: (r) => DORM_SIDE(r, false),
  hall: () => ({ keep: [[-10, 115.4, -8.6, 118.1], [8.6, 115.4, 10, 118.1], [-10, 126.4, -8.6, 129.1], [8.6, 126.4, 10, 129.1], [-10, 110, -8.4, 112], [8.4, 110, 10, 112], [-10, 138, -8.4, 140], [8.4, 138, 10, 140], [4.5, 138.8, 6.5, 140], [-1.6, 110, 1.6, 140]], wallKeep: [[-10, 113.5, -9.4, 118.5], [-10, 127.5, -9.4, 132.5], [9.4, 113.5, 10, 118.5], [9.4, 127.5, 10, 132.5]] }),
  banquet: (r) => ({ keep: [[-29.5, 102, -14.5, 108.5]], walls: ['E', 'S', 'N'], wallKeep: [[r.x[0], r.z[0], r.x[1], r.z[0] + 0.6]] }),
  starhall: () => ({ keep: [[-9, -9, -6.5, -6.5], [6.5, -9, 9, -6.5], [-9, 6.5, -6.5, 9], [6.5, 6.5, 9, 9], [-5, -5, 5, 5]], wallKeep: [[-6, -9, -4, -8.4], [4, -9, 6, -8.4], [-9, -2, -8.4, 0], [8.4, 0, 9, 2]] }),
  lib_entry: () => ({ keep: [[106.5, 3, 114, 15], [113.6, 6, 115, 13], [101.5, 14.2, 109, 15]], walls: ['W', 'N', 'E'] }),
  lib_maze: () => ({ walls: ['W', 'E'] }),
  lib_reading: () => ({ keep: [[124.5, -41, 128.5, -35]] }),
  dock: (r) => ({ walls: [], keep: [] }),
};
// 頭骨堆：蝕巢的角落、井室（x, z, 大小, 方向）
const SKULL_PILES = { a4_nest: [[171.6, -0.8, 1.6, 0.4], [171.8, 4.8, 1.2, 2.1], [166.2, 5.2, 0.9, 1]], lib_well: [[137.6, -64.6, 1.3, 0.7]] };
// 吊燈模型上蠟燭的位置（一圈 8 根，跟模型的燭台對齊）
export const chandelierFlames = (x, y, z, m) => Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; return [x + Math.cos(a) * m.w * 0.41, y + m.h * 0.14, z + Math.sin(a) * m.w * 0.41]; });
// 吊燈：哪幾個房間、掛在哪（x, z, 寬）
const mid = (r) => [(r.x[0] + r.x[1]) / 2, (r.z[0] + r.z[1]) / 2];
const CHANDELIER = {
  banquet: (r) => [[-22, 112, 2.6], [-22, 125, 2.6], [-22, 138, 2.6]],
  dorm_eldrin: (r) => [[mid(r)[0], mid(r)[1] + 1.5, 1.5]], dorm_grimoire: (r) => [[mid(r)[0], mid(r)[1] + 1.5, 1.5]],
  dorm_belmont: (r) => [[mid(r)[0], mid(r)[1] - 1.5, 1.4]], dorm_ouroboros: (r) => [[mid(r)[0], mid(r)[1] - 1.5, 1.4]],
  founder: (r) => [[0, -72, 2.2]], lib_reading: (r) => [[126.5, -38, 1.8]], lib_entry: (r) => [[107.5, 7.5, 2.0]],
};
const pick = (list, s) => { const tot = list.reduce((a, e) => a + e[1], 0); let v = rnd(s, 7) * tot; for (const [n, w] of list) if ((v -= w) < 0) return n; return list[0][0]; };

/** 一個房間的擺設加強 */
export function dressRoom(r, group, lib) {
  L = lib; G = group;
  const kind = ROOM_KIND[r.id]; if (!kind) return;
  const K = KINDS[kind], ex = EXTRA[r.id]?.(r) ?? {}, k = new L.Kit(), flames = [];
  const ctx = { h: r.h, flames, cloth: { dorm_eldrin: '#2a3a6a', dorm_grimoire: '#5a1a1e', dorm_belmont: '#5a3a14', dorm_ouroboros: '#123322' }[r.id] ?? '#3a1a1a',
    tap: { dorm_eldrin: ['#1e2c50', '#c8d4ea'], dorm_grimoire: ['#4a1218', '#d8c49a'], dorm_belmont: ['#3a2a10', '#d1a640'], dorm_ouroboros: ['#123322', '#c0c4c8'] }[r.id] ?? ['#3a1a1a', '#c8a24a'], i: 0 };
  const myDoors = DOORS.filter((d) => d.a === r.id || d.b === r.id);
  const myThings = THINGS.filter((t) => t.room === r.id || (t.x >= r.x[0] && t.x <= r.x[1] && t.z >= r.z[0] && t.z <= r.z[1]));
  const inRect = (x, z, [x0, z0, x1, z1], m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
  // 一段牆上的 [a, b] 這一段可不可以擺：pts＝這一段在地上的幾個點
  const free = (pts, wall) => {
    for (const [x, z] of pts) {
      for (const d of myDoors) if (Math.hypot(x - d.x, z - d.z) < d.w / 2 + (wall ? 0.5 : 1.1)) return false;
      for (const t of myThings) { const [w, , dd] = t.size ?? [0.6, 0.6, 0.6]; if (inRect(x, z, [t.x - w / 2, t.z - dd / 2, t.x + w / 2, t.z + dd / 2], wall ? 0.35 : 0.9)) return false; }
      for (const q of (wall ? ex.wallKeep : ex.keep) ?? []) if (inRect(x, z, q)) return false;
      if (!wall) for (const q of ex.keep ?? []) if (inRect(x, z, q)) return false;
    }
    return true;
  };
  // 四面牆：起點、方向、面向房間的角度
  const WALLS = { N: [[r.x[0], r.z[0]], [1, 0], 0], S: [[r.x[1], r.z[1]], [-1, 0], Math.PI], W: [[r.x[0], r.z[1]], [0, -1], Math.PI / 2], E: [[r.x[1], r.z[0]], [0, 1], -Math.PI / 2] };
  const walls = [...new Set([...(ex.walls ?? Object.keys(WALLS)), ...(ex.wallWalls ?? [])])];
  let seed = Math.round(Math.abs(r.x[0] * 3 + r.z[0] * 7));
  for (const wn of walls) {
    const [[sx, sz], [dx, dz], ry] = WALLS[wn], len = Math.abs(dx) * (r.x[1] - r.x[0]) + Math.abs(dz) * (r.z[1] - r.z[0]);
    const nx = Math.sin(ry), nz = Math.cos(ry), P = (t, off) => [sx + dx * t + nx * off, sz + dz * t + nz * off];
    // 地上的家具
    if (K.floor.length && len > 2.5 && (!ex.walls || ex.walls.includes(wn))) {
      let t = 0.9;
      while (t < len - 0.9) {
        seed++; const name = pick(K.floor, seed), w = { wardrobe: 1.3, sideboard: 1.7, clock: 0.7, armor: 0.9, bust: 0.6, plant: 0.6, candelabraFloor: 0.5, bookshelf: 1.7, tallShelf: 1.9, chairs: 2.1, bench: 2.0, crates: 1.5, statue: 1.3, weapons: 1.4, cauldronStand: 1.0, globeStand: 0.8, bones: 1.0, coffin: 1.9 }[name] ?? 1;
        const deep = name === 'chairs' ? 1.6 : name === 'crates' ? 1.2 : 0.8;
        const mid = t + w / 2, probe = [P(t, 0.3), P(t + w, 0.3), P(mid, deep), P(t, deep), P(t + w, deep)];
        if (t + w <= len - 0.6 && free(probe, false) && rnd(seed, 3) > 0.15) {
          const [x, z] = P(mid, 0.02); ctx.i++;
          FLOOR[name](k, x, z, ry, ctx, Math.abs(seed));
          t += w + 0.3 + rnd(seed, 5) * 0.9;
        } else t += 0.6;
      }
    }
    // 牆上的東西
    if (K.wall.length && len > 1.5 && (!ex.wallWalls || ex.wallWalls.includes(wn))) {
      let t = 0.8;
      while (t < len - 0.8) {
        seed++; let name = pick(K.wall, seed + 100);
        if (name === 'window' && (r.id === 'dorm_ouroboros' || wn === 'N' && r.id === 'dorm_eldrin')) name = 'painting'; // 地下的房間沒有窗
        const w = { painting: 1.4, sconce: 0.6, tapestry: 2.0, window: 2.3, shelf: 1.4, mirror: 1.3, chains: 1.2, pipes: 2.2, gearWall: 2.0, roots: 1.4 }[name] ?? 1;
        const mid = t + w / 2;
        if (t + w <= len - 0.5 && free([P(t, 0.15), P(mid, 0.15), P(t + w, 0.15)], true) && rnd(seed, 4) > 0.1) {
          const [x, z] = P(mid, 0.01); WALL[name](k, x, z, ry, ctx, Math.abs(seed));
          t += w + 0.2 + rnd(seed, 6) * 0.8;
        } else t += 0.5;
      }
    }
  }
  if (CHANDELIER[r.id]) for (const [x, z, w] of CHANDELIER[r.id](r)) { const H = Math.min(r.h * 0.55, w * 1.8), m = placeProp(group, 'chandelier', x, r.h - H, z, 0, [w, H, w]); if (m) flames.push(...chandelierFlames(x, r.h - m.h, z, m)); } // 吊燈（有模型才有）
  for (const [x, z, s, ry] of SKULL_PILES[r.id] ?? []) placeProp(group, 'skulls', x, 0, z, ry, [s, s * 0.35, s]); // 頭骨堆（有模型才有）
  if (K.beams) { // 天花板的木樑
    const wd = L.MAT.darkWood(), alongX = r.x[1] - r.x[0] < r.z[1] - r.z[0];
    if (alongX) for (let z = r.z[0] + 1.5; z < r.z[1] - 1; z += 2.4) k.box(r.x[1] - r.x[0], 0.25, 0.22, wd, (r.x[0] + r.x[1]) / 2, r.h - 0.14, z);
    else for (let x = r.x[0] + 1.5; x < r.x[1] - 1; x += 2.4) k.box(0.22, 0.25, r.z[1] - r.z[0], wd, x, r.h - 0.14, (r.z[0] + r.z[1]) / 2);
  }
  k.build(group);
  if (flames.length) L.candles(group, flames, { h: 0.14, r: 0.02 });
  // 漂浮的蠟燭：魔法學院的招牌（慢慢上下飄）
  if (K.floatN) {
    const spots = [], cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2;
    for (let i = 0; i < K.floatN; i++) spots.push([r.x[0] + 1.2 + rnd(i, 1) * (r.x[1] - r.x[0] - 2.4), Math.max(2.6, r.h - 1.6 - rnd(i, 2) * Math.min(3, r.h * 0.25)), r.z[0] + 1.2 + rnd(i, 3) * (r.z[1] - r.z[0] - 2.4)]);
    const g = new THREE.Group(); L.candles(g, spots, { h: 0.22, r: 0.028 }); group.add(g);
    let t0 = rnd(cx, cz) * 10; const tick = g.children[0];
    if (tick) tick.onBeforeRender = () => { g.position.y = Math.sin(performance.now() / 1400 + t0) * 0.06; };
  }
}

// ---------- 屋頂：牆的內面換成「遠方的夜空」，下面是有垛口的矮牆；角落有石像鬼 ----------
// 灰盒的牆還在（擋路），只是看起來像露天：矮牆以上畫的是夜空、遠方的尖塔和屋脊
const roofSky = () => T.drawn('roofSky', (g, s) => {
  const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#04050c'); gr.addColorStop(0.7, '#141c34'); gr.addColorStop(1, '#2a3458'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
  g.fillStyle = '#e8ecff'; for (let i = 0; i < 260; i++) { const r = rnd(i, 1) < 0.95 ? 1 : 2; g.globalAlpha = 0.3 + rnd(i, 2) * 0.7; g.fillRect(rnd(i, 3) * s, rnd(i, 4) * s * 0.75, r, r); }
  g.globalAlpha = 1; g.fillStyle = '#05060a';
  for (let i = 0; i < 9; i++) { // 遠方的屋頂、尖塔
    const x = (i / 9) * s + rnd(i, 5) * 30, w = 40 + rnd(i, 6) * 70, h = s * (0.12 + rnd(i, 7) * 0.22);
    g.fillRect(x, s - h, w, h); g.beginPath(); g.moveTo(x - 4, s - h); g.lineTo(x + w / 2, s - h - (i % 3 === 0 ? s * 0.22 : s * 0.07)); g.lineTo(x + w + 4, s - h); g.fill();
    if (rnd(i, 8) > 0.5) { g.fillStyle = '#ffcf8a'; g.fillRect(x + w * 0.4, s - h * 0.6, 5, 8); g.fillStyle = '#05060a'; }
  }
}, { size: 512 });
export function dressRoof(r, group, lib) {
  L = lib; G = group; const k = new L.Kit(), st = L.MAT.stone(), H = 1.15;
  const skyMat = L.glow('roofSkyMat', '#ffffff', 1); skyMat.map = roofSky(); skyMat.needsUpdate = true;
  const sides = [[r.x[0] + 0.17, (r.z[0] + r.z[1]) / 2, Math.PI / 2, r.z[1] - r.z[0]], [r.x[1] - 0.17, (r.z[0] + r.z[1]) / 2, -Math.PI / 2, r.z[1] - r.z[0]], [(r.x[0] + r.x[1]) / 2, r.z[0] + 0.17, 0, r.x[1] - r.x[0]]];
  for (const [x, z, ry, len] of sides) {
    const g = new THREE.PlaneGeometry(len, r.h - H); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 12);
    const m = new THREE.Mesh(g, skyMat); m.position.set(x, H + (r.h - H) / 2, z); m.rotation.y = ry; group.add(m);
    // 矮牆＋垛口
    const p = at(k, x, z, ry);
    p.box(len, H, 0.5, st, 0, H / 2, 0.08);
    for (let t = -len / 2 + 0.5; t < len / 2 - 0.3; t += 1.2) p.box(0.6, 0.45, 0.5, st, t, H + 0.22, 0.08);
  }
  skyMat.map.wrapS = THREE.RepeatWrapping;
  // 石像鬼：蹲在矮牆上，往外看
  const gm = L.std('gargoyle', { color: '#5a5650', roughness: 0.9 });
  for (const [x, z, ry] of [[r.x[0] + 0.4, r.z[0] + 6, Math.PI / 2], [r.x[1] - 0.4, r.z[0] + 18, -Math.PI / 2], [r.x[0] + 0.4, r.z[0] + 34, Math.PI / 2], [r.x[1] - 0.4, r.z[0] + 48, -Math.PI / 2]]) {
    if (placeProp(group, variant('gargoyle', x + z), x, H, z, ry, [0.8, 1.1, 0.8])) continue;
    const p = at(k, x, z, ry);
    p.add(new THREE.SphereGeometry(0.28, 10, 8), gm, 0, H + 0.75, 0.05); p.add(new THREE.SphereGeometry(0.17, 10, 8), gm, 0, H + 1.1, -0.15);
    p.add(new THREE.ConeGeometry(0.05, 0.22, 5), gm, -0.1, H + 1.3, -0.15); p.add(new THREE.ConeGeometry(0.05, 0.22, 5), gm, 0.1, H + 1.3, -0.15);
    for (const sx of [-1, 1]) p.add(new THREE.BoxGeometry(0.04, 0.4, 0.5), gm, sx * 0.3, H + 0.95, 0.15, 0, -0.4, sx * 0.5); // 翅膀
    p.box(0.5, 0.2, 0.5, gm, 0, H + 0.5, 0.05);
  }
  // 地上：鉛皮屋頂的接縫、積水
  for (let z = r.z[0] + 1; z < r.z[1] - 1; z += 3) k.box(r.x[1] - r.x[0] - 1.2, 0.02, 0.06, L.MAT.iron(), (r.x[0] + r.x[1]) / 2, 0.01, z);
  k.build(group);
}

// ---------- 碼頭：繫在旁邊的小船、湖面的霧、漂在水上的燈 ----------
const mistTex = () => T.drawn('mist', (g, s) => {
  for (let i = 0; i < 70; i++) { const x = rnd(i, 1) * s, y = rnd(i, 2) * s, r = 30 + rnd(i, 3) * 90; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(200,210,235,0.07)'); gr.addColorStop(1, 'rgba(200,210,235,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
}, { size: 256 });
export function dressDock(r, group, lib) {
  L = lib; G = group; const k = new L.Kit(), wd = L.MAT.darkWood(), w2 = L.MAT.wood();
  // 小船：船身（兩片斜的木板＋船底）、座板、槳、繩子綁在木樁上
  for (const [x, z, ry] of [[7.4, 150, 0.1], [-7.6, 161, -0.15]]) {
    if (placeProp(group, 'rowboat', x, -0.55, z, ry, [1.4, 0.8, 3.8])) continue;
    const p = at(k, x, z, ry);
    p.box(0.9, 0.08, 3.0, wd, 0, -0.45, 0);
    for (const sx of [-1, 1]) p.add(new THREE.BoxGeometry(0.06, 0.45, 3.0), w2, sx * 0.55, -0.3, 0, 0, 0, sx * 0.35);
    p.add(new THREE.ConeGeometry(0.62, 0.8, 4, 1, true), w2, 0, -0.3, 1.85, Math.PI / 4, Math.PI / 2, 0);
    for (const dz of [-0.7, 0.4]) p.box(1.0, 0.05, 0.25, wd, 0, -0.22, dz);
    p.add(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6), w2, 0.3, -0.15, -0.2, 0, Math.PI / 2, 0.3);
    p.add(new THREE.CylinderGeometry(0.012, 0.012, 1.6, 4), L.std('rope', { color: '#8a7a5a' }), -0.6 * Math.sign(x), 0.1, 1.3, 0, 0, Math.sign(x) * 1.2);
  }
  // 湖面漂著的燈籠（新生入學的傳統）
  const fl = [];
  for (let i = 0; i < 14; i++) { const x = (rnd(i, 1) < 0.5 ? -1 : 1) * (9 + rnd(i, 2) * 22), z = 130 + rnd(i, 3) * 50; k.box(0.22, 0.04, 0.22, wd, x, -0.55, z); k.box(0.14, 0.18, 0.14, L.glow('floatLamp', '#ffb24a', 1.2), x, -0.43, z); fl.push([x, z]); }
  k.build(group);
  // 霧：貼著湖面的幾層半透明霧（慢慢飄）
  const mm = new THREE.MeshBasicMaterial({ map: mistTex(), color: '#6a7490', transparent: true, depthWrite: false, opacity: 0.6 });
  mm.map.wrapS = mm.map.wrapT = THREE.RepeatWrapping; mm.map.repeat.set(3, 3);
  for (const [y, sc] of [[-0.5, 1], [-0.32, 1.3]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mm); m.rotation.x = -Math.PI / 2; m.position.set(0, y, 150); m.scale.setScalar(sc); m.renderOrder = 2; group.add(m); m.onBeforeRender = () => { mm.map.offset.x = performance.now() / 90000; }; }
}

// 蜘蛛娃娃：坐在陰暗角落（有模型才有）。x, z, 面向
const DOLLS = { north_stairs: [[-1.55, -90.8, 0.5]], lib_ante: [[121.6, -59.4, 0.6]] };
// 稻草人：鐘塔機械室最暗的角落，張著手、咧嘴笑（第四幕被追時突然看到）
const SCARECROWS = { a4_gears: [[163.0, 17.2, -2.36]] };
export function dressDolls(r, group) {
  for (const [x, z, ry] of DOLLS[r.id] ?? []) placeProp(group, 'spider_doll', x, 0, z, ry, [0.5, 0.55, 0.45]);
  for (const [x, z, ry] of SCARECROWS[r.id] ?? []) placeProp(group, 'scarecrow', x, 0, z, ry, [1.6, 2.3, 0.7]); // 張開雙臂站在角落，面向房間
}
