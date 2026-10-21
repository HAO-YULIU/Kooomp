// 樣品角色：艾洛拉（艾爾德林，銀白＋淡藍的學院袍，一直戴著手套）。
// 「全部用程式做」的風格：身體是 3D、會被燭光和月光照到；臉是畫在頭上的 2D 手繪風（canvas），
// 所以可以眨眼、換表情、說話時嘴巴動，不用外部圖檔。
import * as THREE from 'three';

const SKIN = '#f0d3bf', HAIR = '#c8a774', HAIR_DARK = '#8f7146', EYE = '#4f7fa8';

// ---------- 臉（畫在 canvas 上，貼在頭的正面） ----------
// 球體 UV 的正面 (+z) 在 u = 0.25，所以臉畫在畫布 x = 256 附近（畫布 1024×512）。
function drawFace(g, { blink = 0, mouth = 0, mood = 'calm', look = 0 }) {
  const W = 1024, H = 512, cx = 256, ey = 274;
  g.fillStyle = SKIN; g.fillRect(0, 0, W, H);
  // 腮紅
  for (const s of [-1, 1]) {
    const gr = g.createRadialGradient(cx + s * 92, 330, 2, cx + s * 92, 330, 40);
    gr.addColorStop(0, mood === 'scared' ? 'rgba(200,120,120,0)' : 'rgba(235,120,120,0.5)'); gr.addColorStop(1, 'rgba(235,120,120,0)');
    g.fillStyle = gr; g.fillRect(cx + s * 92 - 45, 285, 90, 90);
    for (let k = 0; k < 3; k++) { g.strokeStyle = 'rgba(220,100,100,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + s * 80 + k * 9 - 6, 336); g.lineTo(cx + s * 80 + k * 9, 324); g.stroke(); }
  }
  // 眉毛
  g.strokeStyle = HAIR_DARK; g.lineWidth = 7; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    const inner = mood === 'scared' ? -18 : mood === 'smile' ? 3 : -4;
    g.beginPath(); g.moveTo(cx + s * 30, ey - 66 + inner); g.quadraticCurveTo(cx + s * 68, ey - 82, cx + s * 104, ey - 64); g.stroke();
  }
  // 眼睛：大、手繪風、兩個高光
  for (const s of [-1, 1]) {
    const x = cx + s * 68, open = Math.max(0.05, 1 - blink);
    if (mood === 'smile' && blink < 0.5) {
      g.strokeStyle = '#2a1e18'; g.lineWidth = 9; g.beginPath(); g.arc(x, ey + 12, 30, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
      continue;
    }
    g.save(); g.translate(x, ey); g.scale(1, open);
    g.fillStyle = '#fbf7f2'; g.beginPath(); g.ellipse(0, 0, 34, 41, 0, 0, 7); g.fill();
    const ir = mood === 'scared' ? 17 : 27, lx = look * 8;
    const gr = g.createLinearGradient(0, -ir, 0, ir);
    gr.addColorStop(0, '#1d3552'); gr.addColorStop(0.55, EYE); gr.addColorStop(1, '#a9d4f2');
    g.fillStyle = gr; g.beginPath(); g.ellipse(lx, 3, ir, ir * 1.2, 0, 0, 7); g.fill();
    g.fillStyle = '#0d1520'; g.beginPath(); g.ellipse(lx, 2, ir * 0.42, ir * 0.55, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.ellipse(lx - 9, -12, 8, 10, -0.3, 0, 7); g.fill();
    g.beginPath(); g.arc(lx + 10, 13, 4, 0, 7); g.fill();
    g.restore();
    // 上眼線（粗）＋睫毛
    g.strokeStyle = '#21160f'; g.lineWidth = 9;
    g.beginPath(); g.ellipse(x, ey + 2, 37, 44 * open, 0, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(x + s * 33, ey - 18 * open); g.lineTo(x + s * 48, ey - 30 * open); g.stroke();
    g.lineWidth = 3; g.strokeStyle = 'rgba(60,40,30,0.5)'; g.beginPath(); g.ellipse(x, ey, 30, 40 * open, 0, Math.PI * 0.25, Math.PI * 0.75); g.stroke();
  }
  // 鼻子
  g.strokeStyle = 'rgba(170,100,80,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 2, 322); g.quadraticCurveTo(cx + 3, 329, cx + 6, 325); g.stroke();
  // 嘴巴
  g.fillStyle = '#8a3a40'; g.strokeStyle = '#5a2a2a'; g.lineWidth = 5;
  if (mouth > 0.08) { g.beginPath(); g.ellipse(cx, 358, 13 + mouth * 5, 3 + mouth * 15, 0, 0, 7); g.fill(); }
  else if (mood === 'smile') { g.beginPath(); g.arc(cx, 342, 20, Math.PI * 0.18, Math.PI * 0.82); g.stroke(); }
  else if (mood === 'scared') { g.beginPath(); g.ellipse(cx, 360, 9, 12, 0, 0, 7); g.fill(); }
  else { g.beginPath(); g.moveTo(cx - 14, 355); g.quadraticCurveTo(cx, 362, cx + 14, 355); g.stroke(); }
}

// 卡通渲染：三階明暗（MeshToonMaterial）＋黑色描邊（把模型沿法線放大一點、只畫背面）
const toonRamp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]), 3, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: toonRamp, ...opts });
const outlineM = new THREE.MeshBasicMaterial({ color: '#1a1012', side: THREE.BackSide });
outlineM.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.0065;'); };
function addOutlines(root) {
  const list = []; root.traverse((o) => { if (o.isMesh && !o.userData.noOutline) list.push(o); });
  for (const o of list) { const ol = new THREE.Mesh(o.geometry, outlineM); ol.userData.noOutline = true; ol.raycast = () => {}; o.add(ol); }
}

