// 第三幕：沉眠圖書館（P11～P25）的場景與線索。依 docs/05-puzzles-ch1.md。這裡沒有答案（答案在伺服器）。
// 座標：圖書館在地底，跟地面的房間分開（x 從 100 開始）。下樓梯時直接傳送過來。
const L = (zh, en) => ({ zh, en });

export const LIB_ROOMS = [
  { id: 'lib_entry', name: L('沉眠圖書館・入口大廳', 'Slumbering Library — Entrance'), x: [100, 115], z: [0, 15], h: 7, floor: 'stone', light: '#7a6a5a' },
  { id: 'lib_maze', name: L('書架迷宮', 'The Shelf Maze'), x: [100, 130], z: [-30, 0], h: 8, floor: 'wood', light: '#6a5a4a' },
  { id: 'lib_reading', name: L('閱覽室', 'The Reading Room'), x: [120, 132], z: [-50, -30], h: 7, floor: 'wood', light: '#b08a5a' },
  { id: 'lib_ante', name: L('封印室前廳', 'The Seal Antechamber'), x: [121, 131], z: [-60, -50], h: 8, floor: 'stone', light: '#6a7ab0' },
  { id: 'lib_dark', name: L('暗室', 'The Dark Room'), x: [131, 137], z: [-58, -52], h: 4, floor: 'stone', light: '#000000', dark: true },
  { id: 'lib_well', name: L('井室', 'The Well Chamber'), x: [131, 139], z: [-66, -58], h: 9, floor: 'stone', light: '#4a5a7a' },
];

export const LIB_DOORS = [
  { id: 'entry-maze', a: 'lib_entry', b: 'lib_maze', x: 109, z: 0, w: 3, axis: 'x', lock: { puzzle: 'P12' } },
  { id: 'maze-reading', a: 'lib_maze', b: 'lib_reading', x: 127, z: -30, w: 3, axis: 'x', lock: { puzzle: 'P13' } },
  { id: 'reading-ante', a: 'lib_reading', b: 'lib_ante', x: 126, z: -50, w: 2.4, axis: 'x', lock: { segment: 'act3c' } },
  { id: 'ante-dark', a: 'lib_ante', b: 'lib_dark', x: 131, z: -55, w: 1.6, axis: 'z', lock: { puzzle: 'P18' } },
  { id: 'dark-well', a: 'lib_dark', b: 'lib_well', x: 134, z: -58, w: 1.6, axis: 'x', lock: { puzzle: 'P24' } },
];

export const LIB_SPAWNS = {
  act3a: { x: 107.5, z: 13.5, yaw: 0 },
  act3b: { x: 127, z: -31.5, yaw: 0 },
  act3c: { x: 126, z: -51.5, yaw: 0 },
  act4: { x: 135, z: -60, yaw: 0 },
};

// 書架迷宮：5×5 格、每格 6 公尺。'#'＝一整格的書架。每 30 秒熄燈一次，書架換位置：
// 第 1、3、5 排（由北往南數）往東移一格，第 2、4 排往西移一格，超出邊界就從另一邊出現（docs/05-puzzles-ch1.md P13）
export const MAZE = {
  x0: 100, z0: -30, cell: 6, period: 30, dark: 2.2,
  base: ['..###', '#..#.', '.....', '#.#..', '..###'],
  entry: [1, 4], exit: [4, 0],
};
export function mazeLayout(phase) {
  return MAZE.base.map((row, r) => { const k = r % 2 === 0 ? phase : -phase; return Array.from({ length: 5 }, (_, c) => row[(((c - k) % 5) + 5) % 5]).join(''); });
}

// P31：閱覽室裡五個娃娃的位置 [x, z, 面向]
export const DOLLS = [[120.8, -31.4, 2.4], [131.3, -41.8, -1.57], [120.8, -43.6, 1.57], [128.2, -49.3, 0], [126.6, -34.8, 3.14]];

