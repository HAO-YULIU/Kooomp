// 驗證（短版，單人手機）：加入主畫面建議、第四幕遠距作答（走到過才能遠距、解開後不傳送、門會開）。
const { Player, sleep, issues, close } = require('./bot.cjs');
(async () => {
  const A4 = await import('../../game/src/data/act4-ch1.mjs');
  const B = new Player('單手機', { mobile: true, house: 'belmont' });
  const log = (x) => console.log('✔步驟', x);
  setTimeout(() => { console.log('========（超時）'); process.exit(1); }, 25 * 60000);
  try {
    await B.open(); await B.tap('#age-ok');
    await B.page.locator('#s-home').waitFor({ state: 'visible', timeout: 15000 }); await B.checkLayout('加入主畫面'); await B.shot('home-tip');
    log(`加入主畫面建議出現（${await B.page.locator('#home-steps li').count()} 個步驟）`); await B.tap('#home-skip');
    await B.page.locator('#s-menu').waitFor({ state: 'visible' }); log('選單');
    await B.tap('#btn-solo'); await B.page.locator('#panel .choice').first().waitFor({ state: 'visible' });
    for (let i = 0; i < 30; i++) { const n = await B.page.locator('#panel .choice').count(); if (!n) { if (i > 2) break; await sleep(500); continue; } await B.tap(B.page.locator('#panel .choice').nth(2)); await sleep(450); }
    await B.page.waitForFunction(() => document.getElementById('panel').hidden); await sleep(800); await B.tap('#btn-ready'); await sleep(1000); await B.tap('#btn-start'); log('出發');
    await B.page.locator('#loading').waitFor({ state: 'hidden', timeout: 900000 }); await B.page.waitForFunction(() => window.__w && window.__ml); log('載入完成');
    for (let i = 0; i < 12; i++) { const b = B.page.locator('#panel .tut-nav button.primary'); if (!(await b.count())) break; await B.tap(b); await sleep(300); }
    await B.clearTalk();
    await B.tap('#btn-devtools'); await sleep(800); await B.tap(B.page.locator('#devtools .dt-row button').nth(6)); await sleep(9000); await B.tap('#btn-devtools');
    await B.clearTalk(); await sleep(3000); await B.clearTalk();
    log(`第四幕：${(await B.st()).seg}；「謎題」按鈕${(await B.page.isVisible('#btn-remote')) ? '有' : '沒有'}`);
    await B.tap('#btn-remote'); await sleep(800); log(`還沒走到時的清單：${await B.page.locator('#panel .remote-item').count()} 題`); await B.checkLayout('遠距清單'); await B.closePanel();
    await B.inspect(A4.A4_THINGS.find((t) => t.id === 'ironDoor')); await B.checkLayout('P26');
    log(`走到鐵門調查：${(await B.st()).panel ? '視窗打開' : '沒打開'}`); await B.closePanel();
    await B.walk({ x: 101, z: 3, tol: 0.5 }, { label: '書架縫' });
    const before = await B.st();
    await B.tap('#btn-remote'); await sleep(800); log(`躲在 ${before.zone}（${before.x},${before.z}），清單 ${await B.page.locator('#panel .remote-item').count()} 題`);
    await B.tap(B.page.locator('#panel .remote-item').first()); await sleep(800);
    await B.tapText('A'); await B.tapText('B'); await B.tapText('推門');
    const ok = await B.waitSolved('P26', 20000); await sleep(2500); await B.clearTalk();
    const after = await B.st();
    log(`遠距解開 P26：${ok ? '成功' : '失敗'}；之後位置 ${after.zone}（${after.x},${after.z}）→ ${Math.hypot(after.x - before.x, after.z - before.z) < 1 ? '沒有被傳送' : '被移動了！'}`);
    log(`鐵門：${(await B.page.evaluate(() => window.__w.world.doorState.get('pass-gears')?.open)) ? '打開了' : '還關著'}`);
    log(`網頁錯誤 ${B.errors.length} 個`);
  } catch (e) { issues.push(`中斷：${e.message.split('\n')[0]}`); await B.shot('verify-crash'); }
  console.log('========'); console.log(issues.length ? `問題：\n- ${issues.join('\n- ')}` : '沒有發現問題');
  await close(); process.exit(0);
})();
