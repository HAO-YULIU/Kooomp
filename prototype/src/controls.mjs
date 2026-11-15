// 第一人稱操作。電腦：WASD／方向鍵走、Shift 跑、滑鼠轉視角（點畫面鎖定滑鼠）。
// 手機橫向：左半邊虛擬搖桿走路，右半邊滑動轉視角。
import * as THREE from 'three';

export function createControls(camera, dom, { colliders, bounds, isTouch, onStep }) {
  const s = { yaw: Math.PI, pitch: 0, pos: new THREE.Vector3(0, 1.6, 7), enabled: true, bob: 0, stepAcc: 0 };
  const keys = new Set();
  const move = { x: 0, y: 0 }; // 搖桿輸入 -1..1
  const R = 0.35, EYE = 1.6;

  // ---------- 電腦 ----------
  addEventListener('keydown', (e) => { if (!e.repeat) keys.add(e.code); });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  dom.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== dom || !s.enabled) return;
    s.yaw -= e.movementX * 0.0022; s.pitch -= e.movementY * 0.0022;
  });
  const lockPointer = () => { if (!isTouch && s.enabled) dom.requestPointerLock?.(); };

  // ---------- 手機 ----------
  const stick = document.getElementById('stick'), knob = stick?.querySelector('i');
  let stickId = null, stickO = { x: 0, y: 0 }, lookId = null, lookLast = { x: 0, y: 0 }, lookMoved = 0;
  if (isTouch) {
    dom.addEventListener('touchstart', (e) => {
      if (!s.enabled) return;
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && stickId === null) {
          stickId = t.identifier; stickO = { x: t.clientX, y: t.clientY };
          stick.style.left = `${t.clientX}px`; stick.style.top = `${t.clientY}px`; stick.classList.add('on');
        } else if (lookId === null) { lookId = t.identifier; lookLast = { x: t.clientX, y: t.clientY }; lookMoved = 0; }
      }
      e.preventDefault();
    }, { passive: false });
    dom.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          let dx = t.clientX - stickO.x, dy = t.clientY - stickO.y; const m = Math.hypot(dx, dy), max = 55;
          if (m > max) { dx *= max / m; dy *= max / m; }
          move.x = dx / max; move.y = dy / max; knob.style.transform = `translate(${dx}px, ${dy}px)`;
        } else if (t.identifier === lookId) {
          const dx = t.clientX - lookLast.x, dy = t.clientY - lookLast.y; lookMoved += Math.abs(dx) + Math.abs(dy);
          s.yaw -= dx * 0.005; s.pitch -= dy * 0.005; lookLast = { x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) { stickId = null; move.x = move.y = 0; knob.style.transform = ''; stick.classList.remove('on'); }
        if (t.identifier === lookId) lookId = null;
      }
    };
    dom.addEventListener('touchend', end); dom.addEventListener('touchcancel', end);
  }

  function collide(p) {
    p.x = THREE.MathUtils.clamp(p.x, bounds.minX + R, bounds.maxX - R);
    p.z = THREE.MathUtils.clamp(p.z, bounds.minZ + R, bounds.maxZ - R);
    for (const c of colliders) {
      const cx = THREE.MathUtils.clamp(p.x, c.minX, c.maxX), cz = THREE.MathUtils.clamp(p.z, c.minZ, c.maxZ);
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d < R) {
        if (d > 1e-5) { p.x = cx + (dx / d) * R; p.z = cz + (dz / d) * R; }
        else { // 卡在裡面：往最近的邊推出去
          const opts = [[c.minX - R - p.x, 0], [c.maxX + R - p.x, 0], [0, c.minZ - R - p.z], [0, c.maxZ + R - p.z]];
          opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1])); p.x += opts[0][0]; p.z += opts[0][1];
        }
      }
    }
  }

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), dir = new THREE.Vector3();
  function update(dt) {
    s.pitch = THREE.MathUtils.clamp(s.pitch, -1.35, 1.35);
    let ix = 0, iz = 0, run = false;
    if (s.enabled) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
      run = keys.has('ShiftLeft') || keys.has('ShiftRight');
      ix += move.x; iz -= move.y;
      if (Math.hypot(move.x, move.y) > 0.92) run = true; // 搖桿推到底就跑
    }
    const m = Math.hypot(ix, iz); if (m > 1) { ix /= m; iz /= m; }
    fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw)); right.set(-fwd.z, 0, fwd.x);
    dir.copy(fwd).multiplyScalar(iz).addScaledVector(right, ix);
    const speed = (run ? 3.6 : 2.0) * (s.speedMul ?? 1), moving = dir.lengthSq() > 0.001; // speedMul：開發者工具的快速移動
    s.pos.addScaledVector(dir, speed * dt); collide(s.pos);
    // 走路時鏡頭輕微上下晃
    if (moving) {
      s.bob += dt * speed * 3.2; s.stepAcc += dt * speed;
      if (s.stepAcc > (run ? 1.1 : 0.8)) { s.stepAcc = 0; onStep?.(run); }
    } else s.bob *= 0.9;
    camera.position.set(s.pos.x, EYE + Math.sin(s.bob) * 0.035 * Math.min(1, m), s.pos.z);
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
  }

  return {
    state: s, update, lockPointer,
    setEnabled(v) { s.enabled = v; if (!v) { keys.clear(); move.x = move.y = 0; if (document.pointerLockElement) document.exitPointerLock(); } },
    get lookTapCandidate() { return lookMoved < 10; },
  };
}
