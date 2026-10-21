// 第一章的場景配置（第 2 批：序幕＋第一幕）。格式說明見 docs/08-world-format.md。
// 這裡只有位置、標籤、題目內容（給玩家看的線索），沒有答案；答案在伺服器。
// 座標：公尺。x 往東、z 往南（北邊是 -z）；yaw＝面向（0 是朝北）。

const L = (zh, en) => ({ zh, en });

export const ROOMS = [
  // ---- 序幕：碼頭 → 大廳 → 典禮廳（開學晚宴） ----
  { id: 'dock', name: L('黑湖碼頭', 'Black Lake Dock'), x: [-6, 6], z: [140, 170], h: 12, floor: 'wood', sky: true, light: '#6a7aa8' },
  { id: 'hall', name: L('大廳', 'Great Hall'), x: [-10, 10], z: [110, 140], h: 15, floor: 'stone', light: '#ffcf8a' },
  { id: 'banquet', name: L('典禮廳', 'Ceremony Hall'), x: [-34, -10], z: [102, 148], h: 14, floor: 'wood', light: '#ffb85c' },
  // ---- 第一幕：星盤廳與四座宿舍 ----
  { id: 'starhall', name: L('星盤廳', 'Astrolabe Hall'), x: [-9, 9], z: [-9, 9], h: 10, floor: 'stone', light: '#7f8fd0' },
  { id: 'dorm_eldrin', name: L('艾爾德林交誼廳', 'Eldrin Common Room'), x: [9, 23], z: [-7, 7], h: 6, floor: 'wood', light: '#9fc4ff', house: 'eldrin' },
  { id: 'dorm_grimoire', name: L('格里莫瓦交誼廳', 'Grimoire Common Room'), x: [-23, -9], z: [-7, 7], h: 6, floor: 'wood', light: '#ff8a6a', house: 'grimoire' },
  { id: 'dorm_belmont', name: L('貝爾蒙特交誼廳', 'Belmont Common Room'), x: [-9, 0], z: [9, 23], h: 6, floor: 'wood', light: '#ffd27a', house: 'belmont' },
  { id: 'dorm_ouroboros', name: L('烏洛波斯交誼廳', 'Ouroboros Common Room'), x: [0, 9], z: [9, 23], h: 5, floor: 'stone', light: '#6fd0a0', house: 'ouroboros' },
  // ---- 第二幕（第 3 批）：北邊的門先鎖著 ----
  { id: 'north_hall', name: L('往北翼的走廊', 'Corridor to the North Wing'), x: [-2.5, 2.5], z: [-25, -9], h: 6, floor: 'stone', light: '#5a5a7a' },
];

// 門：位在兩個房間共用的牆上。axis＝門所在那面牆的方向（'x'＝東西向的牆，'z'＝南北向的牆）
// lock：
//   null                  一直開著
//   { puzzle: 'P03' }     解開這題才開
//   { segment: 'act2' }   進到這一段才開
export const DOORS = [
  { id: 'dock-hall', a: 'dock', b: 'hall', x: 0, z: 140, w: 4, axis: 'x', lock: null },
  { id: 'hall-banquet', a: 'hall', b: 'banquet', x: -10, z: 125, w: 4, axis: 'z', lock: null },
  { id: 'eldrin-star', a: 'dorm_eldrin', b: 'starhall', x: 9, z: 0, w: 2.4, axis: 'z', lock: { puzzle: 'P03' } },
  { id: 'grimoire-star', a: 'dorm_grimoire', b: 'starhall', x: -9, z: 0, w: 2.4, axis: 'z', lock: { puzzle: 'P04' } },
  { id: 'belmont-star', a: 'dorm_belmont', b: 'starhall', x: -4.5, z: 9, w: 2.4, axis: 'x', lock: { puzzle: 'P05' } },
  { id: 'ouroboros-star', a: 'dorm_ouroboros', b: 'starhall', x: 4.5, z: 9, w: 2.4, axis: 'x', lock: { puzzle: 'P06' } },
  { id: 'star-north', a: 'starhall', b: 'north_hall', x: 0, z: -9, w: 3, axis: 'x', lock: { segment: 'act2' } },
];

