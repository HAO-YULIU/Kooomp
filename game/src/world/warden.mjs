// 守夜人葛雷（蝕化後）：灰盒版本。正式模型由帳號二換上（docs/08-world-format.md，角色代號 warden）。
// 背後裂開、肋骨像門一樣往兩側撐開、黑色結晶刺穿衣服、臉皮往下剝落；提燈發綠光（照到會被發現）。
import * as THREE from 'three';
import { decorators } from './art-hooks.mjs';

export function createWarden(scene, { view = 12, fov = 60 } = {}) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const coat = new THREE.MeshStandardMaterial({ color: '#1a1c18', roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: '#8f7f72', roughness: 0.6 });
  const flesh = new THREE.MeshStandardMaterial({ color: '#4a0808', roughness: 0.35 });
  const bone = new THREE.MeshStandardMaterial({ color: '#d6cbb8', roughness: 0.5 });
  const crystal = new THREE.MeshStandardMaterial({ color: '#0b0b16', emissive: '#0a0a24', roughness: 0.15, metalness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.4, 1.6, 10), coat); body.position.y = 0.95; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), skin); head.position.y = 1.95; head.scale.set(1, 1.15, 1); g.add(head);
  // 剝落的臉皮掛在下巴、漆黑的眼睛
  const peel = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.3), new THREE.MeshStandardMaterial({ color: '#7a5a50', side: THREE.DoubleSide, roughness: 0.7 }));
  peel.position.set(0, 1.72, -0.17); peel.rotation.x = 0.35; g.add(peel);
  const raw = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), flesh); raw.position.set(0, 1.95, -0.172); raw.rotation.y = Math.PI; g.add(raw);
  for (const x of [-0.06, 0.06]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#000000' })); e.position.set(x, 1.98, -0.16); g.add(e); }
  // 背後裂開：肋骨往兩側撐開
  const ribs = new THREE.Group(); ribs.position.set(0, 1.25, 0.18); g.add(ribs);
  for (let i = 0; i < 5; i++) for (const side of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 5, 10, Math.PI * 0.6), bone);
    r.position.set(side * 0.08, 0.25 - i * 0.12, 0.05); r.rotation.set(0, side * 1.2, side > 0 ? 0 : Math.PI); ribs.add(r);
  }
  const wound = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.7), flesh); wound.position.set(0, 1.2, 0.27); g.add(wound);
  // 黑色結晶從裂口刺穿衣服
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.05 + Math.random() * 0.04, 0.4 + Math.random() * 0.5, 5), crystal);
    c.position.set((Math.random() - 0.5) * 0.5, 1 + Math.random() * 0.8, 0.22); c.rotation.set(1.1 + Math.random() * 0.5, 0, (Math.random() - 0.5) * 1.2); g.add(c);
  }
  // 綠色提燈（右手）：燈本身＋照出前方扇形的光
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.24, 8), new THREE.MeshBasicMaterial({ color: '#7dff9a' }));
  lamp.position.set(0.38, 1.1, -0.25); g.add(lamp);
  const beam = new THREE.SpotLight('#5dff7a', 60, view, THREE.MathUtils.degToRad(fov / 2), 0.35, 1.2);
  beam.position.set(0.38, 1.2, -0.3); beam.target.position.set(0.3, 0, -6); g.add(beam, beam.target);
  const glow = new THREE.PointLight('#5dff7a', 2, 4, 2); glow.position.copy(lamp.position); g.add(glow);
  for (const fn of decorators.npc ?? []) fn({ key: 'warden', group: g, THREE });

  let t = 0;
  return {
    group: g,
    set({ x, z, yaw, visible = true, mode }) {
      g.visible = visible; if (!visible) return;
      g.position.set(x, 0, z); g.rotation.y = yaw;
      beam.intensity = mode === 'stun' ? 8 : mode === 'chase' ? 90 : 60;
    },
    frame(dt, mode) { // 走路時的搖晃、追趕時的抽動
      t += dt * (mode === 'chase' ? 9 : 4);
      g.children[0].rotation.z = Math.sin(t) * 0.04;
      ribs.scale.x = 1 + Math.sin(t * 0.7) * 0.08;
      head.rotation.z = mode === 'chase' ? Math.sin(t * 3.1) * 0.25 : 0.15;
      g.userData.update?.(dt, mode); // 正式模型（帳號二）：照 AI 狀態播待機／走路／跑步／撲抓
    },
  };
}
