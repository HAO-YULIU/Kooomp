// Character Creator 匯出的基本人物模型（免費模型，男生、女生各一個）：有骨架、有臉部表情，但只穿內衣、沒有皮膚貼圖。
// 這裡補上：學院斗篷（程式做的）、皮膚與頭髮材質、把手臂放下、只留下會用到的表情（減輕手機負擔），
// 再加上呼吸、轉頭看玩家、眨眼、說話時嘴巴動、換表情。樣品角色：沃恩（男）、月晞（女）。
import * as THREE from 'three';
import { FBXLoader } from '../vendor/addons/loaders/FBXLoader.js';

// 會用到的表情（其他一百多個刪掉，不然每一格畫面都要算全部）
const KEEP = ['Eyes_Blink', 'Mouth_Smile', 'Cheek_Raise_L', 'Cheek_Raise_R', 'V_Open', 'Mouth_Open',
  'A01_Brow_Inner_Up', 'A18_Eye_Wide_Left', 'A19_Eye_Wide_Right', 'Brow_Drop_Left', 'Brow_Drop_Right', 'Mouth_Frown'];

function pruneMorphs(mesh) {
  const dict = mesh.morphTargetDictionary, geo = mesh.geometry;
  if (!dict || !geo.morphAttributes.position) return;
  const keep = Object.entries(dict).filter(([k]) => KEEP.includes(k.split('.').pop())).sort((a, b) => a[1] - b[1]);
  if (!keep.length) { // 一個都不用：整個拿掉，不然著色器會出錯
    geo.morphAttributes = {}; geo.morphTargetsRelative = false; delete mesh.morphTargetDictionary; delete mesh.morphTargetInfluences; return;
  }
  const newDict = {};
  for (const key of Object.keys(geo.morphAttributes)) geo.morphAttributes[key] = keep.map(([, i]) => geo.morphAttributes[key][i]);
  keep.forEach(([k], j) => { newDict[k.split('.').pop()] = j; });
  mesh.morphTargetDictionary = newDict; mesh.morphTargetInfluences = new Array(keep.length).fill(0);
}

// ---------- 皮膚：原檔沒有皮膚貼圖，依照臉部位置用頂點顏色畫出血色與陰影 ----------
// 模型原本的座標（公分）：x 左右、y 前後（負的是臉的前方）、z 往上。以男生模型為準（眼睛 z 169.3），女生整體往下移。
const FACE = {
  lips: { x: 0, z: 161.3, rx: 2.5, rz: 1.15, col: [0.6, 0.3, 0.29], amt: 0.85 },
  cheekL: { x: 4.6, z: 164.3, rx: 2.6, rz: 2.2, col: [0.88, 0.5, 0.44], amt: 0.4 },
  cheekR: { x: -4.6, z: 164.3, rx: 2.6, rz: 2.2, col: [0.88, 0.5, 0.44], amt: 0.4 },
  nose: { x: 0, z: 164.8, rx: 1.3, rz: 1.4, col: [0.86, 0.52, 0.46], amt: 0.25 },
  socketL: { x: 3.2, z: 168.6, rx: 2.4, rz: 1.6, col: [0.55, 0.38, 0.34], amt: 0.3 },
  socketR: { x: -3.2, z: 168.6, rx: 2.4, rz: 1.6, col: [0.55, 0.38, 0.34], amt: 0.3 },
  chin: { x: 0, z: 156.8, rx: 3, rz: 1.5, col: [0.8, 0.55, 0.48], amt: 0.12 },
};
export const hash3 = (x, y, z) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return v - Math.floor(v); };
function vnoise(x, y, z) { // 簡單的數值雜訊，做皮膚深淺不均
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const l = (a, b, t) => a + (b - a) * t * t * (3 - 2 * t);
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf), l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf), zf);
}
export function paintSkin(geo, base, dz) {
  const pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 3), b = new THREE.Color(base);
  // FACE 裡的顏色是一般看到的顏色（sRGB），換成計算用的線性顏色，不然會太淡
  const faces = Object.values(FACE).map((f) => ({ ...f, col: new THREE.Color().setRGB(...f.col, THREE.SRGBColorSpace).toArray() }));
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i) - dz; // z：換算成男生模型的高度，下面的數字都用男生的
    let r = b.r, g = b.g, bl = b.b;
    const nz = 0.93 + 0.1 * vnoise(x * 0.35, y * 0.35, z * 0.35) + 0.04 * vnoise(x * 1.7, y * 1.7, z * 1.7);
    r *= nz; g *= nz; bl *= nz;
    if (z > 150 && Math.abs(x) < 13) {
      if (y < -3) for (const f of faces) { // 只畫臉的正面
        const d = ((x - f.x) / f.rx) ** 2 + ((z - f.z) / f.rz) ** 2, w = Math.exp(-d * 1.5) * f.amt;
        r += (f.col[0] - r) * w; g += (f.col[1] - g) * w; bl += (f.col[2] - bl) * w;
      }
      if (Math.abs(x) > 6.8 && z > 162 && z < 172) { r *= 1.04; g *= 0.93; bl *= 0.9; } // 耳朵比較紅
      if (z > 176) { const w = Math.min(1, (z - 176) / 5) * 0.35; r *= 1 - w * 0.5; g *= 1 - w * 0.55; bl *= 1 - w * 0.55; } // 髮際線附近的頭皮陰影
    }
    if (z < 140 && z > 60 && Math.abs(x) > 55) { r *= 1.03; g *= 0.94; bl *= 0.92; } // 手掌、指尖（T 字姿勢時在最外側）
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = bl;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
// 毛孔：程式產生的細小凹凸（法線貼圖），重複鋪滿
let poresTex = null;
function pores() {
  if (poresTex) return poresTex;
  const S = 256, h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) h[i] = Math.random();
  for (let k = 0; k < 2; k++) for (let i = 0; i < h.length; i++) h[i] = (h[i] + h[(i + 1) % h.length] + h[(i + S) % h.length]) / 3;
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), d = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, dx = h[y * S + ((x + 1) % S)] - h[i], dy = h[((y + 1) % S) * S + x] - h[i];
    d.data[i * 4] = 128 + dx * 600; d.data[i * 4 + 1] = 128 + dy * 600; d.data[i * 4 + 2] = 255; d.data[i * 4 + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  poresTex = new THREE.CanvasTexture(c); poresTex.wrapS = poresTex.wrapT = THREE.RepeatWrapping; poresTex.repeat.set(12, 12);
  return poresTex;
}
export const skinMat = (name) => new THREE.MeshPhysicalMaterial({
  name, color: '#ffffff', vertexColors: true, roughness: 0.55, normalMap: pores(), normalScale: new THREE.Vector2(0.12, 0.12),
  sheen: 0.35, sheenColor: new THREE.Color('#ff9a85'), sheenRoughness: 0.5, // 邊緣透一點紅，假的次表面散射
});

