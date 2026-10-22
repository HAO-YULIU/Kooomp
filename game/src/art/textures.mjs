// 場景用的貼圖（帳號二）：全部用程式畫在 canvas 上，不用下載圖檔（手機省流量，也沒有授權問題）。
// 每種貼圖只畫一次（快取）；要不同的重複次數時用 tile() 複製一份（共用同一張圖，不多佔記憶體）。
import * as THREE from 'three';

const cache = new Map();
const S = 512;

// 簡單的雜訊（同樣的座標得到同樣的值）。用整數運算打散（比 Math.sin 快很多：一張圖要算幾十萬次）
const hash = (x, y, s = 0) => {
  let h = Math.imul((x * 1000) | 0, 374761393) ^ Math.imul((y * 1000) | 0, 668265263) ^ Math.imul((s * 1000) | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
function noise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s = 0) => noise(x, y, s) * 0.5 + noise(x * 2, y * 2, s + 1) * 0.25 + noise(x * 4, y * 4, s + 2) * 0.15 + noise(x * 8, y * 8, s + 3) * 0.1;
// 顏色字串 → [r, g, b]：記起來（畫每個點都會用到，每次重新解析字串會非常慢）
const colCache = new Map();
const col = (hex) => colCache.get(hex) ?? colCache.set(hex, (() => { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; })()).get(hex);

function make(key, draw, { srgb = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S);
  draw(img.data, g);
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}
// 每個點的顏色：fn(x, y) → [r, g, b]（0～255）
const fill = (fn) => (d) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const [r, g, b] = fn(x, y), i = (y * S + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; } };
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

/** 一份重複 rx × ry 次的貼圖（共用同一張圖） */
export function tile(tex, rx, ry) { const t = tex.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t; }

/** 石牆：一塊一塊錯開的石磚（一張貼圖＝ 2 公尺見方：4 排、每排 2.5 塊） */
export const stoneWall = (base = '#6b655d') => make('stoneWall' + base, fill((x, y) => {
  const B = col(base), rows = 4, rh = S / rows, row = Math.floor(y / rh), bw = S / 2.5, off = (row % 2) * bw * 0.5;
  const bx = Math.floor((x + off) / bw), lx = (x + off) - bx * bw, ly = y - row * rh;
  const mortar = Math.min(lx, bw - lx, ly, rh - ly) < 3;
  const k = 0.82 + hash(bx, row, 3) * 0.3 + (fbm(x / 40, y / 40, bx) - 0.5) * 0.25;
  return mortar ? shade(B, 0.45) : shade(B, k);
}));

/** 石板地：大塊方形石板（一張貼圖＝ 3 公尺見方：3 × 3 塊） */
export const flagstone = (base = '#5a5550') => make('flag' + base, fill((x, y) => {
  const B = col(base), n = 3, w = S / n, bx = Math.floor(x / w), by = Math.floor(y / w), lx = x - bx * w, ly = y - by * w;
  const joint = Math.min(lx, w - lx, ly, w - ly) < 2.5;
  const k = 0.8 + hash(bx, by, 7) * 0.28 + (fbm(x / 60, y / 60, bx + by * 7) - 0.5) * 0.3;
  return joint ? shade(B, 0.4) : shade(B, k);
}));

/** 木地板：長條木板（一張貼圖＝ 2 公尺見方：8 條） */
export const planks = (base = '#5a3a22') => make('planks' + base, fill((x, y) => {
  const B = col(base), n = 8, w = S / n, px = Math.floor(x / w), lx = x - px * w;
  const seg = Math.floor((y + hash(px, 0, 1) * S) / (S * 0.75)), ly = (y + hash(px, 0, 1) * S) % (S * 0.75);
  const gap = lx < 1.5 || ly < 1.5;
  const grain = Math.sin((x * 0.15 + fbm(x / 20, y / 120, px) * 8)) * 0.06;
  const k = 0.78 + hash(px, seg, 2) * 0.3 + grain + (fbm(x / 10, y / 80, px) - 0.5) * 0.2;
  return gap ? shade(B, 0.35) : shade(B, k);
}));

