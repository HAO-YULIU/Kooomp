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
  const { posed, pnorm, wid, W, wnb, TRI, region, bones, bw, bi, skinned, cx, neckY, hipY, hands } = B; // B.arms：沒有骨架時兩隻手的 [肩膀, 手肘, 手腕] // region：每個身體節點是 0 軀幹、1 手臂、2 手、3 腿
  const color = new THREE.Color(spec.color ?? '#2a2a33'), trim = new THREE.Color(spec.trim ?? '#b8902e');
  const off = spec.off ?? (B.skinned ? 0.016 : 0.024), hemY = hipY * (spec.hem ?? 0.12), flare = spec.flare ?? 0.12, sleeveFlare = spec.sleeveFlare ?? 0;
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
    // 開襟：沿著「離中線 openW」那條線把三角形切開（邊是直的，也不用移動點，不會陷進身體）
    const tw = spec.trimWidth ?? 0.016;
    const F = new Float32Array(W).fill(1);
    for (let w = 0; w < W; w++) if (keep[w] && front(w) && !isArm(w) && openW(PY(w)) > 0.0005) F[w] = Math.abs(S[w * 3] - cx) - openW(PY(w));
    const shellCol = (w) => ((F[w] < tw && F[w] !== 1) || (isArm(w) && handDist(w) < 0.05) ? trim : color);
    const vid = new Int32Array(W).fill(-1), cut = new Map();
    const sv = (w) => (vid[w] >= 0 ? vid[w] : (vid[w] = vert(S[w * 3], S[w * 3 + 1], S[w * 3 + 2], shellCol(w), nodeW(w))));
    const cv = (A, Bn) => { // A、B 之間切開的點（共用，布才連在一起）
      const key = A < Bn ? A + ',' + Bn : Bn + ',' + A; if (cut.has(key)) return cut.get(key);
      const t = F[A] / (F[A] - F[Bn]), p = [0, 1, 2].map((k) => S[A * 3 + k] + (S[Bn * 3 + k] - S[A * 3 + k]) * t);
      const id = vert(p[0], p[1], p[2], trim, nodeW(t < 0.5 ? A : Bn)); cut.set(key, id); return id;
    };
    const seen = new Set();
    for (let t = 0; t < TRI.length; t += 3) {
      const A = wid[TRI[t]], Bn = wid[TRI[t + 1]], C = wid[TRI[t + 2]];
      if (A === Bn || Bn === C || A === C || !keep[A] || !keep[Bn] || !keep[C]) continue;
      const key = [A, Bn, C].sort((p, q) => p - q).join(); if (seen.has(key)) continue; seen.add(key);
      const tri = [A, Bn, C];
      if (tri.every((w) => F[w] >= 0)) { idx.push(sv(A), sv(Bn), sv(C)); continue; }
      if (tri.every((w) => F[w] < 0)) continue;
      const poly = []; // 留下 F ≥ 0 的部分
      for (let k = 0; k < 3; k++) { const P = tri[k], Q = tri[(k + 1) % 3]; if (F[P] >= 0) poly.push(sv(P)); if ((F[P] >= 0) !== (F[Q] >= 0)) poly.push(cv(P, Q)); }
      for (let k = 1; k + 1 < poly.length; k++) idx.push(poly[0], poly[k], poly[k + 1]);
    }
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

  // ---------- 沒有骨架：上半身也一圈一圈量；手臂沿著肩膀→手肘→手腕量成管子 ----------
  if (!skinned) {
    const torsoRings = [];
    for (let y = shellBot; y <= shellTop + 1e-6; y += 0.02) {
      const r = profile(y - 0.015, y + 0.015, (w) => region[w] === 0).map((v) => (v > 0 ? v + off : 0.12));
      torsoRings.push({ y, r, half: Math.atan2(openW(y), r[0] || 0.12), c: color });
    }
    for (let it = 0; it < 2; it++) for (let j = 1; j < torsoRings.length - 1; j++) { const a = torsoRings[j - 1].r, b = torsoRings[j].r, c = torsoRings[j + 1].r; for (let k = 0; k < K; k++) b[k] = Math.max(b[k], (a[k] + b[k] * 2 + c[k]) / 4); }
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
        const mean = Math.min(0.055, r.reduce((a, b) => a + b, 0) / segsA); for (let k = 0; k < segsA; k++) r[k] = Math.min(0.065, Math.max(r[k] * 0.4 + mean * 0.6, mean * 0.9)); // 手臂最粗 6.5 公分（半徑）
        return { c, u, vv, r };
      });
      for (let it = 0; it < 4; it++) for (let j = 1; j < frames.length - 1; j++) for (let k = 0; k < segsA; k++) frames[j].r[k] = (frames[j - 1].r[k] + frames[j].r[k] * 2 + frames[j + 1].r[k]) / 4;
      let prev = null;
      frames.forEach(({ c, u, vv, r }, j) => {
        const flareNow = sleeveFlare * sm(0.22, 0.0, c.distanceTo(Sx[2])), cuff = j >= frames.length - 2;
        const row = [];
        for (let k = 0; k <= segsA; k++) {
          const a = (k / segsA) * Math.PI * 2, rr = r[k % segsA] + off + flareNow;
          const p = c.clone().addScaledVector(u, Math.cos(a) * rr).addScaledVector(vv, Math.sin(a) * rr);
          row.push(vert(p.x, p.y, p.z, cuff ? trim : color, rigid(0)));
        }
        if (prev) for (let k = 0; k < segsA; k++) idx.push(prev[k], row[k], prev[k + 1], prev[k + 1], row[k], row[k + 1]);
        prev = row;
      });
    }
  }

  // ---------- 腰以下 ----------
  const notArm = (w) => region[w] === 0 || region[w] === 3;
  const topY = hipY + 0.06, step = 0.02, rings = [];
  let last = null, i = 0;
  for (let y = topY; y >= hemY - 1e-6; y -= step, i++) {
    const body = profile(y - 0.02, y + 0.02, notArm);
    const r = new Float32Array(K);
    for (let k = 0; k < K; k++) {
      let v = body[k] > 0 ? body[k] + off + (i < 3 ? 0 : 0.008) : (last ? last[k] : 0.15); // 腰帶那幾圈貼身一點，不然腰上會凸一圈
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
