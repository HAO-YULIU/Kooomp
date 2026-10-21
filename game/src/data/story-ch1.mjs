// 第一章的劇情對話（第 2 批：序幕＋第一幕）與分院鏡的問答。依 docs/03-chapter1.md。
// 每一句：[說話的人, 中文, 英文]。說話的人是角色代號（yuexi / vaughn / elora / cyril）、配角代號，或 null（旁白）。
// 觸發：segment:段落（這一段開始）、enter:房間（第一次走進去）、solved:題號（解開後）

export const SPEAKERS = {
  yuexi: { zh: '月晞', en: 'Yuexi' },
  vaughn: { zh: '沃恩', en: 'Vaughn' },
  elora: { zh: '艾洛拉', en: 'Elora' },
  cyril: { zh: '西里爾', en: 'Cyril' },
  aldric: { zh: '校長 奧德里克', en: 'Headmaster Aldric' },
  moray: { zh: '副校長 莫瑞', en: 'Vice-Principal Moray' },
  knox: { zh: '諾克斯教授', en: 'Professor Knox' },
  helga: { zh: '赫爾嘉夫人', en: 'Madam Helga' },
  mirror: { zh: '分院鏡', en: 'The Sorting Mirror' },
  student: { zh: '學生', en: 'A student' },
};

export const SCRIPT = {
  'segment:prologue': [
    [null, '傍晚。渡船穿過黑湖的霧，米爾納學校的燈火在對岸亮起。', 'Dusk. The ferry cuts through the mist on the Black Lake; the lights of Milner Academy rise on the far shore.'],
    ['vaughn', '看到沒？那就是鐘塔！聽說它四百年來一次都沒停過。', 'See that? The clock tower! They say it hasn’t stopped once in four hundred years.'],
    ['cyril', '一座會走的鐘，真了不起。你明天要不要也去崇拜一下水壺？', 'A clock that works. Astonishing. Shall we go worship a kettle tomorrow?'],
    ['yuexi', '……', '…'],
    ['elora', '別理他們。來，喝點水，暈船的時候看遠一點會比較好。', 'Ignore them. Here, have some water — it helps to look far away when you’re seasick.'],
    [null, '（WASD／搖桿移動，滑鼠／右半邊畫面轉視角，E／「調查」查看東西。往大廳走。）', '(Move with WASD / the stick, look with the mouse / right side of the screen, E / “Inspect” to examine things. Head for the hall.)'],
  ],
  'enter:hall': [
    [null, '大廳中央立著分院鏡。新生們一個一個站到它面前。', 'The Sorting Mirror stands in the middle of the hall. One by one, the first-years step before it.'],
    ['mirror', '……下一位。', '…Next.'],
    [null, '輪到艾洛拉時，鏡子沉默了很久。', 'When Elora’s turn comes, the mirror is silent for a long time.'],
    ['mirror', '你身上……有別的東西。……艾爾德林。', 'There is… something else in you. …Eldrin.'],
    [null, '全場安靜了一秒。艾洛拉笑了笑，拉了拉手套，走回大家身邊。', 'The hall goes quiet for a heartbeat. Elora smiles, tugs at her gloves, and walks back to the others.'],
  ],
  'enter:banquet': [
    ['aldric', '歡迎來到米爾納。在這裡，你們會學到魔法，也會學到規矩。', 'Welcome to Milner. Here you will learn magic — and you will learn the rules.'],
    ['aldric', '北翼地下，嚴禁進入。還有……熄燈之後，請不要理會鐘聲。', 'The cellars beneath the North Wing are forbidden. And… after lights-out, pay no attention to the bells.'],
    [null, '校長身旁的副校長看向西里爾，只冷冷地點了個頭。西里爾別開了臉。', 'Beside the headmaster, the vice-principal looks at Cyril and gives a single cold nod. Cyril looks away.'],
    [null, '魔藥學教授的視線，一直停在艾洛拉的手套上。', 'The potions professor’s gaze never leaves Elora’s gloves.'],
    [null, '（四張長桌上的學生在交頭接耳。走過去聽聽看，再回到你的座位整理。）', '(Students are whispering at the four long tables. Go and listen, then return to your seat to piece it together.)'],
  ],
  'segment:act1': [
    [null, '熄燈之後。宿舍很安靜，只有壁爐偶爾劈啪作響。', 'After lights-out. The dormitories are silent but for the crackle of the fire.'],
    [null, '床頭的傳聲海螺忽然亮了。', 'The speaking-shell by your bed begins to glow.'],
    ['elora', '……大家還醒著嗎？今天晚宴上有人說，去年那個學姊是在北翼不見的。', '…Is everyone still awake? Someone at dinner said that girl last year vanished in the North Wing.'],
    ['vaughn', '北翼？那還等什麼，我們去看看！', 'The North Wing? What are we waiting for — let’s go see!'],
    ['cyril', '無聊。……不過我剛好睡不著。', 'Boring. …Though I happen to be wide awake.'],
    ['yuexi', '聽說禁區裡有很老的書。我也去。', 'They say there are very old books in the forbidden part. I’ll come.'],
    ['elora', '那就在星盤廳會合。小心赫爾嘉夫人，她會提著燈巡夜。', 'Then we meet in the Astrolabe Hall. Watch out for Madam Helga — she patrols with her lamp.'],
    [null, '（宿舍的門上了魔法鎖。在交誼廳裡找出打開它的方法。）', '(The dormitory door is sealed by a spell. Find a way to open it in the common room.)'],
  ],
  'solved:P03': [[null, '門上浮現一行字：「記住我的時辰。」門開了。', 'Words surface on the door: “Remember my hour.” The door opens.']],
  'solved:P04': [[null, '符文亮起：「記住你的時辰。」門開了。', 'The rune flares: “Remember your hour.” The door opens.']],
  'solved:P05': [[null, '秤盤沉下去，牆上的獵犬徽章眨了眨眼：「記住你的時辰。」門開了。', 'The pan sinks; the hound crest on the wall blinks: “Remember your hour.” The door opens.']],
  'solved:P06': [[null, '你敲了門。牆上時鐘的長針停住了，門開了。', 'You knock. The long hand of the wall clock stops. The door opens.']],
  'solved:P07': [[null, '使魔飛回你肩上。其他塔的同伴已經出發了。', 'Your familiar returns to your shoulder. The others have already set out.']],
  'enter:starhall': [
    [null, '星盤廳。巨大的星盤在地上緩緩轉動，四個學院的徽章刻在四個圓環上。', 'The Astrolabe Hall. A vast astrolabe turns slowly in the floor, the four house crests carved into its four rings.'],
    [null, '（遠處有提燈的光——是赫爾嘉夫人。被燈照到會被抓回宿舍。躲在柱子後面或窗簾後，按住 Q／「屏息」可以不被聽到。）', '(A lamp glows in the distance — Madam Helga. If her light finds you, you’ll be sent back to bed. Hide behind the pillars or curtains; hold Q / “Hold breath” so she can’t hear you.)'],
  ],
  'caught': [['helga', '這麼晚了，還在外面晃？回床上去！', 'Out of bed at this hour? Back to your dormitory!']],
  'solved:P08': [
    [null, '四個圓環咬合的聲音在大廳裡迴盪。往北的門，無聲地打開了。', 'The four rings lock together with a sound that echoes through the hall. The northern door swings open without a sound.'],
    ['elora', '（拿出一把舊鑰匙）我知道從哪裡下去。', '(producing an old key) I know the way down.'],
    ['vaughn', '這把鑰匙哪來的？', 'Where did you get that key?'],
    ['elora', '……祕密。走吧。', '…That’s a secret. Come on.'],
  ],
};

