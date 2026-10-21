// 咒語清單＋符文辨識（$1 單筆畫辨識法）＋揮動手機的動作判斷。
// 電腦（滑鼠畫）、手機直向魔杖模式（手指畫／揮）、掃 QR code 的魔杖手機，三種都共用這一份。

export const SPELLS = {
  lumen:  { id: 'lumen',  name: '光照咒', en: 'Lumen',  rune: '○', gesture: '揮一下', hint: '畫一個圓',   color: '#ffd27a' },
  revela: { id: 'revela', name: '顯影咒', en: 'Revela', rune: '△', gesture: '往前刺', hint: '畫一個三角形', color: '#ff5a5a' },
  expel:  { id: 'expel',  name: '退散咒', en: 'Expel',  rune: 'ϟ', gesture: '往上舉', hint: '畫一道閃電（Z 字）', color: '#9fd8ff' },
};

// ---------- $1 Unistroke Recognizer（精簡版） ----------
const N = 64, SIZE = 250, PHI = 0.5 * (-1 + Math.sqrt(5));
const ANGLE = (45 * Math.PI) / 180, STEP = (2 * Math.PI) / 180;

const pathLen = (p) => { let d = 0; for (let i = 1; i < p.length; i++) d += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); return d; };
function resample(pts) {
  const I = pathLen(pts) / (N - 1); let D = 0; const out = [{ ...pts[0] }]; const p = pts.map((q) => ({ ...q }));
  for (let i = 1; i < p.length; i++) {
    const d = Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    if (D + d >= I && d > 0) {
      const q = { x: p[i - 1].x + ((I - D) / d) * (p[i].x - p[i - 1].x), y: p[i - 1].y + ((I - D) / d) * (p[i].y - p[i - 1].y) };
      out.push(q); p.splice(i, 0, q); D = 0;
    } else D += d;
  }
  while (out.length < N) out.push({ ...p[p.length - 1] });
  return out.slice(0, N);
}
const centroid = (p) => p.reduce((c, q) => ({ x: c.x + q.x / p.length, y: c.y + q.y / p.length }), { x: 0, y: 0 });
function rotateBy(p, a) {
  const c = centroid(p), cos = Math.cos(a), sin = Math.sin(a);
  return p.map((q) => ({ x: (q.x - c.x) * cos - (q.y - c.y) * sin + c.x, y: (q.x - c.x) * sin + (q.y - c.y) * cos + c.y }));
}
function scaleTranslate(p) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const q of p) { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); }
  const w = Math.max(maxX - minX, 1e-3), h = Math.max(maxY - minY, 1e-3);
  const s = p.map((q) => ({ x: (q.x * SIZE) / w, y: (q.y * SIZE) / h }));
  const c = centroid(s); return s.map((q) => ({ x: q.x - c.x, y: q.y - c.y }));
}
function normalize(pts) {
  let p = resample(pts);
  const c = centroid(p); p = rotateBy(p, -Math.atan2(c.y - p[0].y, c.x - p[0].x));
  return scaleTranslate(p);
}
const pathDist = (a, b) => a.reduce((d, q, i) => d + Math.hypot(q.x - b[i].x, q.y - b[i].y), 0) / a.length;
function distAtBest(p, t) {
  let a = -ANGLE, b = ANGLE;
  let x1 = PHI * a + (1 - PHI) * b, f1 = pathDist(rotateBy(p, x1), t);
  let x2 = (1 - PHI) * a + PHI * b, f2 = pathDist(rotateBy(p, x2), t);
  while (Math.abs(b - a) > STEP) {
    if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = PHI * a + (1 - PHI) * b; f1 = pathDist(rotateBy(p, x1), t); }
    else { a = x1; x1 = x2; f1 = f2; x2 = (1 - PHI) * a + PHI * b; f2 = pathDist(rotateBy(p, x2), t); }
  }
  return Math.min(f1, f2);
}

// 範本：用程式畫出來，順時針、逆時針、不同起點都放進去
const poly = (corners, steps = 20) => {
  const out = [];
  for (let i = 0; i < corners.length - 1; i++)
    for (let s = 0; s < steps; s++) { const t = s / steps; out.push({ x: corners[i][0] + (corners[i + 1][0] - corners[i][0]) * t, y: corners[i][1] + (corners[i + 1][1] - corners[i][1]) * t }); }
  out.push({ x: corners.at(-1)[0], y: corners.at(-1)[1] });
  return out;
};
const circle = (start, dir) => Array.from({ length: 65 }, (_, i) => { const a = start + dir * (i / 64) * Math.PI * 2; return { x: Math.cos(a), y: Math.sin(a) }; });
const RAW = [];
for (const s of [-Math.PI / 2, 0, Math.PI / 2, Math.PI]) { RAW.push(['lumen', circle(s, 1)]); RAW.push(['lumen', circle(s, -1)]); }
const tri = [[0, -1], [0.9, 0.6], [-0.9, 0.6]];
for (let k = 0; k < 3; k++) {
  const c = [tri[k], tri[(k + 1) % 3], tri[(k + 2) % 3], tri[k]];
  RAW.push(['revela', poly(c)]); RAW.push(['revela', poly([...c].reverse())]);
}
const bolt = [[0.5, -1], [-0.5, -0.1], [0.5, 0.1], [-0.5, 1]];
RAW.push(['expel', poly(bolt)], ['expel', poly(bolt.map(([x, y]) => [-x, y]))]);
RAW.push(['expel', poly([[-0.6, -1], [0.6, -1], [-0.6, 1], [0.6, 1]])]); // Z 字也算
const TEMPLATES = RAW.map(([id, pts]) => ({ id, pts: normalize(pts) }));

