// 第二章用的擺設（帳號二，2026-11-03）：模型庫裡沒有的，用程式拼。底部都在原點、正面朝 +z。
//   hospitalBed()：醫務室的鐵架病床（床墊、枕頭、皺皺的床單）；bloody＝true 床單上有血
//   filingCabinet({ drawers, open })：舊檔案室的木頭檔案櫃，抽屜有黃銅把手和小標籤；open＝第幾格拉開（-1 都關）
//   drape({ width, drop })：萬聖節的黑色布幔，上緣固定、下面呈波浪垂下
import * as THREE from 'three';

const iron = new THREE.MeshStandardMaterial({ color: '#2b2a28', roughness: 0.5, metalness: 0.7 });
const brass = new THREE.MeshStandardMaterial({ color: '#8a6a2a', roughness: 0.35, metalness: 0.85 });
const oak = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.75 });
const oakDark = new THREE.MeshStandardMaterial({ color: '#2e1f14', roughness: 0.8 });

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

// 床單：灰白、有洗不掉的黃斑（bloody：一大片血）
function sheetTex(bloody) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9c4b6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(150,140,110,${0.05 + Math.random() * 0.08})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 18, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(120,115,100,0.25)'; g.lineWidth = 2; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 20, w * 0.6, y - 20, w, y + 8); g.stroke(); } // 皺褶
    if (bloody) {
      const grd = g.createRadialGradient(w * 0.55, h * 0.45, 4, w * 0.55, h * 0.45, 90); grd.addColorStop(0, 'rgba(70,0,0,0.95)'); grd.addColorStop(0.6, 'rgba(110,8,8,0.8)'); grd.addColorStop(1, 'rgba(110,8,8,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(90,4,4,0.85)'; g.fillRect(w * 0.45 + Math.random() * 60, h * 0.5, 3 + Math.random() * 4, 40 + Math.random() * 80); } // 往下流
    }
  });
}

export function hospitalBed({ bloody = false } = {}) {
  const g = new THREE.Group(); g.name = 'hospital-bed';
  const L = 2.0, Wd = 0.9, H = 0.55;
  const bar = (len, x, y, z, axis = 'x') => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 6), iron); m.position.set(x, y, z); if (axis === 'x') m.rotation.z = Math.PI / 2; if (axis === 'z') m.rotation.x = Math.PI / 2; g.add(m); return m; };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bar(sz < 0 ? 1.1 : 0.75, sx * Wd / 2, (sz < 0 ? 1.1 : 0.75) / 2, sz * L / 2, 'y'); // 四根柱子（床頭高）
  for (const sx of [-1, 1]) bar(L, sx * Wd / 2, H, 0, 'z'); // 兩側的橫桿
  for (const [z, top] of [[-L / 2, 1.08], [L / 2, 0.73]]) { bar(Wd, 0, top, z); bar(Wd, 0, top - 0.25, z); for (let i = 1; i < 6; i++) bar(0.25, -Wd / 2 + (i * Wd) / 6, top - 0.125, z, 'y'); } // 床頭、床尾的欄杆
  const mat = new THREE.MeshStandardMaterial({ map: sheetTex(bloody), roughness: 0.9 });
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.04, 0.16, L - 0.06, 1, 1, 6), mat); mattress.position.y = H + 0.08; g.add(mattress);
  const pillow = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: '#d8d4c8', roughness: 0.95 })); pillow.scale.set(0.32, 0.07, 0.2); pillow.position.set(0, H + 0.2, -L / 2 + 0.25); g.add(pillow);
  // 掀開一半、垂下床邊的薄被
  const blanket = new THREE.Mesh(new THREE.PlaneGeometry(Wd + 0.2, 1.1, 8, 10), mat);
  const p = blanket.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.abs(x) > Wd / 2 ? -(Math.abs(x) - Wd / 2) * 2.2 : 0.02 * Math.sin(y * 9 + x * 6)); }
  blanket.geometry.computeVertexNormals(); blanket.rotation.x = -Math.PI / 2; blanket.position.set(0, H + 0.17, 0.35); blanket.material = mat.clone(); blanket.material.side = THREE.DoubleSide; g.add(blanket);
  return g;
}

// 抽屜的小標籤：手寫的年份
function labelTex(text) { return canvasTex(128, 48, (g, w, h) => { g.fillStyle = '#d8ccb0'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a1c10'; g.font = 'italic 26px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2); }); }

export function filingCabinet({ drawers = 5, open = -1, years = null, height = 2.2 } = {}) {
  const g = new THREE.Group(); g.name = 'filing-cabinet';
  const Wd = 0.7, D = 0.6, dh = (height - 0.12) / drawers;
  const box = new THREE.Mesh(new THREE.BoxGeometry(Wd, height, D), oakDark); box.position.y = height / 2; g.add(box);
  const top = new THREE.Mesh(new THREE.BoxGeometry(Wd + 0.06, 0.05, D + 0.05), oak); top.position.y = height + 0.02; g.add(top);
  for (let i = 0; i < drawers; i++) {
    const d = new THREE.Group(); const y = 0.08 + dh * (i + 0.5);
    const front = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.06, dh - 0.03, 0.03), oak); d.add(front);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI), brass); handle.rotation.z = Math.PI; handle.position.set(0, -dh * 0.12, 0.025); d.add(handle);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.006), brass); frame.position.set(0, dh * 0.18, 0.018); d.add(frame);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.055), new THREE.MeshStandardMaterial({ map: labelTex(years?.[i] ?? String(1820 + Math.floor(Math.random() * 100))), roughness: 0.9 })); lab.position.set(0, dh * 0.18, 0.022); d.add(lab);
    const pull = i === open ? 0.38 : 0; d.position.set(0, y, D / 2 + pull);
    if (i === open) { // 拉開的抽屜：裡面塞滿泛黃的紙
      const tray = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.08, dh - 0.06, 0.4), oakDark); tray.position.z = -0.21; d.add(tray);
      for (let k = 0; k < 14; k++) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(Wd - 0.14, dh - 0.1), new THREE.MeshStandardMaterial({ color: k % 3 ? '#cbbd98' : '#b8a57a', roughness: 1, side: THREE.DoubleSide })); sh.position.set(0, 0.02, -0.04 - k * 0.025); sh.rotation.x = (Math.random() - 0.5) * 0.15; d.add(sh); }
    }
    g.add(d);
  }
  return g;
}

