// 第一章的 3D 世界：灰盒場景（greybox.mjs）＋第一人稱操作＋隊友、電腦同伴、赫爾嘉夫人、標記、可以調查的東西。
// 隊友和同伴目前是簡單的人形，正式的角色模型由帳號二做好後換上。
import * as THREE from 'three';
import '../art/index.mjs'; // 帳號二的美術掛鉤（守夜人的正式模型），要在蓋場景之前註冊
import { loadCharacter } from '../art/characters.mjs';
import { createControls } from '../../../prototype/src/controls.mjs';
import { buildWorld } from './greybox.mjs';
import { ROOMS, DOORS, THINGS, PATROL } from '../data/world-ch1.mjs';
import { HOUSES, CHARS } from '../logic/chars.mjs';

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const REACH = 2.6; // 調查的距離

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
function makeAvatar(label, charKey, { robe = '#141418', model = charKey } = {}) {
  const house = CHARS[charKey]?.house; const color = HOUSES[house]?.color ?? '#cccccc';
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.3, 12), new THREE.MeshStandardMaterial({ color: robe, roughness: 0.8 }));
  body.position.y = 0.65; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), new THREE.MeshStandardMaterial({ color: '#e5c4aa', roughness: 0.7 }));
  head.position.y = 1.5;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  scarf.position.y = 1.32; scarf.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), head.material); nose.position.set(0, 1.5, -0.16);
  const tag = nameTag(label, color); tag.position.y = 1.95;
  g.add(body, head, scarf, nose, tag);
  // 先用簡單人形，正式模型（帳號二）載好就換掉身體，名牌留著
  if (model) loadCharacter(model).then((c) => { for (const m of [body, head, scarf, nose]) m.visible = false; g.add(c.root); g.userData.char = c; }).catch(() => {});
  return g;
}

const MARK_COLOR = { here: '#9fc4ff', danger: '#ff4a3a', help: '#f2c14e' };

// 赫爾嘉夫人在巡邏路線上的位置（t＝這一段開始後幾秒）
export function patrolAt(t) {
  const P = PATROL.path, n = P.length;
  const lens = P.map((p, i) => Math.hypot(P[(i + 1) % n][0] - p[0], P[(i + 1) % n][1] - p[1]));
  const total = lens.reduce((a, b) => a + b, 0);
  let d = (((t % PATROL.period) + PATROL.period) % PATROL.period) / PATROL.period * total;
  for (let i = 0; i < n; i++) {
    if (d <= lens[i]) {
      const a = P[i], b = P[(i + 1) % n], k = d / lens[i];
      return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, yaw: Math.atan2(-(b[0] - a[0]), -(b[1] - a[1])) };
    }
    d -= lens[i];
  }
  return { x: P[0][0], z: P[0][1], yaw: 0 };
}

