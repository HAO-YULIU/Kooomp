// Cloudflare Worker：網頁（dist/）＋遊戲 API。
// - POST /api/rooms                建立房間（單人也是一個只有一人的房間），回傳房號
// - GET  /api/rooms/:code          房間的公開資訊（存不存在、開始了沒、幾個人），加入前先檢查
// - GET  /api/me                   自己的存檔（最近在玩的房間、第一章的通關紀錄）
// - GET  /api/rooms/:code/ws        加入房間的即時連線（WebSocket）。登入 token 放在 Sec-WebSocket-Protocol：['milner', token]
// 其他網址交給靜態檔案（dist/）。
import { whoIs } from './auth.mjs';
export { Room } from './room.mjs';
export { Profile } from './profile.mjs';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 拿掉 0/O、1/I
const makeCode = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => ALPHABET[b % ALPHABET.length]).join('');
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const fail = (error, status = 400) => json({ error }, status);
const bearer = (req) => (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    // 建立房間
    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      const who = await whoIs(env, bearer(req));
      if (!who) return fail('need_login', 401);
      if (!who.name) return fail('need_player', 403);
      const body = await req.json().catch(() => ({}));
      const mode = body.mode === 'solo' ? 'solo' : 'multi';
      const lang = body.lang === 'en' ? 'en' : 'zh';
      for (let i = 0; i < 8; i++) {
        const code = makeCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, mode, lang, host: who.uid }) });
        if (r.status === 201) return json({ code });
      }
      return fail('busy', 503);
    }

    // 自己的存檔
    if (url.pathname === '/api/me' && req.method === 'GET') {
      const who = await whoIs(env, bearer(req));
      if (!who) return fail('need_login', 401);
      const r = await env.PROFILES.get(env.PROFILES.idFromName(who.uid)).fetch('https://profile/get');
      return json(await r.json());
    }

    const info = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{4})$/);
    if (info && req.method === 'GET') {
      const stub = env.ROOMS.get(env.ROOMS.idFromName(info[1]));
      const who = bearer(req) ? await whoIs(env, bearer(req)) : null; // 有登入：順便告訴他是不是成員
      return stub.fetch('https://room/info', { headers: who ? { 'x-uid': who.uid } : {} });
    }

    // 加入房間（WebSocket）
    const m = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{4})\/ws$/);
    if (m) {
      if (req.headers.get('upgrade') !== 'websocket') return fail('need_websocket', 426);
      const protos = (req.headers.get('sec-websocket-protocol') ?? '').split(',').map((s) => s.trim());
      const token = protos[0] === 'milner' ? protos[1] : '';
      const who = await whoIs(env, token);
      if (!who) return fail('need_login', 401);
      if (!who.name) return fail('need_player', 403);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
      const h = new Headers(req.headers);
      h.set('x-uid', who.uid); h.set('x-name', encodeURIComponent(who.name));
      h.set('x-dev', who.dev ? '1' : '0'); // 一定要蓋掉：玩家自己送來的 x-dev 不算
      h.set('x-ui-lang', url.searchParams.get('lang') === 'en' ? 'en' : 'zh');
      return stub.fetch(new Request('https://room/join', { headers: h }));
    }

    return fail('not_found', 404);
  },
};
