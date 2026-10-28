// 用法：node tools/texwebp.cjs 輸入.glb 輸出.glb [品質 85]（需要 sharp：npm i sharp）。2026-10-28 角色模型用這個從 20.6MB 降到 13.9MB；gltfpack 重新壓縮會讓衣服出現光影雜點，所以只換貼圖
// 只把 GLB 裡的顏色貼圖（baseColor）換成 WebP，幾何、骨架、表情完全不動（重新排列二進位資料、改 offset）
const fs = require('fs'), sharp = require('sharp');
(async () => {
  const [inp, out, q = '85'] = process.argv.slice(2);
  const b = fs.readFileSync(inp); const jl = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + jl).toString());
  const binStart = 20 + jl + 8, bin = b.slice(binStart, binStart + b.readUInt32LE(20 + jl));
  const color = new Set(); for (const m of j.materials ?? []) { const t = m.pbrMetallicRoughness?.baseColorTexture; if (t) color.add(j.textures[t.index].source); }
  const repl = new Map(); // bufferView → 新的位元組
  for (const i of color) { const im = j.images[i]; if (im.bufferView == null || !/png|jpeg/.test(im.mimeType)) continue; const bv = j.bufferViews[im.bufferView]; const src = bin.slice(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength); const w = await sharp(src).webp({ quality: +q }).toBuffer(); if (w.length < src.length) { repl.set(im.bufferView, w); im.mimeType = 'image/webp'; } }
  // 所有指向 buffer 0 的區段（一般的 bufferView、meshopt 壓縮的區段）
  const ranges = [];
  j.bufferViews.forEach((bv, i) => { if ((bv.buffer ?? 0) === 0 && !bv.extensions?.EXT_meshopt_compression) ranges.push({ obj: bv, off: bv.byteOffset ?? 0, len: bv.byteLength, data: repl.get(i) }); const ex = bv.extensions?.EXT_meshopt_compression; if (ex && (ex.buffer ?? 0) === 0) ranges.push({ obj: ex, off: ex.byteOffset ?? 0, len: ex.byteLength }); });
  ranges.sort((a, c) => a.off - c.off);
  const parts = []; let pos = 0;
  for (const r of ranges) { const pad = (4 - (pos % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); pos += pad; } const d = r.data ?? bin.slice(r.off, r.off + r.len); r.obj.byteOffset = pos; r.obj.byteLength = d.length; parts.push(d); pos += d.length; }
  const pad = (4 - (pos % 4)) % 4; if (pad) parts.push(Buffer.alloc(pad));
  const nb = Buffer.concat(parts); j.buffers[0].byteLength = nb.length;
  let js = Buffer.from(JSON.stringify(j)); const jp = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + nb.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); const bh = Buffer.alloc(8); bh.writeUInt32LE(nb.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(out, Buffer.concat([head, jh, js, bh, nb]));
  console.log(inp.split('/').pop(), b.length, '->', 12 + 16 + js.length + nb.length, 'webp', repl.size);
})();
