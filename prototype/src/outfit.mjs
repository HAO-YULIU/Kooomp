// 衣服：把製作人提供的衣服模型穿到 Character Creator 角色身上。
// 衣服本身沒有骨架，做法是：
// 1. 依角色的肩膀位置、肩寬、肩膀到屁股的高度，把衣服縮放、對齊到身上
// 2. 袖子轉到跟角色的手臂一樣的角度（衣服原本是 A 字或 T 字站姿，角色的手是垂下的）
// 3. 衣服如果陷進身體裡，就往外推到皮膚外面一點點
// 4. 每個衣服的點，抄身體上最近那個點的「跟哪幾根骨頭動」，衣服就會跟著角色呼吸、轉身
// 5. 被衣服蓋住的皮膚藏起來，免得從衣服底下穿出來
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';

const DIR = 'models/clothes/';
// 衣服清單：檔案、貼圖、要拿哪幾塊（依檔案裡的順序）
export const OUTFITS = {
// 尺寸都是「整個檔案高度」的幾成（從頂端＝領口往下量）：
// sw：肩關節離中線多遠；sh：肩關節在頂端往下多少；hip：穿的人的骨盆在頂端往下多少。看模型量的，自動量容易被袖子、立領騙
// flipY：貼圖要不要上下翻（glTF 來的不翻，FBX、OBJ 來的要翻）
  jk: { file: 'jk.glb', tex: 'jk_color.jpg', parts: null, sw: 0.155, sh: 0.07, hip: 0.56, flipY: false, credit: '"Jk School Uniform" by Style3D CG (CC-BY-4.0)' }, // 襯衫、領結、格子裙
  boy: { file: 'male.glb', tex: 'male_color.jpg', parts: null, sw: 0.08, sh: 0.07, hip: 0.37, flipY: true }, // 男生制服：襯衫、長褲（T 字站姿）
  coat: { file: 'coat.glb', tex: 'coat_color.jpg', parts: [0], sw: 0.13, sh: 0.07, hip: 0.4, flipY: true }, // 長大衣（只拿外套）
  coatFull: { file: 'coat.glb', tex: 'coat_color.jpg', parts: [0, 1], sw: 0.13, sh: 0.07, hip: 0.4, flipY: true }, // 長大衣＋裡面的襯衫長褲
};

const cache = {};
async function loadSource(name) {
  const def = OUTFITS[name];
  cache[def.file] ||= new GLTFLoader().loadAsync(DIR + def.file);
  const g = await cache[def.file];
  const geos = [], all = []; let k = 0;
  g.scene.updateMatrixWorld(true);
  g.scene.traverse((m) => { if (!m.isMesh) return; const geo = m.geometry.clone().applyMatrix4(m.matrixWorld); all.push(geo); if (!def.parts || def.parts.includes(k)) geos.push(geo); k++; });
  return { geos, all }; // all：整個檔案（量尺寸用），geos：要穿的那幾塊
}

// 學院色：把貼圖上偏藍的格子、領結換成學院的顏色
const texCache = {};
function houseTexture(file, hue, sat, flipY, light = 1, colorize = null) {
  const key = [file, hue, sat, flipY, light, colorize].join();
  return (texCache[key] ||= new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      if (colorize) { // 整張染成一個顏色，保留原本的明暗（看得出皺褶）
        const d = g.getImageData(0, 0, c.width, c.height), p = d.data, C = new THREE.Color(colorize);
        const base = 255 * 0.13; // 大衣布料原本的亮度大約是 13%（同一張貼圖還有白襯衫，不能用平均）
        for (let i = 0; i < p.length; i += 4) { const k = Math.min(2.5, (p[i] + p[i + 1] + p[i + 2]) / 3 / base); p[i] = Math.min(255, C.r * 255 * k); p[i + 1] = Math.min(255, C.g * 255 * k); p[i + 2] = Math.min(255, C.b * 255 * k); }
        g.putImageData(d, 0, 0);
      }
      if (hue != null) {
        const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
        for (let i = 0; i < p.length; i += 4) {
          const r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
          if (s < 0.08 || b < r) continue; // 只改偏藍的地方（格子、領結），白襯衫不動
          const t = new THREE.Color().setHSL(hue / 360, Math.min(1, s * sat), l * light);
          p[i] = t.r * 255; p[i + 1] = t.g * 255; p[i + 2] = t.b * 255;
        }
        g.putImageData(d, 0, 0);
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = flipY; res(t);
    };
    img.src = DIR + file;
  }));
}

