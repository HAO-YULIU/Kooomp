// 守夜人葛雷（第一章的追逐者）：製作人提供的免費怪物模型「possessed critter」，
// 製作人再用 Mixamo 加上四個動作：待機（駝背老人）、走路、跑步、撲抓（都是殭屍的動作）。
// 貼圖沒有附上，每個零件用程式上色；右手提一盞綠色的燈。
import * as THREE from 'three';
import { FBXLoader } from '../vendor/addons/loaders/FBXLoader.js';

// 依材質名稱上色：死灰的皮膚、破舊的布、生鏽的金屬、發綠光的眼睛
const LOOK = {
  Head_1: { color: '#8f9488', roughness: 0.8 },
  Hands_1: { color: '#7d8276', roughness: 0.8 },
  Torso_1: { color: '#26231f', roughness: 0.95 },
  Legs_1: { color: '#1d1b18', roughness: 0.95 },
  LegArmor_1: { color: '#3a2c20', roughness: 0.6 },
  Equip_1: { color: '#4a3424', roughness: 0.55 },
  Equip_2: { color: '#3b3832', roughness: 0.9 },
  Equip_3: { color: '#3e3a36', roughness: 0.45, metalness: 0.6 },
};

const ANIMS = { idle: 'idle.fbx', walk: 'walk.fbx', run: 'run.fbx', attack: 'attack.fbx' };

export async function loadWarden(scene) {
  // FBX 裡記的貼圖檔案不存在，全部擋掉
  const mgr = new THREE.LoadingManager(); mgr.setURLModifier((u) => (/\.fbx$/i.test(u) ? u : 'data:,'));
  const load = (f) => new FBXLoader(mgr).loadAsync('models/warden/' + f);
  // 模型用待機那個檔案；其他三個檔案只拿動作（同一副骨架）
  const [o, ...others] = await Promise.all([load(ANIMS.idle), load(ANIMS.walk), load(ANIMS.run), load(ANIMS.attack)]);
  const clips = { idle: o.animations[0], walk: others[0].animations[0], run: others[1].animations[0], attack: others[2].animations[0] };
  o.traverse((c) => {
    if (!c.isMesh) return;
    c.castShadow = true; c.frustumCulled = false;
    if (/Eyes/.test(c.name)) { c.material = new THREE.MeshBasicMaterial({ color: '#7dff9a', fog: false }); return; } // 眼睛發綠光
    if (/teeth/.test(c.name)) { c.material = new THREE.MeshStandardMaterial({ color: '#b5a882', roughness: 0.5 }); return; }
    const mats = [].concat(c.material).map((m) => new THREE.MeshStandardMaterial({ name: m.name, ...(LOOK[m.name] || { color: '#333' }) }));
    c.material = Array.isArray(c.material) ? mats : mats[0];
  });
  o.scale.setScalar(0.0098); // 公分 → 公尺，大約 1.86 公尺
  const mixer = new THREE.AnimationMixer(o);
  const actions = Object.fromEntries(Object.entries(clips).map(([k, c]) => [k, mixer.clipAction(c)]));
  actions.attack.setLoop(THREE.LoopOnce); actions.attack.clampWhenFinished = true;
  let cur = actions.idle; cur.play();
  /** 換動作：idle 待機、walk 走路、run 跑步、attack 撲抓（播一次） */
  function play(name, fade = 0.3) {
    const next = actions[name]; if (!next || next === cur) return;
    next.reset().play(); cur.crossFadeTo(next, fade, false); cur = next;
  }

  // 綠色的燈：掛在右手
  const lamp = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: '#2a2622', metalness: 0.7, roughness: 0.4 });
  const glass = new THREE.MeshBasicMaterial({ color: '#5dff86', transparent: true, opacity: 0.85, fog: false });
  lamp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.16, 8), glass));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.06, 8), frame); cap.position.y = 0.11; lamp.add(cap);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 8), frame); base.position.y = -0.09; lamp.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 6, 12), frame); ring.position.y = 0.16; lamp.add(ring);
  let hand = null; o.traverse((c) => { if (!hand && c.isBone && c.name === 'hand_r') hand = c; });
  const holder = new THREE.Group(); holder.add(o); scene.add(holder);
  holder.add(lamp);
  const hp = new THREE.Vector3();
  return {
    root: holder, lamp, play, clips: Object.keys(clips),
    update(t, dt = 1 / 60) {
      mixer.update(dt);
      // 燈跟著手、輕輕晃
      o.updateMatrixWorld(true); hand.getWorldPosition(hp); holder.worldToLocal(hp);
      lamp.position.copy(hp).add(new THREE.Vector3(0, -0.2, 0.02)); lamp.rotation.z = Math.sin(t * 2.2) * 0.12;
      glass.opacity = 0.7 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7);
    },
  };
}
