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
export function setVolume(v) { volume = v; try { localStorage.setItem('ml_volume', String(v)); } catch { /* 無痕 */ } if (master) master.gain.value = 0.55 * v; if (amb.bus) amb.bus.gain.value = AMB_VOL * v; if (M.bus) M.bus.gain.value = MUS_VOL * v; }
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
  // 驚嚇：一聲重擊＋刺耳的不和諧高音＋往下掉的呼嘯
  stinger: () => { tone(48, { dur: 1.4, vol: 0.45, slide: 0.5 }); noise({ dur: 0.5, vol: 0.25, freq: 900, sweep: 0.3 }); for (const f of [1175, 1245, 1661]) tone(f, { type: 'sawtooth', dur: 1.3, vol: 0.035, slide: 0.85, attack: 0.02 }); noise({ dur: 1.6, vol: 0.08, type: 'bandpass', freq: 3000, q: 2, sweep: 0.2, at: 0.05 }); },
  // 耳語：幾段很短的「嘶—」，像有人在耳邊講話，左右飄
  whisper: () => { for (let i = 0; i < 7; i++) { const at = i * 0.28 + Math.random() * 0.2; noise({ dur: 0.18 + Math.random() * 0.25, vol: 0.3, type: 'bandpass', freq: 2200 + Math.random() * 2600, q: 3, at, sweep: 0.7 + Math.random() * 0.6 }); } },
  heartbeat: () => { tone(62, { dur: 0.22, vol: 0.4, slide: 0.6 }); tone(55, { dur: 0.22, vol: 0.28, slide: 0.6, at: 0.24 }); },
  hum: () => { tone(110, { dur: 1.5, vol: 0.08, attack: 0.3 }); tone(165, { dur: 1.5, vol: 0.05, attack: 0.3 }); },
};
// ---------- 真的音檔（製作人之後補）：assets/audio/sfx/list.json 列出有哪些，有就用音檔、沒有就用上面合成的 ----------
// 清單與檔名見 docs/09-audio-wishlist.md。同一種聲音可以有好幾個檔（step_stone_1、step_stone_2…），每次隨機挑一個
const FILES = {}; let filesLoaded = false;
async function loadFiles() {
  if (filesLoaded) return; filesLoaded = true;
  try {
    const list = await (await fetch('assets/audio/sfx/list.json')).json(); const c = audio(); if (!c) return;
    await Promise.all(list.map(async (f) => { try { const buf = await c.decodeAudioData(await (await fetch(`assets/audio/sfx/${f}`)).arrayBuffer()); const key = f.replace(/\.(mp3|ogg|wav)$/, '').replace(/_\d+$/, ''); (FILES[key] ??= []).push(buf); } catch { /* 這個檔有問題：用合成的 */ } }));
  } catch { /* 沒有清單：全部用合成的 */ }
  if (M.kind && FILES[`music_${M.kind}`]) { const k = M.kind; M.kind = null; setMusic(k); } // 配樂的音檔到了：換成音檔
}
addEventListener('pointerdown', () => loadFiles(), { once: true });
/** 播一個音檔（有的話）；回傳有沒有播 */
function playFile(key, { vol = 1, rate = 1, loop = false, dest = null, pan = 0 } = {}) {
  const list = FILES[key]; const c = audio(); if (!list?.length || !c) return null;
  const src = c.createBufferSource(); src.buffer = list[Math.floor(Math.random() * list.length)]; src.loop = loop; src.playbackRate.value = rate;
  const g = c.createGain(); g.gain.value = vol; let node = src.connect(g);
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
  node.connect(dest ?? master); src.start(); return { src, g };
}
export function sfx(name, arg) { try { if (playFile(name, { rate: 0.95 + Math.random() * 0.1 })) return; SOUNDS[name]?.(arg); } catch { /* 沒有聲音也沒關係 */ } }

