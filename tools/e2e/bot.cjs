// 測試機器人：像真人一樣玩《魔蝕milner》。全部用真的點擊、按鍵、手指操作；走路用 A* 找路後按住前進（手機用手指推搖桿）。
// 用法見 tools/e2e/full-play.cjs。需要本機伺服器（.dev.vars 的 DEV_AUTH=1）＋ ?dev=名字 登入。
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8787/';
const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots';
fs.mkdirSync(SHOTS, { recursive: true });
const PAGE_JS = fs.readFileSync(path.join(__dirname, 'bot-page.js'), 'utf8');
const HOUSE_I = { eldrin: 0, grimoire: 1, belmont: 2, ouroboros: 3 };
const CHAR_OF = { eldrin: 'elora', grimoire: 'yuexi', belmont: 'vaughn', ouroboros: 'cyril' };
const CHAR_NAME = { elora: '艾洛拉', yuexi: '月晞', vaughn: '沃恩', cyril: '西里爾' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const stamp = () => `${String(Math.floor((Date.now() - t0) / 60000)).padStart(3)}m${String(Math.floor((Date.now() - t0) / 1000) % 60).padStart(2, '0')}s`;
const issues = [];

let browser = null;
async function launch() {
  browser ??= await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  return browser;
}

class Player {
  constructor(name, { mobile = false, house, lang = 'zh', viewport } = {}) {
    Object.assign(this, { name, mobile, house, lang, char: CHAR_OF[house], errors: [], turnMode: null });
    this.viewport = viewport;
  }
  log(...a) { console.log(stamp(), `[${this.name}${this.mobile ? '📱' : '💻'}]`, ...a); }
  issue(text) { this.log('⚠', text); issues.push(`${this.name}${this.mobile ? '（手機）' : '（電腦）'}：${text}`); }
  async open() {
    const b = await launch();
    const opts = this.mobile
      ? { ...devices['iPhone 13'], viewport: this.viewport ?? { width: 844, height: 390 }, screen: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
      : { viewport: this.viewport ?? { width: 1280, height: 720 }, deviceScaleFactor: 1 };
    this.ctx = await b.newContext(opts);
    await this.ctx.addInitScript(PAGE_JS);
    await this.ctx.addInitScript(() => { try { localStorage.setItem('ml_lowpower', '1'); } catch { /* */ } });
    this.page = await this.ctx.newPage(); this.page.setDefaultTimeout(120000);
    this.page.on('pageerror', (e) => { this.errors.push(e.message); this.issue(`網頁錯誤：${e.message}`); });
    this.page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon|AudioContext|autoplay/i.test(m.text())) this.log('console.error', m.text().slice(0, 200)); });
    if (this.mobile) this.cdp = await this.ctx.newCDPSession(this.page);
    const q = new URLSearchParams({ dev: this.name, gfx: '0.3', nocheck: '' });
    await this.page.goto(`${BASE}?${q}`);
  }
  // ---------- 基本操作（真的點擊／按鍵） ----------
  async tap(sel, opts = {}) {
    const loc = typeof sel === 'string' ? this.page.locator(sel).first() : sel;
    await loc.waitFor({ state: 'visible', timeout: opts.timeout ?? 60000 });
    if (this.mobile) await loc.tap({ timeout: opts.timeout ?? 60000 }); else await loc.click({ timeout: opts.timeout ?? 60000 });
  }
  async tapText(text, scope = '#panel-body') { await this.tap(this.page.locator(`${scope} button`, { hasText: text })); }
  async type(sel, text) { const loc = typeof sel === 'string' ? this.page.locator(sel).first() : sel; await this.tap(loc); await loc.fill(''); await loc.pressSequentially(String(text), { delay: 40 }); }
  async st() { return this.page.evaluate(() => window.__bot.st()); }
  async shot(name) { const f = path.join(SHOTS, `${this.name}-${name}.png`); await this.page.screenshot({ path: f }).catch(() => {}); return f; }
  async checkLayout(where) {
    await sleep(1500); // 視窗滑進來的動畫跑完再量
    const o = await this.page.evaluate(() => window.__bot.overflow()).catch(() => []);
    if (o.length) { const f = await this.shot(`overflow-${where}`); this.issue(`畫面超出（${where}）：${o.join('；')}　截圖 ${f}`); }
  }
  // 對話：電腦按空白鍵、手機點對話框
  async clearTalk(max = 60) {
    for (let i = 0; i < max; i++) {
      const s = await this.st(); if (!s?.talking) return;
      if (this.mobile) await this.page.locator('#dialog').tap().catch(() => {}); else await this.page.keyboard.press('Space');
      await sleep(350);
    }
  }
  async closePanel() { if ((await this.st())?.panel) { await this.tap('#panel-close').catch(() => {}); await sleep(500); } }
  // ---------- 轉頭、走路 ----------
  async turnTo(yaw) {
    const s = await this.st(); let d = yaw - s.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < 0.05) return;
    if (this.mobile) { // 右半邊用手指滑：每 1 像素轉 0.005
      const px = -d / 0.005, W = this.viewport?.width ?? 844, H = this.viewport?.height ?? 390;
      const x0 = W * 0.7, y0 = H * 0.45, steps = Math.max(2, Math.ceil(Math.abs(px) / 40));
      const pt = (x, y, id = 1) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 });
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(x0, y0)] });
      for (let i = 1; i <= steps; i++) { await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(x0 + (px * i) / steps, y0)] }); }
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      this.turnMode = 'touch';
      return;
    }
    // 電腦：滑鼠（鎖定游標時）每 1 像素轉 0.0022；鎖不了（無頭瀏覽器）就直接設定視角
    if (this.turnMode !== 'set') {
      if (!s.lock) { await this.page.mouse.click(640, 360).catch(() => {}); await sleep(200); }
      const lock = await this.page.evaluate(() => !!document.pointerLockElement);
      if (lock) {
        const px = -d / 0.0022, steps = Math.max(1, Math.ceil(Math.abs(px) / 60));
        for (let i = 0; i < steps; i++) await this.page.mouse.move(640 + (px * (i + 1)) / steps, 360);
        this.turnMode = 'mouse'; await sleep(60);
        const s2 = await this.st(); let left = yaw - s2.yaw; left = Math.atan2(Math.sin(left), Math.cos(left));
        if (Math.abs(left) < 0.25) return;
      }
      this.turnMode = 'set'; this.log('（無頭瀏覽器鎖不住滑鼠：轉頭改用直接設定視角，等同滑鼠轉動）');
    }
    await this.page.evaluate((y) => { window.__w.controls.state.yaw = y; }, yaw);
  }
  async hold(ms, { run = false } = {}) {
    if (this.mobile) {
      const W = this.viewport?.width ?? 844, H = this.viewport?.height ?? 390, x0 = W * 0.18, y0 = H * 0.62, dy = run ? -54 : -42;
      const pt = (x, y) => ({ x, y, id: 0, radiusX: 4, radiusY: 4, force: 1 });
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(x0, y0)] });
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(x0, y0 + dy / 2)] });
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(x0, y0 + dy)] });
      await sleep(ms);
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      if (run) await this.page.keyboard.down('ShiftLeft');
      await this.page.keyboard.down('KeyW'); await sleep(ms); await this.page.keyboard.up('KeyW');
      if (run) await this.page.keyboard.up('ShiftLeft');
    }
  }
  // 走到某個地方（goal：{x,z,tol} 或 {rect,reach}）
  async walk(goal, { maxMs = 240000, run = false, label = '' } = {}) {
    await this.page.evaluate(() => { window.__botComp = true; });
    const until = Date.now() + maxMs; let stuck = 0, lastPos = null;
    while (Date.now() < until) {
      await this.clearTalk();
      if ((await this.st()).panel) await this.closePanel();
      const p = await this.page.evaluate((g) => window.__bot.plan(g), goal);
      if (p.error) { this.log('找不到路', label, JSON.stringify(goal).slice(0, 120), p.error); await this.hold(400); stuck++; if (stuck > 6) return false; continue; }
      if (!p.path.length || (p.path.length === 1 && Math.hypot(p.path[0][0] - p.x, p.path[0][1] - p.z) < 0.15)) return true;
      // 到了沒
      if (goal.rect ? false : Math.hypot(goal.x - p.x, goal.z - p.z) <= goal.tol) return true;
      const [nx, nz] = p.path[0], d = Math.hypot(nx - p.x, nz - p.z);
      if (goal.rect && p.path.length === 1 && d < 0.2) return true;
      await this.turnTo(Math.atan2(-(nx - p.x), -(nz - p.z)));
      await this.hold(Math.max(250, Math.min(1500, (d / (run ? 3.6 : 2.0)) * 1000)), { run });
      const s = await this.st();
      if (lastPos && Math.hypot(s.x - lastPos[0], s.z - lastPos[1]) < 0.05) { stuck++; if (stuck % 3 === 0) { await this.page.keyboard.press('KeyS').catch(() => {}); } } else stuck = Math.max(0, stuck - 1);
      if (stuck > 25) { this.issue(`走路卡住了（${label}，在 ${s.x},${s.z}）`); return false; }
      lastPos = [s.x, s.z];
    }
    this.issue(`走太久沒走到（${label}）`); return false;
  }
  // 走到東西旁邊，看著它，按調查
  async inspect(thing, { label, reach = 2.0 } = {}) {
    const ok = await this.walk({ rect: thing, reach }, { label: label ?? thing.id });
    for (let i = 0; i < 6; i++) {
      await this.clearTalk();
      const s = await this.st();
      await this.turnTo(Math.atan2(-(thing.x - s.x), -(thing.z - s.z)));
      await sleep(300);
      const tg = (await this.st()).target;
      if (tg === thing.id || (thing.alt && thing.alt.includes(tg))) {
        if (this.mobile) await this.tap('#btn-inspect'); else await this.page.keyboard.press('KeyE');
        await sleep(900);
        return true;
      }
      if (i === 2 && ok) await this.walk({ rect: thing, reach: 1.0 }, { label: `${thing.id}（再靠近）` });
      else await this.hold(250);
    }
    const f = await this.shot(`cant-inspect-${thing.id}`);
    this.issue(`調查不到 ${thing.id}（看著的是 ${(await this.st()).target}）截圖 ${f}`); return false;
  }
  async waitFor(fn, arg, { ms = 120000, label = '' } = {}) {
    const until = Date.now() + ms;
    while (Date.now() < until) { if (await this.page.evaluate(fn, arg).catch(() => false)) return true; await this.clearTalk(5); await sleep(700); }
    this.issue(`等不到：${label}`); return false;
  }
  async waitSolved(pid, ms = 30000) { return this.waitFor((p) => window.__ml?.state.solved.includes(p), pid, { ms, label: `${pid} 解開` }); }
  async panelText() { return this.page.locator('#panel-body').innerText().catch(() => ''); }
  async status() { return this.page.locator('#panel-body .p-status').last().innerText().catch(() => ''); }
}

module.exports = { Player, launch, sleep, issues, stamp, HOUSE_I, CHAR_OF, CHAR_NAME, close: async () => { await browser?.close(); } };
