// 第二幕的玩法：肖像畫長廊（P09）的「往前／回頭」判斷、同步隊友、異常的聲音；創辦人房間的熄燈（P10）。
import { createGallery } from '../world/corridor.mjs';
import { createNorthHall } from '../world/northhall.mjs';
import { setRain, playLullaby, playFile, scream, chime } from '../world/sound.mjs';
import { sfx, hasSound } from '../art/sfx.mjs';
import { t, errText } from './i18n.mjs';
import { caption } from '../ui/captions.mjs';

const START = { x: 0, z: -21.6, yaw: 0 }; // 每一趟的起點（長廊南端，面向北）
const DEEP_Z = -30; // 走過這裡才算「走進長廊」，之後退回北翼走廊＝回頭

export function createAct2({ world, conn, toast, play, S, house, solo, lang }) {
  const gallery = createGallery(world.scene, world.world.colliders, { house, solo, lang });
  const northHall = createNorthHall(world.scene); // P30：閃電中的她
  if (new URLSearchParams(location.search).has('dev')) window.__nh = northHall;
  let loop = 0, anomaly = null, deep = false, busy = false, familiarView = false, breathed = false, open = false, darkUntil = 0;

  function show(next, n) {
    loop = n; anomaly = next; deep = false; breathed = false;
    gallery.setLoop(anomaly, loop, { familiarView });
    if (anomaly?.id === 'lullaby') playLullaby({ lines: 2, volume: 0.1 });
    if (anomaly?.id === 'liana') play('corridor:liana');
  }
  async function sync() {
    if (S().solved.includes('P09')) return openEnd();
    const r = await conn.request({ t: 'peek', pid: 'P09' });
    if (r.t === 'peek') show(r.next, r.loop);
  }
  function openEnd() { if (open) return; open = true; gallery.openEnd(); gallery.reset(); }

  // 做決定：往前（推開盡頭的門）或回頭（走回北翼走廊）
  async function decide(choice) {
    if (busy || open) return; busy = true;
    const r = await conn.request({ t: 'answer', pid: 'P09', value: { loop, choice } });
    busy = false;
    if (r.t === 'error') { deep = false; if (r.reply) await sync(); else toast(errText(r.error)); return; } // 出錯：要重新走進長廊才再送
    if (r.pending) { deep = false; return toast(voteText(r)); } // 多人：等隊友投票
    apply(r.reply ?? {}, r.solved, true);
  }
  const voteText = (v) => t('corridor_vote', { f: v.forward, b: v.back, need: v.need });
  function apply(rep, solved, mine) {
    if (rep.right) chime(true); else chime(false);
    if (solved) { openEnd(); toast(t('corridor_done')); return; }
    toast(rep.right ? t('corridor_right', { n: rep.streak, total: 8 }) : t('corridor_wrong'));
    if (mine || world.zone() === 'corridor') world.teleport(START);
    show(rep.next, rep.loop);
  }

  return {
    gallery,
    enter() { setRain(true); sync(); },
    leave() { setRain(false); },
    onCorridor(msg) { apply(msg, msg.streak >= 8, false); }, // 全隊投票的結果
    onVote(msg) { toast(voteText(msg)); },
    onSolved(pid) { if (pid === 'P09') openEnd(); },
    toggleFamiliar() { if (!solo) return; familiarView = !familiarView; gallery.setLoop(anomaly, loop, { familiarView }); toast(familiarView ? t('familiar_on') : t('familiar_off')); },
    interact(tg) {
      if (tg.kind === 'loopdoor') { decide('forward'); return true; }
      if (tg.kind === 'lightning') { // P30：熄掉油燈，等閃電
        if (northHall.storm(() => world.setDark(false))) { world.setDark(true); toast(t('p30_dark')); }
        return true;
      }
      if (tg.kind === 'snuff') {
        world.setDark(true); gallery.setDark(true); darkUntil = performance.now() + 9000; play('snuff');
        return true;
      }
      return false;
    },
    frame(dt, mine) {
      const pos = { x: mine.p[0], z: mine.p[1] };
      if (mine.z === 'corridor' && pos.z < DEEP_Z) deep = true;
      if (deep && mine.z === 'north_hall' && !open) decide('back');
      setRain(mine.z === 'corridor' || mine.z === 'north_hall' ? anomaly?.id !== 'rain_stops' : false);
      // 貝爾蒙特（或單人開使魔視角）靠近盔甲：聽到呼吸聲
      if (anomaly?.id === 'armor_breath' && !breathed && (house === 'belmont' || (solo && familiarView)) && gallery.nearArmor(pos)) {
        breathed = true; playFile('assets/audio/ch1/breath_monster.mp3', { volume: 0.5 }); caption('cap.armor_breath');
      }
      northHall.update(dt, world.camera);
      if (darkUntil && performance.now() > darkUntil) { darkUntil = 0; world.setDark(false); gallery.setDark(false); }
      if (gallery.update(dt, pos, mine.z === 'corridor', mine.y) === 'rush') {
        if (hasSound('grab_scream')) sfx('grab_scream'); else scream(); sfx('stinger'); const f = document.getElementById('flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 160);
      }
    },
  };
}
