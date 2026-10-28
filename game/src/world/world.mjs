// 第一章的 3D 世界：灰盒場景（greybox.mjs）＋第一人稱操作＋隊友、電腦同伴、赫爾嘉夫人、標記、可以調查的東西。
// 隊友和同伴目前是簡單的人形，正式的角色模型由帳號二做好後換上。
import * as THREE from 'three';
import { reactThing, syncSolved, tickRigs, sfx, sfxPan, step, setAmbience, tickHaunt, hauntNow } from '../art/index.mjs'; // 帳號二的美術掛鉤（守夜人的正式模型、謎題的場景反應），要在蓋場景之前註冊
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

// 只畫玩家附近的房間（順暢度）：不會移動的場景（userData.static 的群組）裡每個東西，算一次它在哪幾個房間；
// 玩家換房間時，不在「這個房間＋門連過去的房間」的東西換到看不到的圖層（不動 visible，玩法自己的顯示／隱藏不受影響）。
// 燈不換圖層（燈的數量一變，畫面要重新編譯，會卡一下）。不在任何房間裡的東西（湖、遠方的城堡）一直畫。
const HIDDEN_LAYER = 3;
// 每個區域的環境音（art/sfx.mjs 的 setAmbience）
const AMBIENCE = (id) => !id ? null : id === 'dock' ? 'lake' : /^(hall|banquet)$/.test(id) ? 'fire' : /^dorm_/.test(id) ? 'hearth' : id === 'starhall' ? 'clock'
  : /^lib_(dark|well)$/.test(id) ? 'drip' : /^lib_/.test(id) ? 'library' : id === 'a4_roof' ? 'roof' : /^a4_/.test(id) ? 'tower' : 'hush';
function makeRoomCuller(scene) {
  const near = new Map(); for (const r of ROOMS) near.set(r.id, new Set([r.id]));
  for (const d of DOORS) { near.get(d.a)?.add(d.b); near.get(d.b)?.add(d.a); }
  const where = new WeakMap(), box = new THREE.Box3();
  const roomsOf = (o) => {
    if (where.has(o)) return where.get(o);
    box.setFromObject(o); const list = [];
    if (!box.isEmpty()) for (const r of ROOMS) if (box.max.x > r.x[0] - 0.5 && box.min.x < r.x[1] + 0.5 && box.max.z > r.z[0] - 0.5 && box.min.z < r.z[1] + 0.5) list.push(r.id);
    where.set(o, list); return list;
  };
  let cur = null;
  const cull = (zone) => {
    if (!zone || zone === cur) return; cur = zone;
    const show = near.get(zone) ?? new Set([zone]);
    scene.updateMatrixWorld(true);
    for (const root of scene.children) {
      if (!root.userData.static) continue;
      root.traverse((o) => {
        if (!o.isMesh || o.isSkinnedMesh) return;
        const list = roomsOf(o), on = !list.length || list.some((id) => show.has(id));
        if (on) o.layers.enable(0); else { o.layers.disable(0); o.layers.enable(HIDDEN_LAYER); }
      });
    }
  };
  cull.near = (x, z) => { if (!cur) return true; const r = ROOMS.find((q) => x >= q.x[0] && x <= q.x[1] && z >= q.z[0] && z <= q.z[1]); return !r || (near.get(cur)?.has(r.id) ?? true); };
  return cull;
}

