// 完整測試：模擬玩家從開房（連線）一路玩到「第一章完」。全部用真的點擊、按鍵、手指；走路照地圖找路，按住前進。
// 先：cd tools && npm run build:plain，再 npx wrangler dev（.dev.vars 的 DEV_AUTH=1），然後：
//   node tools/e2e/full-play.cjs 1        單人（電腦）
//   node tools/e2e/full-play.cjs 2        兩人（電腦開房＋手機加入）
//   node tools/e2e/full-play.cjs 4        四人（電腦×2、手機×2；其中一個用英文介面）
// 結果：最後列出所有發現的問題（畫面超出、網頁錯誤、卡住、解不開）。截圖在 /tmp/claude-0/shots（或環境變數 SHOTS）。
const { Player, sleep, issues, stamp, HOUSE_I, close } = require('./bot.cjs');
const N = +(process.argv[2] || 1);
const FROM = process.env.FROM || ''; // 只測某一段以後（例如 FROM=act4：用開發者工具跳過去；平常不用）

(async () => {
  const W = await import('../../game/src/data/world-ch1.mjs');
  const A4 = await import('../../game/src/data/act4-ch1.mjs');
  const D = await import('../../data/puzzles/ch1.mjs');
  const LIBD = await import('../../game/src/data/library-ch1.mjs');
  const TH = (id, room) => W.THINGS.find((t) => t.id === id && (!room || t.room === room));
  const houses = ['grimoire', 'belmont', 'eldrin', 'ouroboros'];
  const setups = {
    1: [{ name: '單人甲', mobile: false, house: 'grimoire' }],
    2: [{ name: '雙人甲', mobile: false, house: 'eldrin' }, { name: '雙人乙', mobile: true, house: 'ouroboros' }],
    4: [{ name: '四人甲', mobile: false, house: 'grimoire' }, { name: '四人乙', mobile: true, house: 'belmont' }, { name: '四人丙', mobile: false, house: 'eldrin', lang: 'en' }, { name: '四人丁', mobile: true, house: 'ouroboros' }],
  };
  void houses;
  const P = setups[N].map((s) => new Player(s.name, s));
  const host = P[0];
  const all = (fn) => Promise.all(P.map(fn));
  const solo = N === 1;
  const lang = 'zh'; // 謎題語言（房間設定）
  const result = { steps: [] };
  const step = (s) => { console.log(stamp(), '■■■', s); result.steps.push(`${stamp()} ${s}`); };

  try {
    // ================= 開始：18+、（手機）加入主畫面的建議、選單 =================
    step('打開遊戲：年齡提示、手機的加入主畫面建議、選單');
    await all(async (p) => {
      await p.open();
      if (p.lang === 'en') await p.tap('#s-age [data-lang="en"]');
      await p.checkLayout('年齡提示');
      await p.tap('#age-ok');
      if (p.mobile) {
        await p.page.locator('#s-home').waitFor({ state: 'visible', timeout: 15000 }).catch(() => p.issue('手機沒有出現「加入主畫面」的建議'));
        if (await p.page.isVisible('#s-home')) { await p.checkLayout('加入主畫面'); await p.shot('home-tip'); await p.tap('#home-skip'); }
      } else if (await p.page.isVisible('#s-home')) p.issue('電腦也出現了加入主畫面的建議');
      await p.page.locator('#s-menu').waitFor({ state: 'visible' });
      await p.checkLayout('選單');
    });
    // ================= 開房、加入、分學院、選角色、準備、出發 =================
    step(solo ? '單人開始' : `開房（${N} 人）、其他人輸入房號加入`);
    await host.page.selectOption('#plang', lang);
    await host.tap(solo ? '#btn-solo' : '#btn-create');
    await host.page.locator('#s-wait').waitFor({ state: 'visible' });
    if (!solo) {
      await host.page.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.getElementById('room-code').textContent.trim()));
      const code = (await host.page.textContent('#room-code')).trim(); step(`房號 ${code}`);
      for (const p of P.slice(1)) { await p.type('#join-code', code); await p.tap('#btn-join'); await p.page.locator('#s-wait').waitFor({ state: 'visible' }); await sleep(800); }
    }
    for (const p of P) { // 分院鏡：每題選自己學院的那個答案（一個一個來，免得同時搶同一個角色）
      await p.page.locator('.choice').first().waitFor({ state: 'visible', timeout: 30000 });
      await p.checkLayout('分院鏡');
      for (let i = 0; i < 30; i++) {
        const n = await p.page.locator('#panel .choice').count();
        if (!n) { if (i > 2 && !(await p.st().catch(() => null))?.panel) break; await sleep(500); continue; }
        await p.tap(p.page.locator('#panel .choice').nth(HOUSE_I[p.house])); await sleep(450);
      }
      await p.page.waitForFunction(() => document.getElementById('panel').hidden, null, { timeout: 30000 });
      // 選角色：點自己學院的角色卡
      const card = p.page.locator('#char-pick button').nth(['yuexi', 'vaughn', 'elora', 'cyril'].indexOf(p.char));
      await sleep(800); await p.tap(card); await sleep(800);
      await p.checkLayout('等待室');
      await p.tap('#btn-ready'); await sleep(800);
    }
    await host.shot('wait-room');
    await host.page.waitForFunction((n) => document.querySelectorAll('#member-list li').length === n && [...document.querySelectorAll('#member-list li')].every((li) => li.textContent.includes('✔')), N, { timeout: 60000 });
    await host.tap('#btn-start');
    step('出發：等大家載入');
    await all(async (p) => {
      await p.page.locator('#loading').waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
      await p.page.locator('#loading').waitFor({ state: 'hidden', timeout: 600000 });
      await p.page.waitForFunction(() => window.__w && window.__ml, null, { timeout: 60000 });
      await sleep(1500);
      // 第一次玩：新手教學（一步一步按下一步）
      for (let i = 0; i < 12; i++) { const b = p.page.locator('#panel .tut-nav button.primary'); if (!(await b.count())) break; await p.tap(b); await sleep(300); }
      await p.checkLayout('遊戲中');
      await p.clearTalk();
    });
    await host.shot('in-game');
    if (FROM) { step(`（跳到 ${FROM}）`); await host.tap('#btn-devtools'); await sleep(800); await host.tap(host.page.locator('#devtools button', { hasText: FROM }).first()); await sleep(8000); await host.tap('#btn-devtools').catch(() => {}); await all((p) => p.clearTalk()); }
    const seg = async () => (await host.st()).seg;
    const after = (s) => ['prologue', 'act1', 'act2', 'act3a', 'act3b', 'act3c', 'act4', 'epilogue'].indexOf(s);
    const waitSeg = (s) => all((p) => p.waitFor((x) => window.__ml?.state.segment === x, s, { ms: 120000, label: `進到 ${s}` }));

    // ================= 序幕：碼頭 → 大廳 → 宴會廳，聽傳聞，回答 P02 =================
    if (after(await seg()) <= 0) {
      step('序幕：從碼頭走到宴會廳，在四張長桌聽傳聞');
      await all(async (p, i) => {
        await p.walk({ x: 0, z: 128, tol: 1.5 }, { label: '大廳' });
        const tables = ['table1', 'table2', 'table3', 'table4'];
        for (const id of solo ? tables : tables.filter((_, k) => k % N === P.indexOf(p) || p === host)) { const th = TH(id); await p.inspect({ ...th, x: th.x + 1.2, z: 125 + (i - 1.5) * 3, size: [0.2, 1, 0.2], id: th.id, alt: [th.id] }, { label: id }); await p.clearTalk(); }
      });
      step('序幕：P02 整理傳聞');
      await host.inspect(TH('seat')); await host.checkLayout('P02');
      const ans = D.CHAPTER1.P02.ans[lang].map((a) => a[0]);
      const inputs = host.page.locator('#panel-body input');
      // 先故意答錯一次
      for (let k = 0; k < 3; k++) await host.type(inputs.nth(k), ['南翼', '紅色', '十二'][k]);
      await host.tap(host.page.locator('#panel-body > div > div.row > button').last()); await sleep(1500);
      host.log('答錯：', await host.status());
      await sleep(6000); // 答錯的冷卻
      for (let k = 0; k < 3; k++) await host.type(inputs.nth(k), ans[k]);
      await host.tap(host.page.locator('#panel-body > div > div.row > button').last());
      await host.waitSolved('P02');
      await waitSeg('act1');
    }

    // ================= 第一幕：各自的宿舍門鎖 → 燭光（電腦的同伴）→ 星盤廳的星盤 =================
    if (after(await seg()) <= 1) {
      step('第一幕：各自解自己宿舍的門鎖');
      await all((p) => p.clearTalk());
      await all(async (p) => {
        if (p.house === 'grimoire') {
          await p.inspect(TH('runechart')); await p.checkLayout('P04 符文表'); await p.closePanel();
          await p.inspect(TH('lock_grimoire')); await p.type('#panel-body input.num', '11'); await p.tap(p.page.locator('#panel-body .row button').last());
        } else if (p.house === 'belmont') {
          await p.inspect(TH('scale')); await p.type('#panel-body input.num', '9'); await p.tap(p.page.locator('#panel-body .row button').last());
        } else if (p.house === 'eldrin') {
          await p.walk({ rect: TH('lock_eldrin'), reach: 1.6 }, { label: '星座鎖前' });
          const s = await p.st(); await p.turnTo(Math.atan2(-(9.4 - s.x), -(0 - s.z)));
          // 光照咒：按 F（手機按魔杖），在畫面上畫一個圓
          if (p.mobile) await p.tap('#btn-wand'); else await p.page.keyboard.press('KeyF');
          await p.page.locator('canvas.rune-canvas').waitFor({ state: 'visible' }); await sleep(400);
          const box = await p.page.locator('canvas.rune-canvas').boundingBox();
          const cx = box.x + box.width / 2, cy = box.y + box.height / 2, r = Math.min(box.width, box.height) * 0.32;
          const pts = Array.from({ length: 33 }, (_, k) => [cx + r * Math.cos(-Math.PI / 2 + (k / 32) * Math.PI * 2), cy + r * Math.sin(-Math.PI / 2 + (k / 32) * Math.PI * 2)]);
          if (p.mobile) {
            const tp = ([x, y]) => ({ x, y, id: 3, radiusX: 3, radiusY: 3, force: 1 });
            await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(pts[0])] });
            for (const q of pts.slice(1)) { await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [tp(q)] }); await sleep(15); }
            await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          } else { await p.page.mouse.move(...pts[0]); await p.page.mouse.down(); for (const q of pts.slice(1)) { await p.page.mouse.move(...q, { steps: 2 }); } await p.page.mouse.up(); }
          await sleep(1500);
          await p.inspect(TH('lock_eldrin')); await p.checkLayout('P03');
          if (!/[♈♏]/.test(await p.panelText())) p.issue('P03 沒有星座按鈕');
          await p.tap(p.page.locator('#panel-body .zodiac button').nth(7)); // 天蠍
        } else if (p.house === 'ouroboros') {
          await p.inspect(TH('hourglass')); await p.checkLayout('P06');
          const flip7 = p.page.locator('#panel-body .glass button').first(), row = p.page.locator('#panel-body > div > div.row').last().locator('button');
          const t0 = Date.now(); const at = async (sec) => { const w = t0 + sec * 1000 - Date.now(); if (w > 0) await sleep(w); };
          await p.tap(row.nth(0)); // 兩個一起翻
          await at(7); await p.tap(flip7); await at(11); await p.tap(flip7); await at(15); await p.tap(row.nth(1)); // 敲門
        }
        const pid = { grimoire: 'P04', belmont: 'P05', eldrin: 'P03', ouroboros: 'P06' }[p.house];
        if (!(await p.waitSolved(pid, 20000))) { p.issue(`${pid} 沒解開：${await p.status()}`); await p.shot(`fail-${pid}`); }
        await p.closePanel(); await p.clearTalk();
      });
      // 燭光（P07）：沒有人選的學院由電腦控制，從窗戶看燭光的摩斯密碼
      if (N < 4) {
        step('第一幕：P07 看電腦同伴的燭光');
        const win = TH(`window_${host.house}`);
        await host.inspect(win); await host.checkLayout('P07'); await sleep(1500);
        const rows = host.page.locator('#panel-body .row.tower');
        const names = { eldrin: /艾爾德林|Eldrin/, grimoire: /格里莫瓦|Grimoire/, belmont: /貝爾蒙特|Belmont/, ouroboros: /烏洛波斯|Ouroboros/ };
        for (let k = 0; k < (await rows.count()); k++) {
          const txt = await rows.nth(k).innerText(); const h = Object.keys(names).find((x) => names[x].test(txt));
          await host.tap(rows.nth(k).locator('button')); // 看燭光
          await host.type(rows.nth(k).locator('input'), String(D.HOUSE_HOUR[h]));
        }
        await host.tap(host.page.locator('#panel-body > div > button').last());
        if (!(await host.waitSolved('P07', 20000))) host.issue(`P07 沒解開：${await host.status()}`);
        await host.closePanel(); await host.clearTalk();
      }
      step('第一幕：大家到星盤廳集合（小心赫爾嘉夫人的提燈），對星盤');
      await all(async (p) => { await p.walk({ x: (P.indexOf(p) - 1.5) * 1.2, z: 3.2, tol: 0.8 }, { label: '星盤廳' }); });
      await host.inspect(TH('disk'), { reach: 2.4 }); await host.checkLayout('P08');
      const ring = D.CHAPTER1.P08.ans.split(',');
      const rows = host.page.locator('#panel-body .row');
      for (let k = 0; k < 4; k++) { const [h, n] = ring[k].split(':'); await rows.nth(k).locator('select').nth(0).selectOption(h); await rows.nth(k).locator('select').nth(1).selectOption(n); }
      await host.tap(host.page.locator('#panel-body > div > button').last());
      if (!(await host.waitSolved('P08', 20000))) host.issue(`P08 沒解開：${await host.status()}`);
      await waitSeg('act2');
    }
    result.reached = await seg();
  } catch (e) {
    console.log('測試中斷：', e.message.split('\n')[0]); issues.push(`測試中斷：${e.message.split('\n')[0]}`);
    for (const p of P) await p.shot('crash');
  }
  result.reached = await P[0].st().then((s) => s?.seg).catch(() => '?');
  console.log('\n======== 結果 ========');
  console.log(result.steps.join('\n'));
  console.log('到達：', result.reached);
  console.log(issues.length ? `問題 ${issues.length} 個：\n- ${issues.join('\n- ')}` : '沒有發現問題');
  await close();
  process.exit(0);
})();
