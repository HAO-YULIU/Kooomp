// 模型貼圖縮小（2026-10-30）：全部模型的貼圖解開後約 1.2 GB，手機記憶體不夠，載入到一半網頁會被瀏覽器重整。
// 載好每個模型時呼叫一次：顏色貼圖最大 maxColor、其他貼圖（凹凸、粗糙度…）最大 maxOther；手機上擺設的凹凸貼圖（normalMap）直接拿掉、其他縮到 128（暗暗的場景裡看不太出來）。
// 粗糙度／金屬貼圖如果拿掉，要一起把金屬係數調低（glTF 的金屬係數預設是 1，只拿掉貼圖整個會變成金屬）：見下面的 simplify。
import { MeshStandardMaterial as THREE_Standard } from 'three';
const isTouch = typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
/** 手機：用事先縮好貼圖的模型（models/props-m、chars-m，tools/mobile-models.cjs 產生），下載少、解開快 */
export const MODEL_SUFFIX = isTouch ? '-m' : '';
const COLOR = ['map', 'emissiveMap'];
const OTHER = ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'alphaMap', 'specularIntensityMap', 'sheenColorMap', 'clearcoatNormalMap'];
const done = new WeakSet();

function shrink(tex, max) {
  const im = tex?.image; if (!im || done.has(tex)) return; done.add(tex);
  const w = im.width, h = im.height; if (!w || !h || Math.max(w, h) <= max) return;
  const k = max / Math.max(w, h), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  try { c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); } catch { return; }
  tex.image = c; tex.needsUpdate = true; im.close?.(); // 原本的大圖（ImageBitmap）馬上釋放
}

// 手機：擺設的材質簡化（2026-11-02）。每一種材質組合（有沒有粗糙度圖、金屬度圖、陰影圖、是不是 Physical…）都要另外準備一支畫圖程式，
// 手機準備這些程式很花時間（載入條「喚醒同伴與守夜人」那段）。拿掉粗糙度／金屬度／陰影圖（用固定的值），Physical 換成 Standard，程式種類就少很多。
const simplified = new WeakMap();
function simplify(m) {
  if (!m || !m.isMeshStandardMaterial) return m;
  if (simplified.has(m)) return simplified.get(m);
  let n = m;
  if (m.isMeshPhysicalMaterial) {
    n = new THREE_Standard({ name: m.name, color: m.color, map: m.map, emissive: m.emissive, emissiveMap: m.emissiveMap, emissiveIntensity: m.emissiveIntensity, roughness: m.roughness, metalness: m.metalness,
      transparent: m.transparent || m.transmission > 0, opacity: m.transmission > 0 ? Math.min(m.opacity, 0.45) : m.opacity, depthWrite: m.transmission > 0 ? false : m.depthWrite, side: m.side, alphaTest: m.alphaTest, vertexColors: m.vertexColors });
  }
  if (n.roughnessMap) { n.roughnessMap = null; n.roughness = Math.max(0.55, Math.min(n.roughness, 0.85)); }
  if (n.metalnessMap) { n.metalnessMap = null; n.metalness = Math.min(n.metalness, 0.25); } // 拿掉金屬度圖：不要整個變成金屬
  if (n.aoMap) n.aoMap = null;
  n.needsUpdate = true; simplified.set(m, n); return n;
}

/** kind：'prop'（擺設）或 'char'（角色、守夜人） */
export function slimTextures(root, kind = 'prop') {
  let low = false; try { low = isTouch && localStorage.getItem('ml_lowpower') === '1'; } catch { /* 無痕 */ } // 手機開省電模式（或上次載入當掉自動開）：顏色貼圖再小一半
  const prop = kind === 'prop', maxColor = isTouch ? (low && prop ? 256 : 512) : 1024, maxOther = isTouch ? (prop ? 128 : 256) : 512, dropNormal = isTouch && prop;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (isTouch && prop) o.material = Array.isArray(o.material) ? o.material.map(simplify) : simplify(o.material); // 手機：擺設的材質統一簡化
    for (const m of [o.material].flat()) {
      if (!m) continue;
      for (const k of COLOR) shrink(m[k], maxColor);
      for (const k of OTHER) { if (!m[k]) continue; if (dropNormal && k === 'normalMap') { m.normalMap.image?.close?.(); m.normalMap = null; m.needsUpdate = true; } else shrink(m[k], maxOther); }
    }
  });
}
