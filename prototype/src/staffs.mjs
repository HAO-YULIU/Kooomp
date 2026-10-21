// 第一人稱拿在手上的法杖，兩種：
// - 星月法杖（女生）：製作人提供，原檔 150 萬個頂點，已減量成約 4 萬個三角形（models/staff/staff.glb）
// - 龍首法杖（男生）：製作人提供（AI 生成的模型，貼圖沒有附上），用程式依高度上色：杖身深色木頭、金屬環、骨白色的龍頭
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { hash3 } from './cc.mjs';

// 把模型轉正、縮放成高 1 公尺、底部在 0，回傳一個 Group
async function loadNormalized(url) {
  const g = await new GLTFLoader().loadAsync(url);
  g.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const out = new THREE.Group();
  g.scene.traverse((m) => {
    if (!m.isMesh) return;
    let geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed(); // 之後要依高度分材質，先拆成獨立的三角形
    geo.translate(-c.x, -box.min.y, -c.z); geo.scale(1 / size.y, 1 / size.y, 1 / size.y);
    const mesh = new THREE.Mesh(geo, m.material); mesh.frustumCulled = false; out.add(mesh);
  });
  return out;
}

export async function loadMoonStaff() {
  const s = await loadNormalized('models/staff/staff.glb'), glow = [];
  s.traverse((m) => {
    if (!m.isMesh) return;
    const wood = m.material.color.r < 0.1; // 深色的是木頭杖身，淺色的是月亮、環、星星
    m.material = wood
      ? new THREE.MeshStandardMaterial({ color: '#2a170e', roughness: 0.7 })
      : new THREE.MeshStandardMaterial({ color: '#d8dbe6', roughness: 0.3, metalness: 0.45, emissive: '#9fc4ff', emissiveIntensity: 0.06 });
    if (!wood) glow.push(m.material);
  });
  return { object: s, glow };
}

export async function loadDragonStaff() {
  const s = await loadNormalized('models/staff/dragon.glb');
  const head = new THREE.MeshStandardMaterial({ color: '#d9d2c2', roughness: 0.55, metalness: 0.1, emissive: '#9fc4ff', emissiveIntensity: 0.0 });
  const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
  s.traverse((m) => {
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    const wood = new THREE.Color('#2b1a10'), metal = new THREE.Color('#6d655c');
    for (let i = 0; i < p.count; i++) {
      const h = p.getY(i);
      const grain = 0.75 + 0.5 * hash3(Math.round(p.getX(i) * 300), Math.round(h * 40), Math.round(p.getZ(i) * 300));
      if (h < 0.1 || (h > 0.74 && h < 0.84)) c.copy(metal).multiplyScalar(grain); else c.copy(wood).multiplyScalar(grain);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    m.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // 杖頭（最上面 16%）另外用骨白色的材質，施咒時會發光
    const idx = []; const top = [];
    for (let i = 0; i < p.count; i += 3) ((p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 > 0.84 ? top : idx).push(i, i + 1, i + 2);
    m.geometry.setIndex([...idx, ...top]); m.geometry.clearGroups(); m.geometry.addGroup(0, idx.length, 0); m.geometry.addGroup(idx.length, top.length, 1);
    m.material = [body, head];
  });
  return { object: s, glow: [head] };
}
