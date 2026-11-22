// 玩家回報（2026-11-18）：「很多門我幾乎可以直接穿過去」
// 1) 解開後真正的門開了（不擋路），但畫在謎題物件上的門（柵門、符文大門、出口門、鐘擺室的門、北翼的門、門上的鎖）還留在門口 → 看起來關著卻走得過去
// 2) 開門時門板轉進房間、停在那裡，卻沒有碰撞 → 走得穿過門板
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./three-loader.mjs', import.meta.url);
globalThis.requestAnimationFrame ??= (cb) => setTimeout(() => cb(performance.now()), 16);

const THREE = await import('three');
const { buildWorld } = await import('../../game/src/world/greybox.mjs');
const { decorators } = await import('../../game/src/world/art-hooks.mjs');
const { ROOMS, DOORS, THINGS } = await import('../../game/src/data/world-ch1.mjs');

// 假的美術：每個東西在場景裡放一塊「美術」（跟帳號二的裝飾函式一樣，加在 group 底下）
const art = new Map();
decorators.thing.push(({ thing, group }) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1)); m.position.set(thing.x, 1, thing.z); group.add(m); art.set(thing.id, m); });
const scene = new THREE.Scene();
const world = buildWorld(scene, { rooms: ROOMS, doors: DOORS, things: THINGS });
const visibleNow = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('解開後開門：門口那扇畫在謎題物件上的門跟著藏起來（看起來開著才走得過去）；別的東西不受影響；門再關上就回來', () => {
  const pairs = [['dark-well', 'exitdoor'], ['ante-dark', 'runedoor'], ['entry-maze', 'gate'], ['star-north', 'north_door'], ['north-corridor', 'nh_lock'], ['eldrin-star', 'lock_eldrin']];
  for (const [door, thing] of pairs) {
    assert.ok(visibleNow(art.get(thing)), `${thing} 關門時看得到`);
    world.setDoor(door, true);
    assert.equal(visibleNow(art.get(thing)), false, `${door} 開了，${thing} 還在門口`);
  }
  assert.ok(visibleNow(art.get('scale')), '門邊的大秤不是門，不能藏');
  world.setDoor('dark-well', false);
  assert.ok(visibleNow(art.get('exitdoor')), '門關上，出口門回來');
});

test('卡住的鐵門（P26）由機關自己往上升，不藏', () => {
  // ironDoor 在第四幕的資料裡；這裡確定一般的門不會去藏別扇門的東西
  world.setDoor('pass-gears', true);
  assert.ok(!art.has('ironDoor') || visibleNow(art.get('ironDoor')));
});

test('開門時門板轉到貼著牆（不會停在房間中間變成走得穿過去的門板）', async () => {
  world.setDoor('belmont-star', true); world.setDoor('maze-reading', true);
  await wait(1300);
  for (const id of ['belmont-star', 'maze-reading', 'north-corridor']) {
    const st = world.doorState.get(id), d = st.door;
    scene.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(st.mesh);
    const off = d.axis === 'x' ? Math.max(Math.abs(box.min.z - d.z), Math.abs(box.max.z - d.z)) : Math.max(Math.abs(box.min.x - d.x), Math.abs(box.max.x - d.x));
    assert.ok(off < 0.45, `${id} 門板離牆 ${off.toFixed(2)} 公尺（要貼著牆）`);
    assert.ok(!world.colliders.includes(st.collider), `${id} 開著不擋路`);
  }
});

// 玩家回報 #412（2026-11-22）：「第一章進入各自房間後，出去的門不用解謎可以直接穿門出去」
// 門一開始的狀態寫成「關著」，setDoor(關) 以為沒變就直接跳過，鎖著的門從來沒有加上擋路的牆（開過再關上才會擋）
test('鎖著的門一開始就擋路（各宿舍的門、要解謎才開的門）；沒有鎖的門不擋', () => {
  const w2 = buildWorld(new THREE.Scene(), { rooms: ROOMS, doors: DOORS, things: THINGS });
  for (const d of DOORS) {
    const st = w2.doorState.get(d.id);
    if (d.lock) assert.ok(w2.colliders.includes(st.collider), `${d.id}（${d.lock.puzzle || d.lock.segment}）鎖著卻沒有擋路`);
    else assert.ok(!w2.colliders.includes(st.collider), `${d.id} 沒有鎖卻擋路`);
  }
});
