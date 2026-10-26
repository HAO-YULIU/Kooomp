// 第 2 批的謎題畫面：P02、P03～P08。作答都送到伺服器判斷，這裡沒有答案。
import { openPanel, closePanel, el, L, LP, t } from './overlay.mjs';
import { errText, getLang } from '../logic/i18n.mjs';
import { RUMORS } from '../data/world-ch1.mjs';
import { MORSE_TABLE, RUNE_ROWS } from '../data/story-ch1.mjs';
import { ROSTER, SURVIVORS, BOOK_RULE, FLIP_PAGES, TRIGRAMS, RUNES, RUNE_DOOR, LIGHT_GRID, SOKOBAN, VIALS, SKETCH, BRAILLE } from '../data/library-ch1.mjs';
import { playFile, heartbeatFrom } from '../world/sound.mjs';
import { LEVERS, BOLTS_LOCKED, GEAR_RACK, AXLE_GAPS, LYRIC, LYRIC_MARKS } from '../data/act4-ch1.mjs';
import { HOUSES } from '../logic/chars.mjs';

const ZODIAC = [
  ['aries', '♈', '牡羊', 'Aries'], ['taurus', '♉', '金牛', 'Taurus'], ['gemini', '♊', '雙子', 'Gemini'], ['cancer', '♋', '巨蟹', 'Cancer'],
  ['leo', '♌', '獅子', 'Leo'], ['virgo', '♍', '處女', 'Virgo'], ['libra', '♎', '天秤', 'Libra'], ['scorpio', '♏', '天蠍', 'Scorpio'],
  ['sagittarius', '♐', '射手', 'Sagittarius'], ['capricorn', '♑', '摩羯', 'Capricorn'], ['aquarius', '♒', '水瓶', 'Aquarius'], ['pisces', '♓', '雙魚', 'Pisces'],
];

