// 第 1 批的測試場景：沿用技術雛形的樣品教室，加上隊友的位置與標記。
// 隊友目前是簡單的人形，正式的角色模型由帳號二做好後換上（game/src/art/）。
import * as THREE from 'three';
import { buildClassroom, ROOM } from '../../../prototype/src/scene.mjs';
import { createControls } from '../../../prototype/src/controls.mjs';
import { HOUSES, CHARS } from '../logic/chars.mjs';

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// 測試用的區域：教室左半邊、右半邊（正式版是一個房間一個區域）
export const zoneOf = (x) => (x < 0 ? 'classroom_w' : 'classroom_e');

function nameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px "Noto Serif TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 8, 256, 48);
  g.fillStyle = color; g.fillText(text, 128, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(1.2, 0.3, 1); s.renderOrder = 10;
  return s;
}

function makeAvatar(label, charKey) {
  const house = CHARS[charKey]?.house; const color = HOUSES[house]?.color ?? '#cccccc';
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.3, 12), new THREE.MeshStandardMaterial({ color: '#141418', roughness: 0.8 }));
  robe.position.y = 0.65; robe.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), new THREE.MeshStandardMaterial({ color: '#e5c4aa', roughness: 0.7 }));
  head.position.y = 1.5;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  scarf.position.y = 1.32; scarf.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), head.material); nose.position.set(0, 1.5, -0.16);
  const tag = nameTag(label, color); tag.position.y = 1.95;
  g.add(robe, head, scarf, nose, tag);
  return g;
}

const MARK_COLOR = { here: '#9fc4ff', danger: '#ff4a3a', help: '#f2c14e' };

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
  scene.add(camera);
  const room = buildClassroom(scene, { lowQuality: isTouch });
  const controls = createControls(camera, renderer.domElement, {
    colliders: room.colliders, isTouch,
    bounds: { minX: -ROOM.w / 2, maxX: ROOM.w / 2, minZ: -ROOM.d / 2, maxZ: ROOM.d / 2 },
  });
  controls.state.yaw = 0.15;
  renderer.domElement.addEventListener('click', () => controls.lockPointer());

  const avatars = new Map(); // uid → Group
  const marks = []; // { mesh, until }
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize); resize();

  let lastPos = controls.state.pos.clone();
  const vel = new THREE.Vector3();

  return {
    controls, camera, scene,
    // 自己的狀態（給同步用）
    me() {
      const s = controls.state;
      return { z: zoneOf(s.pos.x), p: [s.pos.x, s.pos.z], v: [vel.x, vel.z], y: s.yaw };
    },
    // 看著的地面位置（放標記用）
    lookPoint() {
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
      const t = ray.ray.direction.y < -0.05 ? -camera.position.y / ray.ray.direction.y : 4;
      const p = camera.position.clone().addScaledVector(ray.ray.direction, Math.min(t, 8));
      return [+p.x.toFixed(2), +p.z.toFixed(2)];
    },
    syncAvatars(members, myUid) {
      for (const m of members) {
        if (m.uid === myUid || avatars.has(m.uid)) continue;
        const a = makeAvatar(m.name, m.char); a.visible = false; scene.add(a); avatars.set(m.uid, a);
      }
      for (const [uid, a] of avatars) if (!members.some((m) => m.uid === uid)) { scene.remove(a); avatars.delete(uid); }
    },
    addMark(kind, p) {
      const color = MARK_COLOR[kind] ?? '#ffffff';
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, 3, 12, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
      mesh.position.set(p[0], 1.5, p[1]);
      const light = new THREE.PointLight(color, 3, 4); light.position.y = -1.2; mesh.add(light);
      scene.add(mesh); marks.push({ mesh, until: performance.now() + 6000 });
    },
    frame(dt, peers, myZone) {
      controls.update(dt);
      vel.copy(controls.state.pos).sub(lastPos).divideScalar(Math.max(dt, 1e-3)); vel.y = 0; lastPos.copy(controls.state.pos);
      for (const [uid, a] of avatars) {
        const p = peers.get(uid);
        a.visible = !!p && p.z === myZone; // 別的區域的隊友不畫（他們的詳細位置也不會傳過來）
        if (p) { a.position.set(p.shown[0], 0, p.shown[1]); a.rotation.y = p.yShown; }
      }
      const now = performance.now();
      for (let i = marks.length - 1; i >= 0; i--) {
        const m = marks[i]; const left = (m.until - now) / 6000;
        m.mesh.material.opacity = 0.45 * Math.min(1, left * 3); m.mesh.rotation.y += dt;
        if (left <= 0) { scene.remove(m.mesh); marks.splice(i, 1); }
      }
      renderer.render(scene, camera);
    },
  };
}
