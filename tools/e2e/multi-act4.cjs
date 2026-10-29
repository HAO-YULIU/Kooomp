// 兩人連線測試第四幕：房主用開發者工具讓守夜人抓走乙 → 乙被綁進蝕巢 → 甲走過去解救援題 → 乙被放出來。先 npm run build:plain、wrangler dev（.dev.vars 的 DEV_AUTH=1），再 node tools/e2e/multi-act4.cjs。
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const mk = async (name) => { const p = await (await b.newContext({ viewport: { width: 1000, height: 600 } })).newPage(); p.setDefaultTimeout(400000); p.on('pageerror', (e) => console.log('ERR', name, e.message)); await p.goto(`http://localhost:8787/?dev=${name}`); await p.waitForTimeout(2500); await p.evaluate(() => localStorage.setItem('ml_tutorial_seen', '1')); if (await p.isVisible('#age-ok')) await p.click('#age-ok'); await p.waitForTimeout(2500); return p; };
  const A = await mk('甲'), B = await mk('乙');
  await A.click('#btn-create'); await A.waitForTimeout(3000);
  for (let i = 0; i < 8; i++) { await A.locator('.choice').nth(1).click(); await A.waitForTimeout(150); }
  const code = (await A.textContent('#room-code')).trim(); console.log('code', code);
  await B.fill('#join-code', code); await B.click('#btn-join'); await B.waitForTimeout(3000);
  for (let i = 0; i < 8; i++) { await B.locator('.choice').nth(2).click(); await B.waitForTimeout(150); }
  await A.waitForTimeout(3000); await B.waitForTimeout(1000);
  console.log('chars', await A.evaluate(() => [...document.querySelectorAll('#char-pick button.on, #char-pick button.mine')].map((b) => b.textContent).join('|')));
  await A.click('#btn-ready'); await B.click('#btn-ready'); await A.waitForTimeout(1500);
  await A.click('#btn-start');
  await Promise.all([A, B].map((p) => p.waitForSelector('#loading', { state: 'hidden', timeout: 400000 })));
  console.log('both loaded');
  const clear = async (p) => { for (let k = 0; k < 8; k++) { await p.keyboard.press('Space'); await p.waitForTimeout(150); } };
  await clear(A); await clear(B);
  await A.click('#btn-devtools'); await A.waitForTimeout(800); await A.locator('#devtools .dt-row button').nth(6).click(); await A.waitForTimeout(10000); await A.click('#btn-devtools'); await A.waitForTimeout(500);
  await clear(A); await clear(B); await A.waitForTimeout(2000); await clear(A); await clear(B);
  const st = (p) => p.evaluate(() => ({ grab: !document.getElementById('a4grab').hidden, bound: !document.getElementById('a4bound').hidden, lost: !document.getElementById('a4lost').hidden, clock: document.getElementById('a4clock')?.textContent, zone: window.__w.zone() }));
  console.log('A', JSON.stringify(await st(A)), 'B', JSON.stringify(await st(B)));
  await A.click('#btn-devtools'); await A.waitForTimeout(1200);
  const grabBtn = A.locator('#devtools button', { hasText: '抓走乙' }); console.log('grab buttons', await grabBtn.count());
  await A.evaluate(() => [...document.querySelectorAll('#devtools button')].find((b) => b.textContent === '抓走乙')?.click()); await A.waitForTimeout(800); await A.click('#btn-devtools');
  for (let k = 0; k < 6; k++) { await B.waitForTimeout(700); console.log('B', k, JSON.stringify(await st(B))); }
  await B.screenshot({ path: '/tmp/claude-0/shots/a4-B.png' });
  // A 走到蝕巢救人
  await A.evaluate(() => window.__w.teleport({ x: 168, z: 2, yaw: -Math.PI / 2 })); await A.waitForTimeout(2000); await clear(A);
  console.log('A target', await A.evaluate(() => window.__w.target()?.id));
  await A.keyboard.press('KeyE'); await A.waitForTimeout(3000);
  console.log('A panel', await A.evaluate(() => [document.getElementById('panel-title')?.textContent, document.getElementById('panel-body')?.innerText.slice(0, 200)]));
  await A.screenshot({ path: '/tmp/claude-0/shots/a4-A.png' });
  const body = await A.evaluate(() => document.getElementById('panel-body').innerText);
  if (/元素/.test(body)) { // R1：依序點燃剋制的元素
    const roots = [...body.split('＿')[0].matchAll(/[火水風土]/g)].map((m) => m[0]).slice(-4);
    const counter = { 火: '水', 風: '火', 土: '風', 水: '土' };
    console.log('roots', roots.join(''), '->', roots.map((r) => counter[r]).join(''));
    for (const r of roots) { await A.evaluate((el) => [...document.querySelectorAll('#panel-body button')].find((b) => b.textContent.includes(el))?.click(), counter[r]); await A.waitForTimeout(400); }
    await A.evaluate(() => [...document.querySelectorAll('#panel-body button')].find((b) => b.textContent === '作答')?.click()); await A.waitForTimeout(3000);
  } else if (!/位移/.test(body)) { // 轉導管、記憶翻牌：畫面判斷完成才回報，這裡直接回報
    console.log('event rescue', JSON.stringify(await A.evaluate(() => { const b = window.__S().members.find((m) => m.name === '乙'); return window.__conn.request({ t: 'rescue', target: b.uid, value: true }); })));
  } else {
    const cipher = body.match(/\n([A-Z]{3,})\n/)?.[1] ?? '';
    const plain = cipher.replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 - 9) % 26 + 26) % 26 + 65)); console.log('cipher', cipher, '->', plain);
    await A.evaluate((v) => { const i = document.querySelector('#panel-body input'); i.value = v; }, plain);
    await A.evaluate(() => [...document.querySelectorAll('#panel-body button')].find((b) => b.textContent === '作答')?.click()); await A.waitForTimeout(3000);
  }
  console.log('A after', await A.evaluate(() => document.getElementById('panel-body')?.innerText.slice(0, 120)));
  for (let k = 0; k < 4; k++) { await B.waitForTimeout(1500); console.log('B freed?', k, JSON.stringify(await st(B))); }
  await B.screenshot({ path: '/tmp/claude-0/shots/a4-B2.png' });
  await b.close();
})();