export const LIB_THINGS = [
  // ---- 入口大廳（P11、P12） ----
  { id: 'cat', room: 'lib_entry', kind: 'prop', x: 103, z: 11, size: [0.6, 0.35, 0.3], solid: false, label: L('貓的屍體', 'A cat’s corpse'),
    text: L('一隻貓，身上長滿黑色的結晶。月晞：「它……身體裡面是空的。」', 'A cat, bristling with black crystals. Yuexi: “It’s… hollow inside.”') },
  { id: 'senior', room: 'lib_entry', kind: 'puzzle', puzzle: 'P11', panel: 'roster', x: 112, z: 4, size: [1.8, 0.5, 0.8], solid: true, label: L('去年搜救隊的高年級生', 'A senior from last year’s search party') },
  { id: 'notice', room: 'lib_entry', kind: 'puzzle', puzzle: 'P11', panel: 'notice', x: 100.4, z: 6, size: [0.2, 1.2, 1.4], y: 1, solid: false, label: L('搜救公告', 'The search notice') },
  { id: 'lampbox', room: 'lib_entry', kind: 'puzzle', puzzle: 'P11', x: 113.5, z: 2.2, size: [0.8, 0.6, 0.6], solid: true, label: L('上鎖的提燈箱', 'A locked lantern case') },
  { id: 'gate', room: 'lib_entry', kind: 'puzzle', puzzle: 'P12', x: 109, z: 0.4, size: [3, 2.6, 0.3], solid: false, label: L('柵門的元素鎖', 'The gate’s element lock') },
  // 站在標記上「調查」＝舉起提燈照柵門（打開柵門的元素鎖）
  { id: 'mark', room: 'lib_entry', kind: 'puzzle', puzzle: 'P12', x: 109, z: 5, size: [0.6, 0.02, 0.6], solid: false, label: L('地上的圓形標記（面對柵門）', 'A round mark on the floor (facing the gate)') },
  // ---- 書架迷宮（P13、P14）：書架方塊由 library.mjs 依 MAZE 畫 ----
  { id: 'ladder', room: 'lib_entry', kind: 'overview', x: 104, z: 1.5, size: [0.8, 3, 0.8], solid: true, label: L('梯子：從高處看整個迷宮', 'Ladder: look down over the maze') },
  { id: 'sign', room: 'lib_entry', kind: 'prop', x: 112.5, z: 0.4, size: [1.4, 0.8, 0.1], y: 1.4, solid: false, label: L('牆上的告示', 'A sign on the wall'),
    text: L('「奇數排向晨，偶數排向暮。」', '“Odd rows face the dawn, even rows face the dusk.”') },
  { id: 'note1', room: 'lib_maze', kind: 'note', note: 1, x: 103, z: -15, size: [0.4, 0.05, 0.3], solid: false, label: L('地上的紙頁', 'A page on the floor') },
  { id: 'note2', room: 'lib_maze', kind: 'note', note: 2, x: 127, z: -9, size: [0.4, 0.05, 0.3], solid: false, label: L('地上的紙頁', 'A page on the floor') },
  { id: 'books', room: 'lib_maze', kind: 'puzzle', puzzle: 'P14', x: 115, z: -15, size: [2.4, 1.2, 0.8], solid: false, label: L('有編號的書（書背上寫著號碼）', 'Numbered books (numbers on the spines)') },
  // ---- 閱覽室（P15、P16、P17） ----
  // P31 哭泣的娃娃：吹熄第七張桌上的油燈，黑暗中循哭聲找到正在哭的那一個（娃娃的模型由 world/weeping.mjs 擺）
  { id: 'sob_lamp', hidden: true, room: 'lib_reading', kind: 'puzzle', puzzle: 'P31', panel: 'sobLamp', x: 129.5, z: -44.1, size: [0.4, 0.5, 0.4], y: 0.8, solid: false,
    label: L('桌上的油燈：吹熄它', 'The oil lamp on the table: blow it out') },
  ...DOLLS.map(([x, z], i) => ({ id: `doll${i}`, hidden: true, room: 'lib_reading', kind: 'doll', doll: i, x, z, size: [0.6, 0.6, 0.6], solid: false,
    label: L('縫補過的娃娃：抱起來', 'A stitched-up doll: pick it up') })),
  { id: 'crystal', room: 'lib_reading', kind: 'puzzle', puzzle: 'P15', panel: 'recording', x: 123, z: -36, size: [0.6, 1.2, 0.6], solid: true, label: L('留聲水晶', 'The echo crystal') },
  { id: 'desk7', room: 'lib_reading', kind: 'puzzle', puzzle: 'P15', x: 129, z: -44, size: [1.6, 0.8, 0.9], solid: true, label: L('第七張桌子的抽屜', 'The drawer of the seventh table') },
  { id: 'flipbook', room: 'lib_reading', kind: 'puzzle', puzzle: 'P16', x: 123, z: -46, size: [0.8, 0.9, 0.6], solid: true, label: L('自己翻頁的書', 'A book turning its own pages') },
  { id: 'eastern', room: 'lib_reading', kind: 'puzzle', puzzle: 'P17', x: 131.4, z: -34, size: [0.4, 2, 1.6], solid: false, label: L('「東方典藏」櫃的抽屜', 'The “Eastern Collection” cabinet drawer') },
  { id: 'familychart', room: 'lib_reading', kind: 'puzzle', puzzle: 'P17', panel: 'trigrams', x: 131.4, z: -38, size: [0.3, 1.2, 1.2], y: 1, solid: false, label: L('破損的《八卦家族圖》', 'The damaged “Trigram Family Chart”') },
  { id: 'letter', room: 'lib_reading', kind: 'letter', x: 121, z: -31.5, size: [0.6, 0.6, 0.6], solid: false, label: L('月晞的行李：家書', 'Yuexi’s bag: a letter from home') },
  // ---- 封印室前廳（P18～P23） ----
  { id: 'runedoor', room: 'lib_ante', kind: 'puzzle', puzzle: 'P18', x: 130.6, z: -55, size: [0.3, 3, 2.4], solid: false, label: L('刻滿盧恩符文的大門', 'The great door carved with runes') },
  { id: 'mirrors', room: 'lib_ante', kind: 'puzzle', puzzle: 'P19', x: 124, z: -57, size: [2, 1.2, 2], solid: false, label: L('月光與鏡座', 'Moonlight and mirror stands') },
  { id: 'statues', room: 'lib_ante', kind: 'puzzle', puzzle: 'P20', x: 128, z: -58.5, size: [2, 1.5, 1.4], solid: false, label: L('四座石像鬼', 'Four gargoyles') },
  { id: 'scale', room: 'lib_ante', kind: 'puzzle', puzzle: 'P21', x: 123, z: -52, size: [1.4, 1.1, 0.8], solid: true, label: L('煉金天平與九瓶藥劑', 'The alchemist’s balance and nine vials') },
  { id: 'badge', room: 'lib_ante', kind: 'puzzle', puzzle: 'P22', x: 121.6, z: -59.2, size: [0.4, 0.2, 0.4], solid: false, label: L('角落裡發亮的東西', 'Something glinting in the corner'), cyril: true },
  { id: 'sketch', room: 'lib_ante', kind: 'puzzle', puzzle: 'P23', panel: 'sketch', x: 128, z: -50.4, size: [1.6, 1.4, 0.2], y: 1, solid: false, label: L('莉安娜的速寫（畫在鏡子上）', 'Liana’s sketch (painted on a mirror)') },
  { id: 'braille', room: 'lib_ante', kind: 'puzzle', puzzle: 'P24', panel: 'brailletable', x: 121.4, z: -54, size: [0.3, 1.4, 1.4], y: 0.6, solid: false, label: L('書架上的點字表', 'A braille chart on the shelf') },
  { id: 'ball', room: 'lib_ante', kind: 'puzzle', puzzle: 'P23', panel: 'crystalball', x: 129.5, z: -52, size: [0.6, 1.1, 0.6], solid: true, label: L('水晶球：看見暗室裡面', 'Crystal ball: see inside the dark room') },
  // ---- 暗室（P23、P24） ----
  { id: 'tiles', room: 'lib_dark', kind: 'puzzle', puzzle: 'P23', x: 136.6, z: -55, size: [0.3, 2, 2], solid: false, label: L('牆上的 4×4 石板', 'The 4×4 stone panel on the wall') },
  { id: 'exitdoor', room: 'lib_dark', kind: 'puzzle', puzzle: 'P24', x: 134, z: -57.6, size: [1.6, 2.4, 0.3], solid: false, label: L('門把上有凸點', 'Raised dots on the door handle') },
  { id: 'note4', room: 'lib_dark', kind: 'note', note: 4, x: 132, z: -53, size: [0.4, 0.05, 0.3], solid: false, label: L('角落的紙頁', 'A page in the corner') },
  // ---- 井室（P25） ----
  { id: 'well', room: 'lib_well', kind: 'puzzle', puzzle: 'P25', x: 135, z: -63, size: [3, 1, 3], solid: true, label: L('井蓋上的三個圓環', 'Three rings on the well cover') },
];

