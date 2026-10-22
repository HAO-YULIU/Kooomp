// 選角色畫面的角色展示（帳號二）：一個小舞台，角色站在學院色的光圈上慢慢轉，可以用手指／滑鼠轉。
// 用法：
//   const pv = createPreview(canvas);
//   pv.show('elora', '#9fc4ff');   // 換角色（模型第一次要下載，之後有快取，進遊戲也不用再下載）
//   pv.mood('smile');              // 選定時笑一下
//   pv.dispose();                  // 離開等待室時
import * as THREE from 'three';
import { loadCharacter } from './characters.mjs';

export function createPreview(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
  camera.position.set(0, 1.0, -4.1); camera.lookAt(0, 0.9, 0);

  // 燈：暖色主光、冷色補光、背後學院色的輪廓光
  scene.add(new THREE.HemisphereLight('#c8c0d8', '#201810', 0.9));
  const key = new THREE.DirectionalLight('#ffe2bc', 2.6); key.position.set(-1.3, 2.3, -3.2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -1, right: 1, top: 2.2, bottom: -0.2, near: 0.5, far: 8 }); scene.add(key);
  const fill = new THREE.DirectionalLight('#b8c4e0', 1.1); fill.position.set(1.8, 1.5, -2.6); scene.add(fill);
  const rim = new THREE.SpotLight('#ffffff', 30, 7, 0.6, 0.6); rim.position.set(0, 3.2, 2.2); rim.target.position.set(0, 1, 0); scene.add(rim, rim.target);

  // 地上：深色石板＋學院色的魔法陣光圈
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), new THREE.MeshStandardMaterial({ color: '#16131a', roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ringCanvas = document.createElement('canvas'); ringCanvas.width = ringCanvas.height = 512;
  const g = ringCanvas.getContext('2d');
  const paintRing = () => { // 白色的圈與符文，用材質顏色染成學院色
    g.clearRect(0, 0, 512, 512); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.translate(256, 256);
    g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 230, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 200, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 0, 120, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 5; i++) { const a = (i * 4 * Math.PI) / 5 - Math.PI / 2, b = ((i + 1) * 4 * Math.PI) / 5 - Math.PI / 2; g.beginPath(); g.moveTo(Math.cos(a) * 200, Math.sin(a) * 200); g.lineTo(Math.cos(b) * 200, Math.sin(b) * 200); g.stroke(); }
    g.font = '22px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < runes.length; i++) { const a = (i / runes.length) * Math.PI * 2; g.save(); g.rotate(a); g.fillText(runes[i], 0, -215); g.restore(); }
    g.setTransform(1, 0, 0, 1, 0, 0);
  };
  paintRing();
  const ringTex = new THREE.CanvasTexture(ringCanvas); ringTex.colorSpace = THREE.SRGBColorSpace;
  const ringMat = new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, color: '#9fc4ff', blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005; scene.add(ring);
  const glow = new THREE.PointLight('#9fc4ff', 1.6, 2.5, 2); glow.position.set(0, 0.15, 0); scene.add(glow);
  // 飄浮的光點
  const N = 60, dots = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) seeds.push({ a: Math.random() * Math.PI * 2, r: 0.4 + Math.random() * 0.8, y: Math.random() * 2, s: 0.1 + Math.random() * 0.25 });
  const dotGeo = new THREE.BufferGeometry(); dotGeo.setAttribute('position', new THREE.BufferAttribute(dots, 3));
  const dotMat = new THREE.PointsMaterial({ color: '#9fc4ff', size: 0.025, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(dotGeo, dotMat));

  const stage = new THREE.Group(); scene.add(stage);
  let cur = null, want = null, spin = 0, spinV = 0, drag = null, alive = true, last = performance.now(), fade = 1;

  const resize = () => {
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 400;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.position.z = -4.1 * Math.max(1, 0.75 / camera.aspect); // 窄的畫面拉遠一點，整個人放得進去
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, s: spin }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const ns = drag.s + (e.clientX - drag.x) * 0.012; spinV = (ns - spin) * 30; spin = ns; });
  const up = () => { drag = null; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  const tick = () => {
    if (!alive) return;
    requestAnimationFrame(tick);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!drag) { spinV *= Math.pow(0.05, dt); spin += (0.35 + spinV) * dt; }
    stage.rotation.y = spin;
    ring.rotation.z += dt * 0.15;
    for (let i = 0; i < N; i++) { const s = seeds[i]; s.y += s.s * dt; if (s.y > 2.2) s.y = 0; s.a += dt * 0.2; dots.set([Math.cos(s.a) * s.r, s.y, Math.sin(s.a) * s.r], i * 3); }
    dotGeo.attributes.position.needsUpdate = true;
    fade = Math.min(1, fade + dt * 2.5);
    if (cur) { cur.update(dt, camera.position); cur.root.position.y = (1 - fade) * -0.15; }
    renderer.toneMappingExposure = 1.15 * (0.35 + 0.65 * fade);
    renderer.render(scene, camera);
  };
  tick();

  return {
    async show(key, color = '#9fc4ff') {
      want = key;
      for (const m of [ringMat, dotMat]) m.color.set(color); glow.color.set(color); rim.color.set(color).lerp(new THREE.Color('#ffffff'), 0.4);
      if (!key) { if (cur) stage.remove(cur.root); cur = null; return; }
      if (cur?.key === key) return;
      const c = await loadCharacter(key);
      if (want !== key || !alive) return; // 下載期間又換了別人
      if (cur) stage.remove(cur.root);
      c.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      cur = c; stage.add(c.root); fade = 0; c.setMood('calm');
    },
    mood(m) { cur?.setMood(m); if (m === 'smile') setTimeout(() => cur?.setMood('calm'), 1800); },
    camera, renderer, setSpin(a) { spin = a; spinV = 0; drag = { x: 0, s: a }; }, // 烘焙頭像用：固定角度
    ready: () => !!cur && fade >= 1,
    headY() { let y = cur ? new THREE.Box3().setFromObject(cur.root).max.y - 0.13 : 1.5; cur?.root.updateMatrixWorld(true); cur?.root.traverse((o) => { if (o.isBone && /_Head$/.test(o.name)) y = o.getWorldPosition(new THREE.Vector3()).y; }); return y; },
    dispose() { alive = false; ro.disconnect(); renderer.dispose(); renderer.forceContextLoss(); },
  };
}
