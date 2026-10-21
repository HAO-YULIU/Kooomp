// 每個玩家一個存檔（Cloudflare Durable Object，用玩家的 uid 當名字）。不用夜語工作室的 Supabase，不會動到大廳。
//   last：最近在玩的房間（選單的「繼續上次的遊戲」）
//   ch1：第一章的通關紀錄（最近一次）；ch1First：第一次通關的紀錄。第二章開頭會用到：莉安娜筆記、西里爾的抉擇、有沒有人被抓走過
// 只有 Room（伺服器自己）會寫，玩家只能讀自己的。
import { DurableObject } from 'cloudflare:workers';

export class Profile extends DurableObject {
  async fetch(req) {
    const url = new URL(req.url);
    const get = async () => (await this.ctx.storage.get('save')) ?? {};
    if (url.pathname === '/get') return Response.json(await get());
    if (req.method !== 'POST') return new Response('not found', { status: 404 });
    const body = await req.json().catch(() => ({}));
    const save = await get();
    if (url.pathname === '/last') { // 房間進度改變時更新；房間結束（通關）就清掉
      if (body.clear) { if (save.last?.code === body.code) delete save.last; } else save.last = body;
    }
    if (url.pathname === '/clear-ch1') { // 通關：記下結果
      save.ch1 = body; save.ch1First ??= body;
      save.cleared = [...new Set([...(save.cleared ?? []), 1])];
      if (save.last?.code === body.code) delete save.last;
    }
    save.updated = Date.now();
    await this.ctx.storage.put('save', save);
    return Response.json(save);
  }
}
