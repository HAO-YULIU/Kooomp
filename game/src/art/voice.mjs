// 台詞配音（帳號二，2026-10-28）：製作人錄的台詞放在 assets/audio/voice/<zh|en>/<檔名>.mp3，並列在 assets/audio/voice/list.json。
// 檔名＝劇情的代號（冒號換成底線）＋第幾句，例如 segment:act2 的第 3 句 → zh/segment_act2_3.mp3（對照表見 docs/11-voice-script.md）。
// 有音檔就在那句台詞出現時播放，換下一句時停掉；沒有就照舊只顯示字。
import { SCRIPT } from '../data/story-ch1.mjs';

const ID = new WeakMap(); // 台詞（陣列本身）→ 檔名
for (const [key, lines] of Object.entries(SCRIPT)) lines.forEach((l, i) => ID.set(l, `${key.replace(/:/g, '_')}_${i + 1}`));
export const voiceId = (line) => ID.get(line);

let have = new Set();
fetch('assets/audio/voice/list.json').then((r) => (r.ok ? r.json() : [])).then((l) => { have = new Set(l); }).catch(() => { /* 沒有清單：都不配音 */ });
const el = typeof Audio !== 'undefined' ? new Audio() : null;
const volume = () => { try { return Math.min(1, +(localStorage.getItem('ml_volume') ?? 1)); } catch { return 1; } };

/** 播這句台詞的配音（有的話）；回傳有沒有播 */
export function playVoice(line, lang) {
  stopVoice();
  const id = ID.get(line), f = id && `${lang === 'en' ? 'en' : 'zh'}/${id}.mp3`;
  if (!el || !f || !have.has(f)) return false;
  el.src = `assets/audio/voice/${f}`; el.volume = volume(); el.play().catch(() => { /* 還沒點過畫面：瀏覽器不讓播 */ });
  return true;
}
export function stopVoice() { if (el && !el.paused) el.pause(); }
