// 擺設的 3D 模型（帳號二，2026-10-22）：製作人下載的模型放進 game/models/props/，並列在 list.json：
//   { "armchair": "armchair.glb", "wardrobe": { "file": "wardrobe.glb", "ry": 3.1416 }, ... }   ry：模型的正面不是朝 +z 時，先轉多少（弧度）
// 進遊戲時（載入畫面）先全部載好；場景擺東西時有模型就用模型（自動縮放到原本那個位置的大小、放在地上），沒有就用方塊拼的。
// 名稱：armchair sofa wardrobe bookshelf desk clock chandelier candelabra armor gargoyle bust skull bones rowboat crate barrel cauldron globe telescope plant lantern statue bed
import * as THREE from 'three';
import { GLTFLoader } from '../../../prototype/vendor/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../../../prototype/vendor/addons/libs/meshopt_decoder.module.js';

const T = {}; // 名稱 → 載好的模型（範本）
let base = 'models/props/';

/** 載入畫面時呼叫：讀清單、載入全部模型（失敗的跳過） */
export async function preloadProps() {
  let list = {};
  try { const r = await fetch(base + 'list.json'); if (r.ok) list = await r.json(); } catch { return; }
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  await Promise.all(Object.entries(list).map(async ([name, ent]) => {
    const { file, ry = 0, tint, glow } = typeof ent === 'string' ? { file: ent } : ent;
    try {
      const g = await loader.loadAsync(base + file), root = g.scene;
      root.rotation.y = ry; root.updateMatrixWorld(true);
      root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; for (const m of [o.material].flat()) { if (m.map) m.map.anisotropy = 4; if (tint) m.color?.set(tint); if (glow && m.map) { m.emissive?.set(glow); m.emissiveMap = m.map; m.emissiveIntensity = 0.9; } } } }); // tint：整個染色（例如白色的石像鬼染成石頭灰）；glow：亮的地方自己發光（提燈的玻璃）
      // 量好大小：底部中間對齊原點
      const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const holder = new THREE.Group(); root.position.x -= c.x; root.position.y -= box.min.y; root.position.z -= c.z; holder.add(root);
      T[name] = { holder, size };
    } catch (e) { console.warn('模型載入失敗', name, e); }
  }));
}
export const hasProp = (name) => !!T[name];
/** 同一種東西有好幾款（bust、bust2、bust3…）：依 seed 挑一款 */
export function variant(name, seed) { const list = [name, name + '2', name + '3', name + '4'].filter((n) => T[n]); return list.length ? list[Math.abs(Math.floor(seed)) % list.length] : name; }

/**
 * 擺一個模型：parent 裡、(x, y, z)、面向 ry（模型的正面要朝 +z）。fit＝[寬, 高, 深]：縮放到放得進這個大小（等比例）。
 * 回傳 true＝擺了（就不用再拼方塊的版本）
 */
export function placeProp(parent, name, x, y, z, ry, fit) {
  const t = T[name]; if (!t || !parent) return false;
  const o = t.holder.clone(true);
  const [w, h, d] = fit, s = Math.min(w / (t.size.x || 1), h / (t.size.y || 1), d / (t.size.z || 1));
  o.scale.setScalar(s); o.position.set(x, y, z); o.rotation.y = ry;
  parent.add(o); return { w: t.size.x * s, h: t.size.y * s, d: t.size.z * s, obj: o };
}
