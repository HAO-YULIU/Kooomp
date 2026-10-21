// 西里爾（烏洛波斯，墨綠＋銀）：製作人提供的免費模型「Modern Tarzan」。
// 這個模型沒有骨架、沒有臉部表情、沒有貼圖（全白，T 字站姿、T 恤短褲），所以：
// 手臂用移動頂點的方式放下來；皮膚借用 cc.mjs 的上色（把座標換算成 Character Creator 模型的比例）；
// 眼睛、頭髮、鞋子用程式上色；穿上跟沃恩、月晞同樣做法的學院斗篷。不會眨眼、嘴巴不會動。
import * as THREE from 'three';
import { FBXLoader } from '../vendor/addons/loaders/FBXLoader.js';
import { paintSkin, skinMat, makeCloak, hash3 } from './cc.mjs';

// 模型原本的座標（公分）：x 左右、y 往上、z 往前。眼睛在 (0, 135.7)，下巴約 y 126，脖子根約 y 124。
const EYE_Y = 135.65, SHOULDER = { x: 13, y: 117 }, DROP = THREE.MathUtils.degToRad(80);
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// T 字站姿 → 手自然垂下：越像手臂（從肩膀往外、接近水平）的頂點，繞肩膀往下轉越多
function dropArms(geo) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), side = Math.sign(x) || 1;
    const u = Math.abs(x) - SHOULDER.x, v = y - SHOULDER.y;
    if (u <= 0) continue;
    const deg = THREE.MathUtils.radToDeg(Math.atan2(-v, u)); // 在肩膀下方幾度（手臂是 0 度左右）
    const w = smooth(40, 18, deg) * smooth(0, 7, u);
    if (w <= 0) continue;
    const a = DROP * w, c = Math.cos(a), s = Math.sin(a);
    pos.setX(i, side * (SHOULDER.x + u * c + v * s)); pos.setY(i, SHOULDER.y - u * s + v * c);
    if (nor) { const nu = nor.getX(i) * side, nv = nor.getY(i); nor.setX(i, side * (nu * c + nv * s)); nor.setY(i, -nu * s + nv * c); }
  }
  pos.needsUpdate = true; if (nor) nor.needsUpdate = true;
}

// 皮膚：把頂點換算到 Character Creator 男生模型的座標（z 往上、y 往前是負的、頭的比例），借用 paintSkin
function paintBody(geo, skin) {
  const k = 1.38, p = geo.attributes.position, tmp = new THREE.BufferGeometry(), arr = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { arr[i * 3] = p.getX(i) * k; arr[i * 3 + 1] = -(p.getZ(i) - 11) * k - 9; arr[i * 3 + 2] = (p.getY(i) - EYE_Y) * k + 169.3; }
  tmp.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  paintSkin(tmp, skin, 0);
  geo.setAttribute('color', tmp.attributes.color);
}

// 眼睛：原本全白。以兩顆眼球的中心算方向，正前方畫瞳孔、虹膜
function paintEyes(geo, iris) {
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3), I = new THREE.Color(iris), c = new THREE.Color();
  const centers = [-1, 1].map((s) => { const v = new THREE.Vector3(); let k = 0; for (let i = 0; i < n; i++) if (Math.sign(p.getX(i)) === s) { v.x += p.getX(i); v.y += p.getY(i); v.z += p.getZ(i); k++; } return v.divideScalar(k); });
  const d = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const ctr = centers[p.getX(i) < 0 ? 0 : 1];
    d.set(p.getX(i), p.getY(i), p.getZ(i)).sub(ctr).normalize();
    if (d.z > 0.95) c.set('#0a0a0c'); // 瞳孔
    else if (d.z > 0.8) c.copy(I).multiplyScalar(0.6 + (d.z - 0.8) * 3); // 虹膜：外圈深、內圈亮
    else c.set('#e9e4dc'); // 眼白
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function paintHair(geo, root, tip) {
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3), R = new THREE.Color(root), T = new THREE.Color(tip), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = THREE.MathUtils.clamp((Math.hypot(x, y - 135, z - 1) - 7) / 4, 0, 1);
    c.copy(R).lerp(T, t).multiplyScalar(0.85 + 0.3 * hash3(Math.round(x), Math.round(y), Math.round(z)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

export function loadCyril(scene, { house = { main: '#0f2a1e', trim: '#c0c4c8' }, hair = '#8c8270', hairTip = '#d8d0bc', skin = '#f0cdb6', iris = '#3f7a52', height = 1.78 } = {}) {
  return new Promise((resolve, reject) => {
    new FBXLoader().load('models/cyril/Modern_Tarzan.fbx', (o) => {
      o.updateMatrixWorld(true);
      const model = new THREE.Group();
      o.traverse((m) => {
        if (!m.isMesh) return;
        const geo = m.geometry.clone().applyMatrix4(m.matrixWorld); // 每個零件的位置先烘進頂點，方便用同一套座標處理
        let mat;
        if (m.name === 'Body') { paintBody(geo, skin); dropArms(geo); mat = skinMat('skin'); }
        else if (m.name === 'T-Shirt') { dropArms(geo); mat = new THREE.MeshStandardMaterial({ color: '#e6e2da', roughness: 0.8 }); } // 斗篷底下的白襯衫
        else if (m.name === 'Eyes') { paintEyes(geo, iris); mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15 }); }
        else if (m.name === 'Hair') { paintHair(geo, hair, hairTip); mat = new THREE.MeshLambertMaterial({ vertexColors: true }); }
        else if (m.name === 'Eyelashes') mat = new THREE.MeshLambertMaterial({ color: '#2a2018' });
        else if (m.name === 'Shoes') mat = new THREE.MeshStandardMaterial({ color: '#241912', roughness: 0.45 });
        else mat = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.9 }); // 短褲（被斗篷蓋住）
        const mesh = new THREE.Mesh(geo, mat); mesh.name = m.name; mesh.castShadow = mesh.receiveShadow = true;
        model.add(mesh);
      });
      const s = height / 145.5; model.scale.setScalar(s);
      const holder = new THREE.Group(); holder.add(model);
      const cloak = makeCloak(house); cloak.position.y = 124 * s - 0.2; cloak.position.z = 0.01; cloak.scale.set(0.96, 1, 0.96);
      holder.add(cloak);
      scene.add(holder);
      const base = { rotY: 0 };
      resolve({
        root: holder,
        // 沒有骨架：整個人慢慢轉向玩家、輕微呼吸
        update(t, dt, playerPos) {
          model.scale.y = s * (1 + Math.sin(t * 1.3) * 0.004);
          const dx = playerPos.x - holder.position.x, dz = playerPos.z - holder.position.z;
          const want = Math.hypot(dx, dz) < 5 ? Math.atan2(dx, dz) : base.rotY;
          holder.rotation.y += Math.atan2(Math.sin(want - holder.rotation.y), Math.cos(want - holder.rotation.y)) * Math.min(1, dt * 1.2);
        },
        setRest(r) { base.rotY = r; },
        setMood() {}, talk() {}, // 沒有表情
      });
    }, undefined, reject);
  });
}
