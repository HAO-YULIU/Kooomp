// 電腦和「魔杖手機」之間的連線：用夜語工作室同一個 Supabase 專案的即時廣播頻道。
// 只用廣播（broadcast），不寫任何資料表，所以不會碰到其他遊戲的資料。頻道名稱加 ml_ 前綴。
// vendor/supabase.js 是官方 UMD 版，載入後在 window.supabase。

const SUPABASE_URL = 'https://umlnwzpmjxktfzjvcbts.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8J3VI8dijlCccHQbXPfCQQ_v_O0Au3w';

let client = null;
const getClient = () => (client ||= window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } }));

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 拿掉 0/O、1/I 這種容易看錯的
export const makeCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => ALPHABET[b % ALPHABET.length]).join('');

/**
 * 加入配對頻道。role 是 'host'（電腦）或 'wand'（手機）。
 * onMessage({ type, ... }) 收到對方送來的訊息；onStatus('connecting' | 'ready' | 'error')。
 */
export function joinWandLink(code, role, { onMessage, onStatus } = {}) {
  const ch = getClient().channel(`ml_wand_${code}`, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'msg' }, ({ payload }) => onMessage?.(payload));
  onStatus?.('connecting');
  ch.subscribe((s) => {
    if (s === 'SUBSCRIBED') { onStatus?.('ready'); send({ type: 'hello', role }); }
    else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') onStatus?.('error');
  });
  const send = (payload) => ch.send({ type: 'broadcast', event: 'msg', payload });
  return { send, leave: () => getClient().removeChannel(ch) };
}
