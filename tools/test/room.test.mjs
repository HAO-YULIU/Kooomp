// 房間的整合測試：在本機啟動真正的 Worker＋Durable Object（wrangler），用 WebSocket 模擬玩家。
// 登入用 DEV_AUTH 的假帳號（dev-名字）。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { unstable_dev } from 'wrangler';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
let worker, base;

before(async () => {
  if (!existsSync(join(ROOT, 'dist/index.html'))) { mkdirSync(join(ROOT, 'dist'), { recursive: true }); writeFileSync(join(ROOT, 'dist/index.html'), 'dev'); }
  // 測試用的設定：跟 wrangler.jsonc 一樣，但不跑 build（避免測試途中重裝套件）
  const cfg = JSON.parse(readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
  delete cfg.build; cfg.main = join(ROOT, 'server/worker.mjs'); cfg.assets.directory = join(ROOT, 'dist');
  mkdirSync(join(ROOT, '.wrangler'), { recursive: true });
  const cfgPath = join(ROOT, '.wrangler/test.wrangler.json'); writeFileSync(cfgPath, JSON.stringify(cfg));
  worker = await unstable_dev(join(ROOT, 'server/worker.mjs'), {
    config: cfgPath, vars: { DEV_AUTH: '1', TEST_PASS: 'moon.light' }, experimental: { disableExperimentalWarning: true },
    logLevel: 'warn', persist: false, ip: '127.0.0.1',
  });
  base = `http://${worker.address}:${worker.port}`;
  // wrangler 會把全域的連線設定改成「全部走 HTTPS_PROXY」，連本機也一樣；改回會遵守 NO_PROXY 的版本
  const { EnvHttpProxyAgent, setGlobalDispatcher } = await import('undici');
  setGlobalDispatcher(new EnvHttpProxyAgent());
});
after(async () => { await worker?.stop(); });

const create = async (name, mode = 'multi', lang = 'zh') => {
  const r = await fetch(`${base}/api/rooms`, { method: 'POST', headers: { authorization: `Bearer dev-${encodeURIComponent(name)}`, 'content-type': 'application/json' }, body: JSON.stringify({ mode, lang }) });
  return (await r.json()).code;
};

// 一個模擬玩家：收到的訊息排隊，可以等某一種訊息
function player(code, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/api/rooms/${code}/ws?lang=zh`, ['milner', `dev-${encodeURIComponent(name)}`]);
    const inbox = []; const waiters = []; let id = 1;
    const p = {
      ws, inbox, uid: `dev-${encodeURIComponent(name)}`,
      send: (m) => ws.send(JSON.stringify(m)),
      request: (m) => { const mid = id++; ws.send(JSON.stringify({ ...m, id: mid })); return p.wait((x) => x.id === mid); },
      wait(pred, ms = 3000) {
        const i = inbox.findIndex(pred); if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
        return new Promise((res, rej) => { const w = { pred, res }; waiters.push(w); setTimeout(() => rej(new Error('timeout waiting')), ms); });
      },
      count: (pred) => inbox.filter(pred).length,
      close: () => ws.close(),
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      const w = waiters.findIndex((x) => x.pred(m));
      if (w >= 0) waiters.splice(w, 1)[0].res(m); else inbox.push(m);
    };
    ws.onopen = () => resolve(p); ws.onerror = () => reject(new Error('ws error'));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('沒登入不能建房；房號不存在會回 404', async () => {
  const r = await fetch(`${base}/api/rooms`, { method: 'POST', body: '{}' });
  assert.equal(r.status, 401);
  const i = await fetch(`${base}/api/rooms/ZZZZ`);
  assert.equal(i.status, 404);
});

test('多人：加入、選角色、準備、開始、同步、聊天、作答', async () => {
  const code = await create('阿明');
  const a = await player(code, '阿明');
  const b = await player(code, '小華');
  let s = await b.wait((m) => m.t === 'state' && m.members.length === 2);
  assert.equal(s.host, a.uid);

  // 同一個角色不能兩個人選
  assert.equal((await a.request({ t: 'char', char: 'vaughn' })).t, 'ok');
  assert.equal((await b.request({ t: 'char', char: 'vaughn' })).error, 'character_taken');
  await b.request({ t: 'char', char: 'elora' });
  assert.equal((await a.request({ t: 'start' })).error, 'not_ready');
  await a.request({ t: 'ready', ready: true });
  await b.request({ t: 'ready', ready: true });
  assert.equal((await b.request({ t: 'start' })).error, 'not_host');
  assert.equal((await a.request({ t: 'start' })).t, 'ok');
  s = await b.wait((m) => m.t === 'state' && m.phase === 'playing');

  // 遊戲開始後，第三個人不能加入
  const info = await (await fetch(`${base}/api/rooms/${code}`)).json();
  assert.equal(info.phase, 'playing');

  // 區域：同一區才收到詳細位置（B）
  a.send({ t: 'pos', z: 'hall', p: [1, 2], v: [0, 1], y: 0, s: 1 });
  b.send({ t: 'pos', z: 'hall', p: [3, 4], v: [0, 0], y: 0, s: 0 });
  await a.wait((m) => m.t === 'pos' && m.uid === b.uid);
  a.send({ t: 'pos', z: 'hall', p: [1, 3], v: [0, 1], y: 0, s: 1 });
  const got = await b.wait((m) => m.t === 'pos' && m.uid === a.uid && m.p[1] === 3);
  assert.deepEqual(got.p, [1, 3]);
  a.send({ t: 'pos', z: 'library', p: [9, 9], v: [0, 0], y: 0, s: 0 });
  const zone = await b.wait((m) => m.t === 'zone' && m.uid === a.uid && m.z === 'library');
  assert.equal(zone.z, 'library');
  a.send({ t: 'pos', z: 'library', p: [9, 8], v: [0, 1], y: 0, s: 1 });
  await sleep(300);
  assert.equal(b.count((m) => m.t === 'pos' && m.uid === a.uid && m.p[0] === 9), 0, '不同區的人不該收到詳細位置');

  // 聊天、標記
  await a.request({ t: 'chat', text: '這裡有一扇門' });
  const chat = await b.wait((m) => m.t === 'chat');
  assert.equal(chat.text, '這裡有一扇門'); assert.equal(chat.name, '阿明');
  a.send({ t: 'mark', kind: 'danger', z: 'library', p: [1, 1] });
  assert.equal((await b.wait((m) => m.t === 'mark')).kind, 'danger');

  // 段落：序幕還不能答第一幕的題目；解開 P02 進入第一幕
  assert.equal((await a.request({ t: 'answer', pid: 'P05', value: '9' })).error, 'not_yet');
  assert.equal((await a.request({ t: 'answer', pid: 'P02', value: ['北翼', '綠燈', '十三'] })).solved, true);
  s = await b.wait((m) => m.t === 'state' && m.segment === 'act1');
  assert.deepEqual(s.ai.sort(), ['grimoire', 'ouroboros']); // 沒人選的月晞、西里爾由電腦控制

  // 作答：學院限定、答錯冷卻、答對全隊都知道
  assert.equal((await a.request({ t: 'answer', pid: 'P03', value: 'scorpio' })).error, 'not_your_house'); // 沃恩是貝爾蒙特
  assert.equal((await b.request({ t: 'answer', pid: 'P03', value: 'leo' })).solved, false);
  assert.equal((await b.request({ t: 'answer', pid: 'P03', value: 'scorpio' })).error, 'cooldown');
  const right = await a.request({ t: 'answer', pid: 'P05', value: '9' });
  assert.equal(right.solved, true);
  assert.equal(right.reveal, '9'); // 時辰只告訴作答者
  const seen = await b.wait((m) => m.t === 'solved' && m.pid === 'P05');
  assert.equal(seen.reveal, undefined);

  // P07：電腦控制的同伴用燭光傳時辰（只有他們的塔）
  const peek7 = await b.request({ t: 'peek', pid: 'P07' });
  assert.deepEqual(Object.keys(peek7.content.morse).sort(), ['grimoire', 'ouroboros']);
  assert.deepEqual(peek7.content.morse.grimoire, ['.----', '.----']); // 11
  assert.equal((await b.request({ t: 'answer', pid: 'P07', value: { grimoire: 11, ouroboros: 3 } })).solved, true);

  // P08：要全隊都在星盤廳
  assert.equal((await a.request({ t: 'answer', pid: 'P08', value: 'x' })).error, 'gather_first');
  a.send({ t: 'pos', z: 'starhall', p: [0, 0], v: [0, 0], y: 0, s: 0 });
  b.send({ t: 'pos', z: 'starhall', p: [1, 0], v: [0, 0], y: 0, s: 0 });
  await a.wait((m) => m.t === 'zone' && m.uid === b.uid && m.z === 'starhall');
  assert.equal((await a.request({ t: 'answer', pid: 'P08', value: 'grimoire:11,ouroboros:3,belmont:9,eldrin:8' })).solved, true);
  assert.equal((await b.wait((m) => m.t === 'state' && m.segment === 'act2')).segment, 'act2');

  // 第二幕：異常長廊——誰做決定都算，結果告訴全隊；連續對 8 趟才過；再解開 P10 進到第三幕
  let peek = await a.request({ t: 'peek', pid: 'P09' });
  assert.equal(peek.next, null); // 第一趟一定正常
  // 多人要投票：兩個人都要選一樣的才算數
  const split = await a.request({ t: 'answer', pid: 'P09', value: { loop: peek.loop, choice: 'back' } });
  assert.equal(split.pending, true); assert.equal(split.need, 2);
  assert.equal((await b.wait((m) => m.t === 'vote')).back, 1);
  for (let i = 0; i < 8; i++) {
    const who = i % 2 ? a : b, other = i % 2 ? b : a;
    const choice = peek.next ? 'back' : 'forward';
    const first = await other.request({ t: 'answer', pid: 'P09', value: { loop: peek.loop, choice } });
    assert.equal(first.pending, true);
    const res = await who.request({ t: 'answer', pid: 'P09', value: { loop: peek.loop, choice } });
    const told = await other.wait((m) => m.t === 'corridor' && m.by === who.uid && m.streak === i + 1);
    assert.equal(told.right, true);
    peek = { loop: res.reply.loop, next: res.reply.next };
    if (i === 7) assert.equal(res.solved, true);
  }
  assert.equal((await a.request({ t: 'answer', pid: 'P10', value: 'NW|1626' })).solved, true);
  assert.equal((await b.wait((m) => m.t === 'state' && m.segment === 'act3a')).segment, 'act3a');
  assert.equal((await b.request({ t: 'answer', pid: 'P05', value: '9' })).error, 'already_solved');

  // 提示：全隊都看得到，最多三張
  const h = await a.request({ t: 'hint', pid: 'P11' });
  assert.match(h.text, /公告/);
  assert.equal((await b.wait((m) => m.t === 'hint')).pid, 'P11');
  await a.request({ t: 'hint', pid: 'P11' }); await a.request({ t: 'hint', pid: 'P11' });
  assert.equal((await a.request({ t: 'hint', pid: 'P11' })).error, 'no_more_hints');

  // 房主斷線：負責計算守夜人的人換手
  a.close();
  s = await b.wait((m) => m.t === 'state' && m.sim === b.uid);
  assert.equal(s.members.find((m) => m.uid === a.uid).online, false);
  b.close();
});

test('單人：只能一個人，英文謎題', async () => {
  const code = await create('Solo', 'solo', 'en');
  const p = await player(code, 'Solo');
  await p.request({ t: 'char', char: 'yuexi' });
  await p.request({ t: 'ready', ready: true });
  assert.equal((await p.request({ t: 'start' })).t, 'ok');
  await p.request({ t: 'dev', segment: 'act3a' }); // 本機測試可以跳段
  const info = await (await fetch(`${base}/api/rooms/${code}`)).json();
  assert.equal(info.max, 1);
  assert.equal((await p.request({ t: 'answer', pid: 'P14', value: 'THE BELL LIES IN THE WELL' })).solved, true);
  assert.equal((await p.request({ t: 'answer', pid: 'P03', value: 'scorpio' })).solved, true); // 單人不限學院
  assert.equal((await p.request({ t: 'answer', pid: 'P07', value: { eldrin: 8, belmont: 9, ouroboros: 3 } })).solved, true);
  const peek = await p.request({ t: 'peek', pid: 'P09' });
  assert.equal(peek.loop, 0); assert.equal(peek.next, null);
  // 重新連線（舊連線會被關掉）會拿回自己知道的時辰
  const again = await player(code, 'Solo');
  assert.equal((await again.wait((m) => m.t === 'notes')).notes.P03, '8');
  again.close();
});

test('等待室裡離開的人會被移出，房主換人', async () => {
  const code = await create('房主');
  const a = await player(code, '房主');
  const b = await player(code, '客人');
  await a.wait((m) => m.t === 'state' && m.members.length === 2);
  a.close();
  const s = await b.wait((m) => m.t === 'state' && m.members.length === 1);
  assert.equal(s.host, b.uid);
  b.close();
});

test('製作人的測試登入：密碼對才能用，可以跳段', async () => {
  const enc = (x) => encodeURIComponent(x).replace(/\./g, '%2E');
  const post = (token) => fetch(`${base}/api/rooms`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{"mode":"solo"}' });
  assert.equal((await post(`test.${enc('wrong')}.${enc('製作人')}`)).status, 401);
  const r = await post(`test.${enc('moon.light')}.${enc('製作人')}`);
  assert.equal(r.status, 200);
  const { code } = await r.json();
  const ws = await new Promise((res, rej) => { const w = new WebSocket(`${base.replace('http', 'ws')}/api/rooms/${code}/ws`, ['milner', `test.${enc('moon.light')}.${enc('製作人')}`]); w.onopen = () => res(w); w.onerror = rej; });
  const got = []; ws.onmessage = (e) => got.push(JSON.parse(e.data));
  const ask = async (m) => { ws.send(JSON.stringify({ ...m, id: m.t })); for (let i = 0; i < 50; i++) { const x = got.find((g) => g.id === m.t); if (x) return x; await sleep(40); } };
  await ask({ t: 'char', char: 'cyril' }); await ask({ t: 'ready', ready: true }); await ask({ t: 'start' });
  assert.equal((await ask({ t: 'dev', segment: 'act1' })).t, 'ok');
  assert.equal(got.find((g) => g.t === 'hello').you, 'test-製作人');
  ws.close();
});

test('第三幕：道具、書本密碼、段落一段一段推進、西里爾的抉擇', async () => {
  const code = await create('圖書館', 'solo');
  const p = await player(code, '圖書館');
  await p.request({ t: 'char', char: 'yuexi' }); await p.request({ t: 'ready', ready: true }); await p.request({ t: 'start' });
  await p.request({ t: 'dev', segment: 'act3a' });
  const ans = (pid, value) => p.request({ t: 'answer', pid, value });
  assert.equal((await ans('P12', 'wind,fire,earth,water')).error, 'need_item'); // 要先拿到提燈
  assert.equal((await p.request({ t: 'peek', pid: 'P12' })).error, 'need_item'); // 沒有燈看不到影子
  assert.equal((await ans('P11', '257')).solved, true);
  assert.ok((await p.wait((m) => m.t === 'state' && m.items.includes('lantern'))).items.includes('lantern'));
  assert.deepEqual((await p.request({ t: 'peek', pid: 'P12' })).content.shadows, ['wind', 'fire', 'earth', 'water']);
  assert.equal((await ans('P12', 'wind,fire,earth,water')).solved, true);
  // 書本密碼：第 12 本第 3 頁第 7 個字是「鐘」（答案在伺服器產生的頁面裡）
  const page = await p.request({ t: 'peek', pid: 'P14', value: { book: 12, page: 3 } });
  assert.equal(page.content.words.length, 24); assert.equal(page.content.words[6], '鐘');
  assert.equal((await ans('P13', 'done')).solved, true);
  assert.equal((await ans('P14', '鐘在井底')).solved, true);
  await p.wait((m) => m.t === 'state' && m.segment === 'act3b');
  assert.equal((await p.request({ t: 'collect', item: 'note1' })).t, 'ok');
  assert.equal((await p.request({ t: 'collect', item: 'mirror' })).error, 'bad_value'); // 道具不能自己撿
  for (const [pid, v] of [['P15', '3141'], ['P16', 'XXXIII'], ['P17', '110111']]) assert.equal((await ans(pid, v)).solved, true, pid);
  const s3c = await p.wait((m) => m.t === 'state' && m.segment === 'act3c');
  assert.ok(s3c.solved.includes('P22')); assert.equal(s3c.flags.P22, 'hide'); // 沒人扮演西里爾：電腦替他收起徽章
  assert.deepEqual(['chartpage', 'lantern', 'mirror', 'note1', 'note3'].every((i) => s3c.items.includes(i)), true);
  // 天平：照方法秤兩次
  let r = (await ans('P21', { weigh: { left: [0, 1, 2], right: [3, 4, 5] } })).reply.result;
  const g = r === 'left' ? [0, 1, 2] : r === 'right' ? [3, 4, 5] : [6, 7, 8];
  r = (await ans('P21', { weigh: { left: [g[0]], right: [g[1]] } })).reply.result;
  assert.equal((await ans('P21', { pick: r === 'left' ? g[0] : r === 'right' ? g[1] : g[2] })).solved, true);
  for (const [pid, v] of [['P18', 'b,l,i,g,h,t'], ['P19', 'done'], ['P20', 'done'], ['P23', '1,6,11,16,15,14,13'], ['P24', 'WELL']]) assert.equal((await ans(pid, v)).solved, true, pid);
  assert.deepEqual((await p.request({ t: 'peek', pid: 'P24' })).content.cells.length, 4);
  assert.equal((await ans('P25', '5,7,3')).solved, true);
  assert.equal((await p.wait((m) => m.t === 'state' && m.segment === 'act4')).segment, 'act4');
  p.close();
});

test('第三幕多人：西里爾的抉擇只有扮演西里爾的人能做', async () => {
  const code = await create('西里爾');
  const a = await player(code, '西里爾'), b = await player(code, '月晞');
  await a.request({ t: 'char', char: 'cyril' }); await b.request({ t: 'char', char: 'yuexi' });
  await a.request({ t: 'ready', ready: true }); await b.request({ t: 'ready', ready: true }); await a.request({ t: 'start' });
  await a.request({ t: 'dev', segment: 'act3c' });
  assert.equal((await b.request({ t: 'answer', pid: 'P22', value: 'show' })).error, 'not_yours');
  assert.equal((await a.request({ t: 'answer', pid: 'P22', value: 'show' })).solved, true);
  a.close(); b.close();
});

test('第四幕單人：倒數、齒輪多 90 秒、被抓到復活 3 次、用完判定輸、重來', async () => {
  const code = await create('守夜人', 'solo');
  const p = await player(code, '守夜人');
  await p.request({ t: 'char', char: 'vaughn' }); await p.request({ t: 'ready', ready: true }); await p.request({ t: 'start' });
  await p.request({ t: 'dev', segment: 'act4' });
  let s = await p.wait((m) => m.t === 'state' && m.segment === 'act4');
  const left = s.act4.deadline - s.now;
  assert.ok(left > 34.9 * 60000 && left <= 35 * 60000, `剩 ${left}`);
  assert.equal(s.revives, 3);
  const ans = (pid, value) => p.request({ t: 'answer', pid, value });
  assert.equal((await ans('P26', ['A'])).solved, false);
  await sleep(3100); // 答錯要等 3 秒
  assert.equal((await ans('P26', ['C', 'D'])).solved, true);
  assert.equal((await ans('P27', '12,24,18,36')).solved, true);
  s = await p.wait((m) => m.t === 'state' && m.act4?.bonus);
  assert.ok(s.act4.deadline - s.now > 36 * 60000); // 多了 90 秒
  // 貝爾蒙特擊退守夜人：冷卻 60 秒
  assert.equal((await p.request({ t: 'repel' })).t, 'ok');
  assert.equal((await p.request({ t: 'repel' })).error, 'cooldown');
  // 被抓到：掙脫成功不算；沒掙脫用掉一次復活
  assert.equal((await p.request({ t: 'catch', uid: p.uid })).t, 'ok');
  assert.equal((await p.request({ t: 'escape' })).escaped, true);
  for (const n of [2, 1, 0]) {
    await sleep(10);
    await p.request({ t: 'catch', uid: p.uid });
    assert.equal((await p.request({ t: 'caught' })).escaped, false);
    assert.equal((await p.wait((m) => m.t === 'revived')).left, n);
  }
  await p.request({ t: 'catch', uid: p.uid }); await p.request({ t: 'caught' });
  assert.equal((await p.wait((m) => m.t === 'lost')).reason, 'revives');
  assert.equal((await ans('P28', 'LSSLLSL')).error, 'lost');
  assert.equal((await p.request({ t: 'retry' })).t, 'ok');
  s = await p.wait((m) => m.t === 'state' && m.act4 && !m.act4.lost && !m.solved.includes('P26')); // 第四幕的進度清掉
  assert.equal(s.revives, 3);
  // 時間到：判定輸
  await p.request({ t: 'dev', deadline: 300 });
  assert.equal((await p.wait((m) => m.t === 'lost', 5000)).reason, 'time');
  await p.request({ t: 'retry' });
  // 走完第四幕：P26、P28、屋頂 → 尾聲
  assert.equal((await ans('P26', ['A', 'B'])).solved, true);
  assert.equal((await ans('P28', 'LSSLLSL')).solved, true);
  assert.ok((await ans('P29', { cell: [3, 3] })).reply.broke); // 第一步不能從中間開始
  for (const cell of [[1, 5], [1, 4], [2, 4], [2, 3], [3, 3], [3, 2], [3, 1], [4, 1]]) assert.equal((await ans('P29', { cell })).reply.step > 0, true);
  assert.equal((await ans('P29', { cell: [4, 0] })).solved, true);
  assert.equal((await p.wait((m) => m.t === 'state' && m.segment === 'epilogue')).segment, 'epilogue');
  p.close();
});

test('第四幕多人：被拖進蝕巢、同伴救援、自救、全員被抓判定輸', async () => {
  const { rescueAnswer } = await import('../../server/judge.mjs');
  const code = await create('救援甲');
  const a = await player(code, '救援甲'), b = await player(code, '救援乙');
  await a.request({ t: 'char', char: 'elora' }); await b.request({ t: 'char', char: 'vaughn' });
  await a.request({ t: 'ready', ready: true }); await b.request({ t: 'ready', ready: true }); await a.request({ t: 'start' });
  await a.request({ t: 'dev', segment: 'act4' });
  await b.wait((m) => m.t === 'state' && m.segment === 'act4');
  // 只有負責算守夜人的人（房主）能說「抓到了」
  assert.equal((await b.request({ t: 'catch', uid: a.uid })).error, 'bad_args');
  assert.equal((await a.request({ t: 'catch', uid: b.uid })).t, 'ok');
  assert.equal((await b.wait((m) => m.t === 'grab')).uid, b.uid);
  await b.request({ t: 'caught' });
  let s = await a.wait((m) => m.t === 'state' && m.nest?.[b.uid]);
  const q = s.nest[b.uid];
  assert.ok(['R1', 'R2', 'R3', 'R4'].includes(q.r) && ['S1', 'S2', 'S3', 'S4'].includes(q.s));
  assert.equal((await b.request({ t: 'answer', pid: 'P26', value: ['A', 'B'] })).error, 'captured'); // 被綁著不能解題
  const peek = await a.request({ t: 'peek', pid: 'R', target: b.uid });
  assert.equal(peek.pid, q.r);
  assert.equal((await b.request({ t: 'peek', pid: 'S' })).pid, q.s);
  // 同伴救援：答錯不會放人；答對放人（本機測試才拿得到房間的亂數種子）
  const { seed } = await a.request({ t: 'dev', seed: true });
  const right = (pid, key) => rescueAnswer(pid, seed, key) ?? 'done'; // 畫面判斷的題目（R2、R4、S3）送出就算
  assert.equal((await b.request({ t: 'rescue', target: b.uid, value: 'x' })).error, 'bad_args'); // 不能自己救自己
  if (!['R2', 'R4'].includes(q.r)) assert.equal((await a.request({ t: 'rescue', target: b.uid, value: 'NOPE' })).solved, false);
  await sleep(3100); // 答錯要等 3 秒
  assert.equal((await a.request({ t: 'rescue', target: b.uid, value: right(q.r, `${b.uid}:0:R`) })).solved, true);
  assert.equal((await a.wait((m) => m.t === 'freed')).uid, b.uid);
  // 再被抓一次，這次自己解（自救題）
  await sleep(3100);
  await a.request({ t: 'catch', uid: b.uid }); await b.request({ t: 'caught' });
  const sp = (await b.request({ t: 'peek', pid: 'S' })).pid; // 這次抽到的自救題
  assert.equal((await b.request({ t: 'selfrescue', value: right(sp, `${b.uid}:1:S0`) })).solved, true);
  // 兩個人都被抓：判定輸
  await sleep(3100);
  await a.request({ t: 'catch', uid: b.uid }); await b.request({ t: 'caught' });
  await a.request({ t: 'catch', uid: a.uid }); await a.request({ t: 'caught' });
  assert.equal((await a.wait((m) => m.t === 'lost')).reason, 'captured');
  a.close(); b.close();
});
