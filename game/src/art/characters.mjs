// 正式遊戲的角色模型（帳號二）：載入 game/models/chars/<代號>.glb，並讓角色眨眼、說話、轉頭、呼吸。
// 模型由 prototype/ 的角色程式（皮膚、頭髮、衣服都處理好）烘焙成單一檔案，每個 5MB 以下。
//
// 用法：
//   import { loadCharacter } from '../art/characters.mjs';
//   const c = await loadCharacter('yuexi');   // 'yuexi' | 'vaughn' | 'elora' | 'cyril' | 'helga' | 'aldric' | 'moray' | 'knox'
//   group.add(c.root);                          // 正面朝 -z，腳底在 y=0
//   每一格：c.update(dt, lookAt)              // lookAt：要看的世界座標（例如玩家的相機位置），可以不給
//   c.talk(秒數)、c.setMood('calm' | 'smile' | 'scared')
//   c.setMoving(速度)                           // 走路時身體輕微上下晃（模型還沒有走路動作）
import * as THREE from 'three';
import { GLTFLoader } from '../../../prototype/vendor/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../../../prototype/vendor/addons/libs/meshopt_decoder.module.js';

export const CHARACTER_KEYS = ['yuexi', 'vaughn', 'elora', 'cyril', 'helga', 'aldric', 'moray', 'knox'];
let base = 'models/chars/';
/** 模型資料夾的位置（預設 models/chars/，相對於網頁） */
export const setCharacterBase = (url) => { base = url.endsWith('/') ? url : url + '/'; };

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map(); // 同一個角色只下載一次，之後複製

// 烘焙時材質只能存成一般的 PBR，載入後換回原本的效果
function restoreMaterial(m) {
  const name = m.name || '';
  if (/Skin_/.test(name)) { // 皮膚：顏色在頂點上，邊緣透一點紅
    return new THREE.MeshPhysicalMaterial({ name, color: '#ffffff', vertexColors: true, roughness: 0.55, normalMap: m.normalMap, normalScale: new THREE.Vector2(0.12, 0.12),
      sheen: 0.35, sheenColor: new THREE.Color('#ff9a85'), sheenRoughness: 0.5 });
  }
  if (/^hair$/.test(name)) { // 細髮絲（艾洛拉的短捲髮）：半透明疊加、不透明度加倍
    const h = new THREE.MeshLambertMaterial({ name, color: '#ffffff', vertexColors: true, map: m.map, transparent: true, depthWrite: false, alphaTest: 0.03, side: THREE.DoubleSide });
    h.customProgramCacheKey = () => 'hair-alpha-boost';
    h.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.a = clamp(diffuseColor.a * 2.4, 0.0, 1.0);'); };
    return h;
  }
  if (/Slicked_Back|Hair_Transparency/.test(name)) return new THREE.MeshLambertMaterial({ name, color: '#ffffff', vertexColors: true, map: m.map, alphaTest: 0.3, side: THREE.DoubleSide });
  if (/Scalp|Female_Flat|Eyelash/.test(name)) return new THREE.MeshLambertMaterial({ name, color: m.color, vertexColors: m.vertexColors, map: m.map, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  if (name === 'hidden') { m.visible = false; return m; }
  return m;
}

async function loadSource(key) {
  if (!cache.has(key)) cache.set(key, loader.loadAsync(base + key + '.glb'));
  return cache.get(key);
}

// 複製一份（同一個角色可能同時有好幾個，例如電腦控制的同伴＋隊友）
function cloneSkinned(src) {
  const map = new Map(), clone = src.clone(true);
  const a = [], b = []; src.traverse((o) => a.push(o)); clone.traverse((o) => b.push(o));
  a.forEach((o, i) => map.set(o, b[i]));
  clone.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const orig = a[b.indexOf(o)];
    o.bind(new THREE.Skeleton(orig.skeleton.bones.map((bone) => map.get(bone)), orig.skeleton.boneInverses), orig.bindMatrix);
  });
  return clone;
}

