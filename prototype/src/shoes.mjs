// 鞋子與襪子（帳號二）：Character Creator 的模型是赤腳的。用角色自己腳和小腿的形狀往外推一點點做成一層，
// 跟身體用一樣的骨頭動（走路時一起動、不會穿模）。腳踝以下是鞋子、往上到 sockTop 是襪子。
// 在穿衣服之前做（量的是還沒被衣服縮掉的身體）。
//   spec：shoe 鞋子顏色、sock 襪子顏色、sockTop 'ankle'（短襪）｜'knee'（過膝襪下面一點）、shine 鞋子亮不亮
import * as THREE from 'three';

export function wearShoes(body, holder, bone, spec = {}) {
  const shoe = new THREE.Color(spec.shoe ?? '#1a1210'), sock = new THREE.Color(spec.sock ?? '#18181c');
  holder.updateMatrixWorld(true);
  const g = body.geometry, pos = g.attributes.position, n = pos.count, v = new THREE.Vector3();
  const wy = (name) => holder.worldToLocal(bone(name).getWorldPosition(new THREE.Vector3())).y;
  const ankle = Math.max(wy('L_Foot'), wy('R_Foot')), knee = Math.min(wy('L_Calf'), wy('R_Calf'));
  const top = spec.sockTop === 'knee' ? knee - (knee - ankle) * 0.12 : ankle + (knee - ankle) * 0.22;
  const shoeTop = ankle + (knee - ankle) * 0.02;
  // 每個點現在（擺好姿勢後）的高度
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) { body.getVertexPosition(i, v); v.applyMatrix4(body.matrixWorld); y[i] = holder.worldToLocal(v).y; }
  // 模型自己的單位（公分）跟公尺的換算
  const unit = new THREE.Vector3().setFromMatrixScale(body.matrixWorld).x / new THREE.Vector3().setFromMatrixScale(holder.matrixWorld).x;
  if (!g.attributes.normal) g.computeVertexNormals();
  // 同一個位置的點（UV 接縫）方向取平均，推出去才不會裂開
  const key = (i) => `${Math.round(pos.getX(i) * 50)},${Math.round(pos.getY(i) * 50)},${Math.round(pos.getZ(i) * 50)}`;
  const acc = new Map(), nor = g.attributes.normal;
  for (let i = 0; i < n; i++) { if (y[i] > top + 0.03) continue; const k = key(i); const s = acc.get(k) ?? acc.set(k, new THREE.Vector3()).get(k); s.x += nor.getX(i); s.y += nor.getY(i); s.z += nor.getZ(i); }
  const out = new Float32Array(n * 3), col = new Float32Array(n * 3), N = new THREE.Vector3();
  // 鞋子：把腳的形狀抹平（3 公分內的點平均），腳趾就併成一整個鞋頭；再推到皮膚外面
  const R = 0.035 / unit, cell = R, grid = new Map(), gk = (x, yy, z) => `${Math.floor(x / cell)},${Math.floor(yy / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < n; i++) if (y[i] < shoeTop + 0.02) { const k = gk(pos.getX(i), pos.getY(i), pos.getZ(i)); (grid.get(k) ?? grid.set(k, []).get(k)).push(i); }
  // 包住：附近（R 內）的點取平均位置與方向，再往外推到蓋住附近每一個點（腳趾縫被填平、腳趾尖被包住）
  const wrap = (i) => {
    const x = pos.getX(i), yy = pos.getY(i), z = pos.getZ(i), x0 = Math.floor(x / cell), y0 = Math.floor(yy / cell), z0 = Math.floor(z / cell);
    const near = []; let sx = 0, sy = 0, sz = 0, sw = 0; const nn = new THREE.Vector3();
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) for (const j of grid.get(`${x0 + a},${y0 + b},${z0 + c}`) ?? []) {
      if (Math.sign(pos.getX(j)) !== Math.sign(x)) continue; // 左右腳分開
      const d = Math.hypot(pos.getX(j) - x, pos.getY(j) - yy, pos.getZ(j) - z); if (d >= R) continue;
      const w = 1 - d / R; sx += pos.getX(j) * w; sy += pos.getY(j) * w; sz += pos.getZ(j) * w; sw += w; nn.add(acc.get(key(j)).clone().normalize().multiplyScalar(w)); near.push(j);
    }
    if (!sw) return null;
    const ax = sx / sw, ay = sy / sw, az = sz / sw; nn.normalize();
    let h = 0; for (const j of near) h = Math.max(h, (pos.getX(j) - ax) * nn.x + (pos.getY(j) - ay) * nn.y + (pos.getZ(j) - az) * nn.z);
    return { p: [ax + nn.x * h, ay + nn.y * h, az + nn.z * h], n: nn };
  };
  for (let i = 0; i < n; i++) {
    if (y[i] > top + 0.03) continue;
    N.copy(acc.get(key(i))).normalize();
    const isShoe = y[i] < shoeTop, blend = isShoe ? 1 : 0;
    const off = (isShoe ? 0.004 : 0.0025) / unit; // 鞋子比皮膚外面多 4 公釐；襪子貼著皮膚
    let p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const wr = blend ? wrap(i) : null; if (wr) { p = wr.p; N.copy(wr.n); }
    out[i * 3] = p[0] + N.x * off; out[i * 3 + 1] = p[1] + N.y * off; out[i * 3 + 2] = p[2] + N.z * off;
    const c = isShoe ? shoe : sock; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const src = g.index ? g.index.array : Uint32Array.from({ length: n }, (_, i) => i), idx = [];
  for (let t = 0; t < src.length; t += 3) { const a = src[t], b = src[t + 1], c = src[t + 2]; if (y[a] < top && y[b] < top && y[c] < top) idx.push(a, b, c); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', g.attributes.skinIndex.clone()); geo.setAttribute('skinWeight', g.attributes.skinWeight.clone());
  geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ name: 'shoes', vertexColors: true, roughness: spec.shine ? 0.5 : 0.7, metalness: 0 });
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.name = 'Shoes';
  mesh.position.copy(body.position); mesh.quaternion.copy(body.quaternion); mesh.scale.copy(body.scale);
  body.parent.add(mesh); mesh.bind(body.skeleton, body.bindMatrix);
  mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  return mesh;
}
