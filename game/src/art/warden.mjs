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

  const ribs = corrupt(model, root); // 背後翻開的肋骨（鉸鍊），每一格讓它們開合
  let open = 0;

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
    update(dt, mode) {
      // 肋骨：平常隨呼吸微微開合；追趕、撲抓時整個撐開
      const want = mode === 'chase' || mode === 'grab' ? 1 : 0; open += (want - open) * Math.min(1, dt * 3);
      t += dt; mixer.update(dt);
      for (const r of ribs) r.h.rotation.y = r.sd * (0.12 + 0.1 * Math.sin(t * (1.6 + open * 5) + r.ph) + open * 0.55);
      if (hand) { root.updateMatrixWorld(true); hand.getWorldPosition(hp); root.worldToLocal(hp); lamp.position.copy(hp).add(new THREE.Vector3(0, -0.2, 0)); }
      lamp.rotation.z = Math.sin(t * 2.2) * 0.12;
      glass.opacity = 0.7 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7);
    },
  };
}


// ---------- 蝕化（docs：背後裂開、肋骨像門一樣往兩側撐開、黑色結晶刺穿衣服、臉皮往下剝落） ----------
// 先在「站好的姿勢」下，用世界座標把東西擺在身上，再掛到最近的骨頭（bone.attach 會保留位置），之後就跟著動作動。
function corrupt(model, root) {
  const hinges = [];
  root.updateMatrixWorld(true);
  // 骨頭有好幾份（每個零件自己一份，名字後面可能多了 _1）；找會動的那一份：被零件的骨架用到的
  const used = []; model.traverse((o) => { if (o.isSkinnedMesh) used.push(...o.skeleton.bones); });
  const bone = (n) => used.find((b) => b.name === n) || used.find((b) => new RegExp('^' + n + '(_\\d+)?$').test(b.name));
  const spine = bone('spine_03') || bone('spine_02'), spineLow = bone('spine_01'), head = bone('head'), neck = bone('neck_01'), armL = bone('upperarm_l'), armR = bone('upperarm_r');
  if (window.__wardenDebug) console.error('warden bones ' + [spine, spineLow, head, neck, armL, armR].map((b) => b?.name).join(','));
  if (!spine || !head) return hinges;
  const W = (b) => b.getWorldPosition(new THREE.Vector3());
  const q = model.getWorldQuaternion(new THREE.Quaternion());
  const BACK = new THREE.Vector3(0, 0, -1).applyQuaternion(q), UP = new THREE.Vector3(0, 1, 0), SIDE = new THREE.Vector3(1, 0, 0).applyQuaternion(q), FRONT = BACK.clone().negate();
  const chest = W(spine), low = spineLow ? W(spineLow) : chest.clone().addScaledVector(UP, -0.25), H = W(head);
  const torsoR = 0.17; // 背離骨頭大約多遠（公尺）
  const put = (mesh, pos, parent) => { mesh.position.copy(pos); root.add(mesh); mesh.updateMatrixWorld(true); parent.attach(mesh); mesh.frustumCulled = false; mesh.castShadow = true; return mesh; };
  const look = (mesh, dir) => { mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); return mesh; };

  const flesh = new THREE.MeshStandardMaterial({ color: '#4a0808', roughness: 0.35, emissive: '#1a0000' });
  const wet = new THREE.MeshStandardMaterial({ color: '#2a0204', roughness: 0.15, metalness: 0.2 });
  const boneMat = new THREE.MeshStandardMaterial({ color: '#d6cbb8', roughness: 0.5 });
  const crystal = new THREE.MeshStandardMaterial({ color: '#07060c', emissive: '#0a0618', roughness: 0.18, metalness: 0.55, flatShading: true }); // 黑色、帶一點紫，邊緣反光

  // 1. 背後的裂口：一條長長的血肉（橢圓），沿著脊椎
  const mid = chest.clone().lerp(low, 0.4).addScaledVector(BACK, torsoR * 0.9);
  const AXIS = chest.clone().sub(low).normalize(); // 脊椎的方向（駝背時是斜的）
  const wg = new THREE.SphereGeometry(1, 14, 10); wg.scale(0.06, 0.24, 0.03);
  const wound = new THREE.Mesh(wg, flesh); look(wound, AXIS); put(wound, mid, spine);
  const wg2 = new THREE.SphereGeometry(1, 10, 8); wg2.scale(0.03, 0.2, 0.03);
  const wound2 = new THREE.Mesh(wg2, wet); look(wound2, AXIS); put(wound2, mid.clone().addScaledVector(BACK, 0.01), spine);

  // 2. 肋骨像門一樣往兩側撐開：每邊 4 根彎彎的骨頭，從裂口兩邊往外翻
  for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) {
    const base = mid.clone().addScaledVector(AXIS, 0.12 - i * 0.075).addScaledVector(SIDE, sd * 0.045);
    const r = 0.1 - Math.abs(i - 1.5) * 0.01;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 5, 12, Math.PI * 0.85), boneMat);
    // 圓弧的平面：往旁邊、往後；從裂口邊緣開始彎出去再彎回身上
    const m = new THREE.Matrix4().makeBasis(SIDE.clone().multiplyScalar(sd), BACK, AXIS.clone().cross(SIDE).normalize().multiplyScalar(sd));
    rib.quaternion.setFromRotationMatrix(m); rib.rotateZ(-Math.PI * 0.15);
    // 鉸鍊：在裂口邊緣，沿著脊椎的方向轉；肋骨像門一樣開合
    const hinge = new THREE.Object3D(); look(hinge, AXIS); put(hinge, base, spine);
    rib.position.copy(base.clone().addScaledVector(SIDE, sd * r * 0.9)); root.add(rib); rib.updateMatrixWorld(true); hinge.attach(rib); rib.frustumCulled = false; rib.castShadow = true;
    hinges.push({ h: hinge, sd, ph: i * 0.6 });
  }

  // 3. 黑色結晶：從背上的裂口、肩膀、手臂刺穿衣服
  const spikes = [
    ...Array.from({ length: 9 }, (_, i) => ({ b: spine, p: chest.clone().lerp(low, 0.1 + (i % 5) * 0.2).addScaledVector(BACK, torsoR * 0.8).addScaledVector(SIDE, (i % 2 ? 1 : -1) * (0.05 + (i * 37 % 7) * 0.012)), d: BACK.clone().addScaledVector(UP, 0.5 + (i % 3) * 0.3).addScaledVector(SIDE, (i % 2 ? 1 : -1) * 0.35), l: 0.22 + (i * 13 % 9) * 0.03 })),
    ...[armL, armR].filter(Boolean).flatMap((a, j) => [0, 1, 2].map((i) => ({ b: a, p: W(a).addScaledVector(UP, 0.03 - i * 0.07).addScaledVector(BACK, 0.04), d: UP.clone().addScaledVector(SIDE, (j ? -1 : 1) * 0.6).addScaledVector(BACK, 0.4), l: 0.12 + i * 0.04 }))),
  ];
  for (const s of spikes) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.022 + s.l * 0.08, s.l, 5), crystal); c.geometry.translate(0, s.l / 2, 0);
    look(c, s.d); put(c, s.p, s.b);
  }

  // 4. 臉皮往下剝落：一片皮從下巴垂下來，露出底下的紅肉；眼睛（模型本身）發綠光
  const face = H.clone().addScaledVector(FRONT, 0.095).addScaledVector(UP, 0.09).addScaledVector(SIDE, -0.035); // 左邊臉頰
  const raw = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), flesh); raw.scale.set(0.035, 0.045, 0.012); raw.quaternion.copy(q); put(raw, face, head);
  const peel = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.1, 1, 3), new THREE.MeshStandardMaterial({ color: '#8a7466', roughness: 0.7, side: THREE.DoubleSide }));
  const pp = peel.geometry.attributes.position; for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); pp.setZ(i, (0.05 - y) ** 2 * 3); } peel.geometry.translate(0, -0.05, 0); peel.geometry.computeVertexNormals();
  peel.quaternion.copy(q); peel.rotateX(0.35); peel.scale.setScalar(0.8); put(peel, face.clone().addScaledVector(UP, -0.025).addScaledVector(FRONT, 0.004), head);
  return hinges;
}

decorators.npc.push(({ key, group }) => {
  if (key !== 'warden') return;
  loadWardenModel().then((w) => {
    group.traverse((c) => { if (c.isMesh) c.visible = false; }); // 灰盒（含肋骨那一組）藏起來，燈光留著
    group.add(w.root);
    let told = false, last = null, speed = 0;
    const clock = new THREE.Clock();
    group.userData.update = (dt, mode) => { told = true; w.play(MODE_ANIM[mode] || 'walk'); w.update(dt, mode); };
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
      w.update(dt, speed > 2.2 ? 'chase' : 'patrol');
    };
    group.add(tick);
  }).catch((e) => console.warn('守夜人模型載入失敗，先用灰盒', e));
});
