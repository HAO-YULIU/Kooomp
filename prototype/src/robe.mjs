// 程式做的巫師袍（帳號二）：直接用角色自己的身體形狀做，所以一定合身、不會穿模。
// 上半身：把身體表面（軀幹＋手臂，不含頭、手、腿）往外推、抹平，前面開一個 V 領／開襟。
// 下半身：從腰往下一圈一圈量身體（含兩條腿）的輪廓，再往外放、越往下越寬，前面開衩。
// 再加立領、腰帶、袖口、下擺、開襟的滾邊（學院的配色）。
// 由 outfit.mjs 的 wearOutfit({ name: 'robe', ... }) 呼叫；B 是 wearOutfit 算好的身體資料。
import * as THREE from 'three';

const sm = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// 布紋：細的斜紋＋一點雜訊，做成法線貼圖（可以重複鋪）
let fabricTex = null;
function fabricNormal() {
  if (fabricTex) return fabricTex;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), d = g.createImageData(S, S), hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const twill = Math.sin(((x + y) / S) * Math.PI * 2 * 48) * 0.5 + Math.sin((x / S) * Math.PI * 2 * 96) * 0.15;
    hgt[y * S + x] = twill + (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * 0.3;
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const h = (xx, yy) => hgt[((yy + S) % S) * S + ((xx + S) % S)];
    const dx = (h(x + 1, y) - h(x - 1, y)) * 0.6, dy = (h(x, y + 1) - h(x, y - 1)) * 0.6, l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    d.data[i] = (-dx / l * 0.5 + 0.5) * 255; d.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; d.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  fabricTex = new THREE.CanvasTexture(c); fabricTex.wrapS = fabricTex.wrapT = THREE.RepeatWrapping; fabricTex.anisotropy = 4;
  return fabricTex;
}

/**
 * spec（都可以不給）：
 *   color、trim：袍子、滾邊的顏色
 *   hem：下擺在多高（屁股高度的幾成：0.12 到腳踝、0.35 小腿、0.55 膝蓋、0.8 大腿）
 *   flare：下擺每往下 1 公尺多放寬幾公尺；sleeveFlare：袖口喇叭多大（公尺，0＝窄袖）
 *   openTop、openWaist：開襟在領口、腰的半寬（公尺，0＝不開）；openHem：下擺開衩的半角（弧度）
 *   collar：要不要立領；belt：要不要腰帶；off：離皮膚多遠
 */
