// 美術（帳號二）的入口：import 一次，就會把所有美術掛鉤註冊好（要在蓋場景、建立守夜人之前）。
import './warden.mjs';
import './scene.mjs'; // 序幕、第一幕的場景美術
export { loadCharacter, setCharacterBase, CHARACTER_KEYS } from './characters.mjs';
