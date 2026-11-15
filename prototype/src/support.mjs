// 配角（校長、背景學生）：2026-10-21 製作人：「大家都要有五官」，所以不用沒有五官的人體雛形、眼睛空白的「72」，
// 全部改用有臉、有骨架的 Character Creator 模型，用髮型、兜帽、鬍子讓他們跟主角看起來不一樣。
// 學生穿制服（襯衫）＋學院色巫師袍，樣式都一樣，只有顏色不同（製作人：配角衣服一樣沒關係）。
import * as THREE from 'three';
import { loadCC } from './cc.mjs';
import { loadHairSet } from './hairbank.mjs';
import { makeBeard, makeHood } from './extras.mjs';

export const HOUSE_ROBES = {
  eldrin: { color: '#c9cfdb', trim: '#5f8fc8', jkHue: 212 },
  grimoire: { color: '#4a1218', trim: '#d8c49a', jkHue: 352 },
  belmont: { color: '#17171b', trim: '#b8902e', jkHue: 40 },
  ouroboros: { color: '#12301f', trim: '#c0c4c8', jkHue: 150 },
};
const STUDENT_ROBE = { name: 'robe', hem: 0.12, sleeveFlare: 0.04, openTop: 0.07, openWaist: 0.045, openHem: 0.3 };
const student = (house, female) => {
  const h = HOUSE_ROBES[house];
  return [female ? { name: 'jk', hue: h.jkHue, sat: 1.1, noSleeves: true } : { name: 'boy', noSleeves: true }, { ...STUDENT_ROBE, color: h.color, trim: h.trim }];
};
// 頭上的零件合成一組（髮型＋兜帽／鬍子）；眼距用髮型的（戴到別的頭上時換算大小）
async function gear(hair, extra = []) {
  const g = new THREE.Group();
  if (hair) { const h = await loadHairSet(hair); g.add(h); g.userData.eyeWidth = h.userData.eyeWidth; }
  for (const e of extra) g.add(e);
  return g;
}

export const SUPPORT = {
  // 校長：沃恩的臉，白色油頭、長白鬍子，紫金色長袍（前面合起來）
  aldric: async (scene) => loadCC(scene, { body: 'male', hair: '#e4e0d8', hairTip: '#f4f0e8', skin: '#e8c4aa', height: 1.02, cloak: false, armDrop: 1.15,
    headGear: await gear(null, [makeBeard('#ece8e0')]),
    outfit: [{ name: 'robe', color: '#2e1a3a', trim: '#c8a24a', hem: 0.08, sleeveFlare: 0.08, openTop: 0, openWaist: 0, openHem: 0 }] }),
  // 男學生（艾爾德林）：沃恩的臉，換成月晞的空氣瀏海（栗色）
  studentEldrin: async (scene) => loadCC(scene, { body: 'male', skin: '#e6c2a6', height: 0.97, cloak: false, armDrop: 1.15, hideHair: true,
    headGear: await gear([{ from: 'female', parts: ['Air_bangs', 'Double_high'], hair: '#5a3a22', hairTip: '#8a6040' }]), outfit: student('eldrin', false) }),
  // 男學生（貝爾蒙特）：沃恩的臉、深色油頭、戴兜帽
  studentBelmont: async (scene) => loadCC(scene, { body: 'male', hair: '#16110d', hairTip: '#2a2018', skin: '#d8b090', height: 0.99, cloak: false, armDrop: 1.15,
    headGear: await gear(null, [makeHood(HOUSE_ROBES.belmont.color, { drape: false })]), outfit: student('belmont', false) }),
  // 女學生（格里莫瓦）：月晞的臉，換成艾洛拉的短捲髮（深棕）
  studentGrimoire: async (scene) => loadCC(scene, { body: 'female', skin: '#efcdb4', height: 0.96, cloak: false, armDrop: 1.12, hideHair: true,
    headGear: await gear([{ from: 'elora', parts: ['Scalp'], hair: '#2a1a12', hairTip: '#4a3020' }]), outfit: student('grimoire', true) }),
  // 女學生（烏洛波斯）：艾洛拉的臉，月晞的雙丸子頭（淺金）、戴兜帽
  studentOuroboros: async (scene) => loadCC(scene, { body: 'elora', skin: '#f0d0bc', height: 0.9, cloak: false, armDrop: 1.12, hideHair: true,
    headGear: await gear([{ from: 'female', parts: ['Air_bangs'], hair: '#b89a60', hairTip: '#e0c890' }], [makeHood(HOUSE_ROBES.ouroboros.color, { drape: false })]), outfit: student('ouroboros', true) }),
};
