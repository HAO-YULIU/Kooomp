// 機關的音效（帳號二）：全部用 Web Audio 當場合成，不用下載音檔。
// sfx('click' | 'tick' | 'stone' | 'gear' | 'chime' | 'note' | 'sand' | 'paper' | 'wood' | 'glass' | 'metal' | 'lever' | 'knock' | 'thud' | 'wrong' | 'solved' | 'whoosh', 參數)
let ctx = null, master = null, noiseBuf = null, volume = (() => { try { return +(localStorage.getItem('ml_volume') ?? 1); } catch { return 1; } })();
function audio() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.55 * volume; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
  if (ctx?.state === 'suspended') ctx.resume();
  return ctx;
}
addEventListener('pointerdown', () => audio(), { once: true }); // 瀏覽器要等玩家點過畫面才能出聲
addEventListener('keydown', () => audio(), { once: true });
/** 音量（0～1.5），設定裡調；存在這台裝置 */
export function setVolume(v) { volume = v; try { localStorage.setItem('ml_volume', String(v)); } catch { /* 無痕 */ } if (master) master.gain.value = 0.55 * v; if (amb.bus) amb.bus.gain.value = AMB_VOL * v; }
export const getVolume = () => volume;
// 一個音：頻率、波形、長度、音量、滑音
function tone(f, { type = 'sine', dur = 0.3, vol = 0.25, at = 0, slide = 0, attack = 0.005 } = {}) {
  const c = audio(); if (!c) return; const t0 = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}
// 一段雜音（過濾成石頭、沙子、紙的聲音）
function noise({ dur = 0.3, vol = 0.2, type = 'lowpass', freq = 800, q = 1, at = 0, sweep = 0 } = {}) {
  const c = audio(); if (!c) return; const t0 = c.currentTime + at;
  const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q; if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t0 + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master); src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
}
const PENT = [392, 440, 523, 587, 659, 784, 880]; // 五聲音階：連續按幾個音也好聽
const SOUNDS = {
  click: () => { tone(2400, { type: 'square', dur: 0.03, vol: 0.06 }); noise({ dur: 0.04, vol: 0.08, type: 'highpass', freq: 3000 }); },
  tick: () => tone(1800, { type: 'triangle', dur: 0.05, vol: 0.08 }),
  stone: () => noise({ dur: 0.5, vol: 0.18, freq: 300, q: 0.7, sweep: 0.6 }), // 石頭摩擦
  gear: () => { for (let i = 0; i < 5; i++) { tone(900 + i * 40, { type: 'square', dur: 0.03, vol: 0.05, at: i * 0.07 }); noise({ dur: 0.03, vol: 0.05, type: 'bandpass', freq: 2500, q: 3, at: i * 0.07 }); } },
  chime: (n = 0) => { const f = PENT[((n % PENT.length) + PENT.length) % PENT.length]; tone(f, { dur: 1.2, vol: 0.14 }); tone(f * 2, { dur: 0.8, vol: 0.05 }); },
  note: (n = 0) => tone(PENT[((n % PENT.length) + PENT.length) % PENT.length] / 2, { type: 'triangle', dur: 0.6, vol: 0.14 }),
  sand: () => noise({ dur: 0.9, vol: 0.06, type: 'bandpass', freq: 5000, q: 0.8 }),
  paper: () => noise({ dur: 0.18, vol: 0.12, type: 'highpass', freq: 1800, sweep: 2 }),
  wood: () => { tone(220, { type: 'triangle', dur: 0.08, vol: 0.15 }); noise({ dur: 0.06, vol: 0.1, type: 'bandpass', freq: 900, q: 2 }); },
  glass: () => { tone(2093, { dur: 0.5, vol: 0.06 }); tone(3136, { dur: 0.35, vol: 0.04, at: 0.01 }); },
  metal: () => { tone(330, { type: 'sawtooth', dur: 0.25, vol: 0.05, slide: 0.8 }); noise({ dur: 0.2, vol: 0.06, type: 'bandpass', freq: 1500, q: 4 }); },
  lever: () => { noise({ dur: 0.15, vol: 0.14, type: 'bandpass', freq: 700, q: 2 }); tone(140, { type: 'square', dur: 0.12, vol: 0.08, at: 0.1 }); },
  knock: (heavy) => { tone(heavy ? 90 : 120, { dur: heavy ? 0.35 : 0.18, vol: heavy ? 0.35 : 0.25, slide: 0.6 }); noise({ dur: 0.08, vol: 0.12, freq: 600 }); },
  thud: () => { tone(70, { dur: 0.5, vol: 0.3, slide: 0.5 }); noise({ dur: 0.3, vol: 0.1, freq: 200 }); },
  whoosh: () => noise({ dur: 0.45, vol: 0.12, type: 'bandpass', freq: 600, q: 0.8, sweep: 4 }),
  wrong: () => { tone(160, { type: 'sawtooth', dur: 0.35, vol: 0.08, slide: 0.7 }); tone(150, { type: 'sawtooth', dur: 0.35, vol: 0.06, at: 0.02, slide: 0.7 }); },
  solved: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: 1.4 - i * 0.2, vol: 0.12, at: i * 0.11 })); noise({ dur: 1.2, vol: 0.03, type: 'highpass', freq: 6000, at: 0.3 }); },
  hum: () => { tone(110, { dur: 1.5, vol: 0.08, attack: 0.3 }); tone(165, { dur: 1.5, vol: 0.05, attack: 0.3 }); },
};
export function sfx(name, arg) { try { SOUNDS[name]?.(arg); } catch { /* 沒有聲音也沒關係 */ } }

