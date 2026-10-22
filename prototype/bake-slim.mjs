// 角色減面：只簡化身體皮膚、細髮絲、鞋子（面很多、簡化看不太出來），袍子、衣服不動（簡化會把滾邊的顏色弄花）
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplifyPrimitive, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const [, , inp, out, rules] = process.argv;
const R = JSON.parse(rules); // { 材質名稱的正規表示式: 保留比例 }
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
await doc.transform(weld());
let before = 0, after = 0;
const tri = (p) => (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  const name = prim.getMaterial()?.getName() || 'cloth', t0 = tri(prim); before += t0;
  const rule = Object.entries(R).find(([re]) => new RegExp(re).test(name));
  if (rule && t0 > 1000) { simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: rule[1][0] ?? rule[1], error: rule[1][1] ?? 0.006, lockBorder: rule[1][2] ?? true }); console.log(name, t0, '→', tri(prim)); }
  after += tri(prim);
}
console.log('total', before, '→', after);
await io.write(out, doc);