// P11：搜救名單（血跡蓋住的寫成 ▒）與公告上的生還者
export const ROSTER = [
  ['1', L('羅文・艾許', 'Rowan Ash')], ['2', L('莉安娜（名字被劃掉）', 'Liana (name struck through)')], ['3', L('貝絲・克羅', 'Beth Crow')],
  ['4', L('▒▒・▒▒', '▒▒▒▒ ▒▒▒')], ['5', L('崔斯坦・費爾', 'Tristan Fell')], ['6', L('諾拉・溫', 'Nora Wynn')], ['7', L('歐登・格雷（握著提燈的人）', 'Odin Grey (the one holding the lantern)')],
];
export const SURVIVORS = L('搜救公告：搜救隊七人，四人生還——羅文・艾許、貝絲・克羅、梅芙・朗恩、諾拉・溫。', 'SEARCH NOTICE: Seven went in; four came back — Rowan Ash, Beth Crow, Maeve Long, Nora Wynn.');
// 名單上 4 號被血蓋住，但公告上多了「梅芙・朗恩」，所以 4 號是她（生還）

// 莉安娜的筆記（7 頁，第一章找得到 4 頁）
export const NOTES = {
  1: L('「學校每天都在抽我們的魔力。我量過了。」\n頁邊寫著：12-3-7、4-41-2', '“The school drains our magic every day. I measured it.”\nIn the margin: 12-3-7, 4-41-2, 9-88-15'),
  2: L('「鐘塔不是鐘塔。銜尾蛇的人在找第十三響。」\n頁邊寫著：9-88-15、4-41-9\n角落：「古書稱它為 B _ I _ H _。」', '“The clock tower is not a clock tower. The serpent’s people are looking for the thirteenth bell.”\nIn the margin: 4-41-9, 7-19-4, 2-57-11\nIn the corner: “Old books call it B _ I _ H _.”'),
  3: L('「如果有人找到這裡……燈亮的時候讀書，熄燈的時候別動。」', '“If anyone finds this… read while the lamps are lit, and don’t move when they go out.”'),
  4: L('「第一環：四個時辰相加。第二環：創辦人治校的年數。第三環：沒有回來的人。數到十三，就從零重新開始。」\n最後一行字跡很亂：「我的手好癢。」', '“First ring: add the four hours. Second ring: the years the founder ruled. Third ring: those who never came back. Count to thirteen, then start again from zero.”\nThe last line is a scrawl: “My hand itches so much.”'),
};

