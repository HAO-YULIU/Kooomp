// 髮型庫：把 Character Creator 模型的頭髮（和眼鏡）拆下來，變成可以戴在別人頭上的零件。
// 用來讓「同一張臉」的配角看起來不一樣（例如赫爾嘉用艾洛拉的短捲髮＋眼鏡，就不像月晞）。
// 回傳的零件：原點是頭的中心（兩眼中間往上 0.5 公分、往後 6 公分）、臉朝 +z、單位公尺，
// 可以直接當 loadCC 的 headGear，或放在其他模型的頭上。
import * as THREE from 'three';
import { FBXLoader } from '../vendor/addons/loaders/FBXLoader.js';
import { FILES, paintHair, ccMaterial } from './cc.mjs';

const parsed = {}; // 同一個模型檔只讀一次
const loadRaw = (from) => (parsed[from] ||= new Promise((res, rej) => new FBXLoader().load(FILES[from], res, undefined, rej)));

/**
 * from：'female'（月晞的模型：Space_bun_L、Space_bun_R、Air_bangs、Double_high）、'male'（Slicked_Back_Side）、
 *       'elora'（Scalp＝短捲髮、glasses）
 * parts：要拿的零件名稱（部分符合就算，例如 'glasses'）
 * hair、hairTip：髮色（髮根、髮尾）
 */
export async function loadHair({ from, parts, hair = '#1e1510', hairTip = '#4a3426' }) {
  const o = await loadRaw(from);
  let P = 'EM3D_Base_'; o.traverse((c) => { if (c.isMesh && /_Base_Body$/.test(c.name)) P = c.name.replace(/Body$/, ''); });
  const eyeGeo = o.getObjectByName(P + 'Eye').geometry; eyeGeo.computeBoundingBox();
  const E = eyeGeo.boundingBox.getCenter(new THREE.Vector3()); // 模型原本的座標：公分、z 朝上、y 負的是前方
  const dz = E.z - 169.3;
  const group = new THREE.Group();
  group.userData.eyeWidth = eyeGeo.boundingBox.max.x - eyeGeo.boundingBox.min.x; // 兩眼外側的距離（公分），戴到別人頭上時用來換算頭的大小
  o.traverse((c) => {
    if (!c.isMesh || !parts.some((p) => c.name.toLowerCase().includes(p.toLowerCase()))) return;
    let geo = c.geometry.clone();
    geo.morphAttributes = {}; geo.deleteAttribute('skinIndex'); geo.deleteAttribute('skinWeight');
    if (!/glasses/i.test(c.name)) paintHair(geo, hair, hairTip, geo.groups.length > 1 ? geo.groups[0].count : 0, dz);
    // 換到零件自己的座標：以頭的中心為原點、y 朝上、z 朝前
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      pos.setXYZ(i, (x - E.x) * 0.01, (z - E.z) * 0.01 - 0.005, -(y - E.y) * 0.01 + 0.06);
      if (nor) { const ny = nor.getY(i), nz = nor.getZ(i); nor.setXYZ(i, nor.getX(i), nz, -ny); }
    }
    geo.computeBoundingSphere();
    const mats = [].concat(c.material).map((m) => {
      if (/Scalp/.test(m.name) && Array.isArray(c.material) && c.material.length > 1) { const hide = new THREE.MeshBasicMaterial(); hide.visible = false; return hide; } // 頭皮不用：戴到別人頭上會蓋到臉
      if (!/glasses/i.test(c.name)) return ccMaterial(m, { hair });
      if (/lens/i.test(m.name)) return new THREE.MeshStandardMaterial({ name: m.name, color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.5, depthWrite: false }); // 鏡片原本是不透明的，看起來像墨鏡
      return m.clone();
    });
    const mesh = new THREE.Mesh(geo, Array.isArray(c.material) ? mats : mats[0]);
    mesh.name = c.name; mesh.castShadow = true; mesh.frustumCulled = false;
    group.add(mesh);
  });
  return group;
}

/** 好幾組零件合在一起（例如頭髮＋眼鏡） */
export async function loadHairSet(list) {
  const g = new THREE.Group();
  for (const part of await Promise.all(list.map(loadHair))) { g.add(part); g.userData.eyeWidth ??= part.userData.eyeWidth; }
  return g;
}
