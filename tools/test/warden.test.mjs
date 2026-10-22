// 守夜人的行動：看到、聽到、追、躲、甩掉、穿過門
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWardenAI } from '../../game/src/logic/warden-ai.mjs';
import { A4_ROOMS, A4_DOORS, WARDEN, WARDEN_POINTS } from '../../game/src/data/act4-ch1.mjs';
import { LIB_ROOMS } from '../../game/src/data/library-ch1.mjs';

const rooms = [...LIB_ROOMS.filter((r) => r.id === 'lib_entry'), ...A4_ROOMS];
const make = (x, z, zone = 'lib_entry', yaw = 0, params = { ...WARDEN, calm: 0, hunt: 0 }) => { // 預設不輪休息，單純測看、聽、追
  const ai = createWardenAI({ rooms, doors: A4_DOORS, points: WARDEN_POINTS, params, start: { x, z, zone }, rand: () => 0.5 });
  ai.start(); ai.state.yaw = yaw;
  Object.assign(ai.state, { goal: { x, z, zone }, wait: -1e9 }); // 先站著不動，面向 yaw
  return ai;
};
const me = (o) => ({ uid: 'u', zone: 'lib_entry', x: 108, z: 5, moving: false, running: false, hidden: false, holding: false, captured: false, ...o });
const run = (ai, players, sec, step = 0.05) => { const ev = []; for (let t = 0; t < sec; t += step) ev.push(...ai.update(step, typeof players === 'function' ? players(t) : players, t * 1000)); return ev; };

test('看到站在前面的人：0.5 秒後追過來抓', () => {
  const ai = make(108, 12, 'lib_entry', 0); // 面向北（-z），玩家在北邊 7 公尺
  const ev = run(ai, [me()], 5);
  assert.equal(ev[0].type, 'spotted');
  assert.ok(ev.some((e) => e.type === 'catch'));
});

test('沒被看到就躲好：不會被發現；被看到才躲：會被找到', () => {
  let ai = make(108, 12, 'lib_entry', Math.PI); // 背對玩家
  assert.equal(run(ai, [me({ hidden: true, holding: true })], 6).filter((e) => e.type === 'catch').length, 0);
  ai = make(108, 12, 'lib_entry', 0);
  run(ai, [me()], 0.6); // 被發現了
  assert.ok(run(ai, [me({ hidden: true })], 5).some((e) => e.type === 'catch'));
});

test('跑步會被聽到，屏息不會', () => {
  let ai = make(103, 12, 'lib_entry', Math.PI);
  run(ai, [me({ x: 108, z: 6, moving: true, running: true })], 0.1);
  assert.equal(ai.state.mode, 'search');
  ai = make(103, 12, 'lib_entry', Math.PI);
  run(ai, [me({ x: 108, z: 6, moving: true, running: true, holding: true })], 0.1);
  assert.equal(ai.state.mode, 'patrol');
});

test('跑出視線 4 秒就甩掉；會穿過門追到別的區域', () => {
  const ai = make(112, 8, 'lib_entry', -Math.PI / 2); // 面向東
  run(ai, [me({ x: 114, z: 7.75 })], 0.6);
  assert.equal(ai.state.mode, 'chase');
  // 玩家進了通道，一路往東跑（比他快）
  const ev = run(ai, (t) => [me({ zone: 'a4_pass', x: 116 + 3.6 * t, z: 7.75, moving: true, running: true })], 4);
  assert.equal(ai.state.zone, 'a4_pass'); // 跟進通道了
  assert.equal(ev.some((e) => e.type === 'catch'), false);
  // 玩家躲進壁龕（他沒看到），過一陣子就放棄
  const ev2 = run(ai, [me({ zone: 'a4_pass', x: 131, z: 8.2, hidden: true, holding: true })], 15);
  assert.ok(ev2.some((e) => e.type === 'lost') || ai.state.mode !== 'chase');
});

test('掙脫後停 2 秒；沒掙脫就退到遠處，連續被抓會變慢', () => {
  const ai = make(108, 6, 'lib_entry', 0);
  assert.ok(run(ai, [me()], 2).some((e) => e.type === 'catch'));
  ai.resolve(true, 0, [me()]);
  assert.equal(ai.state.mode, 'stun');
  ai.resolve(false, 0, [me()]);
  assert.ok(Math.hypot(ai.state.x - 108, ai.state.z - 5) > 10 || ai.state.zone !== 'lib_entry');
});

test('開場先走開、看不到人；之後找人和回蝕巢休息輪流', () => {
  const P = { ...WARDEN, calm: 10, hunt: 20, rest: 8 };
  const ai = createWardenAI({ rooms, doors: A4_DOORS, points: WARDEN_POINTS, params: P, start: { x: 108, z: 12, zone: 'lib_entry' }, rand: () => 0.5 });
  ai.start(); ai.state.yaw = 0;
  assert.equal(ai.state.mode, 'rest');
  const ev = run(ai, [me()], 9.5); // 玩家就站在他前面，開場這段不會被發現
  assert.ok(!ev.some((e) => e.type === 'spotted' || e.type === 'catch'));
  const ev2 = run(ai, [me({ zone: 'a4_roof', x: 155, z: -50 })], 1); // 時間到：開始找人
  assert.ok(ev2.some((e) => e.type === 'hunt')); assert.equal(ai.state.mode, 'patrol');
  const ev3 = run(ai, [me({ zone: 'a4_roof', x: 155, z: -50 })], 21); // 沒找到人：回去休息
  assert.ok(ev3.some((e) => e.type === 'rest'));
});

test('穿過門時是走過去，不會一下子跳到另一邊', () => {
  const ai = make(112, 7.75, 'lib_entry', -Math.PI / 2);
  Object.assign(ai.state, { mode: 'search', goal: { x: 125, z: 7.75, zone: 'a4_pass' }, wait: 0 });
  let last = { x: ai.state.x, z: ai.state.z }, maxStep = 0;
  for (let i = 0; i < 200; i++) { ai.update(0.05, [me({ zone: 'a4_roof', x: 155, z: -50 })], i * 50); maxStep = Math.max(maxStep, Math.hypot(ai.state.x - last.x, ai.state.z - last.z)); last = { x: ai.state.x, z: ai.state.z }; }
  assert.equal(ai.state.zone, 'a4_pass');
  assert.ok(maxStep < 0.2, `最大一步 ${maxStep}`);
});
