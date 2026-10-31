// 第二幕・往北翼的走廊（P30「閃電中的她」，帳號二 2026-10-26）：
// 兩側牆上六幅「沒有畢業」的女學生畫像（有銘牌）。熄掉牆上的油燈後，窗外打五次閃電；
// 每次亮起來的那一下，戴兜帽的女人站在其中一幅畫旁邊，暗下來她就不見了。她依序站的畫，名字的第一個字母拼出答案（答案在伺服器）。
// 解開之後（2026-10-31）：你沒在看的時候，畫裡的女孩一個一個轉過身去，背對著你。
import * as THREE from 'three';
import { paintPortrait } from '../art/portraits.mjs';
import { ghostWoman } from '../art/haunt.mjs';
import { placeProp } from '../art/models.mjs';
import { sfx } from '../art/sfx.mjs';
import { NORTH_PORTRAITS, LIGHTNING_AT } from '../data/world-ch1.mjs';

const SEEDS = [304, 305, 306, 313, 318, 324]; // 畫像的亂數：都挑長髮、沒有鬍子、沒有眼鏡的女孩
const FIRST = 1.4, GAP = 2.6, SHOW = 0.5; // 第一道閃電在幾秒後、每道間隔、她出現多久

function plaqueTex(p) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#7a5e2a'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#3a2a10'; g.lineWidth = 4; g.strokeRect(3, 3, 250, 58);
  g.fillStyle = '#1e1408'; g.textAlign = 'center'; g.font = 'bold 26px serif'; g.fillText(p.en.toUpperCase(), 128, 30); g.font = '18px serif'; g.fillText(`${p.year} —`, 128, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createNorthHall(scene) {
  const group = new THREE.Group(); group.name = 'north-hall-p30'; scene.add(group);
  const frameMat = new THREE.MeshStandardMaterial({ color: '#3a2614', roughness: 0.6, metalness: 0.2 });
  const pics = []; // 解開之後：你沒在看的時候，她們一個一個轉過身去（背對你）
  NORTH_PORTRAITS.forEach((p, i) => {
    const side = Math.sign(p.x), g = new THREE.Group();
    g.position.set(p.x - side * 0.02, 0, p.z); g.rotation.y = -side * Math.PI / 2; // 畫面朝走廊中間
    const tex = new THREE.CanvasTexture(paintPortrait('normal', SEEDS[i])); tex.colorSpace = THREE.SRGBColorSpace;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.45, 0.08), frameMat); frame.position.set(0, 1.85, 0.04);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.27), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); pic.position.set(0, 1.85, 0.085); pics.push({ pic, i, x: p.x, z: p.z, turned: false });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.125), new THREE.MeshStandardMaterial({ map: plaqueTex(p), roughness: 0.5, emissive: '#ffffff', emissiveMap: plaqueTex(p), emissiveIntensity: 0.35 })); plaque.position.set(0, 1.0, 0.03);
    g.add(frame, pic, plaque); group.add(g);
  });
  // 熄燈用的油燈（掛在東牆）
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), frameMat); bracket.position.set(2.35, 1.95, -10.2); group.add(bracket);
  placeProp(group, 'lantern', 2.25, 1.45, -10.2, -Math.PI / 2, [0.25, 0.45, 0.25]);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffcf7a' })); flame.position.set(2.25, 1.62, -10.2); group.add(flame);
  // 閃電：一直放在場景裡（亮度 0），閃的時候才調亮；中途加燈畫面會重新編譯而卡一下
  const bolt = new THREE.HemisphereLight('#cfd8ff', '#1a1a2a', 0); bolt.name = 'p30-bolt'; scene.add(bolt);
  const her = new THREE.Group(); ghostWoman(her); her.position.set(0, -100, 0); scene.add(her);

  let t = -1, onEnd = null;
  const fwd = new THREE.Vector3();
  function turnAway(cam) {
    cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    for (const q of pics) {
      if (q.turned) continue;
      const dx = q.x - cam.position.x, dz = q.z - cam.position.z, d = Math.hypot(dx, dz) || 1;
      if ((dx * fwd.x + dz * fwd.z) / d > 0.2) continue; // 看得到的不動
      q.turned = true;
      const tex = new THREE.CanvasTexture(paintPortrait('back', SEEDS[q.i])); tex.colorSpace = THREE.SRGBColorSpace;
      q.pic.material.map.dispose(); q.pic.material.map = tex; q.pic.material.needsUpdate = true;
    }
  }
  return {
    busy: () => t >= 0,
    skipTo(sec) { if (t >= 0) t = sec; }, // 開發測試用：跳到暴風雨的第幾秒
    // 熄燈、打五次閃電；結束時呼叫 done（把燈點回來）
    storm(done) { if (t >= 0) return false; t = 0; onEnd = done; flame.visible = false; sfx('whoosh'); return true; },
    update(dt, cam, { zone, solved } = {}) {
      if (t < 0 && solved && zone === 'north_hall') turnAway(cam);
      if (t < 0) return;
      t += dt;
      const k = Math.floor((t - FIRST) / GAP), u = t - FIRST - k * GAP;
      let light = 0;
      if (k >= 0 && k < LIGHTNING_AT.length) {
        // 一道閃電：亮一下、暗一下、再亮久一點
        light = u < 0.09 ? 3 : u < 0.16 ? 0.2 : u < 0.4 ? 2.4 * (1 - (u - 0.16) / 0.24) : 0;
        if (u < SHOW) {
          const p = NORTH_PORTRAITS[LIGHTNING_AT[k]];
          her.position.set(p.x * 0.72, 0, p.z + 0.7); // 站在畫的旁邊（靠近走廊入口那一側）
          her.lookAt(cam.position.x, 0, cam.position.z);
        } else her.position.y = -100;
        if (u >= 0.35 && u - dt < 0.35) sfx('thunder');
      } else her.position.y = -100;
      bolt.intensity = light;
      if (t > FIRST + GAP * LIGHTNING_AT.length + 0.6) { t = -1; bolt.intensity = 0; her.position.y = -100; flame.visible = true; onEnd?.(); }
    },
  };
}
