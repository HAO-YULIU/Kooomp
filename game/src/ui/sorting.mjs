// 分院鏡的問答（P01）：8 題，每個選項對應一個學院，得分最高的學院就是結果（同分時取先達到的）。
import { openPanel, closePanel, el, t } from './overlay.mjs';
import { getLang } from '../logic/i18n.mjs';
import { SORTING, SORTING_HOUSES } from '../data/story-ch1.mjs';
import { HOUSES } from '../logic/chars.mjs';

export function openSorting(onDone) {
  const k = getLang() === 'en' ? 1 : 0;
  const score = Object.fromEntries(SORTING_HOUSES.map((h) => [h, 0]));
  const reached = {}; // 學院 → 達到目前分數是第幾題（同分時，先達到的贏）
  openPanel(t('sorting'), (body) => {
    const show = (i) => {
      body.innerHTML = '';
      if (i >= SORTING.length) {
        const best = Math.max(...Object.values(score));
        const house = SORTING_HOUSES.filter((h) => score[h] === best).sort((a, b) => reached[a] - reached[b])[0];
        const H = HOUSES[house], L = getLang();
        const res = el('div', { class: 'mirror-result', style: `--hc:${H.color}` },
          el('i', { class: 'sigil', text: H.sigil }), el('b', { text: `${H[L]}！` }), el('small', { text: H.motto[L] }), el('small', { class: 'power', text: H.power[L] }));
        body.append(res);
        setTimeout(() => { closePanel(); onDone(house); }, 2600);
        return;
      }
      const q = SORTING[i];
      body.append(el('div', { class: 'mirror-steps' }, ...SORTING.map((_, j) => el('i', { class: j < i ? 'done' : j === i ? 'on' : '' }))), el('p', { class: 'mirror-q', text: q.q[k] }));
      q.a.forEach((opt, j) => body.append(el('button', { class: 'choice', text: opt[k], onclick: () => {
        const h = SORTING_HOUSES[j]; score[h]++; reached[h] = i;
        show(i + 1);
      } })));
    };
    show(0);
  });
}
