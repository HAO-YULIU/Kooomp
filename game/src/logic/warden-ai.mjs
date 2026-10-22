// 守夜人的行動（docs/04-map-ch1.md「守夜人的行動」）。只有「負責計算的人」（房間的 sim）的電腦在跑，結果傳給其他人。
// 不用 three.js，方便在 node 裡測試。
//   巡邏：在玩家附近的區域走來走去（玩家一直沒被抓，他就更常往玩家那邊走）
//   看到：提燈照得到的扇形（12 公尺、60 度），照到 0.5 秒就發現
//   聽到：跑步 15 公尺、走路 6 公尺內（屏息時不會被聽到），會走過去查看
//   追趕：比玩家跑步慢一點；跑出視線 4 秒就甩掉，他會到最後看到的地方找
//   躲藏：沒看到你躲進去就安全；被看到躲進去，或躲著時太靠近又沒屏息，就會被找到
//   抓到：交給房間判斷能不能掙脫；擊退、掙脫會讓他停一下

const inRect = (r, x, z) => x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1];

export function createWardenAI({ rooms, doors, points, params: P, start, rand = Math.random }) {
  const R = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const s = { rest: 0, hunt: 0, x: start.x, z: start.z, zone: start.zone, yaw: 0, mode: 'idle', target: null, goal: null, wait: 0, until: 0, seen: {}, lost: 0, last: null, near: {}, exposed: new Set(), wasHidden: {}, catches: 0, idle: 0 };

  // 區域之間怎麼走：用門連起來，找下一個要穿過的門
  function route(from, to) {
    if (from === to) return null;
    const prev = { [from]: null }, q = [from];
    while (q.length) {
      const z = q.shift(); if (z === to) break;
      for (const d of doors) {
        const n = d.a === z ? d.b : d.b === z ? d.a : null;
        if (n && R[n] && !(n in prev)) { prev[n] = { z, d }; q.push(n); }
      }
    }
    if (!(to in prev)) return null;
    let z = to; while (prev[z] && prev[z].z !== from) z = prev[z].z;
    const d = prev[z]?.d; if (!d) return null;
    // 穿過門，走到另一邊 1 公尺
    const into = R[z], dx = d.axis === 'z' ? (into.x[0] >= d.x - 0.01 ? 1 : -1) : 0, dz = d.axis === 'x' ? (into.z[0] >= d.z - 0.01 ? 1 : -1) : 0;
    return { door: [d.x, d.z], beyond: [d.x + dx * 1.2, d.z + dz * 1.2], zone: z };
  }
  const zoneAt = (x, z) => rooms.find((r) => inRect(r, x, z))?.id ?? s.zone;

  function moveTo(goal, speed, dt) { // goal：{ x, z, zone }；回傳是否到了
    let tx = goal.x, tz = goal.z;
    if (goal.zone !== s.zone) {
      const r = route(s.zone, goal.zone);
      if (!r) return true;
      const dd = Math.hypot(r.door[0] - s.x, r.door[1] - s.z);
      [tx, tz] = dd > 0.4 ? r.door : r.beyond; // 走到門口，再走過去（不要一下子跳到門的另一邊，看起來會卡一下）
      const db = Math.hypot(r.beyond[0] - s.x, r.beyond[1] - s.z);
      if (dd <= 0.4 && db < 0.15) { s.zone = r.zone; return false; }
    }
    const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return goal.zone === s.zone;
    const step = Math.min(d, speed * dt);
    s.x += (dx / d) * step; s.z += (dz / d) * step; s.yaw = Math.atan2(-dx, -dz);
    s.zone = zoneAt(s.x, s.z) ?? s.zone;
    return goal.zone === s.zone && d <= step + 0.05;
  }
  const speedMul = () => (s.catches >= 4 ? 0.9 : s.catches >= 3 ? 0.95 : 1); // 一直被抓：悄悄變慢（最多 10%）
  function sees(p, wide) { // 提燈照到（追趕中視野比較寬）
    if (p.zone !== s.zone || p.captured) return false;
    const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz);
    if (d > P.view) return false;
    if (d < 1.5) return true;
    const cos = (dx * -Math.sin(s.yaw) + dz * -Math.cos(s.yaw)) / d;
    return cos >= Math.cos(((wide ? 120 : P.fov) / 2) * Math.PI / 180);
  }
  function patrolGoal(players) {
    // 往玩家附近的區域走：找最近的（沒被抓、不在蝕巢）玩家所在的區域
    const live = players.filter((p) => !p.captured && points[p.zone]);
    let zone = s.zone;
    if (live.length) zone = live.reduce((a, b) => (Math.hypot(a.x - s.x, a.z - s.z) <= Math.hypot(b.x - s.x, b.z - s.z) ? a : b)).zone;
    const list = points[zone] ?? points[s.zone] ?? [];
    if (!list.length) return null;
    // 越久沒抓到人，越常挑離玩家近的點
    const pick = live.length && rand() < Math.min(0.8, 0.3 + s.idle / 120)
      ? list.reduce((a, b) => { const p = live[0]; return Math.hypot(a[0] - p.x, a[1] - p.z) <= Math.hypot(b[0] - p.x, b[1] - p.z) ? a : b; })
      : list[Math.floor(rand() * list.length)];
    return { x: pick[0], z: pick[1], zone };
  }

  function farPoint(players) { // 離大家最遠的巡邏點
    let best = null, bd = -1;
    for (const [zone, list] of Object.entries(points)) for (const [x, z] of list) {
      const d = Math.min(...players.filter((p) => !p.captured).map((p) => (p.zone === zone ? Math.hypot(p.x - x, p.z - z) : 40)), 99);
      if (d > bd) { bd = d; best = { x, z, zone }; }
    }
    return best;
  }

  return {
    state: s,
    // 開始：先走開一陣子（P.calm 秒看不到、聽不到人），之後「找人 P.hunt 秒 ⇄ 回蝕巢休息 P.rest 秒」輪流，玩家才有空解謎（2026-10-22 製作人）
    start() { if (s.mode === 'idle') { s.mode = P.calm ? 'rest' : 'patrol'; s.rest = P.calm ?? 0; s.goal = null; } },
    stun(sec, now) { s.mode = 'stun'; s.until = now + sec * 1000; s.target = null; },
    // 被抓的結果：掙脫＝停 2 秒；沒掙脫＝他退到遠處（不會一復活又被抓）
    resolve(escaped, now, players) {
      if (escaped) return this.stun(P.stun, now);
      s.catches++; s.target = null; s.mode = 'patrol'; s.goal = null; s.exposed.clear();
      this.placeFar(players);
    },
    placeFar(players) { const best = farPoint(players); if (best) Object.assign(s, { x: best.x, z: best.z, zone: best.zone }); },
    noise(p) { if (s.mode === 'patrol' || s.mode === 'search') { s.mode = 'search'; s.goal = { x: p.x, z: p.z, zone: p.zone }; s.wait = 0; } },
    // 每一幀；players：[{ uid, zone, x, z, moving, running, hidden, holding, captured }]；回傳事件
    update(dt, players, now) {
      const out = [];
      if (s.mode === 'idle' || s.mode === 'grab') return out;
      if (s.mode === 'stun') { if (now < s.until) return out; s.mode = s.target ? 'chase' : 'patrol'; }
      s.idle += dt;
      if (s.mode === 'rest') { // 休息：慢慢走到離大家最遠的地方，看不到也聽不到
        s.rest -= dt;
        if (s.rest <= 0) { s.mode = 'patrol'; s.goal = null; s.hunt = P.hunt ?? 1e9; out.push({ type: 'hunt' }); return out; }
        if (!s.goal) s.goal = farPoint(players);
        if (s.goal) moveTo(s.goal, P.patrol * 0.8, dt);
        return out;
      }
      if (P.hunt && s.mode !== 'chase') { s.hunt -= dt; if (s.hunt <= 0) { s.mode = 'rest'; s.rest = P.rest; s.goal = null; s.target = null; s.seen = {}; out.push({ type: 'rest' }); return out; } }
      // 躲藏：剛躲進去的那一刻有沒有被看到
      for (const p of players) {
        if (p.hidden && !s.wasHidden[p.uid] && (sees(p, s.mode === 'chase' && s.target === p.uid))) s.exposed.add(p.uid);
        if (!p.hidden) s.exposed.delete(p.uid);
        s.wasHidden[p.uid] = p.hidden;
      }
      const visible = (p) => !p.captured && (!p.hidden || s.exposed.has(p.uid));
      // 躲著的人：他走到很近、你又沒屏息，一陣子就會被找到
      for (const p of players) {
        if (!p.hidden || p.captured || s.exposed.has(p.uid)) { s.near[p.uid] = 0; continue; }
        const close = p.zone === s.zone && Math.hypot(p.x - s.x, p.z - s.z) < 2.5 && !p.holding;
        s.near[p.uid] = close ? (s.near[p.uid] ?? 0) + dt : 0;
        if (s.near[p.uid] >= P.findHidden) { s.exposed.add(p.uid); s.mode = 'chase'; s.target = p.uid; out.push({ type: 'found', uid: p.uid }); }
      }
      if (s.mode !== 'chase') {
        // 看到 0.5 秒就發現
        for (const p of players) {
          if (visible(p) && sees(p, false)) s.seen[p.uid] = (s.seen[p.uid] ?? 0) + dt; else s.seen[p.uid] = 0;
          if (s.seen[p.uid] >= P.notice) { s.mode = 'chase'; s.target = p.uid; s.lost = 0; s.seen = {}; out.push({ type: 'spotted', uid: p.uid }); break; }
        }
      }
      if (s.mode === 'patrol' || s.mode === 'search') {
        // 聽到腳步聲
        for (const p of players) {
          if (!visible(p) || p.zone !== s.zone || p.holding || !p.moving) continue;
          const d = Math.hypot(p.x - s.x, p.z - s.z);
          if (d < (p.running ? P.hearRun : P.hearWalk)) { s.mode = 'search'; s.goal = { x: p.x, z: p.z, zone: p.zone }; s.wait = 0; }
        }
      }
      const speed = (s.mode === 'chase' ? P.chase : P.patrol) * speedMul();
      if (s.mode === 'chase') {
        const p = players.find((x) => x.uid === s.target);
        if (!p || p.captured) { s.mode = 'patrol'; s.target = null; return out; }
        if (visible(p) && sees(p, true)) { s.lost = 0; s.last = { x: p.x, z: p.z, zone: p.zone }; } else s.lost += dt;
        if (s.lost >= P.lose) { s.mode = 'search'; s.goal = s.last; s.target = null; s.wait = 0; out.push({ type: 'lost', uid: p.uid }); return out; }
        moveTo(visible(p) ? { x: p.x, z: p.z, zone: p.zone } : s.last ?? { x: p.x, z: p.z, zone: p.zone }, speed, dt);
        if (visible(p) && p.zone === s.zone && Math.hypot(p.x - s.x, p.z - s.z) < P.reach) { s.mode = 'grab'; s.idle = 0; out.push({ type: 'catch', uid: p.uid }); }
        return out;
      }
      // 巡邏／查看：走到目標，停一下，再挑下一個
      if (!s.goal) s.goal = patrolGoal(players);
      if (!s.goal) return out;
      if (moveTo(s.goal, speed, dt)) {
        s.wait += dt;
        if (s.wait > (s.mode === 'search' ? 3 : 1.5)) { s.mode = 'patrol'; s.goal = patrolGoal(players); s.wait = 0; }
      }
      return out;
    },
  };
}
