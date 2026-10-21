// 配角與背景人物：用製作人提供的兩個免費模型改出來（都沒有骨架、沒有貼圖）。
// - man.glb：「72」低面數男生（襯衫長褲，手已經放下）→ 校長、男學生
// - woman.glb：女性人體雛形（臉沒有五官、沒有頭髮、A 字站姿）→ 戴兜帽的女學生（臉藏在兜帽的陰影裡）
// 另外提供頭飾零件（白鬍子、髮髻、舍監的帽子、兜帽），給 cc.mjs 的角色戴。
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { paintSkin, skinMat, makeCloak, hash3 } from './cc.mjs';
import { wearOutfit } from './outfit.mjs';

// 穿 outfit（outfit.mjs 的 spec 陣列，通常是 robe）；沒有骨架，用量好的位置（模型原本的座標，公尺）當參考點
async function dress(holder, model, s, lm, outfit) {
  const P = ([x, y]) => new THREE.Vector3(x * s, y * s, 0);
  holder.updateMatrixWorld(true);
  const ctx = { holder, body: model, landmarks: { shL: P(lm.sh), shR: P([-lm.sh[0], lm.sh[1]]), elL: P(lm.el), wrL: P(lm.wr), hip: P([0, lm.hip]), neck: P([0, lm.neck]) } };
  try { for (const spec of outfit) await wearOutfit(ctx, spec); } catch (e) { console.warn('配角穿衣服失敗', e); }
}

const cache = {};
async function geometryOf(name) {
  cache[name] ||= new GLTFLoader().loadAsync(`models/extras/${name}.glb`).then((g) => { let geo; g.scene.traverse((m) => { if (m.isMesh) geo = m.geometry; }); return geo; });
  return (await cache[name]).clone();
}
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- 頭飾零件（座標以頭的中心為原點、臉朝 +z、單位公尺） ----------
export function makeBeard(color = '#e8e4dc') { // 從下巴垂下來的長鬍子＋八字鬍（不蓋住嘴巴）
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color });
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), m); jaw.position.set(0, -0.085, 0.03); jaw.scale.set(1.0, 1.0, 0.95);
  const long = new THREE.Mesh(new THREE.SphereGeometry(0.06, 18, 14), m); long.position.set(0, -0.2, 0.06); long.scale.set(1.0, 2.0, 0.6);
  const must = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 6, 16, Math.PI), m); must.position.set(0, -0.052, 0.088); must.rotation.z = Math.PI; must.scale.set(1.2, 0.7, 1);
  g.add(jaw, long, must); return g;
}
export function makeBun(color = '#9a958c', { cap = null } = {}) { // 盤起來的髮髻；cap 給顏色就再加一頂布帽
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color });
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.108, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), m); top.position.set(0, 0.005, -0.008); top.scale.set(1, 1.05, 1.08);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), m); bun.position.set(0, 0.07, -0.1);
  g.add(top, bun);
  if (cap) {
    const c = new THREE.MeshLambertMaterial({ color: cap, side: THREE.DoubleSide });
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.118, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), c); hat.position.set(0, 0.03, -0.02); hat.rotation.x = -0.25;
    const frill = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.012, 6, 32), c); frill.rotation.x = Math.PI / 2 - 0.25; frill.position.set(0, 0.06, 0.0);
    g.add(hat, frill);
  }
  return g;
}
export function makeHood(color = '#1a1a1e', { drape = true } = {}) { // 兜帽：前面開口，往後垂到肩膀（drape：垂到肩膀那段；穿巫師袍時不要，會擋到臉和領口）
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide });
  const F = Math.PI / 2, open = 1.0;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.14, 28, 18, F + open, Math.PI * 2 - open * 2, 0, Math.PI * 0.78), m); shell.scale.set(1, 1.08, 1.1); shell.position.z = -0.01;
  const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.22, 24, 1, true, F + open, Math.PI * 2 - open * 2), m); drape.position.set(0, -0.17, -0.02);
  g.add(shell); if (drape) g.add(drape); return g;
}

