// 第四幕：守夜人（P26～P29、蝕巢）的場景與線索。依 docs/03-chapter1.md、docs/04-map-ch1.md。這裡沒有答案（答案在伺服器）。
// 逃亡路線：圖書館入口大廳 → 旁邊通道（往東）→ 鐘塔底下的機械室 ⇄ 蝕巢 → 屋頂通道（往北）。
const L = (zh, en) => ({ zh, en });

export const A4_ROOMS = [
  { id: 'a4_pass', name: L('北翼樓梯旁的通道', 'The Side Passage'), x: [115, 145], z: [7, 8.5], h: 3.2, floor: 'stone', light: '#4a5a4a' },
  { id: 'a4_gears', name: L('鐘塔底下的機械室', 'The Clockwork Room'), x: [145, 165], z: [-2, 18], h: 12, floor: 'stone', light: '#8a6a4a' },
  { id: 'a4_nest', name: L('蝕巢', 'The Blight Nest'), x: [165, 173], z: [-2, 6], h: 5, floor: 'stone', light: '#3a0a12' },
  { id: 'a4_roof', name: L('屋頂通道', 'The Rooftop Walk'), x: [150, 160], z: [-62, -2], h: 10, floor: 'stone', sky: true, light: '#8aa0d0' },
];

export const A4_DOORS = [
  { id: 'entry-pass', a: 'lib_entry', b: 'a4_pass', x: 115, z: 7.75, w: 1.5, axis: 'z', lock: { segment: 'act4' } },
  { id: 'pass-gears', a: 'a4_pass', b: 'a4_gears', x: 145, z: 7.75, w: 1.5, axis: 'z', lock: { puzzle: 'P26' } },
  { id: 'gears-nest', a: 'a4_gears', b: 'a4_nest', x: 165, z: 2, w: 1.6, axis: 'z', lock: null },
  { id: 'gears-roof', a: 'a4_gears', b: 'a4_roof', x: 155, z: -2, w: 2, axis: 'x', lock: { puzzle: 'P28' } },
];

// 守夜人從圖書館的樓梯下來；大家站在大廳中間
export const A4_SPAWN = { x: 108, z: 5, yaw: Math.PI };
// 單人被抓到時，在這一區的入口復活
export const CHECKPOINTS = {
  lib_entry: { x: 108, z: 5, yaw: -Math.PI / 2 },
  a4_pass: { x: 116, z: 7.75, yaw: -Math.PI / 2 },
  a4_gears: { x: 146.5, z: 7.75, yaw: -Math.PI / 2 },
  a4_nest: { x: 163.5, z: 2, yaw: Math.PI / 2 },
  a4_roof: { x: 155, z: -3.5, yaw: 0 },
};
export const NEST_SPOT = { x: 170, z: 2 };        // 被抓走的人被綁在這裡
export const NEST_EXIT = { x: 163.5, z: 2, yaw: Math.PI / 2 }; // 被救出來後站的地方（機械室這一側）

// 屋頂的符文石板（P29）：第 0 排在北邊（終點），第 5 排在南邊（起點）；每塊 1.6 公尺
export const ROOF = [
  'ᚠᛖᛗᛞᛚᚱ',
  'ᛟᚾᛚᛗᛁᛖ',
  'ᛁᛏᛖᚱᚾᚲ',
  'ᚱᛗᚾᛖᛚᚢ',
  'ᚷᛁᛚᛊᛁᛉ',
  'ᛁᛗᛒᚹᛗᚺ',
];
export const ROOF_AT = { x0: 150.2, z0: -40, tile: 1.6 }; // 石板左上角（西北）
export const roofCell = (x, z) => {
  const c = Math.floor((x - ROOF_AT.x0) / ROOF_AT.tile), r = Math.floor((z - ROOF_AT.z0) / ROOF_AT.tile);
  return c >= 0 && c < 6 && r >= 0 && r < 6 ? [c, r] : null;
};

// P26：四根拉桿各切換兩根門閂；一開始第 1、3 根鎖著（這是題目本身，不是答案）
export const LEVERS = { A: [1, 2], B: [2, 3], C: [3, 4], D: [1, 4] };
export const BOLTS_LOCKED = [1, 3];
// P27：驅動輪 12 齒、順時針；三根空軸。軸距（兩個齒輪的半徑加起來）是固定的，齒輪半徑＝齒數 ÷ 6
export const GEAR_RACK = [18, 24, 30, 36, 48];
export const AXLE_GAPS = [6, 7, 9];
// P28：牆上的童謠歌詞（第一句），長短符號只剩第 1、4、7 個字
export const LYRIC = L(['提', '著', '綠', '燈', '走', '長', '廊'], ['Green', 'lamp', 'glow', 'ing', 'down', 'the', 'hall']); // docs/06-audio-ch1.md
export const LYRIC_MARKS = { 0: 'L', 3: 'L', 6: 'L' };

