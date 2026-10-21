// 主角的服裝（教室、角色一覽共用）：裡面是制服，外面是學院色的長大衣。
// 女生：JK 制服（格子裙、領結換成學院色）＋長大衣；男生：男生制服＋長大衣。
// 外面要穿大衣，所以裡面那件剪掉袖子（noSleeves），程式做的筒狀斗篷關掉（cloak: false）。
export const COSTUMES = {
  elora: { cloak: false, outfit: [{ name: 'jk', hue: 212, sat: 1.0, noSleeves: true }, { name: 'coat', colorize: '#6a7284', puff: 0.03 }] }, // 艾爾德林：淡藍格子、灰藍大衣
  yuexi: { cloak: false, outfit: [{ name: 'jk', hue: 352, sat: 1.4, light: 0.55, noSleeves: true }, { name: 'coat', colorize: '#6a2028', puff: 0.03 }] }, // 格里莫瓦：深紅格子、酒紅大衣
  vaughn: { cloak: false, outfit: [{ name: 'boy', noSleeves: true }, { name: 'coat', colorize: '#4a4030', puff: 0.03 }] }, // 貝爾蒙特：深褐近黑的大衣
};
