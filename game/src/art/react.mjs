// 謎題的場景反應（帳號二，2026-10-22 製作人：謎題連進場景，要做得好一點、東西多一點）。
// 謎題視窗裡的操作，場景裡那個東西跟著動：沙漏翻轉漏沙、星盤的環轉到時辰、天平傾斜、石像鬼被推著走、齒輪咬合轉動……
// 介面（puzzles.mjs）送事件：react(東西, 名稱, 資料)；答錯 'wrong'、解開 'solved'（world.fx 一起送）。
// 每個會動的東西叫一個「機關」（rig）：{ on(名稱, 資料), solved(立刻?), tick(dt) }。scene.mjs 的 REPLACE 列出的東西，靜態的那份不蓋，由這裡蓋會動的版本。
import * as THREE from 'three';
import { decorators } from '../world/art-hooks.mjs';
import { ROOMS } from '../data/world-ch1.mjs';
import { SOKOBAN } from '../data/library-ch1.mjs';
import { LEVERS, BOLTS_LOCKED } from '../data/act4-ch1.mjs';
import { MAT, std, glow } from './scene.mjs';

const LIVE = new Map(); // `${puzzle}:${id}` → 機關
const keyOf = (t) => `${t.puzzle}:${t.id}`;
const ease = (x) => x * x * (3 - 2 * x);
const lerp = THREE.MathUtils.lerp;
const ZODIAC = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const ZODIAC_ID = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const HOUSE_COLOR = { eldrin: '#9fc4ff', grimoire: '#c0454f', belmont: '#d1a640', ouroboros: '#4fa37a' };

