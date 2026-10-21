// 掃 QR code 打開的魔杖頁：手機直向，揮動或畫符文，把咒語送到電腦。
import { SPELLS, recognize, attachRuneCanvas, requestMotionPermission, watchGestures } from './spells.mjs';
import { initOrientation, requireOrientation, enterFullscreen } from './orient.mjs';
import { joinWandLink } from './link.mjs';
import * as sfx from './audio.mjs';

const $ = (id) => document.getElementById(id);
const code = (new URLSearchParams(location.search).get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
$('code').textContent = code || '（沒有配對碼）';
initOrientation($('rotate'));
requireOrientation('portrait');

let link = null, connected = false, toastT = 0;
const status = (t) => ($('status').textContent = t);
function toast(text, color) { const t = $('toast'); t.textContent = text; t.style.color = color || '#e8e2d0'; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

function cast(id) {
  const sp = SPELLS[id];
  if (!sp) { sfx.chime('fail'); toast('符文沒有成形……再畫一次', '#a89c8a'); navigator.vibrate?.(20); return; }
  sfx.chime(id); navigator.vibrate?.(60);
  rune.setColor(sp.color); setTimeout(() => rune.setColor('#cfe6ff'), 900);
  toast(`${sp.rune} ${sp.name}`, sp.color);
  if (!connected) { status('還沒連上電腦，咒語沒有送出'); return; }
  link.send({ type: 'cast', spell: id });
}
const rune = attachRuneCanvas($('rune'), (pts) => cast(recognize(pts)?.id));

$('go').addEventListener('click', async () => {
  sfx.initAudio();
  await enterFullscreen(); requireOrientation('portrait');
  $('gate').hidden = true;
  const p = await requestMotionPermission();
  $('wand-motion').textContent = p === 'granted' ? '揮動手機，或用手指畫符文' : '沒有取得動作感測器，請用手指畫符文';
  if (p === 'granted') watchGestures(cast);
  if (!code) { status('網址裡沒有配對碼，請重新掃描電腦上的 QR code'); return; }
  link = joinWandLink(code, 'wand', {
    onStatus: (s) => { if (s === 'connecting') status('連線中……'); if (s === 'ready' && !connected) status('等待電腦回應……'); if (s === 'error') status('連不上伺服器，請檢查網路後重新整理'); },
    onMessage: (m) => {
      if (m.type === 'hello' && m.role === 'host') { if (!connected) navigator.vibrate?.([30, 40, 30]); connected = true; status(`✔ 已連上電腦（配對碼 ${code}）`); }
      if (m.type === 'result' && m.ok) status(`✔ ${SPELLS[m.spell]?.name}：${m.text}`);
    },
  });
});
