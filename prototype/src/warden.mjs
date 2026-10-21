// 守夜人葛雷（第一章的追逐者）：製作人提供的免費怪物模型「possessed critter」。
// 有骨架（遊戲引擎常見的人形骨架），但貼圖沒有附上，所以每個零件用程式上色；
// 再用骨架擺成駝背、垂手的姿勢，右手提一盞綠色的燈。
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

export function loadWarden(scene) {
  return new Promise((resolve, reject) => {
    // FBX 裡記的貼圖檔案不存在，全部擋掉
    const mgr = new THREE.LoadingManager(); mgr.setURLModifier((u) => (/\.fbx$/i.test(u) ? u : 'data:,'));
    new FBXLoader(mgr).load('models/warden/Warden.fbx', (o) => { // 檔案裡的 SM_Monster1_1.fbx；另一個 Monster1_1.fbx 的骨架和身體對不上，不能用
      o.traverse((c) => {
        if (!c.isMesh) return;
        c.castShadow = true; c.frustumCulled = false;
        if (/Eyes/.test(c.name)) { c.material = new THREE.MeshBasicMaterial({ color: '#7dff9a', fog: false }); return; } // 眼睛發綠光
        if (/teeth/.test(c.name)) { c.material = new THREE.MeshStandardMaterial({ color: '#b5a882', roughness: 0.5 }); return; }
        const mats = [].concat(c.material).map((m) => new THREE.MeshStandardMaterial({ name: m.name, ...(LOOK[m.name] || { color: '#333' }) }));
        c.material = Array.isArray(c.material) ? mats : mats[0];
      });
      o.scale.setScalar(0.0095); // 公分 → 公尺，大約 1.86 公尺
      // 姿勢：手臂放下、彎腰駝背、頭往前伸
      o.updateMatrixWorld(true);
      // 每個零件各自帶一份同名的骨架，擺姿勢時要每一份都轉
      const bones = (n) => { const list = []; o.traverse((c) => { if (c.isBone && c.name === n) list.push(c); }); return list; };
      const rotWorld = (name, axis, ang) => { for (const b of bones(name)) rotOne(b, axis, ang); };
      const rotOne = (b, axis, ang) => {
        const pw = new THREE.Quaternion(); b.parent.getWorldQuaternion(pw);
        const q = new THREE.Quaternion().setFromAxisAngle(axis, ang);
        b.quaternion.copy(pw.clone().invert().multiply(q).multiply(pw).multiply(b.quaternion)); b.updateMatrixWorld(true);
      };
      const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
      rotWorld('spine_02', X, -0.28); rotWorld('spine_03', X, -0.22); // 這副骨架往前彎是負的角度
      rotWorld('neck_01', X, 0.2); rotWorld('head', X, 0.25);
      rotWorld('upperarm_l', Z, -0.75); rotWorld('upperarm_r', Z, 0.55);
      rotWorld('lowerarm_r', X, -0.9); // 右手往前彎，提著燈
      // 綠色的燈：掛在右手
      const lamp = new THREE.Group();
      const frame = new THREE.MeshStandardMaterial({ color: '#2a2622', metalness: 0.7, roughness: 0.4 });
      const glass = new THREE.MeshBasicMaterial({ color: '#5dff86', transparent: true, opacity: 0.85, fog: false });
      lamp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.16, 8), glass));
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.06, 8), frame); cap.position.y = 0.11; lamp.add(cap);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 8), frame); base.position.y = -0.09; lamp.add(base);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 6, 12), frame); ring.position.y = 0.16; lamp.add(ring);
      const hand = bones('hand_r')[0];
      const holder = new THREE.Group(); holder.add(o); scene.add(holder);
      holder.add(lamp);
      const hp = new THREE.Vector3();
      resolve({
        root: holder, lamp,
        update(t) {
          // 燈跟著手、輕輕晃
          o.updateMatrixWorld(true); hand.getWorldPosition(hp); holder.worldToLocal(hp);
          lamp.position.copy(hp).add(new THREE.Vector3(0, -0.2, 0.02)); lamp.rotation.z = Math.sin(t * 2.2) * 0.12;
          glass.opacity = 0.7 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7);
        },
      });
    }, undefined, reject);
  });
}
