// 模型貼圖縮小（2026-10-30）：全部模型的貼圖解開後約 1.2 GB，手機記憶體不夠，載入到一半網頁會被瀏覽器重整。
// 載好每個模型時呼叫一次：顏色貼圖最大 maxColor、其他貼圖（凹凸、粗糙度…）最大 maxOther；手機上擺設的凹凸貼圖（normalMap）直接拿掉、其他縮到 128（暗暗的場景裡看不太出來）。
// 粗糙度／金屬貼圖不能拿掉：glTF 的金屬係數預設是 1，拿掉貼圖整個會變成金屬。
const isTouch = typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
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

/** kind：'prop'（擺設）或 'char'（角色、守夜人） */
export function slimTextures(root, kind = 'prop') {
  let low = false; try { low = isTouch && localStorage.getItem('ml_lowpower') === '1'; } catch { /* 無痕 */ } // 手機開省電模式（或上次載入當掉自動開）：顏色貼圖再小一半
  const prop = kind === 'prop', maxColor = isTouch ? (low && prop ? 256 : 512) : 1024, maxOther = isTouch ? (prop ? 128 : 256) : 512, dropNormal = isTouch && prop;
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) {
      if (!m) continue;
      for (const k of COLOR) shrink(m[k], maxColor);
      for (const k of OTHER) { if (!m[k]) continue; if (dropNormal && k === 'normalMap') { m.normalMap.image?.close?.(); m.normalMap = null; m.needsUpdate = true; } else shrink(m[k], maxOther); }
    }
  });
}
