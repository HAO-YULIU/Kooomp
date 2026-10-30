// 第三幕的玩法：書架迷宮（P13）、撿筆記、月晞的家書、俯瞰迷宮、暗室、迷宮裡的驚嚇。謎題畫面在 ui/puzzles.mjs。
import { createLibrary, mazePhase, mazeDark, cellAt, cellCenter } from '../world/library.mjs';
import { createWeeping } from '../world/weeping.mjs';
import { MAZE, mazeLayout, NOTES, LETTER } from '../data/library-ch1.mjs';
import { playFile, chime } from '../world/sound.mjs';
import { sfx } from '../art/sfx.mjs';
import { openPanel, el, L, LP } from '../ui/overlay.mjs';
import { t } from './i18n.mjs';

export function createAct3({ world, conn, toast, say, S, myChar, solvedByMe, serverNow }) {
  const lib = createLibrary(world.scene, world.world.colliders);
  const captions = () => { try { return localStorage.getItem('ml_captions') !== '0'; } catch { return true; } }; // 設定裡的「聲音字幕」
  const dolls = createWeeping(world.scene, (dir) => { if (captions()) toast(t('sob_cap', { dir: t(`sob_dir.${dir}`) })); }); // P31：哭泣的娃娃
  if (new URLSearchParams(location.search).has('dev')) window.__dolls = dolls;
  let wasDark = false, exitSent = false, scared = false, inDark = false;

  // P31：吹熄油燈（謎題視窗裡的按鈕 → ui/puzzles.mjs 送出 ml-sob）
  addEventListener('ml-sob', async () => {
    if (dolls.active() || S().solved.includes('P31')) return;
    const r = await conn.request({ t: 'peek', pid: 'P31' });
    if (r.t !== 'peek') return;
    if (dolls.start(r.content.doll, () => world.setDark(false))) { world.setDark(true); toast(t('p31_dark')); }
  });

  const items = () => S().items ?? [];
  function showNote(n) {
    openPanel(t('note_title', { n }), (body) => body.append(el('p', { class: 'note', text: LP(NOTES[n]) })));
  }

  return {
    wake: () => lib.wake(), // 第三幕、第四幕：載入屍體的模型
    lib,
    interact(tg) {
      if (tg.kind === 'note') {
        const id = `note${tg.note}`;
        if (!items().includes(id)) { conn.request({ t: 'collect', item: id }); chime(true); }
        showNote(tg.note); return true;
      }
      if (tg.kind === 'doll') {
        if (S().solved.includes('P31')) { toast(t('p31_after')); return true; }
        if (!dolls.active()) { toast(t('p31_quiet')); return true; }
        conn.request({ t: 'peek', pid: 'P31' }).then((pk) => { // 多人：隊友可能剛抱錯、換了一個在哭——先確認還是同一個
          if (pk.t === 'peek' && pk.content.doll !== dolls.which()) { dolls.switchTo(pk.content.doll); toast(t('p31_moved')); return; }
          return conn.request({ t: 'answer', pid: 'P31', value: { pick: tg.doll } });
        }).then((res) => {
          if (!res) return;
          dolls.stop();
          if (res.solved) { solvedByMe('P31', res); setTimeout(() => toast(t('p31_found')), 1800); }
          else if (res.t !== 'error') { sfx('stinger'); toast(t('p31_wrong')); }
          else toast(t('wrong'));
        });
        return true;
      }
      if (tg.kind === 'letter') { // 家書只在月晞身上；月晞由電腦控制時，她會把家書交給你
        const ai = !S().members.some((m) => m.char === 'yuexi');
        if (myChar() !== 'yuexi' && !ai) { toast(t('letter_not_yours')); return true; }
        openPanel(t('letter_title'), (body) => body.append(el('p', { class: 'note', text: L(LETTER) })));
        return true;
      }
      if (tg.kind === 'overview') { // 從梯子上俯瞰整個迷宮（多人：一個人上去指揮；單人：派使魔飛上去）
        openPanel(L(tg.label), (body, panel) => {
          const grid = el('div', { class: 'maze-map' });
          const draw = () => {
            grid.innerHTML = '';
            const lay = mazeLayout(((mazePhase(serverNow()) % 5) + 5) % 5);
            lay.forEach((row, r) => [...row].forEach((ch, c) => {
              const cls = ch === '#' ? 'shelf' : r === MAZE.exit[1] && c === MAZE.exit[0] ? 'exit' : r === MAZE.entry[1] && c === MAZE.entry[0] ? 'entry' : '';
              grid.append(el('span', { class: cls }));
            }));
          };
          draw(); const timer = setInterval(draw, 1000);
          body.append(el('p', { class: 'dim', text: t('maze_overview') }), grid);
          panel.onClose = () => clearInterval(timer);
        });
        return true;
      }
      return false;
    },
    // 筆記本裡要顯示的東西
    notebook() {
      const out = [];
      for (const n of [1, 2, 3, 4]) if (items().includes(`note${n}`)) out.push(el('li', { class: 'note-link', text: t('note_title', { n }), onclick: () => showNote(n) }));
      return out;
    },
    frame(dt, mine, segment) {
      const now = serverNow();
      // 書架迷宮：第三幕的前半段才會動（解開 P13 之後就停住，方便回頭）
      if (mine.z === 'lib_maze' || mine.z === 'lib_entry') {
        const dark = segment === 'act3a' && mazeDark(now);
        if (dark !== wasDark) { wasDark = dark; world.setDark(dark); }
        if (lib.setPhase(segment === 'act3a' || !S().solved.includes('P13') ? mazePhase(now) : 3)) {
          // 書架移到玩家身上：把玩家推到最近的空格
          const [c, r] = cellAt(mine.p[0], mine.p[1]);
          if (mine.z === 'lib_maze' && lib.blocked(c, r)) { const [nc, nr] = lib.nearestFree(c, r); world.teleport({ ...cellCenter(nc, nr), yaw: mine.y }); toast(t('maze_pushed')); }
        }
        const [c, r] = cellAt(mine.p[0], mine.p[1]);
        if (!exitSent && segment === 'act3a' && c === MAZE.exit[0] && r === MAZE.exit[1]) {
          exitSent = true; conn.request({ t: 'answer', pid: 'P13', value: 'exit' }).then((res) => { if (res.solved) solvedByMe('P13', res); else if (res.error !== 'already_solved') exitSent = false; });
        }
        // 迷宮裡第一次熄燈時，黑暗中有呼吸聲
        if (dark && !scared && mine.z === 'lib_maze') { scared = true; playFile('assets/audio/ch1/breath_monster.mp3', { volume: 0.35 }); setTimeout(() => sfx('whisper'), 2500); }
      } else if (wasDark) { wasDark = false; world.setDark(false); }
      if (dolls.active() && S().solved.includes('P31')) dolls.stop(); // 隊友找到了：哭聲停、燈亮
      dolls.update(dt, world.camera, { solved: S().solved.includes('P31'), zone: mine.z });
      // 暗室：完全沒有光
      const d = mine.z === 'lib_dark';
      if (d !== inDark) { inDark = d; world.setDark(d); if (d) { say([[null, t('dark_enter'), t('dark_enter')]]); setTimeout(() => sfx('whisper'), 4000); } }
    },
  };
}
