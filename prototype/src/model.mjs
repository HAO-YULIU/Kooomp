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

// 同一個模型換成不同角色：改貼圖上的紅色配件（領帶、緞帶）成學院色、改眼睛顏色、改髮色、改身高。
// 貼圖上眼睛的位置（1024 的貼圖，像素座標）
const IRIS = { x: 75, y: 815, r: 74 };
function rgb2hsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
function recolorBody(img, look) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const sx = img.width / 1024, d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const [h, s, l] = rgb2hsl(p[i] / 255, p[i + 1] / 255, p[i + 2] / 255);
    let out = null;
    const x = (i / 4) % c.width, y = Math.floor(i / 4 / c.width);
    if (look.irisHue != null && Math.hypot(x - IRIS.x * sx, y - IRIS.y * sx) < IRIS.r * sx && s > 0.15 && l < 0.6) {
      out = hsl2rgb(look.irisHue, Math.min(1, s * 1.3), l * 1.15); // 只改虹膜（偏棕、有彩度），眼白和瞳孔不動
    } else if (look.accentHue != null && s > 0.45 && (h < 20 || h > 340) && l > 0.1 && l < 0.7) {
      out = hsl2rgb(look.accentHue, s * (look.accentSat ?? 1), Math.min(0.85, l * (look.accentLight ?? 1)));
    }
    if (out) { p[i] = out[0] * 255; p[i + 1] = out[1] * 255; p[i + 2] = out[2] * 255; }
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/**
 * look：{ hair: '#顏色'（不給就用原本的金髮）, accentHue: 領帶色相（度）, accentSat, accentLight, irisHue: 眼睛色相, height: 身高倍率 }
 */
export function loadFemaleModel(scene, look = {}) {
  return new Promise((resolve, reject) => {
    const tl = new THREE.TextureLoader();
    const tex = (name, srgb = false) => { const t = tl.load(DIR + name); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    const recolor = look.accentHue != null || look.irisHue != null;
    const body = new THREE.MeshStandardMaterial({
      map: recolor ? null : tex('T_Body_Human_Female_BaseColor.jpg', true), normalMap: tex('T_Body_Human_Female_Normal.jpg'),
      roughnessMap: tex('T_Body_Human_Female_Roughness.jpg'), roughness: 1, metalness: 0,
    });
    const hair = new THREE.MeshStandardMaterial({
      map: tex('T_Hair_Human_Female_Color.jpg', true), alphaMap: tex('T_Hair_Human_Female_Alpha.jpg'), normalMap: tex('T_Hair_Human_Female_Normal.jpg'),
      alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6,
    });
    if (look.hair) { hair.map = null; hair.color.set(look.hair); } // 原本的髮色貼圖是單一金色，直接換顏色
    if (recolor) tl.load(DIR + 'T_Body_Human_Female_BaseColor.jpg', (t) => { body.map = recolorBody(t.image, look); body.needsUpdate = true; });
    // FBX 裡記的是原作者電腦上的貼圖路徑，全部擋掉，改用上面自己指定的材質
    const mgr = new THREE.LoadingManager(); mgr.setURLModifier((u) => (/\.fbx$/i.test(u) ? u : 'data:,'));
    new FBXLoader(mgr).load(DIR + 'Female_Human.fbx', (o) => {
      o.traverse((c) => {
        if (!c.isMesh) return;
        c.material = /hair|eyelash|eyebrow/i.test(c.name) ? hair : body;
        if (/^(Female_Human|Outfit)$/.test(c.name)) relaxArms(c.geometry);
        c.castShadow = true; c.receiveShadow = true;
      });
      o.scale.setScalar(0.01 * (look.height || 1)); // 公分 → 公尺
      const holder = new THREE.Group(); holder.add(o);
      o.rotation.y = -Math.PI / 2; // 模型原本面向 +x，轉成面向 +z（跟程式做的角色一樣）
      scene.add(holder);
      resolve(holder);
    }, undefined, reject);
  });
}
