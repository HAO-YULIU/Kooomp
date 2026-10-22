// 夜語工作室平台：登入（大廳帶過來的一次性登入碼 #sd=…）、取得 token。做法跟千山夜錄一樣。
// 本機測試：網址加 ?dev=名字，用假的登入（只有本機伺服器開了 DEV_AUTH 才會接受）。
export const LOBBY = 'https://lobby.noron.workers.dev/'; // 2026-10-22 製作人：大廳從 GitHub Pages 搬到 Cloudflare
export const SLUG = 'milner';
const SUPABASE_URL = 'https://umlnwzpmjxktfzjvcbts.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8J3VI8dijlCccHQbXPfCQQ_v_O0Au3w';

let sb = null;
const client = () => (sb ||= window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY));
const devName = new URLSearchParams(location.search).get('dev');
// 製作人測試用登入：網址 ?test=密碼&name=名字。讀完就從網址拿掉（避免把密碼分享出去），存在這個分頁裡
const testLogin = (() => {
  const q = new URLSearchParams(location.search);
  if (q.has('test')) {
    const v = { pass: q.get('test'), name: (q.get('name') || '').trim() || `測試${Math.floor(Math.random() * 90 + 10)}`, panel: q.has('panel') };
    try { sessionStorage.setItem('ml_test', JSON.stringify(v)); } catch { /* 無痕 */ }
    q.delete('test'); q.delete('name');
    history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : ''));
    return v;
  }
  try { return JSON.parse(sessionStorage.getItem('ml_test') || 'null'); } catch { return null; }
})();
const enc = (s) => encodeURIComponent(s).replace(/\./g, '%2E'); // 密碼或名字裡有「.」也不會被切開
export const isTest = !!testLogin;
export const testPanel = !!testLogin?.panel;

export const lobbyGate = () => `${LOBBY}?need=player&room=${SLUG}#rooms`;

// 回傳 { uid, name } 或 { uid, name: null }（沒有暱稱）或 null（沒登入）
export async function signIn() {
  if (devName !== null) return { uid: `dev-${devName}`, name: devName || '測試玩家', dev: true };
  if (testLogin) return { uid: `test-${testLogin.name}`, name: testLogin.name, test: true };
  const m = location.hash.match(/(?:^#|&)sd=([^&]+)/);
  if (m) {
    history.replaceState(null, '', location.pathname + location.search);
    try { await client().auth.verifyOtp({ token_hash: decodeURIComponent(m[1]), type: 'magiclink' }); } catch { /* 登入碼過期：照一般流程檢查 */ }
  }
  const { data: { session } } = await client().auth.getSession();
  if (!session?.user) return null;
  const { data: profile } = await client().from('profiles').select('username').eq('id', session.user.id).maybeSingle();
  return { uid: session.user.id, name: profile?.username ?? null };
}

// 開發者登入：遊戲還沒放上大廳（未公開）時，製作人直接用大廳的帳號密碼登入。只有大廳的管理員（admins 表裡有自己）才能進
export async function devLogin(email, password) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error || !data?.user) return { error: 'bad_login' };
  const { data: adm } = await client().from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (!adm) { await client().auth.signOut(); return { error: 'not_dev' }; }
  return { ok: true };
}

// 每次連線前拿最新的 token（Supabase 會自動更新）
export async function token() {
  if (devName !== null) return `dev-${encodeURIComponent(devName || '測試玩家')}`;
  if (testLogin) return `test.${enc(testLogin.pass)}.${enc(testLogin.name)}`;
  const { data: { session } } = await client().auth.getSession();
  return session?.access_token ?? '';
}
