// P06 沙漏（玩家 2026-11-22：「有思路但是沙漏翻轉很難按，而且敲門永遠敲不到時間」）
// 遊戲 1 分鐘＝現實 1 秒，以前要在沙漏漏完的那一秒內按下去；改成沙漏一漏完時間就停下來，等玩家決定要翻哪一個、敲門還是繼續等
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hourglassClock } from '../../game/src/logic/hourglass.mjs';
import { judge } from '../../server/judge.mjs';

const ctx = { seed: 's', lang: 'zh', house: null, solo: true, state: {} };
// 一直往前走，直到停下來（模擬畫面的計時器，每 0.1 秒走一次；手慢一點也沒關係）
const runUntilPause = (c, max = 30) => { for (let i = 0; i < max * 10 && !c.paused; i++) c.step(0.1 + Math.random() * 0.05); return c.paused; };

test('照正確的想法做：每次沙漏漏完都停下來，敲門時間剛好是第 15 刻，伺服器判對', () => {
  const c = hourglassClock([7, 11]);
  c.act('flip', [7, 11]);
  assert.ok(runUntilPause(c)); assert.equal(c.now, 7); assert.deepEqual(c.emptied, [7]);
  c.act('flip', [7]);
  assert.ok(runUntilPause(c)); assert.equal(c.now, 11); assert.deepEqual(c.emptied, [11]);
  c.act('flip', [7]);
  assert.ok(runUntilPause(c)); assert.equal(c.now, 15); assert.deepEqual(c.emptied, [7]);
  c.act('knock');
  assert.equal(judge('P06', c.actions, ctx).solved, true, JSON.stringify(c.actions));
});

test('停下來時可以「繼續等」；想法錯了照樣不會過（只是不用搶那一秒）', () => {
  const c = hourglassClock([7, 11]);
  c.act('flip', [7, 11]);
  runUntilPause(c); assert.equal(c.now, 7);
  c.resume(); runUntilPause(c); assert.equal(c.now, 11);
  c.act('knock');
  assert.equal(judge('P06', c.actions, ctx).solved, false);
});

test('還沒開始、沒有沙漏在漏時，時間不會停在奇怪的地方', () => {
  const c = hourglassClock([7, 11]);
  c.step(5); assert.equal(c.now, 0, '還沒開始');
  c.act('flip', [7]); runUntilPause(c); assert.equal(c.now, 7);
  c.resume(); c.step(3); assert.equal(c.paused, false, '沒有沙漏在漏：不會停');
});
