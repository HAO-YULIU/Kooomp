// 畫面上的覆蓋層：劇情對話框、謎題視窗。打開時第一人稱操作會暫停。
import { t, getLang } from '../logic/i18n.mjs';
import { SPEAKERS } from '../data/story-ch1.mjs';
import { CHARS, HOUSES } from '../logic/chars.mjs';

const $ = (id) => document.getElementById(id);
let pause = () => {}; // 由 main 設定：pause(true/false) 暫停／恢復操作
export const setPauseHandler = (f) => { pause = f; };
let openCount = 0;
const hold = () => { if (openCount++ === 0) pause(true); };
const release = () => { if (--openCount === 0) pause(false); };

// ---------- 劇情對話 ----------
const queue = []; let showing = false;
export function say(lines) { queue.push(...lines); if (!showing) next(); }
export const talking = () => showing;
function next() {
  const box = $('dialog');
  const line = queue.shift();
  if (!line) { if (showing) { showing = false; box.hidden = true; release(); } return; }
  if (!showing) { showing = true; hold(); }
  const [who, zh, en] = line;
  const sp = who ? (SPEAKERS[who] ?? CHARS[who]) : null;
  box.hidden = false;
  $('dialog-who').textContent = sp ? sp[getLang()] : '';
  const color = CHARS[who] ? HOUSES[CHARS[who].house].color : '#d9cdb8';
  $('dialog-who').style.color = color;
  $('dialog-text').textContent = getLang() === 'en' ? en : zh;
  $('dialog-text').classList.toggle('narration', !who);
}
export function advanceDialog() { if (showing) next(); }

// ---------- 謎題視窗 ----------
let current = null;
export function openPanel(title, build) {
  closePanel();
  hold();
  const panel = $('panel'); panel.hidden = false;
  $('panel-title').textContent = title;
  const body = $('panel-body'); body.innerHTML = '';
  current = { onClose: null };
  build(body, current);
  return current;
}
export function closePanel() {
  if (!current) return;
  current.onClose?.(); current = null;
  $('panel').hidden = true; $('panel-body').innerHTML = '';
  release();
}
export const panelOpen = () => !!current;
$('panel-close').onclick = closePanel;
$('dialog').onclick = advanceDialog;

// 小工具：建立元素
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e[k] = v; else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
}
export const L = (o) => (o ? o[getLang()] ?? o.zh : '');
export { t };
