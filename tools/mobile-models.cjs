// 手機版模型（2026-11-01）：把 game/models/props、chars 裡每個 GLB 的貼圖事先縮小，放到 props-m、chars-m。
// 手機直接下載小的：不用先把 1024 的大圖整張解開再縮（載入很慢、記憶體會爆）。電腦版還是用原本的。
//   顏色貼圖最大 512；凹凸、粗糙度等最大 256（角色）／128（擺設）；擺設的凹凸貼圖拿掉（換成 1×1，材質裡也不再用）。
// 用法：cd tools && node mobile-models.cjs（模型換了就重跑）
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const ROOT = path.join(__dirname, '../game/models');

async function slim(inp, out, kind) {
  const b = fs.readFileSync(inp); const jl = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + jl).toString());
  const binStart = 20 + jl + 8, bin = b.slice(binStart, binStart + b.readUInt32LE(20 + jl));
  const role = {}; // 圖 → 'c'（顏色）/'n'（凹凸）/'o'（其他）
  const mark = (t, r) => { if (!t) return; const s = j.textures[t.index].source; if (s != null && !(role[s] === 'c')) role[s] = role[s] && r !== 'c' ? role[s] : r; };
  for (const m of j.materials ?? []) { const p = m.pbrMetallicRoughness ?? {}; mark(p.baseColorTexture, 'c'); mark(m.emissiveTexture, 'c'); mark(m.normalTexture, 'n'); mark(p.metallicRoughnessTexture, 'o'); mark(m.occlusionTexture, 'o'); }
  const prop = kind === 'prop';
  if (prop) for (const m of j.materials ?? []) delete m.normalTexture; // 擺設：不用凹凸貼圖
  const repl = new Map();
  for (const [i, im] of (j.images ?? []).entries()) {
    if (im.bufferView == null) continue;
    const bv = j.bufferViews[im.bufferView], src = bin.slice(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    const r = role[i] ?? 'o', max = r === 'c' ? 512 : prop ? 128 : 256;
    let img = sharp(src);
    if (prop && r === 'n') { repl.set(im.bufferView, await sharp({ create: { width: 1, height: 1, channels: 3, background: '#8080ff' } }).webp().toBuffer()); im.mimeType = 'image/webp'; continue; }
    const meta = await img.metadata(); if (Math.max(meta.width, meta.height) > max) img = img.resize({ width: meta.width >= meta.height ? max : null, height: meta.height > meta.width ? max : null });
    const w = await img.webp({ quality: r === 'c' ? 82 : 75, alphaQuality: 90 }).toBuffer();
    if (w.length < src.length || Math.max(meta.width, meta.height) > max) { repl.set(im.bufferView, w); im.mimeType = 'image/webp'; }
  }
  // 重新排列二進位資料（跟 texwebp.cjs 一樣；meshopt 壓縮的區段一起搬）
  const ranges = [];
  j.bufferViews.forEach((bv, i) => { if ((bv.buffer ?? 0) === 0 && !bv.extensions?.EXT_meshopt_compression) ranges.push({ obj: bv, off: bv.byteOffset ?? 0, len: bv.byteLength, data: repl.get(i) }); const ex = bv.extensions?.EXT_meshopt_compression; if (ex && (ex.buffer ?? 0) === 0) ranges.push({ obj: ex, off: ex.byteOffset ?? 0, len: ex.byteLength }); });
  ranges.sort((a, c) => a.off - c.off);
  const parts = []; let pos = 0;
  for (const r of ranges) { const pad = (4 - (pos % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); pos += pad; } const d = r.data ?? bin.slice(r.off, r.off + r.len); r.obj.byteOffset = pos; r.obj.byteLength = d.length; parts.push(d); pos += d.length; }
  const pad = (4 - (pos % 4)) % 4; if (pad) parts.push(Buffer.alloc(pad));
  const nb = Buffer.concat(parts); j.buffers[0].byteLength = nb.length;
  if (j.extensionsUsed?.includes('EXT_texture_webp') === false && repl.size) { /* three.js 不需要宣告也讀得到 webp 的 mimeType */ }
  let js = Buffer.from(JSON.stringify(j)); const jp = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + nb.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); const bh = Buffer.alloc(8); bh.writeUInt32LE(nb.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(out, Buffer.concat([head, jh, js, bh, nb]));
  return [b.length, 12 + 16 + js.length + nb.length];
}

(async () => {
  for (const [dir, kind] of [['props', 'prop'], ['chars', 'char']]) {
    const from = path.join(ROOT, dir), to = path.join(ROOT, dir + '-m'); fs.mkdirSync(to, { recursive: true });
    let a = 0, z = 0;
    for (const f of fs.readdirSync(from)) {
      if (f.endsWith('.glb')) { const [x, y] = await slim(path.join(from, f), path.join(to, f), kind); a += x; z += y; }
      else if (f.endsWith('.json')) fs.copyFileSync(path.join(from, f), path.join(to, f));
    }
    console.log(dir, (a / 1e6).toFixed(1), 'MB ->', (z / 1e6).toFixed(1), 'MB');
  }
})();