// 每一段開始時站的位置。第一幕依自己角色的學院，從自己的宿舍出發
export const SPAWNS = {
  prologue: { x: 0, z: 165, yaw: 0 },
  act1: {
    eldrin: { x: 20, z: 0, yaw: Math.PI / 2 },
    grimoire: { x: -20, z: 0, yaw: -Math.PI / 2 },
    belmont: { x: -4.5, z: 20, yaw: 0 },
    ouroboros: { x: 4.5, z: 20, yaw: 0 },
  },
  act2: { x: 0, z: -12, yaw: 0 },
};

// 場景裡可以調查的東西。kind：
//   prop    擺設（可以調查，會顯示 text）
//   rumor   傳聞（P02，走到旁邊才聽得到）
//   puzzle  打開謎題畫面（puzzle＝題號）
//   hide    躲藏點（站在裡面，赫爾嘉夫人看不到）
//   pillar  柱子（擋視線）
// size：[寬, 高, 深]；solid：會擋路
export const THINGS = [
  // 碼頭
  { id: 'boat', room: 'dock', kind: 'prop', x: 0, z: 168, size: [3, 1.2, 6], solid: true, label: L('渡船', 'The ferry'),
    text: L('載新生過湖的船。湖水黑得看不見底，對岸的鐘塔在最高處。', 'The ferry that brought the first-years across. The water is black; the clock tower stands above it all.') },
  // 大廳
  { id: 'mirror', room: 'hall', kind: 'prop', x: 0, z: 118, size: [2.2, 3.4, 0.4], solid: true, label: L('分院鏡', 'The Sorting Mirror'),
    text: L('鏡面很冷。你好像看到鏡子裡的自己，慢了半拍才眨眼。', 'The glass is cold. Your reflection seems to blink half a beat late.') },
  // 典禮廳：四張長桌（P02 的傳聞）
  ...[0, 1, 2, 3].map((i) => ({
    id: `table${i + 1}`, room: 'banquet', kind: 'rumor', x: -30 + i * 5.5, z: 125, size: [1.6, 0.8, 30], solid: true,
    label: L(`第 ${i + 1} 張長桌`, `Table ${i + 1}`), rumor: i,
  })),
  { id: 'seat', room: 'banquet', kind: 'puzzle', puzzle: 'P02', x: -14, z: 141, size: [0.8, 1, 0.8], solid: false,
    label: L('你的座位：整理聽到的傳聞', 'Your seat: piece the rumors together') },
  { id: 'podium', room: 'banquet', kind: 'prop', x: -22, z: 105, size: [3, 1.4, 1], solid: true, label: L('教師席', 'High table'),
    text: L('校長、副校長和教授們坐在這裡。魔藥學教授一直盯著你們這邊。', 'The headmaster, the vice-principal and the professors sit here. The potions professor keeps staring your way.') },

  // 艾爾德林：星座鎖（P03）
  { id: 'lock_eldrin', room: 'dorm_eldrin', kind: 'puzzle', puzzle: 'P03', x: 9.4, z: 0, size: [0.3, 2.4, 2.4], solid: false, house: 'eldrin',
    label: L('門上的星座鎖', 'The constellation lock') },
  { id: 'ceiling_eldrin', room: 'dorm_eldrin', kind: 'prop', x: 16, z: 0, size: [0.5, 0.1, 0.5], y: 5.9, solid: false, look: 'ceiling',
    label: L('天花板的星空', 'The painted ceiling'),
    text: L('十二個星座排成一圈，像時鐘：1 點牡羊、2 點金牛、3 點雙子、4 點巨蟹、5 點獅子、6 點處女、7 點天秤、8 點天蠍、9 點射手、10 點摩羯、11 點水瓶、12 點雙魚。',
      'Twelve constellations in a ring, like a clock: 1 Aries, 2 Taurus, 3 Gemini, 4 Cancer, 5 Leo, 6 Virgo, 7 Libra, 8 Scorpio, 9 Sagittarius, 10 Capricorn, 11 Aquarius, 12 Pisces.') },
  // 格里莫瓦：盧恩符文鎖（P04）
  { id: 'lock_grimoire', room: 'dorm_grimoire', kind: 'puzzle', puzzle: 'P04', x: -9.4, z: 0, size: [0.3, 2.4, 2.4], solid: false, house: 'grimoire',
    label: L('門上的符文鎖', 'The rune lock') },
  { id: 'runechart', room: 'dorm_grimoire', kind: 'puzzle', puzzle: 'P04', panel: 'runechart', x: -22.6, z: -3, size: [0.3, 1.6, 2.4], solid: false, house: 'grimoire',
    label: L('燒焦的符文表', 'The scorched rune chart') },
  // 貝爾蒙特：獵物天平（P05）
  { id: 'scale', room: 'dorm_belmont', kind: 'puzzle', puzzle: 'P05', x: -4.5, z: 12, size: [1.6, 1.2, 1], solid: true, house: 'belmont',
    label: L('門邊的大秤', 'The great scale by the door') },
  { id: 'huntlog', room: 'dorm_belmont', kind: 'prop', x: -8.4, z: 17, size: [0.6, 1, 0.8], solid: true, label: L('狩獵日誌', 'The hunting log'),
    text: L('熊掌和狼頭加鹿角一樣重。兩顆野豬牙和熊掌一樣重。鹿角比野豬牙輕一斤。四件放在一起，剛好十五斤。',
      'The bear paw weighs as much as the wolf head and the antler together. Two boar tusks weigh as much as the bear paw. The antler is one pound lighter than a tusk. All four together weigh exactly fifteen pounds.') },
  // 烏洛波斯：沙漏鎖（P06）
  { id: 'hourglass', room: 'dorm_ouroboros', kind: 'puzzle', puzzle: 'P06', x: 4.5, z: 12, size: [1.2, 1.1, 0.8], solid: true, house: 'ouroboros',
    label: L('兩個沙漏', 'Two hourglasses') },
  // 每間宿舍都有窗戶：P07（電腦控制的同伴從別的塔傳燭光過來）
  ...['eldrin', 'grimoire', 'belmont', 'ouroboros'].map((h) => {
    const r = { eldrin: [22.6, -4], grimoire: [-22.6, 4], belmont: [-8.6, 21], ouroboros: [8.6, 21] }[h];
    return { id: `window_${h}`, room: `dorm_${h}`, kind: 'puzzle', puzzle: 'P07', x: r[0], z: r[1], size: [0.3, 1.8, 1.4], y: 1.2, solid: false,
      label: L('窗戶：派使魔去看別的塔', 'Window: send your familiar to the other towers'), needsAi: true };
  }),
  // 星盤廳：星盤（P08）、柱子、窗簾
  { id: 'disk', room: 'starhall', kind: 'puzzle', puzzle: 'P08', x: 0, z: 0, size: [5, 0.3, 5], solid: false, label: L('星盤', 'The astrolabe') },
  ...[[-5, -5], [5, -5], [-5, 5], [5, 5]].map(([x, z], i) => ({ id: `pillar${i}`, room: 'starhall', kind: 'pillar', x, z, size: [1.2, 10, 1.2], solid: true })),
  ...[[-8.3, -4], [8.3, 4]].map(([x, z], i) => ({ id: `curtain${i}`, room: 'starhall', kind: 'hide', x, z, size: [1, 3, 2], solid: false, label: L('厚窗簾後面', 'Behind the heavy curtain') })),
  { id: 'north_door', room: 'starhall', kind: 'prop', x: 0, z: -8.6, size: [3, 3, 0.3], solid: false, label: L('往北翼的門', 'The door to the North Wing'),
    text: L('門很重，上面沒有鎖孔，只有四個學院的徽章。', 'A heavy door with no keyhole — only the crests of the four houses.') },
];

// P02：四張長桌各聽得到兩段半句話（有兩段是編的）
export const RUMORS = [
  [L('「去年有個學姊……」', '“Last year a senior girl…”'), L('「……南翼的地窖……」', '“…the cellar in the south wing…”')],
  [L('「……在北翼不見了。」', '“…vanished in the North Wing.”'), L('「守夜人的燈……」', '“The Night Warden’s lamp…”')],
  [L('「……是綠色的。」', '“…is green.”'), L('「鐘塔敲了……」', '“The clock tower rang…”')],
  [L('「……十三下的那天晚上。」', '“…thirteen times, that night.”'), L('「……藏著一隻龍。」', '“…has a dragon hidden in it.”')],
];

// 赫爾嘉夫人：沿著星盤廳巡邏（第一幕）。位置由「這一段開始的時間」算出來，所有人看到的一樣，不用傳訊息
export const PATROL = {
  room: 'starhall', period: 44, // 走一圈幾秒
  path: [[-7, -7], [7, -7], [7, 7], [-7, 7]],
  view: 8, fov: 60, // 提燈照得到的距離（公尺）、角度
  hearRun: 6, hearWalk: 3, // 跑步、走路多近會被聽到
};
