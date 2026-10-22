// 第一人稱拿在手上的法杖（帳號二）：星月法杖（女生）、龍首法杖（男生），右下角、走路時輕輕晃、施咒時往前一揮、杖頭發光。
// 不用帳號一改程式也會出現：場景蓋好時自動掛到相機上（預設星月法杖）。
// 帳號一可以呼叫：
//   setStaff('moon' | 'dragon' | null)   // 換法杖（null＝收起來）；例如依玩家角色：艾洛拉、月晞 'moon'，沃恩、西里爾 'dragon'
//   staffCast('#9fc4ff')                  // 施咒時呼叫：往前一揮、杖頭發出這個顏色的光
import * as THREE from 'three';
import { GLTFLoader } from '../../../prototype/vendor/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../../../prototype/vendor/addons/libs/meshopt_decoder.module.js';
import { decorators } from '../world/art-hooks.mjs';

let base = 'models/staff/';
export const setStaffBase = (url) => { base = url.endsWith('/') ? url : url + '/'; };
const hash = (a, b, c) => { const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return v - Math.floor(v); };

async function loadNormalized(url) { // 轉正、高 1 公尺、底部在 0
  const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url); // 法杖減過面（拿在手上每一格都要畫）
  g.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const out = new THREE.Group();
  g.scene.traverse((m) => {
    if (!m.isMesh) return;
    let geo = m.geometry.clone().applyMatrix4(m.matrixWorld); if (geo.index) geo = geo.toNonIndexed();
    geo.translate(-c.x, -box.min.y, -c.z); geo.scale(1 / size.y, 1 / size.y, 1 / size.y);
    const mesh = new THREE.Mesh(geo, m.material); mesh.frustumCulled = false; mesh.renderOrder = 5; out.add(mesh);
  });
  return out;
}
async function moon() {
  const s = await loadNormalized(base + 'staff.glb'), glow = [];
  s.traverse((m) => {
    if (!m.isMesh) return;
    const wood = m.material.color.r < 0.1;
    m.material = wood ? new THREE.MeshStandardMaterial({ color: '#2a170e', roughness: 0.7 })
      : new THREE.MeshStandardMaterial({ color: '#d8dbe6', roughness: 0.3, metalness: 0.45, emissive: '#9fc4ff', emissiveIntensity: 0.06 });
    if (!wood) glow.push(m.material);
  });
  return { object: s, glow };
}
async function dragon() {
  const s = await loadNormalized(base + 'dragon.glb');
  const head = new THREE.MeshStandardMaterial({ color: '#d9d2c2', roughness: 0.55, metalness: 0.1, emissive: '#9fc4ff', emissiveIntensity: 0 });
  const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
  s.traverse((m) => {
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), wood = new THREE.Color('#2b1a10'), metal = new THREE.Color('#6d655c');
    for (let i = 0; i < p.count; i++) {
      const h = p.getY(i), grain = 0.75 + 0.5 * hash(Math.round(p.getX(i) * 300), Math.round(h * 40), Math.round(p.getZ(i) * 300));
      c.copy(h < 0.1 || (h > 0.74 && h < 0.84) ? metal : wood).multiplyScalar(grain); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    m.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const idx = [], top = [];
    for (let i = 0; i < p.count; i += 3) ((p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 > 0.84 ? top : idx).push(i, i + 1, i + 2);
    m.geometry.setIndex([...idx, ...top]); m.geometry.clearGroups(); m.geometry.addGroup(0, idx.length, 0); m.geometry.addGroup(idx.length, top.length, 1);
    m.material = [body, head];
  });
  return { object: s, glow: [head] };
}

const holder = new THREE.Group(); holder.position.set(0.5, -0.5, -0.8); holder.rotation.set(0.35, 0.3, -0.22);
const light = new THREE.PointLight('#9fc4ff', 0, 4, 1.5); light.position.set(0, 0.2, 0); holder.add(light); // 一直在（只調亮度，不會卡）
const loaded = {}; let kind = 'moon', flash = 0, t = 0;
const loading = {};
function show() {
  for (const [k, v] of Object.entries(loaded)) v.object.visible = k === kind;
  holder.visible = !!kind;
  const k = kind;
  if (k && !loaded[k] && !loading[k]) {
    loading[k] = (k === 'moon' ? moon : dragon)().then((st) => { st.object.scale.setScalar(0.42); st.object.position.y = -0.3; holder.add(st.object); loaded[k] = st; show(); }).catch((e) => console.warn('法杖載入失敗', e));
  }
}
export function setStaff(k) { kind = k; show(); }
export function staffCast(color = '#9fc4ff') { flash = 1; light.color.set(color); for (const st of Object.values(loaded)) for (const m of st.glow) m.emissive.set(color); }

// 場景蓋好時掛到相機上；每一格（畫相機看到的東西之前）更新晃動和光
decorators.room.push(({ group }) => {
  const scene = group.parent; if (!scene || holder.parent) return;
  const cam = scene.children.find((o) => o.isCamera); if (!cam) return;
  cam.add(holder); show();
  const last = new THREE.Vector3(), now = new THREE.Vector3(), clock = new THREE.Clock(); let speed = 0, bob = 0;
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  const tick = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })); tick.frustumCulled = false;
  tick.onBeforeRender = () => {
    const dt = Math.min(clock.getDelta(), 0.1); t += dt;
    cam.getWorldPosition(now); const d = Math.hypot(now.x - last.x, now.z - last.z); last.copy(now);
    speed += ((dt > 0 ? d / dt : 0) - speed) * Math.min(1, dt * 6); if (speed > 0.3 && speed < 12) bob += dt * speed * 3.2;
    flash = Math.max(0, flash - dt * 1.6);
    holder.position.y = -0.5 + Math.sin(bob) * 0.012 + Math.sin(t * 1.3) * 0.004 + flash * 0.12;
    holder.position.x = 0.5 + Math.cos(bob * 0.5) * 0.008;
    holder.rotation.x = 0.35 - flash * 0.35;
    light.intensity = flash * 6;
    for (const st of Object.values(loaded)) for (const m of st.glow) m.emissiveIntensity = (st === loaded.moon ? 0.06 : 0) + flash * 2.5;
  };
  cam.add(tick);
});
