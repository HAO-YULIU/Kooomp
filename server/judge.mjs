// 判斷答案（只在伺服器執行）。題目資料見 data/puzzles/ch1.mjs。
// 隨機的題目（P09、P21、救援題、自救題）用房間的亂數種子決定，同一個房間每次結果一樣，不同房間不同。
import { CHAPTER1, RESCUE, SELF_RESCUE, HOUSE_HOUR } from '../data/puzzles/ch1.mjs';

export const PUZZLES = { ...CHAPTER1, ...RESCUE, ...SELF_RESCUE };
export const HOUSES = ['eldrin', 'grimoire', 'belmont', 'ouroboros'];
export const HOUSE_EN = { eldrin: 'ELDRIN', grimoire: 'GRIMOIRE', belmont: 'BELMONT', ouroboros: 'OUROBOROS' };

// ---------- 亂數 ----------
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed, key) { // mulberry32
  let a = hash(`${seed}:${key}`);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

// ---------- 正規化 ----------
const FULL = /[！-～]/g; // 全形英數 → 半形
export function norm(v) {
  return String(v ?? '')
    .normalize('NFKC').replace(FULL, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toUpperCase()
    .replace(/[\s　.,，。、;；:：!！?？'"「」『』()（）·・\-—_]+/g, '');
}
const normSeq = (v) => String(v ?? '').split(/[,，、\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean).join(',');
const byLang = (ans, lang) => (ans && typeof ans === 'object' && !Array.isArray(ans) && ('zh' in ans || 'en' in ans) ? ans[lang] ?? ans.zh : ans);
const asList = (a) => (Array.isArray(a) ? a : [a]);

// ---------- 找異常長廊（P09） ----------
// 異常的編號對應 docs/05-puzzles-ch1.md 的清單；前面是輕微的，越後面越嚇人
export const ANOMALIES = {
  mild: ['candle_down', 'pose', 'empty_frame', 'carpet', 'frame_count', 'back_turned', 'candle_missing', 'rain_stops', 'longer'],
  mid: ['eyes_follow', 'black_ooze', 'door_handle', 'shadow_lag', 'clock_reverse', 'familiar_gone', 'handprints', 'green_lamp', 'lullaby'],
  severe: ['liana', 'face_gouged', 'hanging_cat', 'rush_figure'],
  house: { eldrin: 'glowing_steps', grimoire: 'plaque_changed', belmont: 'armor_breath', ouroboros: 'clock_slow' },
};
// 第 attempt 次挑戰的第 n 趟長廊
export function corridorLoop(seed, attempt, n, { rate = 0.6 } = {}) {
  if (n === 0) return null; // 每次挑戰的第一趟一定正常
  const r = rng(seed, `P09:${attempt}:${n}`);
  if (r() >= rate) return null;
  const pool = n <= 2 ? ANOMALIES.mild : n <= 5 ? [...ANOMALIES.mild, ...ANOMALIES.mid] : [...ANOMALIES.mid, ...ANOMALIES.severe];
  const withHouse = r() < 0.15; // 學院專屬的異常（單人要切換使魔視角才看得到）
  if (withHouse) { const h = pick(r, HOUSES); return { id: ANOMALIES.house[h], house: h }; }
  return { id: pick(r, pool), house: null };
}

// ---------- 沙漏（P06） ----------
// actions：[{ t: 遊戲分鐘, a: 'flip', g: [7] | [11] | [7, 11] }, ..., { t, a: 'knock' }]
// 回傳每個沙漏漏完的時間點；敲門要剛好在目標時間、而且是某個沙漏漏完的那一刻（不是看時鐘猜的）
export function simulateHourglass(glasses, actions) {
  const top = Object.fromEntries(glasses.map((g) => [g, 0])); // 上半部剩下的沙（分鐘）
  const bottom = Object.fromEntries(glasses.map((g) => [g, g]));
  const events = [];
  let now = 0; let knock = null;
  const sorted = [...actions].filter((a) => Number.isFinite(+a?.t)).sort((a, b) => a.t - b.t);
  const advance = (to) => {
    for (const g of glasses) {
      if (top[g] > 0) {
        const run = Math.min(top[g], to - now);
        top[g] -= run; bottom[g] += run;
        if (top[g] <= 1e-9 && run > 0) events.push(+(now + run).toFixed(3));
      }
    }
    now = to;
  };
  for (const a of sorted) {
    if (a.t < now) continue;
    advance(a.t);
    if (a.a === 'flip') for (const g of asList(a.g)) if (g in top) { const t = top[g]; top[g] = bottom[g]; bottom[g] = t; }
    if (a.a === 'knock') { knock = a.t; break; }
  }
  return { events, knock };
}

// ---------- 拉桿（P26） ----------
export function simulateLevers(def, pulls) {
  const locked = new Set(def.locked);
  for (const p of asList(pulls)) for (const b of def.levers[p] ?? []) (locked.has(b) ? locked.delete(b) : locked.add(b));
  return [...locked];
}

// ---------- 救援題、自救題的內容 ----------
const COUNTER = { fire: 'water', wind: 'fire', earth: 'wind', water: 'earth' }; // 被誰剋：水剋火、火剋風、風剋土、土剋水
const FREE_WORDS = ['FREE', 'LIGHT', 'AWAKE', 'BREAK'];
const VIG_WORDS = ['SOLVE VINCULA', 'LUX MANET', 'NON SUM TUUS', 'REDEO'];
const LIARS = [ // 三顆頭各說一句話，只有一顆說真話；answer＝要切斷的黑根
  { says: ['left_is_safe', 'middle_lies', 'right_is_root'], root: 'middle' },
  { says: ['right_lies', 'left_is_root', 'middle_is_root'], root: 'right' },
  { says: ['not_left', 'not_middle', 'left_lies'], root: 'left' },
];
const shiftWord = (w, k) => w.replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + k) % 26 + 26) % 26 + 65));
const vigenere = (w, key) => { let i = 0; return w.replace(/[A-Z]/g, (c) => shiftWord(c, key.charCodeAt(i++ % key.length) - 65)); };

// 給畫面用的題目內容（不含答案）。house：被抓的人的學院
export function rescueContent(pid, seed, key, { house } = {}) {
  const r = rng(seed, `${pid}:${key}`);
  switch (pid) {
    case 'R1': return { roots: Array.from({ length: 4 }, () => pick(r, Object.keys(COUNTER))) };
    case 'R3': return { cipher: shiftWord(pick(r, FREE_WORDS), HOUSE_HOUR[house] ?? 0) };
    case 'S1': return { cipher: vigenere(pick(r, VIG_WORDS), HOUSE_EN[house] ?? 'MILNER') };
    case 'S2': return { rounds: Array.from({ length: 3 }, () => Math.floor(r() * 8) * 45) }; // 聲音的方向（度）
    case 'S4': return { says: pick(r, LIARS).says };
    default: return {};
  }
}
function rescueAnswer(pid, seed, key) {
  const r = rng(seed, `${pid}:${key}`);
  switch (pid) {
    case 'R1': return Array.from({ length: 4 }, () => COUNTER[pick(r, Object.keys(COUNTER))]).join(',');
    case 'R3': return pick(r, FREE_WORDS);
    case 'S1': return pick(r, VIG_WORDS);
    case 'S2': return Array.from({ length: 3 }, () => Math.floor(r() * 8) * 45).join(',');
    case 'S4': return pick(r, LIARS).root;
    default: return null;
  }
}

// ---------- 主判斷 ----------
// ctx：{ seed, lang（謎題語言）, house（作答者的學院）, solo, state（這題的伺服器狀態，可修改）, key（救援題的抽題鍵） }
// 回傳：{ ok, solved?, reveal?, reply? }。solved＝這題解開了；reply＝給作答者的額外資訊
export function judge(pid, value, ctx) {
  const def = PUZZLES[pid];
  if (!def) return { ok: false, error: 'bad_puzzle' };
  if (def.solo && !ctx.solo) return { ok: false, error: 'bad_puzzle' };
  if (def.house && !ctx.solo && ctx.house !== def.house) return { ok: false, error: 'not_your_house' };
  const lang = ctx.lang === 'en' ? 'en' : 'zh';

  switch (def.kind) {
    case 'event': return { ok: true, solved: true };
    case 'choice': return def.options.includes(value) ? { ok: true, solved: true, flag: value } : { ok: false, error: 'bad_value' };
    case 'text': {
      const ok = asList(byLang(def.ans, lang)).some((a) => norm(a) === norm(value));
      return ok ? { ok: true, solved: true, reveal: def.reveal } : { ok: true, solved: false };
    }
    case 'seq': {
      const ok = asList(byLang(def.ans, lang)).some((a) => normSeq(a) === normSeq(value));
      return { ok: true, solved: ok };
    }
    case 'set': {
      const groups = byLang(def.ans, lang).map((g) => g.map(norm));
      const given = asList(value).map(norm).filter(Boolean);
      if (given.length !== groups.length) return { ok: true, solved: false };
      const used = new Set();
      const ok = given.every((v) => { const i = groups.findIndex((g, k) => !used.has(k) && g.includes(v)); if (i < 0) return false; used.add(i); return true; });
      return { ok: true, solved: ok };
    }
    case 'hours': { // P07：另外三座塔的時辰
      const want = Object.entries(HOUSE_HOUR).filter(([h]) => h !== ctx.house);
      const ok = value && typeof value === 'object' && want.every(([h, n]) => +value[h] === n);
      return { ok: true, solved: !!ok };
    }
    case 'hourglass': {
      const { events, knock } = simulateHourglass(def.glasses, asList(value));
      const ok = knock !== null && Math.abs(knock - def.target) < 0.01 && events.some((e) => Math.abs(e - knock) < 0.01);
      return { ok: true, solved: ok, reveal: ok ? def.ans : undefined };
    }
    case 'levers': return { ok: true, solved: simulateLevers(def, value).length === 0 };
    case 'corridor': { // value：{ loop, choice: 'back' | 'forward' }
      const st = ctx.state;
      st.attempt ??= 0; st.n ??= 0; st.streak ??= 0;
      if (+value?.loop !== st.n) return { ok: false, error: 'bad_value', reply: { loop: st.n } };
      const anomaly = corridorLoop(ctx.seed, st.attempt, st.n, { rate: def.rate });
      const right = (value.choice === 'back') === !!anomaly;
      if (right) { st.streak++; st.n++; } else { st.attempt++; st.n = 0; st.streak = 0; }
      const done = st.streak >= def.streak;
      return { ok: true, solved: done, reply: { right, streak: st.streak, loop: st.n, next: done ? null : corridorLoop(ctx.seed, st.attempt, st.n, { rate: def.rate }) } };
    }
    case 'balance': { // value：{ weigh: { left: [..], right: [..] } } 或 { pick: 瓶子編號 }
      const st = ctx.state;
      st.round ??= 0; st.used ??= 0;
      const heavy = Math.floor(rng(ctx.seed, `P21:${st.round}`)() * def.count);
      const reshuffle = () => { st.round++; st.used = 0; };
      if (value?.weigh) {
        if (st.used >= def.weighings) { reshuffle(); return { ok: true, solved: false, reply: { reshuffled: true } }; }
        st.used++;
        const L = asList(value.weigh.left).map(Number), R = asList(value.weigh.right).map(Number);
        const w = (side) => side.length + (side.includes(heavy) ? 0.1 : 0);
        const result = w(L) > w(R) ? 'left' : w(L) < w(R) ? 'right' : 'equal';
        return { ok: true, solved: false, reply: { result, used: st.used } };
      }
      if (value && 'pick' in value) {
        const ok = +value.pick === heavy;
        if (!ok) reshuffle();
        return { ok: true, solved: ok, reply: ok ? {} : { reshuffled: true } };
      }
      return { ok: false, error: 'bad_value' };
    }
    case 'counter': case 'caesar': case 'vigenere': case 'direction': case 'liar': {
      const want = rescueAnswer(pid, ctx.seed, ctx.key);
      const ok = def.kind === 'counter' || def.kind === 'direction' ? normSeq(want) === normSeq(value) : norm(want) === norm(value);
      return { ok: true, solved: ok };
    }
    default: return { ok: false, error: 'bad_puzzle' };
  }
}

// P09 第三張提示：這一趟要注意哪一類東西
const FOCUS = {
  candle: { ids: ['candle_down', 'candle_missing'], zh: '燭台和火焰', en: 'the candles and flames' },
  paint: { ids: ['pose', 'empty_frame', 'frame_count', 'back_turned', 'eyes_follow', 'black_ooze', 'liana', 'face_gouged', 'plaque_changed'], zh: '兩旁的畫', en: 'the paintings' },
  floor: { ids: ['carpet', 'green_lamp', 'handprints', 'shadow_lag', 'glowing_steps'], zh: '地上和牆上', en: 'the floor and walls' },
  sound: { ids: ['rain_stops', 'lullaby', 'armor_breath'], zh: '聲音', en: 'the sounds' },
  space: { ids: ['longer', 'door_handle', 'clock_reverse', 'clock_slow', 'hanging_cat', 'rush_figure', 'familiar_gone'], zh: '走廊本身：長度、門、窗外、天花板', en: 'the corridor itself: its length, the door, the window, the ceiling' },
};
export function corridorFocus(anomaly, lang) {
  const k = lang === 'en' ? 'en' : 'zh';
  if (!anomaly) return k === 'en' ? 'compare everything carefully — nothing may be wrong this time' : '每個地方都仔細比對，這一趟也可能完全正常';
  const f = Object.values(FOCUS).find((x) => x.ids.includes(anomaly.id));
  return f ? f[k] : FOCUS.space[k];
}

// 提示（第 n 張，0～2）
export function hint(pid, n, lang, ctx = {}) {
  const def = PUZZLES[pid];
  const list = def?.hints?.[lang === 'en' ? 'en' : 'zh'];
  if (!list || n < 0 || n >= list.length) return null;
  let text = list[n];
  if (pid === 'P09' && ctx.focus) text = text.replace('{focus}', ctx.focus);
  return text;
}
