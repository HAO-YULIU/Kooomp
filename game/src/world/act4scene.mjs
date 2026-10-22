// 第四幕的特別場景（灰盒）：屋頂的符文石板（P29）、機械室的大齒輪與鐘擺、蝕巢的黑根、屋頂的月亮。
import * as THREE from 'three';
import { ROOF, ROOF_AT } from '../data/act4-ch1.mjs';
import { bloodPool, bloodSplat } from '../art/gore.mjs';

function runeTexture(ch) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3a44'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#22222a'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
  g.fillStyle = '#c9d4ff'; g.font = 'bold 84px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70);
  return new THREE.CanvasTexture(c);
}

export function createAct4Scene(scene) {
  const root = new THREE.Group(); root.userData.static = true; scene.add(root); // static：不會移動的場景，world.mjs 只畫玩家附近房間的部分
  // ---- 屋頂的石板 ----
  const tiles = [];
  ROOF.forEach((row, r) => [...row].forEach((ch, c) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ROOF_AT.tile - 0.08, ROOF_AT.tile - 0.08), new THREE.MeshStandardMaterial({ map: runeTexture(ch), roughness: 0.8 }));
    m.rotation.x = -Math.PI / 2; m.position.set(ROOF_AT.x0 + (c + 0.5) * ROOF_AT.tile, 0.02, ROOF_AT.z0 + (r + 0.5) * ROOF_AT.tile);
    root.add(m); tiles.push(m);
  }));
  // 屋頂的月亮
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3, 20, 14), new THREE.MeshBasicMaterial({ color: '#e8ecff' }));
  moon.position.set(175, 40, -80); root.add(moon);
  // 月光：只有在屋頂上才亮（一直放在場景裡、只調亮度，避免畫面重新編譯而卡一下）
  const moonlight = new THREE.DirectionalLight('#b8c8ff', 0); moonlight.position.set(175, 40, -80); moonlight.target.position.set(155, 0, -30);
  root.add(moonlight, moonlight.target);
  const sky = new THREE.HemisphereLight('#6070a0', '#101018', 0); root.add(sky);
  // ---- 機械室：大齒輪、鐘擺 ----
  const iron = new THREE.MeshStandardMaterial({ color: '#4a3e30', metalness: 0.6, roughness: 0.5 });
  const gears = [];
  for (const [x, y, z, r] of [[152, 4, 12.4, 2.4], [157, 6, 17.6, 3.2], [161, 3, 4.6, 1.8], [149, 7, 17.6, 2]]) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 24), iron); g.rotation.x = Math.PI / 2; g.position.set(x, y, z); root.add(g); gears.push(g);
    for (let k = 0; k < 12; k++) { const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.3), iron); const a = (k / 12) * Math.PI * 2; tooth.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.add(tooth); }
  }
  const pend = new THREE.Group(); pend.position.set(155, 11, 8); root.add(pend);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 8, 6), iron); rod.position.y = -4; pend.add(rod);
  const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 20), new THREE.MeshStandardMaterial({ color: '#8a6a2a', metalness: 0.8, roughness: 0.3 })); bob.rotation.x = Math.PI / 2; bob.position.y = -8; pend.add(bob);
  // ---- 蝕巢：牆上和地上的黑根 ----
  const rootMat = new THREE.MeshStandardMaterial({ color: '#0a0608', roughness: 0.4, emissive: '#180208' });
  for (let i = 0; i < 26; i++) {
    const len = 2 + Math.random() * 4;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.16, len, 5), rootMat);
    m.position.set(166 + Math.random() * 6.5, Math.random() * 3.5, -1.5 + Math.random() * 7); m.rotation.set(Math.random() * 2, Math.random() * 3, Math.random() * 2); root.add(m);
  }
  // 蝕巢地上的血：被拖進來的人留下的（帳號二）
  bloodPool(root, 169.5, 2, 1.3, { seed: 21 }); bloodPool(root, 167.2, -0.6, 0.6, { seed: 22 });
  bloodSplat(root, 172.82, 1.4, 3.5, { size: 1.3, name: 'drip', normal: [-1, 0, 0], spin: Math.PI });
  bloodSplat(root, 170.5, 1.1, -1.82, { size: 1.0, name: 'drip', normal: [0, 0, 1], spin: Math.PI });
  bloodSplat(root, 166.4, 0, 4.4, { size: 1.2, name: 'spray', spin: 1.3 });
  let t = 0;
  return {
    frame(dt, zone) {
      moonlight.intensity = zone === 'a4_roof' ? 1.6 : 0; sky.intensity = zone === 'a4_roof' ? 0.8 : 0;
      if (zone !== 'a4_gears') return;
      t += dt; gears.forEach((g, i) => { g.rotation.y += dt * (i % 2 ? -0.3 : 0.3); }); pend.rotation.z = Math.sin(t * 1.2) * 0.35;
    },
    crack(c, r) { const m = tiles[r * 6 + c]; if (!m) return; m.visible = false; setTimeout(() => { m.visible = true; }, 2500); }, // 碎掉的石板一陣子後恢復
    glow(c, r) { const m = tiles[r * 6 + c]; if (m) m.material.emissive = new THREE.Color('#304080'); },
    resetGlow() { tiles.forEach((m) => { m.material.emissive = new THREE.Color('#000000'); }); },
  };
}
