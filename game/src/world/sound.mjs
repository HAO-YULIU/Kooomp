// 音效（Web Audio）：雨聲、守夜人的童謠（音樂盒）、呼吸聲、尖叫、提示音。
// 瀏覽器要等玩家點過畫面才能出聲，所以第一次用到時才建立 AudioContext。
let ctx = null, master = null;
const ac = () => {
  if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};
addEventListener('pointerdown', () => { try { ac(); } catch { /* 沒有音效也能玩 */ } }, { once: true });

// ---------- 雨聲（濾過的雜訊，一直循環） ----------
let rain = null;
export function setRain(on) {
  try { ac(); } catch { return; }
  if (on && !rain) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const g = ctx.createGain(); g.gain.value = 0.0; g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.5);
    src.connect(lp).connect(g).connect(master); src.start();
    rain = { src, g };
  } else if (!on && rain) {
    const r = rain; rain = null;
    r.g.gain.cancelScheduledValues(ctx.currentTime); r.g.gain.setValueAtTime(r.g.gain.value, ctx.currentTime);
    r.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2); setTimeout(() => r.src.stop(), 300);
  }
}

// ---------- 守夜人的童謠（docs/06-audio-ch1.md）：音樂盒音色 ----------
// 簡譜 → 頻率（A 小調：6̣＝A3）
const NOTE = { '6.': 220, '7.': 207.65 /* 升 Sol（G♯3），讓結尾不安 */, 1: 261.63, 2: 293.66, 3: 329.63, 5: 392 };
const MELODY = [['3', '2', '1', '6.', '3', '2', '3'], ['3', '5', '3', '2', '1', '2', '6.'], ['1', '2', '3', '5', '3', '2', '1'], ['6.', '1', '2', '3', '2', '7.', '6.']];
const RHYTHM = [1, 0.5, 0.5, 1, 1, 0.5, 1]; // 長、短、短、長、長、短、長（拍）
export function playLullaby({ lines = 4, volume = 0.25, beat = 1 } = {}) {
  try { ac(); } catch { return 0; }
  let t = ctx.currentTime + 0.1;
  for (let l = 0; l < lines; l++) {
    MELODY[l].forEach((n, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = NOTE[n] * 2;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(volume, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      o.connect(g).connect(master); o.start(t); o.stop(t + 1.3);
      t += RHYTHM[i] * beat;
    });
    t += 0.5 * beat;
  }
  return t - ctx.currentTime;
}

// ---------- 檔案音效（呼吸聲） ----------
const cache = new Map();
async function load(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => r.arrayBuffer()).then((b) => ac().decodeAudioData(b)).catch(() => null));
  return cache.get(url);
}
export async function playFile(url, { volume = 0.6, loop = false } = {}) {
  try { ac(); } catch { return null; }
  const buf = await load(url); if (!buf) return null;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = loop;
  const g = ctx.createGain(); g.gain.value = volume; src.connect(g).connect(master); src.start();
  return { stop: () => { try { src.stop(); } catch { /* 已停止 */ } } };
}

// ---------- 合成音效 ----------
export function scream() {
  try { ac(); } catch { return; }
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain(), o2 = ctx.createOscillator();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(260, t + 0.8);
  o2.type = 'square'; o2.frequency.setValueAtTime(1350, t); o2.frequency.exponentialRampToValueAtTime(180, t + 0.8);
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  o.connect(g); o2.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 1);
}
export function chime(up = true) {
  try { ac(); } catch { return; }
  const t = ctx.currentTime;
  [0, 0.12].forEach((d, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = up ? [660, 990][i] : [440, 330][i];
    g.gain.setValueAtTime(0.18, t + d); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.6);
    o.connect(g).connect(master); o.start(t + d); o.stop(t + d + 0.7);
  });
}
