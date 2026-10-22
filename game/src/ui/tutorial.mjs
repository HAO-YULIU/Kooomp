// 新手教學（2026-10-22 製作人）：第一次進遊戲自動出現，設定裡可以重看。電腦、手機的說明不同。
import { openPanel, closePanel, el, t } from './overlay.mjs';

const KEY = 'ml_tutorial_seen';
export const tutorialSeen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

export function openTutorial({ touch }) {
  const steps = t(touch ? 'tut_touch' : 'tut_pc').split('||').map((s) => s.split('|')); // 每一步：圖示|標題|說明
  let i = 0;
  openPanel(t('tut_title'), (body) => {
    const show = () => {
      body.innerHTML = '';
      const [icon, head, text] = steps[i];
      body.append(
        el('div', { class: 'tut-dots' }, ...steps.map((_, k) => el('i', { class: k === i ? 'on' : k < i ? 'done' : '' }))),
        el('div', { class: 'tut-icon', text: icon }),
        el('h3', { class: 'tut-head', text: head }),
        el('p', { class: 'tut-text', text }),
        el('div', { class: 'row tut-nav' },
          el('button', { text: t('tut_prev'), onclick: () => { i--; show(); } }),
          el('button', { class: 'primary small', text: i === steps.length - 1 ? t('tut_go') : t('tut_next'), onclick: () => {
            if (i < steps.length - 1) { i++; show(); return; }
            try { localStorage.setItem(KEY, '1'); } catch { /* 無痕模式 */ }
            closePanel();
          } })));
      if (i === 0) body.querySelector('.tut-nav button').disabled = true;
    };
    show();
  });
}
