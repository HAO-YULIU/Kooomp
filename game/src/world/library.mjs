// 第三幕：沉眠圖書館的特別場景——會移動的書架（P13）、血跡、高年級生的屍體、暗室。
// 書架的位置由「伺服器時間」算出來（每 30 秒換一次），所有人看到的一樣，不用傳訊息。
import * as THREE from 'three';
import { MAZE, mazeLayout } from '../data/library-ch1.mjs';

export const mazePhase = (serverNow) => Math.floor(serverNow / 1000 / MAZE.period);
export const mazeDark = (serverNow) => (serverNow / 1000) % MAZE.period > MAZE.period - MAZE.dark; // 換位置前熄燈
export const cellAt = (x, z) => [Math.floor((x - MAZE.x0) / MAZE.cell), Math.floor((z - MAZE.z0) / MAZE.cell)];
export const cellCenter = (c, r) => ({ x: MAZE.x0 + (c + 0.5) * MAZE.cell, z: MAZE.z0 + (r + 0.5) * MAZE.cell });

export function createLibrary(scene, colliders) {
  const root = new THREE.Group(); root.userData.static = true; scene.add(root); // static：不會移動的場景，world.mjs 只畫玩家附近房間的部分
  const shelfMat = new THREE.MeshStandardMaterial({ color: '#3b2716', roughness: 0.85 });
  const bookCols = ['#5a1a14', '#1e3a2a', '#2a2a4a', '#6a5a2a', '#3a1a3a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  const veinMat = new THREE.MeshBasicMaterial({ color: '#050505' });

  // ---- 書架方塊：每格一個，依目前的排列顯示或隱藏 ----
  const blocks = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const { x, z } = cellCenter(c, r), s = MAZE.cell - 0.2;
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(s, 5.2, s), shelfMat); body.position.y = 2.6; body.castShadow = body.receiveShadow = true; g.add(body);
    for (let k = 0; k < 4; k++) { // 一層一層的書（四面）
      const band = new THREE.Mesh(new THREE.BoxGeometry(s + 0.06, 0.45, s + 0.06), bookCols[(r * 5 + c + k) % bookCols.length]); band.position.y = 0.7 + k * 1.15; g.add(band);
    }
    for (let k = 0; k < 3; k++) { // 書上長出黑色的紋路
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1 + Math.random() * 2, s + 0.1), veinMat); v.position.set(-s / 2 + 0.6 + k * 1.7, 2 + Math.random(), 0); v.rotation.z = Math.random() - 0.5; g.add(v);
    }
    const col = { minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2 };
    root.add(g); blocks.push({ c, r, g, col, on: false });
  }
  let phase = null;
  function setPhase(p) {
    if (p === phase) return false; phase = p;
    const lay = mazeLayout(((p % 5) + 5) % 5);
    for (const b of blocks) {
      const on = lay[b.r][b.c] === '#';
      if (on === b.on) continue; b.on = on; b.g.visible = on;
      const i = colliders.indexOf(b.col);
      if (on && i < 0) colliders.push(b.col); if (!on && i >= 0) colliders.splice(i, 1);
    }
    return true;
  }
  const blocked = (c, r) => { const lay = mazeLayout(((phase % 5) + 5) % 5); return lay[r]?.[c] === '#'; };
  // 被書架擠到時：找最近的空格
  function nearestFree(c, r) {
    const seen = new Set([`${c},${r}`]), q = [[c, r]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x >= 0 && x < 5 && y >= 0 && y < 5 && !blocked(x, y)) return [x, y];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (!seen.has(k) && x + dx >= 0 && x + dx < 5 && y + dy >= 0 && y + dy < 5) { seen.add(k); q.push([x + dx, y + dy]); } }
    }
    return [MAZE.entry[0], MAZE.entry[1]];
  }

  // ---- 入口大廳：拖行的血跡（到高年級生的屍體） ----
  const blood = new THREE.MeshBasicMaterial({ color: '#4a0606', transparent: true, opacity: 0.85 });
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + Math.random() * 0.3, 0.7), blood);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 0.4; m.position.set(108 + i * 0.3, 0.015, 13 - i * 0.7); root.add(m);
  }
  // 高年級生：下半身結晶化（黑色尖刺），上半身被啃過（露出的肋骨）
  const body = new THREE.Group(); body.position.set(112, 0, 4); root.add(body);
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6 + Math.random() * 0.6, 5), new THREE.MeshStandardMaterial({ color: '#0d0d18', emissive: '#08081a', roughness: 0.2, metalness: 0.6 })); s.position.set(-0.6 + Math.random() * 0.6, 0.3, -0.3 + Math.random() * 0.6); s.rotation.z = Math.random() - 0.5; body.add(s); }
  for (let i = 0; i < 6; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: '#d8cfc0' })); rib.position.set(0.3 + i * 0.09, 0.3, 0); rib.rotation.y = Math.PI / 2; body.add(rib); }
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshStandardMaterial({ color: '#5a0a0a', roughness: 0.4 })); torso.position.set(0.5, 0.15, 0); body.add(torso);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.3, 8), new THREE.MeshBasicMaterial({ color: '#ffcf70' })); lantern.position.set(0.9, 0.2, 0.3); body.add(lantern);

  // ---- 暗室的石板：摸到才會微微發光（由 act3.mjs 控制） ----
  const tiles = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ color: '#0a0a12' }));
    m.position.set(136.85, 1.9 - Math.floor(i / 4) * 0.48, -55.75 + (i % 4) * 0.5); m.rotation.y = -Math.PI / 2; root.add(m); tiles.push(m);
  }

  return {
    setPhase, nearestFree, blocked,
    lightTile(i, on) { if (tiles[i]) tiles[i].material.color.set(on ? '#7aa0ff' : '#0a0a12'); },
    takeLantern() { lantern.visible = false; },
  };
}
