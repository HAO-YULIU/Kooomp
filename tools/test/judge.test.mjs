// 答案判斷的單元測試：每一題的正確答案要對、錯誤答案要錯
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judge, hint, simulateHourglass, corridorLoop, corridorFocus, rescueContent, PUZZLES } from '../../server/judge.mjs';
import { CHAPTER1 } from '../../data/puzzles/ch1.mjs';

const ctx = (o = {}) => ({ seed: 'test-seed', lang: 'zh', house: null, solo: true, state: {}, ...o });
const ok = (pid, v, o) => judge(pid, v, ctx(o)).solved;

test('文字、順序、集合題', () => {
  assert.equal(ok('P02', ['北翼', '綠燈', '十三']), true);
  assert.equal(ok('P02', ['十三', '北翼', '綠色']), true);
  assert.equal(ok('P02', ['南翼', '綠燈', '十三']), false);
  assert.equal(ok('P02', ['north wing', 'green lamp', '13'], { lang: 'en' }), true);
  assert.equal(ok('P03', 'scorpio'), true);
  assert.equal(judge('P03', 'scorpio', ctx()).reveal, '8'); // 解開後只告訴作答者的時辰
  assert.equal(ok('P04', '１１'), true); // 全形數字也算
  assert.equal(ok('P05', '9'), true); assert.equal(ok('P05', '6'), false);
  assert.equal(ok('P08', 'grimoire:11, ouroboros:3, belmont:9, eldrin:8'), true);
  assert.equal(ok('P08', 'ouroboros:3,grimoire:11,belmont:9,eldrin:8'), false);
  assert.equal(ok('P10', 'nw|1626'), true);
  assert.equal(ok('P11', '257'), true);
  assert.equal(ok('P12', 'wind,fire,earth,water'), true);
  assert.equal(ok('P14', '鐘在井底'), true);
  assert.equal(ok('P14', 'the bell lies in the well.', { lang: 'en' }), true);
  assert.equal(ok('P14', '鐘在井底', { lang: 'en' }), false); // 英文房間要英文答案
  assert.equal(ok('P15', '3141'), true);
  assert.equal(ok('P16', 'xxxiii'), true); assert.equal(ok('P16', '33'), true);
  assert.equal(ok('P17', '110111'), true);
  assert.equal(ok('P18', 'b,l,i,g,h,t'), true);
  assert.equal(ok('P23', '1,6,11,16,15,14,13'), true); assert.equal(ok('P23', '4,7,10,13,14,15,16'), false);
  assert.equal(ok('P24', 'well'), true);
  assert.equal(ok('P25', '5,7,3'), true);
  assert.equal(ok('P27', '12,24,18,36'), true);
  assert.equal(ok('P28', 'LSSLLSL'), true);
  assert.equal(ok('P29', 'm,i,l,n,e,r'), true);
});

test('學院限定：多人時別的學院不能作答，單人可以', () => {
  assert.equal(judge('P03', 'scorpio', ctx({ solo: false, house: 'belmont' })).error, 'not_your_house');
  assert.equal(judge('P03', 'scorpio', ctx({ solo: false, house: 'eldrin' })).solved, true);
  assert.equal(judge('P03', 'scorpio', ctx({ solo: true, house: 'belmont' })).solved, true);
  // P07：只問電腦控制的同伴的時辰；全員都是玩家時不需要
  assert.equal(judge('P07', {}, ctx({ solo: false, house: 'grimoire', aiHouses: [] })).error, 'not_needed');
  assert.equal(judge('P07', { eldrin: 8, belmont: 9, ouroboros: 3 }, ctx({ house: 'grimoire', aiHouses: ['eldrin', 'belmont', 'ouroboros'] })).solved, true);
  assert.equal(judge('P07', { eldrin: 8, belmont: 9, ouroboros: 4 }, ctx({ house: 'grimoire', aiHouses: ['eldrin', 'belmont', 'ouroboros'] })).solved, false);
  assert.equal(judge('P07', { ouroboros: 3 }, ctx({ solo: false, house: 'grimoire', aiHouses: ['ouroboros'] })).solved, true);
});

test('沙漏：要剛好在沙漏漏完的那一刻敲第 15 分', () => {
  const right = [{ t: 0, a: 'flip', g: [7, 11] }, { t: 7, a: 'flip', g: [7] }, { t: 11, a: 'flip', g: [7] }, { t: 15, a: 'knock' }];
  assert.equal(ok('P06', right), true);
  assert.equal(judge('P06', right, ctx()).reveal, '3');
  assert.equal(ok('P06', [{ t: 0, a: 'flip', g: [7, 11] }, { t: 15, a: 'knock' }]), false); // 看時間猜的，不算
  assert.equal(ok('P06', [{ t: 0, a: 'flip', g: [7, 11] }, { t: 7, a: 'flip', g: [7] }, { t: 14, a: 'knock' }]), false);
  assert.deepEqual(simulateHourglass([7, 11], right).events, [7, 11, 15]);
});

