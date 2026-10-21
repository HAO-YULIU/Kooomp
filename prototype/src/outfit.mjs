// 衣服：把製作人提供的衣服模型穿到 Character Creator 角色身上。
// 衣服本身沒有骨架，做法是：
// 1. 依角色的肩膀位置、肩寬、肩膀到屁股的高度，把衣服縮放、對齊到身上
// 2. 袖子轉到跟角色的手臂一樣的角度（衣服原本是 A 字或 T 字站姿，角色的手是垂下的）
// 3. 衣服如果陷進身體裡，就往外推到皮膚外面一點點
// 4. 每個衣服的點，抄身體上最近那個點的「跟哪幾根骨頭動」，衣服就會跟著角色呼吸、轉身
// 5. 被衣服蓋住的皮膚藏起來，免得從衣服底下穿出來
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { buildRobe } from './robe.mjs';

const DIR = 'models/clothes/';
// 衣服清單：檔案、貼圖、要拿哪幾塊（依檔案裡的順序）
export const OUTFITS = {
// 尺寸都是「整個檔案高度」的幾成（從頂端＝領口往下量）：
// sw：肩關節離中線多遠；sh：肩關節在頂端往下多少；hip：穿的人的骨盆在頂端往下多少。看模型量的，自動量容易被袖子、立領騙
// flipY：貼圖要不要上下翻（glTF 來的不翻，FBX、OBJ 來的要翻）
  jk: { file: 'jk.glb', tex: 'jk_color.jpg', parts: null, sw: 0.155, sh: 0.07, hip: 0.56, flipY: false, credit: '"Jk School Uniform" by Style3D CG (CC-BY-4.0)' }, // 襯衫、領結、格子裙
  boy: { file: 'male.glb', tex: 'male_color.jpg', parts: null, sw: 0.08, sh: 0.07, hip: 0.37, flipY: true }, // 男生制服：襯衫、長褲（T 字站姿）
  coat: { file: 'coat.glb', tex: 'coat_color.jpg', parts: [0], sw: 0.13, sh: 0.07, hip: 0.4, flipY: true, maxLight: 1.35 }, // 長大衣（只拿外套）
// maxLight：染色時最亮幾倍。貼圖上有一大片白色是裡面那件襯衫的，外套的接縫會沾到，只穿外套時壓暗，免得變成白點
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
function houseTexture(file, hue, sat, flipY, light = 1, colorize = null, maxLight = 2.5) {
  const key = [file, hue, sat, flipY, light, colorize, maxLight].join();
  return (texCache[key] ||= new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      if (colorize) { // 整張染成一個顏色，保留原本的明暗（看得出皺褶）
        const d = g.getImageData(0, 0, c.width, c.height), p = d.data, C = new THREE.Color(colorize);
        const base = 255 * 0.13; // 大衣布料原本的亮度大約是 13%（同一張貼圖還有白襯衫，不能用平均）
        for (let i = 0; i < p.length; i += 4) { const k = Math.min(maxLight, (p[i] + p[i + 1] + p[i + 2]) / 3 / base); p[i] = Math.min(255, C.r * 255 * k); p[i + 1] = Math.min(255, C.g * 255 * k); p[i + 2] = Math.min(255, C.b * 255 * k); }
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
// 往外推的量在布上抹平：每個點的推移跟旁邊的點平均幾次（接縫上同位置的點當成同一個），
// 推得不一樣多的相鄰點不會被拉成鋸齒；平均時取「推比較多的那邊」為主，避免又陷回去
function smoothPush(g, orig, rounds = 4) {
  const p = g.attributes.position, cnt = p.count, idx = g.index;
  if (!idx) return;
  const weld = new Map(), id = new Int32Array(cnt);
  for (let i = 0; i < cnt; i++) {
    const k = `${Math.round(orig[i * 3] * 5000)},${Math.round(orig[i * 3 + 1] * 5000)},${Math.round(orig[i * 3 + 2] * 5000)}`;
    let w = weld.get(k); if (w === undefined) weld.set(k, (w = weld.size)); id[i] = w;
  }
  const m = weld.size, nb = Array.from({ length: m }, () => new Set());
  for (let t = 0; t < idx.count; t += 3) {
    const A = id[idx.getX(t)], B = id[idx.getX(t + 1)], C = id[idx.getX(t + 2)];
    nb[A].add(B).add(C); nb[B].add(A).add(C); nb[C].add(A).add(B);
  }
  let d = new Float32Array(m * 3), cntW = new Uint16Array(m);
  for (let i = 0; i < cnt; i++) { const w = id[i]; for (let k = 0; k < 3; k++) d[w * 3 + k] += p.array[i * 3 + k] - orig[i * 3 + k]; cntW[w]++; }
  for (let w = 0; w < m; w++) for (let k = 0; k < 3; k++) d[w * 3 + k] /= cntW[w] || 1;
  for (let r = 0; r < rounds; r++) {
    const nd = new Float32Array(m * 3);
    for (let w = 0; w < m; w++) {
      let sx = 0, sy = 0, sz = 0, sn = 0;
      for (const o of nb[w]) { sx += d[o * 3]; sy += d[o * 3 + 1]; sz += d[o * 3 + 2]; sn++; }
      if (!sn) { nd.set(d.subarray(w * 3, w * 3 + 3), w * 3); continue; }
      sx /= sn; sy /= sn; sz /= sn;
      const own = Math.hypot(d[w * 3], d[w * 3 + 1], d[w * 3 + 2]), avg = Math.hypot(sx, sy, sz);
      const t = avg > own ? 0.7 : 0.5; // 鄰居推得多就多跟一點
      nd[w * 3] = d[w * 3] * (1 - t) + sx * t; nd[w * 3 + 1] = d[w * 3 + 1] * (1 - t) + sy * t; nd[w * 3 + 2] = d[w * 3 + 2] * (1 - t) + sz * t;
    }
    d = nd;
  }
  for (let i = 0; i < cnt; i++) { const w = id[i]; p.setXYZ(i, orig[i * 3] + d[w * 3], orig[i * 3 + 1] + d[w * 3 + 1], orig[i * 3 + 2] + d[w * 3 + 2]); }
  p.needsUpdate = true;
}

const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * 把衣服穿上。ctx：{ holder, body（身體的 Mesh／SkinnedMesh）, bone(name)（有骨架時）或 landmarks（沒有骨架時：shL、shR、elL、hip、neck，holder 座標） }
 * 沒有骨架的身體（西里爾）：衣服直接固定，不綁骨架。
 * spec：{ name: 'jk' | 'boy' | 'coat' | 'coatFull', hue（學院色的色相，度）, sat、light（彩度、亮度倍率）, tint（整件衣服再乘一個顏色）, puff（離皮膚、裡面那層衣服多遠，公尺） }
 * colorize：整件染成一個顏色（保留明暗）；noSleeves：剪掉袖子（外面要穿大衣時用）；hideInner：外層蓋住內層多近就把內層藏起來。
 * 同一個角色穿好幾層時，ctx.meshes 會記住已經穿上的衣服：外層放在內層外緣再外面，內層在被蓋住的地方壓到外層底下。
 * 回傳穿好的 SkinnedMesh 陣列。
 */
export async function wearOutfit(ctx, spec) {
  if (window.__outfitOnly && spec.name !== window.__outfitOnly) return []; // 除錯用：只穿某一件
  const { holder, body, bone } = ctx, skinned = !!body.isSkinnedMesh;
  const isRobe = spec.name === 'robe'; // 程式做的巫師袍（robe.mjs），不用衣服模型
  const def = isRobe ? { sh: 0.07, sw: 0.15, hip: 0.5 } : OUTFITS[spec.name];
  const { geos, all: allGeos } = isRobe ? { geos: [], all: [] } : await loadSource(spec.name);
  holder.updateMatrixWorld(true);

  // ---------- 身體現在的姿勢（每個點、每個面的方向） ----------
  const bp = body.geometry.attributes.position, n = bp.count, posed = new Float32Array(n * 3), v = new THREE.Vector3();
  // 前一件衣服會把蓋住的皮膚縮掉；量身體要用還沒縮掉的原本形狀（不然下一件在那裡會缺一塊）
  const now = bp.array.slice(); if (ctx.bodyOrig) bp.array.set(ctx.bodyOrig); else ctx.bodyOrig = now.slice();
  for (let i = 0; i < n; i++) { body.getVertexPosition(i, v); v.applyMatrix4(body.matrixWorld); holder.worldToLocal(v); posed[i * 3] = v.x; posed[i * 3 + 1] = v.y; posed[i * 3 + 2] = v.z; }
  bp.array.set(now);
  const pnorm = new Float32Array(n * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  // 身體的三角形（有的模型頂點不共用、每三個一個三角形，有的有索引）；前一件衣服可能拿掉了一些，用原本的
  const g0idx = body.geometry.index; if (g0idx && !ctx.bodyIndex) ctx.bodyIndex = g0idx.array.slice();
  const TRI = ctx.bodyIndex ?? Uint32Array.from({ length: n }, (_, i) => i), nT = TRI.length;
  // 同一個位置的面方向加起來取平均，不然小三角形的方向亂指，衣服會被推成一根根尖刺
  const pkey = (i) => `${Math.round(posed[i * 3] * 2000)},${Math.round(posed[i * 3 + 1] * 2000)},${Math.round(posed[i * 3 + 2] * 2000)}`;
  const acc = new Map();
  for (let t = 0; t < nT; t += 3) {
    a.fromArray(posed, TRI[t] * 3); b.fromArray(posed, TRI[t + 1] * 3); c.fromArray(posed, TRI[t + 2] * 3);
    const nn = b.clone().sub(a).cross(c.clone().sub(a)); // 不正規化：大的面份量重
    for (let k = 0; k < 3; k++) { const key = pkey(TRI[t + k]); const s = acc.get(key); if (s) s.add(nn); else acc.set(key, nn.clone()); }
  }
  for (let i = 0; i < n; i++) { const s = acc.get(pkey(i)); (s && s.lengthSq() > 0 ? s.clone().normalize() : new THREE.Vector3(0, 0, 1)).toArray(pnorm, i * 3); }
  // 同一個位置的點併成一個「身體節點」，節點之間照三角形連起來
  const wid = new Int32Array(n), wmap = new Map();
  for (let i = 0; i < n; i++) { const k = pkey(i); let w = wmap.get(k); if (w === undefined) wmap.set(k, (w = wmap.size)); wid[i] = w; }
  const W = wmap.size, wnb = Array.from({ length: W }, () => []);
  for (let t = 0; t < nT; t += 3) for (let k = 0; k < 3; k++) { const A = wid[TRI[t + k]], B = wid[TRI[t + (k + 1) % 3]]; if (A !== B) { wnb[A].push(B); wnb[B].push(A); } }
  const nearBody = grid(posed, 0.03);

  // ---------- 身上的參考點 ----------
  const wp = (name) => holder.worldToLocal(bone(name).getWorldPosition(new THREE.Vector3()));
  const LM = ctx.landmarks;
  const shL = LM ? LM.shL : wp('L_Upperarm'), shR = LM ? LM.shR : wp('R_Upperarm'), elL = LM ? LM.elL : wp('L_Forearm');
  const hip = LM ? LM.hip : wp('Hip'), neck = LM ? LM.neck : wp('NeckTwist01');
  const bodySW = (shL.x - shR.x) / 2, bodyShY = (shL.y + shR.y) / 2, bodyHipY = hip.y;
  const bodyArm = Math.atan2(shL.y - elL.y, Math.abs(elL.x - shL.x)); // 手臂往下幾度（弧度）
  const cx = (shL.x + shR.x) / 2;
  // 手腕：有骨架用手的骨頭；沒有的話，手肘再往前一段（跟上臂一樣長）
  const mirror = (q) => new THREE.Vector3(2 * cx - q.x, q.y, q.z);
  const wristL = LM ? (LM.wrL ?? elL.clone().multiplyScalar(2).sub(shL)) : wp('L_Hand'), wristR = LM ? (LM.wrR ?? mirror(wristL)) : wp('R_Hand');
  const elR = LM ? mirror(elL) : wp('R_Forearm');

  // ---------- 身體每個點是哪個部位：0 軀幹、1 手臂、2 手、3 腿 ----------
  const vreg = new Uint8Array(n);
  if (skinned) {
    const reg = body.skeleton.bones.map((bn) => (/(Hand|Finger|Thumb|Index|Mid\d|Ring|Pinky)/i.test(bn.name) ? 2 : /(Upperarm|Forearm|Elbow)/i.test(bn.name) ? 1 : /(Thigh|Calf|Knee|Foot|Toe|Ankle)/i.test(bn.name) ? 3 : 0));
    const bi0 = body.geometry.attributes.skinIndex, bw0 = body.geometry.attributes.skinWeight;
    for (let i = 0; i < n; i++) { let best = 0, bk = 0; for (let k = 0; k < 4; k++) { const w = bw0.getComponent(i, k); if (w > best) { best = w; bk = bi0.getComponent(i, k); } } vreg[i] = reg[bk]; }
  } else { // 沒有骨架：看離手臂（肩膀→手肘→手腕）、手（手腕再往下 18 公分）的線多近
    const seg = (pt, A, B) => { const ab = B.clone().sub(A), t = THREE.MathUtils.clamp(pt.clone().sub(A).dot(ab) / ab.lengthSq(), 0, 1); return pt.distanceTo(A.clone().addScaledVector(ab, t)); };
    const arms = [[shL, elL, wristL], [shR, elR, wristR]];
    for (let i = 0; i < n; i++) {
      v.fromArray(posed, i * 3); const dx = Math.abs(v.x - cx);
      let r = 0;
      for (const [S, E, Wr] of arms) {
        const hand = Wr.clone().add(Wr.clone().sub(E).setLength(0.18));
        if (seg(v, Wr, hand) < 0.065 && dx > bodySW * 0.7) { r = 2; break; }
        if ((seg(v, S, E) < 0.07 || seg(v, E, Wr) < 0.06) && dx > bodySW * 0.78) { r = 1; break; }
      }
      if (!r && v.y < hip.y - 0.06) r = 3;
      vreg[i] = r;
    }
  }
  if (window.__outfitDebug && !skinned) { const c = [0, 0, 0, 0]; for (const r of vreg) c[r]++; console.error('部位 ' + JSON.stringify({ c, shL, elL, wristL, hip, neck, bodySW })); }
  // 只有軀幹和腿（不含手臂、手）：女生的手垂在屁股旁邊，衣服的身體部分如果找到手上的點，會被往旁邊推得亂七八糟。袖子才用 nearBody。
  const tp = posed.slice(); for (let i = 0; i < n; i++) if (vreg[i] === 1 || vreg[i] === 2) tp[i * 3] = tp[i * 3 + 1] = tp[i * 3 + 2] = 1e6;
  const nearTorso = grid(tp, 0.03);

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
  const tex = isRobe ? null : await houseTexture(def.tex, spec.hue ?? null, spec.sat ?? 1, def.flipY, spec.light ?? 1, spec.colorize ?? null, def.maxLight ?? 2.5);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide, color: spec.tint || '#ffffff' });
  if (window.__outfitTint?.[spec.name]) { mat.map = null; mat.color.set(window.__outfitTint[spec.name]); }
  const clothPts = [], inner = (ctx.meshes ||= []);
  // 衣服的點掛在哪個身體點上（袖子掛手臂，其他只掛軀幹和腿）
  const attach = (x, y, z, isSleeve) => {
    let [q] = (isSleeve ? nearBody : nearTorso)(x, y, z, 6);
    if (q < 0) [q] = nearBody(x, y, z, 15); // 離身體很遠的（大衣下擺、裙襬）：放寬範圍
    return q;
  };
  const height = (x, y, z, q) => (x - posed[q * 3]) * pnorm[q * 3] + (y - posed[q * 3 + 1]) * pnorm[q * 3 + 1] + (z - posed[q * 3 + 2]) * pnorm[q * 3 + 2];
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
    const sleeve = new Uint8Array(cnt); for (let i = 0; i < cnt; i++) sleeve[i] = Math.abs(p.getX(i)) - clothSW > 0.02 * H ? 1 : 0; // 袖子的點
    g.userData.sleeve = sleeve;
    // 外面還要穿大衣時，裡面這件的袖子剪掉（大衣的長袖會蓋住手臂，留著反而會從大衣穿出來）
    if (spec.noSleeves && g.index) {
      const idx = g.index, keep = [], cut = (k) => Math.abs(p.getX(k)) > clothSW - 0.005 * H && p.getY(k) > clothShY - 0.25 * H; // 剪在肩膀線內側一點，免得留下往旁邊翹的短袖頭
      for (let i = 0; i < idx.count; i += 3) { const x = idx.getX(i), y = idx.getX(i + 1), z = idx.getX(i + 2); if (!(cut(x) || cut(y) || cut(z))) keep.push(x, y, z); }
      g.setIndex(keep);
    }
    // 2) 縮放、對齊到身上（衣服的肩膀＝角色的肩膀）
    const cz = (spec.zOffset ?? 0);
    for (let i = 0; i < cnt; i++) p.setXYZ(i, p.getX(i) * sx, bodyShY + (p.getY(i) - clothShY) * sy, p.getZ(i) * sx + cz);
    // 3) 往外推：離皮膚至少 puff，也要在裡面那層的外緣再外面 puff（都沿著身體往外的方向量；衣服自己的法線有些是反的，不能用）
    // 4) 抄掛著的那個身體點的骨架設定
    const puff = spec.puff ?? 0.006;
    const si = new Uint16Array(cnt * 4), sw = new Float32Array(cnt * 4), orig = p.array.slice();
    const bi = body.geometry.attributes.skinIndex, bw = body.geometry.attributes.skinWeight; // 沒有骨架時是 undefined
    // 只推離皮膚：外層照自己的形狀穿在身上，不被裡面那層撐開（撐開會皺、會鼓起來）；
    // 裡面那層跟外層的距離，由下面「壓進去」讓裡面那層讓位
    const Q = new Int32Array(cnt).fill(-1);
    const lift = (i, want) => {
      const q = Q[i]; if (q < 0) return; const h = height(p.getX(i), p.getY(i), p.getZ(i), q); if (h >= want) return;
      p.setXYZ(i, p.getX(i) + pnorm[q * 3] * (want - h), p.getY(i) + pnorm[q * 3 + 1] * (want - h), p.getZ(i) + pnorm[q * 3 + 2] * (want - h));
    };
    for (let i = 0; i < cnt; i++) {
      const q = attach(p.getX(i), p.getY(i), p.getZ(i), sleeve[i]); if (q < 0) continue;
      Q[i] = q; lift(i, puff);
      if (skinned) for (let k = 0; k < 4; k++) { si[i * 4 + k] = bi.getComponent(q, k); sw[i * 4 + k] = bw.getComponent(q, k); }
    }
    smoothPush(g, orig);
    for (let i = 0; i < cnt; i++) lift(i, puff * 0.8); // 抹平時被平均掉的地方，再確實推一次
    for (let i = 0; i < cnt; i++) clothPts.push(p.getX(i), p.getY(i), p.getZ(i));
    g.userData.Q = Q;
    if (skinned) { g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); }
    g.computeVertexNormals();
    const m = skinned ? new THREE.SkinnedMesh(g, mat) : new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    holder.add(m); m.updateMatrixWorld(true);
    // 用「現在的姿勢」當衣服的綁定姿勢：之後骨頭怎麼動，衣服就跟著動
    if (skinned) m.bind(new THREE.Skeleton(body.skeleton.bones), m.matrixWorld);
    meshes.push(m);
  }

  if (isRobe) {
    const wreg = new Uint8Array(W); for (let i = 0; i < n; i++) wreg[wid[i]] = vreg[i];
    // 裡面那幾層在每個身體節點上有多高（取最高的、往旁邊擴一圈），袍子要蓋在它外面
    const innerH = new Float32Array(W).fill(-Infinity);
    for (const m of inner) {
      const p = m.geometry.attributes.position, sl = m.geometry.userData.sleeve;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), q = attach(x, y, z, sl?.[i]); if (q >= 0) { const w = wid[q]; innerH[w] = Math.max(innerH[w], height(x, y, z, q)); } }
    }
    { const G = innerH.slice(); for (let w = 0; w < W; w++) for (const o of wnb[w]) if (innerH[o] > G[w]) G[w] = innerH[o]; innerH.set(G); }
    const { geometry: g, material } = buildRobe({ posed, pnorm, wid, W, wnb, n, TRI, region: wreg, skinned, bones: skinned ? body.skeleton.bones : [],
      bw: body.geometry.attributes.skinWeight, bi: body.geometry.attributes.skinIndex, cx, neckY: neck.y, hipY: hip.y, hands: [wristL, wristR], arms: [[shL, elL, wristL], [shR, elR, wristR]], innerH }, spec);
    if (window.__outfitTint?.robe) { material.vertexColors = false; material.color.set(window.__outfitTint.robe); }
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) clothPts.push(p.getX(i), p.getY(i), p.getZ(i));
    const m = skinned ? new THREE.SkinnedMesh(g, material) : new THREE.Mesh(g, material); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    holder.add(m); m.updateMatrixWorld(true);
    if (skinned) m.bind(new THREE.Skeleton(body.skeleton.bones), m.matrixWorld);
    meshes.push(m);
  }

  // 裡面那幾層：從每個點沿著身體往外的方向看出去，有碰到這一層（外層）的話，就壓到外層底下 gap。
  // 外層前面敞開的地方看不到外層，襯衫、領結不動。不刪三角形，所以不會有破洞。
  if (inner.length) {
    const op = []; for (const m of meshes) op.push(...m.geometry.attributes.position.array);
    const nearOut = grid(new Float32Array(op), 0.025), gap = spec.gap ?? 0.012;
    // 沿著方向 n 從 x 出發，-6 到 +30 公分之間，第一個離外層 1.5 公分內的位置（找不到回傳 null）
    const hit = (x, y, z, nx, ny, nz, tol = 0.015) => {
      for (let t = -0.06; t <= 0.3; t += 0.008) { const [, d] = nearOut(x + nx * t, y + ny * t, z + nz * t, 1); if (d < tol) return t; }
      return null;
    };
    for (const m of inner) {
      const g = m.geometry, p = g.attributes.position, sl = g.userData.sleeve, orig = p.array.slice(), cnt = p.count;
      const Qi = new Int32Array(cnt).fill(-1); for (let i = 0; i < cnt; i++) Qi[i] = attach(p.getX(i), p.getY(i), p.getZ(i), sl?.[i]);
      const T = new Float32Array(cnt).fill(NaN), T2 = new Float32Array(cnt).fill(NaN); // 外層在這個點外面多遠（NaN：沒蓋住）；T2 用比較嚴格的標準（藏三角形用）
      for (let i = 0; i < cnt; i++) { const q = Qi[i]; if (q < 0) continue; const t = hit(p.getX(i), p.getY(i), p.getZ(i), pnorm[q * 3], pnorm[q * 3 + 1], pnorm[q * 3 + 2]); if (t !== null) { T[i] = t; const t2 = hit(p.getX(i), p.getY(i), p.getZ(i), pnorm[q * 3], pnorm[q * 3 + 1], pnorm[q * 3 + 2], 0.008); if (t2 !== null) T2[i] = t2; } }
      const press = (want) => {
        for (let i = 0; i < cnt; i++) {
          const q = Qi[i]; if (q < 0 || Number.isNaN(T[i])) continue;
          const moved = height(p.getX(i), p.getY(i), p.getZ(i), q) - height(orig[i * 3], orig[i * 3 + 1], orig[i * 3 + 2], q); // 已經壓了多少（負的）
          const d = Math.min(want - (T[i] - moved) > 0 ? want - (T[i] - moved) : 0, height(p.getX(i), p.getY(i), p.getZ(i), q) - 0.002); if (d <= 0) continue;
          p.setXYZ(i, p.getX(i) - pnorm[q * 3] * d, p.getY(i) - pnorm[q * 3 + 1] * d, p.getZ(i) - pnorm[q * 3 + 2] * d);
        }
      };
      press(gap); smoothPush(g, orig, 3); press(gap * 0.7); // 抹平後再確實壓一次
      // 確定被外層蓋住的三角形（三個點往外看都碰得到外層）不用畫：粗的衣服模型三角形很大，壓進去了中間還是可能凸出來
      if (g.index && spec.hideCovered !== false) {
        const ix = g.index.array, keep = [], cov = (k) => !Number.isNaN(T2[k]) && T2[k] > -0.01;
        for (let t = 0; t < ix.length; t += 3) if (!(cov(ix[t]) && cov(ix[t + 1]) && cov(ix[t + 2]))) keep.push(ix[t], ix[t + 1], ix[t + 2]);
        g.setIndex(keep);
      }
      p.needsUpdate = true; g.computeVertexNormals();
      if (window.__outfitDebug) { let c = 0; for (const t of T) if (!Number.isNaN(t)) c++; console.error('壓進去 ' + spec.name + ' 被蓋住 ' + c + '/' + cnt); }
    }
  }
  inner.push(...meshes);

  // 5) 被衣服蓋住的皮膚藏起來：三個頂點都在衣服底下（離衣服 4 公分內）的三角形縮成一點
  const nearCloth = grid(new Float32Array(clothPts), 0.03);
  const covered = new Uint8Array(n), headY = neck.y - 0.02;
  for (let i = 0; i < n; i++) {
    const y = posed[i * 3 + 1]; if (y > headY || vreg[i] === 2) continue; // 頭、手不藏
    const [, d] = nearCloth(posed[i * 3], y, posed[i * 3 + 2], 2);
    covered[i] = d < (spec.hideDist ?? 0.035) ? 1 : 0;
  }
  if (g0idx) { // 有索引：把三個點都蓋住的三角形拿掉（接著前一件衣服拿掉的）
    const cur = body.geometry.index.array, keep = [];
    for (let t = 0; t < cur.length; t += 3) if (!(covered[cur[t]] && covered[cur[t + 1]] && covered[cur[t + 2]])) keep.push(cur[t], cur[t + 1], cur[t + 2]);
    body.geometry.setIndex(keep);
  } else for (let i = 0; i < n; i += 3) if (covered[i] && covered[i + 1] && covered[i + 2]) { bp.setXYZ(i + 1, bp.getX(i), bp.getY(i), bp.getZ(i)); bp.setXYZ(i + 2, bp.getX(i), bp.getY(i), bp.getZ(i)); }
  bp.needsUpdate = true;
  return meshes;
}
