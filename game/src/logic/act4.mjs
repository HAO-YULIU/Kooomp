// 第四幕的玩法：倒數（第十三響）、守夜人（追逐、躲藏、擊退）、被抓（掙脫、單人復活、多人拖進蝕巢＋救援／自救）、
// 屋頂的符文石板（P29）、判定輸與重來、高潮與尾聲。謎題畫面在 ui/puzzles.mjs。
import { createWarden } from '../world/warden.mjs';
import { createAct4Scene } from '../world/act4scene.mjs';
import { createWardenAI } from './warden-ai.mjs';
import { A4_SPAWN, CHECKPOINTS, NEST_SPOT, NEST_EXIT, WARDEN, WARDEN_POINTS, WARDEN_START, ROOF_AT, roofCell } from '../data/act4-ch1.mjs';
import { ROOMS, DOORS, SPAWNS } from '../data/world-ch1.mjs';
import { SCRIPT } from '../data/story-ch1.mjs';
import { playLullaby, playFile, scream, chime } from '../world/sound.mjs';
import { sfx, setMusic, setTension } from '../art/sfx.mjs';
import { openPanel, closePanel, panelOpen, el, L } from '../ui/overlay.mjs';
import { openRescue } from '../ui/puzzles.mjs';
import { t } from './i18n.mjs';
import { CHARS } from './chars.mjs';

const $ = (id) => document.getElementById(id);
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

// 通關結算：用時、莉安娜的筆記、西里爾的抉擇、被抓幾次、提示、重來幾次
function summary(r) {
  if (!r) return [];
  const min = Math.round(r.time / 60000), time = min >= 60 ? t('time_hm', { h: Math.floor(min / 60), m: min % 60 }) : t('time_m', { m: min });
  const rows = [[t('res_time'), time], [t('res_notes'), `${r.notes} / 4`], [t('res_cyril'), t(r.cyril === 'show' ? 'res_cyril_show' : 'res_cyril_hide')],
    [t('res_caught'), String(r.caught)], [t('res_hints'), String(r.hints)], [t('res_retries'), String(r.retries)]];
  return [el('table', { class: 'result' }, ...rows.map(([k, v]) => el('tr', {}, el('th', { text: k }), el('td', { text: v }))))];
}