export function drape({ width = 3, drop = 2.5, color = '#0b0a0c' } = {}) {
  const geo = new THREE.PlaneGeometry(width, drop, 24, 12), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), k = (drop / 2 - y) / drop; // 0 上緣 → 1 下緣
    p.setZ(i, Math.sin((x / width) * Math.PI * 7) * 0.08 * (0.3 + k)); // 布的皺摺，越往下越深
    p.setY(i, y - k * k * 0.25 * Math.cos((x / width) * Math.PI) ** 2); // 中間比較垂
  }
  geo.translate(0, -drop / 2, 0); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide }));
  m.name = 'drape'; return m; // 原點在上緣中間：掛的時候把位置設在掛點
}

// ---- 諾克斯的點名簿：黑色皮面、翻開，頁面上一排排手寫的名字，有些被紅墨水圈起來 ----
function rollPage(seed, circled) {
  return canvasTex(256, 340, (g, w, h) => {
    g.fillStyle = '#d9cba6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,90,50,0.35)'; for (let y = 40; y < h - 10; y += 22) { g.beginPath(); g.moveTo(14, y); g.lineTo(w - 14, y); g.stroke(); }
    const names = ['Ainsley', 'Brandt', 'Corwin', 'Delia', 'Ewan', 'Fenna', 'Gideon', 'Hollis', 'Ivy', 'Jory', 'Kestrel', 'Liana', 'Maren', 'Nolan'];
    g.font = 'italic 17px serif'; g.fillStyle = '#2a1a0c';
    for (let i = 0; i < 13; i++) {
      const n = names[(i + seed) % names.length], y = 36 + i * 22; g.fillText(`${i + 1}. ${n}`, 22, y);
      if (circled.includes(i)) { g.strokeStyle = 'rgba(150,10,10,0.85)'; g.lineWidth = 2; g.beginPath(); g.ellipse(70, y - 6, 58, 11, -0.04, 0, Math.PI * 2); g.stroke(); }
      if (n === 'Liana') { g.strokeStyle = '#1a0a04'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(20, y - 6); g.lineTo(130, y - 4); g.stroke(); } // 莉安娜被劃掉
    }
  });
}
/** 翻開的點名簿（寬約 0.36 公尺），原點在書背底部 */
export function rollBook({ seed = 0 } = {}) {
  const g = new THREE.Group(); g.name = 'roll-book';
  const leather = new THREE.MeshStandardMaterial({ color: '#141012', roughness: 0.7 });
  const pw = 0.17, ph = 0.24;
  for (const sx of [-1, 1]) {
    const cover = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.01, 0.008, ph + 0.01), leather); cover.position.set(sx * (pw / 2 + 0.004), 0.004, 0); cover.rotation.z = sx * 0.06; g.add(cover);
    const page = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: rollPage(seed + (sx > 0 ? 7 : 0), sx > 0 ? [2, 6, 9] : [4, 11]), roughness: 0.95 }));
    page.rotation.x = -Math.PI / 2; page.rotation.y = sx * 0.06; page.position.set(sx * (pw / 2 + 0.004), 0.014, 0); g.add(page);
  }
  return g;
}

// ---- 溫室的黑色植物：花盆裡長出黑色的根，像第一章圖書館裡的黑根；tick 讓根慢慢蠕動 ----
export function blackPlant({ height = 0.9 } = {}) {
  const g = new THREE.Group(); g.name = 'black-plant';
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.28, 12), new THREE.MeshStandardMaterial({ color: '#6a3a24', roughness: 0.85 })); pot.position.y = 0.14; g.add(pot);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.19, 12), new THREE.MeshStandardMaterial({ color: '#120c08' })); soil.rotation.x = -Math.PI / 2; soil.position.y = 0.27; g.add(soil);
  const root = new THREE.MeshStandardMaterial({ color: '#07050a', roughness: 0.25, metalness: 0.3, emissive: '#12001a', emissiveIntensity: 0.6 });
  const tendrils = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4, len = height * (0.5 + Math.random() * 0.6), pts = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new THREE.Vector3(Math.cos(a) * (0.04 + t * 0.25) + Math.sin(t * 7 + i) * 0.04, 0.27 + t * len, Math.sin(a) * (0.04 + t * 0.25) + Math.cos(t * 6 + i) * 0.04)); }
    const curve = new THREE.CatmullRomCurve3(pts), m = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.016, 5), root);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 5), root); tip.position.copy(pts[8]); tip.lookAt(pts[8].clone().add(pts[8].clone().sub(pts[7]))); tip.rotateX(Math.PI / 2);
    const holder = new THREE.Group(); holder.add(m, tip); g.add(holder); tendrils.push({ holder, ph: Math.random() * 10 });
  }
  let t = 0;
  g.userData.tick = (dt) => { t += dt; for (const q of tendrils) { q.holder.rotation.y = Math.sin(t * 0.7 + q.ph) * 0.06; q.holder.rotation.z = Math.sin(t * 0.5 + q.ph * 2) * 0.03; } }; // 蠕動
  return g;
}
