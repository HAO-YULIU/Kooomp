// 灰盒場景：照 game/src/data/world-ch1.mjs 的配置，用簡單的方塊蓋出房間、牆、門、可以調查的東西。
// 帳號二的美術可以用 art-hooks.mjs 註冊「裝飾函式」，在同一個位置換上正式的模型與材質（格式見 docs/08-world-format.md）。
import * as THREE from 'three';
import { decorators } from './art-hooks.mjs';

const WALL_T = 0.3; // 牆的厚度
const FLOOR = {
  stone: new THREE.MeshStandardMaterial({ color: '#4a4744', roughness: 0.95 }),
  wood: new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.8 }),
};
const WALL = new THREE.MeshStandardMaterial({ color: '#57524c', roughness: 0.95 });
const CEIL = new THREE.MeshStandardMaterial({ color: '#211c18', roughness: 1 });
const DOOR = new THREE.MeshStandardMaterial({ color: '#2e1d12', roughness: 0.6, metalness: 0.1 });
const KIND_COLOR = { prop: '#6b5a48', rumor: '#5a3a28', puzzle: '#8a6a34', hide: '#4a1418', pillar: '#5d5853' };

const box = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = m.receiveShadow = true; return m; };

// 一面牆（從 a 到 b，沿 x 或 z），扣掉牆上的門洞
function buildWall(group, colliders, { axis, at, from, to, h }, gaps) {
  const cuts = gaps.map((g) => [g.c - g.w / 2, g.c + g.w / 2]).sort((p, q) => p[0] - q[0]);
  let cur = from; const parts = [];
  for (const [g0, g1] of cuts) { if (g0 > cur) parts.push([cur, g0]); cur = Math.max(cur, g1); }
  if (cur < to) parts.push([cur, to]);
  for (const [p0, p1] of parts) {
    const len = p1 - p0, mid = (p0 + p1) / 2;
    const m = axis === 'x' ? box(len, h, WALL_T, WALL) : box(WALL_T, h, len, WALL);
    if (axis === 'x') m.position.set(mid, h / 2, at); else m.position.set(at, h / 2, mid);
    group.add(m);
    colliders.push(axis === 'x'
      ? { minX: p0, maxX: p1, minZ: at - WALL_T / 2, maxZ: at + WALL_T / 2 }
      : { minX: at - WALL_T / 2, maxX: at + WALL_T / 2, minZ: p0, maxZ: p1 });
  }
}