// 分院鏡的問答（P01）：每題四個選項，依序對應 艾爾德林、格里莫瓦、貝爾蒙特、烏洛波斯
export const SORTING = [
  { q: ['半夜醒來，聽到走廊有腳步聲。你會？', 'You wake at midnight to footsteps in the corridor. You…'],
    a: [['先確認室友都平安', 'make sure your roommates are safe'], ['記下時間和腳步的節奏', 'note the time and the rhythm of the steps'], ['直接開門看是誰', 'open the door to see who it is'], ['裝睡，等它自己露出破綻', 'pretend to sleep and wait for it to give itself away']] },
  { q: ['如果只能帶一樣東西進禁區？', 'You may bring one thing into a forbidden place.'],
    a: [['一盞燈', 'a lamp'], ['一本書', 'a book'], ['一把劍', 'a sword'], ['一個沒人知道的計畫', 'a plan no one else knows']] },
  { q: ['朋友對你說了謊。你會？', 'A friend has lied to you. You…'],
    a: [['相信他一定有理由', 'trust they had a reason'], ['找出真相再說', 'find out the truth first'], ['當面問清楚', 'ask them to their face'], ['記住，之後也許用得上', 'remember it — it may be useful later']] },
  { q: ['你最害怕的是？', 'What do you fear most?'],
    a: [['黑暗', 'the dark'], ['被遺忘', 'being forgotten'], ['什麼都做不了', 'being helpless'], ['沒有選擇', 'having no choice']] },
  { q: ['夜空裡你最先看到什麼？', 'What do you notice first in the night sky?'],
    a: [['最亮的那顆星', 'the brightest star'], ['星座的形狀', 'the shapes of the constellations'], ['月亮', 'the moon'], ['星星移動的方向', 'the way the stars move']] },
  { q: ['在一扇打不開的門前，你會？', 'Before a door that will not open, you…'],
    a: [['等大家一起想辦法', 'wait so everyone can work it out together'], ['研究鎖的構造', 'study how the lock is made'], ['用力撞開', 'break it down'], ['找另一條路', 'find another way']] },
  { q: ['哪一句話最像你？', 'Which saying is most like you?'],
    a: [['「有光就有路。」', '“Where there is light, there is a way.”'], ['「知道得越多，越不怕。」', '“The more you know, the less you fear.”'], ['「先做了再說。」', '“Act first, explain later.”'], ['「一切都會繞回原點。」', '“Everything comes back around.”']] },
  { q: ['鏡子問：你為什麼來到米爾納？', 'The mirror asks: why have you come to Milner?'],
    a: [['為了保護重要的人', 'to protect someone who matters'], ['為了找到答案', 'to find answers'], ['為了變強', 'to become stronger'], ['為了得到我想要的', 'to get what I want']] },
];
export const SORTING_HOUSES = ['eldrin', 'grimoire', 'belmont', 'ouroboros'];

// P07：燭光的摩斯密碼表（貼在書桌上）
export const MORSE_TABLE = [['0', '-----'], ['1', '.----'], ['2', '..---'], ['3', '...--'], ['4', '....-'], ['5', '.....'], ['6', '-....'], ['7', '--...'], ['8', '---..'], ['9', '----.']];

// P04：燒焦的符文表（三族、每族 8 個；null＝被燒掉看不清）
export const RUNE_ROWS = [
  ['ᚠ', 'ᚢ', null, 'ᚨ', 'ᚱ', null, 'ᚷ', 'ᚹ'],
  [null, 'ᚾ', 'ᛁ', null, 'ᛇ', 'ᛈ', null, 'ᛋ'],
  ['ᛏ', null, 'ᛖ', 'ᛗ', null, 'ᛜ', 'ᛞ', null],
];
