// 樣品教室：符文學教室。所有材質都用程式畫（canvas），不用外部圖檔。
// 牆、地板、桌椅、書架、彩繪玻璃、黑板、肖像畫、燭火、灰塵、漂浮的書。
import * as THREE from 'three';

export const ROOM = { w: 14, d: 18, h: 6.5 }; // x: -7..7, z: -9..9
const HX = ROOM.w / 2, HZ = ROOM.d / 2;

// ---------- 程式畫的材質 ----------
const rand = mulberry(7);
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4;
  return t;
}
function speckle(g, w, h, n, alpha, light = false) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${rand() * alpha})`;
    g.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 3);
  }
}
const stoneTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#3a3633'; g.fillRect(0, 0, w, h);
  const rows = 8, bh = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -40 : 0;
    while (x < w) {
      const bw = 80 + rand() * 70, l = 44 + rand() * 22;
      g.fillStyle = `hsl(30, ${4 + rand() * 6}%, ${l * 0.6}%)`;
      g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
      // 石塊上的污漬
      const gr = g.createRadialGradient(x + bw * rand(), r * bh + bh * rand(), 2, x + bw / 2, r * bh + bh / 2, bw);
      gr.addColorStop(0, `rgba(0,0,0,${rand() * 0.35})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
      x += bw;
    }
  }
  speckle(g, w, h, 5000, 0.25); speckle(g, w, h, 2000, 0.08, true);
  // 往下流的水痕
  for (let i = 0; i < 10; i++) { const x = rand() * w; const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, 'rgba(10,8,6,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, 0, 3 + rand() * 8, h); }
}, { repeat: [3, 1.3] });
const woodTex = (base = [28, 40, 22], plank = 64, rep = [1, 1]) => canvasTex(512, 512, (g, w, h) => {
  for (let y = 0; y < h; y += plank) {
    const l = base[2] + rand() * 8;
    g.fillStyle = `hsl(${base[0]}, ${base[1]}%, ${l}%)`; g.fillRect(0, y, w, plank);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${0.05 + rand() * 0.12})`; g.lineWidth = 1 + rand() * 2; g.beginPath(); const yy = y + rand() * plank; g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + rand() * 6 - 3, w * 0.6, yy + rand() * 6 - 3, w, yy); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, y, w, 2);
    const seam = rand() * w; g.fillRect(seam, y, 2, plank);
  }
  speckle(g, w, h, 3000, 0.2);
}, { repeat: rep });

const stainedGlassTex = () => canvasTex(256, 512, (g, w, h) => {
  // 尖拱窗：外面透明，裡面是鉛條＋彩色玻璃
  g.clearRect(0, 0, w, h);
  g.save(); g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.3); g.quadraticCurveTo(0, 0, w / 2, 0); g.quadraticCurveTo(w, 0, w, h * 0.3); g.lineTo(w, h); g.closePath(); g.clip();
  const cols = ['#1c3f7a', '#2a5ea8', '#5c2a6e', '#7a1c2a', '#1e5a4a', '#c9a24a', '#3a7fbf'];
  for (let y = 0; y < h; y += 28) for (let x = 0; x < w; x += 28) {
    g.fillStyle = cols[Math.floor(rand() * cols.length)]; g.globalAlpha = 0.75 + rand() * 0.25;
    g.beginPath(); g.moveTo(x + rand() * 6, y); g.lineTo(x + 28, y + rand() * 6); g.lineTo(x + 28 - rand() * 6, y + 28); g.lineTo(x, y + 28 - rand() * 6); g.fill();
  }
  g.globalAlpha = 1;
  // 中間的星辰圖案（艾爾德林的象徵）
  g.fillStyle = '#e8e2c0'; g.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 22 : 58; g.lineTo(w / 2 + Math.cos(a) * r, h * 0.36 + Math.sin(a) * r); }
  g.fill();
  g.strokeStyle = '#111'; g.lineWidth = 4;
  for (let y = 0; y < h; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 4); g.stroke(); }
  for (let x = 0; x < w; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 3, h); g.stroke(); }
  g.restore();
  g.strokeStyle = '#141210'; g.lineWidth = 10; g.beginPath(); g.moveTo(5, h); g.lineTo(5, h * 0.3); g.quadraticCurveTo(5, 5, w / 2, 5); g.quadraticCurveTo(w - 5, 5, w - 5, h * 0.3); g.lineTo(w - 5, h); g.stroke();
});

function chalkboardTex(revealed) {
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#1d2a22'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(200,210,200,${rand() * 0.05})`; g.beginPath(); g.ellipse(rand() * w, rand() * h, 60 + rand() * 120, 20 + rand() * 40, rand(), 0, 7); g.fill(); }
    g.fillStyle = 'rgba(230,230,215,0.85)'; g.font = 'bold 54px serif'; g.fillText('符文學・第一課', 60, 90);
    g.font = '40px serif'; g.fillText('ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ', 60, 170);
    g.font = '30px serif'; g.fillText('○ 光照咒 Lumen — 畫圓，或揮一下魔杖', 60, 250);
    g.fillText('△ 顯影咒 Revela — 畫三角形，或往前刺', 60, 300);
    g.fillText('ϟ 退散咒 Expel — 畫閃電，或往上舉', 60, 350);
    g.font = 'italic 26px serif'; g.fillStyle = 'rgba(230,230,215,0.5)'; g.fillText('「隱藏的字，只有顯影才看得見。」', 60, 430);
    g.strokeStyle = 'rgba(230,230,215,0.6)'; g.lineWidth = 3; g.beginPath(); g.arc(860, 230, 110, 0, 7); g.stroke();
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.lineTo(860 + Math.cos(a) * 110, 230 + Math.sin(a) * 110); } g.closePath(); g.stroke();
    if (revealed) {
      // 用血寫的字，會往下滴
      g.fillStyle = '#8a0b0b'; g.font = 'bold 96px serif'; g.save(); g.translate(150, 400); g.rotate(-0.05);
      g.fillText('午夜之前離開', 0, 0); g.restore();
      for (let i = 0; i < 26; i++) { const x = 160 + rand() * 640, y = 340 + rand() * 60, len = 30 + rand() * 120; const gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, '#8a0b0b'); gr.addColorStop(1, 'rgba(90,0,0,0)'); g.fillStyle = gr; g.fillRect(x, y, 3 + rand() * 4, len); }
      g.fillStyle = '#6a0808'; g.font = 'bold 40px serif'; g.fillText('十三', 830, 470);
    }
  });
}