// 場景反應：視窗裡的操作送給場景裡的機關（art/react.mjs），例如沙漏翻轉、星盤轉環
let react = () => {};
// ctx：{ conn, state, notes, heard（聽過的傳聞）, revealed（施過光照咒的東西）, toast, onSolved, react }
export function openPuzzle(pid, thing, ctx) {
  const builder = BUILD[thing.panel ?? pid];
  if (!builder) return;
  react = ctx.react ?? (() => {});
  openPanel(L(thing.label), (body, panel) => {
    const solved = ctx.state.solved.includes(pid);
    const status = el('p', { class: 'p-status' });
    const submit = async (value) => {
      status.textContent = '…';
      const r = await ctx.conn.request({ t: 'answer', pid, value });
      if (r.t === 'error') { status.textContent = errText(r.error, { s: Math.ceil((r.wait ?? 0) / 1000) }); return r; }
      if (r.solved) { status.textContent = t('p_solved'); ctx.fx?.('solved'); ctx.onSolved(pid, r); setTimeout(closePanel, 1400); } // 多停一下，看得到場景裡的金光
      else { status.textContent = t('wrong'); ctx.fx?.('wrong'); }
      return r;
    };
    if (solved) body.append(el('p', { class: 'p-done', text: t('p_already') }));
    const main = el('div'); body.append(main, status); // 內容要等伺服器回覆的題目，也會排在狀態與提示上面
    builder(main, { ...ctx, submit, solved, pid, panel }); // 畫面可以設定 panel.onClose（關掉時要停的計時器）
    if (!NO_HINTS.has(pid) && !INFO_PANELS.has(thing.panel)) body.append(hintBox(pid, ctx));
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
  const inp = el('input', { inputmode: 'numeric', maxlength: '4', placeholder: ph, class: 'num', oninput: () => react('digits', { v: inp.value }) });
  const go = el('button', { text: t('answer'), onclick: () => submit(inp.value.trim()) });
  inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') go.click(); };
  return el('div', { class: 'row' }, inp, go);
};

// 沒有提示的題目（西里爾的抉擇）、只是看資料的畫面（不放提示）
const NO_HINTS = new Set(['P22']);
const INFO_PANELS = new Set(['roster', 'notice', 'trigrams', 'sketch', 'crystalball', 'brailletable']);
const RUNES6 = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ'];

const BUILD = {
  // P02：整理傳聞
  P02(body, { heard, submit }) {
    body.append(el('p', { text: t('p02_intro') }));
    const ul = el('ul', { class: 'rumors' });
    const got = [...heard].sort();
    if (!got.length) ul.append(el('li', { class: 'dim', text: t('p02_none') }));
    for (const i of got) for (const half of RUMORS[i]) ul.append(el('li', { text: LP(half) }));
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
    ZODIAC.forEach(([id, sym, zh, en], i) => grid.append(el('button', { onclick: () => { react('zodiac', { i }); submit(id); } }, el('b', { text: sym }), el('small', { text: getLang() === 'en' ? en : zh }))));
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
      react('sand', { 7: { ...glasses[7] }, 11: { ...glasses[11] } });
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
      if (a === 'flip') { for (const k of g) { const s = glasses[k]; [s.top, s.bot] = [s.bot, s.top]; } react('flip', { g }); }
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
    const reset = () => { clearInterval(timer); startAt = 0; now = 0; actions = []; glasses[7] = { top: 0, bot: 7 }; glasses[11] = { top: 0, bot: 11 }; react('reset'); draw(); };
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
      const play = el('button', { class: 'small', text: t('p07_watch'), onclick: () => blink(lamp, codes, (on) => react('blink', { house: h, on })) });
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

  // P10：創辦人畫像的鎖（方向＋年份）
  P10(body, { submit }) {
    body.append(el('p', { text: t('p10_intro') }), el('p', { class: 'dim', text: t('p10_dir') }));
    let dir = '';
    const grid = el('div', { class: 'compass' });
    for (const d of ['NW', 'N', 'NE', 'W', '', 'E', 'SW', 'S', 'SE']) {
      if (!d) { grid.append(el('span')); continue; }
      const b = el('button', { text: d, onclick: () => { dir = d; for (const x of grid.querySelectorAll('button')) x.classList.toggle('on', x === b); } });
      grid.append(b);
    }
    const year = el('input', { inputmode: 'numeric', maxlength: '4', class: 'num', onkeydown: (e) => e.stopPropagation() });
    body.append(grid, el('p', { class: 'dim', text: t('p10_year') }), el('div', { class: 'row' }, year, el('button', { text: t('answer'), onclick: () => submit(`${dir}|${year.value.trim()}`) })));
  },

  // P08：星盤對位
  P08(body, { submit }) {
    body.append(el('p', { text: t('p08_intro') }), el('blockquote', { text: t('p08_inscription') }));
    const rows = [0, 1, 2, 3].map((i) => {
      const house = el('select', {}, el('option', { value: '', text: '—' }), ...Object.entries(HOUSES).map(([k, v]) => el('option', { value: k, text: v[getLang()] })));
      const hour = el('select', {}, ...Array.from({ length: 12 }, (_, k) => el('option', { value: String(k + 1), text: String(k + 1) })));
      house.onchange = hour.onchange = () => react('ring', { i, house: house.value, hour: hour.value });
      return { house, hour, row: el('div', { class: 'row' }, el('span', { class: 'ring', text: t(`p08_ring_${i}`) }), house, hour) };
    });
    body.append(...rows.map((r) => r.row),
      el('button', { text: t('answer'), onclick: () => submit(rows.map((r) => `${r.house.value}:${r.hour.value}`).join(',')) }));
  },

  // ======== 第三幕：沉眠圖書館 ========
  // P11：搜救名單、公告、提燈箱
  roster(body) {
    body.append(el('p', { text: t('p11_roster') }), el('ol', { class: 'roster' }, ...ROSTER.map(([n, name]) => el('li', { text: `${n}　${L(name)}` }))));
  },
  notice(body) { body.append(el('blockquote', { text: L(SURVIVORS) })); },
  P11(body, { submit }) { body.append(el('p', { text: t('p11_box') }), numberInput(submit, '???')); },

  // P12：柵門的影子（要拿著提燈、站在地上的標記照）
  P12(body, { conn, submit, items, near }) {
    const ok = items().includes('lantern') && near('mark', 1.2);
    const ELEM = [['wind', '🜁', t('el_wind')], ['fire', '🜂', t('el_fire')], ['earth', '🜃', t('el_earth')], ['water', '🜄', t('el_water')]];
    body.append(el('p', { text: ok ? t('p12_shadow') : items().includes('lantern') ? t('p12_stand') : t('p12_need') }));
    if (ok) { // 影子由伺服器給（畫面程式裡沒有答案）
      const sh = el('div', { class: 'shadows', text: '…' }); body.append(sh);
      conn.request({ t: 'peek', pid: 'P12' }).then((r) => { sh.textContent = r.t === 'peek' ? r.content.shadows.map((id) => ELEM.find((e) => e[0] === id)?.[1] ?? '?').join(' ') : ''; });
    }
    const pick = []; const show = el('div', { class: 'slots' });
    const paint = () => { show.textContent = [0, 1, 2, 3].map((i) => ELEM.find((e) => e[0] === pick[i])?.[1] ?? '＿').join('　'); react('elements', { pick: [...pick] }); };
    paint();
    body.append(show, el('div', { class: 'row' }, ...ELEM.map(([id, sym, name]) => el('button', { text: `${sym} ${name}`, onclick: () => { if (pick.length < 4) pick.push(id); paint(); } })),
      el('button', { class: 'small', text: t('reset'), onclick: () => { pick.length = 0; paint(); } }),
      el('button', { text: t('answer'), onclick: () => submit(pick.join(',')) })));
  },

  // P14：翻書（頁面內容由伺服器給）
  P14(body, { conn, submit }) {
    body.append(el('p', { class: 'dim', text: LP(BOOK_RULE) }));
    const book = el('select', {}, ...Array.from({ length: 12 }, (_, i) => el('option', { value: String(i + 1), text: `${i + 1}` })));
    const page = el('input', { inputmode: 'numeric', maxlength: '3', class: 'num', placeholder: t('page'), onkeydown: (e) => e.stopPropagation() });
    const view = el('div', { class: 'bookpage' });
    const open = async () => {
      react('book', { i: +book.value });
      const r = await conn.request({ t: 'peek', pid: 'P14', value: { book: +book.value, page: +page.value } });
      view.innerHTML = '';
      if (r.t !== 'peek') return (view.textContent = t('p14_nopage'));
      r.content.words.forEach((w, i) => view.append(el('span', {}, el('small', { text: String(i + 1) }), el('b', { text: w }))));
    };
    const ans = el('input', { placeholder: t('p14_ph'), onkeydown: (e) => e.stopPropagation() });
    body.append(el('div', { class: 'row' }, el('span', { text: t('book') }), book, page, el('button', { text: t('open_book'), onclick: open })), view,
      el('div', { class: 'row' }, ans, el('button', { text: t('answer'), onclick: () => submit(ans.value.trim()) })));
  },

  // P15：留聲水晶（方向、速度）與第七張桌子
  recording(body, { getLang }) {
    let dir = 'fwd', speed = 1, playing = null;
    const lab = el('p', { class: 'dim' });
    const paint = () => { lab.textContent = `${t('dial_dir')}：${dir === 'fwd' ? t('forward') : t('reverse')}　${t('dial_speed')}：${speed}×`; };
    paint();
    const play = async () => {
      playing?.stop(); react('play', { rev: dir === 'rev', speed });
      playing = await playFile(`assets/audio/ch1/p15_liana_${getLang() === 'en' ? 'en' : 'zh'}.mp3`, { volume: 0.9, reverse: dir === 'rev', rate: speed });
    };
    body.append(el('p', { text: t('p15_crystal') }), lab, el('div', { class: 'row' },
      el('button', { text: t('dial_dir'), onclick: () => { dir = dir === 'fwd' ? 'rev' : 'fwd'; paint(); } }),
      el('button', { text: t('dial_speed'), onclick: () => { speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1; paint(); } }),
      el('button', { text: `▶ ${t('play')}`, onclick: play }),
      el('button', { class: 'small', text: '■', onclick: () => { playing?.stop(); react('play', { off: true }); } })));
  },
  P15(body, { submit }) { body.append(el('p', { text: t('p15_drawer') }), numberInput(submit, '????')); },

  // P16：自己翻頁的書
  P16(body, { submit, panel }) {
    const pageEl = el('div', { class: 'flip', text: FLIP_PAGES[0] });
    let i = 0; const timer = setInterval(() => { i = (i + 1) % FLIP_PAGES.length; pageEl.textContent = FLIP_PAGES[i]; react('page', { i }); }, 1200);
    panel.onClose = () => clearInterval(timer);
    const inp = el('input', { class: 'num', placeholder: t('page'), onkeydown: (e) => e.stopPropagation() });
    body.append(el('p', { text: t('p16_intro') }), pageEl, el('div', { class: 'row' }, inp, el('button', { text: t('turn_to'), onclick: () => submit(inp.value.trim()) })));
  },

  // P17：東方典藏櫃的抽屜（六條橫槓，由下往上）與八卦家族圖
  trigrams(body) { body.append(el('div', { class: 'trigrams' }, ...TRIGRAMS.map(([sym, name]) => el('div', {}, el('b', { text: sym }), el('small', { text: L(name) }))))); },
  P17(body, { submit }) {
    const bits = [1, 1, 1, 1, 1, 1];
    const bars = el('div', { class: 'hexagram' });
    const paint = () => { bars.innerHTML = ''; for (let i = 5; i >= 0; i--) bars.append(el('button', { class: bits[i] ? 'solid' : 'broken', title: String(i + 1), onclick: () => { bits[i] ^= 1; react('bars', { bits: [...bits] }); paint(); } }, el('i'), el('i'))); };
    paint();
    body.append(el('p', { text: t('p17_drawer') }), bars, el('button', { text: t('answer'), onclick: () => submit(bits.join('')) }));
  },

  // P18：符文大門（按 6 個）
  P18(body, { submit, items }) {
    const latin = items().includes('chartpage');
    const seq = []; const show = el('div', { class: 'slots runes-in' });
    const paint = () => { show.textContent = [0, 1, 2, 3, 4, 5].map((i) => RUNES.find((r) => r[1] === seq[i])?.[0] ?? '＿').join(' '); react('runes', { seq: seq.map((id) => RUNES.find((r) => r[1] === id)?.[0]) }); };
    paint();
    const ring = el('div', { class: 'runering' }, ...RUNES.map(([g, id]) => el('button', { onclick: () => { if (seq.length < 6) seq.push(id); paint(); } }, el('b', { text: g }), latin ? el('small', { text: id.toUpperCase() }) : null)));
    body.append(el('p', { text: L(RUNE_DOOR) }), show, ring, el('p', { class: 'dim', text: latin ? t('p18_latin') : t('p18_nolatin') }),
      el('div', { class: 'row' }, el('button', { class: 'small', text: t('reset'), onclick: () => { seq.length = 0; paint(); } }), el('button', { text: t('answer'), onclick: () => submit(seq.join(',')) })));
  },

  // P19：月光反射（艾爾德林看得到光的路線）
  P19(body, { submit, items, myHouse, solo, aiHouse }) {
    const see = myHouse() === 'eldrin' || solo || aiHouse('eldrin'); // 艾爾德林由電腦控制時，同伴會告訴你
    const hasMirror = items().includes('mirror');
    const set = { 1: '', 2: '', 3: '', 4: '' }; let done = false;
    const grid = el('div', { class: 'light-grid' });
    const trace = () => { // 照 LIGHT_GRID 算光走過的格子
      let x = 0, y = 0, dx = 1, dy = 0; const path = new Set(['0,0']);
      for (let k = 0; k < 60; k++) {
        x += dx; y += dy; if (x < 0 || y < 0 || x > 5 || y > 5) return { path, end: null };
        const c = LIGHT_GRID[y][x]; path.add(`${x},${y}`);
        if (c === '#') return { path, end: [x, y] };
        if (c === 'C') return { path, end: [x, y], hit: true };
        const m = set[c];
        if (m === '/') [dx, dy] = [-dy, -dx]; else if (m === '\\') [dx, dy] = [dy, dx];
      }
      return { path, end: null };
    };
    const paint = () => {
      grid.innerHTML = ''; const tr = trace();
      LIGHT_GRID.forEach((row, y) => [...row].forEach((c, x) => {
        const lit = see && tr.path.has(`${x},${y}`), end = tr.end && tr.end[0] === x && tr.end[1] === y;
        const label = c === 'W' ? '☾' : c === 'C' ? '◆' : c === '#' ? '▮' : /\d/.test(c) ? (set[c] || '○') : '';
        const b = el('button', { class: `${lit ? 'lit' : ''} ${end ? 'end' : ''} ${c === 'C' ? 'crystal' : ''}`, text: label });
        if (/\d/.test(c)) b.onclick = () => {
          if (c === '4' && !hasMirror) return (status.textContent = t('p19_need_mirror'));
          set[c] = set[c] === '' ? '/' : set[c] === '/' ? '\\' : ''; react('mirror'); paint();
        };
        grid.append(b);
      }));
      react('light', { path: [[0, 0], ...[...tr.path].filter((k) => k !== '0,0').map((k) => k.split(',').map(Number))], hit: !!tr.hit, mirrors: { ...set }, see });
      if (tr.hit && !done) { done = true; submit('done').then((r) => { if (!r?.solved) done = false; }); } // 沒送成功可以再試
    };
    const status = el('p', { class: 'dim', text: see ? t('p19_see') : t('p19_blind') });
    body.append(el('p', { text: t('p19_intro') }), grid, status);
    paint();
  },

  // P20：推石像（推箱子）
  P20(body, { submit, panel }) {
    let map = SOKOBAN.map((r) => [...r]), done = false; const targets = [];
    map.forEach((row, y) => row.forEach((c, x) => { if (c === 'T') targets.push([x, y]); }));
    let px = 0, py = 0; map.forEach((row, y) => row.forEach((c, x) => { if (c === 'P') { px = x; py = y; row[x] = '.'; } if (c === 'T') row[x] = '.'; }));
    const start = { map: map.map((r) => [...r]), px, py };
    const grid = el('div', { class: 'soko' });
    const paint = () => {
      grid.innerHTML = '';
      map.forEach((row, y) => row.forEach((c, x) => {
        const tgt = targets.some(([a, b]) => a === x && b === y);
        grid.append(el('span', { class: `${c === '#' ? 'wall' : ''} ${tgt ? 'target' : ''}`, text: x === px && y === py ? '◉' : c === 'B' ? '🗿' : '' }));
      }));
      const boxes = []; map.forEach((row, y) => row.forEach((c, x) => { if (c === 'B') boxes.push([x, y]); })); react('board', { boxes, player: [px, py] });
      if (!done && targets.every(([x, y]) => map[y][x] === 'B')) { done = true; submit('done').then((r) => { if (!r?.solved) done = false; }); }
    };
    const move = (dx, dy) => {
      const nx = px + dx, ny = py + dy, c = map[ny]?.[nx];
      if (c === '#') return;
      if (c === 'B') { const bx = nx + dx, by = ny + dy; if (map[by]?.[bx] !== '.') return; map[by][bx] = 'B'; map[ny][nx] = '.'; }
      px = nx; py = ny; paint();
    };
    const keys = (e) => { const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }[e.code]; if (d) { e.preventDefault(); e.stopPropagation(); move(...d); } };
    addEventListener('keydown', keys, true);
    panel.onClose = () => removeEventListener('keydown', keys, true);
    body.append(el('p', { text: t('p20_intro') }), grid, el('div', { class: 'pad' },
      el('button', { text: '▲', onclick: () => move(0, -1) }), el('button', { text: '◀', onclick: () => move(-1, 0) }), el('button', { text: '▼', onclick: () => move(0, 1) }), el('button', { text: '▶', onclick: () => move(1, 0) }),
      el('button', { class: 'small', text: t('reset'), onclick: () => { map = start.map.map((r) => [...r]); px = start.px; py = start.py; paint(); } })));
    paint();
  },

  // P21：煉金天平（九瓶裡找出重的那瓶，只能秤兩次）
  P21(body, { conn, submit, myHouse, solo, aiHouse }) {
    const named = myHouse() === 'ouroboros' || solo || aiHouse('ouroboros');
    const side = Array(9).fill(''); let mode = 'weigh';
    const row = el('div', { class: 'vials' }); const out = el('p', { class: 'dim', text: t('p21_intro') });
    const paint = () => {
      row.innerHTML = '';
      VIALS.forEach(([sym, name], i) => row.append(el('button', { class: side[i], onclick: () => {
        if (mode === 'pick') { react('pick', { i }); return submit({ pick: i }); }
        side[i] = side[i] === '' ? 'L' : side[i] === 'L' ? 'R' : ''; react('vials', { side: [...side] }); paint();
      } }, el('b', { text: sym }), el('small', { text: named ? L(name) : '？' }), el('i', { text: side[i] }))));
    };
    paint();
    const weigh = async () => {
      const left = side.flatMap((s, i) => (s === 'L' ? [i] : [])), right = side.flatMap((s, i) => (s === 'R' ? [i] : []));
      const r = await conn.request({ t: 'answer', pid: 'P21', value: { weigh: { left, right } } });
      if (r.reply?.reshuffled) out.textContent = t('p21_reshuffled');
      else if (r.reply?.result) { out.textContent = t(`p21_${r.reply.result}`, { n: r.reply.used }); react('weigh', { result: r.reply.result }); }
      else if (r.t === 'error') out.textContent = errText(r.error, { s: Math.ceil((r.wait ?? 0) / 1000) });
      side.fill(''); paint();
      if (!r.reply?.result) react('vials', { side: [...side] });
    };
    body.append(row, out, el('div', { class: 'row' },
      el('button', { text: t('weigh'), onclick: weigh }),
      el('button', { text: t('p21_pick'), onclick: () => { mode = mode === 'pick' ? 'weigh' : 'pick'; out.textContent = mode === 'pick' ? t('p21_pickmode') : t('p21_intro'); } })));
  },

  // P22：銜尾蛇徽章（只有扮演西里爾的人看得到這個選擇）
  P22(body, { submit, myChar, toast }) {
    if (myChar() !== 'cyril') { body.append(el('p', { class: 'dim', text: t('p22_nothing') })); return; }
    body.append(el('p', { text: t('p22_intro') }), el('div', { class: 'row' },
      el('button', { text: t('p22_show'), onclick: () => submit('show').then((r) => r?.solved && toast(t('p22_said_show'))) }),
      el('button', { text: t('p22_hide'), onclick: () => submit('hide').then((r) => r?.solved && toast(t('p22_said_hide'))) })));
  },

  // P23：暗室的石板（裡面）、前廳的速寫（外面）、水晶球
  sketch(body) { body.append(el('p', { text: t('p23_sketch') }), sketchGrid()); },
  crystalball(body) { body.append(el('p', { text: t('p23_ball') }), tileGrid(null)); },
  P23(body, { submit, solo, lib }) {
    const seq = []; const status = el('p', { class: 'dim', text: t('p23_inside') });
    const press = (i) => {
      seq.push(i + 1); lib?.lightTile(i, true); setTimeout(() => lib?.lightTile(i, false), 400);
      tone(i % 4);
      status.textContent = seq.join(' → ');
      if (seq.length === 7) { submit(seq.join(',')).then((r) => { if (!r?.solved) { seq.length = 0; status.textContent = t('p23_reset'); } }); }
    };
    body.append(tileGrid(press), status, el('button', { class: 'small', text: t('reset'), onclick: () => { seq.length = 0; status.textContent = t('p23_inside'); } }));
    if (solo) body.append(el('details', {}, el('summary', { text: t('p23_familiar') }), sketchGrid()));
  },

  // P24：點字（前廳的對照表；暗室門把上的凸點要「摸」）
  brailletable(body) {
    const tbl = el('div', { class: 'braille-table' });
    for (const [ch, dots] of Object.entries(BRAILLE)) tbl.append(el('div', {}, brailleCell(dots), el('small', { text: ch.toUpperCase() })));
    body.append(tbl);
  },
  P24(body, { conn, submit }) {
    body.append(el('p', { text: t('p24_intro') }));
    const cells = el('div', { class: 'braille-door' });
    conn.request({ t: 'peek', pid: 'P24' }).then((r) => (r.content?.cells ?? []).forEach((dots, i) => {
      const c = brailleCell(dots, true);
      const feel = () => { react('feel', { i, dots }); c.classList.add('felt'); navigator.vibrate?.(dots.map(() => 40)); setTimeout(() => c.classList.remove('felt'), 1500); };
      c.onpointerenter = feel; c.onclick = feel; cells.append(c);
    }));
    const inp = el('input', { maxlength: '8', onkeydown: (e) => e.stopPropagation() });
    body.append(cells, el('p', { class: 'dim', text: t('p24_feel') }), el('div', { class: 'row' }, inp, el('button', { text: t('answer'), onclick: () => submit(inp.value.trim()) })));
  },

  // P25：井蓋的三個圓環（0～12）
  P25(body, { submit }) {
    const rings = [0, 0, 0];
    const view = el('div', { class: 'rings' });
    const paint = () => { view.innerHTML = ''; rings.forEach((v, i) => view.append(el('div', {}, el('small', { text: t(`ring_${i}`) }),
      el('button', { text: '−', onclick: () => { rings[i] = (rings[i] + 12) % 13; paint(); } }), el('b', { text: String(v) }),
      el('button', { text: '+', onclick: () => { rings[i] = (rings[i] + 1) % 13; paint(); } })))); react('rings', { rings: [...rings] }); };
    paint();
    body.append(el('p', { text: t('p25_intro') }), view, el('button', { text: t('answer'), onclick: () => submit(rings.join(',')) }));
  },

  // P30：鐵柵門的五格字母鎖（A～Z 轉輪）
  P30(body, { submit }) {
    const wheels = [0, 0, 0, 0, 0], AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const view = el('div', { class: 'rings' });
    const paint = () => { view.innerHTML = ''; wheels.forEach((v, i) => view.append(el('div', {},
      el('button', { text: '−', onclick: () => { wheels[i] = (v + 25) % 26; react('wheel', { i }); paint(); } }), el('b', { text: AZ[v] }),
      el('button', { text: '+', onclick: () => { wheels[i] = (v + 1) % 26; react('wheel', { i }); paint(); } })))); };
    paint();
    body.append(el('p', { text: t('p30_intro') }), view, el('button', { text: t('answer'), onclick: () => submit(wheels.map((v) => AZ[v]).join('')) }));
  },

  // P31：閱覽室的油燈（吹熄之後，在黑暗中找到正在哭的娃娃；場景裡的事由 logic/act3.mjs 處理）
  sobLamp(body, { solved }) {
    body.append(el('p', { text: t('p31_intro') }));
    if (!solved) body.append(el('button', { text: t('p31_blow'), onclick: () => { closePanel(); dispatchEvent(new Event('ml-sob')); } }));
  },

  // ---- 第四幕 ----
  // P26：拉桿切換門閂（門閂的狀態照拉桿算，這是題目本身）
  P26(body, { submit }) {
    const pulls = [];
    const bolts = el('div', { class: 'bolts' });
    const paint = () => {
      const locked = new Set(BOLTS_LOCKED);
      for (const p of pulls) for (const b of LEVERS[p]) locked.has(b) ? locked.delete(b) : locked.add(b);
      bolts.innerHTML = '';
      for (let b = 1; b <= 4; b++) bolts.append(el('span', { class: locked.has(b) ? 'locked' : 'open', text: `${b}　${t(locked.has(b) ? 'bolt_locked' : 'bolt_open')}` }));
      react('levers', { locked: [...locked], reset: !pulls.length });
    };
    paint();
    body.append(el('p', { text: t('p26_intro') }), bolts,
      el('div', { class: 'row' }, ...Object.keys(LEVERS).map((k) => el('button', { text: k, onclick: () => { pulls.push(k); react('pull', { k }); paint(); } })),
        el('button', { class: 'small', text: t('reset'), onclick: () => { pulls.length = 0; paint(); } })),
      el('button', { text: t('p26_push'), onclick: () => submit([...pulls]) }));
  },
  // P27：齒輪（軸距固定：兩個齒輪的半徑加起來要剛好；半徑＝齒數 ÷ 6）
  P27(body, { submit }) {
    const pick = [null, null, null];
    const row = el('div', { class: 'gears' }), out = el('p', { class: 'dim' });
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const paint = () => {
      row.innerHTML = '';
      row.append(el('div', { class: 'gear driver' }, el('small', { text: t('p27_driver') }), el('b', { text: '12' })));
      const chain = [12, ...pick];
      pick.forEach((g, i) => {
        const fit = g && chain[i] ? chain[i] / 6 + g / 6 === AXLE_GAPS[i] : null;
        row.append(el('i', { class: `gap ${fit === true ? 'ok' : fit === false ? 'bad' : ''}`, text: fit === true ? t('p27_fit_ok') : fit === false ? t('p27_fit_bad') : '' }));
        const sel = el('select', { onchange: () => { pick[i] = +sel.value || null; paint(); } }, el('option', { value: '', text: '—' }), ...GEAR_RACK.map((n) => el('option', { value: String(n), text: String(n) })));
        sel.value = g ? String(g) : '';
        row.append(el('div', { class: 'gear' }, el('small', { text: t('p27_axle', { n: i + 2 }) }), sel));
      });
      const all = pick.every(Boolean) && pick.every((g, i) => chain[i] / 6 + g / 6 === AXLE_GAPS[i]);
      const k = gcd(12, pick[2] ?? 12);
      react('gears', { pick: [...pick], fits: pick.map((g, i) => !!g && !!chain[i] && chain[i] / 6 + g / 6 === AXLE_GAPS[i]), all });
      out.textContent = all ? t('p27_result', { dir: t(pick.length % 2 ? 'p27_ccw' : 'p27_cw'), ratio: `${12 / k}/${pick[2] / k}` }) : '';
    };
    paint();
    body.append(el('p', { text: t('p27_intro') }), row, out, el('button', { text: t('p27_install'), onclick: () => submit(['12', ...pick.map((g) => g ?? 0)].join(',')) }));
  },
  // P28：照童謠的節奏敲（按住＝長、點一下＝短）。敲錯了聲音會引來守夜人
  P28(body, { submit, noise }) {
    const seq = []; const show = el('div', { class: 'rhythm' });
    const words = L(LYRIC);
    const paint = () => { show.innerHTML = ''; words.forEach((w, i) => show.append(el('span', {}, el('small', { text: LYRIC_MARKS[i] ? '—' : '?' }), el('b', { text: w })))); mine.textContent = seq.map((x) => (x === 'L' ? '—' : '・')).join(' ') || '…'; };
    const mine = el('p', { class: 'rhythm-in' });
    let down = 0;
    const pad = el('button', { class: 'knock', text: t('p28_tap') });
    pad.onpointerdown = () => { down = performance.now(); pad.classList.add('on'); };
    pad.onpointerup = () => { if (!down) return; pad.classList.remove('on'); const k = performance.now() - down > 350 ? 'L' : 'S'; if (seq.length < 7) seq.push(k); react('tap', { kind: k }); down = 0; paint(); };
    paint();
    body.append(el('p', { text: t('p28_intro') }), show, pad, mine,
      el('div', { class: 'row' }, el('button', { class: 'small', text: t('p28_long'), onclick: () => { if (seq.length < 7) seq.push('L'); react('tap', { kind: 'L' }); paint(); } }),
        el('button', { class: 'small', text: t('p28_short'), onclick: () => { if (seq.length < 7) seq.push('S'); react('tap', { kind: 'S' }); paint(); } }),
        el('button', { class: 'small', text: t('reset'), onclick: () => { seq.length = 0; paint(); } }),
        el('button', { text: t('p28_knock'), onclick: async () => { const r = await submit(seq.join('')); if (r && r.t !== 'error' && !r.solved) noise?.(); seq.length = 0; paint(); } })));
  },
  // P32：稻草人的工具箱（四位數密碼鎖）。解開：鐘塔的時間多 60 秒
  P32(body, { submit, toast }) {
    const go = async (v) => { const r = await submit(v); if (r?.solved) toast(t('p32_bonus')); return r; };
    body.append(el('p', { text: t('p32_intro') }), numberInput(go, '????'));
  },
  // P29：屋頂入口的刻字（石板本身在場景裡踩）
  roofsign(body) { body.append(el('blockquote', { text: t('p29_quote') }), el('p', { class: 'dim', text: t('p29_sign') })); },
};

// ---- 蝕巢：救援題（R，同伴來救）、自救題（S，被抓的人自己解）。題目內容由伺服器給 ----
export function openRescue(conn, kind, target, toast) {
  openPanel(t(kind === 'R' ? 'rescue_title' : 'self_title'), (body, panel) => {
    const main = el('div'), status = el('p', { class: 'p-status', text: '…' }); body.append(main, status);
    conn.request({ t: 'peek', pid: kind, target }).then((r) => {
      if (r.t !== 'peek') { status.textContent = errText(r.error); return; }
      status.textContent = '';
      const submit = async (value) => {
        status.textContent = '…';
        const res = await conn.request({ t: kind === 'R' ? 'rescue' : 'selfrescue', target, value });
        if (res.t === 'error') { status.textContent = errText(res.error, { s: Math.ceil((res.wait ?? 0) / 1000) }); return res; }
        if (res.solved) { status.textContent = t('p_solved'); toast?.(t('a4_freed')); setTimeout(closePanel, 700); } else status.textContent = t('wrong');
        return res;
      };
      NEST[r.pid]?.(main, { content: r.content, submit, panel });
    });
  });
}
const ELEM4 = [['fire', '🜂', 'el_fire'], ['water', '🜄', 'el_water'], ['wind', '🜁', 'el_wind'], ['earth', '🜃', 'el_earth']];
const NEST = {
  R1(body, { content, submit }) { // 四條黑根的元素 → 依序點燃剋制它的元素
    const pick = []; const show = el('div', { class: 'slots' });
    const sym = (id) => ELEM4.find((e) => e[0] === id)?.[1] ?? '＿';
    const paint = () => { show.textContent = [0, 1, 2, 3].map((i) => sym(pick[i])).join('　'); };
    paint();
    body.append(el('p', { text: t('r1_intro') }), el('div', { class: 'roots' }, ...content.roots.map((id) => el('span', { text: `${sym(id)} ${t(ELEM4.find((e) => e[0] === id)[2])}` }))), show,
      el('div', { class: 'row' }, ...ELEM4.map(([id, s, k]) => el('button', { text: `${s} ${t(k)}`, onclick: () => { if (pick.length < 4) pick.push(id); paint(); } })),
        el('button', { class: 'small', text: t('reset'), onclick: () => { pick.length = 0; paint(); } }),
        el('button', { text: t('answer'), onclick: () => submit(pick.join(',')) })));
  },
  R2(body, { submit }) { // 導管：每一格的開口（北 1、東 2、南 4、西 8），點一下轉 90 度
    const N = 5, rot = (m) => ((m << 1) | (m >> 3)) & 15, GLYPH = { 1: '╵', 2: '╶', 4: '╷', 8: '╴', 5: '│', 10: '─', 3: '└', 6: '┌', 12: '┐', 9: '┘', 7: '├', 14: '┬', 13: '┤', 11: '┴', 15: '┼' };
    // 先做出一條從左邊（第 3 列）到右邊（第 3 列）的路，再把每一格亂轉
    const grid = Array.from({ length: N * N }, () => [5, 3, 7][Math.floor(Math.random() * 3)]);
    const path = []; const seen = new Set();
    const walk = (c, r) => {
      path.push([c, r]); seen.add(`${c},${r}`);
      if (c === N - 1 && r === 2) return true;
      const dirs = [[1, 0], [0, 1], [0, -1], [-1, 0]].sort(() => Math.random() - 0.5); // 隨機繞路
      for (const [dc, dr] of dirs) { const nc = c + dc, nr = r + dr; if (nc >= 0 && nc < N && nr >= 0 && nr < N && !seen.has(`${nc},${nr}`) && walk(nc, nr)) return true; }
      path.pop(); return false;
    };
    walk(0, 2);
    const bit = (dc, dr) => (dr === -1 ? 1 : dc === 1 ? 2 : dr === 1 ? 4 : 8);
    path.forEach(([c, r], i) => {
      const [pc, pr] = i ? path[i - 1] : [-1, 2], [nc, nr] = i < path.length - 1 ? path[i + 1] : [N, 2];
      grid[r * N + c] = bit(pc - c, pr - r) | bit(nc - c, nr - r);
    });
    for (let i = 0; i < grid.length; i++) for (let k = Math.floor(Math.random() * 4); k > 0; k--) grid[i] = rot(grid[i]);
    const connected = () => { // 從左邊進來，能不能走到右邊出去
      const q = [[0, 2, 8]], vis = new Set();
      while (q.length) {
        const [c, r, from] = q.shift(); const m = grid[r * N + c];
        if (!(m & from) || vis.has(`${c},${r}`)) continue; vis.add(`${c},${r}`);
        if (c === N - 1 && r === 2 && m & 2) return true;
        for (const [b, dc, dr, opp] of [[1, 0, -1, 4], [2, 1, 0, 8], [4, 0, 1, 1], [8, -1, 0, 2]]) { const nc = c + dc, nr = r + dr; if (m & b && nc >= 0 && nc < N && nr >= 0 && nr < N) q.push([nc, nr, opp]); }
      }
      return false;
    };
    const view = el('div', { class: 'pipes' });
    const paint = () => { view.innerHTML = ''; grid.forEach((m, i) => view.append(el('button', { text: GLYPH[m] ?? '·', onclick: () => { grid[i] = rot(grid[i]); paint(); if (connected()) submit('done'); } }))); };
    paint();
    body.append(el('p', { text: t('r2_intro') }), el('div', { class: 'pipe-wrap' }, el('b', { text: '✦' }), view, el('b', { text: '◉' })));
  },
  R3(body, { content, submit }) {
    const inp = el('input', { maxlength: '12', onkeydown: (e) => e.stopPropagation() });
    body.append(el('p', { text: t('r3_intro') }), el('p', { class: 'cipher', text: content.cipher }), el('div', { class: 'row' }, inp, el('button', { text: t('answer'), onclick: () => submit(inp.value.trim()) })));
  },
  R4(body, { submit, panel }) { // 記憶翻牌：6 對符文、60 秒
    const cards = el('div', { class: 'memory' }), clock = el('p', { class: 'dim' });
    let deck, open, done, left, timer;
    const deal = () => {
      deck = [...RUNES6, ...RUNES6].sort(() => Math.random() - 0.5); open = []; done = new Set(); left = 60; paint();
    };
    const paint = () => {
      cards.innerHTML = ''; clock.textContent = t('r4_time', { s: left });
      deck.forEach((r, i) => cards.append(el('button', { class: done.has(i) ? 'done' : open.includes(i) ? 'up' : '', text: done.has(i) || open.includes(i) ? r : '', onclick: () => flip(i) })));
    };
    const flip = (i) => {
      if (done.has(i) || open.includes(i) || open.length >= 2) return;
      open.push(i); paint();
      if (open.length === 2) setTimeout(() => {
        if (deck[open[0]] === deck[open[1]]) open.forEach((k) => done.add(k));
        open = []; paint();
        if (done.size === deck.length) { clearInterval(timer); submit('done'); }
      }, 600);
    };
    timer = setInterval(() => { left--; if (left <= 0) { body.querySelector('.p-note')?.remove(); body.append(el('p', { class: 'p-note dim', text: t('r4_reset') })); deal(); } else clock.textContent = t('r4_time', { s: left }); }, 1000);
    panel.onClose = () => clearInterval(timer);
    deal();
    body.append(el('p', { text: t('r4_intro') }), clock, cards);
  },
  S1(body, { content, submit }) {
    const inp = el('input', { maxlength: '20', onkeydown: (e) => e.stopPropagation() });
    body.append(el('p', { text: t('s1_intro') }), el('p', { class: 'cipher', text: content.cipher }), el('div', { class: 'row' }, inp, el('button', { text: t('answer'), onclick: () => submit(inp.value.trim()) })));
  },
  S2(body, { content, submit }) { // 聽音辨位：三次，每次聽完選方向
    const picks = []; const info = el('p', { class: 'dim' });
    const paint = () => { info.textContent = t('s2_round', { n: Math.min(3, picks.length + 1) }); };
    paint();
    const dirs = el('div', { class: 'compass8' }, ...[7, 0, 1, 6, -1, 2, 5, 4, 3].map((d) => d < 0
      ? el('button', { class: 'listen', text: t('s2_listen'), onclick: () => heartbeatFrom(content.rounds[picks.length] ?? 0) })
      : el('button', { text: t(`dir.${d}`), onclick: () => { picks.push(d * 45); if (picks.length === 3) { submit(picks.join(',')); picks.length = 0; } paint(); } })));
    body.append(el('p', { text: t('s2_intro') }), info, dirs);
  },
  S3(body, { submit }) { // 符文數獨（6×6，2×3 的框）
    const GIVEN = ['1..4.6', '.5..2.', '2.1..4', '5..2.1', '.1..4.', '6.5..2'];
    const g = GIVEN.map((row) => [...row].map((ch) => (ch === '.' ? 0 : +ch)));
    const fixed = g.map((row) => row.map(Boolean));
    const ok = () => {
      const sets = [];
      for (let i = 0; i < 6; i++) { sets.push(g[i]); sets.push(g.map((row) => row[i])); }
      for (let br = 0; br < 6; br += 2) for (let bc = 0; bc < 6; bc += 3) sets.push([0, 1].flatMap((dr) => [0, 1, 2].map((dc) => g[br + dr][bc + dc])));
      return sets.every((set) => new Set(set).size === 6 && !set.includes(0));
    };
    const view = el('div', { class: 'sudoku' });
    const paint = () => {
      view.innerHTML = '';
      g.forEach((row, r) => row.forEach((v, c) => view.append(el('button', { class: `${fixed[r][c] ? 'fixed' : ''} ${c === 2 ? 'bx' : ''} ${r % 2 ? 'by' : ''}`, text: v ? RUNES6[v - 1] : '',
        onclick: () => { if (fixed[r][c]) return; g[r][c] = (g[r][c] + 1) % 7; paint(); if (ok()) submit('done'); } }))));
    };
    paint();
    body.append(el('p', { text: t('s3_intro') }), view);
  },
  S4(body, { content, submit }) {
    const SIDES = ['left', 'middle', 'right'];
    body.append(el('p', { text: t('s4_intro') }),
      el('div', { class: 'heads' }, ...content.says.map((k, i) => el('div', {}, el('small', { text: t(`head_${SIDES[i]}`) }), el('p', { text: t(`liar.${k}`) })))),
      el('div', { class: 'row' }, ...SIDES.map((sd) => el('button', { text: t('s4_cut', { side: t(`side_${sd}`) }), onclick: () => submit(sd) }))));
  },
};

// 燭光閃爍：長＝－，短＝・
function blink(lamp, codes, onLight = () => {}) { // onLight(true/false)：場景裡遠方窗戶的燭光跟著亮滅
  if (lamp.dataset.on) return;
  lamp.dataset.on = '1';
  const seq = [];
  codes.forEach((code, i) => {
    for (const c of code) seq.push([1, c === '-' ? 900 : 300], [0, 300]);
    seq.push([0, i < codes.length - 1 ? 1500 : 0]);
  });
  let i = 0;
  const step = () => {
    if (i >= seq.length) { delete lamp.dataset.on; lamp.classList.remove('lit'); onLight(false); return; }
    const [on, ms] = seq[i++]; lamp.classList.toggle('lit', !!on); onLight(!!on); setTimeout(step, ms);
  };
  step();
}

// P02 用：玩家走到長桌旁時記下聽到的傳聞
export function rumorText(i) { return RUMORS[i].map(LP).join(' '); }

// ---- 第三幕的小工具 ----
function brailleCell(dots, hidden = false) {
  const c = el('div', { class: `braille ${hidden ? 'hidden' : ''}` });
  for (const n of [1, 4, 2, 5, 3, 6]) c.append(el('i', { class: dots.includes(n) ? 'on' : '' }));
  return c;
}
function sketchGrid() { // 鏡子上的速寫：路線（左右相反）＋每一步的音高
  const g = el('div', { class: 'tiles sketch' });
  for (let i = 1; i <= 16; i++) { const k = SKETCH.path.indexOf(i); g.append(el('span', { class: k >= 0 ? 'on' : '', text: k >= 0 ? String(k + 1) : '' })); }
  const staff = el('div', { class: 'staff' }, ...SKETCH.pitches.map((p) => el('i', { style: `margin-bottom:${(p - 1) * 9}px` })));
  return el('div', {}, g, staff);
}
function tileGrid(onPress) {
  const g = el('div', { class: 'tiles' });
  for (let i = 0; i < 16; i++) g.append(onPress ? el('button', { onclick: () => onPress(i) }) : el('span', { text: String(i + 1) }));
  return g;
}
let toneCtx = null;
function tone(col) { // 每一欄一個音，左邊最低
  try {
    toneCtx ??= new AudioContext();
    const o = toneCtx.createOscillator(), g = toneCtx.createGain(), t0 = toneCtx.currentTime;
    o.frequency.value = [262, 330, 392, 523][col]; o.type = 'sine';
    g.gain.setValueAtTime(0.2, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    o.connect(g).connect(toneCtx.destination); o.start(); o.stop(t0 + 0.6);
  } catch { /* 沒有音效也能玩 */ }
}