// P14：書本密碼的格式說明（筆記角落）
export const BOOK_RULE = L('數字的意思：第幾號書－第幾頁－第幾個字（書背上有號碼，1～12 號）。「燈亮時讀。」', 'The numbers mean: book – page – word (books are numbered 1–12 on their spines). “Read while the lamps are lit.”');

// P16：自己翻頁的書，一直重複這幾頁
export const FLIP_PAGES = ['II', 'III', 'V', 'IX', 'XVII'];

// P17：月晞的家書、破損的八卦家族圖（被蟲蛀的寫成 ▒）
export const LETTER = L('「若迷失於異鄉書庫，記得：父親在上，小女兒在下，按此而行。——母字」', '“If you are ever lost in a foreign library, remember: father above, youngest daughter below. Follow this. — Mother”');
export const TRIGRAMS = [
  ['☰', L('乾＝父', 'Qian = Father')], ['☷', L('坤＝母', 'Kun = Mother')], ['☳', L('震＝長男', 'Zhen = Eldest son')], ['☵', L('坎＝▒', 'Kan = ▒')],
  ['☶', L('艮＝少男', 'Gen = Youngest son')], ['☴', L('巽＝長女', 'Xun = Eldest daughter')], ['☲', L('▒＝中女', '▒ = Middle daughter')], ['☱', L('兌＝少女', 'Dui = Youngest daughter')],
];

