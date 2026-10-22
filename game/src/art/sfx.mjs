// 機關的音效（帳號二）：全部用 Web Audio 當場合成，不用下載音檔。
// sfx('click' | 'tick' | 'stone' | 'gear' | 'chime' | 'note' | 'sand' | 'paper' | 'wood' | 'glass' | 'metal' | 'lever' | 'knock' | 'thud' | 'wrong' | 'solved' | 'whoosh', 參數)
let ctx = null, master = null, noiseBuf = null;
function audio() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
  return ctx;
}
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