// ---------- 小工具 ----------
// 東西面向房間中間（只取一個軸）；回傳讓群組的 +z 朝房間的旋轉角
function facing(t) {
  const r = ROOMS.find((q) => t.x >= q.x[0] && t.x <= q.x[1] && t.z >= q.z[0] && t.z <= q.z[1]);
  if (!r) return 0;
  const dx = (r.x[0] + r.x[1]) / 2 - t.x, dz = (r.z[0] + r.z[1]) / 2 - t.z;
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI);
}
function rigAt(t, group, ry = facing(t)) { const g = new THREE.Group(); g.position.set(t.x, t.y ?? 0, t.z); g.rotation.y = ry; group.add(g); return g; }
const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = null) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent?.add(m); return m; };
// 會發光、亮度可以調的材質（每個機關自己一份）
const glowMat = (color, k = 0) => new THREE.MeshStandardMaterial({ color: '#222', emissive: color, emissiveIntensity: k, roughness: 0.4 });
// 動畫：每一格往目標靠近（彈性一點）
class Tween {
  constructor() { this.list = []; }
  to(obj, key, target, dur = 0.5, done) { this.list = this.list.filter((a) => !(a.obj === obj && a.key === key)); this.list.push({ obj, key, from: obj[key], target, dur, t: 0, done }); }
  tick(dt) {
    for (const a of this.list) { a.t = Math.min(1, a.t + dt / a.dur); a.obj[a.key] = lerp(a.from, a.target, ease(a.t)); }
    const fin = this.list.filter((a) => a.t >= 1); this.list = this.list.filter((a) => a.t < 1); for (const a of fin) a.done?.();
  }
}
// 文字貼圖（符文、星座）
function glyphTex(text, { size = 128, color = '#ffffff', font = 'serif', bg = null } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, size, size); }
  g.fillStyle = color; g.font = `${size * 0.7}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, size / 2, size * 0.54);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
const glyphCache = new Map();
const glyph = (text, color = '#ffffff') => glyphCache.get(text + color) ?? glyphCache.set(text + color, glyphTex(text, { color })).get(text + color);
function glyphPlane(text, s, color = '#ffd27a') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: glyph(text), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  m.renderOrder = 4; return m;
}
// 一閃一閃的光暈（不加燈）
function halo(color, s = 0.5) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  sp.scale.setScalar(s); sp.renderOrder = 5; return sp;
}
// 答錯：整組東西抖一下（共用）
function shaker(g) { let t = 0; const base = g.position.clone(); return { start() { t = 0.35; }, tick(dt) { if (t <= 0) return; t -= dt; g.position.x = base.x + Math.sin(t * 90) * 0.012 * (t / 0.35); if (t <= 0) g.position.copy(base); } }; }

// ---------- 各個機關 ----------
const RIGS = {
  // P03：艾爾德林的星座盤。按了哪個星座，指針就轉過去、那個符號亮起來；解開時整圈發金光
  'P03:lock_eldrin'(t, group) {
    const g = rigAt(t, group, Math.sign(t.x) > 0 ? Math.PI / 2 : -Math.PI / 2), y = t.size[1] * 0.55;
    const plate = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 32), MAT.brass(), 0, y, 0.03, g); plate.rotation.x = Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.3, 0.015, 6, 36), MAT.iron(), 0, y, 0.06, g);
    const syms = ZODIAC.map((z, i) => { const a = Math.PI / 2 - (i / 12) * Math.PI * 2, m = glyphPlane(z, 0.11, '#e8d8b0'); m.material.opacity = 0.55; m.position.set(Math.cos(a) * 0.25, y + Math.sin(a) * 0.25, 0.062); g.add(m); return m; });
    const hand = new THREE.Group(); hand.position.set(0, y, 0.065); g.add(hand);
    mesh(new THREE.BoxGeometry(0.02, 0.2, 0.01), MAT.iron(), 0, 0.09, 0, hand); mesh(new THREE.SphereGeometry(0.03, 10, 8), MAT.brass(), 0, 0, 0.01, hand);
    const tw = new Tween(), sh = shaker(g); let lit = -1, flash = 0, done = false, spin = 0;
    const light = (i, c) => syms.forEach((m, k) => { m.material.color.set(k === i ? c : '#e8d8b0'); m.material.opacity = k === i ? 1 : 0.55; });
    return {
      on(n, d) {
        if (n === 'zodiac') { const i = typeof d.i === 'number' ? d.i : ZODIAC_ID.indexOf(d.id); if (i < 0) return; lit = i; light(i, '#9fc4ff'); tw.to(hand.rotation, 'z', -(i / 12) * Math.PI * 2 - Math.round((hand.rotation.z + (i / 12) * Math.PI * 2) / (Math.PI * 2)) * Math.PI * 2, 0.5); }
        if (n === 'wrong') { sh.start(); if (lit >= 0) light(lit, '#ff5a4a'); flash = 0.6; }
      },
      solved(now) { done = true; syms.forEach((m) => { m.material.color.set('#ffd27a'); m.material.opacity = 1; }); if (!now) spin = 1.5; },
      tick(dt) { tw.tick(dt); sh.tick(dt); if (flash > 0 && (flash -= dt) <= 0 && !done && lit >= 0) light(lit, '#9fc4ff'); if (spin > 0) { spin -= dt; hand.rotation.z -= dt * 12 * spin; } },
    };
  },

  // P04：格里莫瓦的石板。輸入的數字有幾，石板邊上就亮幾顆符文；解開時中間的 ᛁ 燒成金色
  'P04:lock_grimoire'(t, group) {
    const g = rigAt(t, group, Math.sign(t.x) > 0 ? Math.PI / 2 : -Math.PI / 2), y = t.size[1] * 0.55;
    const big = glyphPlane('ᛁ', 0.32, '#7ab0ff'); big.material.opacity = 0.5; big.position.set(0, y, 0.06); g.add(big);
    const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    const ring = [...RUNES].map((r, i) => { const a = Math.PI / 2 - (i / 24) * Math.PI * 2, m = glyphPlane(r, 0.06, '#7ab0ff'); m.material.opacity = 0.12; m.position.set(Math.cos(a) * 0.19, y + Math.sin(a) * 0.25, 0.06); g.add(m); return m; });
    const sh = shaker(g); let n0 = 0, pulse = 0;
    const show = (n, c = '#7ab0ff') => ring.forEach((m, i) => { m.material.color.set(c); m.material.opacity = i < n ? 0.95 : 0.12; });
    return {
      on(n, d) { if (n === 'digits') { n0 = Math.max(0, Math.min(24, parseInt(d.v, 10) || 0)); show(n0); pulse = 1; } if (n === 'wrong') { sh.start(); show(n0, '#ff5a4a'); } },
      solved() { show(24, '#ffd27a'); big.material.color.set('#ffd27a'); big.material.opacity = 1; },
      tick(dt) { sh.tick(dt); if (pulse > 0) { pulse -= dt * 1.5; big.material.opacity = 0.5 + 0.5 * Math.max(0, pulse); } },
    };
  },

  // P05：貝爾蒙特的獵物天平。打開時秤桿晃動；解開時最重的熊掌浮起來發光，秤桿慢慢擺回平衡
  'P05:scale'(t, group) {
    const g = rigAt(t, group, 0), [w, h] = t.size;
    mesh(new THREE.BoxGeometry(w * 0.5, 0.12, 0.5), MAT.darkWood(), 0, 0.06, 0, g); mesh(new THREE.CylinderGeometry(0.05, 0.07, h, 8), MAT.brass(), 0, h / 2, 0, g);
    const beam = new THREE.Group(); beam.position.y = h; g.add(beam);
    mesh(new THREE.BoxGeometry(w, 0.05, 0.05), MAT.brass(), 0, 0, 0, beam); mesh(new THREE.SphereGeometry(0.06, 10, 8), MAT.brass(), 0, 0, 0, beam);
    const pans = [-1, 1].map((s) => {
      const hang = new THREE.Group(); hang.position.x = s * w * 0.48; beam.add(hang);
      const p = new THREE.Group(); hang.add(p); // 秤盤一直保持水平（抵銷秤桿的角度）
      mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.4, 4), MAT.iron(), 0, -0.2, 0, p); mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.05, 16), MAT.brass(), 0, -0.42, 0, p);
      return { hang, p };
    });
    const fur = std('fur', { color: '#5a5048', roughness: 1 }), bone = std('bone', { color: '#e8dcc0', roughness: 0.6 }), dark = std('bearFur', { color: '#2a1e16', roughness: 1 });
    // 左盤：狼頭、鹿角；右盤：熊掌、野豬牙
    const wolf = new THREE.Group(); mesh(new THREE.SphereGeometry(0.08, 10, 8), fur, 0, 0, 0, wolf); const sn = mesh(new THREE.ConeGeometry(0.045, 0.12, 8), fur, 0, -0.01, 0.09, wolf); sn.rotation.x = Math.PI / 2; for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(0.025, 0.06, 4), fur, s * 0.045, 0.08, -0.01, wolf);
    wolf.position.set(-0.07, -0.33, 0); pans[0].p.add(wolf);
    const antler = new THREE.Group(); for (const [a, l] of [[0, 0.22], [0.6, 0.1], [-0.5, 0.09], [0.3, 0.12]]) { const m = mesh(new THREE.CylinderGeometry(0.008, 0.014, l, 5), bone, Math.sin(a) * l * 0.4, l / 2, 0, antler); m.rotation.z = -a; }
    antler.position.set(0.08, -0.4, 0); antler.rotation.z = 0.7; pans[0].p.add(antler);
    const paw = new THREE.Group(); const pp = mesh(new THREE.SphereGeometry(0.09, 10, 8), dark, 0, 0, 0, paw); pp.scale.set(1, 0.55, 1.2); for (let i = 0; i < 4; i++) { const c = mesh(new THREE.ConeGeometry(0.012, 0.06, 5), bone, -0.05 + i * 0.034, 0, 0.11, paw); c.rotation.x = Math.PI / 2; }
    paw.position.set(-0.06, -0.35, 0); pans[1].p.add(paw);
    const tusk = new THREE.Group(); for (const s of [-1, 1]) { const m = mesh(new THREE.ConeGeometry(0.018, 0.16, 6), bone, s * 0.03, 0.05, 0, tusk); m.rotation.z = s * 0.5; } tusk.position.set(0.09, -0.4, 0); pans[1].p.add(tusk);
    const pawGlow = halo('#ffd27a', 0.5); paw.add(pawGlow);
    let ang = 0.12, vel = 0, rest = 0.12, lift = 0, liftT = 0; // 右邊比較重（熊掌）：秤桿往右下
    const kick = (v) => { vel += v; };
    return {
      on(n) { if (n === 'open') kick(-0.9); if (n === 'digits') kick(0.25 * (Math.random() - 0.5)); if (n === 'wrong') kick(0.8); },
      solved(now) { lift = 1; rest = -0.04; if (now) { liftT = 1; ang = rest; } },
      tick(dt) {
        vel += (rest - ang) * 18 * dt; vel *= Math.pow(0.12, dt); ang += vel * dt; // 彈簧＋阻尼
        beam.rotation.z = -ang; for (const p of pans) p.p.rotation.z = ang;
        if (lift) { liftT = Math.min(1, liftT + dt * 0.6); const k = ease(liftT); paw.position.y = -0.35 + k * 0.5; paw.rotation.y += dt * 1.5; pawGlow.material.opacity = Math.sin(k * Math.PI) * 0.9 + (k >= 1 ? 0.25 : 0); }
      },
    };
  },

  // P06：烏洛波斯的兩個沙漏（7 分、11 分）。沙子跟著視窗裡的計時漏下來；按翻轉，沙漏真的翻過來
  'P06:hourglass'(t, group) {
    const g = rigAt(t, group, 0), [w, h, d] = t.size;
    mesh(new THREE.BoxGeometry(w, 0.06, d), MAT.darkWood(), 0, h * 0.6, 0, g); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.08, h * 0.6, 0.08), MAT.darkWood(), s * w * 0.42, h * 0.3, 0, g);
    const glassMat = std('hgGlass2', { color: '#cfe6ff', transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false }), sandMat = std('sand2', { color: '#a87a3a', roughness: 0.95, emissive: '#2a1a08', emissiveIntensity: 0.2 });
    const glasses = {};
    [7, 11].forEach((n, i) => {
      const pivot = new THREE.Group(); pivot.position.set((i ? 1 : -1) * w * 0.24, h * 0.6 + 0.03 + 0.24, 0); g.add(pivot);
      for (const y of [-0.225, 0.225]) mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 14), MAT.brass(), 0, y, 0, pivot);
      for (const a of [0, 1, 2]) { const an = (a / 3) * Math.PI * 2; mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.45, 4), MAT.brass(), Math.cos(an) * 0.105, 0, Math.sin(an) * 0.105, pivot); }
      mesh(new THREE.CylinderGeometry(0.1, 0.018, 0.2, 14, 1, true), glassMat, 0, 0.1, 0, pivot); mesh(new THREE.CylinderGeometry(0.018, 0.1, 0.2, 14, 1, true), glassMat, 0, -0.1, 0, pivot);
      // 上半的沙：倒錐（尖端朝下），縮放表示剩多少；下半的沙：錐（尖端朝上）
      const top = mesh(new THREE.ConeGeometry(0.085, 0.17, 14), sandMat, 0, 0.02, 0, pivot); top.rotation.x = Math.PI; top.geometry.translate(0, -0.085, 0);
      const bot = mesh(new THREE.ConeGeometry(0.09, 0.17, 14), sandMat, 0, -0.205, 0, pivot); bot.geometry.translate(0, 0.085, 0);
      const stream = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), sandMat, 0, -0.1, 0, pivot);
      const label = glyphPlane(String(n), 0.08, '#e8d8b0'); label.material.opacity = 0.8; label.position.set(0, -0.27, 0.13); pivot.add(label);
      glasses[n] = { pivot, top, bot, stream, n, ft: 0, fb: 1, wantT: 0, wantB: 1, flip: 0 };
    });
    const set = (G, topV, botV) => { G.wantT = topV / G.n; G.wantB = botV / G.n; };
    const apply = (G) => { const ts = Math.cbrt(Math.max(0.001, G.ft)), bs = Math.cbrt(Math.max(0.001, G.fb)); G.top.scale.set(ts, Math.max(0.001, G.ft), ts); G.bot.scale.set(bs, Math.max(0.001, G.fb), bs); G.top.visible = G.ft > 0.01; G.bot.visible = G.fb > 0.01; G.stream.visible = G.ft > 0.01 && !G.flip; };
    let glowK = 0; const goldMat = sandMat;
    Object.values(glasses).forEach((G) => apply(G));
    return {
      on(n, d) {
        if (n === 'sand') for (const k of [7, 11]) if (d[k]) set(glasses[k], d[k].top, d[k].bot);
        if (n === 'flip') for (const k of d.g ?? []) { const G = glasses[k]; G.flip = 1; [G.ft, G.fb] = [G.fb, G.ft]; G.pivot.rotation.z = Math.PI; } // 先把沙子對調，再從倒過來的樣子轉回正
        if (n === 'reset') for (const k of [7, 11]) set(glasses[k], 0, k);
      },
      solved() { glowK = 1; },
      tick(dt) {
        for (const G of Object.values(glasses)) {
          if (G.flip) { G.flip = Math.max(0, G.flip - dt * 2.2); G.pivot.rotation.z = Math.PI * ease(G.flip); }
          G.ft += (G.wantT - G.ft) * Math.min(1, dt * 8); G.fb += (G.wantB - G.fb) * Math.min(1, dt * 8); apply(G);
        }
        if (glowK > 0) { glowK = Math.max(0.35, glowK - dt * 0.3); goldMat.emissive.set('#ffb040'); goldMat.emissiveIntensity = glowK; }
      },
    };
  },

  // P07：宿舍的窗戶。按「看燭光」時，遠方塔樓的窗裡真的有燭光一閃一閃
  'P07:window'(t, group) {
    const g = rigAt(t, group); // +z 朝房間，窗外是 -z
    // 窗玻璃是畫上去的夜空（不透明），燭光就畫在玻璃上：遠方四座塔的窗，小小的光點
    const lamps = {}; let k = 0; const [, h, d] = t.size;
    for (const hh of Object.keys(HOUSE_COLOR)) { const sp = halo(HOUSE_COLOR[hh], 0.12); sp.position.set((k - 1.5) * d * 0.22, h * (0.62 + (k % 2) * 0.15), 0.09); g.add(sp); lamps[hh] = sp; k++; }
    return { on(n, d) { if (n === 'blink' && lamps[d.house]) lamps[d.house].material.opacity = d.on ? 1 : 0.08; if (n === 'open') for (const sp of Object.values(lamps)) sp.material.opacity = 0.15; }, solved() {}, tick() {} };
  },

  // P08：星盤。四個圓環換上學院的徽章、轉到時辰；解開時圓環發光、中間的渾天儀轉起來
  'P08:disk'(t, group) {
    const g = rigAt(t, group, 0), R = t.size[0] / 2;
    mesh(new THREE.CylinderGeometry(R, R * 1.05, 0.25, 40), MAT.stone(), 0, 0.125, 0, g);
    const ringMat = (i) => new THREE.MeshStandardMaterial({ color: '#b08a3a', metalness: 0.85, roughness: 0.35, emissive: '#ffb040', emissiveIntensity: 0 });
    const rings = [0.3, 0.5, 0.7, 0.9].map((f, i) => {
      const r = R * f, grp = new THREE.Group(); grp.position.y = 0.3 + i * 0.015; g.add(grp);
      const mat = ringMat(i); const tor = mesh(new THREE.TorusGeometry(r, 0.035, 6, 64), mat, 0, 0, 0, grp); tor.rotation.x = Math.PI / 2;
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; mesh(new THREE.BoxGeometry(0.02, 0.02, 0.08), mat, Math.sin(a) * r, 0.03, Math.cos(a) * r, grp).rotation.y = a; }
      const badge = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), new THREE.MeshStandardMaterial({ color: '#333', emissive: '#000', roughness: 0.4 }), 0, 0.05, r, grp); badge.visible = false;
      const gem = mesh(new THREE.OctahedronGeometry(0.05), glowMat('#9fc4ff', 0.6), 0, 0.1, r, grp);
      return { grp, mat, badge, gem };
    });
    // 中間的柱子與渾天儀
    mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.2, 8), MAT.brass(), 0, 0.85, 0, g);
    const arm = new THREE.Group(); arm.position.y = 1.5; g.add(arm);
    const a1 = mesh(new THREE.TorusGeometry(0.5, 0.02, 6, 32), MAT.brass(), 0, 0, 0, arm); a1.rotation.set(0.4, 0.3, 0);
    const a2 = mesh(new THREE.TorusGeometry(0.42, 0.02, 6, 32), MAT.brass(), 0, 0, 0, arm); a2.rotation.set(-0.6, 1.2, 0);
    const orbMat = glowMat('#9fb4ff', 0.8); mesh(new THREE.SphereGeometry(0.12, 14, 10), orbMat, 0, 0, 0, arm);
    const tw = new Tween(), sh = shaker(g); let spin = 0.15, done = false;
    return {
      on(n, d) {
        if (n === 'ring') { const r = rings[d.i]; if (!r) return; r.badge.visible = !!d.house; if (d.house) { r.badge.material.color.set(HOUSE_COLOR[d.house]); r.badge.material.emissive.set(HOUSE_COLOR[d.house]); r.badge.material.emissiveIntensity = 0.5; } tw.to(r.grp.rotation, 'y', -((+d.hour || 12) % 12) / 12 * Math.PI * 2, 0.7); }
        if (n === 'wrong') { sh.start(); for (const r of rings) r.gem.material.emissive.set('#ff5a4a'); setTimeout(() => { for (const r of rings) r.gem.material.emissive.set('#9fc4ff'); }, 700); }
      },
      solved(now) { done = true; for (const r of rings) { r.mat.emissiveIntensity = now ? 0.5 : 1.2; r.gem.material.emissive.set('#ffd27a'); } orbMat.emissive.set('#ffd27a'); orbMat.emissiveIntensity = 2; spin = 1.5; },
      tick(dt) { tw.tick(dt); sh.tick(dt); arm.rotation.y += dt * spin; if (done) { spin = Math.max(0.4, spin - dt * 0.3); for (const r of rings) r.mat.emissiveIntensity = Math.max(0.45, r.mat.emissiveIntensity - dt * 0.4); } },
    };
  },

  // P16：自己翻頁的書。書頁真的一頁一頁翻（跟視窗裡的翻頁同步）
  'P16:flipbook'(t, group) {
    const g = rigAt(t, group, 0);
    const page = new THREE.Group(); page.position.set(0, 0.935, 0); page.rotation.x = -0.35; g.add(page);
    const leaf = mesh(new THREE.PlaneGeometry(0.17, 0.24), MAT.parchment(), 0.085, 0, 0, null); leaf.material = leaf.material.clone(); leaf.material.side = THREE.DoubleSide; leaf.rotation.x = -Math.PI / 2;
    const hinge = new THREE.Group(); hinge.add(leaf); page.add(hinge);
    const aura = halo('#c9a86a', 0.7); aura.position.set(0, 1.05, 0); g.add(aura);
    let flipT = 1, auto = 1.2;
    const flip = () => { flipT = 0; };
    return {
      on(n) { if (n === 'page') flip(); if (n === 'open') aura.material.opacity = 0.35; },
      solved() { aura.material.color.set('#ffd27a'); aura.material.opacity = 0.8; auto = 0; },
      tick(dt) {
        if (auto) { auto -= dt; if (auto <= 0) { flip(); auto = 2.4; } } // 沒在看的時候也慢慢自己翻
        if (flipT < 1) { flipT = Math.min(1, flipT + dt * 2.2); hinge.rotation.z = Math.PI * ease(flipT); leaf.material.opacity = 1; } else hinge.rotation.z = 0;
      },
    };
  },

  // P17：東方典藏櫃。切換卦象的橫槓時，抽屜跟著喀喀作響；解開時那一格抽屜自己滑出來、裡面發光
  'P17:eastern'(t, group) {
    const g = rigAt(t, group), [, h, d] = t.size;
    const drawer = new THREE.Group(); drawer.position.set(d * 0.125, h * (2.5 / 6), 0.31); g.add(drawer);
    mesh(new THREE.BoxGeometry(d / 4 - 0.04, h / 6 - 0.04, 0.03), std('lacquerDrawerLive', { color: '#9a2420', roughness: 0.35 }), 0, 0, 0, drawer);
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8), MAT.brass(), 0, 0, 0.03, drawer).rotation.x = Math.PI / 2;
    const inside = halo('#ffd27a', 0.45); inside.position.set(0, 0.02, -0.08); drawer.add(inside);
    const tw = new Tween(); let rattle = 0;
    return {
      on(n) { if (n === 'bars') rattle = 0.25; if (n === 'wrong') rattle = 0.5; },
      solved(now) { inside.material.opacity = 0.9; if (now) drawer.position.z = 0.6; else tw.to(drawer.position, 'z', 0.6, 1.2); },
      tick(dt) { tw.tick(dt); if (rattle > 0) { rattle -= dt; drawer.rotation.z = Math.sin(rattle * 80) * 0.03 * rattle * 4; } else drawer.rotation.z = 0; },
    };
  },

  // P18：符文大門。按下的符文一個一個亮在門上；按錯整排熄掉，解開時整面門燒成金色
  'P18:runedoor'(t, group) {
    const g = rigAt(t, group), [, h, d] = t.size;
    const slots = [0, 1, 2, 3, 4, 5].map((i) => { const m = glyphPlane('ᚠ', 0.28, '#9fc4ff'); m.position.set((i - 2.5) * (d * 0.14), h * 0.62, 0.16); g.add(m); return m; });
    const seal = halo('#9fc4ff', 1.6); seal.position.set(0, h * 0.62, 0.2); g.add(seal);
    let fade = 0;
    const show = (seq, color = '#9fc4ff') => slots.forEach((m, i) => { if (seq[i]) { m.material.map = glyph(seq[i]); m.material.needsUpdate = true; m.material.opacity = 1; m.material.color.set(color); } else m.material.opacity = 0; });
    let last = [];
    return {
      on(n, d) { if (n === 'runes') { last = d.seq ?? []; show(last); seal.material.opacity = 0.15 * last.length; } if (n === 'wrong') { show(last, '#ff5a4a'); fade = 0.8; } },
      solved() { slots.forEach((m) => { m.material.color.set('#ffd27a'); m.material.opacity = 1; }); seal.material.color.set('#ffd27a'); seal.material.opacity = 1; seal.scale.setScalar(3); },
      tick(dt) { if (fade > 0 && (fade -= dt) <= 0) { last = []; show(last); seal.material.opacity = 0; } },
    };
  },

  // P20：四座石像鬼。視窗裡推石像，場景裡的石像鬼也在地上的格子間滑動；石像推到發光的符文上，眼睛亮起來
  'P20:statues'(t, group) {
    const g = rigAt(t, group, 0), C = 0.45; // 一格 45 公分；棋盤的中心（3,3）在東西的位置
    const at = (x, y) => [(x - 3) * C, (y - 3) * C];
    const st = MAT.stone(), eyesOff = new THREE.MeshBasicMaterial({ color: '#222' });
    const targets = [], statues = [];
    SOKOBAN.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === 'T') { const [px, pz] = at(x, y), m = mesh(new THREE.RingGeometry(0.12, 0.17, 24), new THREE.MeshBasicMaterial({ color: '#7ab0ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide }), px, 0.015, pz, g); m.rotation.x = -Math.PI / 2; targets.push({ m, x, y }); }
      if (c === 'B') {
        const s = new THREE.Group(); const [px, pz] = at(x, y); s.position.set(px, 0, pz); g.add(s);
        mesh(new THREE.BoxGeometry(0.3, 0.38, 0.3), st, 0, 0.19, 0, s); mesh(new THREE.SphereGeometry(0.14, 10, 8), st, 0, 0.52, 0, s);
        for (const sx of [-1, 1]) { mesh(new THREE.ConeGeometry(0.045, 0.14, 4), st, sx * 0.08, 0.68, 0, s); const wg = mesh(new THREE.BoxGeometry(0.03, 0.28, 0.24), st, sx * 0.16, 0.47, -0.04, s); wg.rotation.z = -sx * 0.5; }
        const eyes = []; for (const sx of [-1, 1]) eyes.push(mesh(new THREE.SphereGeometry(0.022, 6, 5), eyesOff, sx * 0.05, 0.55, 0.125, s));
        statues.push({ s, eyes, x, y, tx: px, tz: pz });
      }
    }));
    const wisp = halo('#9fc4ff', 0.35); g.add(wisp); { const [px, pz] = at(1, 1); wisp.position.set(px, 0.5, pz); }
    const wispTo = wisp.position.clone(); const eyesOn = new THREE.MeshBasicMaterial({ color: '#7ab0ff' });
    let done = false, time = 0;
    return {
      on(n, d) {
        if (n === 'open') wisp.material.opacity = 0.9;
        if (n === 'board') {
          // 依位置配對（每次只會有一座被推一格）：沒動的留著，動的那座換到新位置
          const want = d.boxes.map(([x, y]) => `${x},${y}`), have = statues.map((q) => `${q.x},${q.y}`);
          const free = statues.filter((q) => !want.includes(`${q.x},${q.y}`)), news = d.boxes.filter(([x, y]) => !have.includes(`${x},${y}`));
          free.forEach((q, i) => { const nb = news[i]; if (!nb) return; q.x = nb[0]; q.y = nb[1]; [q.tx, q.tz] = at(q.x, q.y); });
          for (const q of statues) { const on = targets.some((tg) => tg.x === q.x && tg.y === q.y); for (const e of q.eyes) e.material = on ? eyesOn : eyesOff; }
          if (d.player) { const [px, pz] = at(...d.player); wispTo.set(px, 0.5, pz); }
        }
      },
      solved() { done = true; for (const q of statues) for (const e of q.eyes) e.material = eyesOn; eyesOn.color.set('#ffd27a'); for (const tg of targets) tg.m.material.color.set('#ffd27a'); },
      tick(dt) {
        time += dt;
        for (const q of statues) { q.s.position.x += (q.tx - q.s.position.x) * Math.min(1, dt * 6); q.s.position.z += (q.tz - q.s.position.z) * Math.min(1, dt * 6); }
        wisp.position.lerp(wispTo, Math.min(1, dt * 8)); wisp.position.y = 0.5 + Math.sin(time * 3) * 0.05;
        for (const tg of targets) tg.m.material.opacity = 0.45 + 0.2 * Math.sin(time * 2 + tg.x);
        if (done) wisp.material.opacity = Math.max(0, wisp.material.opacity - dt);
      },
    };
  },

  // P21：煉金天平與九瓶藥劑。點瓶子放到左右盤，秤的時候秤桿真的往重的那邊倒
  'P21:scale'(t, group) {
    const g = rigAt(t, group), [w, h] = t.size;
    mesh(new THREE.BoxGeometry(w, 0.06, 0.6), MAT.darkWood(), 0, h * 0.55, 0, g); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.06, h * 0.55, 0.5), MAT.darkWood(), s * w * 0.45, h * 0.275, 0, g);
    const top = h * 0.58; mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 8), MAT.brass(), 0, top + 0.3, -0.15, g);
    const beam = new THREE.Group(); beam.position.set(0, top + 0.6, -0.15); g.add(beam);
    mesh(new THREE.BoxGeometry(0.8, 0.03, 0.03), MAT.brass(), 0, 0, 0, beam);
    const pans = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.x = s * 0.38; beam.add(p); mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.25, 4), MAT.iron(), 0, -0.125, 0, p); mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.03, 14), MAT.brass(), 0, -0.26, 0, p); return p; });
    const colors = ['#d8c040', '#c0c8d0', '#e8e4dc', '#e85a2a', '#3a7ad8', '#a8d8e8', '#7a5a3a', '#ffd040', '#c8d0e8'];
    const vials = colors.map((c, i) => {
      const v = new THREE.Group(); const home = new THREE.Vector3(-0.4 + i * 0.1, top + 0.01, 0.18); v.position.copy(home); g.add(v);
      mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.09, 8), std('vialGlass', { color: '#cfe0f0', transparent: true, opacity: 0.35, roughness: 0.05 }), 0, 0.045, 0, v);
      const liq = mesh(new THREE.CylinderGeometry(0.022, 0.027, 0.06, 8), glowMat(c, 0.35), 0, 0.03, 0, v); liq.material.color.set(c);
      mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6), MAT.darkWood(), 0, 0.1, 0, v);
      return { v, home, to: home.clone(), liq };
    });
    let ang = 0, want = 0, hold = 0;
    const panPos = (side, k) => { const p = new THREE.Vector3(); pans[side].getWorldPosition(p); g.worldToLocal(p); return p.add(new THREE.Vector3((k % 3 - 1) * 0.05, -0.245, (Math.floor(k / 3) - 0.5) * 0.05)); };
    let sides = Array(9).fill('');
    const place = () => { const cnt = [0, 0]; vials.forEach((q, i) => { const sd = sides[i] === 'L' ? 0 : sides[i] === 'R' ? 1 : -1; q.to = sd < 0 ? q.home.clone() : panPos(sd, cnt[sd]++); }); };
    return {
      on(n, d) {
        if (n === 'vials') { sides = [...d.side]; place(); }
        if (n === 'weigh') { want = d.result === 'left' ? 0.22 : d.result === 'right' ? -0.22 : 0; hold = 2.5; }
        if (n === 'pick') { const q = vials[d.i]; if (q) q.liq.material.emissiveIntensity = 1.5; }
      },
      solved() { for (const q of vials) q.liq.material.emissiveIntensity = 1; },
      tick(dt) {
        if (hold > 0 && (hold -= dt) <= 0) { want = 0; sides.fill(''); place(); }
        ang += (want - ang) * Math.min(1, dt * 3); beam.rotation.z = ang; for (const p of pans) p.rotation.z = -ang;
        if (want === 0 && hold <= 0) place(); else { // 秤盤動了，盤上的瓶子跟著
          const cnt = [0, 0]; vials.forEach((q, i) => { const sd = sides[i] === 'L' ? 0 : sides[i] === 'R' ? 1 : -1; if (sd >= 0) q.to = panPos(sd, cnt[sd]++); });
        }
        for (const q of vials) q.v.position.lerp(q.to, Math.min(1, dt * 7));
      },
    };
  },

  // P25：井蓋上的三個圓環。視窗裡轉幾格，井蓋的圓環就轉幾格；解開時井蓋滑開、井底透出光
  'P25:well'(t, group) {
    const g = rigAt(t, group, 0), R = t.size[0] / 2, H = t.size[1];
    mesh(new THREE.CylinderGeometry(R, R * 1.05, H, 24), MAT.stone(), 0, H / 2, 0, g);
    const lid = new THREE.Group(); lid.position.y = H + 0.03; g.add(lid);
    mesh(new THREE.CylinderGeometry(R * 0.85, R * 0.85, 0.06, 24), MAT.iron(), 0, 0, 0, lid);
    const rings = [0.3, 0.55, 0.8].map((f) => {
      const grp = new THREE.Group(); grp.position.y = 0.04; lid.add(grp);
      const tor = mesh(new THREE.TorusGeometry(R * f, 0.03, 5, 40), MAT.brass(), 0, 0, 0, grp); tor.rotation.x = Math.PI / 2;
      const mark = mesh(new THREE.ConeGeometry(0.04, 0.1, 4), glowMat('#9fc4ff', 0.8), 0, 0.03, R * f, grp); mark.rotation.x = Math.PI / 2;
      for (let k = 0; k < 13; k++) { const a = (k / 13) * Math.PI * 2; mesh(new THREE.BoxGeometry(0.015, 0.015, 0.05), MAT.brass(), Math.sin(a) * (R * f + 0.06), 0, Math.cos(a) * (R * f + 0.06), lid).rotation.y = a; }
      return { grp, mark };
    });
    const deep = halo('#7ab0ff', R * 2); deep.position.y = H - 0.05; g.add(deep);
    const tw = new Tween(), sh = shaker(g);
    return {
      on(n, d) { if (n === 'rings') d.rings.forEach((v, i) => tw.to(rings[i].grp.rotation, 'y', (v / 13) * Math.PI * 2, 0.4)); if (n === 'wrong') sh.start(); },
      solved(now) { for (const r of rings) r.mark.material.emissive.set('#ffd27a'); deep.material.opacity = 0.9; if (now) lid.position.x = R * 1.4; else tw.to(lid.position, 'x', R * 1.4, 2); },
      tick(dt) { tw.tick(dt); sh.tick(dt); },
    };
  },

  // P26：卡住的鐵門與四根拉桿。拉哪一根，那根拉桿就扳下去，門閂跟著滑開或鎖上；解開時整扇門升起來
  'P26:ironDoor'(t, group) {
    const g = rigAt(t, group), [, h, d] = t.size;
    const door = new THREE.Group(); g.add(door);
    mesh(new THREE.BoxGeometry(d, h, 0.12), MAT.iron(), 0, h / 2, 0, door);
    for (let i = 0; i < 6; i++) mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 6), MAT.iron(), -d / 2 + 0.1, 0.3 + i * 0.36, 0.08, door).rotation.x = Math.PI / 2;
    const bolts = [1, 2, 3, 4].map((b) => { const m = mesh(new THREE.BoxGeometry(0.28, 0.08, 0.08), std('bolt', { color: '#6a6a70', metalness: 0.7, roughness: 0.4 }), d / 2 - 0.05, 0.5 + b * 0.38, 0.1, door); return m; });
    const knob = std('leverKnob', { color: '#6a1a14' });
    const levers = Object.keys(LEVERS).map((k, i) => {
      const p = new THREE.Group(); p.position.set(-d * 0.3 + i * d * 0.2, 1.2, 0.12); g.add(p);
      mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), MAT.iron(), 0, 0, 0, p);
      const arm = new THREE.Group(); p.add(arm); mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), MAT.iron(), 0, 0.22, 0, arm); mesh(new THREE.SphereGeometry(0.04, 8, 6), knob, 0, 0.45, 0, arm);
      const lab = glyphPlane(k, 0.09, '#e8d8b0'); lab.material.opacity = 0.9; lab.position.set(0, -0.1, 0.04); p.add(lab);
      arm.rotation.x = 0.6; return { k, arm, up: true };
    });
    const tw = new Tween(), sh = shaker(g);
    const setBolts = (locked) => bolts.forEach((m, i) => { tw.to(m.position, 'x', locked.includes(i + 1) ? d / 2 - 0.05 : d / 2 - 0.3, 0.35); m.material = m.material; });
    setBolts(BOLTS_LOCKED); tw.tick(1);
    return {
      on(n, d2) {
        if (n === 'pull') { const L = levers.find((q) => q.k === d2.k); if (L) { L.up = !L.up; tw.to(L.arm.rotation, 'x', L.up ? 0.6 : -0.6, 0.25); } }
        if (n === 'levers') { setBolts(d2.locked ?? []); if (d2.reset) for (const L of levers) { L.up = true; tw.to(L.arm.rotation, 'x', 0.6, 0.3); } }
        if (n === 'wrong') sh.start();
      },
      solved(now) { if (now) door.position.y = h - 0.2; else tw.to(door.position, 'y', h - 0.2, 2.2); setBolts([]); },
      tick(dt) { tw.tick(dt); sh.tick(dt); },
    };
  },

  // P27：鐘槌的齒輪組。選的齒輪真的裝上軸；全部咬合時一起轉（大小不同，轉速也不同）；解開時轉快、發光
  'P27:gearwall'(t, group) {
    const g = rigAt(t, group, Math.PI), [w, h, d] = t.size, U = 0.075; // 半徑：齒數 ÷ 6 × U 公尺
    mesh(new THREE.BoxGeometry(w, h, 0.15), MAT.darkWood(), 0, h / 2, -d / 2 + 0.08, g);
    const iron = new THREE.MeshStandardMaterial({ color: '#4a3e30', metalness: 0.6, roughness: 0.5, emissive: '#ffb040', emissiveIntensity: 0 });
    const gearCache = new Map();
    const gearGeo = (teeth) => {
      if (gearCache.has(teeth)) return gearCache.get(teeth);
      const r = (teeth / 6) * U, shape = new THREE.Shape(), n = teeth;
      for (let i = 0; i < n * 2; i++) { const a0 = (i / (n * 2)) * Math.PI * 2, a1 = ((i + 1) / (n * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.88 : r + 0.02; if (!i) shape.moveTo(Math.cos(a0) * rr, Math.sin(a0) * rr); else shape.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr); shape.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr); }
      const hole = new THREE.Path(); hole.absarc(0, 0, 0.03, 0, Math.PI * 2); shape.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false }); gearCache.set(teeth, geo); return geo;
    };
    const gaps = [6, 7, 9], xs = [0]; for (const gp of gaps) xs.push(xs[xs.length - 1] + gp * U); const off = -xs[3] / 2;
    const axles = xs.map((x, i) => { const p = new THREE.Group(); p.position.set(off + x, h * 0.45 + (i % 2) * 0.05, -d / 2 + 0.2); g.add(p); mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), MAT.brass(), 0, 0, -0.04, p).rotation.x = Math.PI / 2; return { p, gear: null, teeth: 0 }; });
    const setGear = (i, teeth) => { const A = axles[i]; if (A.teeth === teeth) return; if (A.gear) A.p.remove(A.gear); A.gear = null; A.teeth = teeth; if (teeth) { A.gear = new THREE.Mesh(gearGeo(teeth), iron); A.gear.castShadow = true; A.p.add(A.gear); } };
    setGear(0, 12);
    let fits = [false, false, false], all = false, speed = 0, jig = 0, angle = 0;
    // 掛在最後一根軸上的鐘槌
    const hammer = new THREE.Group(); hammer.position.set(off + xs[3], h * 0.45 + 0.05, -d / 2 + 0.3); g.add(hammer);
    mesh(new THREE.BoxGeometry(0.05, 0.7, 0.05), MAT.iron(), 0, -0.35, 0, hammer); mesh(new THREE.BoxGeometry(0.22, 0.14, 0.14), MAT.brass(), 0, -0.72, 0, hammer);
    return {
      on(n, d2) {
        if (n === 'gears') { (d2.pick ?? []).forEach((tk, i) => setGear(i + 1, tk || 0)); fits = d2.fits ?? fits; all = !!d2.all; jig = 0.4; }
        if (n === 'wrong') jig = 0.8;
      },
      solved() { all = true; speed = 3; iron.emissiveIntensity = 0.6; },
      tick(dt) {
        const target = all ? Math.max(1, speed) : 0; speed += (target - speed) * Math.min(1, dt * 2); if (speed > 1) speed = Math.max(1, speed - dt * 0.4);
        angle += dt * speed * 0.8;
        let ratio = 1;
        axles.forEach((A, i) => { if (!A.gear) return; if (i) ratio *= -axles[i - 1].teeth / A.teeth; const jit = jig > 0 && i && !fits[i - 1] ? Math.sin(jig * 60) * 0.06 : 0; A.gear.rotation.z = angle * (i ? ratio : 1) + jit; });
        if (jig > 0) jig -= dt;
        hammer.rotation.z = all ? Math.sin(angle * 0.7) * 0.5 : 0;
        if (iron.emissiveIntensity > 0.15) iron.emissiveIntensity -= dt * 0.1;
      },
    };
  },

  // P28：鐘擺室的出口。每敲一下，門上的黃銅門環晃一下、刻字亮一下；長的敲得重
  'P28:pendulum'(t, group) {
    const g = rigAt(t, group), [, h] = t.size;
    const ringP = new THREE.Group(); ringP.position.set(0, h * 0.5, 0.1); g.add(ringP);
    mesh(new THREE.SphereGeometry(0.04, 8, 6), MAT.brass(), 0, 0, 0, ringP);
    const ring = mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 20), MAT.brass(), 0, -0.13, 0.02, ringP);
    const lit = halo('#ffd27a', 0.9); lit.position.set(0, h - 0.3, 0.12); g.add(lit);
    let swing = 0, vel = 0, glowT = 0;
    return {
      on(n, d) { if (n === 'tap') { vel -= d.kind === 'L' ? 5 : 2.5; glowT = d.kind === 'L' ? 0.6 : 0.3; lit.material.color.set('#ffd27a'); } if (n === 'wrong') { vel -= 6; glowT = 0.8; lit.material.color.set('#ff5a4a'); } },
      solved() { lit.material.color.set('#ffd27a'); glowT = 99; },
      tick(dt) { vel += -swing * 40 * dt; vel *= Math.pow(0.3, dt); swing += vel * dt; ringP.rotation.x = swing; ring.rotation.x = swing * 0.3; if (glowT > 0) { glowT -= dt; lit.material.opacity = Math.min(1, glowT * 2); } else lit.material.opacity = 0; },
    };
  },
};

// 星座盤以外的三扇窗（P07）、四個鎖：同一個機關用在每個學院的那一個
const rigFor = (t) => RIGS[keyOf(t)] ?? (t.puzzle === 'P07' ? RIGS['P07:window'] : null);

decorators.thing.push(({ thing: t, group }) => {
  if (t.hidden || !t.puzzle) return;
  const f = rigFor(t); if (!f) return;
  try { const rig = f(t, group); rig.thing = t; rig.done = false; LIVE.set(keyOf(t), rig); } catch (e) { console.warn('機關做不出來', t.id, e); }
});

/** 介面的操作 → 場景裡那個東西的反應 */
export function reactThing(t, name, data = {}) {
  const rig = t && LIVE.get(keyOf(t)); if (!rig) return;
  if (name === 'solved') { if (!rig.done) { rig.done = true; rig.solved(false); } return; }
  rig.on?.(name, data);
}
/** 已經解開的題目（重新連線、隊友解開）：機關直接擺成解開的樣子 */
export function syncSolved(solved) {
  for (const rig of LIVE.values()) if (!rig.done && solved.includes(rig.thing.puzzle)) { rig.done = true; rig.solved(true); }
}
/** 每一格 */
export function tickRigs(dt) { for (const rig of LIVE.values()) rig.tick?.(dt); }