// ---------- 腳步聲：石地、木地板聲音不同；跑步重一點 ----------
let stepN = 0;
export function step(floor = 'stone', run = false) {
  const c = audio(); if (!c) return; stepN++;
  if (playFile(`step_${floor}`, { vol: run ? 0.9 : 0.6, rate: 0.95 + Math.random() * 0.1 })) return;
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
  lake: { file: 'amb_lake', beds: [{ freq: 350, vol: 0.06, lfo: 0.15, lfoDepth: 150 }, { type: 'bandpass', freq: 700, q: 0.4, vol: 0.025, lfo: 0.07, lfoDepth: 300 }], blips: [['water', 2, 4], ['bell', 25, 40], ['gust', 8, 14]] },
  fire: { file: 'amb_fire', beds: [{ freq: 180, vol: 0.05 }], drones: [[55, 0.012]], blips: [['crackle', 0.15, 0.6], ['creak', 10, 20]] },
  hearth: { file: 'amb_fire', beds: [{ freq: 160, vol: 0.035 }], blips: [['crackle', 0.4, 1.4], ['creak', 12, 25]] },
  clock: { file: 'amb_castle', beds: [{ freq: 220, vol: 0.025 }], drones: [[73.4, 0.012]], blips: [['tick', 1, 1], ['creak', 14, 26]] },
  hush: { file: 'amb_castle', beds: [{ freq: 260, vol: 0.02 }], drones: [[49, 0.015]], blips: [['creak', 6, 14]] },
  library: { file: 'amb_castle', beds: [{ freq: 200, vol: 0.025 }], drones: [[55, 0.02], [82.4, 0.008]], blips: [['page', 5, 12], ['creak', 8, 16], ['drip', 9, 18]] },
  drip: { file: 'amb_drip', beds: [{ freq: 150, vol: 0.02 }], drones: [[41.2, 0.02]], blips: [['drip', 0.8, 3]] },
  tower: { file: 'amb_clocktower', beds: [{ freq: 300, vol: 0.03 }], drones: [[36.7, 0.03], [55, 0.01]], blips: [['bigtick', 1, 1], ['creak', 4, 9]] },
  roof: { file: 'amb_wind', beds: [{ type: 'bandpass', freq: 500, q: 0.5, vol: 0.06, lfo: 0.1, lfoDepth: 250 }], blips: [['gust', 3, 7]] },
};
/** 換環境音（null＝安靜）；同一種不重來 */
export function setAmbience(kind) {
  if (kind === amb.kind) return; const c = audio(); if (!c) return;
  if (!amb.bus) { amb.bus = c.createGain(); amb.bus.gain.value = AMB_VOL * volume; amb.bus.connect(c.destination); }
  for (const l of amb.layers) l.stop(); amb.layers = []; clearTimeout(amb.timer); amb.kind = kind;
  const P = PROFILES[kind]; if (!P) return;
  const file = P.file && playFile(P.file, { loop: true, dest: amb.bus, vol: 0 }); // 有錄好的環境音就用它當底
  if (file) { file.g.gain.linearRampToValueAtTime(P.fileVol ?? 0.6, c.currentTime + 1.5); amb.layers.push({ stop() { const t = c.currentTime; file.g.gain.setValueAtTime(file.g.gain.value, t); file.g.gain.linearRampToValueAtTime(0, t + 1.5); setTimeout(() => file.src.stop(), 1700); } }); }
  else for (const b of P.beds ?? []) amb.layers.push(bed(b));
  for (const [f, v] of P.drones ?? []) amb.layers.push(drone(f, v));
  const next = {}; for (const [k, a, b] of P.blips ?? []) next[k] = c.currentTime + a + Math.random() * (b - a);
  const loop = () => { if (amb.kind !== kind) return; const now = c.currentTime; for (const [k, a, b] of P.blips ?? []) if (now >= next[k]) { blip(k); next[k] = now + a + Math.random() * (b - a); } amb.timer = setTimeout(loop, 100); };
  loop();
}

