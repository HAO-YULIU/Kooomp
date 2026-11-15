// 中英文檢查：程式用到的文字代號、網頁上的 data-t、場景資料（{ zh, en }、劇情台詞）都要有中文和英文
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.document ??= { documentElement: {} };
globalThis.localStorage ??= { getItem: () => null, setItem() {} };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const { t, setLang } = await import('../../game/src/logic/i18n.mjs');
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const CJK = /[一-鿿]/;

test('程式和網頁用到的文字，中文、英文都有', () => {
  const keys = new Set();
  for (const f of walk(join(ROOT, 'game/src')).filter((f) => f.endsWith('.mjs'))) for (const m of readFileSync(f, 'utf8').matchAll(/\b(?:t|caption)\(\s*['`]([a-zA-Z0-9_.]+)['`]/g)) keys.add(m[1]);
  for (const m of readFileSync(join(ROOT, 'game/index.html'), 'utf8').matchAll(/data-t(?:-[a-z]+)?="([^"]+)"/g)) keys.add(m[1]);
  const miss = [];
  for (const lang of ['zh', 'en']) { setLang(lang); for (const k of keys) { const v = t(k); if (!v || (v === k && lang === 'zh')) miss.push(`${lang}:${k}`); if (lang === 'en' && CJK.test(v.replaceAll('魔蝕', ''))) miss.push(`en（有中文）:${k}`); } }
  setLang('zh');
  assert.deepEqual(miss, []);
  assert.ok(keys.size > 200);
});

test('場景資料和劇情台詞都有英文', async () => {
  const bad = [], seen = new WeakSet();
  const scan = (v, path) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return; seen.add(v);
    if (Array.isArray(v)) {
      if (v.length === 3 && (v[0] === null || typeof v[0] === 'string') && typeof v[1] === 'string' && CJK.test(v[1]) && (typeof v[2] !== 'string' || !v[2].trim() || CJK.test(v[2]))) bad.push(`${path}：${v[1].slice(0, 20)}`);
      v.forEach((x, i) => scan(x, `${path}[${i}]`)); return;
    }
    if ('zh' in v && (typeof v.en !== 'string' ? !Array.isArray(v.en) : !v.en.trim() || CJK.test(v.en))) bad.push(`${path}：${JSON.stringify(v.zh).slice(0, 30)}`);
    for (const [k, x] of Object.entries(v)) scan(x, `${path}.${k}`);
  };
  for (const f of ['world-ch1', 'library-ch1', 'act4-ch1', 'story-ch1']) { const m = await import(`../../game/src/data/${f}.mjs`); for (const [k, v] of Object.entries(m)) scan(v, `${f}.${k}`); }
  assert.deepEqual(bad, []);
});
