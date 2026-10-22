// 角色的服裝（教室、角色一覽、烘焙共用）：裡面是制服（襯衫），外面是學院色的巫師袍（robe.mjs，照身體形狀做，不會穿模）。
// 2026-10-21 製作人：制服是「襯衫＋外袍」；四位主角的衣服不要一樣，配角可以一樣。
// 外面穿袍子時，裡面那件剪掉袖子（noSleeves）；程式做的筒狀斗篷關掉（cloak: false）；手臂張開一點（armDrop），手才不會陷進袍子。
// robe 的參數見 robe.mjs：hem 下擺高度、sleeveFlare 喇叭袖、openTop／openWaist 開襟、openHem 下擺開衩、collar 立領、belt 腰帶。
export const COSTUMES = {
  // 艾爾德林：淡藍格子 JK，月白長袍到腳踝、藍色滾邊、微喇叭袖
  elora: { cloak: false, armDrop: 1.12, shoes: { shoe: '#3a2418', sock: '#e8e6e0', sockTop: 'knee', shine: true }, outfit: [{ name: 'jk', hue: 212, sat: 1.0, noSleeves: true }, { name: 'robe', color: '#c9cfdb', trim: '#5f8fc8', hem: 0.12, sleeveFlare: 0.05, openTop: 0.075, openWaist: 0.05, openHem: 0.42 }] },
  // 格里莫瓦：深紅格子 JK，短的酒紅外袍（到大腿）、寬袖、金色滾邊、沒有立領
  yuexi: { cloak: false, armDrop: 1.12, shoes: { shoe: '#120c0a', sock: '#141216', sockTop: 'knee', shine: true }, outfit: [{ name: 'jk', hue: 352, sat: 1.4, light: 0.55, noSleeves: true }, { name: 'robe', color: '#4a1218', trim: '#d8c49a', hem: 0.62, flare: 0.25, sleeveFlare: 0.1, openTop: 0.065, openWaist: 0.07, openHem: 0.55, collar: false }] },
  // 貝爾蒙特：男生制服，黑色長袍到小腿、金色滾邊、窄袖
  vaughn: { cloak: false, armDrop: 1.15, shoes: { shoe: '#0e0a08', sock: '#16161a', shine: true }, outfit: [{ name: 'boy', noSleeves: true }, { name: 'robe', color: '#17171b', trim: '#b8902e', hem: 0.25, sleeveFlare: 0, openTop: 0.09, openWaist: 0.075, openHem: 0.3 }] },
  // 烏洛波斯：男生制服，墨綠長袍到膝蓋、前面整個合起來（扣到領口）、銀色滾邊、窄袖、立領
  // 烏洛波斯：男生制服，墨綠長袍到膝蓋、前面整個合起來、銀色滾邊、窄袖、立領。
  // 2026-10-22 製作人：用現有模型改西里爾（有骨架才會眨眼、說話、走路）。沃恩的身體＋西里爾原本的金色短髮、比較蒼白、
  // 臉固定成瞇眼、眉頭壓低、嘴角單邊上揚的冷笑（face 直接烘進臉的形狀），看起來跟沃恩是不同的人
  cyril: { cloak: false, armDrop: 1.15, height: 1.01, skin: '#f0d6c6', hairColor: { hair: '#c8b88a', hairTip: '#efe6c8' },
    face: { A16_Eye_Squint_Left: 0.6, A17_Eye_Squint_Right: 0.6, A02_Brow_Down_Left: 0.45, A03_Brow_Down_Right: 0.25, A38_Mouth_Smile_Left: 0.6, A23_Nose_Sneer_Left: 0.25, A26_Jaw_Forward: 0.2 },
    shoes: { shoe: '#0e0a08', sock: '#16161a', shine: true },
    outfit: [{ name: 'boy', noSleeves: true }, { name: 'robe', color: '#163a26', trim: '#9aa2a8', hem: 0.5, flare: 0.08, sleeveFlare: 0, openTop: 0.03, openWaist: 0.02, openHem: 0.12 }] },
  // 鞋子（shoes.mjs）：女生樂福鞋＋過膝襪（艾洛拉白襪、月晞黑襪），男生黑皮鞋；沒寫的人穿預設的深色鞋
  // 副校長塞巴斯汀・莫瑞（西里爾的父親）：跟西里爾同一副身體和髮型（看得出是父子），更高、深色頭髮夾著灰白、
  // 臉固定成眉頭深鎖、鼻翼微皺的冷峻表情（不笑），黑底銀邊、前面合起來的長袍
  moray: { cloak: false, armDrop: 1.15, height: 1.06, skin: '#e8c8b2', hairColor: { hair: '#22201e', hairTip: '#8a857c' },
    face: { A02_Brow_Down_Left: 0.55, A03_Brow_Down_Right: 0.55, A16_Eye_Squint_Left: 0.35, A17_Eye_Squint_Right: 0.35, A23_Nose_Sneer_Left: 0.2, A24_Nose_Sneer_Right: 0.2, Mouth_Frown: 0.25 },
    shoes: { shoe: '#0a0808', sock: '#141418', shine: true },
    outfit: [{ name: 'robe', color: '#0c0c10', trim: '#9aa0a8', hem: 0.08, sleeveFlare: 0.06, openTop: 0, openWaist: 0, openHem: 0 }] },
  // 老師：前面整個合起來的長袍（裡面沒穿衣服，開口會露出皮膚）
  helga: { cloak: false, armDrop: 1.15, outfit: [{ name: 'robe', color: '#4a4a52', trim: '#c8c2b8', hem: 0.1, sleeveFlare: 0.04, openTop: 0, openWaist: 0, openHem: 0 }] }, // 舍監：灰
  knox: { cloak: false, armDrop: 1.15, outfit: [{ name: 'robe', color: '#1e3326', trim: '#9a8a4a', hem: 0.1, sleeveFlare: 0.07, openTop: 0, openWaist: 0, openHem: 0 }] }, // 魔藥學教授：墨綠
};
