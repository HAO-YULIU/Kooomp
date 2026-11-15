// 大廳的遊玩紀錄（play_records）：開局寫一筆 started、第一章完改成 cleared（2026-11-15 製作人：管理員看不到魔蝕的數據）
import test from 'node:test';
import assert from 'node:assert/strict';

// 假的瀏覽器環境＋假的 Supabase：記下對 play_records 做了什麼
const calls = [];
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.location = { search: '', hash: '', pathname: '/' };
globalThis.history = { replaceState: () => {} };
const table = (name) => {
  const q = {
    select() { return q; }, eq() { return q; },
    maybeSingle: async () => ({ data: name === 'games' ? { id: 'game-milner' } : null }),
    insert(row) { calls.push(['insert', row]); return { select: () => ({ single: async () => ({ data: { id: 'rec-' + calls.length }, error: null }) }), then: (f) => f({ error: null }) }; },
    update(row) { calls.push(['update', row]); return { eq: async (_, id) => { calls.push(['where', id]); return { error: null }; } }; },
  };
  return q;
};
globalThis.window = { supabase: { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) }, from: table }) } };

const { recordRun } = await import('../../game/src/net/platform.mjs');

test('開局寫一筆 started；同一局重複收到狀態不會再寫', async () => {
  await Promise.all([recordRun('ABCD'), recordRun('ABCD')]);
  await recordRun('ABCD');
  const ins = calls.filter((c) => c[0] === 'insert');
  assert.equal(ins.length, 1);
  assert.deepEqual({ ...ins[0][1] }, { user_id: 'u1', game_id: 'game-milner', status: 'started', variant: null });
});

test('第一章完：同一筆改成 cleared，帶時間、被抓次數、提示次數、模式、隊伍代號；之後不再寫', async () => {
  const result = { time: 3725400, caught: 2, hints: 5, mode: 'duo', at: 1794700000000 };
  await recordRun('ABCD', result);
  await recordRun('ABCD', result);
  const upd = calls.filter((c) => c[0] === 'update');
  assert.equal(upd.length, 1);
  assert.deepEqual(upd[0][1], { status: 'cleared', clear_time_sec: 3725, deaths: 2, hints: 5, ending: 'ch1', variant: 'duo', team_key: 'milner-ABCD-1794700000000' });
  assert.ok(calls.some((c) => c[0] === 'where' && String(c[1]).startsWith('rec-')), '改的是開局那一筆');
});

test('沒有房號就不寫', async () => {
  const n = calls.length;
  await recordRun('');
  assert.equal(calls.length, n);
});
