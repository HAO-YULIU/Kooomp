// 產生發佈版 dist/：打包遊戲程式、混淆，複製網頁需要的檔案。
// 答案只在 server/（Worker）與 data/，不會進到 dist/。
//   node build.mjs          正式版（混淆）
//   node build.mjs --plain  不混淆，方便除錯
import { build } from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { rmSync, mkdirSync, cpSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const plain = process.argv.includes('--plain');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// 1. 遊戲程式
const out = await build({
  entryPoints: [join(ROOT, 'game/src/main.mjs')],
  bundle: true, format: 'esm', minify: true, write: false, target: ['es2022'],
  external: ['three'], // three.js 不混淆，用 import map 另外載入（dist/vendor/），檔案小很多
  legalComments: 'none', charset: 'utf8',
});
let code = out.outputFiles[0].text;
if (!plain) {
  code = JavaScriptObfuscator.obfuscate(code, {
    compact: true, stringArray: true, stringArrayThreshold: 0.5, stringArrayEncoding: ['base64'],
    identifierNamesGenerator: 'hexadecimal', renameGlobals: false, selfDefending: false, simplify: true,
    target: 'browser', sourceMap: false,
  }).getObfuscatedCode();
}
writeFileSync(join(DIST, 'app.js'), code);

// 2. 網頁與素材
for (const f of ['index.html', 'style.css', 'manifest.webmanifest', 'icon.png']) cpSync(join(ROOT, 'game', f), join(DIST, f));
cpSync(join(ROOT, 'prototype/vendor/supabase.js'), join(DIST, 'vendor/supabase.js'));
cpSync(join(ROOT, 'prototype/vendor/three.module.min.js'), join(DIST, 'vendor/three.module.min.js'));
if (existsSync(join(ROOT, 'assets'))) cpSync(join(ROOT, 'assets'), join(DIST, 'assets'), { recursive: true });
if (existsSync(join(ROOT, 'game/img'))) cpSync(join(ROOT, 'game/img'), join(DIST, 'img'), { recursive: true }); // 選角色的頭像、登入畫面的背景
if (existsSync(join(ROOT, 'game/models'))) cpSync(join(ROOT, 'game/models'), join(DIST, 'models'), { recursive: true }); // 角色模型（帳號二，game/src/art/）

// 3. 檢查：發佈版裡不能有答案資料
const leak = ['鐘在井底', 'THE BELL LIES IN THE WELL', 'SOLVE VINCULA', 'grimoire:11', '1,6,11,16,15,14,13'];
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
for (const f of walk(DIST).filter((f) => ['.js', '.html', '.css', '.json'].includes(extname(f)))) {
  const text = readFileSync(f, 'utf8');
  for (const w of leak) if (text.includes(w)) { console.error(`✘ 發佈版裡出現答案「${w}」：${f}`); process.exit(1); }
}
const size = (statSync(join(DIST, 'app.js')).size / 1024).toFixed(0);
console.log(`✔ dist/ 完成（app.js ${size} KB${plain ? '，未混淆' : ''}）`);