// 臉的上色：把頂點換算成 Character Creator 男生模型的比例，借用 cc.mjs 的 paintSkin
function faceColors(geo, skin, { eyeY, frontZ, k }) {
  const p = geo.attributes.position, tmp = new THREE.BufferGeometry(), arr = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { arr[i * 3] = p.getX(i) * 100 * k; arr[i * 3 + 1] = -(p.getZ(i) - frontZ) * 100 * k - 9; arr[i * 3 + 2] = (p.getY(i) - eyeY) * 100 * k + 169.3; }
  tmp.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  paintSkin(tmp, skin, 0);
  return tmp.attributes.color;
}

// 沒有骨架的人物：整個人呼吸、轉向玩家
function staticCharacter(holder, model, s) {
  const base = { rotY: 0 };
  return {
    root: holder,
    update(t, dt, playerPos) {
      model.scale.y = s * (1 + Math.sin(t * 1.3 + holder.position.x) * 0.004);
      const dx = playerPos.x - holder.position.x, dz = playerPos.z - holder.position.z;
      const want = Math.hypot(dx, dz) < 4 ? Math.atan2(dx, dz) : base.rotY;
      holder.rotation.y += Math.atan2(Math.sin(want - holder.rotation.y), Math.cos(want - holder.rotation.y)) * Math.min(1, dt * 1.0);
    },
    setRest(r) { base.rotY = r; }, setMood() {}, talk() {},
  };
}

/** 男生（72）：hair 髮色、beard 鬍子顏色、robe 長袍、hood 兜帽、height 身高、
 *  gear 戴在頭上的零件（例如 hairbank.mjs 換來的頭髮）、gearScale 零件放大倍率（這個模型的頭比 Character Creator 的大） */
export async function loadMan(scene, { hair = '#2a1d15', skin = '#e6bea0', robe = { main: '#1a1a1e', trim: '#8a7a50' }, beard = null, hood = false, height = 1.79, gear = null, gearScale = 1.2, outfit = undefined } = {}) {
  // 沒指定 outfit：穿學院色的巫師袍（前面開，看得到襯衫）；outfit: null 才用舊的筒狀斗篷
  if (outfit === undefined) outfit = [{ name: 'robe', color: robe.main, trim: robe.trim, hem: 0.1, sleeveFlare: 0.05, openTop: 0.06, openWaist: 0.04, openHem: 0.25 }];
  const geo = await geometryOf('man');
  const p = geo.attributes.position, n = p.count;
  const face = faceColors(geo, skin, { eyeY: 1.672, frontZ: 0.086, k: 1.19 });
  const col = new Float32Array(n * 3), H = new THREE.Color(hair), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y > 1.5) { // 頭和脖子
      const isHair = (y > 1.715 || (y > 1.6 && z < -0.015)) && Math.abs(x) < 0.105 && !(y < 1.69 && Math.abs(x) > 0.085 && z > -0.03); // 頭頂、後腦勺（避開耳朵）
      if (isHair) c.copy(H).multiplyScalar(0.85 + 0.3 * hash3(Math.round(x * 300), Math.round(y * 300), Math.round(z * 300)));
      else c.setRGB(face.getX(i), face.getY(i), face.getZ(i));
    } else if (y < 0.09) c.set('#1c1410'); // 鞋子
    else if (y < 1.0 && y > 0.65 && Math.abs(x) > 0.2) c.setRGB(face.getX(i), face.getY(i), face.getZ(i)); // 手（斗篷底下幾乎看不到）
    else c.set(y > 0.98 ? '#d8d4cc' : '#2a2a30'); // 襯衫、長褲
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const model = new THREE.Mesh(geo, skinMat('man')); model.castShadow = model.receiveShadow = true;
  const s = height / 1.787, body = new THREE.Group(); body.add(model); body.scale.setScalar(s);
  const holder = new THREE.Group(); holder.add(body);
  if (outfit) await dress(holder, model, s, { sh: [0.2, 1.45], el: [0.27, 1.1], wr: [0.25, 0.86], hip: 0.95, neck: 1.52 }, outfit);
  else { const cloak = makeCloak(robe); cloak.position.y = (1.5 - 0.21) * s; holder.add(cloak); } // 領口在下巴下面
  const headC = new THREE.Vector3(0, 1.665 * s, 0.005 * s);
  if (beard) { const b = makeBeard(beard); b.position.copy(headC); holder.add(b); }
  if (hood) { const h = makeHood(robe.main, { drape: !outfit }); h.position.copy(headC); holder.add(h); }
  if (gear) { gear.position.copy(headC); gear.scale.setScalar(gearScale * s); holder.add(gear); }
  scene.add(holder);
  return staticCharacter(holder, body, s);
}