// 簡單的空間格子：找最近的點
function grid(points, cell) {
  const map = new Map(), key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < points.length / 3; i++) { const k = key(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]); let a = map.get(k); if (!a) map.set(k, (a = [])); a.push(i); }
  return (x, y, z, maxR = 3) => {
    let best = -1, bd = Infinity;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let r = 0; r <= maxR; r++) {
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
        if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue;
        const a = map.get(`${cx + i},${cy + j},${cz + k}`); if (!a) continue;
        for (const q of a) { const dx = points[q * 3] - x, dy = points[q * 3 + 1] - y, dz = points[q * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = q; } }
      }
      if (best >= 0 && Math.sqrt(bd) < r * cell) break;
    }
    return [best, Math.sqrt(bd)];
  };
}
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * 把衣服穿上。ctx：loadCC 內部的資料 { holder, body（身體的 SkinnedMesh）, bone(name) }
 * spec：{ name: 'jk' | 'boy' | 'coat' | 'coatFull', hue（學院色的色相，度）, sat、light（彩度、亮度倍率）, tint（整件衣服再乘一個顏色）, puff（離皮膚、裡面那層衣服多遠，公尺） }
 * colorize：整件染成一個顏色（保留明暗）；noSleeves：剪掉袖子（外面要穿大衣時用）；hideInner：外層蓋住內層多近就把內層藏起來。
 * 同一個角色穿好幾層時，ctx.layers 會記住已經穿上的衣服，外層會被推到內層外面。
 * 回傳穿好的 SkinnedMesh 陣列。
 */
