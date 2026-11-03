// 萬聖夜的布置（帳號二，2026-11-03，第二章用）：用程式畫的南瓜燈，不用下載模型。
//   jackOLantern({ size, face, light })：一顆雕了臉的南瓜燈（Group）。face 0～3 四種臉；light＝true 時裡面放一盞小燈（耗效能，只給少數幾顆）
//   tickPumpkins(dt)：每一格呼叫，讓所有南瓜燈的燭光一起閃
// 南瓜的「雕空」用自發光貼圖畫在球面上：臉的地方是亮橘黃色（裡面的燭光），其他地方是南瓜皮。
import * as THREE from 'three';

const W = 512, H = 256;
const lit = []; // 會閃的材質與燈
let t = 0;

// 四種臉：三角眼＋鋸齒嘴、圓眼＋大笑、斜眼＋獠牙、哭臉
function drawFace(g, face, fill) {
  const cx = W * 0.25, cy = H * 0.5; // 球面貼圖的 u=0.25 是正前方（+z）
  g.save(); g.translate(cx, cy); g.scale(1.7, 1.45); g.translate(-cx, -cy); // 臉放大一點（球面貼圖左右壓縮，正面只佔 1/4 寬）
  g.fillStyle = fill; g.beginPath();
  const eye = (x, y, s, kind) => {
    if (kind === 'tri') { g.moveTo(x - s, y + s * 0.6); g.lineTo(x + s, y + s * 0.6); g.lineTo(x, y - s * 0.8); g.closePath(); }
    else if (kind === 'round') { g.moveTo(x + s, y); g.arc(x, y, s, 0, Math.PI * 2); }
    else if (kind === 'slant') { g.moveTo(x - s, y - s * 0.5); g.lineTo(x + s, y + s * 0.3); g.lineTo(x - s * 0.6, y + s * 0.7); g.closePath(); }
    else { g.moveTo(x - s, y); g.quadraticCurveTo(x, y - s * 1.3, x + s, y); g.quadraticCurveTo(x, y + s * 0.5, x - s, y); }
  };
  const k = ['tri', 'round', 'slant', 'sad'][face % 4], ex = 26, ey = -22, es = 14;
  eye(cx - ex, cy + ey, es, k); eye(cx + ex, cy + ey, es, k === 'slant' ? 'slant' : k);
  if (k === 'slant') { g.fill(); g.beginPath(); g.save(); g.translate(cx * 2, 0); g.scale(-1, 1); eye(cx + ex, cy + ey, es, 'slant'); g.restore(); }
  g.moveTo(cx - 6, cy - 2); g.lineTo(cx + 6, cy - 2); g.lineTo(cx, cy - 12); g.closePath(); // 鼻子
  g.fill(); g.beginPath();
  const mw = 46, my = cy + 22;
  if (face % 4 === 3) { // 哭臉：往下彎的嘴
    g.moveTo(cx - mw * 0.8, my + 10); g.quadraticCurveTo(cx, my - 14, cx + mw * 0.8, my + 10); g.quadraticCurveTo(cx, my - 2, cx - mw * 0.8, my + 10);
  } else { // 鋸齒的笑嘴
    g.moveTo(cx - mw, my - 6);
    const n = face % 4 === 1 ? 7 : 5;
    for (let i = 0; i <= n; i++) { const x = cx - mw + (i * 2 * mw) / n; g.lineTo(x, my + (i % 2 ? 4 : -8)); }
    g.lineTo(cx + mw, my - 6); g.quadraticCurveTo(cx, my + 34, cx - mw, my - 6);
  }
  g.fill();
  if (face % 4 === 2) { g.fillStyle = '#d06a10'; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * 20, my - 2); g.lineTo(cx + sx * 14, my + 14); g.lineTo(cx + sx * 8, my - 2); g.fill(); } } // 獠牙（沒雕掉的皮）
  g.restore();
}

const texCache = {};
function textures(face) {
  if (texCache[face]) return texCache[face];
  // 南瓜皮：橘色、一條一條的深色凹痕
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#7a3a0a'); grd.addColorStop(0.25, '#d9741c'); grd.addColorStop(0.75, '#c8621a'); grd.addColorStop(1, '#5a2808');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 10; i++) { const x = (i / 10) * W; g.fillStyle = 'rgba(70,25,0,0.35)'; g.fillRect(x - 3, 0, 6, H); g.fillStyle = 'rgba(255,190,90,0.12)'; g.fillRect(x + W / 20 - 10, 0, 20, H); }
  drawFace(g, face, '#1a0800'); // 雕空的地方（燈沒亮時是黑的）
  // 自發光：只有臉亮
  const e = document.createElement('canvas'); e.width = W; e.height = H; const ge = e.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H); ge.shadowColor = '#ffb030'; ge.shadowBlur = 10; drawFace(ge, face, '#ffc860');
  const map = new THREE.CanvasTexture(c), emi = new THREE.CanvasTexture(e); map.colorSpace = emi.colorSpace = THREE.SRGBColorSpace;
  return (texCache[face] = { map, emi });
}