// ---------- 守夜人的聲音：越近越大聲、分左右；平常低沉的呼吸，追人時低吼加重，剛發現你時嘶吼一聲，腳步一步一步重重踩下 ----------
const W = { on: false, breath: null, growl: null, panner: null, bus: null, mode: null, stepT: 0, roarAt: 0 };
function wardenNodes() {
  const c = audio(); if (!c || W.bus) return;
  W.bus = c.createGain(); W.bus.gain.value = 0; W.panner = c.createStereoPanner ? c.createStereoPanner() : null;
  (W.panner ? W.bus.connect(W.panner) : W.bus).connect(master);
  const file = playFile('warden_breath', { loop: true, dest: W.bus, vol: 0.9 });
  if (!file) { // 合成的呼吸：濾過的雜訊，一吸一吐（0.3 Hz）
    const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 1.4;
    const g = c.createGain(); g.gain.value = 0.25; const lfo = c.createOscillator(); lfo.frequency.value = 0.32; const d = c.createGain(); d.gain.value = 0.22; lfo.connect(d).connect(g.gain); lfo.start();
    src.connect(f).connect(g).connect(W.bus); src.start();
  }
  // 低吼：兩個不和諧的低音＋顫動
  const g2 = c.createGain(); g2.gain.value = 0; g2.connect(W.bus); W.growl = g2;
  for (const fr of [55, 58.3]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; const trem = c.createOscillator(); trem.frequency.value = 7; const td = c.createGain(); td.gain.value = 6; trem.connect(td).connect(o.frequency); trem.start(); o.connect(lp).connect(g2); o.start(); }
}
/** 每一格：守夜人在哪（跟玩家的距離、在玩家左邊還右邊 −1～1）、狀態 */
export function wardenVoice({ visible, dist = 99, side = 0, mode = 'patrol', dt = 0.016 }) {
  if (!visible && !W.bus) return; // 還沒出場：不用建立聲音
  const c = audio(); if (!c) return; wardenNodes(); if (!W.bus) return;
  const near = visible ? Math.max(0, 1 - dist / 18) : 0, k = near * near;
  W.bus.gain.setTargetAtTime(k * 0.9, c.currentTime, 0.2);
  if (W.panner) W.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, side)) * 0.8, c.currentTime, 0.1);
  W.growl.gain.setTargetAtTime(mode === 'chase' || mode === 'grab' ? 0.12 : mode === 'search' ? 0.05 : 0.015, c.currentTime, 0.3);
  // 剛開始追：嘶吼（10 秒內不重複）
  if (visible && mode === 'chase' && W.mode !== 'chase' && c.currentTime > W.roarAt) {
    W.roarAt = c.currentTime + 10;
    if (!playFile('warden_roar', { vol: 0.3 + k })) { tone(140, { type: 'sawtooth', dur: 1.2, vol: 0.12 * (0.4 + k), slide: 0.45, attack: 0.05 }); noise({ dur: 1.1, vol: 0.12 * (0.4 + k), type: 'bandpass', freq: 900, q: 1.2, sweep: 0.4 }); }
  }
  W.mode = mode;
  // 腳步：走 0.7 秒一步、跑 0.38 秒一步
  if (visible && mode !== 'idle' && mode !== 'stun' && mode !== 'grab') {
    W.stepT -= dt;
    if (W.stepT <= 0) { W.stepT = mode === 'chase' ? 0.38 : 0.7; if (k > 0.02 && !playFile('warden_step', { vol: k * 1.2, rate: 0.9 + Math.random() * 0.1 })) { tone(48, { dur: 0.35, vol: 0.4 * k, slide: 0.6 }); noise({ dur: 0.15, vol: 0.12 * k, freq: 260 }); } }
  }
}