export function buildElora(scene) {
  const root = new THREE.Group();
  const robeM = toon({ color: '#e4e7ef' });
  const trimM = toon({ color: '#86ade0' });
  const gloveM = toon({ color: '#f6f3ec' });
  const hairM = toon({ color: HAIR, side: THREE.DoubleSide });
  const skinM = toon({ color: SKIN });

  // 長袍：用旋轉曲線做出往下散開的裙襬
  const prof = [[0.01, 0], [0.48, 0], [0.47, 0.08], [0.4, 0.5], [0.31, 0.95], [0.25, 1.15], [0.23, 1.3], [0.2, 1.38], [0.1, 1.43], [0.01, 1.44]].map(([x, y]) => new THREE.Vector2(x, y));
  const robe = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), robeM); robe.castShadow = true;
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.475, 0.025, 6, 32), trimM); hem.rotation.x = Math.PI / 2; hem.position.y = 0.05;
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 6, 28), trimM); belt.rotation.x = Math.PI / 2; belt.position.y = 1.05;
  // 披肩（學院色）
  const capeProf = [[0.01, 0], [0.33, 0], [0.3, 0.12], [0.18, 0.22], [0.01, 0.24]].map(([x, y]) => new THREE.Vector2(x, y));
  const cape = new THREE.Mesh(new THREE.LatheGeometry(capeProf, 24), trimM); cape.position.y = 1.2; cape.castShadow = true;
  // 星辰徽章
  const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), new THREE.MeshStandardMaterial({ color: '#e8f0ff', emissive: '#7fb0ff', emissiveIntensity: 0.6 }));
  badge.position.set(0.12, 1.3, 0.24);
  const body = new THREE.Group(); body.add(robe, hem, belt, cape, badge); root.add(body);

  // 手臂與手套（左手的手套底下藏著魔蝕的黑紋——第一章不給看）
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.27, 1.33, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.62, 10), robeM); sleeve.position.y = -0.31; sleeve.castShadow = true;
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.018, 6, 16), trimM); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.6;
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), gloveM); glove.scale.set(0.85, 1.25, 0.7); glove.position.y = -0.68;
    arm.add(sleeve, cuff, glove); arm.rotation.z = s * 0.12; root.add(arm); arms.push(arm);
  }
  // 雙手在身前交握的姿勢
  arms[0].rotation.set(-0.35, 0, -0.32); arms[1].rotation.set(-0.35, 0, 0.32);

  // 脖子、頭
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 10), skinM); neck.position.y = 1.47;
  const headG = new THREE.Group(); headG.position.y = 1.66;
  const faceCanvas = document.createElement('canvas'); faceCanvas.width = 1024; faceCanvas.height = 512;
  const faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 4;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 40, 28), toon({ map: faceTex }));
  head.scale.set(0.95, 1.06, 0.95); head.castShadow = true;
  headG.add(head);
  // 頭髮：頭頂、蓋到眉毛的瀏海、後面的長髮、耳邊兩撮。整組跟頭用同樣的比例。
  const hairG = new THREE.Group(); hairG.scale.copy(head.scale); headG.add(hairG);
  const F = Math.PI / 2; // 球體的正面
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.184, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.36), hairM);
  const bangs = new THREE.Mesh(new THREE.SphereGeometry(0.187, 32, 12, F - 1.15, 2.3, Math.PI * 0.2, Math.PI * 0.21), hairM);
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.188, 28, 18, F + 1.05, Math.PI * 2 - 2.1, 0, Math.PI * 0.82), hairM);
  const longHair = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.62, 20, 1, true, Math.PI * 0.55, Math.PI * 0.9), hairM);
  longHair.position.set(0, -0.3, -0.03);
  hairG.add(cap, bangs, back, longHair);
  for (let i = -4; i <= 4; i++) { // 瀏海尾端一撮一撮往下
    const a = i * 0.26, th = Math.PI * 0.41, r = 0.183;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 5), hairM);
    tip.position.set(Math.sin(a) * Math.sin(th) * r, Math.cos(th) * r - 0.02, Math.cos(a) * Math.sin(th) * r);
    tip.rotation.set(Math.PI - 0.25, a, 0, 'YXZ'); hairG.add(tip);
  }
  for (const s of [-1, 1]) { // 耳邊垂下來的頭髮
    const side = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.3, 4, 10), hairM); side.position.set(s * 0.165, -0.13, 0.04); side.rotation.z = s * 0.08; hairG.add(side);
  }
  // 艾爾德林的髮飾：小星星
  const pin = new THREE.Mesh(new THREE.OctahedronGeometry(0.026), new THREE.MeshStandardMaterial({ color: '#dfe9ff', emissive: '#6f9fff', emissiveIntensity: 0.9 }));
  pin.position.set(0.13, 0.11, 0.09); pin.userData.noOutline = true; hairG.add(pin);
  root.add(neck, headG);
  badge.userData.noOutline = true;
  addOutlines(root);
  root.traverse((o) => { if (o.isMesh && !o.userData.noOutline) o.receiveShadow = true; });
  scene.add(root);

  // ---------- 動畫狀態 ----------
  const face = faceCanvas.getContext('2d');
  const st = { mood: 'calm', talking: 0, blink: 0, nextBlink: 2, mouth: 0, look: 0, lastKey: '' };
  const tmp = new THREE.Vector3();

  function update(t, dt, playerPos) {
    // 呼吸、輕微晃動
    const br = Math.sin(t * 1.6) * 0.012;
    body.scale.set(1 + br * 0.5, 1 + br * 0.3, 1 + br * 0.5);
    headG.position.y = 1.66 + br * 0.6;
    root.rotation.z = Math.sin(t * 0.7) * 0.01;
      // 玩家靠近時轉頭看玩家
    tmp.copy(playerPos).sub(root.position); const dist = Math.hypot(tmp.x, tmp.z);
    const want = Math.atan2(tmp.x, tmp.z) - root.rotation.y;
    const yaw = dist < 6 ? THREE.MathUtils.clamp(Math.atan2(Math.sin(want), Math.cos(want)), -0.9, 0.9) : 0;
    headG.rotation.y += (yaw - headG.rotation.y) * Math.min(1, dt * 3);
    headG.rotation.x += ((dist < 6 ? -Math.atan2(playerPos.y - 1.66, dist) * 0.5 : 0) - headG.rotation.x) * Math.min(1, dt * 3);
    headG.rotation.z = Math.sin(t * 0.9) * 0.03 + (st.mood === 'scared' ? Math.sin(t * 40) * 0.01 : 0);
    st.look = THREE.MathUtils.clamp((want - headG.rotation.y) * 0.8, -1, 1);
    // 眨眼
    st.nextBlink -= dt;
    if (st.nextBlink <= 0) { st.blink = 1; st.nextBlink = 2 + Math.random() * 3.5; }
    st.blink = Math.max(0, st.blink - dt * 7);
    const b = st.blink > 0 ? Math.sin(st.blink * Math.PI) : 0;
    // 說話時嘴巴開合
    if (st.talking > 0) { st.talking -= dt; st.mouth = Math.abs(Math.sin(t * 16)) * (0.5 + 0.5 * Math.sin(t * 5)); } else st.mouth = 0;
    const key = `${b.toFixed(1)}|${st.mouth.toFixed(1)}|${st.mood}|${st.look.toFixed(1)}`;
    if (key !== st.lastKey) { st.lastKey = key; drawFace(face, { blink: b, mouth: st.mouth, mood: st.mood, look: st.look }); faceTex.needsUpdate = true; }
  }

  return {
    root, head,
    update,
    setMood(m) { st.mood = m; },
    talk(seconds) { st.talking = seconds; },
  };
}
