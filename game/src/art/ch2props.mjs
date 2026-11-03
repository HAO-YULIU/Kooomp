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