// ---------- 頭髮：髮根深、髮尾亮，每一撮深淺不同，加上光澤 ----------
function paintHair(geo, root, tip, scalpCount, dz) {
  const pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 4);
  const R = new THREE.Color(root), T = new THREE.Color(tip), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i) - dz;
    let a = 1;
    if (i < scalpCount) { // 頭皮：顏色跟髮根一樣，額頭和鬢角那一圈慢慢變透明，不會像戴頭帶
      c.copy(R); a = THREE.MathUtils.clamp((z - 176.5) / 3, 0, 1);
      if (y > -2) a = Math.max(a, THREE.MathUtils.clamp((z - 168) / 4, 0, 1)); // 後腦勺和側邊比較低也要蓋住
      a *= 0.92;
    } else {
      const d = Math.hypot(x, (y - 2) * 0.9, (z - 172) * 1.1); // 離頭中心越遠越接近髮尾
      const t = THREE.MathUtils.clamp((d - 9) / 5, 0, 1);
      const strand = 0.8 + 0.4 * hash3(Math.round(x * 2), Math.round(y * 2), Math.round(z * 0.5));
      c.copy(R).lerp(T, t).multiplyScalar(strand);
    }
    col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b; col[i * 4 + 3] = a;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
}

// 斗篷：從肩膀垂到腳踝的長袍＋立領，掛在胸口的骨頭上，跟著身體動
export function makeCloak(house) {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: house.main, roughness: 0.85, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ color: house.trim, roughness: 0.4, metalness: 0.6 });
  const prof = [[0.075, 0.17], [0.2, 0.16], [0.28, 0.13], [0.32, 0.07], [0.33, 0.0], [0.32, -0.3], [0.32, -0.7], [0.35, -1.05], [0.39, -1.4]].map(([x, y]) => new THREE.Vector2(x, y));
  const robe = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), cloth); robe.scale.z = 0.72; robe.castShadow = true;
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.012, 6, 40), trim); hem.rotation.x = Math.PI / 2; hem.position.y = -1.4; hem.scale.y = 0.72;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.12, 24, 1, true), cloth); collar.position.y = 0.17; collar.scale.z = 0.85;
  const clasp = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.008, 6, 16), trim); clasp.position.set(0, 0.06, 0.2);
  // 前襟的金邊
  for (const s of [-1, 1]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 1.5, 0.01), trim); strip.position.set(s * 0.03, -0.62, 0.226); strip.rotation.x = -0.03; g.add(strip); }
  g.add(robe, hem, collar, clasp);
  return g;
}

