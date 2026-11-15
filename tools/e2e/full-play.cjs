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
        await host.tap(host.page.locator('#panel-body > div:first-child > button').last());
        if (!(await host.waitSolved('P07', 20000))) host.issue(`P07 沒解開：${await host.status()}`);
        await host.closePanel(); await host.clearTalk();
      }
      step('第一幕：大家到星盤廳集合（小心赫爾嘉夫人的提燈），對星盤');
      await all(async (p) => { await p.walk({ x: (P.indexOf(p) - 1.5) * 1.2, z: 3.2, tol: 0.8 }, { label: '星盤廳' }); });
      await host.inspect(TH('disk'), { reach: 2.4 }); await host.checkLayout('P08');
      const ring = D.CHAPTER1.P08.ans.split(',');
      const rows = host.page.locator('#panel-body .row');
      for (let k = 0; k < 4; k++) { const [h, n] = ring[k].split(':'); await rows.nth(k).locator('select').nth(0).selectOption(h); await rows.nth(k).locator('select').nth(1).selectOption(n); }
      await host.tap(host.page.locator('#panel-body > div:first-child > button').last());
      if (!(await host.waitSolved('P08', 20000))) host.issue(`P08 沒解開：${await host.status()}`);
      await waitSeg('act2');
    }

    const MAIN = '#panel-body > div:first-child';
    const by = (h) => P.find((p) => p.house === h) ?? host; // 有這個學院的玩家就由他做（電腦控制的學院誰都可以）
    const solveCheck = async (p, pid, ms = 25000) => { if (!(await p.waitSolved(pid, ms))) { p.issue(`${pid} 沒解開：${await p.status()}`); await p.shot(`fail-${pid}`); } await p.closePanel(); await p.clearTalk(); };
    const numAnswer = async (p, v) => { await p.type(`${MAIN} input`, v); await p.tap(p.page.locator(`${MAIN} .row button`).last()); };
    // ================= 第二幕：北翼走廊（閃電中的她）→ 異常長廊 → 創辦人的房間 =================
    if (after(await seg()) <= 2) {
      step('第二幕：熄掉油燈等閃電（P30），回答字母鎖');
      await all((p) => p.walk({ x: (P.indexOf(p) - 1.5) * 0.9, z: -12.5, tol: 0.8 }, { label: '北翼走廊' }));
      await host.inspect(TH('nh_lamp'));
      await host.waitFor(() => window.__w.isDark(), null, { ms: 20000, label: '油燈熄了' });
      await host.waitFor(() => !window.__w.isDark(), null, { ms: 300000, label: '閃電結束' });
      await host.inspect(TH('nh_lock')); await host.checkLayout('P30');
      await host.type(`${MAIN} input`, 'LIANA'); await host.tap(host.page.locator(`${MAIN} .row button`).last());
      await solveCheck(host, 'P30');
      step('第二幕：異常長廊（P09）：有異常就回頭，沒有就推開盡頭的門，連續 8 次');
      const loopDoor = TH('loop_door');
      for (let round = 0; round < 30 && !(await host.st()).solved.includes('P09'); round++) {
        const pk = await host.page.evaluate(() => window.__ml.conn.request({ t: 'peek', pid: 'P09' }));
        if (pk.t !== 'peek') break;
        const anomaly = pk.next?.id ?? null; host.log(`第 ${round + 1} 趟：${anomaly ? `有異常（${anomaly}）→ 回頭` : '沒有異常 → 往前'}`);
        await all(async (p) => {
          await p.walk({ x: (P.indexOf(p) - 1.5) * 0.8, z: -33, tol: 1 }, { label: '長廊裡' });
          if (anomaly) await p.walk({ x: 0, z: -15, tol: 1.2 }, { label: '回頭' }); else await p.inspect(loopDoor);
        });
        await host.waitFor((n) => window.__ml.state.solved.includes('P09') || window.__ml.conn.request({ t: 'peek', pid: 'P09' }).then((r) => r.loop !== n), pk.loop, { ms: 60000, label: '長廊的下一趟' });
        await sleep(1500);
      }
      if (!(await host.st()).solved.includes('P09')) host.issue('P09 異常長廊沒過');
      step('第二幕：創辦人的房間：熄燭火、畫像的鎖（P10）');
      await all((p) => p.walk({ x: (P.indexOf(p) - 1.5) * 1.2, z: -68, tol: 1 }, { label: '創辦人的房間' }));
      await host.inspect(TH('snuffer')); await host.clearTalk(); await sleep(2000);
      await host.inspect(TH('founder_painting')); await host.checkLayout('P10');
      await host.tap(host.page.locator(`${MAIN} .compass button`, { hasText: /^NW$/ }));
      await host.type(`${MAIN} .row input`, '1626'); await host.tap(host.page.locator(`${MAIN} .row button`).last());
      await solveCheck(host, 'P10');
      await waitSeg('act3a');
    }
    // ================= 第三幕前段：圖書館入口、書架迷宮 =================
    if (after(await seg()) <= 3) {
      step('第三幕：提燈箱（P11）、柵門的影子（P12）');
      await all((p) => p.clearTalk());
      await host.inspect(TH('senior')); await host.closePanel(); await host.clearTalk();
      await host.inspect(TH('lampbox')); await numAnswer(host, '257'); await solveCheck(host, 'P11');
      await host.inspect(TH('mark'), { reach: 0.8 }); await host.checkLayout('P12'); await sleep(1500);
      const elems = host.page.locator(`${MAIN} .row`).last().locator('button');
      for (const k of [0, 1, 2, 3]) await host.tap(elems.nth(k));
      await host.tap(elems.last()); await solveCheck(host, 'P12');
      step('第三幕：書架迷宮：翻書（P14）、走到出口（P13）');
      await all((p) => p.walk({ x: 109 + P.indexOf(p) * 0.6, z: -4, tol: 1 }, { label: '迷宮入口' }));
      await host.inspect(TH('books'), { reach: 2.2 }); await host.checkLayout('P14');
      await host.type(`${MAIN} .row input`, D.CHAPTER1.P14.ans[lang]); // 先用書號、頁碼翻開也可以；直接寫解出來的字
      await host.tap(host.page.locator(`${MAIN} .row`).last().locator('button'));
      await solveCheck(host, 'P14');
      await all((p) => p.walk({ x: 127, z: -27, tol: 1.2 }, { label: '迷宮出口', maxMs: 400000 }));
      await host.waitSolved('P13', 30000);
      await waitSeg('act3b');
    }
    // ================= 第三幕中段：閱覽室 =================
    if (after(await seg()) <= 4) {
      step('第三幕：閱覽室：第七張桌子（P15）、翻頁的書（P16）、東方典藏櫃（P17）、哭泣的娃娃（P31）');
      await all((p) => p.walk({ x: 126 + P.indexOf(p) * 0.7, z: -34, tol: 1 }, { label: '閱覽室' }));
      await host.inspect(TH('desk7')); await numAnswer(host, '3141'); await solveCheck(host, 'P15');
      const p2 = P[1] ?? host;
      await p2.inspect(TH('flipbook')); await p2.type(`${MAIN} .row input`, '33'); await p2.tap(p2.page.locator(`${MAIN} .row button`).last()); await solveCheck(p2, 'P16');
      await host.inspect(TH('eastern')); await host.tap(`${MAIN} .hexagram button[title="3"]`); await host.tap(host.page.locator(`${MAIN} > button`).last()); await solveCheck(host, 'P17');
      await host.inspect(TH('sob_lamp')); await host.tap(host.page.locator(`${MAIN} > button`).last());
      await sleep(2500);
      const pk = await host.page.evaluate(() => window.__ml.conn.request({ t: 'peek', pid: 'P31' }));
      const doll = TH(`doll${pk.content?.doll}`); host.log('在哭的娃娃：', doll?.id);
      if (doll) { await host.inspect(doll, { reach: 1.4 }); await host.waitSolved('P31', 20000); } else host.issue('P31 不知道哪個娃娃在哭');
      await waitSeg('act3c');
    }
    // ================= 第三幕後段：前廳、暗室、古井 =================
    if (after(await seg()) <= 5) {
      step('第三幕：前廳：符文大門（P18）、月光反射（P19）、推石像（P20）、煉金天平（P21）');
      await all((p) => p.walk({ x: 124 + P.indexOf(p) * 0.8, z: -53.5, tol: 1 }, { label: '前廳' }));
      await host.inspect(TH('runedoor')); await host.checkLayout('P18');
      for (const g of ['ᛒ', 'ᛚ', 'ᛁ', 'ᚷ', 'ᚺ', 'ᛏ']) await host.tap(host.page.locator(`${MAIN} .runering button`, { hasText: g }));
      await host.tap(host.page.locator(`${MAIN} .row button`).last()); await solveCheck(host, 'P18');
      // P19：鏡子（艾爾德林）。用題目的格子算出每座鏡子要轉成什麼
      const G = LIBD.LIGHT_GRID, trace = (set) => { let x = 0, y = 0, dx = 1, dy = 0; for (let k = 0; k < 60; k++) { x += dx; y += dy; if (x < 0 || y < 0 || x > 5 || y > 5) return false; const c = G[y][x]; if (c === '#') return false; if (c === 'C') return true; const m = set[c]; if (m === '/') [dx, dy] = [-dy, -dx]; else if (m === '\\') [dx, dy] = [dy, dx]; } return false; };
      let mirrors = null; for (let n = 0; n < 81 && !mirrors; n++) { const set = {}; let v = n; for (const k of ['1', '2', '3', '4']) { set[k] = ['', '/', '\\'][v % 3]; v = Math.floor(v / 3); } if (trace(set)) mirrors = set; }
      const pe = by('eldrin'); await pe.inspect(TH('mirrors')); await pe.checkLayout('P19');
      for (const [k, m] of Object.entries(mirrors)) { const at = G.findIndex((row) => row.includes(k)); const idx = at * 6 + G[at].indexOf(k); for (let c = 0; c < ['', '/', '\\'].indexOf(m); c++) { await pe.tap(pe.page.locator(`${MAIN} .light-grid button`).nth(idx)); await sleep(200); } }
      await solveCheck(pe, 'P19');
      // P20：推石像（貝爾蒙特）。先算出推法（廣度搜尋），再一步一步按方向鍵
      const M0 = LIBD.SOKOBAN.map((r) => [...r]); let px0, py0; const tg = [], bx0 = [];
      M0.forEach((row, y) => row.forEach((c, x) => { if (c === 'P') { px0 = x; py0 = y; } if (c === 'T') tg.push(`${x},${y}`); if (c === 'B') bx0.push(`${x},${y}`); }));
      const wall = (x, y) => M0[y][x] === '#';
      const key = (px, py, bs) => `${px},${py}|${[...bs].sort().join(';')}`;
      const qq = [[px0, py0, bx0, '']], seen = new Set([key(px0, py0, bx0)]); let moves = null;
      const DIRS = [[0, -1, '▲'], [-1, 0, '◀'], [0, 1, '▼'], [1, 0, '▶']];
      while (qq.length && !moves) { const [px, py, bs, mv] = qq.shift(); for (const [dx, dy, ch] of DIRS) { const nx = px + dx, ny = py + dy; if (wall(nx, ny)) continue; let nb = bs; if (bs.includes(`${nx},${ny}`)) { const bx = nx + dx, by2 = ny + dy; if (wall(bx, by2) || bs.includes(`${bx},${by2}`)) continue; nb = bs.map((b) => (b === `${nx},${ny}` ? `${bx},${by2}` : b)); } const k = key(nx, ny, nb); if (seen.has(k)) continue; seen.add(k); if (nb.every((b) => tg.includes(b))) { moves = mv + ch; break; } qq.push([nx, ny, nb, mv + ch]); } }
      const pb = by('belmont'); await pb.inspect(TH('statues')); await pb.checkLayout('P20');
      for (const ch of [...moves]) { await pb.tap(pb.page.locator(`${MAIN} .pad button`, { hasText: ch })); await sleep(120); }
      await solveCheck(pb, 'P20');
      // P21：九瓶找重的（烏洛波斯），只能秤兩次
      const po = by('ouroboros'); await po.inspect(TH('scale', 'lib_ante')); await po.checkLayout('P21');
      const vial = (i) => po.page.locator(`${MAIN} .vials button`).nth(i);
      const weigh = async (L, R) => { for (const i of L) await po.tap(vial(i)); for (const i of R) { await po.tap(vial(i)); await po.tap(vial(i)); } await po.tap(po.page.locator(`${MAIN} .row button`).nth(0)); await sleep(1500); const tx = await po.page.locator(`${MAIN} p.dim`).first().innerText(); return /左邊|left side/i.test(tx) ? 'L' : /右邊|right side/i.test(tx) ? 'R' : 'E'; };
      const r1 = await weigh([0, 1, 2], [3, 4, 5]); const grp = r1 === 'L' ? [0, 1, 2] : r1 === 'R' ? [3, 4, 5] : [6, 7, 8];
      const r2 = await weigh([grp[0]], [grp[1]]); const heavy = r2 === 'L' ? grp[0] : r2 === 'R' ? grp[1] : grp[2];
      await po.tap(po.page.locator(`${MAIN} .row button`).nth(1)); await po.tap(vial(heavy)); await solveCheck(po, 'P21');
      const pc = P.find((p) => p.char === 'cyril');
      if (pc) { await pc.inspect(TH('badge')); await pc.tap(pc.page.locator(`${MAIN} .row button`).last()); await pc.waitSolved('P22', 15000); await pc.closePanel(); await pc.clearTalk(); }
      step('第三幕：暗室的石板（P23）、門把的點字（P24）、古井的圓環（P25）');
      await host.walk({ x: 133.5, z: -55, tol: 0.8 }, { label: '暗室' }); await host.clearTalk();
      await host.inspect(TH('tiles')); await host.checkLayout('P23');
      for (const n of D.CHAPTER1.P23.ans.split(',').map(Number)) { await host.tap(host.page.locator(`${MAIN} .tiles button`).nth(n - 1)); await sleep(250); }
      await solveCheck(host, 'P23');
      await host.inspect(TH('exitdoor')); await host.type(`${MAIN} .row input`, D.CHAPTER1.P24.ans); await host.tap(host.page.locator(`${MAIN} .row button`).last()); await solveCheck(host, 'P24');
      await all((p) => p.walk({ x: 133 + P.indexOf(p) * 0.8, z: -60.5, tol: 1 }, { label: '古井' }));
      await host.inspect(TH('well')); await host.checkLayout('P25');
      const want = D.CHAPTER1.P25.ans.split(',').map(Number);
      for (let k = 0; k < 3; k++) for (let c = 0; c < want[k]; c++) { await host.tap(host.page.locator(`${MAIN} .rings > div`).nth(k).locator('button').last()); await sleep(80); }
      await host.tap(host.page.locator(`${MAIN} > button`).last()); await solveCheck(host, 'P25');
      await waitSeg('act4');
    }
    // ================= 第四幕：守夜人 =================
    if (after(await seg()) <= 6) {
      step('第四幕：被抓到就連點掙脫；鐵門（P26）走到一次後躲起來遠距解開');
      for (const p of P) p.hook = async () => { if (await p.page.isVisible('#a4grab')) { p.log('被抓到了！連點掙脫'); for (let k = 0; k < 14; k++) { if (p.mobile) await p.page.locator('#a4grab').tap().catch(() => {}); else await p.page.keyboard.press('Space'); await sleep(60); } await sleep(1500); } };
      await all((p) => p.clearTalk()); await sleep(2000); await all((p) => p.clearTalk());
      const pr = P.find((p) => p.mobile) ?? host;
      await pr.inspect(A4.A4_THINGS.find((t) => t.id === 'ironDoor')); await pr.checkLayout('P26（走到）'); await pr.closePanel();
      await pr.walk({ x: 130, z: 8.0, tol: 0.4 }, { label: '牆上的壁龕' });
      if (pr.mobile) await pr.tap('#btn-remote'); else await pr.page.keyboard.press('KeyR');
      await sleep(800); await pr.checkLayout('遠距清單');
      await pr.tap(pr.page.locator('#panel .remote-item').first()); await sleep(600);
      await pr.tapText('A'); await pr.tapText('B'); await pr.tapText(/推門|Push/);
      await solveCheck(pr, 'P26');
      step('第四幕：機械室：齒輪（P27）、照童謠的節奏敲（P28）');
      await all((p) => p.walk({ x: 150 + P.indexOf(p), z: 6, tol: 1 }, { label: '機械室' }));
      await host.inspect(A4.A4_THINGS.find((t) => t.id === 'gearwall')); await host.checkLayout('P27');
      const gears = D.CHAPTER1.P27.ans.split(',').slice(1);
      for (let k = 0; k < 3; k++) await host.page.locator(`${MAIN} .gears select`).nth(k).selectOption(gears[k]);
      await host.tap(host.page.locator(`${MAIN} > button`).last()); await solveCheck(host, 'P27');
      await host.inspect(A4.A4_THINGS.find((t) => t.id === 'pendulum')); await host.checkLayout('P28');
      const btns = host.page.locator(`${MAIN} .row button`);
      for (const ch of D.CHAPTER1.P28.ans) await host.tap(btns.nth(ch === 'L' ? 0 : 1));
      await host.tap(btns.last()); await solveCheck(host, 'P28');
      step('第四幕：屋頂的符文石板（P29）：照 MILNER 的順序一格一格踩');
      const ROOF = A4.ROOF, word = D.CHAPTER1.P29.word, AT = A4.ROOF_AT;
      const bfs = () => { const q = []; const prev = new Map(); for (let c = 0; c < 6; c++) if (ROOF[5][c] === word[0]) { q.push([c, 5, 0]); prev.set(`${c},5,0`, null); } while (q.length) { const [c, r, i] = q.shift(); if (r === 0) { const out = []; let k = `${c},${r},${i}`; while (k) { out.unshift(k.split(',').map(Number)); k = prev.get(k); } return out; } for (const [dc, dr] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) { const nc = c + dc, nr = r + dr, ni = (i + 1) % word.length; if (nc < 0 || nr < 0 || nc > 5 || nr > 5 || ROOF[nr][nc] !== word[ni]) continue; const k = `${nc},${nr},${ni}`; if (prev.has(k)) continue; prev.set(k, `${c},${r},${i}`); q.push([nc, nr, ni]); } } return null; };
      const route = bfs(); host.log('石板路線：', route.map(([c, r]) => `${c},${r}`).join(' → '));
      const center = ([c, r]) => ({ x: AT.x0 + (c + 0.5) * AT.tile, z: AT.z0 + (r + 0.5) * AT.tile });
      await host.walk({ x: center(route[0]).x, z: AT.z0 + 6 * AT.tile + 1.0, tol: 0.4 }, { label: '石板前' });
      for (const cell of route) { const g = center(cell); for (let k = 0; k < 12; k++) { const s = await host.st(); const d = Math.hypot(g.x - s.x, g.z - s.z); if (d < 0.35) break; await host.turnTo(Math.atan2(-(g.x - s.x), -(g.z - s.z))); await host.hold(Math.max(150, Math.min(700, d / 2 * 1000))); } await sleep(500); }
      if (!(await host.waitSolved('P29', 20000))) host.issue('P29 屋頂石板沒過');
      await waitSeg('epilogue');
    }
    // ================= 尾聲：屋頂的高潮、宿舍、熄燈、結算 =================
    step('尾聲：看完劇情，出現「第一章完」結算畫面');
    await all(async (p) => {
      const until = Date.now() + 600000;
      while (Date.now() < until) { await p.clearTalk(); const title = await p.page.locator('#panel-title').innerText().catch(() => ''); if (!(await p.page.isHidden('#panel')) && /第一章|Chapter/.test(title)) break; await sleep(1500); }
      await p.checkLayout('結算'); await p.shot('the-end');
      p.log('結算：', (await p.panelText()).replace(/\s+/g, ' ').slice(0, 200));
      await p.tap(p.page.locator('#panel-body button').last()); // 回到選單
      await p.page.locator('#s-menu').waitFor({ state: 'visible', timeout: 60000 }).catch(() => p.issue('結算後沒回到選單'));
    });
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
