// 產生配音台詞表 docs/11-voice-script.md（台詞改了就重跑：node tools/voice-script.mjs）
import { writeFileSync } from 'node:fs';
import { SCRIPT, SPEAKERS } from '../game/src/data/story-ch1.mjs';

const WHERE = { prologue: '序幕', act1: '第一幕', act2: '第二幕', act3a: '第三幕', act3b: '第三幕', act3c: '第三幕', act4: '第四幕', epilogue: '尾聲' };
const rows = {}, narr = [];
for (const [key, lines] of Object.entries(SCRIPT)) lines.forEach(([who, zh, en], i) => {
  const id = `${key.replace(/:/g, '_')}_${i + 1}`;
  if (/^[（(][^）)]*[）)]$/.test(zh) || zh === '……' || zh === '…') return; // 整句都是括號（操作說明、動作）、沒有字的不用錄
  (who ? (rows[who] ??= []) : narr).push({ id, key, zh, en });
});
const esc = (s) => s.replace(/\|/g, '｜');
let md = `# 配音台詞表（自動產生：\`node tools/voice-script.mjs\`）

製作人說可以幫忙配音（2026-10-28）。錄好的檔案傳給帳號二，放進 \`assets/audio/voice/zh/\`（英文版放 \`en/\`），遊戲裡那句台詞出現時就會播。

## 錄音方式
- **一句一個檔**，檔名用下面表格的「檔名」（例如 \`segment_act2_3.mp3\`）。檔名打錯也沒關係，傳來時說是哪一句就好。
- 格式：mp3 或手機錄音（m4a）都可以，我會轉檔、去掉前後空白、調整音量。
- 不用每一句都錄：先錄 **★ 的句子**（最有感覺的），其他之後再說。
- 括號裡是語氣說明（例如「（看了艾洛拉一眼，什麼都沒說）」這種動作描述不用唸）。
- 旁白（沒有角色的那些敘述）可以不錄，只顯示字也很有氣氛；要錄的話在最後面。

`;
const STAR = new Set(['warden', 'elora', 'mirror']);
for (const [who, list] of Object.entries(rows)) {
  md += `\n## ${SPEAKERS[who]?.zh ?? who}（${SPEAKERS[who]?.en ?? who}）— ${list.length} 句\n\n| | 檔名 | 中文 | English |\n|---|---|---|---|\n`;
  for (const r of list) md += `| ${STAR.has(who) || /姊姊|你也是|跑！/.test(r.zh) ? '★' : ''} | \`${r.id}\` | ${esc(r.zh)} | ${esc(r.en)} |\n`;
}
md += `\n## 旁白（可以不錄）— ${narr.length} 句\n\n| 檔名 | 中文 | English |\n|---|---|---|\n`;
for (const r of narr) md += `| \`${r.id}\` | ${esc(r.zh)} | ${esc(r.en)} |\n`;
writeFileSync(new URL('../docs/11-voice-script.md', import.meta.url), md);
console.log('✔ docs/11-voice-script.md', Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.length])), 'narration', narr.length);
