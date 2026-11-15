// 測試機器人放進網頁裡的小工具（tools/e2e/full-play.cjs 用 addInitScript 放進去）。只讀遊戲狀態、算路線，不改遊戲。
// 路線：把目前這一區（碼頭／學校／圖書館）切成 0.25 公尺的格子，有牆、家具的格子不能走，用 A* 找路，再把路線拉直。
(() => {
  const CELL = 0.25, R = 0.42; // 玩家半徑 0.35，再留一點空
  const REGIONS = [
    { x: [-36, 12], z: [100, 172] }, // 序幕：碼頭、大廳、宴會廳
    { x: [-25, 25], z: [-94, 25] }, // 學校：宿舍、星盤廳、北翼
    { x: [98, 175], z: [-68, 20] }, // 圖書館、鐘塔
  ];
  const regionOf = (x, z) => REGIONS.find((r) => x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1]);
  function grid(reg) {
    const w = window.__w, cols = Math.ceil((reg.x[1] - reg.x[0]) / CELL), rows = Math.ceil((reg.z[1] - reg.z[0]) / CELL);
    const ok = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = reg.x[0] + (c + 0.5) * CELL, z = reg.z[0] + (r + 0.5) * CELL;
      if (w.roomOf(x, z)) ok[r * cols + c] = 1;
    }
    for (const k of w.world.colliders) {
      const c0 = Math.max(0, Math.floor((k.minX - R - reg.x[0]) / CELL)), c1 = Math.min(cols - 1, Math.floor((k.maxX + R - reg.x[0]) / CELL));
      const r0 = Math.max(0, Math.floor((k.minZ - R - reg.z[0]) / CELL)), r1 = Math.min(rows - 1, Math.floor((k.maxZ + R - reg.z[0]) / CELL));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const x = reg.x[0] + (c + 0.5) * CELL, z = reg.z[0] + (r + 0.5) * CELL;
        const dx = Math.max(k.minX - x, 0, x - k.maxX), dz = Math.max(k.minZ - z, 0, z - k.maxZ);
        if (Math.hypot(dx, dz) < R) ok[r * cols + c] = 0;
      }
    }
    return { reg, cols, rows, ok };
  }
  const distRect = (x, z, t) => { const [w, , d] = t.size ?? [0.6, 0.6, 0.6]; return Math.hypot(Math.max(t.x - w / 2 - x, 0, x - t.x - w / 2), Math.max(t.z - d / 2 - z, 0, z - t.z - d / 2)); };
  // goal：{ x, z, tol } 走到某一點附近；或 { rect: 東西, reach } 走到可以調查那個東西的地方
  function plan(goal) {
    const w = window.__w, s = w.controls.state, reg = regionOf(s.pos.x, s.pos.z);
    if (!reg) return { error: 'no_region' };
    const G = grid(reg), { cols, rows, ok } = G;
    const cellOf = (x, z) => [Math.max(0, Math.min(cols - 1, Math.floor((x - reg.x[0]) / CELL))), Math.max(0, Math.min(rows - 1, Math.floor((z - reg.z[0]) / CELL)))];
    const at = (c, r) => [reg.x[0] + (c + 0.5) * CELL, reg.z[0] + (r + 0.5) * CELL];
    const isGoal = (c, r) => { const [x, z] = at(c, r); return goal.rect ? distRect(x, z, goal.rect) <= goal.reach : Math.hypot(x - goal.x, z - goal.z) <= goal.tol; };
    let [sc, sr] = cellOf(s.pos.x, s.pos.z);
    if (!ok[sr * cols + sc]) { // 站的地方太靠近牆：找最近能走的格子當起點
      let best = null, bd = 1e9;
      for (let r = sr - 4; r <= sr + 4; r++) for (let c = sc - 4; c <= sc + 4; c++) if (c >= 0 && r >= 0 && c < cols && r < rows && ok[r * cols + c]) { const d = Math.hypot(c - sc, r - sr); if (d < bd) { bd = d; best = [c, r]; } }
      if (best) [sc, sr] = best;
    }
    const gx = goal.rect ? goal.rect.x : goal.x, gz = goal.rect ? goal.rect.z : goal.z;
    const [gc, gr] = cellOf(gx, gz);
    const N = cols * rows, gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = []; const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const h = (c, r) => { const dx = Math.abs(c - gc), dz = Math.abs(r - gr); return (Math.max(dx, dz) + 0.414 * Math.min(dx, dz)) * 0.9; };
    const s0 = sr * cols + sc; gs[s0] = 0; push(s0, h(sc, sr));
    let end = -1, n = 0;
    while (heap.length && n++ < 400000) {
      const [, i] = pop(); if (closed[i]) continue; closed[i] = 1;
      const c = i % cols, r = (i / cols) | 0;
      if (isGoal(c, r)) { end = i; break; }
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue; const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const j = nr * cols + nc; if (!ok[j] || closed[j]) continue;
        if (dc && dr && (!ok[r * cols + nc] || !ok[nr * cols + c])) continue; // 不要斜著切過牆角
        const g = gs[i] + (dc && dr ? 1.414 : 1); if (g < gs[j]) { gs[j] = g; from[j] = i; push(j, g + h(nc, nr)); }
      }
    }
    if (end < 0) return { error: 'no_path', x: s.pos.x, z: s.pos.z };
    const cells = []; for (let i = end; i >= 0; i = from[i]) cells.push(i); cells.reverse();
    const pts = cells.map((i) => at(i % cols, (i / cols) | 0));
    // 拉直：看得到的就直接走過去
    const clear = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n2 = Math.ceil(d / 0.1); for (let k = 0; k <= n2; k++) { const x = a[0] + (b[0] - a[0]) * k / n2, z = a[1] + (b[1] - a[1]) * k / n2; const [c, r] = cellOf(x, z); if (!ok[r * cols + c]) return false; } return true; };
    const out = []; let cur = [s.pos.x, s.pos.z], k = 0;
    while (k < pts.length - 1) { let j = pts.length - 1; while (j > k + 1 && !clear(cur, pts[j])) j--; out.push(pts[j]); cur = pts[j]; k = j; }
    if (!out.length) out.push(pts[pts.length - 1]);
    return { x: s.pos.x, z: s.pos.z, yaw: s.yaw, path: out.map(([x, z]) => [+x.toFixed(2), +z.toFixed(2)]) };
  }
  // 走路速度補償：測試電腦沒有顯示卡，一秒只有幾格；遊戲每一格最多只算 0.05 秒的移動，
  // 所以照這一格真正花的時間把移動放大（最多一格走 0.8 公尺），等於用正常的速度在走。只影響這個玩家自己的移動。
  let last = performance.now();
  const tick = (now) => { const dt = (now - last) / 1000; last = now; const w = window.__w; if (w && window.__botComp) w.controls.state.speedMul = Math.max(1, Math.min(8, dt / 0.05)); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.__bot = {
    plan,
    st() {
      const w = window.__w; if (!w) return null; const s = w.controls.state, ml = window.__ml;
      const vis = (id) => { const e = document.getElementById(id); return !!e && !e.hidden; };
      return { x: +s.pos.x.toFixed(2), z: +s.pos.z.toFixed(2), yaw: s.yaw, zone: w.zone(), talking: vis('dialog'), panel: vis('panel'), seg: ml?.state.segment, solved: [...(ml?.state.solved ?? [])], target: w.target()?.id ?? null, items: [...(ml?.state.items ?? [])], lock: document.pointerLockElement === w.controls?.dom || !!document.pointerLockElement, enabled: s.enabled, act4: ml?.state.act4 ?? null, nest: ml?.state.nest ?? null, toast: document.getElementById('toast')?.classList.contains('on') ? document.getElementById('toast').textContent : '' };
    },
    targetOf(id) { const w = window.__w; return w.target()?.id === id; },
    // 畫面有沒有超出：整頁不能左右捲、打開的視窗要在畫面裡
    overflow() {
      const out = [], W = innerWidth, H = innerHeight;
      if (document.documentElement.scrollWidth > W + 1) out.push(`頁面寬 ${document.documentElement.scrollWidth} > ${W}`);
      for (const id of ['panel', 'dialog', 'actions', 'hud', 'toast', 'a4grab', 'a4bound', 'a4lost', 's-home', 's-menu', 's-wait', 's-login', 's-age']) {
        const e = document.getElementById(id); if (!e || e.hidden || getComputedStyle(e).display === 'none') continue;
        const r = e.getBoundingClientRect(); if (!r.width) continue;
        if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) {
          const sc = e.scrollHeight > e.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(e).overflowY); // 自己可以捲動的就不算
          if (!(id.startsWith('s-') && sc)) out.push(`${id} 超出畫面（${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}／${W}×${H}）`);
        }
      }
      return out;
    },
  };
})();