// P18：古弗薩克 24 個符文（id＝對應的拉丁字母）。P16 拿到的「符文表殘頁」才看得到字母
export const RUNES = [['ᚠ', 'f'], ['ᚢ', 'u'], ['ᚦ', 'th'], ['ᚨ', 'a'], ['ᚱ', 'r'], ['ᚲ', 'k'], ['ᚷ', 'g'], ['ᚹ', 'w'], ['ᚺ', 'h'], ['ᚾ', 'n'], ['ᛁ', 'i'], ['ᛃ', 'j'],
  ['ᛇ', 'ei'], ['ᛈ', 'p'], ['ᛉ', 'z'], ['ᛋ', 's'], ['ᛏ', 't'], ['ᛒ', 'b'], ['ᛖ', 'e'], ['ᛗ', 'm'], ['ᛚ', 'l'], ['ᛜ', 'ng'], ['ᛞ', 'd'], ['ᛟ', 'o']];
export const RUNE_DOOR = L('門上的字：「以那吞噬魔力之物的古名開啟。」下面有 6 個空格。', 'Carved on the door: “Open in the old name of the thing that devours magic.” Below it, six empty slots.');

// P19：月光反射（6×6）。'W'＝窗（光從這裡往東射出）、'C'＝水晶、'#'＝石柱、數字＝鏡座 1～4（鏡座 4 要放銀色小鏡子）
export const LIGHT_GRID = ['W..1..', '#.....', '3..2..', '.#....', '4....C', '..#...'];
// 每座鏡子可以轉成 '/' 或 '\\'（或空著）。光碰到 '/'：往東→往北、往北→往東、往西→往南、往南→往西；碰到 '\\'：往東→往南、往南→往東、往西→往北、往北→往西

// P20：推石像（推箱子）。'#'＝牆、'B'＝石像、'T'＝標記、'P'＝玩家起點
export const SOKOBAN = ['#######', '#P....#', '#.B.B.#', '#.T.T.#', '#.B.B.#', '#.T.T.#', '#######'];

// P21：九瓶藥劑的煉金符號（只有烏洛波斯看得懂名稱）
export const VIALS = [['🜍', L('硫磺', 'Sulfur')], ['☿', L('水銀', 'Mercury')], ['🜔', L('鹽', 'Salt')], ['🜂', L('火', 'Fire')], ['🜄', L('水', 'Water')],
  ['🜁', L('風', 'Air')], ['🜃', L('土', 'Earth')], ['☉', L('金', 'Gold')], ['☽', L('銀', 'Silver')]];

// P23：前廳牆上（畫在鏡子上的）銜尾蛇路線：鏡中的順序（格子編號：第一排 1～4、第二排 5～8…）＋音高（1 最低、4 最高）
export const SKETCH = { path: [4, 7, 10, 13, 14, 15, 16], pitches: [1, 2, 3, 4, 3, 2, 1] };

// P24：點字（字母 a～z 的 6 點表，前廳的對照表用）。門把上的 4 格由伺服器提供（peek）
export const BRAILLE = { a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5], p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6] };
