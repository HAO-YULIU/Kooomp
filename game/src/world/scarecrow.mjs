// 第四幕・機械室（P32「稻草人」，帳號二 2026-10-26）：角落的稻草人，你轉開視線他就換個地方站。
// 他依 SCARECROW.route 一塊一塊站上刻著羅馬數字的石板，走完一輪回到角落；站過的石板依序就是工具箱的密碼（答案在伺服器）。
// 每個人看到的是自己的稻草人（不同步），所以多人時每個人都可以自己記。
// 解開之後（2026-10-31）：你下一次轉開視線，他就站在你背後，之後不再動。
import * as THREE from 'three';
import { caption, sideWord } from '../ui/captions.mjs';
import { placeProp } from '../art/models.mjs';
import { sfxPan, buzz } from '../art/sfx.mjs';
import { SCARECROW } from '../data/act4-ch1.mjs';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const AWAY = 1.2; // 視線離開幾秒他才動

function slabTex(n) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#4a4540'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#2a2622'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
  g.fillStyle = '#c8b48a'; g.font = 'bold 54px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createScarecrow(scene) {
  const group = new THREE.Group(); group.name = 'p32-scarecrow'; scene.add(group);
  SCARECROW.slabs.forEach(([x, z], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshStandardMaterial({ map: slabTex(ROMAN[i]), roughness: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); group.add(m);
  });
  placeProp(group, 'crate', 150.6, 0, 17.4, 0, [0.9, 0.6, 0.6]); // 上鎖的工具箱
  const him = new THREE.Group(); group.add(him);
  const ok = placeProp(him, 'scarecrow', 0, 0, 0, 0, [1.6, 2.3, 0.7]);
  const spots = [SCARECROW.corner, ...SCARECROW.route.map((i) => SCARECROW.slabs[i])];
  let at = 0, seen = false, away = 0, last = false; // last：最後一嚇做過了
  const put = (cam) => { const [x, z] = spots[at]; him.position.set(x, 0, z); if (cam) him.lookAt(cam.position.x, 0, cam.position.z); else him.lookAt(155, 0, 8); };
  put();
  const fwd = new THREE.Vector3();
  return {
    debug: () => last, // 開發測試用
    update(dt, cam, zone, solved = false) {
      if (!ok || zone !== 'a4_gears' || last) { seen = false; return; }
      cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      const dx = him.position.x - cam.position.x, dz = him.position.z - cam.position.z, d = Math.hypot(dx, dz) || 1;
      const look = (dx * fwd.x + dz * fwd.z) / d > 0.75 && d < 16; // 他在畫面裡
      if (solved && !look) { // 最後一嚇：站到你背後 1.6 公尺，面向你
        last = [zone, +cam.position.x.toFixed(1), +cam.position.z.toFixed(1)]; him.position.set(cam.position.x - fwd.x * 1.6, 0, cam.position.z - fwd.z * 1.6); him.lookAt(cam.position.x, 0, cam.position.z);
        sfxPan('wood', 0, { vol: 0.9 }); buzz(80); caption('cap.straw', { side: sideWord(0, true) }); return;
      }
      if (look) { seen = true; away = 0; return; }
      if (!seen) return;
      away += dt;
      if (away < AWAY) return;
      seen = false; away = 0; at = (at + 1) % spots.length; put(cam);
      const n = spots[at], pan = ((n[0] - cam.position.x) * -fwd.z + (n[1] - cam.position.z) * fwd.x) / (Math.hypot(n[0] - cam.position.x, n[1] - cam.position.z) || 1);
      sfxPan('wood', pan, { vol: 0.5 }); setTimeout(() => sfxPan('stone', pan, { vol: 0.35 }), 120); caption('cap.straw', { side: sideWord(pan, Math.abs(pan) < 0.45) }); // 背後傳來稻草摩擦、踩上石板的聲音
    },
  };
}
