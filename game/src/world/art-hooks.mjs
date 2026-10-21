// 美術掛鉤：帳號二（美術）在這裡註冊裝飾函式，灰盒場景蓋好每個房間、門、東西時會呼叫。
// 例：decorators.thing.push(({ thing, mesh, group, THREE }) => { if (thing.id === 'mirror') { mesh.visible = false; group.add(載入的鏡子模型); } });
// 規則：位置、大小、碰撞以 game/src/data/world-ch1.mjs 為準；裝飾只換外觀，不要改玩法用到的東西（門的開關、可以調查的範圍）。
export const decorators = { room: [], door: [], thing: [] };