test('拉桿：A＋B 或 C＋D', () => {
  assert.equal(ok('P26', ['A', 'B']), true);
  assert.equal(ok('P26', ['C', 'D']), true);
  assert.equal(ok('P26', ['A']), false);
  assert.equal(ok('P26', ['A', 'B', 'C', 'D']), false);
});

test('天平：秤兩次就能找到，第三次會重新洗牌', () => {
  const st = {};
  const c = () => ctx({ state: st, house: 'ouroboros', solo: false });
  // 照提示的方法找
  let r = judge('P21', { weigh: { left: [0, 1, 2], right: [3, 4, 5] } }, c()).reply.result;
  const group = r === 'left' ? [0, 1, 2] : r === 'right' ? [3, 4, 5] : [6, 7, 8];
  r = judge('P21', { weigh: { left: [group[0]], right: [group[1]] } }, c()).reply.result;
  const heavy = r === 'left' ? group[0] : r === 'right' ? group[1] : group[2];
  assert.equal(judge('P21', { weigh: { left: [0], right: [1] } }, c()).reply.reshuffled, true); // 第三次：洗牌
  assert.equal(st.round, 1);
  // 洗牌後重新找一次，指認正確
  st.used = 0;
  r = judge('P21', { weigh: { left: [0, 1, 2], right: [3, 4, 5] } }, c()).reply.result;
  const g2 = r === 'left' ? [0, 1, 2] : r === 'right' ? [3, 4, 5] : [6, 7, 8];
  r = judge('P21', { weigh: { left: [g2[0]], right: [g2[1]] } }, c()).reply.result;
  const h2 = r === 'left' ? g2[0] : r === 'right' ? g2[1] : g2[2];
  assert.equal(judge('P21', { pick: h2 }, c()).solved, true);
  assert.ok(Number.isInteger(heavy));
});

test('異常長廊：連續答對 8 趟才過，答錯歸零', () => {
  const st = {};
  const c = () => ctx({ state: st });
  let res;
  for (let i = 0; i < 8; i++) {
    const anomaly = corridorLoop('test-seed', st.attempt ?? 0, st.n ?? 0);
    if (i === 0) assert.equal(anomaly, null); // 第一趟一定正常
    res = judge('P09', { loop: st.n ?? 0, choice: anomaly ? 'back' : 'forward' }, c());
    assert.equal(res.reply.right, true);
  }
  assert.equal(res.solved, true);
  const st2 = {};
  judge('P09', { loop: 0, choice: 'forward' }, ctx({ state: st2 }));
  const a = corridorLoop('test-seed', 0, 1);
  judge('P09', { loop: 1, choice: a ? 'forward' : 'back' }, ctx({ state: st2 })); // 故意答錯
  assert.equal(st2.streak, 0); assert.equal(st2.n, 0); assert.equal(st2.attempt, 1);
});

test('救援題、自救題：內容和答案一致', () => {
  const c3 = rescueContent('R3', 'seed-x', 'k', { house: 'belmont' }).cipher;
  const plain = ['FREE', 'LIGHT', 'AWAKE', 'BREAK'].find((w) => w.replace(/[A-Z]/g, (ch) => String.fromCharCode((ch.charCodeAt(0) - 65 + 9) % 26 + 65)) === c3);
  assert.ok(plain);
  assert.equal(judge('R3', plain, ctx({ seed: 'seed-x', key: 'k' })).solved, true);
  const roots = rescueContent('R1', 'seed-x', 'k').roots;
  const counter = { fire: 'water', wind: 'fire', earth: 'wind', water: 'earth' };
  assert.equal(judge('R1', roots.map((r) => counter[r]).join(','), ctx({ seed: 'seed-x', key: 'k' })).solved, true);
  const dirs = rescueContent('S2', 'seed-x', 'k').rounds;
  assert.equal(judge('S2', dirs.join(','), ctx({ seed: 'seed-x', key: 'k' })).solved, true);
});

test('每一題（除了不計分的）都有三張中英文提示，難度比例接近目標', () => {
  const scored = Object.entries(CHAPTER1).filter(([, d]) => d.score !== false);
  assert.equal(scored.length, 27); // P02～P29 扣掉不計分的 P22（單人限定的 P07 也算在內）
  for (const [pid, d] of scored) {
    assert.equal(d.hints?.zh?.length, 3, pid); assert.equal(d.hints?.en?.length, 3, pid);
    assert.ok(hint(pid, 2, 'en'));
  }
  const count = {}; for (const [, d] of scored) count[d.diff] = (count[d.diff] ?? 0) + 1;
  assert.deepEqual(count, { 6: 5, 7: 6, 8: 8, 9: 5, 10: 3 }); // docs/04-map-ch1.md 的難度分配
  assert.ok(Object.keys(PUZZLES).length >= 36);
});

test('異常長廊的第三張提示會填入要注意的地方', () => {
  assert.equal(hint('P09', 2, 'zh', { focus: corridorFocus({ id: 'lullaby' }, 'zh') }), '這一趟要特別注意：聲音');
  assert.match(hint('P09', 2, 'en', { focus: corridorFocus(null, 'en') }), /nothing may be wrong/);
});
