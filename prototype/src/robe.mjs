// 程式做的巫師袍（帳號二）：直接用角色自己的身體形狀做，所以一定合身、不會穿模。
// 上半身：把身體表面（軀幹＋手臂，不含頭、手、腿）往外推、抹平，前面開一個 V 領／開襟。
// 下半身：從腰往下一圈一圈量身體（含兩條腿）的輪廓，再往外放、越往下越寬，前面開衩。
// 再加立領、腰帶、袖口、下擺、開襟的滾邊（學院的配色）。
// 由 outfit.mjs 的 wearOutfit({ name: 'robe', ... }) 呼叫；B 是 wearOutfit 算好的身體資料。
import * as THREE from 'three';

const sm = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// 布紋：細的斜紋＋一點雜訊，做成顏色貼圖（灰階，乘上袍子的顏色）。
// 不用法線貼圖：貼圖座標是照位置算的，胸部這種彎曲的地方算出來的方向會亂掉，看起來像凸起
let fabricTex = null;
function fabricColor() {
  if (fabricTex) return fabricTex;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), d = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const twill = Math.sin(((x + y) / S) * Math.PI * 2 * 48) * 0.5 + Math.sin((x / S) * Math.PI * 2 * 96) * 0.15;
    const noise = (Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) - 0.5;
    const v = Math.round(255 * (0.9 + twill * 0.05 + noise * 0.05)), i = (y * S + x) * 4;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  fabricTex = new THREE.CanvasTexture(c); fabricTex.wrapS = fabricTex.wrapT = THREE.RepeatWrapping; fabricTex.anisotropy = 4; fabricTex.colorSpace = THREE.SRGBColorSpace;
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
  const { posed, pnorm, wid, W, wnb, TRI, region, bones, bw, bi, skinned, cx, neckY, hipY, hands } = B; // B.arms：沒有骨架時兩隻手的 [肩膀, 手肘, 手腕] // region：每個身體節點是 0 軀幹、1 手臂、2 手、3 腿
  const color = new THREE.Color(spec.color ?? '#2a2a33'), trim = new THREE.Color(spec.trim ?? '#b8902e');
  const off = window.__robeOff ?? spec.off ?? (B.skinned ? 0.016 : 0.024), hemY = hipY * (spec.hem ?? 0.12), flare = spec.flare ?? 0.12, sleeveFlare = spec.sleeveFlare ?? 0;
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
  const shellTop = neckY - 0.02, shellBot = hipY - 0.09; // 上半身做到屁股（最寬的地方），下半身從那裡開始，腰上才不會有一圈台階
  const openW = (y) => THREE.MathUtils.lerp(openWaist, openTop, sm(hipY, shellTop, y));
  const isArm = (w) => region[w] === 1;
  // 有骨架（Character Creator）：直接用身體表面做，最合身。沒有骨架的模型表面常常很亂（衣服和身體疊在一起），改用下面一圈一圈量的做法
  if (skinned) {
    const front = (w) => pnorm[rep[w] * 3 + 2] > 0.2; // 面朝前方的（用方向判斷，胸部、鎖骨的前後位置每個人不同）
    // 領口：脖子周圍挖一個圓洞（肩膀不切平）
    let nx = 0, nz = 0, nn = 0; for (let w = 0; w < W; w++) if (region[w] === 0 && Math.abs(PY(w) - neckY) < 0.012) { nx += PX(w); nz += PZ(w); nn++; }
    nx = nn ? nx / nn : cx; nz = nn ? nz / nn : cz;
    let nr = 0; for (let w = 0; w < W; w++) if (region[w] === 0 && Math.abs(PY(w) - neckY) < 0.012) nr += Math.hypot(PX(w) - nx, PZ(w) - nz); nr = nn ? nr / nn : 0.055;
    const holeR = nr + 0.022;
    const keep = new Uint8Array(W);
    for (let w = 0; w < W; w++) {
      const y = PY(w);
      if (y > neckY + 0.02 || y < shellBot || region[w] >= 2) continue;
      if (!isArm(w) && y > shellTop - 0.05 && Math.hypot(PX(w) - nx, PZ(w) - nz) < holeR) continue;
      keep[w] = 1;
    }
    // 沒有連在身體上的小塊（例如胸部另外做的小零件）不要：抹平碰不到它們，會在袍子上凸出來
    { const comp = new Int32Array(W).fill(-1), sizes = []; for (let w0 = 0; w0 < W; w0++) { if (!keep[w0] || comp[w0] >= 0) continue; const id = sizes.length, st = [w0]; comp[w0] = id; let c = 0; while (st.length) { const w = st.pop(); c++; for (const o of wnb[w]) if (keep[o] && comp[o] < 0) { comp[o] = id; st.push(o); } } sizes.push(c); }
      const big = Math.max(...sizes, 0); let dropped = 0; for (let w = 0; w < W; w++) if (keep[w] && sizes[comp[w]] < big * 0.05) { keep[w] = 0; dropped++; }
      if (window.__outfitDebug) console.error('robe parts ' + JSON.stringify(sizes.filter((x) => x > 0).sort((a, b) => b - a).slice(0, 8)) + ' dropped ' + dropped); }
    // 先把身體本身抹平（去掉鎖骨、胸部、肋骨這些細節）當基準；再往外推 off（裡面有衣服就在衣服外面一點，但最多 3.5 公分，
    // 手臂不管裡面那件：袖子剪掉了），再抹一次。抹平用一推一拉的方法，不會越抹越瘦
    const inH = B.innerH ?? new Float32Array(W).fill(-Infinity);
    const want = (w) => Math.max(off, isArm(w) ? 0 : Math.min(0.035, inH[w] + 0.008));
    const smoothField = (X, iters) => {
      for (let it = 0; it < iters; it++) for (const f of [0.5, -0.53]) {
        const T = X.slice();
        for (let w = 0; w < W; w++) { if (!keep[w]) continue; let c = 0; const s = [0, 0, 0]; for (const o of wnb[w]) if (keep[o]) { for (let k = 0; k < 3; k++) s[k] += X[o * 3 + k]; c++; } if (c) for (let k = 0; k < 3; k++) T[w * 3 + k] = X[w * 3 + k] + (s[k] / c - X[w * 3 + k]) * f; }
        X.set(T);
      }
    };
    // 用真實距離抹平：每個點換成「3 公分內所有點的平均」（方向用 4 公分內的平均）。
    // 身體網格有的地方很密（胸部），用「跟旁邊幾個點平均幾次」只抹得到幾公釐，乳頭這種細節會留在袍子上
    const cell = 0.03, gmap = new Map(), gk = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    for (let w = 0; w < W; w++) if (keep[w]) { const k = gk(PX(w), PY(w), PZ(w)); let a = gmap.get(k); if (!a) gmap.set(k, (a = [])); a.push(w); }
    const around = (x, y, z, R, fn) => { const r = Math.ceil(R / cell), x0 = Math.floor(x / cell), y0 = Math.floor(y / cell), z0 = Math.floor(z / cell);
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) { const a = gmap.get(`${x0 + i},${y0 + j},${z0 + k}`); if (!a) continue; for (const o of a) { const d = Math.hypot(PX(o) - x, PY(o) - y, PZ(o) - z); if (d < R) fn(o, d); } } };
    const Pb = new Float32Array(W * 3), Nn = new Float32Array(W * 3);
    for (let w = 0; w < W; w++) {
      if (!keep[w]) continue;
      const x = PX(w), y = PY(w), z = PZ(w), arm = isArm(w); let sw = 0; const sp = [0, 0, 0], sn = [0, 0, 0];
      around(x, y, z, 0.04, (o, d) => {
        if (isArm(o) !== arm) return; // 手臂跟身體分開抹（手臂垂在身體旁邊，混在一起會黏起來）
        const wt = 1 - d / 0.04, r = rep[o] * 3;
        for (let k = 0; k < 3; k++) sn[k] += pnorm[r + k] * wt;
        if (d < 0.03) { const wp = 1 - d / 0.03; for (let k = 0; k < 3; k++) sp[k] += posed[r + k] * wp; sw += wp; }
      });
      for (let k = 0; k < 3; k++) Pb[w * 3 + k] = sw ? sp[k] / sw : posed[rep[w] * 3 + k];
      const l = Math.hypot(sn[0], sn[1], sn[2]) || 1; for (let k = 0; k < 3; k++) Nn[w * 3 + k] = sn[k] / l;
    }
    const S = new Float32Array(W * 3);
    for (let w = 0; w < W; w++) if (keep[w]) { const d = want(w); for (let k = 0; k < 3; k++) S[w * 3 + k] = Pb[w * 3 + k] + Nn[w * 3 + k] * d; }
    smoothField(S, 6);
    const outside = (w, base, h0, N = Nn) => { const h = (S[w * 3] - base[w * 3]) * N[w * 3] + (S[w * 3 + 1] - base[w * 3 + 1]) * N[w * 3 + 1] + (S[w * 3 + 2] - base[w * 3 + 2]) * N[w * 3 + 2]; if (h < h0) for (let k = 0; k < 3; k++) S[w * 3 + k] += N[w * 3 + k] * (h0 - h); };
    const skin = new Float32Array(W * 3); for (let w = 0; w < W; w++) for (let k = 0; k < 3; k++) skin[w * 3 + k] = posed[rep[w] * 3 + k];
    // 一定要在皮膚、裡面衣服外面：先算每個點還差多少，把「差多少」往旁邊擴開、抹平，再整片推出去（只推那幾個點會在袍子上推出小凸起）
    const lift = new Float32Array(W);
    for (let w = 0; w < W; w++) if (keep[w]) {
      const r = rep[w] * 3, h = (S[w * 3] - posed[r]) * pnorm[r] + (S[w * 3 + 1] - posed[r + 1]) * pnorm[r + 1] + (S[w * 3 + 2] - posed[r + 2]) * pnorm[r + 2];
      lift[w] = Math.max(0, Math.max(0.002, isArm(w) ? 0 : Math.min(0.03, inH[w] + 0.004)) - h);
    }
    // 用真實距離（10 公分內）往旁邊擴；身體網格有的地方很密，用「幾圈點」來算範圍會太小
    { const src = []; for (let w = 0; w < W; w++) if (keep[w] && lift[w] > 0.0005) src.push(w);
      const out = new Float32Array(W), R = 0.1;
      for (let w = 0; w < W; w++) { if (!keep[w]) continue; let m = 0; for (const j of src) { const d = Math.hypot(S[w * 3] - S[j * 3], S[w * 3 + 1] - S[j * 3 + 1], S[w * 3 + 2] - S[j * 3 + 2]); if (d < R) m = Math.max(m, lift[j] * sm(R, R * 0.4, d)); } out[w] = m; } // 4 公分內推一樣多（平的），再慢慢收
      lift.set(out); }
    for (let w = 0; w < W; w++) if (keep[w] && lift[w] > 0) for (let k = 0; k < 3; k++) S[w * 3 + k] += Nn[w * 3 + k] * lift[w];
    if (!window.__noSkin) for (let w = 0; w < W; w++) if (keep[w]) outside(w, skin, 0.002, pnorm.length === W * 3 ? pnorm : Nn); // 最後保險（幾乎不會動到）
    // 喇叭袖：手腕附近往外放
    if (sleeveFlare > 0) for (let w = 0; w < W; w++) if (keep[w] && isArm(w)) { const f = sleeveFlare * sm(0.22, 0.02, handDist(w)), r = rep[w] * 3; for (let k = 0; k < 3; k++) S[w * 3 + k] += pnorm[r + k] * f; }
    // 開襟：沿著「離中線 openW」那條線把三角形切開（邊是直的，也不用移動點，不會陷進身體）
    const tw = spec.trimWidth ?? 0.016;
    const F = new Float32Array(W).fill(1);
    for (let w = 0; w < W; w++) if (keep[w] && front(w) && !isArm(w) && openW(PY(w)) > 0.0005) F[w] = Math.abs(S[w * 3] - cx) - openW(PY(w));
    // 每個三角形：先切掉開口（F < 0），再沿 F = tw 切成滾邊、袍身兩塊（顏色邊界才會是直的）
    const cuffT = (w) => isArm(w) && handDist(w) < 0.05;
    const vcache = new Map();
    const pv = (pt, part) => { // pt：{ key, p, w }；part：0 袍身、1 滾邊
      const key = pt.key + '|' + part; if (vcache.has(key)) return vcache.get(key);
      const id = vert(pt.p[0], pt.p[1], pt.p[2], part ? trim : color, nodeW(pt.w)); vcache.set(key, id); return id;
    };
    const node = (w) => ({ key: 'n' + w, p: [S[w * 3], S[w * 3 + 1], S[w * 3 + 2]], w, f: F[w], cuff: cuffT(w) });
    const clip = (poly, thr, keepAbove) => { // 留下 f ≥ thr（keepAbove）或 f < thr 的部分
      const out = [];
      for (let k = 0; k < poly.length; k++) {
        const P = poly[k], Q = poly[(k + 1) % poly.length], inP = (P.f >= thr) === keepAbove, inQ = (Q.f >= thr) === keepAbove;
        if (inP) out.push(P);
        if (inP !== inQ) {
          const t = (P.f - thr) / (P.f - Q.f), ids = [P.key, Q.key].sort();
          out.push({ key: 'c' + thr + ':' + ids.join(','), p: [0, 1, 2].map((i) => P.p[i] + (Q.p[i] - P.p[i]) * t), w: t < 0.5 ? P.w : Q.w, f: thr, cuff: P.cuff && Q.cuff });
        }
      }
      return out;
    };
    const emit = (poly, part) => { if (poly.length < 3) return; const ids = poly.map((pt) => pv(pt, part)); for (let k = 1; k + 1 < ids.length; k++) idx.push(ids[0], ids[k], ids[k + 1]); };
    const seen = new Set();
    for (let t = 0; t < TRI.length; t += 3) {
      const A = wid[TRI[t]], Bn = wid[TRI[t + 1]], C = wid[TRI[t + 2]];
      if (A === Bn || Bn === C || A === C || !keep[A] || !keep[Bn] || !keep[C]) continue;
      const key = [A, Bn, C].sort((p, q) => p - q).join(); if (seen.has(key)) continue; seen.add(key);
      let poly = [node(A), node(Bn), node(C)];
      if (poly.every((pt) => pt.f === 1)) { emit(poly, poly.every((pt) => pt.cuff) ? 1 : 0); continue; } // 開口附近以外
      poly = clip(poly, 0, true); if (poly.length < 3) continue;
      emit(clip(poly, tw, false), 1); emit(clip(poly, tw, true), 0);
    }
  }

  // ---------- 一圈一圈的輪廓（腰以下的袍子、立領共用） ----------
  const K = 48;
  // 沒有骨架的低面數模型點很稀：在每個三角形上多取幾個點（帶著最近的節點，用來判斷是哪個部位）
  let samples = null;
  if (!skinned) {
    samples = [];
    for (let t = 0; t < TRI.length; t += 3) {
      const A = wid[TRI[t]], Bn = wid[TRI[t + 1]], C = wid[TRI[t + 2]];
      for (let a = 0; a <= 4; a++) for (let b = 0; a + b <= 4; b++) { const u = a / 4, v = b / 4, w0 = 1 - u - v;
        samples.push(PX(A) * w0 + PX(Bn) * u + PX(C) * v, PY(A) * w0 + PY(Bn) * u + PY(C) * v, PZ(A) * w0 + PZ(Bn) * u + PZ(C) * v, w0 >= u && w0 >= v ? A : u >= v ? Bn : C); }
    }
  }
  const profile = (y0, y1, filter) => { // y0～y1 之間的身體節點，每個角度最遠多遠（角度 0＝正前方）
    const r = new Float32Array(K).fill(-1);
    const add = (x, y, z, w) => {
      if (y < y0 || y > y1 || !filter(w)) return;
      const dx = x - cx, dz = z - cz, a = Math.atan2(dx, dz), k = ((Math.round((a / (Math.PI * 2)) * K) % K) + K) % K, d = Math.hypot(dx, dz);
      if (d > r[k]) r[k] = d;
    };
    if (samples) for (let i = 0; i < samples.length; i += 4) add(samples[i], samples[i + 1], samples[i + 2], samples[i + 3]);
    else for (let w = 0; w < W; w++) add(PX(w), PY(w), PZ(w), w);
    // 空的角度用旁邊補。沒有骨架的低面數模型點很稀，空的很多：用兩邊最近、有量到的角度內插（取最大值會撐成大圓筒）
    const known = Uint8Array.from(r, (v) => (v >= 0 ? 1 : 0));
    if (!skinned && r.some((v) => v >= 0)) {
      const t = r.slice();
      for (let k = 0; k < K; k++) if (r[k] < 0) {
        let a = 1; while (r[(k - a + K) % K] < 0) a++; let b = 1; while (r[(k + b) % K] < 0) b++;
        // 兩邊量到的點連成直線（弦），這個角度的射線打到那條線的距離（用半徑內插會在空的那一側鼓成大圓弧）
        const ang = (kk) => (kk / K) * Math.PI * 2, ka = k - a, kb = k + b, ra = r[(ka + K) % K], rb = r[kb % K];
        const P1 = [Math.sin(ang(ka)) * ra, Math.cos(ang(ka)) * ra], P2 = [Math.sin(ang(kb)) * rb, Math.cos(ang(kb)) * rb], D = [Math.sin(ang(k)), Math.cos(ang(k))];
        const ex = P2[0] - P1[0], ez = P2[1] - P1[1], den = D[0] * ez - D[1] * ex;
        const hit = Math.abs(den) > 1e-6 ? (P1[0] * ez - P1[1] * ex) / den : -1;
        t[k] = hit > 0 ? Math.min(hit, Math.max(ra, rb)) : Math.min(ra, rb) * 0.3;
      }
      r.set(t);
    }
    for (let pass = 0; pass < K; pass++) { let any = false; for (let k = 0; k < K; k++) if (r[k] < 0) { const a = r[(k + K - 1) % K], b = r[(k + 1) % K]; if (a >= 0 || b >= 0) { r[k] = Math.max(a, b); any = true; } } if (!any) break; }
    for (let pass = 0; pass < 2; pass++) { const t = r.slice(); for (let k = 0; k < K; k++) t[k] = Math.max(r[k], (r[(k + K - 1) % K] + r[k] * 2 + r[(k + 1) % K]) / 4); r.set(t); }
    r.known = known; return r;
  };
  // 沒有骨架的低面數模型：輪廓角角的，沿著一圈再抹圓（寬的平均，但不往裡面縮超過 6 公釐）
  const roundOut = (r) => { if (skinned) return r; let x = r; for (let it = 0; it < 3; it++) { const t = new Float32Array(K); for (let k = 0; k < K; k++) { let s2 = 0, w2 = 0; for (let d = -4; d <= 4; d++) { const w = 5 - Math.abs(d); s2 += x[(k + d + K) % K] * w; w2 += w; } t[k] = Math.max(s2 / w2, r[k] - 0.006); } x = t; } x.known = r.known; return x; };
  const at = (r, a) => { const f = (((a / (Math.PI * 2)) * K) % K + K) % K, k0 = Math.floor(f), t = f - k0; return r[k0] * (1 - t) + r[(k0 + 1) % K] * t; };
  // 一圈圈接成布：rings＝[{ y, r（輪廓）, half（前面開口的半角）, c（顏色） }]
  const tube = (rings, weights, segs = 40) => tubeAt(cx, cz, rings, weights, segs);
  const tubeAt = (ox, oz, rings, weights, segs = 40) => {
    let prev = null;
    for (const ring of rings) {
      const row = [];
      for (let j = 0; j <= segs; j++) {
        const a = ring.half + (Math.PI * 2 - ring.half * 2) * (j / segs), rr = at(ring.r, a);
        const arc = Math.min(a - ring.half, Math.PI * 2 - ring.half - a) * rr; // 離開口邊多遠（公尺）
        const c = (ring.half > 0.01 && arc < (spec.trimWidth ?? 0.016) * 1.3) ? trim : ring.c;
        row.push(vert(ox + Math.sin(a) * rr, ring.y, oz + Math.cos(a) * rr, c, weights));
      }
      if (prev) for (let j = 0; j < segs; j++) idx.push(prev[j], row[j], prev[j + 1], prev[j + 1], row[j], row[j + 1]);
      prev = row;
    }
  };

  // ---------- 沒有骨架：上半身也一圈一圈量；手臂沿著肩膀→手肘→手腕量成管子 ----------
  // 沒有骨架：垂下來的手臂貼著身體，量軀幹的輪廓時把離手臂（肩膀→手肘→手腕）5.5 公分內的點拿掉，不然上半身會被撐成箱子
  const segD = (p, a, b) => { const ab = b.clone().sub(a), t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
  const offArm = (w) => { if (skinned || !B.arms) return true; const p = new THREE.Vector3(PX(w), PY(w), PZ(w));
    for (const S3 of B.arms) { const hand = S3[2].clone().addScaledVector(S3[2].clone().sub(S3[1]).normalize(), 0.16); if (segD(p, S3[0].clone().setY(S3[0].y - 0.04), S3[1]) < 0.055 || segD(p, S3[1], S3[2]) < 0.05 || segD(p, S3[2], hand) < 0.06) return false; }
    return true; };
  if (!skinned) {
    const torsoRings = [];
    for (let y = shellBot; y <= shellTop + 1e-6; y += 0.02) {
      const r = roundOut(profile(y - 0.03, y + 0.03, (w) => offArm(w))).map((v) => (v > 0 ? v + off : 0.12));
      torsoRings.push({ y, r, half: Math.atan2(openW(y), r[0] || 0.12), c: color });
    }
    for (let it = 0; it < 6; it++) for (let j = 1; j < torsoRings.length - 1; j++) { const a = torsoRings[j - 1].r, b = torsoRings[j].r, c = torsoRings[j + 1].r; for (let k = 0; k < K; k++) b[k] = Math.max(b[k], (a[k] + b[k] * 2 + c[k]) / 4); }
    tube(torsoRings, rigid(0));
    const segsA = 20;
    for (const side of [0, 1]) {
      const Sx = B.arms[side]; // [肩膀, 手肘, 手腕]
      const pts = []; for (let k = 0; k < 2; k++) { const A = Sx[k], E = Sx[k + 1], L = A.distanceTo(E); for (let t = 0; t < L; t += 0.02) pts.push({ c: A.clone().lerp(E, t / L), d: E.clone().sub(A).normalize() }); }
      pts.push({ c: Sx[2].clone(), d: Sx[2].clone().sub(Sx[1]).normalize() });
      // 先量每一圈，再沿著手臂抹平、截面弄圓一點（低面數的模型點很少，不抹平會一節一節的）
      const frames = pts.map(({ c, d }) => {
        const u = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 0, 1)).normalize(), vv = new THREE.Vector3().crossVectors(u, d);
        const r = new Float32Array(segsA).fill(-1);
        for (let w = 0; w < W; w++) {
          if (region[w] !== 1) continue;
          const q = new THREE.Vector3(PX(w), PY(w), PZ(w)).sub(c), along = q.dot(d); if (Math.abs(along) > 0.03) continue;
          const x = q.dot(u), y = q.dot(vv), rad = Math.hypot(x, y); if (rad > 0.09) continue;
          const k = ((Math.round((Math.atan2(y, x) / (Math.PI * 2)) * segsA) % segsA) + segsA) % segsA; if (rad > r[k]) r[k] = rad;
        }
        let mx = 0; for (const v of r) mx = Math.max(mx, v); for (let k = 0; k < segsA; k++) if (r[k] < 0) r[k] = mx > 0 ? mx : 0.045;
        const mean = Math.min(0.045, r.reduce((a, b) => a + b, 0) / segsA); for (let k = 0; k < segsA; k++) r[k] = Math.min(0.05, Math.max(r[k] * 0.3 + mean * 0.7, mean * 0.9)); // 手臂最粗 5 公分（半徑），截面接近圓的
        return { c, u, vv, r };
      });
      for (let it = 0; it < 4; it++) for (let j = 1; j < frames.length - 1; j++) for (let k = 0; k < segsA; k++) frames[j].r[k] = (frames[j - 1].r[k] + frames[j].r[k] * 2 + frames[j + 1].r[k]) / 4;
      let prev = null;
      frames.forEach(({ c, u, vv, r }, j) => {
        const flareNow = sleeveFlare * sm(0.22, 0.0, c.distanceTo(Sx[2])), cuff = j >= frames.length - 2;
        const row = [];
        for (let k = 0; k <= segsA; k++) {
          const a = (k / segsA) * Math.PI * 2, rr = r[k % segsA] + off * 0.5 + flareNow; // 袖子貼一點（太鬆會像兩根柱子）
          const p = c.clone().addScaledVector(u, Math.cos(a) * rr).addScaledVector(vv, Math.sin(a) * rr);
          row.push(vert(p.x, p.y, p.z, cuff ? trim : color, rigid(0)));
        }
        if (prev) for (let k = 0; k < segsA; k++) idx.push(prev[k], row[k], prev[k + 1], prev[k + 1], row[k], row[k + 1]);
        prev = row;
      });
    }
  }

  // ---------- 腰以下 ----------
  const notArm = (w) => (skinned ? region[w] === 0 || region[w] === 3 : offArm(w)); // 沒有骨架的模型分區常常分錯，只看離手臂多遠
  const topY = hipY + 0.08, step = 0.02, rings = []; // 從腰帶下面開始：接縫藏在腰帶後面
  let last = null, lastKnown = null, i = 0;
  for (let y = topY; y >= hemY - 1e-6; y -= step, i++) {
    const body = roundOut(profile(y - 0.02, y + 0.02, notArm));
    const r = new Float32Array(K);
    for (let k = 0; k < K; k++) {
      let v = body[k] > 0 ? body[k] + off * Math.min(1, 0.5 + i * 0.25) + 0.006 * Math.min(1, i / 2) : (last ? last[k] : 0.15); // 最上面兩圈收在上半身裡面（腰帶後面），再放出來
      if (last && (skinned || lastKnown[k])) v = Math.max(v, last[k] + flare * step); // 往下只會變寬（上一圈那個方向是補出來的就不算）
      r[k] = v;
    }
    const belt = false, hem = y - step < hemY;
    const frontR = r[0] || 0.15, half = Math.max(Math.atan2(openWaist, frontR), openHem * sm(topY, hemY, y));
    rings.push({ y, r, half, c: belt || hem ? trim : color });
    lastKnown = last && !skinned ? Uint8Array.from(body.known ?? [], (v, k) => v || lastKnown[k]) : (body.known ?? null); last = r;
  }
  tube(rings, rigid(hipBone));
  // 腰帶：腰上一條帶子（貼著上半身）
  if (spec.belt !== false) {
    const bw0 = roundOut(profile(hipY + 0.04, hipY + 0.1, (w) => (skinned ? region[w] === 0 : offArm(w)))).map((v) => v + off + 0.012);
    const half = Math.atan2(openWaist, bw0[0] || 0.12);
    tube([{ y: hipY + 0.095, r: bw0, half, c: trim }, { y: hipY + 0.06, r: bw0.map((v) => v + 0.002), half, c: trim }], rigid(hipBone), 40);
  }

  // ---------- 立領：圍著脖子（不是肩膀）的一圈，往上微微張開 ----------
  if (spec.collar !== false) {
    let nx = 0, nz = 0, nn = 0; for (let w = 0; w < W; w++) if (region[w] === 0 && Math.abs(PY(w) - neckY) < 0.012) { nx += PX(w); nz += PZ(w); nn++; }
    nx = nn ? nx / nn : cx; nz = nn ? nz / nn : cz;
    const r0 = new Float32Array(K).fill(0);
    for (let w = 0; w < W; w++) { if (region[w] !== 0 || Math.abs(PY(w) - neckY) > 0.015) continue; const a = Math.atan2(PX(w) - nx, PZ(w) - nz), k = ((Math.round((a / (Math.PI * 2)) * K) % K) + K) % K; r0[k] = Math.max(r0[k], Math.hypot(PX(w) - nx, PZ(w) - nz)); }
    let mean = 0, c = 0; for (const v of r0) if (v > 0) { mean += v; c++; } mean = c ? mean / c : 0.055;
    const r = Array.from(r0, (v) => (v > 0 ? v * 0.5 + mean * 0.5 : mean) + 0.026);
    const half = Math.atan2(Math.max(openTop * 0.8, 0.012), r[0] || 0.08);
    tubeAt(nx, nz, [{ y: neckY - 0.045, r: r.map((v) => v + 0.012), half, c: color }, { y: neckY - 0.01, r, half, c: color }, { y: neckY + 0.015, r: r.map((v) => v + 0.006), half, c: trim }], rigid(chestBone), 32);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (skinned) { g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skI, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skW, 4)); }
  g.setIndex(idx); g.computeVertexNormals();
  if (window.__robeDump) (window.__robes ||= []).push({ pos: Array.from(pos), idx: Array.from(idx), nor: Array.from(g.attributes.normal.array), spec });
  const mat = new THREE.MeshStandardMaterial({ name: 'robe', vertexColors: true, roughness: 0.88, side: THREE.DoubleSide, map: fabricColor(), shadowSide: THREE.BackSide }); // 用背面算影子，袍子自己身上才不會有條紋
  return { geometry: g, material: mat };
}
