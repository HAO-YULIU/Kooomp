// 四位角色與學院（docs/01-characters.md）
export const HOUSES = {
  eldrin: { zh: '艾爾德林', en: 'Eldrin', color: '#9fc4ff', sigil: '✦', motto: { zh: '星辰與燭火・守護', en: 'Stars & Candlelight · Guardians' }, power: { zh: '光：看得見隱形墨水與光的痕跡', en: 'Light: sees hidden ink and traces of light' } },
  grimoire: { zh: '格里莫瓦', en: 'Grimoire', color: '#c0454f', sigil: '❦', motto: { zh: '魔法書與鑰匙・知識', en: 'Tome & Key · Knowledge' }, power: { zh: '文：讀得懂古文字與密碼', en: 'Lore: reads ancient scripts and ciphers' } },
  belmont: { zh: '貝爾蒙特', en: 'Belmont', color: '#d1a640', sigil: '⚔', motto: { zh: '獵犬與銀劍・勇氣', en: 'Hound & Silver Blade · Courage' }, power: { zh: '力：推得動重物、擊退怪物', en: 'Might: moves heavy things, repels monsters' } },
  ouroboros: { zh: '烏洛波斯', en: 'Ouroboros', color: '#4fa37a', sigil: '◎', motto: { zh: '銜尾蛇與沙漏・循環', en: 'Serpent & Hourglass · Cycles' }, power: { zh: '時：感覺得到異常與時間的流動', en: 'Time: senses anomalies and the flow of time' } },
};
export const CHARS = {
  yuexi: { zh: '月晞', en: 'Yuexi', house: 'grimoire', blurb: { zh: '來自東方的交換生。安靜、愛看書，一開口通常說中重點。', en: 'An exchange student from the East. Quiet and bookish — when she speaks, she is usually right.' } },
  vaughn: { zh: '沃恩', en: 'Vaughn', house: 'belmont', blurb: { zh: '獵人世家出身。熱血、衝動、很講義氣，總是第一個說「我們去看看」。', en: 'From a family of hunters. Hot-blooded and loyal — always the first to say “let’s go see.”' } },
  elora: { zh: '艾洛拉', en: 'Elora', house: 'eldrin', blurb: { zh: '開朗溫柔，像大家的姊姊。她一直戴著手套，從不拿下來。', en: 'Warm and cheerful, everyone’s big sister. She never takes off her gloves.' } },
  cyril: { zh: '西里爾', en: 'Cyril', house: 'ouroboros', blurb: { zh: '聰明、嘴巴毒，看什麼都帶點嘲諷，其實很在乎朋友。', en: 'Clever and sharp-tongued, sneering at everything — but he cares about his friends.' } },
};
export const charOfHouse = (h) => Object.keys(CHARS).find((c) => CHARS[c].house === h);