export function buildRobe(B, spec = {}) {
  const { posed, pnorm, wid, W, wnb, TRI, region, bones, bw, bi, skinned, cx, neckY, hipY, hands } = B; // region：每個身體節點是 0 軀幹、1 手臂、2 手、3 腿
  const color = new THREE.Color(spec.color ?? '#2a2a33'), trim = new THREE.Color(spec.trim ?? '#b8902e');
  const off = spec.off ?? 0.016, hemY = hipY * (spec.hem ?? 0.12), flare = spec.flare ?? 0.12, sleeveFlare = spec.sleeveFlare ?? 0;
  const openTop = spec.openTop ?? 0.07, openWaist = spec.openWaist ?? 0.035, openHem = spec.openHem ?? 0.35;

  // ---------- 身體節點：位置、方向、主要跟哪根骨頭 ----------
  const rep = new Int32Array(W).fill(-1); for (let i = 0; i < wid.length; i++) if (rep[wid[i]] < 0) rep[wid[i]] = i;
  const PX = (w) => posed[rep[w] * 3], PY = (w) => posed[rep[w] * 3 + 1], PZ = (w) => posed[rep[w] * 3 + 2];
  const boneIdx = (re) => bones.findIndex((b) => re.test(b.name));
  const hipBone = skinned ? Math.max(0, boneIdx(/(_Hip|Pelvis)$/)) : 0, chestBone = skinned ? Math.max(0, boneIdx(/Spine02$/)) : 0;
  // 軀幹的前後中心（胸口高度）
  let czs = 0, czn = 0; for (let w = 0; w < W; w++) { const y = PY(w); if (Math.abs(y - (neckY - 0.15)) < 0.02 && region[w] === 0) { czs += PZ(w); czn++; } }
  const cz = czn ? czs / czn : 0;
  const handDist = (w) => Math.min(...hands.map((h) => Math.hypot(PX(w) - h.x, PY(w) - h.y, PZ(w) - h.z)));

  const pos = [], col = [], uv = [], skI = [], skW = [], idx = [];
  const vert = (x, y, z, c, wts) => { pos.push(x, y, z); col.push(c.r, c.g, c.b); uv.push((x + z) * 5, y * 5); skI.push(...wts[0]); skW.push(...wts[1]); return pos.length / 3 - 1; };
  const rigid = (b) => [[b, 0, 0, 0], [1, 0, 0, 0]];
  const nodeW = (w) => (skinned ? [[0, 1, 2, 3].map((k) => bi.getComponent(rep[w], k)), [0, 1, 2, 3].map((k) => bw.getComponent(rep[w], k))] : rigid(0));

  // ---------- 上半身 ----------
  const shellTop = neckY - 0.02, shellBot = hipY - 0.05;
  const openW = (y) => THREE.MathUtils.lerp(openWaist, openTop, sm(hipY, shellTop, y));
  const isArm = (w) => region[w] === 1;
  const keep = new Uint8Array(W), front = (w) => pnorm[rep[w] * 3 + 2] > 0.2; // 面朝前方的（用方向判斷，胸部、鎖骨的前後位置每個人不同）
  for (let w = 0; w < W; w++) {
    const y = PY(w);
    if (y > shellTop || y < shellBot || region[w] >= 2) continue;
    if (!isArm(w) && front(w) && Math.abs(PX(w) - cx) < openW(y)) continue; // 開襟
    keep[w] = 1;
  }
  // 往外推、抹平（去掉鎖骨、肋骨這些細節），再確定每個點都在皮膚外面
  const S = new Float32Array(W * 3);
  for (let w = 0; w < W; w++) if (keep[w]) { const r = rep[w] * 3; for (let k = 0; k < 3; k++) S[w * 3 + k] = posed[r + k] + pnorm[r + k] * off; }
  const outside = (w, want) => { const r = rep[w] * 3; const h = (S[w * 3] - posed[r]) * pnorm[r] + (S[w * 3 + 1] - posed[r + 1]) * pnorm[r + 1] + (S[w * 3 + 2] - posed[r + 2]) * pnorm[r + 2]; if (h < want) for (let k = 0; k < 3; k++) S[w * 3 + k] += pnorm[r + k] * (want - h); };
  for (let it = 0; it < 6; it++) {
    const T = S.slice();
    for (let w = 0; w < W; w++) { if (!keep[w]) continue; let c = 0; const s = [0, 0, 0]; for (const o of wnb[w]) if (keep[o]) { for (let k = 0; k < 3; k++) s[k] += S[o * 3 + k]; c++; } if (c) for (let k = 0; k < 3; k++) T[w * 3 + k] = S[w * 3 + k] * 0.4 + (s[k] / c) * 0.6; }
    S.set(T); for (let w = 0; w < W; w++) if (keep[w]) outside(w, off * (it < 5 ? 0.9 : 1));
  }
  // 喇叭袖：手腕附近往外放
  if (sleeveFlare > 0) for (let w = 0; w < W; w++) if (keep[w] && isArm(w)) { const f = sleeveFlare * sm(0.22, 0.02, handDist(w)), r = rep[w] * 3; for (let k = 0; k < 3; k++) S[w * 3 + k] += pnorm[r + k] * f; }
  // 開襟的邊拉直（身體的三角形邊緣是鋸齒狀的）；領口的邊拉平
  const edge = new Uint8Array(W);
  for (let w = 0; w < W; w++) if (keep[w]) for (const o of wnb[w]) if (!keep[o]) edge[w] = 1;
  for (let w = 0; w < W; w++) {
    if (!edge[w]) continue; const y = PY(w);
    if (!isArm(w) && front(w) && y > shellBot + 0.01 && Math.abs(PX(w) - cx) < openW(y) + 0.06) S[w * 3] = cx + Math.sign(PX(w) - cx) * openW(y);
    if (y > shellTop - 0.025 && !isArm(w)) S[w * 3 + 1] = shellTop;
  }
  // 滾邊：離邊緣（開襟、袖口）1.6 公分內；沿著身體表面往內量
  const toEdge = new Float32Array(W).fill(Infinity), queue = [];
  for (let w = 0; w < W; w++) if (edge[w] && PY(w) > shellBot + 0.03 && (isArm(w) ? handDist(w) < 0.12 : PY(w) < shellTop - 0.03)) { toEdge[w] = 0; queue.push(w); }
  while (queue.length) {
    const w = queue.shift();
    for (const o of wnb[w]) { if (!keep[o]) continue; const d = toEdge[w] + Math.hypot(S[w * 3] - S[o * 3], S[w * 3 + 1] - S[o * 3 + 1], S[w * 3 + 2] - S[o * 3 + 2]); if (d < toEdge[o] && d < 0.03) { toEdge[o] = d; queue.push(o); } }
  }
  const shellCol = (w) => (toEdge[w] < (spec.trimWidth ?? 0.016) ? trim : color);
  const vid = new Int32Array(W).fill(-1);
  const sv = (w) => (vid[w] >= 0 ? vid[w] : (vid[w] = vert(S[w * 3], S[w * 3 + 1], S[w * 3 + 2], shellCol(w), nodeW(w))));
  const seen = new Set();
  for (let t = 0; t < TRI.length; t += 3) {
    const A = wid[TRI[t]], Bn = wid[TRI[t + 1]], C = wid[TRI[t + 2]];
    if (A === Bn || Bn === C || A === C || !keep[A] || !keep[Bn] || !keep[C]) continue;
    const key = [A, Bn, C].sort((p, q) => p - q).join(); if (seen.has(key)) continue; seen.add(key);
    idx.push(sv(A), sv(Bn), sv(C));
  }

  // ---------- 一圈一圈的輪廓（腰以下的袍子、立領共用） ----------
  const K = 48;
  const profile = (y0, y1, filter) => { // y0～y1 之間的身體節點，每個角度最遠多遠（角度 0＝正前方）
    const r = new Float32Array(K).fill(-1);
    for (let w = 0; w < W; w++) {
      const y = PY(w); if (y < y0 || y > y1 || !filter(w)) continue;
      const dx = PX(w) - cx, dz = PZ(w) - cz, a = Math.atan2(dx, dz), k = ((Math.round((a / (Math.PI * 2)) * K) % K) + K) % K, d = Math.hypot(dx, dz);
      if (d > r[k]) r[k] = d;
    }
    // 空的角度用旁邊補，再稍微抹平（取大的）
    for (let pass = 0; pass < K; pass++) { let any = false; for (let k = 0; k < K; k++) if (r[k] < 0) { const a = r[(k + K - 1) % K], b = r[(k + 1) % K]; if (a >= 0 || b >= 0) { r[k] = Math.max(a, b); any = true; } } if (!any) break; }
    for (let pass = 0; pass < 2; pass++) { const t = r.slice(); for (let k = 0; k < K; k++) t[k] = Math.max(r[k], (r[(k + K - 1) % K] + r[k] * 2 + r[(k + 1) % K]) / 4); r.set(t); }
    return r;
  };
  const at = (r, a) => { const f = (((a / (Math.PI * 2)) * K) % K + K) % K, k0 = Math.floor(f), t = f - k0; return r[k0] * (1 - t) + r[(k0 + 1) % K] * t; };
  // 一圈圈接成布：rings＝[{ y, r（輪廓）, half（前面開口的半角）, c（顏色） }]
  const tube = (rings, weights, segs = 40) => {
    let prev = null;
    for (const ring of rings) {
      const row = [];
      for (let j = 0; j <= segs; j++) {
        const a = ring.half + (Math.PI * 2 - ring.half * 2) * (j / segs), rr = at(ring.r, a);
        const arc = Math.min(a - ring.half, Math.PI * 2 - ring.half - a) * rr; // 離開口邊多遠（公尺）
        const c = (ring.half > 0.01 && arc < (spec.trimWidth ?? 0.016) * 1.3) ? trim : ring.c;
        row.push(vert(cx + Math.sin(a) * rr, ring.y, cz + Math.cos(a) * rr, c, weights));
      }
      if (prev) for (let j = 0; j < segs; j++) idx.push(prev[j], row[j], prev[j + 1], prev[j + 1], row[j], row[j + 1]);
      prev = row;
    }
  };

  // ---------- 腰以下 ----------
  const notArm = (w) => region[w] === 0 || region[w] === 3;
  const topY = hipY + 0.06, step = 0.02, rings = [];
  let last = null, i = 0;
  for (let y = topY; y >= hemY - 1e-6; y -= step, i++) {
    const body = profile(y - 0.02, y + 0.02, notArm);
    const r = new Float32Array(K);
    for (let k = 0; k < K; k++) {
      let v = body[k] > 0 ? body[k] + off + 0.008 : (last ? last[k] : 0.15);
      if (last) v = Math.max(v, last[k] + flare * step); // 往下只會變寬
      r[k] = v;
    }
    const belt = spec.belt !== false && i < 2, hem = y - step < hemY;
    const frontR = r[0] || 0.15, half = Math.max(Math.atan2(openWaist, frontR), openHem * sm(topY, hemY, y));
    rings.push({ y, r, half, c: belt || hem ? trim : color });
    last = r;
  }
  tube(rings, rigid(hipBone));

  // ---------- 立領 ----------
  if (spec.collar !== false) {
    const neckR = profile(neckY - 0.04, neckY + 0.01, (w) => region[w] === 0);
    const r = neckR.map((v) => v + 0.014), half = Math.atan2(openTop * 0.8, r[0] || 0.06);
    tube([{ y: shellTop - 0.012, r, half, c: color }, { y: shellTop + 0.012, r: r.map((v) => v + 0.003), half, c: color }, { y: shellTop + 0.026, r: r.map((v) => v + 0.008), half, c: trim }], rigid(chestBone), 32);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (skinned) { g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skI, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skW, 4)); }
  g.setIndex(idx); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ name: 'robe', vertexColors: true, roughness: 0.88, side: THREE.DoubleSide, normalMap: fabricNormal(), normalScale: new THREE.Vector2(0.35, 0.35) });
  return { geometry: g, material: mat };
}