export const A4_THINGS = [
  // ---- 入口大廳：躲藏點（書架縫） ----
  { id: 'hide_e1', room: 'lib_entry', kind: 'hide', x: 101, z: 3, size: [1, 2.2, 1.2], solid: false, label: L('書架之間的縫', 'A gap between shelves') },
  { id: 'hide_e2', room: 'lib_entry', kind: 'hide', x: 101, z: 13, size: [1, 2.2, 1.2], solid: false, label: L('書架之間的縫', 'A gap between shelves') },
  // ---- 旁邊通道 ----
  { id: 'hide_p1', room: 'a4_pass', kind: 'hide', x: 130, z: 8.2, size: [1, 2, 0.6], solid: false, label: L('牆上的壁龕', 'A niche in the wall') },
  { id: 'ironDoor', room: 'a4_pass', kind: 'puzzle', puzzle: 'P26', x: 144.6, z: 7.75, size: [0.3, 2.4, 1.4], solid: false, label: L('卡住的鐵門（四根拉桿）', 'The jammed iron door (four levers)') },
  // ---- 機械室 ----
  { id: 'gearwall', room: 'a4_gears', kind: 'puzzle', puzzle: 'P27', x: 158, z: 10, size: [3, 3, 1], y: 0.5, solid: true, label: L('鐘槌的齒輪組', 'The hammer’s gear train') },
  { id: 'pendulum', room: 'a4_gears', kind: 'puzzle', puzzle: 'P28', x: 155, z: -1.4, size: [2.4, 2.4, 0.4], solid: false, label: L('鐘擺室的出口（刻著童謠）', 'The pendulum-room exit (carved with the lullaby)') },
  { id: 'hide_g1', room: 'a4_gears', kind: 'hide', x: 146, z: 0, size: [1.2, 2, 0.8], solid: false, label: L('工具櫃', 'A tool cabinet') },
  { id: 'hide_g2', room: 'a4_gears', kind: 'hide', x: 146, z: 16, size: [1.2, 2, 0.8], solid: false, label: L('工具櫃', 'A tool cabinet') },
  { id: 'hide_g3', room: 'a4_gears', kind: 'hide', x: 164, z: 16, size: [1.2, 2, 0.8], solid: false, label: L('工具櫃', 'A tool cabinet') },
  { id: 'hide_g4', room: 'a4_gears', kind: 'hide', x: 152, z: 11.5, size: [1.4, 2, 1], solid: false, label: L('大齒輪後面', 'Behind a great gear') },
  { id: 'hide_g5', room: 'a4_gears', kind: 'hide', x: 160, z: 4, size: [1.4, 2, 1], solid: false, label: L('大齒輪後面', 'Behind a great gear') },
  // ---- 蝕巢：被綁住的同伴 ----
  { id: 'roots', room: 'a4_nest', kind: 'nest', x: 170, z: 2, size: [2.4, 2, 2.4], solid: false, label: L('纏住同伴的黑根', 'The black roots binding your friend') },
  // ---- 屋頂 ----
  { id: 'roofsign', room: 'a4_roof', kind: 'puzzle', puzzle: 'P29', panel: 'roofsign', x: 155, z: -28.5, size: [2, 0.6, 0.2], y: 0.2, solid: false, label: L('入口的刻字', 'Words carved at the entrance') },
  { id: 'hide_r1', room: 'a4_roof', kind: 'hide', x: 151.2, z: -20, size: [1.4, 2.5, 1.4], solid: false, label: L('煙囪後面', 'Behind a chimney') },
  { id: 'hide_r2', room: 'a4_roof', kind: 'hide', x: 158.8, z: -50, size: [1.4, 2.5, 1.4], solid: false, label: L('煙囪後面', 'Behind a chimney') },
];

// 守夜人的巡邏點（每一區幾個，他會在玩家所在的區域附近巡邏）
export const WARDEN_POINTS = {
  lib_entry: [[103, 3], [112, 3], [112, 12], [103, 12]],
  a4_pass: [[118, 7.75], [130, 7.75], [142, 7.75]],
  a4_gears: [[148, 2], [162, 2], [162, 15], [148, 15], [155, 8]],
  a4_roof: [[155, -6], [155, -24], [155, -46], [155, -58]],
};
export const WARDEN_START = { x: 107.5, z: 14.5, zone: 'lib_entry' };
// 守夜人的行動（docs/04-map-ch1.md）：速度以玩家走路 2.0、跑步 3.6 公尺／秒為準
export const WARDEN = {
  patrol: 1.4, chase: 3.24, view: 12, fov: 60, notice: 0.5, hearRun: 15, hearWalk: 6, lose: 4,
  reach: 1.1, findHidden: 1.5, stun: 2, repel: 5,
  calm: 40, hunt: 90, rest: 45, // 開場先走開 40 秒；之後找人 90 秒、回蝕巢 45 秒輪流（2026-10-22 製作人：一開始就追太難，玩家還要解謎）
};
