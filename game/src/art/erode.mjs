// 蝕化（帳號二，2026-11-03，第二章的蝕化學生、蝕化的諾克斯教授用）：把任何角色變成被魔蝕侵蝕的樣子。
//   erode(root, k)：k 0～1。皮膚上爬滿黑紫色的血管紋、膚色變灰白；k ≥ 0.5 眼睛變全黑、指甲變黑；k ≥ 0.85 眼睛透出一點暗紅光。
// 只改材質（每個角色自己一份，不影響別人），模型、骨架、動作都不動。可以對同一個角色呼叫好幾次（越來越嚴重）。
import * as THREE from 'three';

const veinCache = new Map(); // 「原本的皮膚貼圖＋程度」→ 畫好血管的貼圖（同一種學生共用）

function rnd(seed) { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// 在皮膚貼圖上畫血管：從幾個點往外長出分岔的細線，越嚴重越多、越粗
function veinTexture(src, k) {
  const key = `${src?.uuid ?? 'plain'}:${k.toFixed(2)}`;
  if (veinCache.has(key)) return veinCache.get(key);
  const im = src?.image, w = im?.width || 1024, h = im?.height || 1024;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); // 沒有皮膚貼圖（膚色畫在頂點上）：白底，只畫血管，疊在膚色上
  if (im) try { g.drawImage(im, 0, 0, w, h); } catch { /* 讀不到就白底 */ }
  // 膚色變灰白
  g.globalCompositeOperation = 'saturation'; g.fillStyle = `rgba(128,128,128,${0.6 * k})`; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(190,185,200,${0.25 * k})`; g.fillRect(0, 0, w, h);
  // 血管
  const r = rnd(w * 7 + h * 13 + Math.round(k * 100)), s = w / 512 * 1.6; // 血管畫粗一點，臉上才看得到
  const branch = (x, y, a, len, width, depth) => {
    for (let i = 0; i < len; i++) {
      const nx = x + Math.cos(a) * 3 * s, ny = y + Math.sin(a) * 3 * s;
      g.strokeStyle = `rgba(${20 + r() * 25},0,${25 + r() * 20},${0.45 + 0.35 * k})`; g.lineWidth = Math.max(0.6, width * (1 - i / len)) * s;
      g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      x = nx; y = ny; a += (r() - 0.5) * 0.6;
      if (depth < 3 && r() < 0.06) branch(x, y, a + (r() < 0.5 ? 0.7 : -0.7), len * 0.55, width * 0.6, depth + 1);
    }
  };
  const roots = Math.round(4 + 18 * k);
  for (let i = 0; i < roots; i++) { const x = r() * w, y = r() * h; g.fillStyle = `rgba(15,0,20,${0.35 * k})`; g.beginPath(); g.arc(x, y, (4 + 10 * k) * s, 0, Math.PI * 2); g.fill(); for (let j = 0; j < 4; j++) branch(x, y, r() * Math.PI * 2, 25 + 40 * k, 1.2 + 2 * k, 0); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (src) { t.flipY = src.flipY; t.wrapS = src.wrapS; t.wrapT = src.wrapT; } else t.flipY = false; // glTF 的貼圖不翻
  veinCache.set(key, t); return t;
}

export function erode(root, k = 1) {
  k = Math.max(0, Math.min(1, k));
  if (k <= 0) return root;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const fix = (m) => {
      if (!m) return m;
      const name = m.name || '';
      if (/Skin|Body|Head/i.test(name) && !/Scalp|Hair/i.test(name)) {
        const n = m.clone(); n.userData.eroded = true;
        const base = m.userData.preErode ?? m.map; n.userData.preErode = base;
        n.map = veinTexture(base, k);
        if (!base) n.color = new THREE.Color(m.userData.preColor ?? m.color).lerp(new THREE.Color('#a49cac'), 0.55 * k), n.userData.preColor = m.userData.preColor ?? m.color.clone(); // 膚色在頂點上：整體調灰
        if (n.sheen !== undefined) n.sheen = (m.sheen ?? 0) * (1 - k); // 皮膚邊緣的血色淡掉
        n.needsUpdate = true; return n;
      }
      if (k >= 0.5 && /Eye_[RL]$|Cornea|Iris|Pupil|eyes?$/i.test(name)) { // 眼睛整顆變黑（反光還在，看起來濕濕的）
        const n = new THREE.MeshStandardMaterial({ name, color: '#050206', roughness: 0.15, metalness: 0.1, transparent: m.transparent, opacity: m.opacity });
        if (k >= 0.85 && !/Cornea/i.test(name)) { n.emissive = new THREE.Color('#5a0008'); n.emissiveIntensity = 0.8; }
        return n;
      }
      if (k >= 0.5 && /Nail/i.test(name)) return new THREE.MeshStandardMaterial({ name, color: '#0a0508', roughness: 0.3 });
      if (k >= 0.5 && /Tearline|Occlusion|ONUGlusion/i.test(name)) { const n = m.clone(); n.color = new THREE.Color('#200008'); return n; } // 眼眶泛黑
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
  });
  return root;
}
