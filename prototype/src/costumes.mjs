// 角色的服裝（教室、角色一覽、烘焙共用）：裡面是制服（襯衫），外面是學院色的巫師袍（robe.mjs，照身體形狀做，不會穿模）。
// 2026-10-21 製作人：制服是「襯衫＋外袍」；四位主角的衣服不要一樣，配角可以一樣。
// 外面穿袍子時，裡面那件剪掉袖子（noSleeves）；程式做的筒狀斗篷關掉（cloak: false）；手臂張開一點（armDrop），手才不會陷進袍子。
// robe 的參數見 robe.mjs：hem 下擺高度、sleeveFlare 喇叭袖、openTop／openWaist 開襟、openHem 下擺開衩、collar 立領、belt 腰帶。
export const COSTUMES = {
  // 艾爾德林：淡藍格子 JK，月白長袍到腳踝、藍色滾邊、微喇叭袖
  elora: { cloak: false, armDrop: 1.12, outfit: [{ name: 'jk', hue: 212, sat: 1.0, noSleeves: true }, { name: 'robe', color: '#c9cfdb', trim: '#5f8fc8', hem: 0.12, sleeveFlare: 0.05, openTop: 0.075, openWaist: 0.05, openHem: 0.42 }] },
  // 格里莫瓦：深紅格子 JK，短的酒紅外袍（到大腿）、寬袖、金色滾邊、沒有立領
  yuexi: { cloak: false, armDrop: 1.12, outfit: [{ name: 'jk', hue: 352, sat: 1.4, light: 0.55, noSleeves: true }, { name: 'robe', color: '#4a1218', trim: '#d8c49a', hem: 0.62, flare: 0.25, sleeveFlare: 0.1, openTop: 0.065, openWaist: 0.07, openHem: 0.55, collar: false }] },
  // 貝爾蒙特：男生制服，黑色長袍到小腿、金色滾邊、窄袖
  vaughn: { cloak: false, armDrop: 1.15, outfit: [{ name: 'boy', noSleeves: true }, { name: 'robe', color: '#17171b', trim: '#b8902e', hem: 0.25, sleeveFlare: 0, openTop: 0.09, openWaist: 0.075, openHem: 0.3 }] },
  // 烏洛波斯：男生制服，墨綠長袍到膝蓋、前面整個合起來（扣到領口）、銀色滾邊、窄袖、立領
  cyril: { outfit: [{ name: 'boy', noSleeves: true }, { name: 'robe', color: '#12301f', trim: '#c0c4c8', hem: 0.5, flare: 0.08, sleeveFlare: 0, openTop: 0, openWaist: 0, openHem: 0.12 }] },
  // 老師：前面合起來的長袍（看不到裡面）
  helga: { cloak: false, armDrop: 1.15, outfit: [{ name: 'robe', color: '#4a4a52', trim: '#c8c2b8', hem: 0.1, sleeveFlare: 0.04, openTop: 0.03, openWaist: 0, openHem: 0 }] }, // 舍監：灰
  knox: { cloak: false, armDrop: 1.15, outfit: [{ name: 'robe', color: '#1e3326', trim: '#9a8a4a', hem: 0.1, sleeveFlare: 0.07, openTop: 0.04, openWaist: 0, openHem: 0 }] }, // 魔藥學教授：墨綠
};
