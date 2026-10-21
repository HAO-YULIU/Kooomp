// 夜語工作室平台：登入（大廳帶過來的一次性登入碼 #sd=…）、取得 token。做法跟千山夜錄一樣。
// 本機測試：網址加 ?dev=名字，用假的登入（只有本機伺服器開了 DEV_AUTH 才會接受）。
export const LOBBY = 'https://hao-yuliu.github.io/escape-room/';
export const SLUG = 'milner';
const SUPABASE_URL = 'https://umlnwzpmjxktfzjvcbts.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8J3VI8dijlCccHQbXPfCQQ_v_O0Au3w';

let sb = null;
const client = () => (sb ||= window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY));
const devName = new URLSearchParams(location.search).get('dev');

export const lobbyGate = () => `${LOBBY}?need=player&room=${SLUG}#rooms`;

// 回傳 { uid, name } 或 { uid, name: null }（沒有暱稱）或 null（沒登入）
export async function signIn() {
  if (devName !== null) return { uid: `dev-${devName}`, name: devName || '測試玩家', dev: true };
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

// 每次連線前拿最新的 token（Supabase 會自動更新）
export async function token() {
  if (devName !== null) return `dev-${encodeURIComponent(devName || '測試玩家')}`;
  const { data: { session } } = await client().auth.getSession();
  return session?.access_token ?? '';
}
