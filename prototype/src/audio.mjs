// 音效全部用 Web Audio 即時合成，不用音檔：低沉的環境聲、風聲、腳步、施咒、驚嚇。

let ctx = null, master = null;
export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
  ambience();
}
const noiseBuffer = () => {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
};
function ambience() {
  // 兩個略微走音的低頻＋濾過的雜訊當風聲
  for (const f of [55, 55.7, 82.4]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; g.gain.value = 0.05;
    o.connect(g).connect(master); o.start();
  }
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer(); n.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.6;
  const g = ctx.createGain(); g.gain.value = 0.05;
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 250;
  lfo.connect(lg).connect(bp.frequency); lfo.start();
  n.connect(bp).connect(g).connect(master); n.start();
}
export function step() {
  if (!ctx) return;
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500 + Math.random() * 200;
  const g = ctx.createGain(), t = ctx.currentTime;
  g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  n.connect(f).connect(g).connect(master); n.start(t, Math.random()); n.stop(t + 0.15);
}
export function chime(kind = 'lumen') {
  if (!ctx) return;
  const base = { lumen: 523.25, revela: 311.1, expel: 659.25, fail: 196 }[kind] || 440;
  const t = ctx.currentTime;
  [1, 1.5, 2, 3].forEach((m, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = kind === 'fail' ? 'sawtooth' : 'triangle'; o.frequency.value = base * m;
    g.gain.setValueAtTime(0, t + i * 0.06); g.gain.linearRampToValueAtTime(kind === 'fail' ? 0.05 : 0.12, t + i * 0.06 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 1.2);
    o.connect(g).connect(master); o.start(t + i * 0.06); o.stop(t + 1.4 + i * 0.06);
  });
}
export function scare() {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const f of [92, 97.5, 185, 370.5]) { // 不和諧的刺耳和弦
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.94, t + 1.2);
    g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.14, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    o.connect(g).connect(master); o.start(t); o.stop(t + 1.7);
  }
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer();
  const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  n.connect(g).connect(master); n.start(t); n.stop(t + 0.7);
}
export function blip() {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = 'sine'; o.frequency.value = 300 + Math.random() * 60;
  g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.06);
}
