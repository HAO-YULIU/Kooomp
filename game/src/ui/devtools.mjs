// 開發者測試工具（2026-10-22 製作人：方便快速測試）。只有開發者看得到：本機 ?dev、製作人的測試登入、大廳管理員。
// 右上角 🛠：跳到任何一段、本段的謎題一覽（傳送到謎題前、直接解開、看答案）、快速移動、第四幕倒數快轉。
// 判斷答案、解開都在伺服器（伺服器也會檢查是不是開發者）。
import { el, t } from './overlay.mjs';
import { errText, getLang } from '../logic/i18n.mjs';

const SEGS = ['prologue', 'act1', 'act2', 'act3a', 'act3b', 'act3c', 'act4', 'epilogue'];
const zh = () => getLang() !== 'en';
const T = (a, b) => (zh() ? a : b);

export function createDevTools({ conn, world, S, things, toast, onSolved }) {
  const box = el('div', { id: 'devtools', hidden: '' });
  const btn = el('button', { id: 'btn-devtools', title: 'dev', text: '🛠' });
  document.getElementById('hud').append(btn, box);
  let list = null, open = false;
  btn.onclick = async () => { open = !open; box.hidden = !open; if (open) await render(); };

  const req = async (m) => { const r = await conn.request(m); if (r.t === 'error') toast(`🛠 ${errText(r.error)}`); return r; };
  const thingOf = (pid) => things.find((x) => x.puzzle === pid && !x.panel) ?? things.find((x) => x.puzzle === pid);
  function teleport(th) { // 站到東西前面 1.4 公尺、面向它（往房間中間那一邊）
    const room = world.roomOf?.(th.x, th.z);
    const cx = room ? (room.x[0] + room.x[1]) / 2 : th.x, cz = room ? (room.z[0] + room.z[1]) / 2 : th.z + 1;
    let dx = cx - th.x, dz = cz - th.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const d = Math.max(th.size?.[0] ?? 0.6, th.size?.[2] ?? 0.6) / 2 + 1.4;
    world.teleport({ x: th.x + dx * d, z: th.z + dz * d, yaw: Math.atan2(dx, dz) });
  }

  async function render() {
    box.innerHTML = '';
    if (!list) { const r = await req({ t: 'dev', list: true }); list = r.list ?? []; }
    const st = S(), seg = st.segment;
    // 跳段
    box.append(el('b', { text: T('跳到', 'Jump to') }), el('div', { class: 'dt-row' }, ...SEGS.map((s) => el('button', { class: s === seg ? 'on' : '', text: t(`seg_name.${s}`) + (/act3[abc]/.test(s) ? s.slice(-1).toUpperCase() : ''),
      onclick: async () => { await req({ t: 'dev', segment: s }); setTimeout(render, 600); } }))));
    // 本段的謎題
    const mine = list.filter((p) => p.seg === seg && !(p.solo && st.mode !== 'solo') && !(p.multi && st.mode === 'solo'));
    const rows = el('div', { class: 'dt-list' });
    for (const p of mine) {
      const th = thingOf(p.pid), done = st.solved.includes(p.pid);
      const ans = el('small', { class: 'dt-ans' });
      const go = el('button', { text: T('傳送', 'Go'), onclick: () => th && teleport(th) }); go.disabled = !th;
      rows.append(el('div', { class: 'dt-p' + (done ? ' done' : '') },
        el('span', { text: `${done ? '✔ ' : ''}${p.pid}` }),
        go,
        el('button', { text: T('解開', 'Solve'), onclick: async () => {
          const r = await req({ t: 'answer', pid: p.pid, devSolve: true, value: null });
          if (r.solved) { if (th) world.fx(th, 'solved'); onSolved(p.pid, r); toast(`🛠 ${p.pid} ✔`); setTimeout(render, 500); } // 跟自己答對一樣，場景裡放金光
        } }),
        el('button', { text: T('答案', 'Ans'), onclick: async () => { const r = await req({ t: 'dev', answer: p.pid }); ans.textContent = r.t === 'ok' ? JSON.stringify(r.ans ?? r.kind) : ''; } }),
        ans));
    }
    if (!mine.length) rows.append(el('small', { text: T('這一段沒有謎題', 'No puzzles in this part') }));
    box.append(el('b', { text: T('這一段的謎題', 'Puzzles here') }), rows);
    // 其他
    const fast = el('button', { class: world.controls.state.speedMul > 1 ? 'on' : '', text: T('快速移動', 'Fast move'), onclick: () => { const s = world.controls.state; s.speedMul = s.speedMul > 1 ? 1 : 3; fast.classList.toggle('on', s.speedMul > 1); } });
    const clock = el('button', { text: T('第四幕倒數剩 30 秒', 'Act 4: 30 s left'), onclick: () => req({ t: 'dev', deadline: 30000 }) });
    box.append(el('b', { text: T('其他', 'Other') }), el('div', { class: 'dt-row' }, fast, clock));
  }
  return { refresh: () => { if (open) render(); } };
}
