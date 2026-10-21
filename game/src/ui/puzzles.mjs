// 第 2 批的謎題畫面：P02、P03～P08。作答都送到伺服器判斷，這裡沒有答案。
import { openPanel, closePanel, el, L, t } from './overlay.mjs';
import { errText, getLang } from '../logic/i18n.mjs';
import { RUMORS } from '../data/world-ch1.mjs';
import { MORSE_TABLE, RUNE_ROWS } from '../data/story-ch1.mjs';
import { HOUSES } from '../logic/chars.mjs';

const ZODIAC = [
  ['aries', '♈', '牡羊', 'Aries'], ['taurus', '♉', '金牛', 'Taurus'], ['gemini', '♊', '雙子', 'Gemini'], ['cancer', '♋', '巨蟹', 'Cancer'],
  ['leo', '♌', '獅子', 'Leo'], ['virgo', '♍', '處女', 'Virgo'], ['libra', '♎', '天秤', 'Libra'], ['scorpio', '♏', '天蠍', 'Scorpio'],
  ['sagittarius', '♐', '射手', 'Sagittarius'], ['capricorn', '♑', '摩羯', 'Capricorn'], ['aquarius', '♒', '水瓶', 'Aquarius'], ['pisces', '♓', '雙魚', 'Pisces'],
];

// ctx：{ conn, state, notes, heard（聽過的傳聞）, revealed（施過光照咒的東西）, toast, onSolved }
export function openPuzzle(pid, thing, ctx) {
  const builder = BUILD[thing.panel ?? pid];
  if (!builder) return;
  openPanel(L(thing.label), (body, panel) => {
    const solved = ctx.state.solved.includes(pid);
    const status = el('p', { class: 'p-status' });
    const submit = async (value) => {
      status.textContent = '…';
      const r = await ctx.conn.request({ t: 'answer', pid, value });
      if (r.t === 'error') { status.textContent = errText(r.error, { s: Math.ceil((r.wait ?? 0) / 1000) }); return r; }
      if (r.solved) { status.textContent = t('p_solved'); ctx.onSolved(pid, r); setTimeout(closePanel, 900); }
      else status.textContent = t('wrong');
      return r;
    };
    if (solved) body.append(el('p', { class: 'p-done', text: t('p_already') }));
    builder(body, { ...ctx, submit, solved, pid });
    body.append(status);
    body.append(hintBox(pid, ctx));
    panel.onClose = null;
  });
}

// 三張提示（全隊共用）
function hintBox(pid, ctx) {
  const list = el('ol', { class: 'hints' });
  const paint = () => { list.innerHTML = ''; for (const h of ctx.state.hints?.[pid] ?? []) list.append(el('li', { text: h })); };
  paint();
  const btn = el('button', { class: 'small', text: t('hint_btn'), onclick: async () => {
    const r = await ctx.conn.request({ t: 'hint', pid });
    if (r.t === 'error') return ctx.toast(errText(r.error));
    (ctx.state.hints[pid] ??= []).push(r.text); paint();
  } });
  return el('div', { class: 'hint-box' }, btn, list);
}

const numberInput = (submit, ph = '') => {
  const inp = el('input', { inputmode: 'numeric', maxlength: '4', placeholder: ph, class: 'num' });
  const go = el('button', { text: t('answer'), onclick: () => submit(inp.value.trim()) });
  inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') go.click(); };
  return el('div', { class: 'row' }, inp, go);
};