/** 回傳 { id, score }；畫得太短或太不像就回傳 null */
export function recognize(points) {
  if (points.length < 8 || pathLen(points) < 60) return null;
  const p = normalize(points);
  let best = null, bestD = Infinity;
  for (const t of TEMPLATES) { const d = distAtBest(p, t.pts); if (d < bestD) { bestD = d; best = t.id; } }
  const score = 1 - bestD / (0.5 * Math.sqrt(2 * SIZE * SIZE));
  return score >= 0.78 ? { id: best, score } : null;
}

// ---------- 畫符文的畫布 ----------
/** 在 canvas 上用手指或滑鼠畫，放開時呼叫 onStroke(points) */
export function attachRuneCanvas(canvas, onStroke) {
  const ctx = canvas.getContext('2d');
  let pts = [], drawing = false, fade = [], raf = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const fit = () => { const r = canvas.getBoundingClientRect(); canvas.width = r.width * dpr; canvas.height = r.height * dpr; };
  fit(); const ro = new ResizeObserver(fit); ro.observe(canvas);
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }; };
  const down = (e) => { e.preventDefault(); canvas.setPointerCapture?.(e.pointerId); drawing = true; pts = [pos(e)]; };
  const move = (e) => { if (!drawing) return; e.preventDefault(); pts.push(pos(e)); };
  const up = () => { if (!drawing) return; drawing = false; if (pts.length) { fade.push({ pts, life: 1 }); onStroke(pts.map((q) => ({ ...q }))); } pts = []; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  let color = '#cfe6ff';
  const stroke = (p, a) => {
    if (p.length < 2) return;
    ctx.globalAlpha = a; ctx.lineCap = ctx.lineJoin = 'round';
    ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 24 * dpr; ctx.lineWidth = 7 * dpr;
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); for (const q of p) ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dpr; ctx.stroke();
  };
  const loop = () => {
    raf = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fade = fade.filter((f) => (f.life -= 0.025) > 0);
    for (const f of fade) stroke(f.pts, f.life);
    stroke(pts, 1); ctx.globalAlpha = 1;
  };
  loop();
  return { setColor: (c) => { color = c; }, destroy: () => { cancelAnimationFrame(raf); ro.disconnect(); } };
}

// ---------- 揮動手機（陀螺儀／加速度計） ----------
export async function requestMotionPermission() {
  const DM = window.DeviceMotionEvent;
  if (!DM) return 'unsupported';
  if (typeof DM.requestPermission === 'function') {
    try { return (await DM.requestPermission()) === 'granted' ? 'granted' : 'denied'; } catch { return 'denied'; }
  }
  return 'granted';
}

/**
 * 直向拿手機時：揮一下（快速轉動）→ 光照；往前刺（沿螢幕法線方向衝）→ 顯影；往上舉 → 退散。
 * 動作要短，因為揮手機時看不到螢幕。onGesture(id) 會在辨識到時被呼叫。
 */
export function watchGestures(onGesture, onAnyMotion) {
  let g = { x: 0, y: 0, z: 0 }, cool = 0, seen = false;
  const h = (e) => {
    const now = performance.now();
    let a = e.acceleration;
    const ag = e.accelerationIncludingGravity;
    if ((!a || a.x == null) && ag && ag.x != null) { // 沒有去重力的數值時，自己用低通濾波扣掉重力
      g = { x: g.x * 0.9 + ag.x * 0.1, y: g.y * 0.9 + ag.y * 0.1, z: g.z * 0.9 + ag.z * 0.1 };
      a = { x: ag.x - g.x, y: ag.y - g.y, z: ag.z - g.z };
    }
    if (!a || a.x == null) return;
    if (!seen) { seen = true; onAnyMotion?.(); }
    if (now < cool) return;
    const r = e.rotationRate || {};
    const rot = Math.max(Math.abs(r.alpha || 0), Math.abs(r.beta || 0), Math.abs(r.gamma || 0));
    let id = null;
    if (Math.abs(a.z) > 13 && rot < 260) id = 'revela';
    else if (a.y > 13 && rot < 260) id = 'expel';
    else if (rot > 320) id = 'lumen';
    if (id) { cool = now + 1300; onGesture(id); }
  };
  window.addEventListener('devicemotion', h);
  return () => window.removeEventListener('devicemotion', h);
}