export function createWorld(canvas, lang = 'zh') {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
  // 解析度會依速度自動調（手機卡的時候先降解析度，順了再慢慢調回來）
  const maxRatio = Math.min(devicePixelRatio, isTouch ? 1.5 : 2), minRatio = isTouch ? 0.6 : 0.85;
  let ratio = maxRatio, slowT = 0, fastT = 0;
  renderer.setPixelRatio(ratio);
  renderer.shadowMap.enabled = !isTouch;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // 不要每個材質都同步檢查有沒有編譯錯誤（會逼瀏覽器等編譯完，Windows 電腦上會卡好幾秒）；本機測試（?dev）才檢查
  renderer.debug.checkShaderErrors = new URLSearchParams(location.search).has('dev');
  const EXPOSURE = 1.4; // 2026-10-22 製作人：還是有點暗（原本 1.2）；玩家可以在設定裡再調（setBrightness）
  const savedBright = (() => { try { return +localStorage.getItem('ml_bright') || 1; } catch { return 1; } })();
  renderer.toneMappingExposure = EXPOSURE * savedBright;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);
  scene.add(camera);
  const world = buildWorld(scene, { rooms: ROOMS, doors: DOORS, things: THINGS }, { lowQuality: isTouch });
  // 腳步聲：照腳下房間的地板（石頭／木頭）
  const floorAt = (x, z) => ROOMS.find((r) => x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1])?.floor ?? 'stone';
  const controls = createControls(camera, renderer.domElement, { colliders: world.colliders, isTouch, bounds: world.bounds,
    onStep: (run) => step(floorAt(controls.state.pos.x, controls.state.pos.z), run) });
  renderer.domElement.addEventListener('click', () => controls.lockPointer());

  // 手上的燈（不然灰盒很暗）
  const lamp = new THREE.PointLight('#ffd9a0', 2.2, 7, 1.8); lamp.position.set(0.3, -0.2, -0.3); camera.add(lamp);

  // 赫爾嘉夫人
  const helga = makeAvatar(lang === 'en' ? 'Madam Helga' : '赫爾嘉夫人', null, { robe: '#3b2a3d', model: 'helga' });
  const cone = new THREE.SpotLight('#ffcf70', 40, PATROL.view, THREE.MathUtils.degToRad(PATROL.fov / 2), 0.4, 1.4);
  cone.position.set(0, 1.3, -0.3); cone.target.position.set(0, 0, -4); helga.add(cone, cone.target);
  helga.visible = false; scene.add(helga);

  if (new URLSearchParams(location.search).has('dev')) window.__world = { renderer, scene, camera }; // 本機測試：量效能用
  const cullRooms = makeRoomCuller(scene); let compiledRoots = -1, compiling = null;

  // ---- 調查時鏡頭靠近（2026-10-22 製作人：謎題要連進場景）----
  // focus(東西)：鏡頭滑到那個東西前面看著它；謎題視窗靠右，東西在畫面左邊。unfocus() 滑回玩家的眼睛。
  const F = { on: false, t: 0, from: { p: new THREE.Vector3(), q: new THREE.Quaternion() }, to: { p: new THREE.Vector3(), q: new THREE.Quaternion() }, back: false, center: new THREE.Vector3() };
  const ease = (x) => x * x * (3 - 2 * x);
  function focusPose(th) {
    const [w, h, d] = th.size ?? [0.6, 0.6, 0.6];
    const C = new THREE.Vector3(th.x, (th.y ?? 0) + h / 2, th.z);
    const flat = h < Math.max(w, d) * 0.4; // 桌面、星盤這種平放的東西：從斜上方往下看
    const D = THREE.MathUtils.clamp(Math.max(w, flat ? d : h, d * 0.5) * 0.85 + 0.75, 1.0, 4.6);
    const s = controls.state, dir = new THREE.Vector3(s.pos.x - C.x, 0, s.pos.z - C.z);
    if (dir.lengthSq() < 1e-4) dir.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
    dir.normalize();
    const P = C.clone().addScaledVector(dir, D); P.y = flat ? C.y + D * 0.75 : THREE.MathUtils.clamp(C.y + 0.15, 0.9, 2.2);
    // 不要穿過牆：限制在玩家現在的房間裡
    const r = ROOMS.find((q) => s.pos.x >= q.x[0] && s.pos.x <= q.x[1] && s.pos.z >= q.z[0] && s.pos.z <= q.z[1]);
    if (r) { P.x = THREE.MathUtils.clamp(P.x, r.x[0] + 0.3, r.x[1] - 0.3); P.z = THREE.MathUtils.clamp(P.z, r.z[0] + 0.3, r.z[1] - 0.3); P.y = Math.min(P.y, r.h - 0.3); }
    const m = new THREE.Matrix4().lookAt(P, C, new THREE.Vector3(0, 1, 0));
    return { p: P, q: new THREE.Quaternion().setFromRotationMatrix(m), c: C };
  }
  // 視窗靠右時，把畫面的中心往左移（東西出現在左邊三成的地方）
  const setShift = (on) => {
    const w = innerWidth, h = innerHeight, docked = on && w > h;
    if (docked) { camera.aspect = (w * 1.4) / h; camera.setViewOffset(w * 1.4, h, w * 0.4, 0, w, h); }
    else { camera.clearViewOffset(); camera.aspect = w / h; }
    camera.updateProjectionMatrix();
  };
  // ---- 謎題的特效：在東西的位置放光圈、光點，房間裡一盞一直存在的燈（平常亮度 0，不會重新編譯）----
  const fxLight = new THREE.PointLight('#ffd27a', 0, 5, 1.6); scene.add(fxLight);
  const fxRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  fxRing.renderOrder = 6; scene.add(fxRing);
  const sparkGeo = new THREE.BufferGeometry(), SN = 80, sparkPos = new Float32Array(SN * 3), sparkVel = new Float32Array(SN * 3);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: '#ffd27a', size: 0.05, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; scene.add(sparks);
  const FX = { t: 9, dur: 1, kind: null, color: new THREE.Color(), power: 0 };
  const FX_KIND = { input: ['#9fc4ff', 0.45, 0.6, 8], wrong: ['#ff4a3a', 0.8, 1.6, 0], solved: ['#ffd27a', 2.2, 6, 80], open: ['#c9a86a', 0.7, 1.2, 20] }; // 顏色、秒數、燈的亮度、光點數
  const avatars = new Map(); // uid 或 'ai:角色' → Group
  const marks = [];
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); if (camera.view?.enabled) setShift?.(true); };
  addEventListener('resize', resize); resize();

  let dark = null; // 熄燈前的亮度
  const bornAt = performance.now();
  const lastPos = controls.state.pos.clone();
  const vel = new THREE.Vector3();
  const fwd = new THREE.Vector3();

  return {
    controls, camera, scene, world,
    zone() { return world.roomAt(controls.state.pos.x, controls.state.pos.z); },
    roomOf: (x, z) => ROOMS.find((r) => x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1]) ?? null,
    me() { const s = controls.state; return { z: this.zone(), p: [s.pos.x, s.pos.z], v: [vel.x, vel.z], y: s.yaw }; },
    teleport({ x, z, yaw = 0 }) { controls.state.pos.set(x, 1.6, z); controls.state.yaw = yaw; controls.state.pitch = 0; lastPos.copy(controls.state.pos); },
    lookPoint() {
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
      const t = ray.ray.direction.y < -0.05 ? -camera.position.y / ray.ray.direction.y : 4;
      const p = camera.position.clone().addScaledVector(ray.ray.direction, Math.min(t, 8));
      return [+p.x.toFixed(2), +p.z.toFixed(2)];
    },
    // 門打開時：有門的聲音（太遠聽不到；剛進遊戲、讀檔時一次打開好幾扇門不出聲）
    setDoor(id, open) {
      const st = world.doorState.get(id), was = st?.open;
      world.setDoor(id, open);
      if (!st || !open || was || performance.now() - bornAt < 4000) return;
      const p = controls.state.pos, dx = st.door.x - p.x, dz = st.door.z - p.z, d = Math.hypot(dx, dz);
      if (d > 25) return;
      const right = Math.cos(controls.state.yaw) * dx - Math.sin(controls.state.yaw) * dz; // 門在右邊＋、左邊－
      const kind = /well|pass|gears|nest/.test(id) ? 'door_iron' : /founder/.test(id) ? 'door_stone' : 'door_wood'; // 圖書館深處和鐘塔是鐵門、創辦人廳是石門
      const pan = (right / Math.max(d, 1)) * 0.8, vol = Math.max(0.15, 1 - d / 25);
      if (st.door.lock?.puzzle) { sfxPan('unlock', pan, { vol }); setTimeout(() => sfxPan(kind, pan, { vol }), 700); } // 解謎打開的門：先「喀」一聲解鎖
      else sfxPan(kind, pan, { vol });
    },
    // 熄燈（P10）：房間的燈和手上的燈一起關掉
    isDark: () => !!dark,
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
      // 不加燈：每多一盞燈畫面就要重新編譯，放標記時會卡一下
      scene.add(mesh); marks.push({ mesh, until: performance.now() + 6000 });
    },
    setHelga(state) { // null＝不出現
      helga.visible = !!state;
      if (state) { helga.position.set(state.x, 0, state.z); helga.rotation.y = state.yaw; }
    },
    ready: () => compiling ?? Promise.resolve(), // 材質都編譯好了（載入畫面等它）
    brightness: savedBright,
    setBrightness(v) { this.brightness = v; renderer.toneMappingExposure = EXPOSURE * v; try { localStorage.setItem('ml_bright', String(v)); } catch { /* 無痕模式 */ } },
    focus(th) {
      if (!th) return;
      const pose = focusPose(th); F.center.copy(pose.c); F.thing = th;
      F.from.p.copy(camera.position); F.from.q.copy(camera.quaternion); F.to.p.copy(pose.p); F.to.q.copy(pose.q);
      F.on = true; F.back = false; F.t = 0; setShift(true); this.fx(null, 'open');
    },
    unfocus() {
      if (!F.on || F.back) return;
      F.back = true; F.t = 0; F.from.p.copy(camera.position); F.from.q.copy(camera.quaternion); setShift(false);
    },
    // 特效：kind＝'input'（每次操作：小藍光）｜'wrong'（答錯：紅光）｜'solved'（解開：金光、光點往上飄）｜'open'（打開時）
    fx(th, kind) {
      const k = FX_KIND[kind]; if (!k) return;
      if (kind !== 'input') reactThing(th ?? F.thing, kind); // 機關：打開、答錯、解開
      if (kind === 'solved') sfx('solved'); else if (kind === 'wrong') sfx('wrong');
      const C = th ? new THREE.Vector3(th.x, (th.y ?? 0) + (th.size?.[1] ?? 0.6) / 2, th.z) : F.center;
      FX.t = 0; FX.kind = kind; FX.color.set(k[0]); FX.dur = k[1]; FX.power = k[2];
      fxLight.color.copy(FX.color); fxLight.position.copy(C).add(new THREE.Vector3(0, 0.3, 0));
      fxRing.position.copy(C); fxRing.lookAt(camera.position); fxRing.material.color.copy(FX.color); fxRing.scale.setScalar(0.4);
      sparks.material.color.copy(FX.color);
      for (let i = 0; i < SN; i++) {
        const on = i < k[3], a = Math.random() * Math.PI * 2, r = Math.random() * 0.4;
        sparkPos.set(on ? [C.x + Math.cos(a) * r, C.y - 0.2 + Math.random() * 0.4, C.z + Math.sin(a) * r] : [0, -999, 0], i * 3);
        sparkVel.set([Math.cos(a) * 0.15, 0.4 + Math.random() * 0.7, Math.sin(a) * 0.15], i * 3);
      }
      sparkGeo.attributes.position.needsUpdate = true;
    },
    react: (th, name, data) => reactThing(th, name, data), // 謎題視窗裡的操作 → 場景裡的機關
    syncSolved, // 已經解開的題目：機關擺成解開的樣子
    haunting: false, busy: false, hauntNow, // 鬧鬼的小事件：play.mjs 依段落開關（第四幕、尾聲不鬧）；busy＝對話、謎題視窗開著
    tired: false, // 第四幕：跑太久喘不過氣，只能用走的
    frame(dt, peers, myZone) {
      const bx = controls.state.pos.x, bz = controls.state.pos.z;
      controls.update(dt);
      if (this.tired) { // 跑步的速度壓回走路的速度
        const dx = controls.state.pos.x - bx, dz = controls.state.pos.z - bz, d = Math.hypot(dx, dz), max = 2.0 * dt;
        if (d > max) { controls.state.pos.x = bx + (dx / d) * max; controls.state.pos.z = bz + (dz / d) * max; }
      }
      // 場景多了新東西（例如新的一幕蓋好）就先把材質編譯好，走進去時才不會卡一下（先編譯，再藏起遠的房間）
      // 只在場景的大區塊（userData.static）變多時做一次，而且用非同步的版本：
      // 同步編譯在 Windows 電腦上會讓網頁停住好幾秒（瀏覽器會說「網頁沒有回應」）；放標記、加角色不重新編譯
      const roots = scene.children.filter((o) => o.userData.static).length;
      if (roots !== compiledRoots && !compiling) {
        compiledRoots = roots;
        compiling = (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve()).catch(() => {}).finally(() => { compiling = null; });
      }
      world.lightRoom(myZone); cullRooms(myZone); if (myZone) setAmbience(AMBIENCE(myZone));
      // 鏡頭靠近／滑回來
      if (F.on) {
        F.t = Math.min(1, F.t + dt / (F.back ? 0.45 : 0.6)); const k = ease(F.t);
        if (F.back) { const p = camera.position.clone(), q = camera.quaternion.clone(); camera.position.lerpVectors(F.from.p, p, k); camera.quaternion.slerpQuaternions(F.from.q, q, k); if (F.t >= 1) F.on = false; }
        else { camera.position.lerpVectors(F.from.p, F.to.p, k); camera.quaternion.slerpQuaternions(F.from.q, F.to.q, k); }
      }
      tickRigs(dt);
      tickHaunt(dt, { room: this.roomOf(controls.state.pos.x, controls.state.pos.z), camera, scene, roomLight: world.roomLight, busy: F.on || this.busy, on: this.haunting });
      // 特效
      if (FX.t < FX.dur) {
        FX.t += dt; const u = Math.min(1, FX.t / FX.dur), fade = 1 - u;
        fxLight.intensity = FX.power * Math.sin(Math.PI * Math.min(1, u * 1.6)) * (FX.kind === 'wrong' ? (0.6 + 0.4 * Math.sin(FX.t * 40)) : 1);
        fxRing.material.opacity = 0.8 * fade; fxRing.scale.setScalar(0.4 + u * (FX.kind === 'solved' ? 3 : 1.2));
        sparks.material.opacity = fade;
        for (let i = 0; i < SN; i++) { sparkPos[i * 3] += sparkVel[i * 3] * dt; sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt; sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt; }
        sparkGeo.attributes.position.needsUpdate = true;
        if (FX.t >= FX.dur) { fxLight.intensity = 0; fxRing.material.opacity = 0; sparks.material.opacity = 0; }
      }
      vel.copy(controls.state.pos).sub(lastPos).divideScalar(Math.max(dt, 1e-3)); vel.y = 0; lastPos.copy(controls.state.pos);
      for (const [uid, p] of peers) {
        const a = avatars.get(uid); if (!a) continue;
        a.visible = p.z === myZone; // 別的區域的隊友不畫（他們的詳細位置也不會傳過來）
        a.position.set(p.shown[0], 0, p.shown[1]); a.rotation.y = p.yShown;
        a.userData.char?.setMoving(Math.hypot(p.v[0], p.v[1]));
      }
      // 電腦同伴、赫爾嘉夫人在遠的房間就不畫
      for (const a of [...avatars.values(), helga]) if (a.visible && !cullRooms.near(a.position.x, a.position.z)) a.visible = false;
      // 正式模型：眨眼、呼吸、轉頭看玩家（只更新看得到的）
      for (const a of [...avatars.values(), helga]) if (a.visible) a.userData.char?.update(dt, camera.position);
      const now = performance.now();
      for (let i = marks.length - 1; i >= 0; i--) {
        const m = marks[i]; const left = (m.until - now) / 6000;
        m.mesh.material.opacity = 0.45 * Math.min(1, left * 3); m.mesh.rotation.y += dt;
        if (left <= 0) { scene.remove(m.mesh); marks.splice(i, 1); }
      }
      renderer.render(scene, camera);
      // 自動解析度：連續 1.5 秒每格超過 1/40 秒就降一級；連續 6 秒都在 1/55 秒內就升一級
      if (dt > 1 / 40) { slowT += dt; fastT = 0; } else if (dt < 1 / 55) { fastT += dt; slowT = 0; } else { slowT = Math.max(0, slowT - dt); fastT = 0; }
      if (slowT > 1.5 && ratio > minRatio) { ratio = Math.max(minRatio, ratio - 0.15); renderer.setPixelRatio(ratio); resize(); slowT = 0; }
      else if (fastT > 6 && ratio < maxRatio) { ratio = Math.min(maxRatio, ratio + 0.1); renderer.setPixelRatio(ratio); resize(); fastT = 0; }
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
