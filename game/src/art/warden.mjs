// 守夜人葛雷（蝕化後）的正式模型（帳號二）：game/models/chars/warden.glb，有待機、走路、跑步、撲抓四個動作。
// 透過美術掛鉤換掉 game/src/world/warden.mjs 的灰盒；玩法用的綠光（SpotLight、PointLight）原封不動留著。
// 動作的選法：
//   - 帳號一的 frame(dt, mode) 裡呼叫 group.userData.update?.(dt, mode) 時，照 AI 的狀態（idle／patrol／search／chase／grab／stun）。
//   - 沒有呼叫時，自己每一格看移動速度選走路或跑步（不知道撲抓的時機）。
import * as THREE from 'three';
import { GLTFLoader } from '../../../prototype/vendor/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../../../prototype/vendor/addons/libs/meshopt_decoder.module.js';
import { decorators } from '../world/art-hooks.mjs';

let base = 'models/chars/';
/** 模型資料夾的位置（跟 characters.mjs 的 setCharacterBase 一樣，預設 models/chars/） */
export const setWardenBase = (url) => { base = url.endsWith('/') ? url : url + '/'; };
let source = null;

const MODE_ANIM = { idle: 'idle', stun: 'idle', patrol: 'walk', search: 'walk', chase: 'run', grab: 'attack' };

export async function loadWardenModel() {
  source ||= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(base + 'warden.glb');
  const gltf = await source;
  const model = gltf.scene.clone(true);
  // 複製後骨架要重新接上
  const map = new Map(), a = [], b = []; gltf.scene.traverse((o) => a.push(o)); model.traverse((o) => b.push(o)); a.forEach((o, i) => map.set(o, b[i]));
  model.traverse((o) => {
    if (o.isSkinnedMesh) { const src = a[b.indexOf(o)]; o.bind(new THREE.Skeleton(src.skeleton.bones.map((x) => map.get(x)), src.skeleton.boneInverses), src.bindMatrix); }
    if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material.name === 'warden_eyes') o.material = new THREE.MeshBasicMaterial({ color: '#7dff9a', fog: false }); }
  });
  const root = new THREE.Group(); model.rotation.y = Math.PI; root.add(model); // 模型面向 +z，遊戲要 -z

  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(gltf.animations.map((c) => [c.name, mixer.clipAction(c)]));
  actions.attack.setLoop(THREE.LoopOnce); actions.attack.clampWhenFinished = true;
  let cur = actions.idle; cur.play();
  const play = (name, fade = 0.3) => { const next = actions[name]; if (!next || next === cur) return; next.reset().play(); cur.crossFadeTo(next, fade, false); cur = next; };

  // 右手提的綠色燈（外觀；真正照人的光在灰盒那邊）
  const lamp = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: '#2a2622', metalness: 0.7, roughness: 0.4 });
  const glass = new THREE.MeshBasicMaterial({ color: '#5dff86', transparent: true, opacity: 0.85, fog: false });
  lamp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.16, 8), glass));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.06, 8), frame); cap.position.y = 0.11; lamp.add(cap);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 8), frame); bottom.position.y = -0.09; lamp.add(bottom);
  root.add(lamp);
  let hand = null; model.traverse((o) => { if (!hand && o.isBone && /hand_r$/.test(o.name)) hand = o; });
  const hp = new THREE.Vector3();
  let t = 0;
  return {
    root, play,
    update(dt) {
      t += dt; mixer.update(dt);
      if (hand) { root.updateMatrixWorld(true); hand.getWorldPosition(hp); root.worldToLocal(hp); lamp.position.copy(hp).add(new THREE.Vector3(0, -0.2, 0)); }
      lamp.rotation.z = Math.sin(t * 2.2) * 0.12;
      glass.opacity = 0.7 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7);
    },
  };
}

decorators.npc.push(({ key, group }) => {
  if (key !== 'warden') return;
  loadWardenModel().then((w) => {
    group.traverse((c) => { if (c.isMesh) c.visible = false; }); // 灰盒（含肋骨那一組）藏起來，燈光留著
    group.add(w.root);
    let told = false, last = null, speed = 0;
    const clock = new THREE.Clock();
    group.userData.update = (dt, mode) => { told = true; w.play(MODE_ANIM[mode] || 'walk'); w.update(dt); };
    // 帳號一還沒呼叫 userData.update 時：在畫面要畫它之前自己更新
    // （看不見的材質不會被畫，onBeforeRender 就不會被叫；所以用一個縮成一點、不寫顏色也不寫深度的三角形）
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    const tick = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    tick.frustumCulled = false;
    tick.onBeforeRender = () => {
      const dt = Math.min(clock.getDelta(), 0.1);
      if (told) return;
      const p = group.position;
      if (last && dt > 0) speed += (Math.hypot(p.x - last.x, p.z - last.z) / dt - speed) * Math.min(1, dt * 5);
      last = { x: p.x, z: p.z };
      w.play(speed > 2.2 ? 'run' : speed > 0.2 ? 'walk' : 'idle');
      w.update(dt);
    };
    group.add(tick);
  }).catch((e) => console.warn('守夜人模型載入失敗，先用灰盒', e));
});
