// 血跡與屍體（帳號二，2026-10-22 製作人：原本的血跡像一塊塊紅地毯，太不像）。
//   bloodTrail(parent, from, to, opt)：拖行的血跡（手畫的貼圖：邊緣不規則、乾掉的深色邊、拖行的條紋、噴濺、手印），濕亮
//   bloodPool(parent, x, z, r)：一灘血（中間深、邊緣不規則、很亮）
//   buildSenior(parent, x, z)：去年搜救隊的高年級生——趴在地上往前爬的樣子，下半身結晶化長在地板上，背上被啃開露出肋骨，手裡握著提燈
import * as THREE from 'three';
import { loadCharacter } from './characters.mjs';

// 固定的亂數（每次進遊戲血跡都長一樣）
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// 濕的血：很深的紅、很亮（房間的燈和手上的燈會在上面反光）
const wetMat = (map) => new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.18, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

function drop(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, r, r * (0.8 + Math.random() * 0.4), Math.random() * 3, 0, Math.PI * 2); g.fill(); }
function hand(g, x, y, s, a, c) { // 手印：手掌＋四根手指＋大拇指
  g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = c;
  g.beginPath(); g.ellipse(0, 0, 13 * s, 16 * s, 0, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse((-9 + i * 6) * s, -24 * s - (i === 1 || i === 2 ? 4 * s : 0), 2.6 * s, 9 * s, (i - 1.5) * 0.08, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.ellipse(14 * s, -5 * s, 3 * s, 8 * s, 0.9, 0, Math.PI * 2); g.fill();
  g.restore();
}

function trailTexture(seed, { hands = 2 } = {}) {
  const W = 256, H = 2048, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), R = rng(seed);
  // 拖行的路線：中心左右飄、寬度忽寬忽窄；有幾段斷掉（拖的人停下來、換手）；兩頭比較淡
  const pts = []; let cx = W / 2, w = 60;
  for (let y = 0; y <= H; y += 6) { cx += (R() - 0.5) * 7; cx = Math.max(70, Math.min(W - 70, cx)); w += (R() - 0.5) * 12; w = Math.max(18, Math.min(100, w)); pts.push([cx, y, w]); }
  const gaps = Array.from({ length: 5 }, () => [R() * H, 20 + R() * 70]);
  const fade = (y) => Math.min(1, y / 260, (H - y) / 160) * (gaps.some(([g0, gl]) => Math.abs(y - g0) < gl) ? 0.15 : 1);
  // 1. 邊緣：模糊的深色暈開（乾掉、滲進石頭縫）
  g.filter = 'blur(6px)';
  for (const [x, y, ww] of pts) { const f = fade(y); if (f < 0.2 || R() < 0.1) continue; g.fillStyle = `rgba(22,1,1,${0.5 * f})`; g.beginPath(); g.ellipse(x + (R() - 0.5) * 8, y, ww * (0.5 + R() * 0.2), 9, 0, 0, Math.PI * 2); g.fill(); }
  // 2. 中間：深紅、濕的（顏色深淺不一，一塊一塊的）
  g.filter = 'blur(2px)';
  for (const [x, y, ww] of pts) { const f = fade(y); if (R() < 0.15) continue; g.fillStyle = `rgba(${48 + R() * 26 | 0},${2 + R() * 4 | 0},${2 + R() * 3 | 0},${(0.45 + R() * 0.45) * f})`; g.beginPath(); g.ellipse(x + (R() - 0.5) * 10, y, ww * (0.25 + R() * 0.2), 6 + R() * 6, (R() - 0.5) * 0.4, 0, Math.PI * 2); g.fill(); }
  g.filter = 'none';
  // 3. 拖行的條紋：衣服、手指拖過去的細線（深色，不要亮）
  for (let k = 0; k < 7; k++) {
    const off = (R() - 0.5) * 0.7; g.lineWidth = 1 + R() * 2.5; g.strokeStyle = `rgba(${R() < 0.6 ? '18,0,0' : '70,6,6'},${0.35 + R() * 0.3})`;
    g.beginPath(); let started = false;
    for (const [x, y, ww] of pts) { if (fade(y) < 0.5 || R() < 0.03) { started = false; continue; } const px = x + off * ww + Math.sin(y * 0.02 + k) * 2; if (!started) { g.moveTo(px, y); started = true; } else g.lineTo(px, y); }
    g.stroke();
  }
  // 4. 噴濺、滴落
  for (let i = 0; i < 220; i++) {
    const p = pts[Math.floor(R() * pts.length)], side = R() < 0.5 ? -1 : 1, d = p[2] * (0.4 + R() * 0.9);
    const x = p[0] + side * d, y = p[1] + (R() - 0.5) * 30, r = 0.8 + R() * 3.5;
    drop(g, x, y, r, `rgba(${40 + R() * 30 | 0},2,2,${0.5 + R() * 0.45})`);
  }
  // 5. 手印（爬的時候撐在地上）
  for (let i = 0; i < hands; i++) {
    const p = pts[Math.floor((0.2 + 0.6 * (i / Math.max(1, hands - 1))) * (pts.length - 1))], side = i % 2 ? 1 : -1;
    hand(g, p[0] + side * p[2] * 0.7, p[1], 1.3, side * 0.3 + Math.PI, 'rgba(45,2,2,0.7)');
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function poolTexture(seed) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), R = rng(seed);
  // 很多個圓疊在一起（邊緣不規則）；整片深紅，邊上暈開、乾掉的地方更暗
  const blobs = Array.from({ length: 26 }, () => { const a = R() * Math.PI * 2, d = R() * 130; return [S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d * 0.8, 40 + R() * 90]; });
  g.filter = 'blur(8px)'; for (const [x, y, r] of blobs) drop(g, x, y, r + 14, 'rgba(20,1,1,0.75)');
  g.filter = 'blur(3px)'; for (const [x, y, r] of blobs) drop(g, x, y, r, `rgba(${46 + R() * 18 | 0},2,2,0.9)`);
  g.filter = 'none';
  for (let i = 0; i < 120; i++) { const a = R() * Math.PI * 2, d = 160 + R() * 85; drop(g, S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d * 0.85, 1.5 + R() * 6, `rgba(${38 + R() * 25 | 0},2,2,0.85)`); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** 拖行的血跡：from、to＝{x, z}，寬 width 公尺 */
export function bloodTrail(parent, from, to, { width = 1.1, seed = 7, hands = 2, y = 0.012 } = {}) {
  const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, len), wetMat(trailTexture(seed, { hands })));
  m.rotation.order = 'YXZ'; m.rotation.y = Math.atan2(dx, dz); m.rotation.x = -Math.PI / 2; // 貼圖的上面（y＝H）在 to 那一頭
  m.position.set((from.x + to.x) / 2, y, (from.z + to.z) / 2); m.renderOrder = 1; m.receiveShadow = true;
  parent.add(m); return m;
}
/** 一灘血 */
export function bloodPool(parent, x, z, r = 1, { seed = 3, y = 0.014 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), wetMat(poolTexture(seed)));
  m.rotation.x = -Math.PI / 2; m.rotation.z = rng(seed)() * Math.PI * 2; m.position.set(x, y, z); m.renderOrder = 1; m.receiveShadow = true;
  parent.add(m); return m;
}

