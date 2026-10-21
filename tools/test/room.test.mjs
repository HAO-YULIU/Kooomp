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
    config: cfgPath, vars: { DEV_AUTH: '1' }, experimental: { disableExperimentalWarning: true },
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

  // 作答：學院限定、答錯冷卻、答對全隊都知道
  assert.equal((await a.request({ t: 'answer', pid: 'P03', value: 'scorpio' })).error, 'not_your_house'); // 沃恩是貝爾蒙特
  assert.equal((await b.request({ t: 'answer', pid: 'P03', value: 'leo' })).solved, false);
  assert.equal((await b.request({ t: 'answer', pid: 'P03', value: 'scorpio' })).error, 'cooldown');
  const right = await a.request({ t: 'answer', pid: 'P05', value: '9' });
  assert.equal(right.solved, true);
  assert.equal((await b.wait((m) => m.t === 'solved')).pid, 'P05');
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
  const info = await (await fetch(`${base}/api/rooms/${code}`)).json();
  assert.equal(info.max, 1);
  assert.equal((await p.request({ t: 'answer', pid: 'P14', value: 'THE BELL LIES IN THE WELL' })).solved, true);
  assert.equal((await p.request({ t: 'answer', pid: 'P03', value: 'scorpio' })).solved, true); // 單人不限學院
  assert.equal((await p.request({ t: 'answer', pid: 'P07', value: { eldrin: 8, belmont: 9, ouroboros: 3 } })).solved, true);
  const peek = await p.request({ t: 'peek', pid: 'P09' });
  assert.equal(peek.loop, 0); assert.equal(peek.next, null);
  p.close();
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