let bodyGeo = null;
function geometry() {
  if (bodyGeo) return bodyGeo;
  // 一顆扁扁的球，表面有 10 條凹下去的稜
  const geo = new THREE.SphereGeometry(1, 40, 24), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), ridge = 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * 5)), 0.6);
    v.x *= ridge; v.z *= ridge; v.y *= 0.78; if (v.y > 0.6) v.y -= (v.y - 0.6) * 0.5; // 頂端微微凹進去
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); return (bodyGeo = geo);
}

/** 一顆南瓜燈。size＝直徑（公尺）；face 0～3；light：裡面放一盞小燈（只給少數幾顆） */
export function jackOLantern({ size = 0.4, face = 0, light = false } = {}) {
  const g = new THREE.Group(); g.name = 'jack-o-lantern';
  const { map, emi } = textures(face);
  const mat = new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: emi, emissiveIntensity: 1.2, roughness: 0.6 });
  const body = new THREE.Mesh(geometry(), mat); body.scale.setScalar(size / 2); body.position.y = size * 0.39; g.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.04, size * 0.06, size * 0.18, 6), new THREE.MeshStandardMaterial({ color: '#3a3a18', roughness: 0.9 }));
  stem.position.y = size * 0.8; stem.rotation.z = 0.25; g.add(stem);
  const item = { mat, base: 1.0 + Math.random() * 0.4, ph: Math.random() * 10, light: null };
  if (light) { const l = new THREE.PointLight('#ff9a30', 1.2, size * 12, 2); l.position.y = size * 0.4; g.add(l); item.light = l; }
  lit.push(item);
  return g;
}

/** 每一格：南瓜燈的燭光一起閃（每顆的節奏不一樣） */
export function tickPumpkins(dt) {
  t += dt;
  for (const it of lit) {
    const f = 0.75 + 0.25 * Math.sin(t * 9 + it.ph) * Math.sin(t * 3.3 + it.ph * 2) + (Math.random() < 0.02 ? -0.3 : 0);
    it.mat.emissiveIntensity = it.base * f;
    if (it.light) it.light.intensity = 1.2 * f;
  }
}

/**
 * 萬聖節的典禮廳布置（第二章）：給一個房間的範圍，擺好南瓜燈和黑布幔。回傳 { group, tick(dt) }。
 *   room：{ x: [西, 東], z: [北, 南], h: 高 }；tables：長桌的中心線 [[x, z1, z2], …]（桌面高 tableH）
 *   長桌上每隔 2.5 公尺一顆小南瓜燈；天花板下飄著一排排南瓜燈（慢慢上下浮動）；兩側牆上掛黑布幔。
 */
export function dressHalloweenHall({ room, tables = [], tableH = 0.78, drapeEvery = 5 }, makeDrape) {
  const group = new THREE.Group(); group.name = 'halloween-hall';
  const float = []; let face = 0;
  for (const [x, z1, z2] of tables) for (let z = Math.min(z1, z2) + 1.2; z < Math.max(z1, z2) - 1; z += 2.5) {
    const p = jackOLantern({ size: 0.26, face: face++ % 4 }); p.position.set(x + (face % 2 ? 0.15 : -0.15), tableH, z); p.rotation.y = (Math.random() - 0.5) * 1.2; group.add(p);
  }
  const [x0, x1] = room.x, [z0, z1] = room.z, H = room.h ?? 8;
  let lights = 0;
  for (let x = x0 + 3; x < x1 - 2; x += 4) for (let z = z0 + 3; z < z1 - 2; z += 5) {
    const p = jackOLantern({ size: 0.4, face: face++ % 4, light: lights < 3 && Math.random() < 0.15 }); if (p.children.some((c) => c.isPointLight)) lights++;
    const y = H * 0.62 + Math.random() * H * 0.15; p.position.set(x + (Math.random() - 0.5) * 1.5, y, z + (Math.random() - 0.5) * 1.5); p.rotation.y = Math.random() * Math.PI * 2;
    group.add(p); float.push({ p, y, ph: Math.random() * 6 });
  }
  if (makeDrape) for (const [x, ry] of [[x0 + 0.05, Math.PI / 2], [x1 - 0.05, -Math.PI / 2]]) for (let z = z0 + drapeEvery / 2; z < z1; z += drapeEvery) {
    const d = makeDrape({ width: 2.4, drop: H * 0.45 }); d.position.set(x, H - 0.3, z); d.rotation.y = ry; group.add(d);
  }
  let t = 0;
  return { group, tick(dt) { t += dt; for (const f of float) f.p.position.y = f.y + Math.sin(t * 0.8 + f.ph) * 0.15; tickPumpkins(dt); } };
}
