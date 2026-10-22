// 美術（帳號二）的入口：import 一次，就會把所有美術掛鉤註冊好（要在蓋場景、建立守夜人之前）。
import './warden.mjs';
import './scene.mjs'; // 場景美術、小裝飾
import './react.mjs'; // 謎題的場景反應（要在 scene.mjs 之後，蓋會動的版本）
import './staff.mjs'; // 第一人稱的法杖（掛在相機上）
export { setStaff, staffCast } from './staff.mjs';
export { loadCharacter, setCharacterBase, CHARACTER_KEYS } from './characters.mjs';
export { reactThing, syncSolved, tickRigs } from './react.mjs';
export { tickHaunt, hauntNow } from './haunt.mjs';
export { sfx, sfxPan, step, setAmbience, setVolume, getVolume, setMusic, setTension, hasSound } from './sfx.mjs';
