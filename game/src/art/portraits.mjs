// 肖像畫（帳號二）：油畫風格的畫像，給長廊（corridor.mjs）用。
// paintPortrait(kind, seed) → canvas。跟原本 corridor.mjs 的 paint() 一樣的種類，異常的差別保持一樣明顯：
//   normal 一般／empty 空的畫框（只有背景）／pose 人往旁邊移／back 背對／nopupil 沒有瞳孔（「眼睛跟著你」用，瞳孔另外畫）
//   liana 莉安娜（蒼白、張嘴、紅字「回去」）／gouged 臉被挖掉
// 眼睛固定在畫面寬 38%／62%、高 34% 的位置（corridor.mjs 的活瞳孔畫在那裡）。
const Wd = 256, Ht = 332;
const rand = (seed) => { seed = (Math.abs(Math.floor(Math.sin(seed * 12.9898) * 43758.5453 * 1000)) % 2147483646) + 1; const f = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; f(); f(); f(); return f; }; // 先把種子打散，相鄰的號碼才會畫出不一樣的人
const ROBES = ['#2a3a6a', '#5a1a1e', '#3a2410', '#123322', '#2a2a30', '#3a1a40'];

function strokes(g, r, x0, y0, w, h, colors, n, len = 14, width = 3) { // 一堆短短的筆觸
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w, y = y0 + r() * h, a = (r() - 0.5) * 1.2 - 0.6;
    g.strokeStyle = colors[Math.floor(r() * colors.length)]; g.lineWidth = width * (0.6 + r() * 0.8); g.globalAlpha = 0.18 + r() * 0.25;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
  }
  g.globalAlpha = 1;
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16), c = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`; }

export function paintPortrait(kind, seed) {
  const c = document.createElement('canvas'); c.width = Wd; c.height = Ht;
  const g = c.getContext('2d'), r = rand(seed * 977 + 13);
  // 背景：深色、上面亮一點（舊油畫的光）
  const hue = Math.floor(r() * 360), bg = g.createRadialGradient(Wd * 0.5, Ht * 0.3, 10, Wd * 0.5, Ht * 0.45, Ht * 0.75);
  bg.addColorStop(0, `hsl(${hue}, 20%, 24%)`); bg.addColorStop(1, `hsl(${hue}, 25%, 6%)`);
  g.fillStyle = bg; g.fillRect(0, 0, Wd, Ht);
  strokes(g, r, 0, 0, Wd, Ht, [`hsl(${hue},20%,20%)`, `hsl(${hue},15%,10%)`], 220, 22, 5);
  if (kind !== 'empty') {
    const dx = kind === 'pose' ? Wd * 0.2 : 0, cx = Wd * 0.5 + dx, eyeY = Ht * 0.34, faceR = Wd * (0.155 + r() * 0.03);
    const h = (k) => { const v = Math.sin(seed * 91.17 + k * 47.3) * 43758.5453; return v - Math.floor(v); };
    const style = Math.floor(h(1) * 3), glasses = h(2) < 0.22, beard = h(3) < 0.2; // 髮型（短、長、盤起）、眼鏡、鬍子（每一項各自打散）
    const robe = ROBES[Math.floor(r() * ROBES.length)], hairHue = Math.floor(r() * 40), hairL = 8 + r() * 40, hair = `hsl(${hairHue}, 35%, ${hairL}%)`;
    // 肩膀、袍子
    g.fillStyle = robe; g.beginPath(); g.ellipse(cx, Ht * 1.02, Wd * 0.42, Ht * 0.36, 0, Math.PI, 0); g.fill();
    strokes(g, r, cx - Wd * 0.4, Ht * 0.68, Wd * 0.8, Ht * 0.32, [shade(robe, 1.4), shade(robe, 0.6)], 120, 18, 4);
    g.fillStyle = '#d8d0bc'; g.beginPath(); g.moveTo(cx - 18, Ht * 0.66); g.lineTo(cx, Ht * 0.76); g.lineTo(cx + 18, Ht * 0.66); g.fill(); // 白領子
    // 脖子
    const skin = kind === 'liana' ? '#c8d0d2' : `hsl(${24 + r() * 8}, ${35 + r() * 10}%, ${58 + r() * 14}%)`;
    g.fillStyle = shade('#000000', 1); g.fillStyle = skin; g.fillRect(cx - faceR * 0.38, eyeY + faceR * 0.9, faceR * 0.76, Ht * 0.14);
    if (kind === 'back') { // 背對：只看到後腦勺的頭髮
      g.fillStyle = hair; g.beginPath(); g.ellipse(cx, eyeY + faceR * 0.1, faceR * 1.05, faceR * 1.3, 0, 0, Math.PI * 2); g.fill();
      strokes(g, r, cx - faceR, eyeY - faceR * 1.2, faceR * 2, faceR * 2.6, [shade('#000000', 1), `hsl(${hairHue},30%,${hairL + 10}%)`], 90, 16, 2);
    } else {
      // 臉：亮的一邊、暗的一邊
      const fg = g.createRadialGradient(cx - faceR * 0.35, eyeY - faceR * 0.1, 4, cx, eyeY + faceR * 0.2, faceR * 1.4);
      fg.addColorStop(0, skin); fg.addColorStop(1, kind === 'liana' ? '#7a8488' : `hsl(20, 30%, 26%)`);
      g.fillStyle = fg; g.beginPath(); g.ellipse(cx, eyeY + faceR * 0.25, faceR, faceR * 1.3, 0, 0, Math.PI * 2); g.fill();
      // 頭髮
      g.fillStyle = hair; g.beginPath(); g.ellipse(cx, eyeY - faceR * 0.55, faceR * 1.08, faceR * 0.75, 0, Math.PI, 0); g.fill();
      if (style === 1) { // 長髮：垂到肩膀
        for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * faceR * 0.95, eyeY + faceR * 0.9, faceR * 0.3, faceR * 1.6, sx * -0.08, 0, Math.PI * 2); g.fill(); }
      } else if (style === 2) { // 盤起來的髮髻
        g.beginPath(); g.arc(cx, eyeY - faceR * 1.25, faceR * 0.45, 0, Math.PI * 2); g.fill();
      } else for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * faceR * 0.95, eyeY + faceR * 0.1, faceR * 0.18, faceR * 0.6, sx * -0.1, 0, Math.PI * 2); g.fill(); }
      strokes(g, r, cx - faceR, eyeY - faceR * 1.2, faceR * 2, faceR * 0.8, [`hsl(${hairHue},30%,${hairL + 12}%)`], 40, 12, 2);
      if (kind === 'gouged') { // 臉被挖掉：一個黑紅色的洞
        g.fillStyle = '#3a0000'; g.beginPath(); g.ellipse(cx, eyeY + faceR * 0.3, faceR * 0.78, faceR, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#100000'; g.beginPath(); g.ellipse(cx, eyeY + faceR * 0.35, faceR * 0.5, faceR * 0.68, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#5a0a0a'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); const a = r() * Math.PI * 2; g.moveTo(cx + Math.cos(a) * faceR * 0.6, eyeY + faceR * 0.3 + Math.sin(a) * faceR * 0.8); g.lineTo(cx + Math.cos(a) * faceR, eyeY + faceR * 0.3 + Math.sin(a) * faceR * 1.25); g.stroke(); }
      } else {
        // 眉毛、眼睛（眼白＋瞳孔）、鼻子的影子、嘴
        const ex = [Wd * 0.38 + dx, Wd * 0.62 + dx];
        g.strokeStyle = shade('#000000', 1); g.strokeStyle = `hsl(${hairHue},30%,${Math.max(5, hairL - 5)}%)`; g.lineWidth = 3;
        for (const x of ex) { g.beginPath(); g.moveTo(x - 11, eyeY - 10); g.quadraticCurveTo(x, eyeY - 14, x + 11, eyeY - 9); g.stroke(); }
        for (const x of ex) {
          g.fillStyle = kind === 'liana' ? '#e8eef0' : '#d8d0c0'; g.beginPath(); g.ellipse(x, eyeY, 9, 4.5, 0, 0, Math.PI * 2); g.fill();
          if (kind !== 'nopupil') { g.fillStyle = kind === 'liana' ? '#000' : '#2a1a10'; g.beginPath(); g.arc(x, eyeY, 3.6, 0, Math.PI * 2); g.fill(); }
        }
        if (glasses) { g.strokeStyle = '#b8a060'; g.lineWidth = 1.6; for (const x of ex) { g.beginPath(); g.arc(x, eyeY, 10, 0, Math.PI * 2); g.stroke(); } g.beginPath(); g.moveTo(ex[0] + 10, eyeY); g.lineTo(ex[1] - 10, eyeY); g.stroke(); }
        if (beard && kind !== 'liana') { g.fillStyle = hair; g.beginPath(); g.ellipse(cx, eyeY + faceR * 1.15, faceR * 0.62, faceR * 0.5, 0, 0, Math.PI); g.fill(); }
        g.fillStyle = 'rgba(60,30,20,0.35)'; g.beginPath(); g.moveTo(cx + 2, eyeY + 6); g.lineTo(cx + 7, eyeY + 26); g.lineTo(cx - 3, eyeY + 28); g.fill();
        if (kind === 'liana') { // 張著嘴
          g.fillStyle = '#000'; g.beginPath(); g.ellipse(cx, eyeY + 44, 9, 14, 0, 0, Math.PI * 2); g.fill();
        } else { g.strokeStyle = '#6a3028'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - 10, eyeY + 42); g.quadraticCurveTo(cx, eyeY + 44, cx + 10, eyeY + 42); g.stroke(); }
      }
      strokes(g, r, cx - faceR, eyeY - faceR * 0.5, faceR * 2, faceR * 2.2, ['rgba(255,220,190,1)', 'rgba(90,50,40,1)'], 50, 8, 2);
    }
    if (kind === 'liana') { g.fillStyle = '#b00'; g.font = `bold ${Wd * 0.17}px serif`; g.textAlign = 'center'; g.fillText('回去', Wd / 2, Ht * 0.93); }
  }
  // 舊油畫：泛黃的亮油、龜裂紋、四角變暗
  g.fillStyle = 'rgba(120,90,30,0.12)'; g.fillRect(0, 0, Wd, Ht);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.7;
  for (let i = 0; i < 40; i++) { let x = r() * Wd, y = r() * Ht; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  const vg = g.createRadialGradient(Wd / 2, Ht / 2, Ht * 0.3, Wd / 2, Ht / 2, Ht * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = vg; g.fillRect(0, 0, Wd, Ht);
  return c;
}
