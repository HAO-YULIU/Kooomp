// 第三幕・閱覽室（P31「哭泣的娃娃」，帳號二 2026-10-26）：五個縫補過的娃娃。吹熄桌上的油燈後，
// 黑暗中其中一個開始哭（哪一個由伺服器決定），聲音從它的方向、依距離大小聲傳來；玩家循聲走過去把它抱起來。
import * as THREE from 'three';
import { placeProp } from '../art/models.mjs';
import { sfxPan } from '../art/sfx.mjs';
import { DOLLS } from '../data/library-ch1.mjs';

const LIMIT = 45; // 黑暗最多幾秒（沒找到就點回燈）

export function createWeeping(scene, caption = () => {}) {
  const group = new THREE.Group(); group.name = 'weeping-dolls'; scene.add(group);
  const dolls = DOLLS.map(([x, z, ry]) => placeProp(group, 'spider_doll', x, 0, z, ry, [0.5, 0.55, 0.45])?.obj).filter(Boolean);
  const st = placeProp(group, 'sidetable', 121.4, 0, -39.6, Math.PI / 2, [0.6, 0.75, 0.6]); // 西牆邊的小桌，上面一盞油燈和紙條
  placeProp(group, 'lantern', 121.4, st ? st.h : 0.75, -39.6, 0.4, [0.22, 0.4, 0.22]);
  const fwd = new THREE.Vector3();
  let crying = -1, t = 0, next = 0, onEnd = null;
  const stop = () => { if (crying < 0) return; crying = -1; onEnd?.(); };
  return {
    active: () => crying >= 0,
    which: () => crying,
    switchTo(i) { if (crying >= 0 && DOLLS[i]) { crying = i; next = 0.3; } }, // 多人：隊友抱錯，換成另一個在哭
    start(i, done) { if (crying >= 0 || !DOLLS[i]) return false; crying = i; t = 0; next = 1.2; onEnd = done; return true; },
    stop,
    update(dt, cam, { solved, zone } = {}) {
      // 找到之後：你沒看著的時候，五個娃娃都轉過來面向你
      if (solved && zone === 'lib_reading' && crying < 0) {
        cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
        for (const o of dolls) { const dx = o.position.x - cam.position.x, dz = o.position.z - cam.position.z, d = Math.hypot(dx, dz) || 1; if ((dx * fwd.x + dz * fwd.z) / d < 0.3) o.rotation.y = Math.atan2(-dx, -dz); }
      }
      if (crying < 0) return;
      t += dt; next -= dt;
      if (t > LIMIT) return stop();
      if (next > 0) return;
      next = 2.2 + Math.random() * 0.6;
      const [x, z] = DOLLS[crying], dx = x - cam.position.x, dz = z - cam.position.z, d = Math.hypot(dx, dz) || 1;
      cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      const pan = (dx / d) * -fwd.z + (dz / d) * fwd.x; // 右邊＝正
      const ahead = (dx / d) * fwd.x + (dz / d) * fwd.z;
      caption(d < 2.5 ? 'near' : ahead < -0.3 ? 'back' : pan > 0.45 ? 'right' : pan < -0.45 ? 'left' : 'front'); // 字幕：手機靜音、聽不到的人也能找（只說方向）
      sfxPan('sob', pan, { vol: Math.min(1.4, 2.2 / (1 + d * 0.45)) * (ahead < 0 ? 0.65 : 1) }); // 在背後：悶一點
    },
  };
}
