// 聲音字幕（2026-10-30 製作人：可以在設定關掉，預設開）：手機靜音、聽不到聲音的人也知道發生了什麼。
// caption('cap.knock', { side }) 在畫面上方中間淡淡地顯示一行，2.4 秒後消失。every：同一種字幕最少隔幾秒。
import { t } from '../logic/i18n.mjs';

let box = null, timer = 0; const last = {};
export const captionsOn = () => { try { return localStorage.getItem('ml_captions') !== '0'; } catch { return true; } };
/** 聲音從哪一邊來（pan：右＋左－）→ 文字 */
export const sideWord = (pan = 0, behind = false) => t(`cap_side.${behind ? 'back' : pan > 0.45 ? 'right' : pan < -0.45 ? 'left' : 'mid'}`);
export function caption(key, vars = {}, { every = 0 } = {}) {
  if (typeof document === 'undefined' || !captionsOn()) return;
  const now = performance.now(); if (every && now - (last[key] ?? -1e9) < every * 1000) return; last[key] = now;
  if (!box) { box = document.createElement('div'); box.id = 'caption'; document.body.append(box); }
  box.textContent = t(key, vars); box.classList.add('on'); clearTimeout(timer); timer = setTimeout(() => box.classList.remove('on'), 2400);
}
