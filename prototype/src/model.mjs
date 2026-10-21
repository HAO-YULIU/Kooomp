// 製作人提供的寫實人物模型（Female_Human.fbx）。用來跟「程式做的角色」比較美術風格。
// 模型本身沒有骨架和動畫：原本是 A 字站姿（手臂張開 45 度），這裡直接移動手臂的頂點，讓手自然垂下。
import * as THREE from 'three';
import { FBXLoader } from '../vendor/addons/loaders/FBXLoader.js';

const DIR = 'models/female/';

// 把 A 字站姿的手臂放下來。座標是模型原本的（單位公尺、z 朝上、y 是左右、x 朝前）。
// 以肩膀為圓心，越像「手臂」的頂點（在肩膀斜下方、往外伸）旋轉越多，腋下慢慢過渡，身體不動。
const SHOULDER = { y: 0.15, z: 1.32 }, DROP = THREE.MathUtils.degToRad(32);
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function relaxArms(geo) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), z = pos.getZ(i), side = Math.sign(y) || 1;
    const dy = Math.abs(y) - SHOULDER.y, dz = z - SHOULDER.z;
    if (dy <= 0) continue;
    const deg = THREE.MathUtils.radToDeg(Math.atan2(-dz, dy)); // 在肩膀下方幾度
    const w = smooth(72, 58, deg) * smooth(0, 0.08, dy);
    if (w <= 0) continue;
    const a = DROP * w, c = Math.cos(a), s = Math.sin(a);
    pos.setY(i, side * (SHOULDER.y + dy * c + dz * s)); pos.setZ(i, SHOULDER.z - dy * s + dz * c);
    if (nor) { const ny = nor.getY(i) * side, nz = nor.getZ(i); nor.setY(i, side * (ny * c + nz * s)); nor.setZ(i, -ny * s + nz * c); }
  }
  pos.needsUpdate = true; if (nor) nor.needsUpdate = true; geo.computeBoundingSphere();
}

export function loadFemaleModel(scene) {
  return new Promise((resolve, reject) => {
    const tl = new THREE.TextureLoader();
    const tex = (name, srgb = false) => { const t = tl.load(DIR + name); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    const body = new THREE.MeshStandardMaterial({
      map: tex('T_Body_Human_Female_BaseColor.jpg', true), normalMap: tex('T_Body_Human_Female_Normal.jpg'),
      roughnessMap: tex('T_Body_Human_Female_Roughness.jpg'), roughness: 1, metalness: 0,
    });
    const hair = new THREE.MeshStandardMaterial({
      map: tex('T_Hair_Human_Female_Color.jpg', true), alphaMap: tex('T_Hair_Human_Female_Alpha.jpg'), normalMap: tex('T_Hair_Human_Female_Normal.jpg'),
      alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6,
    });
    // FBX 裡記的是原作者電腦上的貼圖路徑，全部擋掉，改用上面自己指定的材質
    const mgr = new THREE.LoadingManager(); mgr.setURLModifier((u) => (/\.fbx$/i.test(u) ? u : 'data:,'));
    new FBXLoader(mgr).load(DIR + 'Female_Human.fbx', (o) => {
      o.traverse((c) => {
        if (!c.isMesh) return;
        c.material = /hair|eyelash|eyebrow/i.test(c.name) ? hair : body;
        if (/^(Female_Human|Outfit)$/.test(c.name)) relaxArms(c.geometry);
        c.castShadow = true; c.receiveShadow = true;
      });
      o.scale.setScalar(0.01); // 公分 → 公尺
      const holder = new THREE.Group(); holder.add(o);
      o.rotation.y = -Math.PI / 2; // 模型原本面向 +x，轉成面向 +z（跟程式做的角色一樣）
      scene.add(holder);
      resolve(holder);
    }, undefined, reject);
  });
}
