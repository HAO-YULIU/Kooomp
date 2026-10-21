// 魔杖：在畫面上畫符文施咒（電腦用滑鼠、手機用手指）。辨識沿用技術雛形的 prototype/src/spells.mjs。
// 揮動手機施咒、手機掃 QR code 當魔杖之後由帳號二接進來。
import { recognize, attachRuneCanvas, SPELLS } from '../../../prototype/src/spells.mjs';
import { openPanel, closePanel, el, t } from './overlay.mjs';
import { isTouch, requireOrientation } from '../../../prototype/src/orient.mjs';

export function openWand(onCast) {
  // 手機：拿出魔杖時轉成直向，收起來再轉回橫向
  if (isTouch) {
    document.querySelector('#rotate [data-cancel]').textContent = t('wand_cancel');
    requireOrientation('portrait', { text: t('rotate_portrait'), onCancel: () => closePanel() });
  }
  openPanel(t('wand_title'), (body, panel) => {
    const msg = el('p', { class: 'p-status' });
    const canvas = el('canvas', { class: 'rune-canvas' });
    body.append(el('p', { class: 'dim', text: t('wand_help') }), canvas, msg);
    requestAnimationFrame(() => {
      const pad = attachRuneCanvas(canvas, (pts) => {
        const r = recognize(pts);
        if (!r) { msg.textContent = t('wand_none'); return; }
        pad.setColor(SPELLS[r.id].color);
        if (r.id === 'lumen') { msg.textContent = t('wand_lumen'); setTimeout(() => { closePanel(); onCast('lumen'); }, 500); }
        else msg.textContent = t('wand_none');
      });
      panel.onClose = () => { pad.destroy(); if (isTouch) requireOrientation('landscape', { text: t('rotate_landscape') }); };
    });
  });
}