/** 女生（人體雛形）：一定戴兜帽（模型沒有五官和頭髮），臉塗暗，藏在陰影裡 */
export async function loadHoodedWoman(scene, { skin = '#e9c7b0', robe = { main: '#1a1a1e', trim: '#8a7a50' }, height = 1.66, outfit = undefined } = {}) {
  // 沒指定 outfit：前面合起來的巫師袍（這個模型沒有衣服）
  if (outfit === undefined) outfit = [{ name: 'robe', color: robe.main, trim: robe.trim, hem: 0.06, sleeveFlare: 0.05, openTop: 0.025, openWaist: 0, openHem: 0, collar: false }];
  const geo = await geometryOf('woman'); // 有索引（頂點共用），改位置後重算法線就是平滑的
  const p = geo.attributes.position, n = p.count;
  // A 字站姿 → 手放下：肩膀約在 (0.17, 1.44)，手臂往外下方 59 度，再往下轉 24 度
  const SH = { x: 0.17, y: 1.44 }, DROP = THREE.MathUtils.degToRad(24);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), side = Math.sign(x) || 1, u = Math.abs(x) - SH.x, v = y - SH.y;
    if (u <= 0) continue;
    const w = smooth(80, 66, THREE.MathUtils.radToDeg(Math.atan2(-v, u))) * smooth(0, 0.03, u);
    if (w <= 0) continue;
    const a = DROP * w, cs = Math.cos(a), sn = Math.sin(a);
    p.setX(i, side * (SH.x + u * cs + v * sn)); p.setY(i, SH.y - u * sn + v * cs);
  }
  geo.computeVertexNormals();
  const col = new Float32Array(n * 3), S = new THREE.Color(skin), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const y = p.getY(i), z = p.getZ(i);
    c.copy(S);
    if (y > 1.52) c.multiplyScalar(THREE.MathUtils.lerp(1, 0.18, smooth(0.0, 0.09, z))); // 臉越前面越暗：兜帽的陰影
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const model = new THREE.Mesh(geo, skinMat('woman')); model.castShadow = model.receiveShadow = true;
  const s = height / 1.762, body = new THREE.Group(); body.add(model); body.scale.setScalar(s);
  const holder = new THREE.Group(); holder.add(body);
  if (outfit) await dress(holder, model, s, { sh: [0.17, 1.44], el: [0.205, 1.17], wr: [0.235, 0.9], hip: 0.95, neck: 1.5 }, outfit);
  else { const cloak = makeCloak(robe); cloak.position.y = (1.5 - 0.15) * s; cloak.scale.set(0.88, 0.95, 0.88); holder.add(cloak); }
  const hood = makeHood(robe.main, { drape: !outfit }); hood.position.set(0, 1.655 * s, 0.0); hood.scale.setScalar(0.95); holder.add(hood);
  scene.add(holder);
  return staticCharacter(holder, body, s);
}