export async function wearOutfit(ctx, spec) {
  const { holder, body, bone } = ctx;
  const def = OUTFITS[spec.name];
  const { geos, all: allGeos } = await loadSource(spec.name);
  holder.updateMatrixWorld(true);

  // ---------- 身體現在的姿勢（每個點、每個面的方向） ----------
  const bp = body.geometry.attributes.position, n = bp.count, posed = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { body.getVertexPosition(i, v); v.applyMatrix4(body.matrixWorld); holder.worldToLocal(v); posed[i * 3] = v.x; posed[i * 3 + 1] = v.y; posed[i * 3 + 2] = v.z; }
  const pnorm = new Float32Array(n * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) { // 身體的頂點沒有共用，每三個是一個三角形
    a.fromArray(posed, i * 3); b.fromArray(posed, i * 3 + 3); c.fromArray(posed, i * 3 + 6);
    const nn = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    for (let k = 0; k < 3; k++) nn.toArray(pnorm, (i + k) * 3);
  }
  const nearBody = grid(posed, 0.03);

  // ---------- 身上的參考點 ----------
  const wp = (name) => holder.worldToLocal(bone(name).getWorldPosition(new THREE.Vector3()));
  const shL = wp('L_Upperarm'), shR = wp('R_Upperarm'), elL = wp('L_Forearm');
  const hip = wp('Hip'), neck = wp('NeckTwist01');
  const bodySW = (shL.x - shR.x) / 2, bodyShY = (shL.y + shR.y) / 2, bodyHipY = hip.y;
  const bodyArm = Math.atan2(shL.y - elL.y, Math.abs(elL.x - shL.x)); // 手臂往下幾度（弧度）

  // ---------- 衣服的參考點（自動量） ----------
  const all = allGeos.map((g) => g.attributes.position);
  const each = (fn) => { for (const p of all) for (let i = 0; i < p.count; i++) fn(p, i); };
  let top = -Infinity, bottom = Infinity; each((p, i) => { top = Math.max(top, p.getY(i)); bottom = Math.min(bottom, p.getY(i)); });
  const H = top - bottom;
  const clothShY = top - def.sh * H, clothSW = def.sw * H;
  // 袖子的角度：比肩膀更外面的點，平均往下幾度
  let su = 0, sv = 0, sn = 0;
  each((p, i) => { const u = Math.abs(p.getX(i)) - clothSW; if (u > 0.08 * H) { su += u; sv += clothShY - p.getY(i); sn++; } });
  const clothArm = sn ? Math.atan2(sv / sn, su / sn) : bodyArm;
  const clothHipY = top - def.hip * H;

  const sx = bodySW / clothSW, sy = (bodyShY - bodyHipY) / (clothShY - clothHipY);
  const drop = Math.max(0, bodyArm - clothArm);

  const meshes = [];
  const tex = await houseTexture(def.tex, spec.hue ?? null, spec.sat ?? 1, def.flipY, spec.light ?? 1, spec.colorize ?? null);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide, color: spec.tint || '#ffffff' });
  const clothPts = [], layers = (ctx.layers ||= []), newLayer = { pts: [], nor: [] };
  for (const g0 of geos) {
    const g = g0.clone(), p = g.attributes.position, cnt = p.count;
    // 1) 袖子放下：繞衣服的肩膀轉
    for (let i = 0; i < cnt; i++) {
      const x = p.getX(i), y = p.getY(i), side = Math.sign(x) || 1, uu = Math.abs(x) - clothSW, vv = y - clothShY;
      if (uu <= 0 || drop <= 0) continue;
      const deg = THREE.MathUtils.radToDeg(Math.atan2(-vv, uu)), armDeg = THREE.MathUtils.radToDeg(clothArm);
      const w = smooth(armDeg + 40, armDeg + 22, deg) * smooth(0, 0.03 * H, uu);
      if (w <= 0) continue;
      const an = drop * w, cs = Math.cos(an), sn2 = Math.sin(an);
      p.setX(i, side * (clothSW + uu * cs + vv * sn2)); p.setY(i, clothShY - uu * sn2 + vv * cs);
    }
    // 外面還要穿大衣時，裡面這件的袖子剪掉（大衣的長袖會蓋住手臂，留著反而會從大衣穿出來）
    if (spec.noSleeves && g.index) {
      const idx = g.index, keep = [], cut = (k) => Math.abs(p.getX(k)) > clothSW + 0.015 * H && p.getY(k) > clothShY - 0.25 * H;
      for (let i = 0; i < idx.count; i += 3) { const x = idx.getX(i), y = idx.getX(i + 1), z = idx.getX(i + 2); if (!(cut(x) || cut(y) || cut(z))) keep.push(x, y, z); }
      g.setIndex(keep);
    }
    // 2) 縮放、對齊到身上（衣服的肩膀＝角色的肩膀）
    const cz = (spec.zOffset ?? 0);
    for (let i = 0; i < cnt; i++) p.setXYZ(i, p.getX(i) * sx, bodyShY + (p.getY(i) - clothShY) * sy, p.getZ(i) * sx + cz);
    // 3) 陷進身體的地方往外推；4) 抄最近那個身體點的骨架設定
    const puff = spec.puff ?? 0.006;
    const si = new Uint16Array(cnt * 4), sw = new Float32Array(cnt * 4);
    const bi = body.geometry.attributes.skinIndex, bw = body.geometry.attributes.skinWeight;
    for (let i = 0; i < cnt; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      for (const L of layers) { // 先推到裡面那層衣服外面
        const [lq] = L.near(v.x, v.y, v.z, 2); if (lq < 0) continue;
        a.fromArray(L.pts, lq * 3); b.fromArray(L.nor, lq * 3);
        const o2 = v.clone().sub(a).dot(b); if (o2 < puff) v.addScaledVector(b, puff - o2);
      }
      const [q] = nearBody(v.x, v.y, v.z, 6);
      if (q < 0) continue;
      a.fromArray(posed, q * 3); b.fromArray(pnorm, q * 3);
      const out = v.clone().sub(a).dot(b);
      if (out < puff) v.addScaledVector(b, puff - out);
      p.setXYZ(i, v.x, v.y, v.z);
      for (let k = 0; k < 4; k++) { si[i * 4 + k] = bi.getComponent(q, k); sw[i * 4 + k] = bw.getComponent(q, k); }
      clothPts.push(v.x, v.y, v.z);
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.computeVertexNormals();
    newLayer.pts.push(...p.array); newLayer.nor.push(...g.attributes.normal.array);
    const m = new THREE.SkinnedMesh(g, mat); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    holder.add(m); m.updateMatrixWorld(true);
    // 用「現在的姿勢」當衣服的綁定姿勢：之後骨頭怎麼動，衣服就跟著動
    m.bind(new THREE.Skeleton(body.skeleton.bones), m.matrixWorld);
    meshes.push(m);
  }

  // 裡面那幾層衣服被這一層蓋住的三角形藏起來（大衣前面敞開，前面的襯衫、領結還看得到）
  const nearNew = grid(new Float32Array(newLayer.pts), 0.03);
  for (const prev of (ctx.meshes ||= [])) {
    const g = prev.geometry, p = g.attributes.position, nr = g.attributes.normal, idx = g.index; if (!idx) continue;
    const hid = new Uint8Array(p.count), np = newLayer.pts;
    for (let i = 0; i < p.count; i++) {
      const [q, d] = nearNew(p.getX(i), p.getY(i), p.getZ(i), 2);
      if (q < 0 || d > (spec.hideInner ?? 0.05)) continue;
      // 外層要在「外面」才藏：外層的點在這個點的外側（沿著法線方向）
      const out = (np[q * 3] - p.getX(i)) * nr.getX(i) + (np[q * 3 + 1] - p.getY(i)) * nr.getY(i) + (np[q * 3 + 2] - p.getZ(i)) * nr.getZ(i);
      hid[i] = out > 0.2 * d ? 1 : 0;
    }
    const keep = []; for (let i = 0; i < idx.count; i += 3) { const x = idx.getX(i), y = idx.getX(i + 1), z = idx.getX(i + 2); if (!(hid[x] && hid[y] && hid[z])) keep.push(x, y, z); }
    g.setIndex(keep);
  }
  ctx.meshes.push(...meshes);
  newLayer.pts = new Float32Array(newLayer.pts); newLayer.nor = new Float32Array(newLayer.nor); newLayer.near = grid(newLayer.pts, 0.03); layers.push(newLayer);

  // 5) 被衣服蓋住的皮膚藏起來：三個頂點都在衣服底下（離衣服 4 公分內）的三角形縮成一點
  const nearCloth = grid(new Float32Array(clothPts), 0.03);
  const covered = new Uint8Array(n), headY = neck.y - 0.02;
  for (let i = 0; i < n; i++) {
    const y = posed[i * 3 + 1]; if (y > headY) continue;
    const [, d] = nearCloth(posed[i * 3], y, posed[i * 3 + 2], 2);
    covered[i] = d < (spec.hideDist ?? 0.035) ? 1 : 0;
  }
  for (let i = 0; i < n; i += 3) if (covered[i] && covered[i + 1] && covered[i + 2]) { bp.setXYZ(i + 1, bp.getX(i), bp.getY(i), bp.getZ(i)); bp.setXYZ(i + 2, bp.getX(i), bp.getY(i), bp.getZ(i)); }
  bp.needsUpdate = true;
  return meshes;
}