export function createWorld(canvas, lang = 'zh') {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
  renderer.shadowMap.enabled = !isTouch;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);
  scene.add(camera);
  const world = buildWorld(scene, { rooms: ROOMS, doors: DOORS, things: THINGS }, { lowQuality: isTouch });
  const controls = createControls(camera, renderer.domElement, { colliders: world.colliders, isTouch, bounds: world.bounds });
  renderer.domElement.addEventListener('click', () => controls.lockPointer());

  // 手上的燈（不然灰盒很暗）
  const lamp = new THREE.PointLight('#ffd9a0', 2.2, 7, 1.8); lamp.position.set(0.3, -0.2, -0.3); camera.add(lamp);

  // 赫爾嘉夫人
  const helga = makeAvatar(lang === 'en' ? 'Madam Helga' : '赫爾嘉夫人', null, { robe: '#3b2a3d', model: 'helga' });
  const cone = new THREE.SpotLight('#ffcf70', 40, PATROL.view, THREE.MathUtils.degToRad(PATROL.fov / 2), 0.4, 1.4);
  cone.position.set(0, 1.3, -0.3); cone.target.position.set(0, 0, -4); helga.add(cone, cone.target);
  helga.visible = false; scene.add(helga);

  const avatars = new Map(); // uid 或 'ai:角色' → Group
  const marks = [];
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();

  let dark = null; // 熄燈前的亮度
  const lastPos = controls.state.pos.clone();
  const vel = new THREE.Vector3();
  const fwd = new THREE.Vector3();

  return {
    controls, camera, scene, world,
    zone() { return world.roomAt(controls.state.pos.x, controls.state.pos.z); },
    me() { const s = controls.state; return { z: this.zone(), p: [s.pos.x, s.pos.z], v: [vel.x, vel.z], y: s.yaw }; },
    teleport({ x, z, yaw = 0 }) { controls.state.pos.set(x, 1.6, z); controls.state.yaw = yaw; controls.state.pitch = 0; lastPos.copy(controls.state.pos); },
    lookPoint() {
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
      const t = ray.ray.direction.y < -0.05 ? -camera.position.y / ray.ray.direction.y : 4;
      const p = camera.position.clone().addScaledVector(ray.ray.direction, Math.min(t, 8));
      return [+p.x.toFixed(2), +p.z.toFixed(2)];
    },
    setDoor: world.setDoor,
    // 熄燈（P10）：房間的燈和手上的燈一起關掉
    setDark(on) { // 調亮度而不是關掉燈，避免畫面重新編譯而卡一下
      if (on && !dark) dark = [world.roomLight.intensity, lamp.intensity];
      if (on) { world.roomLight.intensity = 0; lamp.intensity = 0.05; } else if (dark) { [world.roomLight.intensity, lamp.intensity] = dark; dark = null; }
    },
    // 現在看著、而且夠近的東西（給「調查」用）
    target(filter = () => true) {
      const s = controls.state; fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
      let best = null, bestScore = Infinity;
      for (const t of THINGS) {
        if (t.kind === 'pillar' || !filter(t)) continue;
        // 到這個東西（長方形）最近一點的距離與方向；長桌這種很長的東西也算得準
        const [w, , d] = t.size ?? [0.6, 0.6, 0.6];
        const nx = Math.max(t.x - w / 2, Math.min(s.pos.x, t.x + w / 2)), nz = Math.max(t.z - d / 2, Math.min(s.pos.z, t.z + d / 2));
        const dx = nx - s.pos.x, dz = nz - s.pos.z, dist = Math.hypot(dx, dz);
        if (dist > REACH) continue;
        const ang = dist < 1e-3 ? 0 : Math.acos(Math.max(-1, Math.min(1, (dx * fwd.x + dz * fwd.z) / dist)));
        if (ang > 0.75 && dist > 0.6) continue;
        const score = dist + ang * 2;
        if (score < bestScore) { bestScore = score; best = t; }
      }
      return best;
    },
    hidden() { const s = controls.state.pos; return THINGS.some((t) => t.kind === 'hide' && Math.abs(s.x - t.x) < t.size[0] / 2 + 0.3 && Math.abs(s.z - t.z) < t.size[2] / 2 + 0.3); },
    syncAvatars(people) { // people：[{ key, label, char, zone?, at? }]
      const keys = new Set(people.map((p) => p.key));
      for (const p of people) if (!avatars.has(p.key)) { const a = makeAvatar(p.label, p.char); a.visible = false; scene.add(a); avatars.set(p.key, a); }
      for (const [k, a] of avatars) if (!keys.has(k)) { scene.remove(a); avatars.delete(k); }
    },
    placeAvatar(key, x, z, yaw, visible = true) { const a = avatars.get(key); if (!a) return; a.position.set(x, 0, z); a.rotation.y = yaw; a.visible = visible; },
    addMark(kind, p) {
      const color = MARK_COLOR[kind] ?? '#ffffff';
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, 3, 12, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
      mesh.position.set(p[0], 1.5, p[1]);
      const light = new THREE.PointLight(color, 3, 4); light.position.y = -1.2; mesh.add(light);
      scene.add(mesh); marks.push({ mesh, until: performance.now() + 6000 });
    },
    setHelga(state) { // null＝不出現
      helga.visible = !!state;
      if (state) { helga.position.set(state.x, 0, state.z); helga.rotation.y = state.yaw; }
    },
    tired: false, // 第四幕：跑太久喘不過氣，只能用走的
    frame(dt, peers, myZone) {
      const bx = controls.state.pos.x, bz = controls.state.pos.z;
      controls.update(dt);
      if (this.tired) { // 跑步的速度壓回走路的速度
        const dx = controls.state.pos.x - bx, dz = controls.state.pos.z - bz, d = Math.hypot(dx, dz), max = 2.0 * dt;
        if (d > max) { controls.state.pos.x = bx + (dx / d) * max; controls.state.pos.z = bz + (dz / d) * max; }
      }
      world.lightRoom(myZone);
      vel.copy(controls.state.pos).sub(lastPos).divideScalar(Math.max(dt, 1e-3)); vel.y = 0; lastPos.copy(controls.state.pos);
      for (const [uid, p] of peers) {
        const a = avatars.get(uid); if (!a) continue;
        a.visible = p.z === myZone; // 別的區域的隊友不畫（他們的詳細位置也不會傳過來）
        a.position.set(p.shown[0], 0, p.shown[1]); a.rotation.y = p.yShown;
        a.userData.char?.setMoving(Math.hypot(p.v[0], p.v[1]));
      }
      // 正式模型：眨眼、呼吸、轉頭看玩家（只更新看得到的）
      for (const a of [...avatars.values(), helga]) if (a.visible) a.userData.char?.update(dt, camera.position);
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

// 赫爾嘉夫人有沒有發現玩家（柱子會擋住視線）
export function helgaSees(h, me, { moving, running, holding, hidden }) {
  if (hidden) return false;
  const dx = me.x - h.x, dz = me.z - h.z, dist = Math.hypot(dx, dz);
  // 聽到
  if (!holding && running && dist < PATROL.hearRun) return true;
  if (!holding && moving && dist < PATROL.hearWalk) return true;
  // 看到：在提燈照得到的扇形裡，而且中間沒有柱子
  if (dist > PATROL.view) return false;
  const fx = -Math.sin(h.yaw), fz = -Math.cos(h.yaw);
  const cos = (dx * fx + dz * fz) / (dist || 1);
  if (cos < Math.cos(THREE.MathUtils.degToRad(PATROL.fov / 2))) return false;
  for (const t of THINGS) {
    if (t.kind !== 'pillar') continue;
    const r = t.size[0] / 2 + 0.2;
    const k = Math.max(0, Math.min(1, ((t.x - h.x) * dx + (t.z - h.z) * dz) / (dist * dist)));
    const px = h.x + dx * k - t.x, pz = h.z + dz * k - t.z;
    if (Math.hypot(px, pz) < r) return false;
  }
  return true;
}
