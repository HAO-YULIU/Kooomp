// 第一章謎題的答案與提示（伺服器專用，不會發佈到網頁）。內容依 docs/05-puzzles-ch1.md。
// kind：
//   text   文字答案，ans 可以是字串或字串陣列（任一個都算對）；可依謎題語言分 zh / en
//   set    多個關鍵詞，順序不限
//   seq    依序的選項（逗號分隔的 id），ans 可以是陣列（任一組都算對）
//   event  畫面上的操作（迷宮、推石像、光線…），由畫面回報完成，伺服器只記錄
//   hourglass / balance / levers / corridor  需要伺服器模擬的題目（見 server/judge.mjs）
// house：多人時只有這個學院的玩家能作答（單人不限）
// solo / multi：只在單人或多人時出現
// reveal：解開後只告訴作答者的資訊（例如宿舍門鎖的「時辰」，要自己轉告隊友）
// gather：要全隊都站在這個區域才能作答
// gives：解開後全隊拿到的東西（道具、莉安娜的筆記）；needs：要先有這個道具才能作答
// diff：難度（6～10）；score:false 表示不計入難度比例
// 數字題的 ans 一律寫成字串（作答時會先正規化）

const H = (zh, en) => ({ zh, en }); // 三張提示便條

export const CHAPTER1 = {
  P01: { seg: 'prologue', diff: 0, score: false, kind: 'event' },

  P02: {
    seg: 'prologue', diff: 6, kind: 'set',
    ans: { zh: [['北翼'], ['綠燈', '綠色', '綠色的燈', '綠'], ['十三', '13', '十三下', '第十三響']],
           en: [['NORTH WING', 'NORTH'], ['GREEN LAMP', 'GREEN', 'GREEN LIGHT'], ['THIRTEEN', '13']] },
    hints: H(['每句傳聞都被切成兩半，聽不同桌子的人說。', '有兩段話跟大家說的對不上，那是編的。', '地點是北翼；燈是綠色的；鐘敲了十三下。'],
             ['Every rumor was cut in half — listen to different tables.', 'Two pieces don’t match what everyone else says. Those are made up.', 'The place is the North Wing; the lamp is green; the bell rang thirteen times.']),
  },

  P03: {
    seg: 'act1', diff: 6, kind: 'text', house: 'eldrin', ans: 'scorpio', reveal: '8',
    hints: H(['門上好像寫了什麼，但看不見。試試用光照咒。', '天花板的星座像時鐘一樣排，每個星座在一個點鐘的位置。', '獅子在 5 點，往後數三位是 8 點；金牛在 2 點，正對面也是 8 點。8 點是天蠍。'],
             ['Something is written on the door, but you can’t see it. Try the light spell.', 'The constellations on the ceiling are arranged like a clock face.', 'Leo is at 5; three after it is 8. Taurus is at 2; directly opposite is also 8. 8 is Scorpio.']),
  },
  P04: {
    seg: 'act1', diff: 7, kind: 'text', house: 'grimoire', ans: '11', reveal: '11',
    hints: H(['符文表每排 8 個，一共 3 排。', '第二族的第一個是冰雹 ᚺ。從它開始往後數。', '第二族：ᚺ（第 9）、ᚾ（第 10）、ᛁ（第 11）。'],
             ['The rune table has 3 rows of 8.', 'The second aett begins with Hagalaz ᚺ. Count from there.', 'Second aett: ᚺ (9th), ᚾ (10th), ᛁ (11th).']),
  },
  P05: {
    seg: 'act1', diff: 7, kind: 'text', house: 'belmont', ans: '9', reveal: '9',
    hints: H(['先設野豬牙的重量，其他三件都可以用它表示。', '鹿角＝野豬牙－1，熊掌＝野豬牙×2，狼頭＝熊掌－鹿角。', '野豬牙是 3 斤。四件裡最重的是熊掌 6 斤，15－6＝9。'],
             ['Call the boar tusk’s weight x. The other three can be written using x.', 'Antler = tusk − 1, bear paw = tusk × 2, wolf head = paw − antler.', 'The tusk weighs 3. The heaviest is the paw (6). 15 − 6 = 9.']),
  },
  P06: {
    seg: 'act1', diff: 8, kind: 'hourglass', house: 'ouroboros', glasses: [7, 11], target: 15, ans: '3',
    hints: H(['15＝11＋4。想辦法量出 4 分鐘。', '11 分的漏完時，7 分的那一個已經重新漏了 4 分鐘。', '一起翻 → 7 分漏完就翻 → 11 分漏完時再翻 7 分 → 它漏完就是第 15 分。'],
             ['15 = 11 + 4. Find a way to measure 4 minutes.', 'When the 11-minute glass runs out, the 7-minute glass has been running again for 4 minutes.', 'Start both → flip the 7 when it empties → when the 11 empties, flip the 7 again → when it empties, it’s minute 15.']),
  },
  P07: {
    seg: 'act1', diff: 7, kind: 'hours', // 由電腦控制的同伴（沒有玩家選的角色）用燭光傳來他們的時辰；全員都是玩家時不需要
    hints: H(['長的光是「－」，短的光是「・」。', '每個數字是 5 個符號。11 會分成兩次。', '對照書桌上的表，例如 －－－・・ 是 8。'],
             ['A long flash is “–”, a short flash is “·”.', 'Each digit is 5 symbols. 11 comes as two digits.', 'Check the table on the desk: – – – · · is 8.']),
  },
  P08: {
    seg: 'act1', diff: 8, kind: 'seq', gather: 'starhall', ans: 'grimoire:11,ouroboros:3,belmont:9,eldrin:8',
    hints: H(['先決定四個環的順序，再轉時辰。星辰＝艾爾德林、書頁＝格里莫瓦、獵犬＝貝爾蒙特、銜尾＝烏洛波斯。', '艾爾德林在最外圈。剩下三圈裡，烏洛波斯要比貝爾蒙特更內側。', '由內到外：格里莫瓦、烏洛波斯、貝爾蒙特、艾爾德林。'],
             ['Order the rings first, then set the hours. Stars = Eldrin, pages = Grimoire, hound = Belmont, serpent = Ouroboros.', 'Eldrin is outermost. Of the rest, Ouroboros must be inside Belmont.', 'Inner to outer: Grimoire, Ouroboros, Belmont, Eldrin.']),
  },

  P09: {
    seg: 'act2', diff: 8, kind: 'corridor', streak: 8, rate: 0.6,
    hints: H(['第一趟一定正常，好好記住正常的樣子。', '每一趟最多只有一個異常。注意燭台、畫、地上和聲音。', '這一趟要特別注意：{focus}'],
             ['The first walk is always normal. Memorize it.', 'Each walk has at most one anomaly. Watch the candles, paintings, floor and sounds.', 'On this walk, pay attention to: {focus}']),
  },
  P10: {
    seg: 'act2', diff: 7, kind: 'text', ans: 'NW|1626',
    hints: H(['熄燈的時候看看所有畫像在看哪裡。', '第二任校長的銘牌提到了創辦人的在位年數。', '1659－33＝1626。'],
             ['When the lights go out, see where every portrait is looking.', 'The second headmaster’s plaque mentions how long the founder served.', '1659 − 33 = 1626.']),
  },

  P11: {
    seg: 'act3a', diff: 6, kind: 'text', ans: '257', gives: 'lantern',
    hints: H(['公告上有生還者的名字。', '名單上不在公告裡的人，就是沒有回來的人。', '沒有回來的是 2、5、7 號。'],
             ['The notice lists the survivors.', 'Whoever is on the roster but not on the notice never came back.', 'Numbers 2, 5 and 7 never came back.']),
  },
  P12: {
    seg: 'act3a', diff: 6, kind: 'seq', ans: 'wind,fire,earth,water', needs: 'lantern',
    hints: H(['柵門的裝飾看起來沒有意義，但它的影子有。', '地上有一個小小的圓形標記，站在那裡照。', '影子由左到右是風、火、土、水。'],
             ['The gate’s ornaments mean nothing — their shadows do.', 'There’s a small round mark on the floor. Shine from there.', 'Left to right the shadows are wind, fire, earth, water.']),
  },
  P13: {
    seg: 'act3a', diff: 8, kind: 'event',
    hints: H(['熄燈時，書架不是亂動，而是整排一起移動。', '「晨」是太陽升起的方向，「暮」是太陽落下的方向。', '第 1、3、5 排往東移一格，第 2、4 排往西移一格。'],
             ['When the lights go out, the shelves move a whole row at a time.', 'Dawn is where the sun rises; dusk is where it sets.', 'Rows 1, 3, 5 shift one step east; rows 2 and 4 shift one step west.']),
  },
  P14: {
    seg: 'act3a', diff: 9, kind: 'text',
    ans: { zh: '鐘在井底', en: 'THE BELL LIES IN THE WELL' },
    hints: H(['每組三個數字：書、頁、字。', '書的編號在書背上。書架移動時，要在燈亮的時候找。', '解出來是四個字：鐘、在、井、底。'],
             ['Each group of numbers is: book, page, word.', 'Book numbers are on the spines. Read them while the lights are on.', 'It decodes to: THE BELL LIES IN THE WELL.']),
  },
  P15: {
    seg: 'act3b', diff: 8, kind: 'text', ans: '3141', gives: 'note3',
    hints: H(['聲音太快了，而且好像是反過來的。', '兩個轉盤都要調。', '反轉，速度 0.5 倍。'],
             ['It’s too fast — and it sounds backwards.', 'You need to set both dials.', 'Reverse, at 0.5× speed.']),
  },
  P16: {
    seg: 'act3b', diff: 7, kind: 'text', ans: ['33', 'XXXIII'], gives: 'chartpage',
    hints: H(['先把羅馬數字換成數字：2、3、5、9、17。', '每一個數字跟前一個的關係都一樣。', '每次都是「乘以 2 減 1」：17×2－1＝33。'],
             ['Convert the numerals first: 2, 3, 5, 9, 17.', 'Each number relates to the one before in the same way.', 'Each time it’s “× 2 − 1”: 17 × 2 − 1 = 33.']),
  },
  P17: {
    seg: 'act3b', diff: 9, kind: 'text', ans: '110111', gives: 'mirror',
    hints: H(['家書裡的「父親」「小女兒」是八卦裡的卦。', '父親是乾（三條實線），小女兒是兌（下面兩條實線，上面一條斷線）。', '六條橫槓要從下往上數：下卦兌，上卦乾。'],
             ['“Father” and “youngest daughter” in the letter are trigrams.', 'Father is Qian (three solid lines); youngest daughter is Dui (two solid below, one broken on top).', 'Count the six lines from the bottom: Dui below, Qian above.']),
  },
  P18: {
    seg: 'act3c', diff: 10, kind: 'seq', ans: 'b,l,i,g,h,t',
    hints: H(['門要的是一個字，字母數跟門上的空格一樣是 6 個。', '莉安娜在筆記裡寫了一半的字母。把你們找到的四個符文換成字母，填進空格。', '這個字是 BLIGHT（魔蝕的古名），對應的符文是 ᛒ ᛚ ᛁ ᚷ ᚺ ᛏ。'],
             ['The door wants one word — six letters, like the six slots.', 'Liana wrote half the letters in her notes. Turn your four runes into letters and fill the gaps.', 'The word is BLIGHT: ᛒ ᛚ ᛁ ᚷ ᚺ ᛏ.']),
  },
  P19: {
    seg: 'act3c', diff: 8, kind: 'event', house: 'eldrin', needs: 'mirror',
    hints: H(['先放好銀色小鏡子（第 4 座），四座鏡座都要用到。', '從窗戶開始，一座一座往前調；光要繞過石柱。', '第 1 座＝\\、第 2 座＝/、第 3 座＝/、第 4 座＝\\。'],
             ['Place the small silver mirror first (stand 4) — all four stands are needed.', 'Start at the window and adjust one mirror at a time; the light must go around the pillars.', 'Stand 1 = \\, stand 2 = /, stand 3 = /, stand 4 = \\.']),
  },
  P20: {
    seg: 'act3c', diff: 6, kind: 'event', house: 'belmont',
    hints: H(['石像只能推、不能拉。', '每座石像正下方都有一個標記。', '先把下面那排的兩座往下推一格，再推上面那排的兩座。'],
             ['Statues can be pushed, never pulled.', 'Each statue has a mark directly below it.', 'Push the bottom two statues down one square first, then the top two.']),
  },
  P21: {
    seg: 'act3c', diff: 8, kind: 'balance', house: 'ouroboros', count: 9, weighings: 2,
    hints: H(['9 瓶只秤 2 次，一次不能只比 1 瓶對 1 瓶。', '先分成三組，每組 3 瓶。', '秤兩組：一樣重就在第三組，不一樣就在重的那組；再從那 3 瓶裡挑 2 瓶秤。'],
             ['9 vials, 2 weighings — one-against-one won’t do.', 'Split them into three groups of three.', 'Weigh two groups: if equal it’s in the third, otherwise in the heavier. Then weigh 2 of those 3.']),
  },
  P22: { seg: 'act3c', diff: 0, score: false, kind: 'choice', options: ['show', 'hide'] },
  P23: {
    seg: 'act3c', diff: 10, kind: 'seq', ans: '1,6,11,16,15,14,13',
    hints: H(['前廳那幅畫是畫在鏡子上的。', '畫上的路線要左右翻轉，五線譜的音高告訴你每一步在第幾欄。', '正確順序：左上角開始斜著到右下角，再沿著最下面一排往左走到底。'],
             ['The sketch in the antechamber is painted on a mirror.', 'Flip the path left-to-right; the pitches tell you the column of each step.', 'From the top-left corner diagonally to the bottom-right, then left along the bottom row.']),
  },
  P24: {
    seg: 'act3c', diff: 9, kind: 'text', ans: 'WELL',
    hints: H(['門把上的凸點是一種給盲人讀的文字。', '每個字母是 2×3 的點。前廳有對照表。', '第一個字母是 W，最後兩個字母一樣。'],
             ['The raised dots are a script for the blind.', 'Each letter is a 2×3 cell. The chart is in the antechamber.', 'The first letter is W; the last two are the same.']),
  },
  P25: {
    seg: 'act3c', diff: 10, kind: 'seq', ans: '5,7,3',
    hints: H(['三個環用到的數字，你們都已經看過了：宿舍的時辰、創辦人的畫像、搜救名單。', '環只有 13 格，數字超過 12 就要繞回去（除以 13 取餘數）。', '31→5，33→7，失蹤的是 3 人。'],
             ['You’ve seen all three numbers: the dorm hours, the founder’s portrait, the search roster.', 'Each ring has only 13 marks — wrap around past 12 (remainder after dividing by 13).', '31 → 5, 33 → 7, and 3 went missing.']),
  },

  P26: {
    seg: 'act4', diff: 7, kind: 'levers', bolts: 4, locked: [1, 3], levers: { A: [1, 2], B: [2, 3], C: [3, 4], D: [1, 4] },
    hints: H(['每根拉桿都切換兩根門閂。拉兩次同一根等於沒拉。', '你要讓第 1、3 根打開，第 2、4 根保持不變。', 'A＋B：第 2 根被切換兩次，等於不動；第 1、3 根各切換一次。'],
             ['Each lever toggles two bolts. Pulling the same lever twice undoes it.', 'Bolts 1 and 3 must open; 2 and 4 must stay as they are.', 'A + B: bolt 2 toggles twice (no change); 1 and 3 toggle once.']),
  },
  P27: {
    seg: 'act4', diff: 8, kind: 'seq', ans: '12,24,18,36',
    hints: H(['每兩個齒輪咬在一起，方向就相反一次。', '轉速只看第一個和最後一個齒輪的齒數比。', '最後一個是 36 齒，中間要再放兩個，才會是逆時針。'],
             ['Each pair of meshing gears reverses direction.', 'Speed depends only on the first and last gears’ teeth.', 'The last gear has 36 teeth — put two in between to end counter-clockwise.']),
  },
  P28: {
    seg: 'act4', diff: 9, kind: 'text', ans: 'LSSLLSL',
    hints: H(['這段節奏你們聽過，守夜人出場時哼的那首歌。', '牆上留下的長短符號是第 1、4、7 個字：長、長、長。', '完整節奏是 長、短、短、長、長、短、長。'],
             ['You’ve heard this rhythm — the song the Night Warden hummed.', 'The surviving marks are syllables 1, 4 and 7: long, long, long.', 'The full rhythm: long, short, short, long, long, short, long.']),
  },
  P29: {
    seg: 'act4', diff: 9, kind: 'roof', word: 'ᛗᛁᛚᚾᛖᚱ', // 一步一步踩，伺服器判斷：要依序（一直循環）拼出 MILNER，只能走上下左右相鄰的石板
    hints: H(['要拼的字就在入口那句話裡。', '你要回到「米爾納」，用符文拼出 MILNER。', '符文依序是 ᛗ ᛁ ᛚ ᚾ ᛖ ᚱ。'],
             ['The word is in the line carved at the entrance.', 'You’re going back to “Milner” — spell MILNER in runes.', 'The runes, in order: ᛗ ᛁ ᛚ ᚾ ᛖ ᚱ.']),
  },
};