export async function loadCharacter(key) {
  const gltf = await loadSource(key);
  const model = cloneSkinned(gltf.scene);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(restoreMaterial) : restoreMaterial(o.material);
    o.castShadow = true; o.receiveShadow = true;
    o.frustumCulled = false; // 骨架會轉頭，自動算的範圍跟不上
  });
  const root = new THREE.Group(); model.rotation.y = Math.PI; root.add(model); // 模型原本面向 +z，轉成面向 -z

  // 找骨頭（不同模型前綴不同）、表情
  let head = null, spine = null;
  model.traverse((o) => { if (!o.isBone) return; if (!head && /_Head$/.test(o.name)) head = o; if (!spine && /_Spine02$/.test(o.name)) spine = o; });
  const morphMeshes = []; model.traverse((o) => { if (o.morphTargetDictionary) morphMeshes.push(o); });
  const set = (k, v) => { for (const m of morphMeshes) { const i = m.morphTargetDictionary[k]; if (i != null) m.morphTargetInfluences[i] = v; } };
  const headBase = head?.quaternion.clone(), spineBase = spine?.quaternion.clone();
  const st = { t: Math.random() * 10, blink: 0, next: 1 + Math.random() * 3, talk: 0, mood: 'calm', yaw: 0, pitch: 0, moving: 0 };
  const tmp = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), inv = new THREE.Matrix4();
  const rotWorld = (b, axis, ang) => {
    const pw = new THREE.Quaternion(); b.parent.getWorldQuaternion(pw);
    q.setFromAxisAngle(axis, ang);
    b.quaternion.premultiply(pw.clone().invert().multiply(q).multiply(pw));
  };

  return {
    root, key,
    talk(sec) { st.talk = sec; },
    setMood(m) { st.mood = m; },
    setMoving(speed) { st.moving = speed; },
    update(dt, lookAt) {
      st.t += dt;
      const t = st.t;
      // 呼吸；走路時上下晃
      if (spine) { e.set(Math.sin(t * 1.4) * 0.015, 0, 0); spine.quaternion.copy(spineBase).multiply(q.setFromEuler(e)); }
      model.position.y = st.moving > 0.1 ? Math.abs(Math.sin(t * 7)) * 0.025 : 0;
      // 轉頭看目標（限制角度）
      if (head) {
        head.quaternion.copy(headBase);
        let wantYaw = 0, wantPitch = 0;
        if (lookAt) {
          root.updateMatrixWorld(true); head.getWorldPosition(tmp);
          inv.copy(root.matrixWorld).invert();
          const l = lookAt.clone().applyMatrix4(inv), h = tmp.clone().applyMatrix4(inv); // 在角色自己的座標（正面 -z）
          const dx = l.x - h.x, dz = l.z - h.z, dist = Math.hypot(dx, dz);
          if (dist < 6) { wantYaw = THREE.MathUtils.clamp(Math.atan2(-dx, -dz), -1, 1); wantPitch = THREE.MathUtils.clamp(-Math.atan2(l.y - h.y, dist), -0.4, 0.4); }
        }
        st.yaw += (wantYaw - st.yaw) * Math.min(1, dt * 3); st.pitch += (wantPitch - st.pitch) * Math.min(1, dt * 3);
        const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(1, 0, 0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
        rotWorld(head, up, st.yaw); rotWorld(head, side, -st.pitch * 0.6);
      }
      // 眨眼
      st.next -= dt; if (st.next <= 0) { st.blink = 1; st.next = 2 + Math.random() * 3; }
      st.blink = Math.max(0, st.blink - dt * 8); set('Eyes_Blink', st.blink > 0 ? Math.sin(st.blink * Math.PI) : 0);
      // 說話
      if (st.talk > 0) { st.talk -= dt; const m = Math.abs(Math.sin(t * 15)) * (0.5 + 0.5 * Math.sin(t * 4.3)); set('V_Open', m * 0.6); set('Mouth_Open', m * 0.25); } else { set('V_Open', 0); set('Mouth_Open', 0); }
      // 表情
      const smile = st.mood === 'smile' ? 0.75 : 0, scared = st.mood === 'scared' ? 1 : 0;
      set('Mouth_Smile', smile); set('Cheek_Raise_L', smile * 0.5); set('Cheek_Raise_R', smile * 0.5);
      set('A01_Brow_Inner_Up', scared); set('A18_Eye_Wide_Left', scared * 0.7); set('A19_Eye_Wide_Right', scared * 0.7); set('Mouth_Frown', scared * 0.4);
    },
  };
}
