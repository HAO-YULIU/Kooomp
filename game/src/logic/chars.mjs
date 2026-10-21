// 四位角色與學院（docs/01-characters.md）
export const HOUSES = {
  eldrin: { zh: '艾爾德林', en: 'Eldrin', color: '#9fc4ff' },
  grimoire: { zh: '格里莫瓦', en: 'Grimoire', color: '#c0454f' },
  belmont: { zh: '貝爾蒙特', en: 'Belmont', color: '#d1a640' },
  ouroboros: { zh: '烏洛波斯', en: 'Ouroboros', color: '#4fa37a' },
};
export const CHARS = {
  yuexi: { zh: '月晞', en: 'Yuexi', house: 'grimoire' },
  vaughn: { zh: '沃恩', en: 'Vaughn', house: 'belmont' },
  elora: { zh: '艾洛拉', en: 'Elora', house: 'eldrin' },
  cyril: { zh: '西里爾', en: 'Cyril', house: 'ouroboros' },
};
export const charOfHouse = (h) => Object.keys(CHARS).find((c) => CHARS[c].house === h);