// 救援題（同伴來救）與自救題（被抓的人自己解）：每次被抓時由伺服器抽一題，答案依房間的亂數決定
export const RESCUE = {
  R1: { diff: 7, kind: 'counter' },   // 四條黑根上的元素 → 依序給出剋制的元素
  R2: { diff: 8, kind: 'event' },     // 導管連通（畫面判斷）
  R3: { diff: 7, kind: 'caesar' },    // 位移數＝被抓者學院的時辰
  R4: { diff: 8, kind: 'event' },     // 記憶翻牌（畫面判斷）
};
export const SELF_RESCUE = {
  S1: { diff: 9, kind: 'vigenere' },  // 金鑰＝自己學院的英文名
  S2: { diff: 10, kind: 'direction', rounds: 3 },
  S3: { diff: 9, kind: 'event' },     // 符文數獨（畫面判斷）
  S4: { diff: 10, kind: 'liar' },
};

// P29 屋頂的石板（第 0 排在北邊＝終點，第 5 排在南邊＝起點）。畫面用同一份（game/src/data/act4-ch1.mjs 的 ROOF，測試會比對）
export const ROOF = [
  'ᚠᛖᛗᛞᛚᚱ',
  'ᛟᚾᛚᛗᛁᛖ',
  'ᛁᛏᛖᚱᚾᚲ',
  'ᚱᛗᚾᛖᛚᚢ',
  'ᚷᛁᛚᛊᛁᛉ',
  'ᛁᛗᛒᚹᛗᚺ',
];
// 第四幕的倒數（docs/04-map-ch1.md）：35 分鐘；卡住齒輪（P27）多 90 秒，只有一次
export const ACT4 = { duration: 35 * 60 * 1000, gearBonus: 90 * 1000, grab: 1500, repelCool: 60 * 1000, repelFor: 5000, selfSwap: 3 * 60 * 1000 };

// 學院的時辰（P03～P08、R3 用）
export const HOUSE_HOUR = { eldrin: 8, grimoire: 11, belmont: 9, ouroboros: 3 };

// P14 書本密碼：哪本書、哪一頁、第幾個字（英文版是第幾個詞）是答案的字。其他位置由伺服器隨機產生填充文字
export const BOOK_CIPHER = {
  zh: [[12, 3, 7, '鐘'], [4, 41, 2, '在'], [9, 88, 15, '井'], [4, 41, 9, '底']],
  en: [[12, 3, 7, 'THE'], [4, 41, 2, 'BELL'], [9, 88, 15, 'LIES'], [4, 41, 9, 'IN'], [7, 19, 4, 'THE'], [2, 57, 11, 'WELL']],
};
// P24 門把上的四格點字（WELL）
export const BRAILLE_DOOR = [[2, 4, 5, 6], [1, 5], [1, 2, 3], [1, 2, 3]];