/** 木牆板（下半截的護牆板）：直條＋框（一張貼圖＝ 2 公尺寬 × 2 公尺高） */
export const panelling = (base = '#3e2a1a') => make('panel' + base, fill((x, y) => {
  const B = col(base), n = 3, w = S / n, px = Math.floor(x / w), lx = x - px * w, m = 18;
  const inFrame = lx > m && lx < w - m && y > m * 1.5 && y < S - m * 1.5;
  const bevel = inFrame && (lx < m + 6 || lx > w - m - 6 || y < m * 1.5 + 6 || y > S - m * 1.5 - 6);
  const grain = Math.sin(y * 0.12 + fbm(x / 60, y / 15, px) * 6) * 0.05;
  const k = (inFrame ? 0.92 : 1.05) + grain + (fbm(x / 30, y / 30, px) - 0.5) * 0.15 + (bevel ? -0.25 : 0);
  return shade(B, k);
}));

/** 壁紙：學院色的直條＋小花紋（一張貼圖＝ 1 公尺見方） */
export const wallpaper = (base = '#2a3a5a', accent = '#c8a24a') => make('wp' + base + accent, (d) => {
  const B = col(base), A = col(accent);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, sx = x % 128, sy = y % 128;
    const stripe = sx < 3 || (sx > 62 && sx < 66);
    const motif = (() => { const dx = sx - 32, dy = sy - 64; const r = Math.hypot(dx, dy * 0.7); return r < 14 && r > 11; })() || (() => { const dx = sx - 96, dy = (y + 64) % 128 - 64; const r = Math.hypot(dx * 0.7, dy); return r < 9 && r > 6; })();
    const k = 0.9 + (fbm(x / 50, y / 50, 4) - 0.5) * 0.2;
    const c = stripe || motif ? A.map((v, j) => v * 0.45 + B[j] * 0.55) : shade(B, k);
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
});

/** 灰泥／粉刷牆（天花板、星盤廳的牆） */
export const plaster = (base = '#2a2a3a') => make('plaster' + base, fill((x, y) => shade(col(base), 0.85 + (fbm(x / 70, y / 70, 9) - 0.5) * 0.35)));

/** 地毯：學院色、外圈有花邊（整張貼圖＝整塊地毯，不重複） */
export const rug = (base = '#5a1a1a', border = '#c8a24a') => make('rug' + base + border, fill((x, y) => {
  const B = col(base), D = col(border), e = Math.min(x, S - x, y, S - y);
  const band = e < 40 && e > 14, inner = e > 52 && e < 58;
  const diamond = Math.abs(x - S / 2) / 1.4 + Math.abs(y - S / 2) < 120 && Math.abs(x - S / 2) / 1.4 + Math.abs(y - S / 2) > 108;
  const k = 0.85 + (hash(Math.floor(x / 2), Math.floor(y / 2), 5) - 0.5) * 0.12;
  if (e < 14) return shade(B, 0.6);
  if (band || inner || diamond) return shade(D, k * 0.9);
  return shade(B, k);
}));

/** 金屬（黃銅、鐵）：細的拉絲紋 */
export const metal = (base = '#b08a3a') => make('metal' + base, fill((x, y) => shade(col(base), 0.85 + (noise(x / 2, y / 60, 11) - 0.5) * 0.3)));

/** 羊皮紙（燒焦的邊） */
export const parchment = () => make('parchment', fill((x, y) => {
  const P = col('#d8c49a'), e = Math.min(x, S - x, y, S - y) + (fbm(x / 30, y / 30, 12) - 0.5) * 60;
  if (e < 12) return [20, 14, 10];
  const burn = THREE.MathUtils.clamp((40 - e) / 30, 0, 1);
  return shade(P, (0.85 + (fbm(x / 40, y / 40, 13) - 0.5) * 0.3) * (1 - burn * 0.75));
}));

/** 夜空（窗外、星盤廳的天花板）：深藍＋星星 */
export const nightSky = () => make('night', (d) => {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, n = fbm(x / 120, y / 120, 14);
    const star = hash(x, y, 15) > 0.9975 ? 255 * (0.5 + hash(x, y, 16) * 0.5) : 0;
    const c = [8 + n * 14 + star, 12 + n * 18 + star, 30 + n * 30 + star];
    d[i] = Math.min(255, c[0]); d[i + 1] = Math.min(255, c[1]); d[i + 2] = Math.min(255, c[2]); d[i + 3] = 255;
  }
});

/** 水面：深色、斜斜的波紋（黑湖） */
export const water = () => make('water', fill((x, y) => { const n = fbm(x / 30 + y / 90, y / 25, 17); return [6 + n * 14, 10 + n * 18, 18 + n * 26]; }));

/** 帶字的圖（例如門牌、天花板的星座）：draw(g, S) 自己畫 */
export function drawn(key, draw, { size = 512, srgb = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(key, t);
  return t;
}
