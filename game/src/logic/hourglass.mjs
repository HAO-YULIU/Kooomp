// P06 沙漏的時間：沙漏一漏完，時間就停下來，等玩家決定要翻哪一個、敲門，還是繼續等
// （玩家 2026-11-22：「有思路但是沙漏翻轉很難按，而且敲門永遠敲不到時間」——以前遊戲 1 分鐘＝現實 1 秒，要在漏完的那一秒內按下去）
// 這題考的是想法（用 7 分和 11 分量出 15 分），不是反應。伺服器的判定不變（server/judge.mjs simulateHourglass）。
// 每個沙漏記「上半部什麼時候漏完」（絕對時間），停下來的時間一定剛好是那一刻，不會有小數誤差
export function hourglassClock(sizes = [7, 11]) {
  const endAt = Object.fromEntries(sizes.map((s) => [s, 0])); // 0＝上半部是空的
  const actions = [];
  let now = 0, started = false, paused = false, emptied = [];
  const topOf = (s) => Math.max(0, endAt[s] - now);
  // 往前走 d 分鐘；有沙漏漏完就停在那一刻
  function step(d) {
    if (!started || paused || !(d > 0)) return false;
    const running = sizes.filter((s) => endAt[s] > now);
    if (!running.length) { now += d; return false; }
    const next = Math.min(...running.map((s) => endAt[s]));
    if (now + d < next) { now += d; return false; }
    now = next;
    emptied = running.filter((s) => endAt[s] === next);
    paused = true;
    return true;
  }
  // 翻沙漏或敲門：停著的時候就是在漏完的那一刻做的；做完時間繼續走
  function act(a, g) {
    started = true;
    const t = Math.round(now); // 對齊到整分（翻轉都在整分，所以漏完的時間也一定是整分）
    now = t;
    if (a === 'flip') for (const s of g) if (s in endAt) { const top = topOf(s); endAt[s] = now + (s - top); } // 翻過來：下半部的沙變上半部
    actions.push(a === 'knock' ? { t, a } : { t, a, g: [...g] });
    paused = false; emptied = [];
  }
  function resume() { paused = false; emptied = []; }
  const glasses = new Proxy({}, { get: (_, k) => (k in endAt ? { top: topOf(+k), bot: +k - topOf(+k) } : undefined) });
  return {
    glasses, actions, step, act, resume,
    get now() { return now; }, get paused() { return paused; }, get emptied() { return emptied; }, get started() { return started; },
  };
}
