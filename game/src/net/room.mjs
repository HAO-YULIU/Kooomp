// 跟房間的即時連線（Cloudflare Worker 上的 /api/rooms/:code/ws）。
// 斷線會自動重連；request() 會等伺服器回覆同一個 id 的訊息。
import { token } from './platform.mjs';

export async function createRoom(mode, lang) {
  const r = await fetch('/api/rooms', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
    body: JSON.stringify({ mode, lang }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'network');
  return data.code;
}

// 加入前先問房間的狀態，才能顯示「找不到房號」「已經滿了」這類訊息（WebSocket 連不上時瀏覽器看不到原因）
// 有登入就帶 token：伺服器會說你是不是這個房間的成員（已經開始的房間，成員可以回來繼續玩）
export async function roomInfo(code) {
  const r = await fetch(`/api/rooms/${code}`, { headers: { authorization: `Bearer ${await token()}` } });
  return r.json().catch(() => ({ error: 'network' }));
}

// 自己的存檔：最近在玩的房間（last）、第一章的通關紀錄（ch1）
export async function mySave() {
  const r = await fetch('/api/me', { headers: { authorization: `Bearer ${await token()}` } }).catch(() => null);
  return r?.ok ? r.json() : {};
}

export function connectRoom(code, { uiLang, onMessage, onStatus }) {
  let ws = null, closed = false, tries = 0, nextId = 1;
  const waiting = new Map(); // id → resolve

  async function open() {
    onStatus?.(tries ? 'reconnecting' : 'connecting');
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/api/rooms/${code}/ws?lang=${uiLang}`, ['milner', await token()]);
    ws.onopen = () => { tries = 0; onStatus?.('open'); };
    ws.onmessage = (e) => {
      let msg; try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
      onMessage?.(msg);
    };
    ws.onclose = (e) => {
      for (const res of waiting.values()) res({ t: 'error', error: 'network' });
      waiting.clear();
      if (closed || e.code === 4000) return onStatus?.('closed');
      // 一開始就連不上（房號錯、房間滿、已開始）：伺服器回的是 HTTP 錯誤，瀏覽器只會看到 1006
      if (tries >= 8) return onStatus?.('failed');
      tries++; onStatus?.('reconnecting');
      setTimeout(open, Math.min(8000, 500 * 2 ** tries));
    };
  }
  open();

  return {
    send(msg) { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)); },
    request(msg) {
      return new Promise((resolve) => {
        if (ws?.readyState !== 1) return resolve({ t: 'error', error: 'network' });
        const id = nextId++; waiting.set(id, resolve);
        ws.send(JSON.stringify({ ...msg, id }));
      });
    },
    close() { closed = true; ws?.close(1000); },
  };
}
