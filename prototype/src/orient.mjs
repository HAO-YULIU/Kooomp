// 手機方向：一般遊玩強制橫向，魔杖模式強制直向。
// Android 在全螢幕時可以真的鎖方向；iPhone 鎖不了，就蓋一層「請轉成○向」的提示。

export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
export const isPortrait = () => window.innerHeight > window.innerWidth;

let want = 'landscape', overlay = null, listeners = [];

export function initOrientation(el) {
  overlay = el;
  const upd = () => { refresh(); listeners.forEach((f) => f(current())); };
  window.addEventListener('resize', upd);
  screen.orientation?.addEventListener?.('change', upd);
  refresh();
}
export const current = () => (isPortrait() ? 'portrait' : 'landscape');
export const wanted = () => want;
export const isRight = () => !isTouch || current() === want;
export const onOrientation = (f) => listeners.push(f);

/** 在使用者點擊之後呼叫才有效（全螢幕與鎖定都需要使用者的動作） */
export async function enterFullscreen() {
  if (!isTouch) return;
  const de = document.documentElement;
  try { if (!document.fullscreenElement && de.requestFullscreen) await de.requestFullscreen({ navigationUI: 'hide' }); } catch {}
  await lock();
}
async function lock() {
  try { await screen.orientation?.lock?.(want); } catch {} // iPhone、沒有全螢幕時會失敗，改靠提示
}

export function requireOrientation(mode, { text, onCancel } = {}) {
  want = mode; lock();
  if (overlay) {
    overlay.querySelector('[data-text]').textContent = text || (mode === 'landscape' ? '請把手機轉成橫向' : '請把手機轉成直向');
    overlay.dataset.mode = mode;
    const btn = overlay.querySelector('[data-cancel]');
    btn.hidden = !onCancel; btn.onclick = onCancel || null;
  }
  refresh();
}
function refresh() {
  if (!overlay) return;
  overlay.hidden = isRight();
}
