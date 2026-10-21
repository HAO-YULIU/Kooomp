// 第 2 批的謎題畫面：P02、P03～P08。作答都送到伺服器判斷，這裡沒有答案。
import { openPanel, closePanel, el, L, t } from './overlay.mjs';
import { errText, getLang } from '../logic/i18n.mjs';
import { RUMORS } from '../data/world-ch1.mjs';
import { MORSE_TABLE, RUNE_ROWS } from '../data/story-ch1.mjs';
import { ROSTER, SURVIVORS, BOOK_RULE, FLIP_PAGES, TRIGRAMS, RUNES, RUNE_DOOR, LIGHT_GRID, SOKOBAN, VIALS, SKETCH, BRAILLE } from '../data/library-ch1.mjs';
import { playFile } from '../world/sound.mjs';
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
  const inp = el('input', { inputmode: 'numeric', maxlength: '4', placeholder: ph, class: 'num' });
  const go = el('button', { text: t('answer'), onclick: () => submit(inp.value.trim()) });
  inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') go.click(); };
  return el('div', { class: 'row' }, inp, go);
};

// 沒有提示的題目（西里爾的抉擇）、只是看資料的畫面（不放提示）
const NO_HINTS = new Set(['P22']);
const INFO_PANELS = new Set(['roster', 'notice', 'trigrams', 'sketch', 'crystalball', 'brailletable']);

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
    const paint = () => { show.textContent = [0, 1, 2, 3].map((i) => ELEM.find((e) => e[0] === pick[i])?.[1] ?? '＿').join('　'); };
    paint();
    body.append(show, el('div', { class: 'row' }, ...ELEM.map(([id, sym, name]) => el('button', { text: `${sym} ${name}`, onclick: () => { if (pick.length < 4) pick.push(id); paint(); } })),
      el('button', { class: 'small', text: t('reset'), onclick: () => { pick.length = 0; paint(); } }),
      el('button', { text: t('answer'), onclick: () => submit(pick.join(',')) })));
  },

  // P14：翻書（頁面內容由伺服器給）
  P14(body, { conn, submit }) {
    body.append(el('p', { class: 'dim', text: L(BOOK_RULE) }));
    const book = el('select', {}, ...Array.from({ length: 12 }, (_, i) => el('option', { value: String(i + 1), text: `${i + 1}` })));
    const page = el('input', { inputmode: 'numeric', maxlength: '3', class: 'num', placeholder: t('page'), onkeydown: (e) => e.stopPropagation() });
    const view = el('div', { class: 'bookpage' });
    const open = async () => {
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
      playing?.stop();
      playing = await playFile(`assets/audio/ch1/p15_liana_${getLang() === 'en' ? 'en' : 'zh'}.mp3`, { volume: 0.9, reverse: dir === 'rev', rate: speed });
    };
    body.append(el('p', { text: t('p15_crystal') }), lab, el('div', { class: 'row' },
      el('button', { text: t('dial_dir'), onclick: () => { dir = dir === 'fwd' ? 'rev' : 'fwd'; paint(); } }),
      el('button', { text: t('dial_speed'), onclick: () => { speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1; paint(); } }),
      el('button', { text: `▶ ${t('play')}`, onclick: play }),
      el('button', { class: 'small', text: '■', onclick: () => playing?.stop() })));
  },
  P15(body, { submit }) { body.append(el('p', { text: t('p15_drawer') }), numberInput(submit, '????')); },

  // P16：自己翻頁的書
  P16(body, { submit, panel }) {
    const pageEl = el('div', { class: 'flip', text: FLIP_PAGES[0] });
    let i = 0; const timer = setInterval(() => { i = (i + 1) % FLIP_PAGES.length; pageEl.textContent = FLIP_PAGES[i]; }, 1200);
    panel.onClose = () => clearInterval(timer);
    const inp = el('input', { class: 'num', placeholder: t('page'), onkeydown: (e) => e.stopPropagation() });
    body.append(el('p', { text: t('p16_intro') }), pageEl, el('div', { class: 'row' }, inp, el('button', { text: t('turn_to'), onclick: () => submit(inp.value.trim()) })));
  },

  // P17：東方典藏櫃的抽屜（六條橫槓，由下往上）與八卦家族圖
  trigrams(body) { body.append(el('div', { class: 'trigrams' }, ...TRIGRAMS.map(([sym, name]) => el('div', {}, el('b', { text: sym }), el('small', { text: L(name) }))))); },
  P17(body, { submit }) {
    const bits = [1, 1, 1, 1, 1, 1];
    const bars = el('div', { class: 'hexagram' });
    const paint = () => { bars.innerHTML = ''; for (let i = 5; i >= 0; i--) bars.append(el('button', { class: bits[i] ? 'solid' : 'broken', title: String(i + 1), onclick: () => { bits[i] ^= 1; paint(); } }, el('i'), el('i'))); };
    paint();
    body.append(el('p', { text: t('p17_drawer') }), bars, el('button', { text: t('answer'), onclick: () => submit(bits.join('')) }));
  },

  // P18：符文大門（按 6 個）
  P18(body, { submit, items }) {
    const latin = items().includes('chartpage');
    const seq = []; const show = el('div', { class: 'slots runes-in' });
    const paint = () => { show.textContent = [0, 1, 2, 3, 4, 5].map((i) => RUNES.find((r) => r[1] === seq[i])?.[0] ?? '＿').join(' '); };
    paint();
    const ring = el('div', { class: 'runering' }, ...RUNES.map(([g, id]) => el('button', { onclick: () => { if (seq.length < 6) seq.push(id); paint(); } }, el('b', { text: g }), latin ? el('small', { text: id.toUpperCase() }) : null)));
    body.append(el('p', { text: L(RUNE_DOOR) }), show, ring, el('p', { class: 'dim', text: latin ? t('p18_latin') : t('p18_nolatin') }),
      el('div', { class: 'row' }, el('button', { class: 'small', text: t('reset'), onclick: () => { seq.length = 0; paint(); } }), el('button', { text: t('answer'), onclick: () => submit(seq.join(',')) })));
  },

  // P19：月光反射（艾爾德林看得到光的路線）
  P19(body, { submit, items, myHouse, solo }) {
    const see = myHouse() === 'eldrin' || solo;
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
          set[c] = set[c] === '' ? '/' : set[c] === '/' ? '\\' : ''; paint();
        };
        grid.append(b);
      }));
      if (tr.hit && !done) { done = true; submit('done'); }
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
      if (!done && targets.every(([x, y]) => map[y][x] === 'B')) { done = true; submit('done'); }
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
  P21(body, { conn, submit, myHouse, solo }) {
    const named = myHouse() === 'ouroboros' || solo;
    const side = Array(9).fill(''); let mode = 'weigh';
    const row = el('div', { class: 'vials' }); const out = el('p', { class: 'dim', text: t('p21_intro') });
    const paint = () => {
      row.innerHTML = '';
      VIALS.forEach(([sym, name], i) => row.append(el('button', { class: side[i], onclick: () => {
        if (mode === 'pick') return submit({ pick: i });
        side[i] = side[i] === '' ? 'L' : side[i] === 'L' ? 'R' : ''; paint();
      } }, el('b', { text: sym }), el('small', { text: named ? L(name) : '？' }), el('i', { text: side[i] }))));
    };
    paint();
    const weigh = async () => {
      const left = side.flatMap((s, i) => (s === 'L' ? [i] : [])), right = side.flatMap((s, i) => (s === 'R' ? [i] : []));
      const r = await conn.request({ t: 'answer', pid: 'P21', value: { weigh: { left, right } } });
      if (r.reply?.reshuffled) out.textContent = t('p21_reshuffled');
      else if (r.reply?.result) out.textContent = t(`p21_${r.reply.result}`, { n: r.reply.used });
      else if (r.t === 'error') out.textContent = t(`err.${r.error}`);
      side.fill(''); paint();
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
    conn.request({ t: 'peek', pid: 'P24' }).then((r) => (r.content?.cells ?? []).forEach((dots) => {
      const c = brailleCell(dots, true);
      const feel = () => { c.classList.add('felt'); navigator.vibrate?.(dots.map(() => 40)); setTimeout(() => c.classList.remove('felt'), 1500); };
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
      el('button', { text: '+', onclick: () => { rings[i] = (rings[i] + 1) % 13; paint(); } })))); };
    paint();
    body.append(el('p', { text: t('p25_intro') }), view, el('button', { text: t('answer'), onclick: () => submit(rings.join(',')) }));
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