export function createAct4({ world, conn, toast, say, talking, S, myUid, myChar, receiver, serverNow, holding, solvedByMe, playScript, dev }) {
  const warden = createWarden(world.scene, { view: WARDEN.view, fov: WARDEN.fov });
  const scenery = createAct4Scene(world.scene);
  const newAI = () => createWardenAI({ rooms: ROOMS, doors: DOORS, points: WARDEN_POINTS, params: WARDEN, start: WARDEN_START });
  let ai = newAI();
  let shown = { x: WARDEN_START.x, z: WARDEN_START.z, yaw: 0, mode: 'idle', zone: WARDEN_START.zone }, target = { ...shown };
  let active = false, introDone = false, startAt = 0, npcAt = 0, runFor = 0, tiredUntil = 0, humAt = 0;
  let grabbed = null, roofAt = null, roofDirty = false, boundOpen = false, ending = null; // ending：'climax'（屋頂）→ 'epilogue'（宿舍）→ 結束畫面
  const isSim = () => S().sim === myUid;
  const captured = () => !!S().nest?.[myUid];

  // ---- 畫面：倒數、心跳（守夜人靠近時畫面邊緣變紅）、掙脫、被綁住、判定輸 ----
  const hud = el('div', { id: 'a4clock', hidden: true }); $('hud').append(hud);
  const veil = el('div', { id: 'a4veil' }); document.body.append(veil);
  const fight = el('div', { id: 'a4grab', hidden: true }, el('b', { text: t('a4_grab') }), el('div', { class: 'bar' }, el('i')));
  const bound = el('div', { id: 'a4bound', hidden: true }, el('p', { text: t('a4_bound') }),
    el('button', { text: t('a4_self'), onclick: () => openRescue(conn, 'S', myUid, toast) }));
  const lost = el('div', { id: 'a4lost', hidden: true }, el('h2', { id: 'a4lost-title' }), el('p', { id: 'a4lost-text' }),
    el('button', { text: t('a4_retry'), onclick: () => conn.request({ t: 'retry' }) }));
  document.body.append(fight, bound, lost);

  // ---- 被抓到：1.5 秒內連點（空白鍵／畫面）掙脫 ----
  function struggle(until) {
    if (panelOpen()) closePanel();
    let hits = 0; const need = 8; fight.hidden = false; fight.querySelector('i').style.width = '0%';
    const hit = (e) => { if (e.type === 'keydown' && e.code !== 'Space') return; e.preventDefault?.(); hits++; fight.querySelector('i').style.width = `${Math.min(100, (hits / need) * 100)}%`; if (hits >= need) done(true); };
    const done = (ok) => {
      if (!grabbed) return; grabbed = null; fight.hidden = true;
      removeEventListener('keydown', hit); fight.removeEventListener('pointerdown', hit);
      conn.request({ t: ok ? 'escape' : 'caught' });
      if (ok) toast(t('a4_escaped'));
    };
    grabbed = setTimeout(() => done(false), Math.max(300, until - serverNow()));
    addEventListener('keydown', hit); fight.addEventListener('pointerdown', hit);
    scream(); sfx('stinger'); navigator.vibrate?.([200, 80, 200]);
  }

  // 這一幀所有玩家的狀況（給守夜人的 AI，只有 sim 在跑）
  function players(mine, h) {
    const nest = S().nest ?? {}, out = [];
    const online = new Set(S().members.filter((m) => m.online).map((m) => m.uid));
    out.push({ uid: myUid, zone: mine.z, x: mine.p[0], z: mine.p[1], moving: Math.hypot(...mine.v) > 0.3, running: Math.hypot(...mine.v) > 2.6, hidden: !!(h & 1), holding: !!(h & 2), captured: !!nest[myUid] });
    for (const [uid, p] of receiver.peers) {
      if (!online.has(uid)) continue;
      out.push({ uid, zone: p.z, x: p.shown[0], z: p.shown[1], moving: Math.hypot(...p.v) > 0.3, running: Math.hypot(...p.v) > 2.6, hidden: !!(p.h & 1), holding: !!(p.h & 2), captured: !!nest[uid] });
    }
    return out;
  }

  // 判定輸：「你們被同化了」＋重來的按鈕（收到訊息時，或重新整理後從房間狀態看到）
  function showLost(reason) {
    if (grabbed) { clearTimeout(grabbed); grabbed = null; fight.hidden = true; }
    closePanel(); lost.hidden = false;
    $('a4lost-title').textContent = t('a4_lost_title');
    $('a4lost-text').textContent = t(`a4_lost_${reason}`);
    ai.stun(9999, performance.now());
  }

  function begin(retry) {
    active = true; introDone = false; ai = newAI(); roofAt = null;
    if (boundOpen) { boundOpen = false; world.controls.setEnabled(true); } // 重來：被綁住的人也回到開頭
    if (retry) { if (S().nest) S().nest = {}; if (S().act4) S().act4.lost = null; } // 新的房間狀態馬上會到，先清掉，免得又被拉回蝕巢、又顯示判定輸
    shown = { ...shown, x: WARDEN_START.x, z: WARDEN_START.z, mode: 'idle', zone: WARDEN_START.zone }; target = { ...shown };
    lost.hidden = true; bound.hidden = true; fight.hidden = true;
    world.teleport(A4_SPAWN);
    if (retry) { say(SCRIPT['act4:retry']); return; }
    // 十二響，然後第十三響；守夜人哼著童謠從樓梯下來
    for (let i = 0; i < 13; i++) setTimeout(() => chime(false), i * 380);
    setTimeout(() => playLullaby({ lines: 1, volume: 0.3 }), 5600);
  }

  return {
    get ai() { return ai; },
    begin,
    // 每一幀：回傳要放進位置訊息的躲藏狀態
    frame(dt, mine, segment) {
      if (segment !== 'act4') {
        if (active) { active = false; hud.hidden = true; veil.style.opacity = 0; world.tired = false; setMusic(null); }
        if (ending === 'climax' && !talking()) { // 守夜人墜下屋頂之後：回到宿舍，播尾聲
          ending = 'epilogue'; warden.set({ visible: false }); world.setDark(false);
          world.teleport(SPAWNS.act1?.[CHARS[myChar()]?.house] ?? A4_SPAWN); playScript('segment:epilogue');
        } else if (ending === 'epilogue' && !talking()) { // 尾聲講完：第一章結束
          ending = null; setMusic('menu');
          openPanel(t('ch1_end'), (body) => body.append(...summary(S().result), el('p', { text: t('ch1_end_body') }),
            el('button', { text: t('to_menu'), onclick: () => { const q = new URLSearchParams(location.search); q.delete('room'); location.href = location.pathname + (q.size ? `?${q}` : ''); } })));
        }
        return 0;
      }
      scenery.frame(dt, mine.z);
      const now = serverNow(), st = S();
      if (st.act4?.lost && lost.hidden) showLost(st.act4.lost); // 重新整理後也要看得到「重來」
      else if (!st.act4?.lost && !lost.hidden) lost.hidden = true;
      // 倒數
      const left = (st.act4?.deadline ?? now) - now;
      hud.hidden = false; hud.textContent = `${t('a4_clock')} ${fmt(left)}`; hud.classList.toggle('urgent', left < 180000);
      // 劇情講完 3 秒後守夜人開始行動
      if (!introDone && !talking()) { introDone = true; startAt = performance.now() + 3000; }
      if (introDone && startAt && performance.now() > startAt) { ai.start(); startAt = 0; }
      // 被綁在蝕巢
      const me = captured();
      if (me) {
        if (!boundOpen) { boundOpen = true; world.teleport({ ...NEST_SPOT, yaw: Math.PI / 2 }); world.controls.setEnabled(false); bound.hidden = false; toast(t('a4_dragged')); }
        const k = Math.min(1, (Date.now() - (st.nest[myUid].at ?? Date.now())) / 240000); // 黑根慢慢爬上來，畫面越來越暗
        veil.style.background = `radial-gradient(circle, transparent ${45 - k * 40}%, rgba(0,0,0,${0.6 + k * 0.35}) 100%)`; veil.style.opacity = 1;
      } else if (boundOpen) {
        boundOpen = false; bound.hidden = true; world.controls.setEnabled(true); world.teleport(NEST_EXIT); toast(t('a4_freed'));
      }
      // 體力：跑 8 秒要喘 4 秒
      const speed = Math.hypot(...mine.v);
      if (performance.now() < tiredUntil) world.tired = true;
      else { world.tired = false; runFor = speed > 2.6 ? runFor + dt : Math.max(0, runFor - dt * 0.5); if (runFor > 8) { tiredUntil = performance.now() + 4000; runFor = 0; toast(t('a4_tired')); playFile('assets/audio/ch1/breath_panting.mp3', { volume: 0.5 }); } }
      const h = (world.hidden() ? 1 : 0) + (holding() ? 2 : 0);
      // 守夜人：sim 計算，其他人跟著 sim 的訊息
      if (isSim()) {
        const ps = players(mine, h);
        for (const ev of ai.update(dt, ps, performance.now())) {
          if (ev.type === 'catch') conn.request({ t: 'catch', uid: ev.uid }).then((r) => { if (r.t === 'error') ai.resolve(true, performance.now(), ps); });
          if (ev.type === 'spotted' && ev.uid === myUid) toast(t('a4_spotted'));
        }
        const w = ai.state; target = { x: w.x, z: w.z, yaw: w.yaw, mode: w.mode, zone: w.zone };
        shown = target;
        if (S().mode === 'multi' && performance.now() - npcAt > 200) { npcAt = performance.now(); conn.send({ t: 'npc', z: w.zone, w: [+w.x.toFixed(2), +w.z.toFixed(2), +w.yaw.toFixed(2)], m: w.mode }); }
      } else {
        const a = 1 - Math.exp(-dt * 6);
        shown = { ...target, x: shown.x + (target.x - shown.x) * a, z: shown.z + (target.z - shown.z) * a };
      }
      warden.set({ ...shown, visible: true });
      warden.frame(dt, shown.mode);
      // 靠近的感覺：畫面邊緣變紅、童謠
      const d = shown.zone === mine.z ? Math.hypot(shown.x - mine.p[0], shown.z - mine.p[1]) : 99;
      if (!me) { const k = Math.max(0, 1 - d / 14); veil.style.background = `radial-gradient(circle, transparent 55%, rgba(120,0,0,${(0.55 * k).toFixed(2)}) 100%)`; veil.style.opacity = k > 0 ? 1 : 0; }
      // 配樂：守夜人越近越緊張；在追人時至少一半；被綁在蝕巢時只剩一點點
      if (!ending) setMusic('chase'); const near = Math.max(0, 1 - d / 22);
      setTension(me ? 0.12 : shown.mode === 'chase' || shown.mode === 'grab' ? 0.5 + 0.5 * near : shown.mode === 'search' ? 0.25 + 0.5 * near : 0.6 * near);
      if (d < 20 && performance.now() > humAt) { humAt = performance.now() + 16000; playLullaby({ lines: 1, volume: 0.06 + 0.25 * (1 - d / 20) }); }
      // 屋頂的石板：踩到新的一塊就問伺服器
      if (mine.z === 'a4_roof' && !st.solved.includes('P29') && !me) {
        const cell = roofCell(mine.p[0], mine.p[1]);
        const key = cell ? cell.join() : null;
        if (key && key !== roofAt) {
          roofAt = key; roofDirty = true;
          conn.request({ t: 'answer', pid: 'P29', value: { cell } }).then((r) => {
            if (r.reply?.broke) { // 石板碎了：掉下去，回到屋頂入口
              chime(false); toast(t('a4_broke')); roofAt = null; roofDirty = false; scenery.crack(...cell); scenery.resetGlow();
              world.teleport(CHECKPOINTS.a4_roof); conn.send({ t: 'noise', p: mine.p });
            } else { scenery.glow(...cell); if (r.solved) solvedByMe('P29', r); }
          });
        } else if (!key && roofDirty && mine.p[1] > ROOF_AT.z0 + ROOF_AT.tile * 6) { roofDirty = false; roofAt = null; conn.request({ t: 'answer', pid: 'P29', value: { reset: true } }); scenery.resetGlow(); }
      }
      return h;
    },
    // 調查：蝕巢裡被綁住的同伴
    interact(tg) {
      if (tg.kind !== 'nest') return false;
      const list = Object.keys(S().nest ?? {}).filter((u) => u !== myUid);
      if (!list.length) { toast(t('a4_nest_empty')); return true; }
      if (list.length === 1) { openRescue(conn, 'R', list[0], toast); return true; }
      openPanel(L(tg.label), (body) => {
        for (const u of list) body.append(el('button', { text: S().members.find((m) => m.uid === u)?.name ?? '?', onclick: () => { closePanel(); openRescue(conn, 'R', u, toast); } }));
      });
      return true;
    },
    // 貝爾蒙特：擊退
    repel() {
      const mine = world.me();
      const d = shown.zone === mine.z ? Math.hypot(shown.x - mine.p[0], shown.z - mine.p[1]) : 99;
      if (d > 10) return toast(t('a4_repel_far'));
      conn.request({ t: 'repel' }).then((r) => { if (r.t === 'error') toast(t('a4_repel_cool', { s: Math.ceil((r.wait ?? 0) / 1000) })); });
    },
    canRepel: () => CHARS[myChar()]?.house === 'belmont',
    // 伺服器傳來的第四幕訊息
    onMessage(msg) {
      const now = performance.now();
      switch (msg.t) {
        case 'npc': if (!isSim() && msg.w) target = { x: msg.w[0], z: msg.w[1], yaw: msg.w[2], mode: msg.m, zone: msg.z }; break;
        case 'grab': if (msg.uid === myUid) struggle(msg.until); else toast(t('a4_grab_other', { name: S().members.find((m) => m.uid === msg.uid)?.name ?? '?' })); break;
        case 'escaped': if (isSim()) ai.resolve(true, now, []); break;
        case 'revived': // 單人：使魔把你拉回來（越來越虛弱）
          if (isSim()) ai.resolve(false, now, players(world.me(), 0));
          if (msg.uid === myUid) { world.teleport(CHECKPOINTS[world.zone()] ?? A4_SPAWN); say([[null, t('a4_revived', { n: msg.left }), t('a4_revived', { n: msg.left })]]); }
          break;
        case 'captured': if (isSim()) ai.resolve(false, now, players(world.me(), 0)); if (msg.uid !== myUid) toast(t('a4_captured_other', { name: S().members.find((m) => m.uid === msg.uid)?.name ?? '?' })); break;
        case 'freed': if (msg.uid !== myUid) toast(t('a4_freed_other', { name: S().members.find((m) => m.uid === msg.uid)?.name ?? '?' })); break;
        case 'repel': if (isSim()) ai.stun(WARDEN.repel, now); toast(t('a4_repelled')); $('flash')?.classList.add('on'); setTimeout(() => $('flash')?.classList.remove('on'), 300); break;
        case 'noise': if (isSim()) { const p = S().members.find((m) => m.uid === msg.uid); if (p && msg.p) ai.noise({ x: msg.p[0], z: msg.p[1], zone: msg.z }); } break;
        case 'lost': showLost(msg.reason); break;
        case 'retry': begin(true); break;
      }
    },
    // 尾聲：先在屋頂演完高潮（月光下的守夜人），再回宿舍。伺服器的段落可能比 P29 的回覆先到，所以在這裡排順序
    end() {
      active = false; ending = 'climax'; hud.hidden = true; setMusic(null); veil.style.opacity = 0; ai.stun(9999, performance.now());
      if (world.zone() !== 'a4_roof') world.teleport({ x: 155, z: -42, yaw: 0 });
      warden.set({ x: 155, z: -52, yaw: Math.PI, visible: true, mode: 'stun' }); // 屋頂盡頭，月光下
      playScript('solved:P29'); playScript(myChar() === 'cyril' ? 'P29:cyril' : 'P29:others');
    },
    dev: dev ? { warden: () => shown } : null,
  };
}