function portraitTex(distorted) {
  return canvasTex(256, 340, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#2a1f18'); bg.addColorStop(1, '#0e0a08'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    // 長袍
    g.fillStyle = '#1a2436'; g.beginPath(); g.moveTo(30, h); g.quadraticCurveTo(w / 2, 170, w - 30, h); g.fill();
    g.fillStyle = '#c9b28a'; g.fillRect(w / 2 - 6, 220, 12, 120);
    // 臉
    g.fillStyle = distorted ? '#8f8a7c' : '#c9a98a';
    g.beginPath();
    if (distorted) g.ellipse(w / 2 + 6, 140, 46, 92, 0.15, 0, 7); else g.ellipse(w / 2, 130, 48, 62, 0, 0, 7);
    g.fill();
    g.fillStyle = '#d8d0c0'; g.beginPath(); g.ellipse(w / 2, 82, 56, 26, 0, Math.PI, 0); g.fill(); // 白髮
    if (distorted) {
      // 被魔蝕：黑色裂紋、往下拉長的嘴
      g.fillStyle = '#000'; g.beginPath(); g.ellipse(w / 2 + 8, 200, 18, 40, 0.1, 0, 7); g.fill();
      g.strokeStyle = '#120a14'; g.lineWidth = 3;
      for (let i = 0; i < 12; i++) { g.beginPath(); let x = w / 2 + (rand() - 0.5) * 60, y = 100 + rand() * 80; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 30; y += rand() * 25; g.lineTo(x, y); } g.stroke(); }
    } else {
      g.strokeStyle = '#5a3a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2 - 16, 160); g.quadraticCurveTo(w / 2, 166, w / 2 + 16, 160); g.stroke();
      g.fillStyle = '#d8d0c0'; g.beginPath(); g.moveTo(w / 2 - 30, 168); g.quadraticCurveTo(w / 2, 220, w / 2 + 30, 168); g.quadraticCurveTo(w / 2, 186, w / 2 - 30, 168); g.fill(); // 鬍子
    }
    g.fillStyle = '#1a120c'; g.fillRect(0, 0, w, 6); // 畫布的暗角
    const v = g.createRadialGradient(w / 2, h / 2, 60, w / 2, h / 2, 200); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.7)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1500, 0.15);
  });
}

