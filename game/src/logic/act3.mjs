// 第三幕的玩法：書架迷宮（P13）、撿筆記、月晞的家書、俯瞰迷宮、暗室、迷宮裡的驚嚇。謎題畫面在 ui/puzzles.mjs。
import { createLibrary, mazePhase, mazeDark, cellAt, cellCenter } from '../world/library.mjs';
import { MAZE, mazeLayout, NOTES, LETTER } from '../data/library-ch1.mjs';
import { playFile, chime } from '../world/sound.mjs';
import { openPanel, el, L, LP } from '../ui/overlay.mjs';
import { t } from './i18n.mjs';

export function createAct3({ world, conn, toast, say, S, myChar, solvedByMe, serverNow }) {
  const lib = createLibrary(world.scene, world.world.colliders);
  let wasDark = false, exitSent = false, scared = false, inDark = false;

  const items = () => S().items ?? [];
  function showNote(n) {
    openPanel(t('note_title', { n }), (body) => body.append(el('p', { class: 'note', text: LP(NOTES[n]) })));
  }

  return {
    lib,
    interact(tg) {
      if (tg.kind === 'note') {
        const id = `note${tg.note}`;
        if (!items().includes(id)) { conn.request({ t: 'collect', item: id }); chime(true); }
        showNote(tg.note); return true;
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
        if (dark && !scared && mine.z === 'lib_maze') { scared = true; playFile('assets/audio/ch1/breath_monster.mp3', { volume: 0.35 }); }
      } else if (wasDark) { wasDark = false; world.setDark(false); }
      // 暗室：完全沒有光
      const d = mine.z === 'lib_dark';
      if (d !== inDark) { inDark = d; world.setDark(d); if (d) say([[null, t('dark_enter'), t('dark_enter')]]); }
    },
  };
}