const BUILD = {
  // P02：整理傳聞
  P02(body, { heard, submit }) {
    body.append(el('p', { text: t('p02_intro') }));
    const ul = el('ul', { class: 'rumors' });
    const got = [...heard].sort();
    if (!got.length) ul.append(el('li', { class: 'dim', text: t('p02_none') }));
    for (const i of got) for (const half of RUMORS[i]) ul.append(el('li', { text: L(half) }));
    body.append(ul, el('p', { text: t('p02_ask') }));
    const inputs = [0, 1, 2].map((i) => el('input', { placeholder: `${t('p02_ph')} ${i + 1}`, onkeydown: (e) => e.stopPropagation() }));
    body.append(el('div', { class: 'row' }, ...inputs), el('button', { text: t('answer'), onclick: () => submit(inputs.map((x) => x.value.trim())) }));
  },

  // P03：艾爾德林的星座鎖（要先用光照咒照出門上的詩）
  P03(body, { revealed, submit }) {
    if (!revealed.has('lock_eldrin')) {
      body.append(el('p', { class: 'dim', text: t('p03_blank') }));
    } else {
      body.append(el('blockquote', { text: t('p03_poem') }));
    }
    const grid = el('div', { class: 'zodiac' });
    for (const [id, sym, zh, en] of ZODIAC) grid.append(el('button', { onclick: () => submit(id) }, el('b', { text: sym }), el('small', { text: getLang() === 'en' ? en : zh })));
    body.append(el('p', { text: t('p03_ask') }), grid);
  },

  // P04：格里莫瓦的符文鎖
  P04(body, { submit }) {
    body.append(el('p', { text: t('p04_door') }), el('div', { class: 'rune-big', text: 'ᛁ' }));
    body.append(numberInput(submit, '?'));
  },
  runechart(body, { submit }) {
    body.append(el('p', { text: t('p04_note') }));
    const table = el('div', { class: 'runes' });
    RUNE_ROWS.forEach((row, r) => {
      table.append(el('span', { class: 'aett', text: t(`p04_aett_${r}`) }));
      for (const c of row) table.append(el('span', { class: c ? 'rune' : 'rune burnt', text: c ?? '▒' }));
    });
    body.append(table, el('p', { text: t('p04_door') }), numberInput(submit, '?'));
  },

  // P05：貝爾蒙特的獵物天平
  P05(body, { submit, state }) {
    body.append(el('p', { text: t('p05_scale') }));
    const solo = state.mode === 'solo';
    body.append(el('p', { class: 'dim', text: solo ? t('p05_push_solo') : t('p05_push') }));
    body.append(el('blockquote', { text: t('p05_plaque') }), numberInput(submit, '?'));
  },

  // P06：烏洛波斯的沙漏（時間加快：遊戲 1 分鐘＝現實 1 秒）
  P06(body, { submit }) {
    body.append(el('p', { text: t('p06_intro') }));
    const SEC = 1000; // 遊戲 1 分鐘幾毫秒
    const glasses = { 7: { top: 0, bot: 7 }, 11: { top: 0, bot: 11 } };
    let actions = [], startAt = 0, timer = 0, now = 0;
    const view = el('div', { class: 'hourglasses' });
    const clock = el('div', { class: 'p06-clock' });
    const draw = () => {
      view.innerHTML = '';
      for (const g of [7, 11]) {
        const s = glasses[g];
        view.append(el('div', { class: 'glass' },
          el('div', { class: 'sand-top', style: `height:${(s.top / g) * 50}px` }),
          el('div', { class: 'neck' }),
          el('div', { class: 'sand-bot', style: `height:${(s.bot / g) * 50}px` }),
          el('small', { text: `${g} ${t('minutes')}` }),
          el('button', { class: 'small', text: t('flip'), onclick: () => act('flip', [g]) })));
      }
      clock.textContent = startAt ? t('p06_elapsed') : t('p06_ready');
    };
    const tick = () => {
      const m = (performance.now() - startAt) / SEC; const d = m - now; now = m;
      for (const g of [7, 11]) { const s = glasses[g]; const run = Math.min(s.top, d); s.top -= run; s.bot += run; }
      draw();
    };
    const act = (a, g) => {
      if (!startAt) { startAt = performance.now(); now = 0; timer = setInterval(tick, 100); }
      tick();
      const tm = +now.toFixed(2);
      if (a === 'flip') for (const k of g) { const s = glasses[k]; [s.top, s.bot] = [s.bot, s.top]; }
      actions.push(a === 'knock' ? { t: tm, a } : { t: tm, a, g });
      draw();
      if (a === 'knock') { clearInterval(timer); finish(); }
    };
    const snap = (x) => Math.round(x); // 敲門／翻轉的時間對齊到整分（沙漏剛好漏完的那一刻）
    const finish = async () => {
      const sent = actions.map((x) => ({ ...x, t: snap(x.t) }));
      const r = await submit(sent);
      if (!r?.solved) reset();
    };
    const reset = () => { clearInterval(timer); startAt = 0; now = 0; actions = []; glasses[7] = { top: 0, bot: 7 }; glasses[11] = { top: 0, bot: 11 }; draw(); };
    body.append(view, clock,
      el('div', { class: 'row' },
        el('button', { text: t('flip_both'), onclick: () => act('flip', [7, 11]) }),
        el('button', { text: t('knock'), onclick: () => act('knock') }),
        el('button', { class: 'small', text: t('reset'), onclick: reset })));
    draw();
  },

  // P07：電腦控制的同伴用燭光（摩斯密碼）傳來時辰
  async P07(body, { conn, submit, state }) {
    body.append(el('p', { text: t('p07_intro') }));
    const r = await conn.request({ t: 'peek', pid: 'P07' });
    const morse = r.content?.morse ?? {};
    const inputs = {};
    for (const [h, codes] of Object.entries(morse)) {
      const lamp = el('span', { class: 'candle' });
      const play = el('button', { class: 'small', text: t('p07_watch'), onclick: () => blink(lamp, codes) });
      inputs[h] = el('input', { inputmode: 'numeric', maxlength: '2', class: 'num', onkeydown: (e) => e.stopPropagation() });
      body.append(el('div', { class: 'row tower' }, el('b', { text: HOUSES[h][getLang()], style: `color:${HOUSES[h].color}` }), lamp, play, inputs[h]));
    }
    const table = el('div', { class: 'morse' });
    for (const [d, c] of MORSE_TABLE) table.append(el('span', { text: `${d}  ${c.replace(/\./g, '・').replace(/-/g, '－')}` }));
    body.append(el('p', { class: 'dim', text: t('p07_table') }), table,
      el('button', { text: t('answer'), onclick: () => submit(Object.fromEntries(Object.entries(inputs).map(([h, i]) => [h, +i.value]))) }));
    if (!Object.keys(morse).length) body.append(el('p', { class: 'dim', text: t('p07_none') }));
    void state;
  },

  // P08：星盤對位
  P08(body, { submit }) {
    body.append(el('p', { text: t('p08_intro') }), el('blockquote', { text: t('p08_inscription') }));
    const rows = [0, 1, 2, 3].map((i) => {
      const house = el('select', {}, el('option', { value: '', text: '—' }), ...Object.entries(HOUSES).map(([k, v]) => el('option', { value: k, text: v[getLang()] })));
      const hour = el('select', {}, ...Array.from({ length: 12 }, (_, k) => el('option', { value: String(k + 1), text: String(k + 1) })));
      return { house, hour, row: el('div', { class: 'row' }, el('span', { class: 'ring', text: t(`p08_ring_${i}`) }), house, hour) };
    });
    body.append(...rows.map((r) => r.row),
      el('button', { text: t('answer'), onclick: () => submit(rows.map((r) => `${r.house.value}:${r.hour.value}`).join(',')) }));
  },
};

// 燭光閃爍：長＝－，短＝・
function blink(lamp, codes) {
  if (lamp.dataset.on) return;
  lamp.dataset.on = '1';
  const seq = [];
  codes.forEach((code, i) => {
    for (const c of code) seq.push([1, c === '-' ? 900 : 300], [0, 300]);
    seq.push([0, i < codes.length - 1 ? 1500 : 0]);
  });
  let i = 0;
  const step = () => {
    if (i >= seq.length) { delete lamp.dataset.on; lamp.classList.remove('lit'); return; }
    const [on, ms] = seq[i++]; lamp.classList.toggle('lit', !!on); setTimeout(step, ms);
  };
  step();
}

// P02 用：玩家走到長桌旁時記下聽到的傳聞
export function rumorText(i) { return RUMORS[i].map(L).join(' '); }
