// 一次性的驚嚇演出（帳號二，2026-10-28）：在恐怖感比較少的地方，安排「一閃而過的人影」。每個人自己看到，不影響遊戲進行。
//   序幕・碼頭：渡船靠岸時，碼頭盡頭站著一個長髮的女人，走近或盯著她看一會兒，她就不見了（只有耳語）。
//   序幕・典禮廳：最角落的陰影裡站著一個人。
//   第三幕・井室：轉身時，井的後面探出一個女人的上半身。
//   第一幕・星盤廳：柱子後面站著一個沒有臉的男人，被看到半秒就消失。
//   第二幕・創辦人的房間：熄滅燭火的那 9 秒，戴兜帽的女人站在你背後的門口。燈亮回來時她已經不在了。
//   北翼樓梯、封印室前廳的蜘蛛娃娃：你沒看著的時候會轉頭面向你。
//   北翼樓梯角落的搖椅：沒有人坐，自己慢慢搖，嘎吱作響。
// 每個演出一次（重新整理頁面才會再有）。
import * as THREE from 'three';
import { ghostWoman } from '../art/haunt.mjs';
import { placeProp } from '../art/models.mjs';
import { sfx, sfxPan } from '../art/sfx.mjs';

const SHOWS = [
  { id: 'dock', seg: 'prologue', zone: 'dock', fig: 'ghost_woman', at: [1.4, 142.4], near: 13, stare: 3.5, delay: 0 },
  { id: 'banquet', seg: 'prologue', zone: 'banquet', fig: 'horror_woman', at: [-33, 147.2], near: 7, stare: 1.2, delay: 6, unseen: true },
  { id: 'well', seg: 'act3c', zone: 'lib_well', fig: 'ghost_woman', at: [135, -65.3], y: -0.3, near: 2, stare: 0.6, delay: 3, unseen: true },
  { id: 'starhall', seg: 'act1', zone: 'starhall', fig: 'faceless', at: [-6.4, -6.6], near: 5, stare: 0.5, delay: 4, unseen: true },
  { id: 'founder', seg: 'act2', zone: 'founder', fig: 'horror_woman', at: [-1.2, -65.2], near: 2.5, stare: 0.8, delay: 0, dark: true, unseen: true },
];

export function createScares(scene) {
  const figs = {}; // 每種人影一個（先放在地底下）
  const fig = (name) => {
    if (!figs[name]) { const g = new THREE.Group(); g.name = 'scare-' + name; if (!ghostWoman(g, name)) ghostWoman(g); g.position.set(0, -100, 0); scene.add(g); figs[name] = g; }
    return figs[name];
  };
  // 北翼樓梯角落的空搖椅（製作人給的模型）
  const chair = new THREE.Group(); scene.add(chair); const rocker = placeProp(chair, 'rocker2', 0, 0, 0, 0, [0.75, 1.1, 0.95]);
  chair.position.set(1.3, 0, -86.6); chair.rotation.y = -2.2;
  let rockT = 0, creakSide = 1;
  const done = new Set(); let cur = null, last = null, dolls = null; const fwd = new THREE.Vector3();
  return {
    state: () => ({ cur: cur?.s.id ?? null, done: [...done], last }), // 開發測試用
    /** 每一格。ctx：{ segment, zone, cam, dark（燈有沒有熄）, busy（對話、視窗） } */
    update(dt, { segment, zone, cam, dark, busy }) {
      last = [segment, zone, dark];
      if (rocker && zone === 'north_stairs') { // 搖椅自己搖：每擺到一邊就嘎吱一聲（從椅子的方向傳來）
        rockT += dt; const a = Math.sin(rockT * 1.7); rocker.obj.rotation.x = a * 0.13;
        if (Math.sign(a) !== creakSide) { creakSide = Math.sign(a); cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); const dx = chair.position.x - cam.position.x, dz = chair.position.z - cam.position.z, d = Math.hypot(dx, dz) || 1; if (d < 14) sfxPan('wood', (dx * -fwd.z + dz * fwd.x) / d, { vol: 0.5 / (1 + d * 0.2) }); }
      }
      // 北翼樓梯、封印室前廳的蜘蛛娃娃：你沒看著的時候，它把頭轉過來面向你
      if (zone === 'north_stairs' || zone === 'lib_ante') {
        if (!dolls) { dolls = []; scene.traverse((o) => { if (o.userData.prop === 'spider_doll' && o.parent?.name !== 'weeping-dolls') dolls.push(o); }); }
        cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
        for (const o of dolls) { const dx = o.position.x - cam.position.x, dz = o.position.z - cam.position.z, d = Math.hypot(dx, dz) || 1; if (d < 12 && (dx * fwd.x + dz * fwd.z) / d < 0.3) o.rotation.y = Math.atan2(-dx, -dz); }
      }
      if (cur) {
        const { s, g } = cur; cur.t += dt;
        g.lookAt(cam.position.x, g.position.y, cam.position.z);
        const dx = g.position.x - cam.position.x, dz = g.position.z - cam.position.z, d = Math.hypot(dx, dz) || 1;
        cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
        const look = (dx * fwd.x + dz * fwd.z) / d > 0.8;
        if (look && !busy) cur.seen += dt; // 對話框開著的時候不算（玩家還沒在看）
        const gone = zone !== s.zone || d < s.near || cur.seen > s.stare || (s.dark && !dark) || cur.t > 60;
        if (gone) { g.position.y = -100; if (cur.seen > 0 || d < s.near) { const pan = (dx * -fwd.z + dz * fwd.x) / d; sfxPan('whisper', pan, { vol: 0.8 }); } cur = null; }
        return;
      }
      for (const s of SHOWS) {
        if (done.has(s.id) || segment !== s.seg || zone !== s.zone || (s.dark && !dark)) continue;
        s.wait = (s.wait ?? 0) + dt; if (s.wait < s.delay) continue;
        // 只在玩家沒看著那個位置時出現（轉頭才看得到）
        const dx = s.at[0] - cam.position.x, dz = s.at[1] - cam.position.z, d = Math.hypot(dx, dz) || 1;
        cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
        if (s.unseen && (dx * fwd.x + dz * fwd.z) / d > 0.5) continue;
        done.add(s.id);
        const g = fig(s.fig); g.position.set(s.at[0], s.y ?? 0, s.at[1]); g.lookAt(cam.position.x, g.position.y, cam.position.z); // y＜0：從井後面探出上半身
        cur = { s, g, t: 0, seen: 0 };
        if (s.dark) sfx('steps'); // 黑暗裡：背後有腳步聲
        break;
      }
    },
  };
}
