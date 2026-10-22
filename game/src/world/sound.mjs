// 音效（Web Audio）：雨聲、守夜人的童謠（音樂盒）、呼吸聲、尖叫、提示音。
// 瀏覽器要等玩家點過畫面才能出聲，所以第一次用到時才建立 AudioContext。
let ctx = null, master = null;
const ac = () => {
  if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.8 * (() => { try { return +(localStorage.getItem('ml_volume') ?? 1); } catch { return 1; } })(); master.connect(ctx.destination); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};
addEventListener('pointerdown', () => { try { ac(); } catch { /* 沒有音效也能玩 */ } }, { once: true });
/** 設定裡的音量（雨聲、童謠、呼吸聲、尖叫也跟著） */
export function setSoundVolume(v) { try { ac(); master.gain.value = 0.8 * v; } catch { /* 沒有音效 */ } }

// ---------- 雨聲（有製作人給的音檔就用音檔，沒有就用濾過的雜訊；一直循環） ----------
let rain = null, rainBuf = null;
const RAIN_URL = 'assets/audio/sfx/amb_rain.mp3';
addEventListener('pointerdown', () => { try { load(RAIN_URL).then((b) => { rainBuf = b; }); } catch { /* 沒有就用合成的 */ } }, { once: true });
export function setRain(on) {
  try { ac(); } catch { return; }
  if (on && !rain) {
    let buf = rainBuf;
    if (!buf) { buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = rainBuf ? 6000 : 1400;
    const g = ctx.createGain(); g.gain.value = 0.0; g.gain.linearRampToValueAtTime(rainBuf ? 0.3 : 0.06, ctx.currentTime + 1.5);
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
// reverse：倒著播；rate：速度（0.5＝慢一倍，音也會變低）——P15 的留聲水晶用
export async function playFile(url, { volume = 0.6, loop = false, reverse = false, rate = 1 } = {}) {
  try { ac(); } catch { return null; }
  let buf = await load(url); if (!buf) return null;
  if (reverse) {
    const rev = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) rev.getChannelData(ch).set(Float32Array.from(buf.getChannelData(ch)).reverse());
    buf = rev;
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = loop; src.playbackRate.value = rate;
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

// S2 聽音辨位：黑根「心臟」的跳動聲，從某個方向傳來（0＝正前方，順時針的角度）。
// 左右用聲道，前後用音色（後面的比較悶）；沒戴耳機時只聽得出大小聲
export function heartbeatFrom(deg, { beats = 4, volume = 0.7 } = {}) {
  try { ac(); } catch { return; }
  const rad = (deg * Math.PI) / 180, pan = ctx.createStereoPanner(), lp = ctx.createBiquadFilter();
  pan.pan.value = Math.sin(rad); lp.type = 'lowpass'; lp.frequency.value = Math.cos(rad) > 0 ? 1800 : 450;
  lp.connect(pan).connect(master);
  let t = ctx.currentTime + 0.05;
  for (let i = 0; i < beats; i++, t += 0.85) for (const [k, dt] of [[1, 0], [0.7, 0.22]]) { // 咚—咚
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(70, t + dt); o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.18);
    g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(volume * k, t + dt + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.25);
    o.connect(g).connect(lp); o.start(t + dt); o.stop(t + dt + 0.3);
  }
}