const FILES = { male: 'models/male/Male_Base.fbx', female: 'models/girl/Female_Base.fbx', elora: 'models/elora/Elora.fbx' };
const HAIR_MESH = /Slicked_Back_Side|Space_bun|Air_bangs|Double_high|^Scalp$/;

/** opts：{ body: 'male' | 'female' | 'elora', house: { main, trim }, hair, hairTip, skin, cloakScale, height（整體縮放）, glasses（艾洛拉的模型附眼鏡，預設不戴） } */
export function loadCC(scene, { body = 'male', house = { main: '#121214', trim: '#b8902e' }, hair = '#1e1510', hairTip = '#4a3426', skin = '#e8bfa2', cloakScale = 1, height = 1, glasses = false } = {}) {
  return new Promise((resolve, reject) => {
    new FBXLoader().load(FILES[body], (o) => {
      o.scale.setScalar(0.01 * height);
      const meshes = [];
      // 不同模型的骨頭、零件前綴不一樣（EM3D_Base_、NUG_Base_…），從身體的名字找出來
      let P = 'EM3D_Base_'; o.traverse((c) => { if (c.isMesh && /_Base_Body$/.test(c.name)) P = c.name.replace(/Body$/, ''); });
      // 以眼睛的高度對齊臉部位置（男生 169.3 公分）
      const eye = o.getObjectByName(P + 'Eye'); eye.geometry.computeBoundingBox();
      const dz = (eye.geometry.boundingBox.min.z + eye.geometry.boundingBox.max.z) / 2 - 169.3;
      o.traverse((c) => {
        if (!c.isMesh) return;
        if (/Tongue|Boxers|Bra|Underwear/.test(c.name) || (/glasses/i.test(c.name) && !glasses)) { c.visible = false; return; } // 舌頭看不到、內衣被斗篷蓋住
        pruneMorphs(c); meshes.push(c);
        c.castShadow = true; c.receiveShadow = true;
        c.frustumCulled = false; // 骨架會轉頭，三.js 算的範圍跟不上，頭髮會被誤判在畫面外而不畫
        if (c.name === P + 'Body') paintSkin(c.geometry, skin, dz);
        const scalpCount = c.geometry.groups.length > 1 ? c.geometry.groups[0].count : 0;
        if (HAIR_MESH.test(c.name) && !c.geometry.index) paintHair(c.geometry, hair, hairTip, scalpCount, dz);
        const mats = [].concat(c.material).map((m) => {
          if (/Skin/.test(m.name)) return skinMat(m.name);
          if (/Nails/.test(m.name)) return new THREE.MeshStandardMaterial({ name: m.name, color: '#e6c2b0', roughness: 0.35 });
          if (/Teeth/.test(m.name)) return new THREE.MeshStandardMaterial({ name: m.name, color: '#e8e2d6', roughness: 0.3 });
          if (/Scalp/.test(m.name)) return new THREE.MeshStandardMaterial({ name: m.name, color: '#ffffff', vertexColors: true, alphaMap: m.alphaMap, transparent: true, depthWrite: false, roughness: 1 }); // 原本是白色頭皮；髮際線慢慢淡出
          // 頭髮：保留原本的透明度貼圖（一根一根的形狀）。用不反光的材質：頭髮片很薄、幾乎都是斜著看，
          // 會反光的材質在斜角反射特別強，整頭會被燭光照成橘色
          if (/^hair$/.test(m.name)) { // 艾洛拉的頭髮：髮絲很細、透明度貼圖很淡，切掉會變光頭，所以改用半透明疊加，並把不透明度加倍
            const h = new THREE.MeshLambertMaterial({ name: m.name, color: '#ffffff', vertexColors: true, alphaMap: m.alphaMap, transparent: true, depthWrite: false, alphaTest: 0.03, side: THREE.DoubleSide });
            h.customProgramCacheKey = () => 'hair-alpha-boost'; // 不設的話會跟其他頭髮共用同一份著色器，加倍就失效
            h.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\n diffuseColor.a = clamp(diffuseColor.a * 2.4, 0.0, 1.0);'); };
            return h;
          }
          if (/Slicked_Back|Hair_Transparency|^hair$/.test(m.name)) return new THREE.MeshLambertMaterial({
            name: m.name, color: '#ffffff', vertexColors: true, alphaMap: m.alphaMap, alphaTest: 0.3, side: THREE.DoubleSide,
          });
          if (/Eyelash/.test(m.name)) { m.color.set('#1a120e'); return m; }
          if (/Female_Flat/.test(m.name)) return new THREE.MeshLambertMaterial({ name: m.name, color: hair, alphaMap: m.alphaMap, transparent: true, depthWrite: false }); // 眉毛：原本的材質反光太強，看起來是灰白色
          return m;
        });
        c.material = Array.isArray(c.material) ? mats : mats[0];
      });
      const bone = (n) => o.getObjectByName(P + n);
      // 手臂放下（T 字站姿 → 自然垂下），用骨架轉，比改頂點乾淨
      o.updateMatrixWorld(true);
      const rotWorld = (b, axis, ang) => {
        const pw = new THREE.Quaternion(); b.parent.getWorldQuaternion(pw);
        const q = new THREE.Quaternion().setFromAxisAngle(axis, ang);
        b.quaternion.copy(pw.clone().invert().multiply(q).multiply(pw).multiply(b.quaternion)); b.updateMatrixWorld(true);
      };
      const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0);
      rotWorld(bone('L_Upperarm'), Z, -1.25); rotWorld(bone('R_Upperarm'), Z, 1.25);
      rotWorld(bone('L_Forearm'), X, -0.25); rotWorld(bone('R_Forearm'), X, -0.25); // 手肘微彎

      const holder = new THREE.Group(); holder.add(o);
      // 斗篷掛在胸口骨頭上
      const chest = bone('Spine02') || bone('Spine01');
      const cloak = makeCloak(house); cloak.scale.setScalar(cloakScale);
      holder.add(cloak);
      scene.add(holder);

      const head = bone('Head'), spine = chest, neck = bone('NeckTwist01'), neckPos = new THREE.Vector3();
      const headBase = head.quaternion.clone(), spineBase = spine.quaternion.clone();
      const set = (k, v) => { for (const m of meshes) { const i = m.morphTargetDictionary?.[k]; if (i != null) m.morphTargetInfluences[i] = v; } };
      const st = { blink: 0, next: 2, talk: 0, mood: 'calm', yaw: 0, pitch: 0 };
      const tmp = new THREE.Vector3(), chestPos = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();

      function update(t, dt, playerPos) {
        // 呼吸
        e.set(Math.sin(t * 1.4) * 0.015, 0, 0); spine.quaternion.copy(spineBase).multiply(q.setFromEuler(e));
        // 轉頭看玩家（只轉頭，限制角度）
        head.getWorldPosition(tmp);
        const local = holder.worldToLocal(playerPos.clone()), hp = holder.worldToLocal(tmp.clone());
        const dx = local.x - hp.x, dz = local.z - hp.z, dist = Math.hypot(dx, dz);
        const wantYaw = dist < 6 ? THREE.MathUtils.clamp(Math.atan2(dx, dz), -1.0, 1.0) : 0;
        const wantPitch = dist < 6 ? THREE.MathUtils.clamp(-Math.atan2(local.y - hp.y, dist), -0.4, 0.4) : 0;
        st.yaw += (wantYaw - st.yaw) * Math.min(1, dt * 3); st.pitch += (wantPitch - st.pitch) * Math.min(1, dt * 3);
        // 頭骨的局部座標方向不一定跟世界一樣，所以在世界座標轉，再換回局部
        head.quaternion.copy(headBase); head.updateMatrixWorld(true);
        rotWorld(head, new THREE.Vector3(0, 1, 0).applyQuaternion(holder.quaternion), st.yaw);
        rotWorld(head, new THREE.Vector3(1, 0, 0).applyQuaternion(holder.quaternion), st.pitch * 0.6);
        // 眨眼
        st.next -= dt; if (st.next <= 0) { st.blink = 1; st.next = 2 + Math.random() * 3; }
        st.blink = Math.max(0, st.blink - dt * 8); set('Eyes_Blink', st.blink > 0 ? Math.sin(st.blink * Math.PI) : 0);
        // 說話
        if (st.talk > 0) { st.talk -= dt; const m = Math.abs(Math.sin(t * 15)) * (0.5 + 0.5 * Math.sin(t * 4.3)); set('V_Open', m * 0.6); set('Mouth_Open', m * 0.25); }
        else { set('V_Open', 0); set('Mouth_Open', 0); }
        // 表情
        const smile = st.mood === 'smile' ? 0.75 : 0, scared = st.mood === 'scared' ? 1 : 0;
        set('Mouth_Smile', smile); set('Cheek_Raise_L', smile * 0.5); set('Cheek_Raise_R', smile * 0.5);
        set('A01_Brow_Inner_Up', scared); set('A18_Eye_Wide_Left', scared * 0.7); set('A19_Eye_Wide_Right', scared * 0.7); set('Mouth_Frown', scared * 0.4);
        // 斗篷跟著胸口
        // 斗篷的領口對齊脖子根部（男女身高、脖子長度不同）
        chest.getWorldPosition(chestPos); neck.getWorldPosition(neckPos);
        cloak.position.copy(holder.worldToLocal(chestPos)); cloak.position.y = holder.worldToLocal(neckPos).y - 0.2 * cloakScale; cloak.position.z -= 0.01;
      }
      resolve({ root: holder, update, setMood: (m) => { st.mood = m; }, talk: (s) => { st.talk = s; } });
    }, undefined, reject);
  });
}