export function buildWorld(scene, { rooms, doors, things }, { lowQuality = false } = {}) {
  const group = new THREE.Group(); group.userData.static = true; scene.add(group);
  const colliders = [];
  const doorState = new Map(); // id → { mesh, collider, open }
  const thingMeshes = new Map(); // id → mesh

  // 燈只有一盞，跟著玩家換房間（每個房間一盞燈的話，手機會很吃力）；別的房間保持黑暗
  const roomLight = new THREE.PointLight('#ffcf8a', lowQuality ? 30 : 40, 30, 1.6); group.add(roomLight);
  let litRoom = null;
  function lightRoom(id) {
    if (id === litRoom) return; litRoom = id;
    const r = rooms.find((x) => x.id === id); if (!r) return;
    const w = r.x[1] - r.x[0], d = r.z[1] - r.z[0];
    roomLight.color.set(r.light ?? '#ffcf8a'); roomLight.distance = Math.max(w, d) * 1.1;
    roomLight.position.set((r.x[0] + r.x[1]) / 2, Math.min(r.h - 0.5, 4.5), (r.z[0] + r.z[1]) / 2);
  }

  scene.background = new THREE.Color('#05060a');
  scene.fog = new THREE.FogExp2('#07080d', 0.035);
  scene.add(new THREE.HemisphereLight('#334', '#110d0a', 0.35));

  // ---- 房間：地板、天花板、燈 ----
  for (const r of rooms) {
    const w = r.x[1] - r.x[0], d = r.z[1] - r.z[0], cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), FLOOR[r.floor] ?? FLOOR.stone);
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); floor.receiveShadow = true; group.add(floor);
    if (!r.sky) {
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), CEIL);
      ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, r.h, cz); group.add(ceil);
    }
    for (const f of decorators.room) f({ room: r, group, THREE });
  }

  // ---- 牆：每個房間四面，門洞從 DOORS 來；兩個房間共用的牆只蓋一次 ----
  const built = new Set();
  for (const r of rooms) {
    const sides = [
      { axis: 'x', at: r.z[0], from: r.x[0], to: r.x[1] }, { axis: 'x', at: r.z[1], from: r.x[0], to: r.x[1] },
      { axis: 'z', at: r.x[0], from: r.z[0], to: r.z[1] }, { axis: 'z', at: r.x[1], from: r.z[0], to: r.z[1] },
    ];
    for (const s of sides) {
      const key = `${s.axis}:${s.at}:${s.from}:${s.to}`; if (built.has(key)) continue; built.add(key);
      const gaps = doors.filter((d) => d.axis === s.axis && Math.abs((s.axis === 'x' ? d.z : d.x) - s.at) < 0.01)
        .map((d) => ({ c: s.axis === 'x' ? d.x : d.z, w: d.w }));
      buildWall(group, colliders, { ...s, h: r.h }, gaps);
    }
  }

  // ---- 門：門洞裡放一片門板；鎖著時擋路 ----
  for (const d of doors) {
    const h = 2.6;
    const mesh = d.axis === 'x' ? box(d.w, h, 0.12, DOOR) : box(0.12, h, d.w, DOOR);
    mesh.position.set(d.x, h / 2, d.z); group.add(mesh);
    const collider = d.axis === 'x'
      ? { minX: d.x - d.w / 2, maxX: d.x + d.w / 2, minZ: d.z - 0.1, maxZ: d.z + 0.1 }
      : { minX: d.x - 0.1, maxX: d.x + 0.1, minZ: d.z - d.w / 2, maxZ: d.z + d.w / 2 };
    const st = { mesh, collider, open: false, door: d };
    doorState.set(d.id, st);
    setDoor(d.id, !d.lock);
    for (const f of decorators.door) f({ door: d, mesh, group, THREE });
  }
  function setDoor(id, open) {
    const st = doorState.get(id); if (!st || st.open === open) return;
    st.open = open;
    st.mesh.visible = !open;
    const i = colliders.indexOf(st.collider);
    if (open && i >= 0) colliders.splice(i, 1);
    if (!open && i < 0) colliders.push(st.collider);
  }

  // ---- 可以調查的東西 ----
  for (const t of things) {
    const [w, h, d] = t.size ?? [0.6, 0.6, 0.6];
    const mat = new THREE.MeshStandardMaterial({ color: KIND_COLOR[t.kind] ?? '#666', roughness: 0.7, transparent: t.kind === 'hide', opacity: t.kind === 'hide' ? 0.85 : 1 });
    const mesh = box(w, h, d, mat);
    mesh.position.set(t.x, (t.y ?? 0) + h / 2, t.z);
    mesh.userData.thing = t;
    mesh.visible = !t.hidden; // hidden：外觀由別的程式畫（例如長廊、創辦人的房間），這裡只留調查範圍
    group.add(mesh); thingMeshes.set(t.id, mesh);
    if (t.solid) colliders.push({ minX: t.x - w / 2, maxX: t.x + w / 2, minZ: t.z - d / 2, maxZ: t.z + d / 2 });
    for (const f of decorators.thing) f({ thing: t, mesh, group, THREE });
  }

  const roomAt = (x, z) => rooms.find((r) => x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1])?.id ?? null;
  const bounds = {
    minX: Math.min(...rooms.map((r) => r.x[0])), maxX: Math.max(...rooms.map((r) => r.x[1])),
    minZ: Math.min(...rooms.map((r) => r.z[0])), maxZ: Math.max(...rooms.map((r) => r.z[1])),
  };
  return { group, colliders, bounds, roomAt, setDoor, doorState, thingMeshes, lightRoom, roomLight };
}