// ---------- 腳步聲：石地、木地板聲音不同；跑步重一點 ----------
let stepN = 0;
export function step(floor = 'stone', run = false) {
  const c = audio(); if (!c) return; stepN++;
  const v = run ? 0.16 : 0.1, p = 1 + (Math.random() - 0.5) * 0.15 + (stepN % 2 ? 0.04 : -0.04);
  if (floor === 'wood') { tone(110 * p, { type: 'triangle', dur: 0.09, vol: v * 0.9, slide: 0.7 }); noise({ dur: 0.07, vol: v * 0.6, type: 'bandpass', freq: 700 * p, q: 1.5 }); }
  else { noise({ dur: 0.06, vol: v, type: 'bandpass', freq: 1400 * p, q: 1.2 }); tone(75 * p, { dur: 0.07, vol: v * 0.7, slide: 0.6 }); }
}

// ---------- 環境音：每個區域一種，換區域時淡入淡出 ----------
// lake 碼頭的湖水與風｜fire 大廳、典禮廳的爐火｜hearth 交誼廳的小火爐｜clock 星盤廳的時鐘｜hush 長廊（雨聲另外有）｜library 圖書館的低鳴、翻紙｜drip 暗室、井室的水滴｜tower 鐘塔機械室的大鐘與齒輪｜roof 屋頂的風
const AMB_VOL = 0.5;
const amb = { bus: null, kind: null, layers: [], timer: null };
function bed({ type = 'lowpass', freq = 400, q = 0.7, vol = 0.1, lfo = 0, lfoDepth = 0 } = {}) { // 一直響的底噪（可以慢慢起伏）
  const c = audio(); const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(vol, c.currentTime + 1.5);
  src.connect(f).connect(g).connect(amb.bus); src.start(0, Math.random());
  let osc = null; if (lfo) { osc = c.createOscillator(); osc.frequency.value = lfo; const d = c.createGain(); d.gain.value = lfoDepth; osc.connect(d).connect(f.frequency); osc.start(); }
  return { stop() { const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 1.5); setTimeout(() => { src.stop(); osc?.stop(); }, 1700); } };
}
function drone(f, vol = 0.04) { const c = audio(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; o.type = 'sine'; g.gain.value = 0; g.gain.linearRampToValueAtTime(vol, c.currentTime + 2); o.connect(g).connect(amb.bus); o.start(); return { stop() { const t = c.currentTime; g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 1.5); setTimeout(() => o.stop(), 1700); } }; }
// 偶爾的聲音（劈啪、水滴、木頭吱嘎）：送到環境音的音量
function blip(kind) {
  const c = audio(); if (!c) return; const save = master; master = amb.bus; // 借用 tone／noise，聲音走環境音
  try {
    if (kind === 'crackle') for (let i = 0; i < 1 + Math.random() * 3; i++) noise({ dur: 0.02 + Math.random() * 0.03, vol: 0.05 + Math.random() * 0.08, type: 'highpass', freq: 1500 + Math.random() * 2500, at: Math.random() * 0.25 });
    if (kind === 'drip') { const f = 900 + Math.random() * 700; tone(f, { dur: 0.12, vol: 0.06, slide: 1.6 }); tone(f * 0.5, { dur: 0.5, vol: 0.015, at: 0.12 }); }
    if (kind === 'creak') tone(180 + Math.random() * 120, { type: 'sawtooth', dur: 0.6 + Math.random() * 0.6, vol: 0.012, slide: 0.8 + Math.random() * 0.4, attack: 0.2 });
    if (kind === 'tick') { tone(1300, { type: 'square', dur: 0.025, vol: 0.025 }); tone(1100, { type: 'square', dur: 0.025, vol: 0.02, at: 0.5 }); }
    if (kind === 'bigtick') { tone(260, { type: 'triangle', dur: 0.12, vol: 0.09 }); noise({ dur: 0.05, vol: 0.05, type: 'bandpass', freq: 1200, q: 3 }); }
    if (kind === 'page') noise({ dur: 0.25, vol: 0.025, type: 'highpass', freq: 2500, sweep: 1.6 });
    if (kind === 'bell') { tone(196, { dur: 3.5, vol: 0.03, attack: 0.01 }); tone(392 * 1.01, { dur: 2.5, vol: 0.012 }); }
    if (kind === 'water') noise({ dur: 0.8, vol: 0.03, freq: 500, q: 0.5, sweep: 0.5 });
    if (kind === 'gust') noise({ dur: 2.5, vol: 0.05, type: 'bandpass', freq: 500, q: 0.6, sweep: 1.8 });
  } finally { master = save; }
}
const PROFILES = {
  lake: { beds: [{ freq: 350, vol: 0.06, lfo: 0.15, lfoDepth: 150 }, { type: 'bandpass', freq: 700, q: 0.4, vol: 0.025, lfo: 0.07, lfoDepth: 300 }], blips: [['water', 2, 4], ['bell', 25, 40], ['gust', 8, 14]] },
  fire: { beds: [{ freq: 180, vol: 0.05 }], drones: [[55, 0.012]], blips: [['crackle', 0.15, 0.6], ['creak', 10, 20]] },
  hearth: { beds: [{ freq: 160, vol: 0.035 }], blips: [['crackle', 0.4, 1.4], ['creak', 12, 25]] },
  clock: { beds: [{ freq: 220, vol: 0.025 }], drones: [[73.4, 0.012]], blips: [['tick', 1, 1], ['creak', 14, 26]] },
  hush: { beds: [{ freq: 260, vol: 0.02 }], drones: [[49, 0.015]], blips: [['creak', 6, 14]] },
  library: { beds: [{ freq: 200, vol: 0.025 }], drones: [[55, 0.02], [82.4, 0.008]], blips: [['page', 5, 12], ['creak', 8, 16], ['drip', 9, 18]] },
  drip: { beds: [{ freq: 150, vol: 0.02 }], drones: [[41.2, 0.02]], blips: [['drip', 0.8, 3]] },
  tower: { beds: [{ freq: 300, vol: 0.03 }], drones: [[36.7, 0.03], [55, 0.01]], blips: [['bigtick', 1, 1], ['creak', 4, 9]] },
  roof: { beds: [{ type: 'bandpass', freq: 500, q: 0.5, vol: 0.06, lfo: 0.1, lfoDepth: 250 }], blips: [['gust', 3, 7]] },
};
/** 換環境音（null＝安靜）；同一種不重來 */
export function setAmbience(kind) {
  if (kind === amb.kind) return; const c = audio(); if (!c) return;
  if (!amb.bus) { amb.bus = c.createGain(); amb.bus.gain.value = AMB_VOL * volume; amb.bus.connect(c.destination); }
  for (const l of amb.layers) l.stop(); amb.layers = []; clearTimeout(amb.timer); amb.kind = kind;
  const P = PROFILES[kind]; if (!P) return;
  for (const b of P.beds ?? []) amb.layers.push(bed(b));
  for (const [f, v] of P.drones ?? []) amb.layers.push(drone(f, v));
  const next = {}; for (const [k, a, b] of P.blips ?? []) next[k] = c.currentTime + a + Math.random() * (b - a);
  const loop = () => { if (amb.kind !== kind) return; const now = c.currentTime; for (const [k, a, b] of P.blips ?? []) if (now >= next[k]) { blip(k); next[k] = now + a + Math.random() * (b - a); } amb.timer = setTimeout(loop, 100); };
  loop();
}
