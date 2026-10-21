// 驗證夜語工作室的登入（Supabase）。遊戲網頁把登入後拿到的 access token 送過來，這裡向 Supabase 確認是誰。
// 本機開發與測試：環境變數 DEV_AUTH=1 時，接受「dev-名字」這種假的 token（正式環境不會設定）。
// 製作人測試用登入：Cloudflare 後台設定祕密 TEST_PASS 後，接受「test.密碼.名字」（網址 ?test=密碼&name=名字）。沒設定就不能用。

const cache = new Map(); // token → { uid, name, until }

export async function whoIs(env, token) {
  if (!token) return null;
  if (env.DEV_AUTH === '1' && token.startsWith('dev-')) {
    const name = decodeURIComponent(token.slice(4)) || '測試玩家';
    return { uid: token, name };
  }
  if (token.startsWith('test.')) {
    const [, pass, name] = token.split('.');
    if (!env.TEST_PASS || !pass || !same(decodeURIComponent(pass), env.TEST_PASS)) return null;
    const n = decodeURIComponent(name ?? '').trim().slice(0, 16) || '測試玩家';
    return { uid: `test-${n}`, name: n, test: true };
  }
  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit;

  const headers = { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${token}` };
  const u = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers });
  if (!u.ok) return null;
  const user = await u.json();
  if (!user?.id) return null;
  // 暱稱在大廳的 profiles；沒有暱稱的帳號要先回大廳建立角色
  const p = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=username`, { headers });
  const row = p.ok ? (await p.json())[0] : null;
  if (!row?.username) return { uid: user.id, name: null };

  const who = { uid: user.id, name: row.username, until: Date.now() + 5 * 60 * 1000 };
  cache.set(token, who);
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return who;
}

// 比對密碼（逐字比完，不提早結束）
function same(a, b) {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
