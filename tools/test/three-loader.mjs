// 測試用：遊戲在瀏覽器用 import map 載入 three（prototype/vendor/three.module.min.js），Node 裡照樣對應過去
const THREE_URL = new URL('../../prototype/vendor/three.module.min.js', import.meta.url).href;
export async function resolve(spec, ctx, next) { return spec === 'three' ? { url: THREE_URL, shortCircuit: true } : next(spec, ctx); }
