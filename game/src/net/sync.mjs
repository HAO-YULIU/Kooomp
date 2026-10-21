// 隊友位置的同步，用最少的訊息（docs/07-system.md 第 13 節 A＋B）：
//   送出：只在開始走、停下、轉彎、速度改變、換區域時送；走路時每 3 秒補一次校正。站著不動就不送。
//   收到：用最後收到的位置＋速度推算現在的位置，畫面再慢慢靠過去，不會一頓一頓。
//   區域：伺服器只把詳細位置轉給同一區的人（伺服器那邊處理），換區域時大家都會知道。

const TURN = (25 * Math.PI) / 180;     // 移動方向轉超過 25° 就送
const FACE = (40 * Math.PI) / 180;     // 站著時臉轉超過 40° 也送（隊友才看得到你在看哪裡）
const REFRESH = 3000;                  // 走路時多久補送一次
const MAX_PREDICT = 1.2;               // 最多往前推算幾秒

const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

export function createSender(send) {
  let last = null; // 上次送出的 { z, p, v, y, s, t }
  return {
    // 每一幀呼叫：p＝[x, z]、v＝[vx, vz]（每秒公尺）、y＝面向、z＝區域
    // h：第四幕的躲藏狀態（1＝躲著、2＝屏息，可以相加），改變時也要送（守夜人要知道）
    update({ z, p, v, y, h = 0 }, now = performance.now()) {
      const speed = Math.hypot(v[0], v[1]);
      const moving = speed > 0.15;
      let why = null;
      if (!last) why = 'first';
      else if (z !== last.z) why = 'zone';
      else if (h !== last.h) why = 'hide';
      else if (moving !== last.s) why = moving ? 'start' : 'stop';
      else if (moving && angDiff(Math.atan2(v[0], v[1]), Math.atan2(last.v[0], last.v[1])) > TURN) why = 'turn';
      else if (moving && Math.abs(speed - Math.hypot(...last.v)) > 0.6) why = 'speed';
      else if (!moving && angDiff(y, last.y) > FACE) why = 'face';
      else if (moving && now - last.t > REFRESH) why = 'refresh';
      if (!why) return null;
      last = { z, p: [...p], v: moving ? [...v] : [0, 0], y, s: moving, t: now, h };
      const msg = { t: 'pos', z, p: last.p.map((n) => +n.toFixed(2)), v: last.v.map((n) => +n.toFixed(2)), y: +y.toFixed(2), s: moving ? 1 : 0, ...(h ? { h } : {}) };
      send(msg);
      return why;
    },
    // 有隊友進到同一區、或有新隊友加入時，主動送一次讓他看到你
    resend() { if (last) { const l = last; last = null; this.update({ z: l.z, p: l.p, v: l.v, y: l.y, h: l.h }); } },
  };
}

export function createReceiver() {
  const peers = new Map(); // uid → { z, p, v, y, at, shown: [x, z], yShown }
  return {
    peers,
    onPos(msg, now = performance.now()) {
      const old = peers.get(msg.uid);
      peers.set(msg.uid, { z: msg.z, p: msg.p, v: msg.v ?? [0, 0], y: msg.y ?? 0, h: msg.h ?? 0, at: now, shown: old?.shown ?? [...msg.p], yShown: old?.yShown ?? msg.y ?? 0 });
    },
    onZone(uid, z) { const p = peers.get(uid); if (p) p.z = z; },
    remove(uid) { peers.delete(uid); },
    // 每一幀呼叫，回傳每個隊友要畫的位置
    update(dt, now = performance.now()) {
      for (const p of peers.values()) {
        const k = Math.min((now - p.at) / 1000, MAX_PREDICT);
        const tx = p.p[0] + p.v[0] * k, tz = p.p[1] + p.v[1] * k;
        const a = 1 - Math.exp(-dt * 8); // 每秒靠近八成，修正時不會瞬移
        p.shown[0] += (tx - p.shown[0]) * a; p.shown[1] += (tz - p.shown[1]) * a;
        p.yShown += Math.atan2(Math.sin(p.y - p.yShown), Math.cos(p.y - p.yShown)) * a;
      }
      return peers;
    },
  };
}
