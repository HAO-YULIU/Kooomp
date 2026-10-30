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
  warden: { zh: '守夜人 葛雷', en: 'Grey, the Night Warden' },
};

export const SCRIPT = {
  'segment:prologue': [
    [null, '傍晚。渡船穿過黑湖的霧，米爾納學校的燈火在對岸亮起。', 'Dusk. The ferry cuts through the mist on the Black Lake; the lights of Milner Academy rise on the far shore.'],
    ['vaughn', '看到沒？那就是鐘塔！聽說它四百年來一次都沒停過。', 'See that? The clock tower! They say it hasn’t stopped once in four hundred years.'],
    ['cyril', '一座會走的鐘，真了不起。你明天要不要也去崇拜一下水壺？', 'A clock that works. Astonishing. Shall we go worship a kettle tomorrow?'],
    ['yuexi', '……', '…'],
    ['elora', '別理他們。來，喝點水，暈船的時候看遠一點會比較好。', 'Ignore them. Here, have some water — it helps to look far away when you’re seasick.'],
    [null, '（WASD／搖桿移動，滑鼠／右半邊畫面轉視角，E／「探查」查看東西。往大廳走。）', '(Move with WASD / the stick, look with the mouse / right side of the screen, E / “Inspect” to examine things. Head for the hall.)'],
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
  'mirror': [[null, '字是反著寫的……像是有人從鏡子的另一邊，用手指寫給你看。', 'The letters are backwards… as if someone wrote them with a finger from the other side of the glass.']],
  // ---- 第二幕：肖像畫長廊 ----
  'segment:act2': [
    [null, '北翼的門後是一條窄窄的走廊。兩側掛著六幅女學生的畫像，盡頭的門上了鎖。', 'Beyond the North Wing door is a narrow corridor. Six portraits of girls line the walls; the door at the end is locked.'],
    ['yuexi', '每一幅下面都有名牌……「未畢業」？六個都是。', 'Each one has a name plate… “Did not graduate”? All six of them.'],
    ['cyril', '門上是五格的字母鎖。還有那盞油燈……窗外好像要打雷了。', 'Five letter wheels on the door. And that oil lamp… sounds like a storm is coming.'],
  ],
  'solved:P30': [
    [null, '最後一格轉到位，鎖喀的一聲開了。門後是一條更長的走廊，牆上掛滿了畫像。', 'The last wheel clicks into place and the lock gives. Beyond the door, a much longer corridor, hung wall to wall with portraits.'],
    ['elora', '（盯著那五個字母，手在發抖）……走吧。', '(staring at the five letters, her hands shaking) …Let’s go.'],
  ],
  'enter:corridor': [
    [null, '燭火輕輕搖晃。你有種奇怪的感覺：這條走廊，好像走不完。', 'The candles flicker. You have the strangest feeling that this corridor never ends.'],
    [null, '（找異常：每一趟走廊，有東西不一樣就回頭，沒有就推開盡頭的門。連續判斷正確 8 次才能走出去，錯一次就從頭來。多人時要投票：推門＝往前、退回北翼走廊＝回頭，過半數同意才算數。）', '(Spot the anomaly: if anything on this walk is different, turn back; if not, push open the door at the end. Get it right 8 times in a row to escape — one mistake and you start over. With friends, it’s a vote: pushing the door votes to go on, walking back votes to turn back; a majority decides.)'],
  ],
  'corridor:liana': [['elora', '……姊姊？', '…Sister?'], ['cyril', '（看了艾洛拉一眼，什麼都沒說）', '(glances at Elora and says nothing)']],
  'solved:P09': [
    [null, '這一次，門後不再是長廊的起點。', 'This time, the door does not lead back to the start.'],
    [null, '一個圓形的房間。正前方掛著一幅巨大的畫像：創辦人艾德蒙・米爾納，他的手指向某個方向。', 'A round chamber. Before you hangs a vast portrait: the founder, Edmund Milner, his finger pointing somewhere.'],
  ],
  'enter:founder': [
    [null, '兩側牆上是歷任校長的畫像。創辦人畫像下的銘牌被刮花了，看不出他在位幾年。', 'The headmasters line both walls. The plaque beneath the founder has been scratched; you can’t read how long he served.'],
    [null, '畫像下方有一道鎖：一個可以轉動的手臂，和四格數字。', 'Below the portrait is a lock: an arm that can be turned, and four number wheels.'],
  ],
  'snuff': [[null, '燭火熄滅了。黑暗裡，所有畫像的眼睛都亮了起來——全都看著同一個方向。', 'The candles die. In the dark, every portrait’s eyes begin to glow — all of them looking the same way.']],
  'solved:P10': [
    [null, '創辦人的手臂停在那個方向，喀的一聲，畫像後面的門打開了。冷風從底下吹上來。', 'The founder’s arm settles into place with a click, and a door opens behind the portrait. Cold air rises from below.'],
    ['elora', '……就是這裡。往下。', '…This is it. Down.'],
  ],

  // ---- 第三幕：沉眠圖書館 ----
  'segment:act3a': [
    [null, '你們沿著北翼樓梯一路往下。空氣越來越冷，牆上的火把一盞接一盞熄滅。', 'You follow the North Wing stairs down and down. The air grows colder; the torches go out one by one.'],
    ['vaughn', '這裡……是圖書館？', 'Is this… a library?'],
  ],
  'enter:lib_entry': [
    [null, '地上有乾掉的血跡，一路被拖向深處。', 'Dried blood streaks the floor, dragged toward the depths.'],
    [null, '血跡的盡頭躺著一個人——去年搜救隊的高年級生。他的下半身已經結晶化，和地板長在一起；上半身被啃過，肋骨露在外面，手裡還緊握著提燈。', 'At the end of the trail lies a body — a senior from last year’s search party. Below the waist he has crystallized into the floor; above it, he has been gnawed, his ribs bared, a lantern still clenched in his hand.'],
    ['elora', '……搜救隊。他們真的下來過。', '…The search party. They really came down here.'],
    [null, '（入口的柵門鎖著。先查查四周。）', '(The gate is locked. Search the room first.)'],
  ],
  'solved:P11': [[null, '箱子打開了，裡面是一盞搜救用的提燈。', 'The case opens. Inside is a search-party lantern.']],
  'solved:P12': [[null, '影子對上了。柵門緩緩升起，後面是一整片高聳的書架。', 'The shadows align. The gate grinds upward, revealing towering shelves.']],
  'enter:lib_maze': [
    [null, '書架高得看不到頂。書頁上長出了黑色的紋路，空氣裡飄著細細的黑灰。', 'The shelves vanish into darkness above. Black veins grow across the pages; fine black ash drifts in the air.'],
    [null, '（燈會定時熄滅。熄燈之後，書架會移動。）', '(The lamps go out at intervals. When they do, the shelves move.)'],
  ],
  'solved:P13': [[null, '你們找到了出口。身後的書架在黑暗中又移動了一次。', 'You find the way out. Behind you, the shelves shift once more in the dark.']],
  'enter:lib_reading': [
    ['yuexi', '閱覽室……這些書還在自己翻頁。', 'The reading room… the books are still turning their own pages.'],
    [null, '角落的水晶發出微弱的聲音，像有人在說話。', 'A crystal in the corner murmurs faintly, like someone speaking.'],
    ['vaughn', '這裡怎麼到處都是娃娃……一、二、三……五個。', 'Why are there dolls everywhere… one, two, three… five.'],
  ],
  'solved:P15': [[null, '抽屜裡是莉安娜筆記的第三頁。', 'Inside the drawer is the third page of Liana’s notes.']],
  'solved:P16': [[null, '夾在第 33 頁裡的，是一張符文表殘頁。', 'Pressed between the pages is a fragment of a rune chart.']],
  'solved:P17': [[null, '抽屜裡是一面銀色的小鏡子。', 'Inside the drawer is a small silver mirror.']],
  'segment:act3c': [[null, '閱覽室深處的門，自己打開了。', 'At the far end of the reading room, a door opens by itself.']],
  'enter:lib_ante': [
    [null, '一扇刻滿盧恩符文的大門。門後傳來像心跳一樣的聲音。', 'A great door carved with runes. From behind it comes a sound like a heartbeat.'],
    [null, '角落裡有什麼東西在發亮。', 'Something glints in the corner.'],
  ],
  // P19～P21 各給一個符文（P18 符文大門的線索，docs/05-puzzles-ch1.md）
  'solved:P19': [[null, '月光打在水晶上，水晶裡浮出一個符文：ᛚ。（記在筆記本裡）', 'Moonlight strikes the crystal, and a rune rises inside it: ᛚ. (Noted in your notebook.)']],
  'solved:P20': [[null, '四座石像鬼歸位，它們的底座一起亮出一個符文：ᚷ。（記在筆記本裡）', 'The four gargoyles settle into place; their plinths light up with one rune: ᚷ. (Noted in your notebook.)']],
  'solved:P21': [[null, '被污染的那瓶藥劑碎了，瓶底刻著一個符文：ᛏ。（記在筆記本裡）', 'The tainted vial shatters; a rune is etched on its base: ᛏ. (Noted in your notebook.)']],
  'solved:P18': [[null, '符文一個接一個亮起，大門開了一條縫。門後是一片漆黑。', 'The runes light one after another, and the door opens a crack. Beyond it is pitch black.']],
  'solved:P24': [[null, '門開了。冷風從底下吹上來。', 'The door opens. Cold air rises from below.']],
  'enter:lib_well': [[null, '井室。一口很深的井，井底傳來低沉的鐘聲。', 'The well chamber. A deep well; from its bottom comes a low tolling.']],
  'solved:P25': [
    [null, '三個圓環咬合，井蓋打開了。井口邊緣卡著一枚髮夾。', 'The three rings lock, and the well cover opens. A hairpin is caught on the rim.'],
    ['elora', '（撿起髮夾）……這是姊姊的。', '(picking up the hairpin) …This is my sister’s.'],
    [null, '艾洛拉往井邊衝過去，沃恩一把拉住她。', 'Elora lunges toward the well; Vaughn catches her arm.'],
    ['elora', '我姊姊……她在這裡。對不起，是我帶大家來的。我只是想找到她。', 'My sister… she’s here. I’m sorry — I brought you all here. I just wanted to find her.'],
    ['vaughn', '……沒事。我們一起找。', '…It’s all right. We’ll find her together.'],
    [null, '就在這時，鐘塔的鐘聲從頭頂傳來。十二響之後——還有一響。', 'Then the clock tower tolls above. Twelve strokes — and then one more.'],
  ],

  // ---- 第四幕：守夜人（docs/03-chapter1.md） ----
  'segment:act4': [
    [null, '午夜。鐘聲從四面八方壓下來。大家一起數：……十、十一、十二。', 'Midnight. The bells press in from every side. Together you count: …ten, eleven, twelve.'],
    [null, '然後是第十三響。', 'Then comes the thirteenth.'],
    ['cyril', '……鐘聲還沒停。它在倒數。', '…It isn’t stopping. It’s counting down.'],
    [null, '餘音結束的時候，還留在蝕域裡的人，都會被同化。畫面上方是剩下的時間。', 'When the echo fades, whoever is still inside the Blight will be consumed. The time left is shown at the top.'],
    [null, '樓梯上亮起一盞綠色的燈。有人哼著歌，一步一步走下來。', 'A green lamp appears on the stairs. Someone is humming, coming down one step at a time.'],
    ['warden', '「提著綠燈走長廊，誰家孩子還沒睡……」孩子們，該回床上了。', '“Green lamp glowing down the hall, who’s still waking, little one…” Children. Back to bed now.'],
    [null, '他的燈照到艾洛拉的手套，突然停住了。', 'His lamp falls on Elora’s glove, and he stops dead.'],
    [null, '下一秒，他的身體從背後裂開。肋骨像門一樣往兩側撐開，黑色的結晶從裂口刺穿衣服，血順著結晶往下滴。', 'The next instant his back splits open. His ribs swing apart like doors; black crystal spears through his coat, and blood runs down the spikes.'],
    [null, '臉皮整片往下剝落，掛在下巴上。他的眼睛，變成了一片漆黑。', 'The skin of his face peels away in one sheet and hangs from his chin. His eyes are nothing but black.'],
    ['vaughn', '跑！往東邊的通道——別被那道綠光照到！', 'Run! The east passage — don’t let the green light touch you!'],
    [null, '（Shift／搖桿推到底跑步，跑太久會喘。躲進櫃子、書架縫，按住 Q／「屏息」保持安靜。被抓住時連點掙脫。）', '(Shift / push the stick fully to run — you’ll tire. Hide in cabinets and gaps; hold Q / “Hold breath” to stay silent. If caught, mash to break free.)'],
  ],
  'act4:retry': [[null, '……你們又站在入口大廳裡。鐘聲重新開始倒數，綠燈從樓梯上下來。', '…You stand in the entrance hall again. The tolling begins its count anew, and the green lamp descends the stairs.']],
  'enter:a4_gears': [
    ['vaughn', '那個稻草人……剛剛是不是動了一下？', 'That scarecrow… did it just move?'],
    [null, '地上的石板刻著羅馬數字。南牆邊有一個上鎖的工具箱。', 'The floor stones are carved with Roman numerals. A locked toolbox sits by the south wall.'],
  ],
  'solved:P26': [[null, '門閂一根根彈開，鐵門被推開了。', 'The bolts snap back one by one, and the iron door gives way.']],
  'solved:P27': [[null, '齒輪咬死了。頭頂的鐘槌卡在半空——鐘聲停了一下。（多了 90 秒）', 'The gears seize. Overhead the hammer jams in mid-swing — the tolling falters. (+90 seconds)']],
  'solved:P28': [[null, '石板隨著節奏一塊塊亮起，通往屋頂的門開了。冷風和月光灌了進來。', 'The stones light up with the rhythm, and the way to the roof opens. Cold wind and moonlight pour in.']],
  'solved:P29': [
    [null, '最後一塊石板亮了。身後，綠燈追上了屋頂。', 'The last stone lights. Behind you, the green lamp reaches the roof.'],
    [null, '月光照在守夜人身上。他發出不像人的慘叫，整個人停了下來，身上的結晶一根根裂開。', 'Moonlight falls on the Night Warden. He lets out an inhuman scream and stops; one by one, his crystals crack.'],
    [null, '他看著艾洛拉。她的手套底下，透出微微的黑光。', 'He looks at Elora. Beneath her glove, a faint black light is showing.'],
  ],
  'P29:cyril': [
    ['warden', '……你也是。', '…You too.'],
    [null, '然後他往後一倒，從屋頂墜了下去。只有你聽清楚了那句話。', 'Then he tips backward and falls from the roof. Only you heard the words clearly.'],
  ],
  'P29:others': [[null, '他說了一句什麼，被風吹散了。然後他往後一倒，從屋頂墜了下去。', 'He says something — the wind tears it away. Then he tips backward and falls from the roof.']],
  // 尾聲講完、熄燈後（2026-10-30 帳號二，伏筆，等製作人確認）
  'finale': [[null, '燈，全滅了。黑暗裡，房間那面古鏡慢慢起了霧——有人從鏡子裡面，寫了一行字。', 'The lights die, all at once. In the dark, the old mirror slowly fogs over — someone on the inside has written a line.']],
  'segment:epilogue': [
    [null, '四個人在第十三響的餘音結束的那一刻衝回宿舍。窗外的鐘塔，恢復了安靜。', 'The four of you burst into the dormitory at the very moment the thirteenth toll fades. Outside, the clock tower falls silent.'],
    [null, '隔天早上，大廳一切如常。公告欄上寫著：「守夜人葛雷因病退休。」昨晚的血跡，全部不見了。', 'The next morning the hall is as if nothing happened. A notice reads: “Night Warden Grey has retired due to illness.” Every trace of blood is gone.'],
    [null, '西里爾收到一封沒有署名的信，封蠟是一條銜尾蛇：「你昨晚去了不該去的地方。」', 'Cyril receives an unsigned letter sealed with an ouroboros: “You went somewhere you should not have last night.”'],
    [null, '艾洛拉在浴室裡脫下手套。黑色的紋路，從手腕爬到了手肘。', 'In the bathroom, Elora peels off her glove. Black veins have crept from her wrist to her elbow.'],
    [null, '她把袖子拉下來，對著鏡子，練習微笑。', 'She pulls her sleeve down, faces the mirror, and practises her smile.'],
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

// 歷任校長（P10）。創辦人的在位年數被刮掉了；第二任的銘牌寫著答案的線索
export const HEADMASTERS = [
  { zh: '艾德蒙・米爾納　創辦人　在位 ▒▒ 年（被刮花了）', en: 'Edmund Milner — Founder — served ▒▒ years (scratched)' },
  { zh: '第二任　歐文・米爾納　1659－1701　「繼創辦人三十三年之治」', en: '2nd — Owen Milner — 1659–1701 — “Successor to the founder’s thirty-three years”' },
  { zh: '第三任　碧翠絲・海爾　1701－1733', en: '3rd — Beatrix Hale — 1701–1733' },
  { zh: '第四任　柯尼留斯・艾許比　1733－1768', en: '4th — Cornelius Ashby — 1733–1768' },
  { zh: '第五任　瑪蒂德・凡斯　1768－1801', en: '5th — Mathilde Vance — 1768–1801' },
  { zh: '第六任　伊格納修・米爾納　1801－1826', en: '6th — Ignatius Milner — 1801–1826' },
  { zh: '第七任　羅莎琳・克蘭　1826－1860', en: '7th — Rosalind Crane — 1826–1860' },
  { zh: '第八任　巴塞羅謬・里夫　1860－1894', en: '8th — Bartholomew Reeve — 1860–1894' },
  { zh: '第九任　希奧朵拉・米爾納　1894－1926', en: '9th — Theodora Milner — 1894–1926' },
  { zh: '第十任　安布羅斯・奎爾　1926－1951', en: '10th — Ambrose Quill — 1926–1951' },
  { zh: '第十一任　海倫娜・馬許　1951－1980', en: '11th — Helena Marsh — 1951–1980' },
  { zh: '第十二任　珀西瓦・米爾納　1980－2001', en: '12th — Percival Milner — 1980–2001' },
  { zh: '第十三任　奧德里克・米爾納　2001－', en: '13th — Aldric Milner — 2001–' },
];

// 肖像畫長廊的學生畫像（名字只有格里莫瓦的人看得懂；其他人看到的是古文字）
export const GALLERY_NAMES = ['Ada', 'Bram', 'Cora', 'Dell', 'Edda', 'Finn', 'Gwen', 'Hal', 'Iris', 'Jory', 'Kit', 'Lark',
  'Mabel', 'Ned', 'Opal', 'Pell', 'Quinn', 'Rue', 'Sable', 'Tam', 'Una', 'Vale', 'Wren', 'Yara'];
