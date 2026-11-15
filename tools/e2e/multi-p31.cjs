// 兩人連線測試 P31（哭泣的娃娃）：先 npm run build:plain、wrangler dev（.dev.vars 的 DEV_AUTH=1），再 node tools/e2e/multi-p31.cjs。需要 playwright。
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
  // 開發者工具：跳到第三幕B（A 是房主）
  await A.click('#btn-devtools'); await A.waitForTimeout(800); await A.locator('#devtools .dt-row button').nth(4).click(); await A.waitForTimeout(8000); await A.click('#btn-devtools'); await A.waitForTimeout(500);
  await clear(A); await clear(B);
  const seg = (p) => p.evaluate(() => document.querySelector('#hud-act, .act, #act')?.textContent ?? document.body.innerText.slice(0, 20));
  console.log('A', await seg(A), 'B', await seg(B));
  const tp = (p, x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__w.teleport({ x, z, yaw }), [x, z, yaw]);
  await tp(A, 126, -42, 0); await tp(B, 126, -40, 0); await A.waitForTimeout(2000);
  // 兩個人都吹熄油燈
  for (const p of [A, B]) await p.evaluate(() => dispatchEvent(new Event('ml-sob')));
  await A.waitForTimeout(4000);
  const which = (p) => p.evaluate(() => [window.__dolls.active(), window.__dolls.which()]);
  console.log('A', await which(A), 'B', await which(B));
  // B 抱錯一個
  const [, cry] = await which(B); const wrongI = (cry + 1) % 5;
  const DOLLS = [[120.8, -31.4], [131.3, -41.8], [120.8, -43.6], [128.2, -49.3], [126.6, -34.8]];
  const pick = async (p, i) => { const [x, z] = DOLLS[i]; await tp(p, x, z + 1.1, 0); await p.waitForTimeout(1200); await clear(p); await p.waitForTimeout(300); const id = await p.evaluate(() => window.__w.target()?.id); await p.keyboard.press('KeyE'); await p.waitForTimeout(3000); return id; };
  console.log('B picks', await pick(B, wrongI), 'toast', await B.textContent('#toast').catch(() => ''));
  console.log('after B wrong: A', await which(A), 'B', await which(B));
  // A 抱它原本聽到的那一個（應該已經換了 → 提示「哭聲換了地方」）
  const [, aCry] = await which(A);
  console.log('A picks', await pick(A, aCry), 'toast', await A.textContent('#toast').catch(() => ''));
  console.log('A now', await which(A));
  // A 抱新的那一個
  const [, aCry2] = await which(A);
  console.log('A picks again', await pick(A, aCry2), 'toast', await A.textContent('#toast').catch(() => ''));
  await B.waitForTimeout(4000);
  console.log('end: A', await which(A), 'B', await which(B), 'solved?', await B.evaluate(() => window.__w && document.body.innerText.includes('P31')));
  await b.close();
})();