// ---------- 高年級生 ----------
const crystalMat = () => new THREE.MeshStandardMaterial({ color: '#07060c', emissive: '#0d0820', roughness: 0.15, metalness: 0.6, flatShading: true });
const fleshMat = () => new THREE.MeshStandardMaterial({ color: '#4a0606', emissive: '#120000', roughness: 0.3 });
const wetFlesh = () => new THREE.MeshStandardMaterial({ color: '#240203', roughness: 0.1, metalness: 0.2 });
const boneMat = () => new THREE.MeshStandardMaterial({ color: '#d4c8b2', roughness: 0.55 });

// 把骨頭轉到朝向 dir（世界座標），用它的子骨頭當方向
function aim(bone, dir) {
  const child = bone.children.find((c) => c.isBone); if (!child) return;
  bone.updateMatrixWorld(true);
  const a = bone.getWorldPosition(new THREE.Vector3()), b = child.getWorldPosition(new THREE.Vector3());
  const cur = b.sub(a).normalize(), want = dir.clone().normalize();
  const qWorld = new THREE.Quaternion().setFromUnitVectors(cur, want);
  const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const boneQ = bone.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.copy(parentQ.invert().multiply(qWorld.multiply(boneQ)));
  bone.updateMatrixWorld(true);
}

/** 屍體：x、z＝身體中間；往 +x 爬（頭在 +x 那邊）。回傳 Promise<{ group, lantern }> */
export async function buildSenior(parent, x, z) {
  const group = new THREE.Group(); parent.add(group);
  const c = await loadCharacter('vaughn');
  const model = c.root;
  // 自己的材質（不要改到玩家的沃恩）：皮膚灰白、頭髮被血黏成一塊、袍子又髒又暗
  model.traverse((o) => {
    if (!o.isMesh) return; o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    for (const m of [o.material].flat()) {
      const n = m.name || '';
      if (/Skin_|Nails/.test(n)) { m.color?.set('#8e9496'); if (m.sheenColor) m.sheen = 0; }
      else if (/Hair|Scalp|Transparency/.test(n)) m.color?.set('#3a2620');
      else if (/robe|shoes/.test(n)) m.color?.multiply(new THREE.Color('#5a4a4a'));
    }
    o.castShadow = true; o.receiveShadow = true;
  });
  // 趴著：模型的「上」→ 世界 +x（頭往前）、模型的「後面」→ 世界 +y（背朝天）
  const holder = new THREE.Group(); holder.add(model);
  holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)));
  group.add(holder); group.position.set(x - 0.85, 0, z);
  group.updateMatrixWorld(true);
  const bones = {}; model.traverse((o) => { if (o.isBone) { const k = o.name.replace(/^.*Base_/, ''); bones[k] ??= o; } });
  const F = new THREE.Vector3(1, 0, 0), DOWN = new THREE.Vector3(0, -1, 0), OUT_R = new THREE.Vector3(0, 0, 1), OUT_L = new THREE.Vector3(0, 0, -1); // 角色的右手邊＝世界 +z
  // 右手往前伸、握著提燈；左手撐在身邊（往前爬的樣子）；頭側一邊貼地
  if (bones.R_Upperarm) aim(bones.R_Upperarm, F.clone().multiplyScalar(1).addScaledVector(OUT_R, 0.35).addScaledVector(DOWN, 0.25));
  if (bones.R_Forearm) aim(bones.R_Forearm, F.clone().addScaledVector(OUT_R, 0.1).addScaledVector(DOWN, 0.3));
  if (bones.L_Upperarm) aim(bones.L_Upperarm, OUT_L.clone().addScaledVector(F, 0.35).addScaledVector(DOWN, 0.5));
  if (bones.L_Forearm) aim(bones.L_Forearm, F.clone().addScaledVector(OUT_L, 0.2).addScaledVector(DOWN, 0.4));
  if (bones.Head) { bones.Head.rotateY(-1.1); bones.Head.updateMatrixWorld(true); }
  // 貼在地上：整個人往下放到最低的地方碰到地板
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder, true); group.position.y -= box.min.y - 0.01;
  group.updateMatrixWorld(true);
  const W = (b) => b.getWorldPosition(new THREE.Vector3());
  const add = (mesh, pos) => { mesh.position.copy(pos); mesh.castShadow = true; parent.add(mesh); return mesh; };

  // 背上被啃開：一大片血肉＋濕的深色凹陷＋翻出來的肋骨
  const spine = bones.Spine02 ?? bones.Spine01, low = bones.Spine01 ?? bones.Pelvis;
  if (spine && low) {
    const top = W(spine), bot = W(low), mid = top.clone().lerp(bot, 0.35); mid.y = Math.max(mid.y, 0.2) + 0.05;
    const along = top.clone().sub(bot).setY(0).normalize(), side = new THREE.Vector3(-along.z, 0, along.x);
    const wound = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), fleshMat()); wound.scale.set(0.16, 0.035, 0.12); wound.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), along); add(wound, mid);
    const hole = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), wetFlesh()); hole.scale.set(0.11, 0.03, 0.07); hole.quaternion.copy(wound.quaternion); add(hole, mid.clone().setY(mid.y + 0.012));
    const bm = boneMat();
    for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) {
      const r = 0.075 - Math.abs(i - 2) * 0.006;
      const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 5, 10, Math.PI * (0.55 + (i % 2) * 0.15)), bm);
      const base = mid.clone().addScaledVector(along, 0.1 - i * 0.05).addScaledVector(side, sd * 0.03);
      rib.position.copy(base); rib.lookAt(base.clone().add(along)); rib.rotateZ(sd > 0 ? -0.2 : Math.PI + 0.2); rib.rotateX(-0.3 * sd);
      rib.castShadow = true; parent.add(rib);
    }
    // 碎掉的布邊：背上的袍子被撕開（深色的破布片）
    const rag = new THREE.MeshStandardMaterial({ color: '#1a1214', roughness: 0.95, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.08 + Math.random() * 0.06, 0.05), rag); p.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.8, 0, Math.random() * 3); add(p, mid.clone().addScaledVector(side, (i % 2 ? 1 : -1) * (0.12 + Math.random() * 0.03)).addScaledVector(along, (Math.random() - 0.5) * 0.25).setY(mid.y + 0.01)); }
  }
  // 下半身結晶化：從腰到腳長滿黑色結晶，結晶也從地板長出來，把腿整個包住
  const cm = crystalMat(), R = rng(11);
  const legPts = ['Pelvis', 'L_Thigh', 'R_Thigh', 'L_Calf', 'R_Calf', 'L_Foot', 'R_Foot'].map((n) => bones[n]).filter(Boolean).map(W);
  const geo = new THREE.ConeGeometry(1, 1, 5); geo.translate(0, 0.5, 0);
  for (let i = 0; i < 46; i++) {
    const a = legPts[Math.floor(R() * legPts.length)], b = legPts[Math.floor(R() * legPts.length)], p = a.clone().lerp(b, R());
    p.x += (R() - 0.5) * 0.35; p.z += (R() - 0.5) * 0.35; p.y = Math.max(0, p.y - 0.05);
    const l = 0.15 + R() * (i < 12 ? 0.75 : 0.4), wd = 0.03 + l * 0.12;
    const s = new THREE.Mesh(geo, cm); s.scale.set(wd, l, wd);
    const dir = new THREE.Vector3((R() - 0.5) * 1.4, 0.6 + R() * 0.8, (R() - 0.5) * 1.4).normalize(); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    add(s, p);
  }
  // 結晶的底：黑色玻璃一樣的一片，從腿往地板漫開
  if (legPts.length) {
    const ctr = legPts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(legPts.length);
    const base = new THREE.Mesh(new THREE.CircleGeometry(0.75, 9), new THREE.MeshStandardMaterial({ color: '#060509', emissive: '#08051a', roughness: 0.08, metalness: 0.7, polygonOffset: true, polygonOffsetFactor: -3 }));
    base.rotation.x = -Math.PI / 2; base.scale.set(1.3, 0.8, 1); add(base, ctr.setY(0.02));
  }
  // 提燈：右手握著（燈已經熄了，只剩一點點暖光）
  const lantern = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: '#2a2420', metalness: 0.7, roughness: 0.45 });
  lantern.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 8), new THREE.MeshStandardMaterial({ color: '#4a3a20', emissive: '#ffb050', emissiveIntensity: 0.35, transparent: true, opacity: 0.8, roughness: 0.1 })));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.07, 8), frame); cap.position.y = 0.13; lantern.add(cap);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 4, 10), frame); ring.position.y = 0.2; lantern.add(ring);
  const hand = bones.R_Hand;
  const hp = hand ? W(hand) : new THREE.Vector3(x + 0.9, 0.1, z + 0.3);
  lantern.position.set(hp.x + 0.12, 0.1, hp.z); lantern.rotation.z = -0.5; // 倒在地上，手還握著提把
  lantern.traverse((o) => { o.castShadow = true; }); parent.add(lantern);
  return { group, lantern };
}

// ---------- 製作人給的血跡貼圖（blood-decals-psx：往下流的 drip、噴開的 spray） ----------
const decalTex = {};
const loadDecal = (name) => (decalTex[name] ||= (() => { const t = new THREE.TextureLoader().load(`img/decals/blood_${name}.png`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })());
/** 一塊血跡：在地上（normal 朝上）或牆上（normal 朝牆外）。name＝'spray'｜'drip'（往下流的那個用在牆上） */
export function bloodSplat(parent, x, y, z, { size = 1, name = 'spray', normal = [0, 1, 0], spin = 0 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ map: loadDecal(name), color: '#7a4a4a', transparent: true, alphaTest: 0.05, depthWrite: false, roughness: 0.25, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  const n = new THREE.Vector3(...normal).normalize();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); if (spin) m.rotateZ(spin);
  m.position.set(x, y, z).addScaledVector(n, 0.012); m.renderOrder = 1; parent.add(m); return m;
}
