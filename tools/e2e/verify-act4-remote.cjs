// 驗證：手機的「加入主畫面」建議、第四幕遠距作答（走到過的謎題可以在別處解，解開後不會傳送）、多人時守夜人的位置平滑。
// 先 npm run build:plain、wrangler dev（DEV_AUTH=1），再 node tools/e2e/verify-act4-remote.cjs
const { Player, sleep, issues, close } = require('./bot.cjs');
(async () => {
  const A4 = await import('../../game/src/data/act4-ch1.mjs');
  const TH = (id) => A4.A4_THINGS.find((t) => t.id === id);
  const A = new Player('驗證甲', { house: 'grimoire' }), B = new Player('驗證乙', { mobile: true, house: 'belmont' });
  const out = [];
  try {
    for (const p of [A, B]) {
      await p.open(); await p.tap('#age-ok');
      if (p.mobile) { await p.page.locator('#s-home').waitFor({ state: 'visible', timeout: 15000 }); await p.checkLayout('加入主畫面'); await p.shot('home-tip'); out.push(`手機：加入主畫面建議 ✔（步驟 ${await p.page.locator('#home-steps li').count()} 條）`); await p.tap('#home-skip'); }
      await p.page.locator('#s-menu').waitFor({ state: 'visible' });
    }
    await A.tap('#btn-create'); await A.page.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.getElementById('room-code').textContent.trim()));
    const code = (await A.page.textContent('#room-code')).trim();
    await B.type('#join-code', code); await B.tap('#btn-join'); await B.page.locator('#s-wait').waitFor({ state: 'visible' });
    for (const p of [A, B]) {
      await p.page.locator('#panel .choice').first().waitFor({ state: 'visible' });
      for (let i = 0; i < 30; i++) { const n = await p.page.locator('#panel .choice').count(); if (!n) { if (i > 2) break; await sleep(500); continue; } await p.tap(p.page.locator('#panel .choice').nth(p.house === 'grimoire' ? 1 : 2)); await sleep(450); }
      await p.page.waitForFunction(() => document.getElementById('panel').hidden);
      await sleep(800); await p.tap('#btn-ready'); await sleep(800);
    }
    await A.page.waitForFunction(() => [...document.querySelectorAll('#member-list li')].filter((li) => li.textContent.includes('✔')).length === 2);
    await A.tap('#btn-start');
    await Promise.all([A, B].map(async (p) => { await p.page.locator('#loading').waitFor({ state: 'hidden', timeout: 600000 }); await p.page.waitForFunction(() => window.__w && window.__ml); await sleep(1500); for (let i = 0; i < 12; i++) { const b = p.page.locator('#panel .tut-nav button.primary'); if (!(await b.count())) break; await p.tap(b); await sleep(300); } await p.clearTalk(); }));
    out.push('兩人連線、載入 ✔');
    // 跳到第四幕（開發者工具）
    await A.tap('#btn-devtools'); await sleep(800); await A.tap(A.page.locator('#devtools .dt-row button').nth(6)); await sleep(9000); await A.tap('#btn-devtools');
    await Promise.all([A, B].map((p) => p.clearTalk())); await sleep(3000); await Promise.all([A, B].map((p) => p.clearTalk()));
    const sA = await A.st(), sB = await B.st();
    await Promise.all([A, B].map((p) => p.clearTalk())); out.push(`第四幕：甲 ${sA.seg}、乙 ${sB.seg}；「謎題」按鈕 甲${(await A.page.isVisible('#btn-remote')) ? '有' : '沒有'}、乙${(await B.page.isVisible('#btn-remote')) ? '有' : '沒有'}`);
    await B.checkLayout('第四幕');
    // 還沒走到任何謎題：清單是空的
    await B.tap('#btn-remote'); await sleep(800);
    out.push(`遠距清單（還沒走到）：${(await B.panelText()).replace(/\s+/g, ' ').slice(0, 80)}`);
    await B.checkLayout('遠距清單'); await B.closePanel();
    // 手機玩家走到鐵門前調查一次（真的走路）
    const door = TH('ironDoor');
    await B.inspect(door); await B.checkLayout('P26');
    out.push(`走到鐵門調查：${(await B.st()).panel ? '打開了視窗' : '沒打開'}；提示「${(await B.st()).toast}」`);
    await B.closePanel();
    // 走回入口大廳的書架縫躲起來
    await B.walk({ x: 101, z: 3, tol: 0.5 }, { label: '書架縫' });
    const before = await B.st();
    await B.tap('#btn-remote'); await sleep(800);
    const items = await B.page.locator('#panel .remote-item').count();
    out.push(`躲在書架縫（${before.zone}，${before.x},${before.z}）按「謎題」：清單 ${items} 題`);
    await B.shot('remote-list');
    await B.tap(B.page.locator('#panel .remote-item').first()); await sleep(800);
    await B.tapText('A'); await B.tapText('B'); await sleep(300);
    await B.tapText('推門');
    const solved = await B.waitSolved('P26', 20000);
    await sleep(2500); await B.clearTalk();
    const after = await B.st();
    out.push(`遠距解開 P26：${solved ? '✔' : '✘'}；解開後位置 ${after.zone}（${after.x},${after.z}）${Math.hypot(after.x - before.x, after.z - before.z) < 1 ? '沒有被傳送 ✔' : '被移動了 ✘'}`);
    const doorOpen = await A.page.evaluate(() => window.__w.world.doorState.get('pass-gears')?.open);
    out.push(`鐵門（pass-gears）在甲的畫面：${doorOpen ? '打開 ✔' : '還關著 ✘'}`);
    await B.tap('#btn-remote'); await sleep(600); out.push(`解開後清單：${await B.page.locator('#panel .remote-item').count()} 題`); await B.closePanel();
    // 守夜人：乙（不是房主）看到的位置，連續取樣看跳動
    const samples = [];
    for (let i = 0; i < 20; i++) { samples.push(await B.page.evaluate(() => { const w = window.__ml.act4.dev?.warden?.(); return w ? [+w.x.toFixed(2), +w.z.toFixed(2), w.mode] : null; })); await sleep(250); }
    out.push(`乙看到的守夜人位置取樣：${JSON.stringify(samples.filter(Boolean).slice(0, 8))}…`);
    out.push(`網頁錯誤：甲 ${A.errors.length}、乙 ${B.errors.length}`);
  } catch (e) { issues.push(`中斷：${e.message.split('\n')[0]}`); await A.shot('verify-crash'); await B.shot('verify-crash'); }
  console.log('\n======== 驗證結果 ========\n' + out.join('\n'));
  console.log(issues.length ? `問題：\n- ${issues.join('\n- ')}` : '沒有發現問題');
  await close(); process.exit(0);
})();