// ---------- 配樂：主選單（陰森的長音＋偶爾一兩個音樂盒的音）、被追（低音的脈動＋心跳，越近越快越大聲） ----------
// 有音檔（music_menu、music_chase）就用音檔；被追的音檔一樣會照緊張程度調大小聲
const MUS_VOL = 0.45;
const M = { want: null, kind: null, bus: null, mix: null, high: null, layers: [], timer: 0, k: 0, next: 0, beat: 0, file: null };
const BOX = [220, 261.63, 293.66, 329.63, 392, 207.65]; // 守夜人童謠的音（A 小調，最後那個升 Sol 讓人不安）
function musicNodes() {
  const c = audio(); if (!c) return null;
  if (!M.bus) { M.bus = c.createGain(); M.bus.gain.value = MUS_VOL * volume; M.bus.connect(c.destination); }
  return c;
}
function stopMusic() {
  clearTimeout(M.timer); M.kind = null;
  for (const l of M.layers) l.stop(); M.layers = []; M.file = null; M.mix = null; M.high = null;
}
// 一層持續的聲音：fade 秒淡入，stop() 淡出
function pad(c, dest, build, fade = 3) {
  const g = c.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(1, c.currentTime + fade); g.connect(dest);
  const nodes = build(g);
  return { g, stop() { const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 2); setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch { /* 已停 */ } }), 2200); } };
}
// 在配樂的音量上播 tone／noise（跟環境音一樣借用）
function onMusic(fn) { const save = master; master = M.mix; try { fn(); } finally { master = save; } }
/** 換配樂：'menu'｜'chase'｜null（安靜）。玩家還沒點過畫面時先記著，點了才開始 */
export function setMusic(kind) {
  M.want = kind ?? null;
  if (!ctx) return; // 還不能出聲
  if (M.want === M.kind) return;
  stopMusic(); if (!M.want) return;
  const c = musicNodes(); if (!c) return; M.kind = M.want;
  M.mix = c.createGain(); M.mix.gain.value = kind === 'chase' ? 0 : 1; M.mix.connect(M.bus);
  M.layers.push({ stop: ((mix) => () => { const t = c.currentTime; mix.gain.setTargetAtTime(0, t, 0.6); setTimeout(() => mix.disconnect(), 3000); })(M.mix) });
  const file = playFile(`music_${kind}`, { loop: true, dest: M.mix, vol: 0.8 });
  if (file) { M.file = file; M.layers.push({ stop: () => setTimeout(() => { try { file.src.stop(); } catch { /* 已停 */ } }, 2500) }); return; }
  if (kind === 'menu') {
    // 兩組慢慢飄的低音（A 小調的 A、E 加上一點點走音），經過低通讓它悶悶的
    M.layers.push(pad(c, M.mix, (g) => {
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(g);
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05; const ld = c.createGain(); ld.gain.value = 260; lfo.connect(ld).connect(lp.frequency); lfo.start();
      const os = [[55, 0.05], [82.4, 0.03], [110.6, 0.02], [164.8, 0.012]].map(([f, v]) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 14; const og = c.createGain(); og.gain.value = v; o.connect(og).connect(lp); o.start(); return o; });
      return [lfo, ...os];
    }, 5));
    M.next = c.currentTime + 4;
    const loop = () => { // 偶爾一個音樂盒的音，帶一點回音
      if (M.kind !== 'menu') return;
      if (c.currentTime >= M.next) { const f = BOX[Math.floor(Math.random() * BOX.length)] * 2; onMusic(() => { tone(f, { type: 'triangle', dur: 2.2, vol: 0.05 }); tone(f, { type: 'triangle', dur: 1.8, vol: 0.018, at: 0.42 }); tone(f, { type: 'triangle', dur: 1.4, vol: 0.007, at: 0.84 }); }); M.next = c.currentTime + 2.5 + Math.random() * 6; }
      M.timer = setTimeout(loop, 200);
    };
    loop();
  }
  if (kind === 'chase') {
    // 底下的低鳴＋兩個打架的高音（越緊張越大聲，由 setTension 調）
    const low = pad(c, M.mix, (g) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 36.7; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; const og = c.createGain(); og.gain.value = 0.12; o.connect(lp).connect(og).connect(g); o.start(); return [o]; }, 1);
    const high = pad(c, M.mix, (g) => [1174.7, 1244.5].map((f) => { const o = c.createOscillator(); o.frequency.value = f; const og = c.createGain(); og.gain.value = 0.012; const tr = c.createOscillator(); tr.frequency.value = 9 + Math.random() * 3; const td = c.createGain(); td.gain.value = 0.008; tr.connect(td).connect(og.gain); tr.start(); o.connect(og).connect(g); o.start(); return [o, tr]; }).flat(), 1);
    M.high = high; M.layers.push(low, high);
    M.next = c.currentTime + 0.1; M.beat = c.currentTime + 0.2; let n = 0;
    const PAT = [73.4, 73.4, 77.8, 73.4, 73.4, 69.3, 73.4, 82.4]; // D、D、降 E、D…半音來回，聽起來被逼著跑
    const loop = () => {
      if (M.kind !== 'chase') return;
      const k = M.k, ahead = c.currentTime + 0.25;
      if (k > 0.05) {
        const step = 60 / (96 + 84 * k) / 2; // 八分音符：越緊張越快
        while (M.next < ahead) { const at = Math.max(0, M.next - c.currentTime), f = PAT[n++ % PAT.length]; onMusic(() => { tone(f, { type: 'sawtooth', dur: step * 0.9, vol: 0.05 + 0.08 * k, at }); if (n % 4 === 1) noise({ dur: 0.08, vol: 0.03 + 0.06 * k, freq: 160, at }); }); M.next += step; }
        const beatGap = 60 / (70 + 90 * k); // 心跳
        while (M.beat < ahead) { const at = Math.max(0, M.beat - c.currentTime); onMusic(() => { tone(60, { dur: 0.2, vol: 0.12 + 0.3 * k, slide: 0.6, at }); tone(52, { dur: 0.22, vol: 0.08 + 0.2 * k, slide: 0.6, at: at + 0.22 }); }); M.beat += beatGap; }
      } else { M.next = M.beat = ahead; }
      M.timer = setTimeout(loop, 60);
    };
    loop();
  }
}
/** 被追的緊張程度 0～1（守夜人越近、在追你就越高）；配樂跟著變大聲、變快 */
export function setTension(k) {
  M.k = Math.max(0, Math.min(1, k));
  if (M.kind !== 'chase' || !M.mix) return; const c = audio();
  M.mix.gain.setTargetAtTime(M.file ? M.k : 0.25 + 0.75 * M.k, c.currentTime, 0.4);
  M.high?.g.gain.setTargetAtTime(M.k * M.k, c.currentTime, 0.4);
}
addEventListener('pointerdown', () => { if (M.want) setMusic(M.want); }); // 點過畫面才能出聲：補開
addEventListener('keydown', () => { if (M.want && !M.kind) setMusic(M.want); });
