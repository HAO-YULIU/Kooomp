// 第二幕：肖像畫長廊（P09 找異常）與創辦人的房間（P10）。
// 每一趟長廊先恢復成「正常的樣子」，再套上伺服器給的那一個異常（或沒有異常）。
// 異常的編號對應 server/judge.mjs 的 ANOMALIES。美術之後由帳號二換成正式模型。
import * as THREE from 'three';
import { GALLERY_NAMES, HEADMASTERS } from '../data/story-ch1.mjs';
import { THINGS } from '../data/world-ch1.mjs';
import { paintPortrait } from '../art/portraits.mjs'; // 帳號二：油畫風格的畫像（種類、異常的差別跟原本一樣）

// X：牆的內側（灰盒的牆有 0.3 公尺厚）；END：盡頭假牆的位置（「走廊變長」時往後退）
const X = 2.5 - 0.16, NORMAL_END = -56, LONG_END = -62;
const PORTRAIT_Z = Array.from({ length: 12 }, (_, i) => -23 - i * 2.7);
const CANDLES = [[-2.05, -27], [2.05, -34], [-2.05, -41], [2.05, -48]];
const RUNIC = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛋᛏᛒᛖᛗᛚᛜᛞᛟ';
const toRunes = (s) => s.toUpperCase().split('').map((c) => RUNIC[(c.charCodeAt(0) * 7) % RUNIC.length]).join('');
const rand = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// ---- 畫像（畫在 canvas 上）：用帳號二的 paintPortrait；下面的 paintPlain 是原本的簡單版本，留著備用 ----
const paint = (kind, seed) => paintPortrait(kind, seed);
function paintPlain(kind, seed) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 166;
  const g = c.getContext('2d'), r = rand(seed * 977 + 13);
  const bg = `hsl(${Math.floor(r() * 360)}, 22%, ${14 + r() * 10}%)`;
  g.fillStyle = bg; g.fillRect(0, 0, 128, 166);
  if (kind === 'empty') return c;
  const dx = kind === 'pose' ? 26 : 0;
  // 身體
  g.fillStyle = `hsl(${Math.floor(r() * 360)}, 25%, 18%)`; g.beginPath(); g.ellipse(64 + dx, 168, 52, 50, 0, 0, Math.PI * 2); g.fill();
  const hair = `hsl(${Math.floor(r() * 50)}, 40%, ${10 + r() * 35}%)`;
  if (kind === 'back') { g.fillStyle = hair; g.beginPath(); g.ellipse(64, 80, 30, 38, 0, 0, Math.PI * 2); g.fill(); return c; }
  // 臉
  g.fillStyle = kind === 'liana' ? '#cfd6d8' : `hsl(28, 40%, ${55 + r() * 15}%)`;
  g.beginPath(); g.ellipse(64 + dx, 80, 26, 34, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = hair; g.beginPath(); g.ellipse(64 + dx, 58, 30, 18, 0, Math.PI, 0); g.fill();
  if (kind === 'gouged') { g.fillStyle = '#3a0000'; g.beginPath(); g.ellipse(64, 82, 20, 26, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#120000'; g.beginPath(); g.ellipse(64, 84, 12, 17, 0, 0, Math.PI * 2); g.fill(); return c; }
  if (kind !== 'nopupil') { g.fillStyle = '#111'; g.fillRect(52 + dx, 76, 6, 4); g.fillRect(70 + dx, 76, 6, 4); }
  if (kind === 'liana') { // 莉安娜：張著嘴，寫著「回去」
    g.fillStyle = '#000'; g.beginPath(); g.ellipse(64, 100, 7, 10, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b00'; g.font = 'bold 22px serif'; g.textAlign = 'center'; g.fillText('回去', 64, 150);
  } else { g.fillStyle = '#6a3a30'; g.fillRect(58 + dx, 96, 12, 2); }
  return c;
}
// 把東西放到某個位置（mesh.position 不能直接整個換掉）
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const atV = (m, v) => { m.position.copy(v); return m; };
const tex = (canvas) => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t; };
function textPlane(text, w, h, { color = '#d8c9a0', bg = '#2a2016', font = 22 } = {}) {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w);
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = color; g.font = `${font}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = String(text).split('\n'); lines.forEach((l, i) => g.fillText(l, 128, c.height / 2 + (i - (lines.length - 1) / 2) * font * 1.2));
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(c) }));
}

export function createGallery(scene, colliders, { house, solo, lang }) {
  const root = new THREE.Group(); root.userData.static = true; scene.add(root); // static：不會移動的場景，world.mjs 只畫玩家附近房間的部分
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
  const frameMat = mat('#6a5022', { metalness: 0.6, roughness: 0.4 });

  // ---- 24 幅學生畫像＋銘牌 ----
  const portraits = [];
  PORTRAIT_Z.forEach((z, i) => {
    for (const side of [-1, 1]) {
      const idx = i * 2 + (side > 0 ? 1 : 0);
      const g = new THREE.Group(); g.position.set(side * (X - 0.04), 2.0, z); g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.16, 1.46, 0.06), frameMat); frame.position.z = -0.03;
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.3), new THREE.MeshStandardMaterial({ map: tex(paint('normal', idx + 1)), roughness: 0.9 }));
      pic.position.z = 0.005;
      const name = GALLERY_NAMES[idx];
      const plaque = textPlane(house === 'grimoire' ? name : toRunes(name), 0.6, 0.14); plaque.position.set(0, -0.86, 0.01);
      const pupils = new THREE.Group(); // 「眼睛跟著你轉」用
      for (const px of [-0.12, 0.12]) { const p = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), new THREE.MeshBasicMaterial({ color: '#000' })); p.position.set(px, 0.21, 0.012); pupils.add(p); }
      pupils.visible = false;
      g.add(frame, pic, plaque, pupils); root.add(g);
      portraits.push({ g, pic, plaque, pupils, idx, name, plaqueText: house === 'grimoire' ? name : toRunes(name) });
    }
  });
  const setPortrait = (p, kind) => { p.pic.material.map?.dispose(); p.pic.material.map = tex(paint(kind, p.idx + 1)); p.pic.material.needsUpdate = true; };

  // ---- 燭台 ----
  const candles = CANDLES.map(([x, z]) => {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.6, 8), mat('#3a2a14', { metalness: 0.6 })); stand.position.y = 0.8;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 8), new THREE.MeshBasicMaterial({ color: '#ffcf70' })); flame.position.y = 1.72;
    g.add(stand, flame); root.add(g);
    colliders.push({ minX: x - 0.15, maxX: x + 0.15, minZ: z - 0.15, maxZ: z + 0.15 });
    return { g, flame };
  });

  // ---- 地毯（箭頭指向北邊） ----
  const cc = document.createElement('canvas'); cc.width = 64; cc.height = 64;
  { const g = cc.getContext('2d'); g.fillStyle = '#4a0f12'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#8a6a2a'; g.beginPath(); g.moveTo(32, 10); g.lineTo(50, 34); g.lineTo(14, 34); g.fill(); g.fillRect(28, 34, 8, 20); }
  const carpetTex = tex(cc); carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping; carpetTex.center.set(0.5, 0.5);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 42), new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1 }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.01, -41); root.add(carpet);
  carpetTex.repeat.set(1, 26);

  // ---- 高窗：雨、鐘塔的鐘 ----
  const win = new THREE.Group(); win.position.set(-X + 0.05, 4.3, -38); win.rotation.y = Math.PI / 2; root.add(win);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshBasicMaterial({ color: '#10182a' })); win.add(sky);
  const tower = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.2), new THREE.MeshBasicMaterial({ color: '#05070c' })); tower.position.set(0.5, -0.1, 0.01); win.add(tower);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ color: '#d8cfa0' })); face.position.set(0.5, 0.25, 0.02); win.add(face);
  const towerHand = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.14), new THREE.MeshBasicMaterial({ color: '#111' })); towerHand.geometry.translate(0, 0.06, 0); towerHand.position.set(0.5, 0.25, 0.03); win.add(towerHand);
  const rc = document.createElement('canvas'); rc.width = 64; rc.height = 64;
  { const g = rc.getContext('2d'); g.strokeStyle = 'rgba(160,180,220,0.5)'; for (let i = 0; i < 30; i++) { const x = Math.random() * 64, y = Math.random() * 64; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + 9); g.stroke(); } }
  const rainTex = tex(rc); rainTex.wrapS = rainTex.wrapT = THREE.RepeatWrapping; rainTex.repeat.set(3, 2);
  const rainPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshBasicMaterial({ map: rainTex, transparent: true })); rainPlane.position.z = 0.04; win.add(rainPlane);

  // ---- 盔甲（貝爾蒙特才聽得到呼吸）、牆上的鐘（烏洛波斯才看得到秒針） ----
  const armor = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.9, 10), mat('#7a7a80', { metalness: 0.9, roughness: 0.35 }));
  armor.position.set(2.05, 0.95, -40.5); root.add(armor); colliders.push({ minX: 1.75, maxX: 2.4, minZ: -40.85, maxZ: -40.15 });
  const clock = new THREE.Group(); clock.position.set(-X + 0.04, 3.4, -46); clock.rotation.y = Math.PI / 2; root.add(clock);
  clock.add(new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshBasicMaterial({ color: '#e8ddc0' })));
  const secHand = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.26), new THREE.MeshBasicMaterial({ color: '#900' })); secHand.geometry.translate(0, 0.11, 0); secHand.position.z = 0.01; clock.add(secHand);
  const minHand = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.2), new THREE.MeshBasicMaterial({ color: '#111' })); minHand.geometry.translate(0, 0.08, 0); minHand.position.z = 0.008; minHand.rotation.z = -1; clock.add(minHand);
  secHand.visible = house === 'ouroboros' || solo;

  // ---- 盡頭的假牆與門（每一趟的終點）；解開 P09 後拿掉 ----
  const endWall = new THREE.Group(); root.add(endWall);
  endWall.add(at(new THREE.Mesh(new THREE.BoxGeometry(5, 6, 0.3), mat('#57524c')), 0, 3, 0));
  const loopDoor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 0.1), mat('#2e1d12')); loopDoor.position.set(0, 1.3, 0.2); endWall.add(loopDoor);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat('#b8902e', { metalness: 1 })); handle.position.set(0.8, 1.2, 0.28); endWall.add(handle);
  const endCol = { minX: -X, maxX: X, minZ: 0, maxZ: 0 }; colliders.push(endCol);
  const loopThing = THINGS.find((t) => t.id === 'loop_door');
  let endZ = NORMAL_END;
  const setEnd = (z) => { endZ = z; endWall.position.z = z; endCol.minZ = z - 0.15; endCol.maxZ = z + 0.15; loopThing.z = z + 0.3; };
  setEnd(NORMAL_END);

  // ---- 異常用的額外東西 ----
  const extra = new THREE.Group(); root.add(extra);
  const ooze = new THREE.Group(); extra.add(ooze);
  for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.4 + Math.random() * 0.6), new THREE.MeshBasicMaterial({ color: '#050505' })); d.position.set(-0.3 + i * 0.15, -0.9 - Math.random() * 0.3, 0.02); ooze.add(d); }
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: '#030303' })); puddle.rotation.x = -Math.PI / 2;
  extra.add(puddle);
  const greenLamp = new THREE.Group(); greenLamp.position.set(0.6, 0, -45);
  greenLamp.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.35, 8), new THREE.MeshBasicMaterial({ color: '#4cff7a' })), 0, 0.2, 0));
  extra.add(greenLamp);
  const hands = new THREE.Group(); extra.add(hands);
  for (let i = 0; i < 6; i++) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.09, 5), new THREE.MeshBasicMaterial({ color: '#6a0000' })); h.position.set(-X + 0.05, 1.1 + (i % 2) * 0.3, -30 - i * 4); h.rotation.y = Math.PI / 2; hands.add(h); }
  const steps = new THREE.Group(); extra.add(steps);
  for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.26), new THREE.MeshBasicMaterial({ color: '#9fe0ff' })); s.rotation.x = -Math.PI / 2; s.position.set((i % 2 ? 0.25 : -0.25), 0.02, -24 - i * 3); steps.add(s); }
  const cat = new THREE.Group(); cat.position.set(0, 4.2, -37);
  cat.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.25), mat('#111')));
  for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 5), mat('#1a1a2a', { emissive: '#101030' })); sp.position.set(-0.2 + i * 0.08, 0.15, 0); cat.add(sp); }
  cat.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.8), mat('#333')), 0, 1, 0));
  extra.add(cat);
  const figure = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.8, 8), new THREE.MeshBasicMaterial({ color: '#000' })); extra.add(figure);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.7 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; extra.add(shadow);
  const familiar = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: '#9fc4ff', transparent: true, opacity: 0.8 })); scene.add(familiar); // 使魔（一團小光，飛在前方）

  // ---- 創辦人的房間：13 位校長＋創辦人；熄燈時眼睛發光、視線指向西北角 ----
  const founder = new THREE.Group(); founder.userData.static = true; scene.add(founder);
  const NW = new THREE.Vector3(-6.8, 3, -79.8);
  const rays = new THREE.Group(); rays.visible = false; founder.add(rays);
  const rayMat = new THREE.MeshBasicMaterial({ color: '#ffd060', transparent: true, opacity: 0.7 });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffe08a' });
  // 一道光：從眼睛射向西北角的細圓柱
  const ray = (a, b) => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, d.length(), 5), rayMat); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };
  rays.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), glowMat), NW.x, NW.y, NW.z)); // 視線交會的地方
  const hmSpots = [...Array.from({ length: 6 }, (_, i) => [-6.8, -66 - i * 2.4, Math.PI / 2]), ...Array.from({ length: 6 }, (_, i) => [6.8, -66 - i * 2.4, -Math.PI / 2])];
  HEADMASTERS.slice(1).forEach((hm, i) => {
    const [x, z, ry] = hmSpots[i];
    const g = new THREE.Group(); g.position.set(x, 2.4, z); g.rotation.y = ry;
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.7, 0.06), frameMat), 0, 0, -0.03));
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), new THREE.MeshStandardMaterial({ map: tex(paint('normal', 100 + i)), roughness: 0.9 })), 0, 0, 0.005));
    const pl = textPlane(lang === 'en' ? hm.en : hm.zh, 2.1, 0.32, { font: 15 }); pl.position.set(0, -1.08, 0.01); g.add(pl);
    founder.add(g);
    const eye = new THREE.Vector3(); g.updateMatrixWorld(); g.localToWorld(eye.set(0, 0.25, 0.02));
    rays.add(ray(eye.clone(), NW));
    rays.add(atV(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), glowMat), eye));
  });
  { // 創辦人的畫像（北牆）
    const g = new THREE.Group(); g.position.set(0, 3.4, -79.8); founder.add(g);
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.8, 0.08), frameMat), 0, 0, -0.04));
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.5), new THREE.MeshStandardMaterial({ map: tex(paint('normal', 4242)), roughness: 0.9 })), 0, 0, 0.005));
    const pl = textPlane(lang === 'en' ? HEADMASTERS[0].en : HEADMASTERS[0].zh, 2.6, 0.3, { font: 14 }); pl.position.set(0, -2.1, 0.02); g.add(pl);
  }
  { // 地上的羅盤
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.strokeStyle = '#b8902e'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#b8902e'; g.font = 'bold 40px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    [['N', 128, 34], ['S', 128, 222], ['W', 34, 128], ['E', 222, 128]].forEach(([s, x, y]) => g.fillText(s, x, y));
    g.beginPath(); g.moveTo(128, 60); g.lineTo(140, 128); g.lineTo(116, 128); g.fill();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.02, -72); founder.add(m);
  }

  // ---- 每一趟：恢復正常，再套上異常 ----
  let current = null, loopIdx = 0, rushState = 0, lagTrail = [];
  function reset() {
    portraits.forEach((p) => { if (p.kind && p.kind !== 'normal') setPortrait(p, 'normal'); p.kind = 'normal'; p.g.visible = true; p.pupils.visible = false;
      const t = p.plaque.material.map; const plain = house === 'grimoire' ? p.name : toRunes(p.name);
      if (p.plaqueText !== plain) { p.plaqueText = plain; t.dispose(); p.plaque.material.map = textPlane(plain, 0.6, 0.14).material.map; } });
    candles.forEach((c) => { c.g.visible = true; c.flame.rotation.x = 0; c.flame.position.y = 1.72; });
    carpetTex.rotation = 0;
    rainPlane.visible = true;
    for (const o of [ooze, puddle, greenLamp, hands, steps, cat, figure, shadow]) o.visible = false;
    handle.position.x = 0.8;
    familiar.visible = true;
    setEnd(NORMAL_END);
    rushState = 0; lagTrail = [];
  }
  function pick(n) { return portraits[(loopIdx * 7 + n * 5) % portraits.length]; }

  function setLoop(anomaly, n, { familiarView = false } = {}) {
    loopIdx = n; reset(); current = anomaly;
    if (!anomaly) return null;
    // 學院專屬的異常：只有那個學院的人看得到；單人要切換到使魔視角
    const canSee = !anomaly.house || anomaly.house === house || (solo && familiarView);
    if (!canSee) return null;
    const p = pick(1), c = candles[loopIdx % candles.length];
    switch (anomaly.id) {
      case 'candle_down': c.flame.rotation.x = Math.PI; c.flame.position.y = 1.55; break;
      case 'candle_missing': c.g.visible = false; break;
      case 'pose': setPortrait(p, 'pose'); p.kind = 'pose'; break;
      case 'empty_frame': setPortrait(p, 'empty'); p.kind = 'empty'; break;
      case 'frame_count': p.g.visible = false; break;
      case 'back_turned': setPortrait(p, 'back'); p.kind = 'back'; break;
      case 'carpet': carpetTex.rotation = Math.PI; break;
      case 'rain_stops': rainPlane.visible = false; break;
      case 'longer': setEnd(LONG_END); break;
      case 'eyes_follow': setPortrait(p, 'nopupil'); p.kind = 'nopupil'; p.pupils.visible = true; break;
      case 'black_ooze': p.g.add(ooze); ooze.visible = true; puddle.visible = true; puddle.position.set(p.g.position.x * 0.8, 0.02, p.g.position.z); break;
      case 'door_handle': handle.position.x = -0.8; break;
      case 'shadow_lag': shadow.visible = true; break;
      case 'clock_reverse': break; // update() 裡讓鐘塔的指針倒著走
      case 'familiar_gone': familiar.visible = false; break;
      case 'handprints': hands.visible = true; break;
      case 'green_lamp': greenLamp.visible = true; break;
      case 'lullaby': break; // 由 play.mjs 播放童謠
      case 'liana': setPortrait(p, 'liana'); p.kind = 'liana'; break;
      case 'face_gouged': setPortrait(p, 'gouged'); p.kind = 'gouged'; break;
      case 'hanging_cat': cat.visible = true; break;
      case 'rush_figure': figure.visible = true; figure.position.set(0, 0.9, endZ + 1.2); rushState = 1; break;
      case 'glowing_steps': steps.visible = true; break;
      case 'plaque_changed': { const q = pick(2); q.plaqueText = 'LIANA'; q.plaque.material.map = textPlane(house === 'grimoire' ? 'LIANA' : toRunes('LIANA'), 0.6, 0.14).material.map; break; }
      case 'armor_breath': break; // 由 play.mjs 在靠近盔甲時播呼吸聲
      case 'clock_slow': break; // update() 裡讓秒針變慢
      default: break;
    }
    return anomaly.id;
  }

  const tmp = new THREE.Vector3();
  let t = 0;
  return {
    setLoop, reset, endZ: () => endZ, current: () => current,
    nearArmor: (pos) => Math.hypot(pos.x - 2.05, pos.z + 40.5) < 5,
    openEnd() { endWall.visible = false; const i = colliders.indexOf(endCol); if (i >= 0) colliders.splice(i, 1); loopThing.z = 999; },
    setDark(on) { rays.visible = on; },
    // 回傳 'rush'＝突然衝過來（播尖叫、閃一下）
    update(dt, pos, inCorridor, yaw = 0) {
      t += dt;
      const slow = current?.id === 'clock_slow' && (house === 'ouroboros' || solo);
      secHand.rotation.z = -((t * (slow ? 0.5 : 1)) % 60) / 60 * Math.PI * 2;
      towerHand.rotation.z += (current?.id === 'clock_reverse' ? 1 : -1) * dt * 0.4;
      rainTex.offset.y += dt * 2.5;
      familiar.position.set(pos.x - Math.sin(yaw + 0.45) * 2.2, 2.1 + Math.sin(t * 3) * 0.06, pos.z - Math.cos(yaw + 0.45) * 2.2); // 左前方兩公尺
      familiar.visible = inCorridor && current?.id !== 'familiar_gone';
      for (const p of portraits) if (p.pupils.visible) {
        p.g.worldToLocal(tmp.set(pos.x, 1.6, pos.z));
        const k = Math.min(1, 0.04 / Math.max(0.3, Math.hypot(tmp.x, tmp.z) * 0.1));
        p.pupils.position.set(THREE.MathUtils.clamp(tmp.x * k, -0.04, 0.04), THREE.MathUtils.clamp((tmp.y - 0.21) * k, -0.03, 0.03), 0);
      }
      if (shadow.visible) { lagTrail.push([pos.x, pos.z, t]); while (lagTrail.length && t - lagTrail[0][2] > 1.2) { const [x, z] = lagTrail.shift(); shadow.position.set(x, 0.02, z); } }
      if (rushState === 1 && inCorridor && pos.z < figure.position.z + 14) rushState = 2;
      if (rushState === 2) {
        const dz = pos.z - figure.position.z, dx = pos.x - figure.position.x;
        const d = Math.hypot(dx, dz);
        if (d < 0.9) { rushState = 3; figure.visible = false; return 'rush'; }
        figure.position.x += dx / d * 18 * dt; figure.position.z += dz / d * 18 * dt;
      }
      return null;
    },
  };
}