const flameTex = () => canvasTex(64, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h * 0.65, 2, w / 2, h * 0.6, w / 2);
  gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.3, 'rgba(255,200,90,0.9)'); gr.addColorStop(0.7, 'rgba(255,110,20,0.35)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(w / 2, h * 0.6, w / 2, h * 0.42, 0, 0, 7); g.fill();
});
const glowTex = () => canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const bloodTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = 'rgba(70,4,4,0.9)';
  for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(60 + i * 11 + rand() * 10, 130 + (rand() - 0.5) * 30, 12 + rand() * 18, 6 + rand() * 10, rand(), 0, 7); g.fill(); }
  for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(rand() * w, 100 + rand() * 60, 1 + rand() * 4, 0, 7); g.fill(); }
  // 拖行的痕跡往門口去
  g.fillStyle = 'rgba(55,2,2,0.6)'; g.fillRect(180, 120, 76, 18);
});

// ---------- 組合教室 ----------
export function buildClassroom(scene, { lowQuality = false } = {}) {
  const colliders = []; // XZ 平面上的方塊：{minX,maxX,minZ,maxZ}
  const interactables = [];
  const addCol = (x, z, w, d) => colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

  scene.background = new THREE.Color('#05060a');
  scene.fog = new THREE.FogExp2('#07080d', 0.055);

  const stone = new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.95, color: '#b9b2aa' });
  const floorM = new THREE.MeshStandardMaterial({ map: woodTex([24, 35, 16], 48, [4, 5]), roughness: 0.7, metalness: 0.05 });
  const darkWood = new THREE.MeshStandardMaterial({ map: woodTex([20, 38, 14], 96), roughness: 0.6 });
  const midWood = new THREE.MeshStandardMaterial({ map: woodTex([26, 40, 22], 64), roughness: 0.55 });
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2a28', roughness: 0.5, metalness: 0.8 });
  const brass = new THREE.MeshStandardMaterial({ color: '#8a6a34', roughness: 0.35, metalness: 0.9 });

  // 地板、天花板、四面牆
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorM);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), new THREE.MeshStandardMaterial({ map: woodTex([20, 25, 10], 128, [2, 3]), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM.h; scene.add(ceil);
  for (let z = -HZ + 1.5; z < HZ; z += 3) { // 天花板的橫樑
    const b = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w, 0.4, 0.35), darkWood); b.position.set(0, ROOM.h - 0.2, z); scene.add(b);
  }
  const wall = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM.h), stone); m.position.set(x, ROOM.h / 2, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); };
  wall(ROOM.w, 0, -HZ, 0); wall(ROOM.w, 0, HZ, Math.PI); wall(ROOM.d, -HX, 0, Math.PI / 2); wall(ROOM.d, HX, 0, -Math.PI / 2);
  // 牆腳的石條
  for (const [w, x, z, ry] of [[ROOM.w, 0, -HZ + 0.1, 0], [ROOM.w, 0, HZ - 0.1, 0], [ROOM.d, -HX + 0.1, 0, Math.PI / 2], [ROOM.d, HX - 0.1, 0, Math.PI / 2]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, 0.2), darkWood); b.position.set(x, 0.17, z); b.rotation.y = ry; scene.add(b);
  }

  // 月光（從左邊的窗戶照進來，唯一有影子的光）
  const moon = new THREE.DirectionalLight('#8fb0ff', 1.4);
  moon.position.set(-14, 11, 2); moon.target.position.set(1, 0, -1);
  moon.castShadow = true; moon.shadow.mapSize.set(lowQuality ? 1024 : 2048, lowQuality ? 1024 : 2048);
  Object.assign(moon.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.03;
  scene.add(moon, moon.target);
  const hemi = new THREE.HemisphereLight('#3a4a70', '#1a120c', 0.6); scene.add(hemi);

  // 左牆的三扇彩繪玻璃窗＋光束
  const glassT = stainedGlassTex();
  const glassM = new THREE.MeshBasicMaterial({ map: glassT, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, color: '#9fb3e0' });
  const beamM = new THREE.MeshBasicMaterial({ map: glowTex(), color: '#6f86c8', transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beams = [];
  for (const z of [-5, 0, 5]) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.6), glassM); g.position.set(-HX + 0.02, 3.3, z); g.rotation.y = Math.PI / 2; scene.add(g);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 2.1), darkWood); frame.position.set(-HX + 0.1, 1.45, z); scene.add(frame);
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 7), beamM); // 斜斜落到地上的光
    beam.position.set(-HX + 3.2, 2.2, z); beam.rotation.set(0, Math.PI / 2, 0.75); scene.add(beam); beams.push(beam);
  }

  // 黑板（前牆）
  const boardTex = [chalkboardTex(false), chalkboardTex(true)];
  // 粉筆字帶一點自發光，在燭光下才讀得到
  const boardM = new THREE.MeshStandardMaterial({ map: boardTex[0], emissiveMap: boardTex[0], emissive: '#ffffff', emissiveIntensity: 0.22, roughness: 0.9 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), boardM); board.position.set(0, 2.9, -HZ + 0.09); scene.add(board);
  const bframe = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.9, 0.1), darkWood); bframe.position.set(0, 2.9, -HZ + 0.02); scene.add(bframe);
  interactables.push({ object: board, label: '看黑板', kind: 'board' });

  // 講台、老師的桌子
  const dais = new THREE.Mesh(new THREE.BoxGeometry(9, 0.25, 2.6), darkWood); dais.position.set(0, 0.125, -HZ + 1.3); dais.receiveShadow = true; dais.castShadow = true; scene.add(dais);
  const tdesk = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.1), midWood); top.position.y = 1.05; tdesk.add(top);
  const front = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 0.06), darkWood); front.position.set(0, 0.62, 0.5); tdesk.add(front);
  for (const sx of [-1.2, 1.2]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 1.0), darkWood); side.position.set(sx, 0.6, 0); tdesk.add(side); }
  tdesk.position.set(1.5, 0.25, -HZ + 1.6); tdesk.traverse((o) => { o.castShadow = o.receiveShadow = true; }); scene.add(tdesk);
  addCol(1.5, -HZ + 1.6, 2.7, 1.2);

  // 學生的桌椅：3 欄 × 4 排
  const deskGeo = new THREE.BoxGeometry(2.2, 0.08, 0.7), legGeo = new THREE.BoxGeometry(0.07, 0.75, 0.07), benchGeo = new THREE.BoxGeometry(2.2, 0.07, 0.35);
  const props = [];
  for (let c = -1; c <= 1; c++) for (let r = 0; r < 4; r++) {
    const g = new THREE.Group(), x = c * 3.6 + 0.6, z = -3.5 + r * 2.4;
    const t = new THREE.Mesh(deskGeo, midWood); t.position.y = 0.78; g.add(t);
    for (const [lx, lz] of [[-1, -0.3], [1, -0.3], [-1, 0.3], [1, 0.3]]) { const l = new THREE.Mesh(legGeo, darkWood); l.position.set(lx, 0.39, lz); g.add(l); }
    const b = new THREE.Mesh(benchGeo, darkWood); b.position.set(0, 0.45, 0.65); g.add(b);
    for (const lx of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.3), darkWood); l.position.set(lx, 0.22, 0.65); g.add(l); }
    // 桌上的小東西：攤開的書、墨水瓶、羽毛筆
    if (rand() > 0.3) { const bk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.35), new THREE.MeshStandardMaterial({ color: '#d9cba4', roughness: 0.9 })); bk.position.set((rand() - 0.5) * 1.4, 0.84, (rand() - 0.5) * 0.2); bk.rotation.y = (rand() - 0.5) * 0.6; g.add(bk); }
    if (rand() > 0.5) { const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.1, 10), new THREE.MeshStandardMaterial({ color: '#101820', roughness: 0.1, metalness: 0.3 })); ink.position.set((rand() - 0.5) * 1.6, 0.87, -0.2); g.add(ink); }
    g.position.set(x, 0, z); g.rotation.y = (rand() - 0.5) * 0.06;
    g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); scene.add(g);
    addCol(x, z + 0.25, 2.3, 1.3);
    if (c === 1 && r === 3) props.push(g); // 最後一排右邊那張，之後拿來「自己動」
  }

  // 右牆的書架
  const bookCols = ['#5a1a1a', '#1a3a5a', '#2a4a2a', '#4a3a1a', '#3a1a4a', '#6a5a3a', '#202020'];
  for (const z of [-6, -2.5, 2.5, 6]) {
    const g = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.2, 2.6), darkWood); back.position.y = 2.1; g.add(back);
    for (let s = 0; s < 5; s++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 2.6), midWood); shelf.position.set(-0.05, 0.3 + s * 0.85, 0); g.add(shelf);
      let bz = -1.2;
      while (bz < 1.15) {
        const bw = 0.06 + rand() * 0.1, bh = 0.45 + rand() * 0.3;
        if (rand() < 0.08) { bz += 0.25; continue; } // 空位
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.38, bh, bw), new THREE.MeshStandardMaterial({ color: bookCols[Math.floor(rand() * bookCols.length)], roughness: 0.8 }));
        book.position.set(-0.12, 0.33 + s * 0.85 + bh / 2, bz + bw / 2); book.rotation.x = (rand() - 0.5) * 0.08; g.add(book);
        bz += bw + 0.01;
      }
    }
    g.position.set(HX - 0.3, 0, z); g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; }); scene.add(g);
    addCol(HX - 0.3, z, 0.7, 2.7);
  }

  // 後牆：門＋肖像畫
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 0.12), darkWood); door.position.set(4.5, 1.6, HZ - 0.06); scene.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), brass); knob.position.set(3.9, 1.5, HZ - 0.14); scene.add(knob);
  const portraitTexs = [portraitTex(false), portraitTex(true)];
  const portraitM = new THREE.MeshStandardMaterial({ map: portraitTexs[0], roughness: 0.6 });
  const portrait = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.86), portraitM); portrait.position.set(-2.5, 3.2, HZ - 0.08); portrait.rotation.y = Math.PI; scene.add(portrait);
  const pframe = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.16, 0.08), brass); pframe.position.set(-2.5, 3.2, HZ - 0.03); scene.add(pframe);
  // 會跟著玩家轉的眼睛
  const eyes = [-0.115, 0.115].map((dx) => {
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.022, 10), new THREE.MeshBasicMaterial({ color: '#0a0604' }));
    e.position.set(-2.5 - dx, 3.2 + 0.24, HZ - 0.09); e.rotation.y = Math.PI; scene.add(e);
    return { mesh: e, base: e.position.clone() };
  });
  interactables.push({ object: portrait, label: '看肖像畫', kind: 'portrait' });

  // 地上的血跡（通往門口）
  const blood = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshStandardMaterial({ map: bloodTex(), transparent: true, roughness: 0.2, depthWrite: false }));
  blood.rotation.x = -Math.PI / 2; blood.rotation.z = -0.4; blood.position.set(3.0, 0.012, 6.8); scene.add(blood);

  // ---------- 燭火 ----------
  const fTex = flameTex(), gTex = glowTex();
  const candleM = new THREE.MeshStandardMaterial({ color: '#e8dfc8', roughness: 0.8 });
  const candles = [];
  function candle(parent, x, y, z, h = 0.22) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, h, 10), candleM); c.position.set(x, y + h / 2, z); parent.add(c);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: fTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    fl.scale.set(0.07, 0.14, 1); fl.position.set(x, y + h + 0.06, z); parent.add(fl);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, color: '#ff9a40', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
    gl.scale.set(0.6, 0.6, 1); gl.position.copy(fl.position); parent.add(gl);
    const k = { flame: fl, glow: gl, phase: rand() * 100, lit: false };
    candles.push(k); return k;
  }
  // 吊燈
  const chand = new THREE.Group(); chand.position.set(0, ROOM.h - 1.7, 0); scene.add(chand);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.04, 8, 40), iron); ring.rotation.x = Math.PI / 2; chand.add(ring);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 6), iron); chain.position.y = 0.85; chand.add(chain);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; candle(chand, Math.cos(a), 0.02, Math.sin(a)); }
  // 牆上的燭台
  for (const [x, z] of [[-4.2, -HZ + 0.25], [4.2, -HZ + 0.25], [-HX + 0.25, -2.5], [-HX + 0.25, 2.5], [-4, HZ - 0.25], [-1, HZ - 0.25]]) {
    const holder = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.2), iron); holder.position.set(x, 2.4, z); scene.add(holder);
    candle(scene, x, 2.43, z, 0.28);
  }
  // 老師桌上的燭台（一開始唯一亮著的）
  const deskCandle = candle(scene, 2.4, 1.36, -HZ + 1.5, 0.18); deskCandle.lit = true;

  const lights = [
    { l: new THREE.PointLight('#ff9a4a', 0, 16, 1.4), pos: [0, ROOM.h - 1.6, 0], max: 28 },
    { l: new THREE.PointLight('#ff8a3a', 0, 10, 1.6), pos: [-4.2, 2.7, -HZ + 0.6], max: 9 },
    { l: new THREE.PointLight('#ff8a3a', 0, 10, 1.6), pos: [4.2, 2.7, -HZ + 0.6], max: 9 },
    { l: new THREE.PointLight('#ff8a3a', 0, 10, 1.6), pos: [-2.5, 2.7, HZ - 0.7], max: 9 },
    { l: new THREE.PointLight('#ffa050', 4, 7, 1.6), pos: [2.4, 1.7, -HZ + 1.6], max: 4, on: true },
  ];
  if (!lowQuality) lights.push({ l: new THREE.PointLight('#ff8a3a', 0, 9, 1.6), pos: [-HX + 0.7, 2.7, -1.5], max: 8 });
  for (const L of lights) { L.l.position.set(...L.pos); L.on ??= false; scene.add(L.l); }

  // ---------- 灰塵 ----------
  const DUST = lowQuality ? 300 : 800;
  const dg = new THREE.BufferGeometry(), dp = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { dp[i * 3] = (rand() - 0.5) * ROOM.w; dp[i * 3 + 1] = rand() * ROOM.h; dp[i * 3 + 2] = (rand() - 0.5) * ROOM.d; }
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ map: gTex, size: 0.04, color: '#c8c0b0', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  // ---------- 漂浮的書 ----------
  const floaters = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: bookCols[i % bookCols.length], roughness: 0.7 }));
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.27), new THREE.MeshStandardMaterial({ color: '#e0d6b8' })); pages.position.x = 0.02;
    b.add(cover, pages); b.castShadow = true;
    const home = new THREE.Vector3(HX - 1.6 - rand() * 1.5, 2.6 + rand() * 1.6, -6 + i * 3);
    b.position.copy(home); scene.add(b);
    floaters.push({ g: b, home, phase: rand() * 10, push: new THREE.Vector3() });
  }

  // ---------- 門口的黑影（驚嚇用） ----------
  const figure = new THREE.Group();
  const fm = new THREE.MeshBasicMaterial({ color: '#000', fog: false });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.45, 2.3, 12), fm); body.position.y = 1.15; figure.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), fm); head.position.y = 2.45; head.scale.set(1, 1.35, 1); figure.add(head);
  for (const dx of [-0.07, 0.07]) {
    const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, color: '#ff2a1a', blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    e.scale.set(0.12, 0.12, 1); e.position.set(dx, 2.48, 0.19); figure.add(e);
  }
  // 紅光一直放在場景裡（強度 0），不跟著黑影顯示／隱藏：燈的數量一變，所有材質都要重新編譯，會卡住好幾秒
  const figLight = new THREE.PointLight('#ff2010', 0, 7, 1.2); scene.add(figLight);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.6, 6), fm); arm.position.set(s * 0.32, 1.3, 0); arm.rotation.z = s * 0.12; figure.add(arm); }
  figure.visible = false; scene.add(figure);

  // ---------- 狀態與每一格的更新 ----------
  const state = { lit: false, revealed: false, blackout: 0, flickerBoost: 0, distorted: false };
  const tmp = new THREE.Vector3();

  function setLights() {
    for (const c of candles) { c.flame.visible = c.glow.visible = c.lit && state.blackout <= 0; }
  }
  setLights();

  function update(t, dt, playerPos) {
    // 燭火閃爍
    const black = state.blackout > 0;
    for (const c of candles) {
      if (!c.lit || black) continue;
      const f = 0.85 + 0.15 * Math.sin(t * 13 + c.phase) * Math.sin(t * 7.3 + c.phase * 2);
      c.flame.scale.set(0.07 * f, 0.14 * (0.9 + 0.2 * f), 1); c.glow.material.opacity = 0.28 * f;
    }
    for (const L of lights) {
      const on = L.on && !black;
      const fl = 0.82 + 0.18 * Math.sin(t * 11 + L.pos[0]) * Math.sin(t * 5.7 + L.pos[2]);
      const extra = state.flickerBoost > 0 && Math.random() < 0.3 ? 0.1 : 1;
      const target = on ? L.max * fl * extra : 0;
      L.l.intensity += (target - L.l.intensity) * Math.min(1, dt * (on ? 4 : 30));
    }
    if (state.flickerBoost > 0) state.flickerBoost -= dt;
    if (state.blackout > 0) {
      state.blackout -= dt;
      figLight.intensity = Math.sin(t * 38) > 0.2 ? 14 : 0.6; // 紅光頻閃，黑影一閃一閃
      if (state.blackout <= 0) { figure.visible = false; figLight.intensity = 0; setLights(); }
    }
    moon.intensity = black ? 0.25 : 1.4;
    for (const b of beams) b.material.opacity = black ? 0.02 : 0.09;

    // 灰塵慢慢飄
    const p = dg.attributes.position;
    for (let i = 0; i < DUST; i++) {
      let y = p.getY(i) + dt * 0.03 * (0.5 + ((i * 7) % 5) / 5);
      if (y > ROOM.h) y = 0;
      p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.02);
    }
    p.needsUpdate = true;

    // 漂浮的書
    for (const f of floaters) {
      f.push.multiplyScalar(Math.max(0, 1 - dt * 0.6));
      f.g.position.set(f.home.x + Math.sin(t * 0.4 + f.phase) * 0.3 + f.push.x, f.home.y + Math.sin(t * 0.9 + f.phase) * 0.15 + f.push.y, f.home.z + Math.cos(t * 0.3 + f.phase) * 0.3 + f.push.z);
      f.g.rotation.set(Math.sin(t * 0.5 + f.phase) * 0.3, t * 0.2 + f.phase, Math.cos(t * 0.6 + f.phase) * 0.2);
    }

    // 肖像畫的眼睛跟著玩家
    for (const e of eyes) {
      e.mesh.position.x = e.base.x + THREE.MathUtils.clamp((playerPos.x - e.base.x) * 0.004, -0.012, 0.012);
      e.mesh.position.y = e.base.y + THREE.MathUtils.clamp((playerPos.y - e.base.y) * 0.01, -0.01, 0.004);
      e.mesh.visible = !state.distorted;
    }
  }

  return {
    colliders, interactables, candles, update, board, portrait, elora: null,
    state,
    lumen() {
      if (state.lit) return false;
      state.lit = true; candles.forEach((c) => (c.lit = true)); lights.forEach((L) => (L.on = true)); setLights(); return true;
    },
    reveal() {
      if (state.revealed) return false;
      state.revealed = true; boardM.map = boardM.emissiveMap = boardTex[1]; boardM.needsUpdate = true; return true;
    },
    expel(from) {
      for (const f of floaters) { tmp.copy(f.g.position).sub(from).setY(0.3).normalize().multiplyScalar(2.5); f.push.add(tmp); }
      if (state.distorted) { state.distorted = false; portraitM.map = portraitTexs[0]; portraitM.needsUpdate = true; return 'portrait'; }
      return 'books';
    },
    // 突然嚇人：燈全滅、門口出現黑影、肖像畫的臉變形
    scare(seconds, camPos, camDir) {
      state.blackout = seconds; state.flickerBoost = seconds + 2; setLights();
      // 黑影出現在玩家正前方三公尺左右，面向玩家
      tmp.copy(camDir).setY(0).normalize().multiplyScalar(3).add(camPos);
      figure.position.set(THREE.MathUtils.clamp(tmp.x, -HX + 0.6, HX - 0.8), 0, THREE.MathUtils.clamp(tmp.z, -HZ + 0.6, HZ - 0.6));
      figure.lookAt(camPos.x, 0, camPos.z); figure.visible = true;
      figLight.position.copy(figure.position).lerp(camPos, 0.3).setY(1.4);
      state.distorted = true; portraitM.map = portraitTexs[1]; portraitM.needsUpdate = true;
    },
    flicker(seconds = 2) { state.flickerBoost = seconds; },
  };
}
