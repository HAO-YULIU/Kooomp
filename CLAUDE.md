# 《魔蝕milner》

夜語工作室的新作：米爾納學校（西方魔法學院）為舞台、第一人稱、1～4 人的**恐怖**解謎網頁遊戲。儲存庫名稱是 Kooomp。

## 每次開工先做這三件事
這個專案由**兩個帳號同時開發**，彼此看不到對方的對話，所以一切以儲存庫裡的文件為準。
1. 先讀 `docs/DECISIONS.md`（製作人確認過的決定，不要自己推翻）和 `docs/PROGRESS.md`（目前進度、誰在做什麼）。
2. 先拉最新的 `main`（`git fetch origin main`），把它合併進自己的分支再開始。
3. 開始做一件事之前，先在 `docs/PROGRESS.md` 的「進行中」登記（寫上分支名稱、在做什麼、會動到哪些檔案），commit 並推上去。別人登記過的區域不要動，要動的話先問製作人。

## 收工前
- 更新 `docs/PROGRESS.md`：做完什麼、做到哪、下一步、還在等製作人回答什麼。從「進行中」移除自己的登記。
- 製作人新確認的決定寫進 `docs/DECISIONS.md`（附日期）。
- commit、推上自己的分支，再合併進 `main`（先合併最新的 `main` 進來、解決衝突）。

## 程式在哪裡、怎麼跑
- `game/`：遊戲畫面原始碼（發佈前由 build 打包混淆）。`server/`：Cloudflare Worker＋房間（Durable Object），**答案只在伺服器判斷**。`data/puzzles/`：答案與提示（不發佈）。`prototype/`：技術雛形與美術（帳號二）。
- 發佈版是 `dist/`（不 commit），由 `tools/build.mjs` 產生；Cloudflare（Worker：`kooomp`，https://kooomp.noron.workers.dev/）照 `wrangler.jsonc` 自動 build、部署（推上 `main` 就會更新）。
- 本機：`cd tools && npm install && npm run build:plain`，再 `npx --prefix tools wrangler dev`，網址加 `?dev=名字` 免登入並顯示測試作答面板。
- 測試：`cd tools && npm test`（答案判斷＋房間整合測試）。
- 寫答案的規則：答案只放 `data/puzzles/`，畫面（`game/`）裡不能出現答案；build 會檢查。要顯示答案（例如 P06 解開後的時辰）由伺服器回傳 `reveal`。

## 兩個帳號的分工（2026-10-21 製作人確認）
- 帳號一（`claude/loving-brahmagupta-mhxt6t`）：伺服器（`supabase/`）、遊戲資料與謎題（`data/`）、房間與同步、作答、劇情系統（`game/src/net/`、`game/src/logic/`）、build 與發佈、測試（`tools/`）。
- 帳號二（`claude/sweet-goldberg-nklgb6`）：角色模型與動畫、場景美術、守夜人外型與蝕化演出、魔杖（`game/src/art/`、`game/models/`、`prototype/`）。
- 共用的資料格式（例如場景裡謎題物件的位置）由帳號一先定，帳號二照格式擺放。要動對方的資料夾，先在 PROGRESS.md 講好。

## 開發方式
- 依 `docs/PLAN.md` 的階段進行，**每個階段做完都停下來等製作人確認**，確認後才進入下一階段。
- 跟製作人溝通用繁體中文，用詞淺白，不要用太多工程術語。
- 還沒決定的事不要自己定案：寫進 `docs/PROGRESS.md` 的「等製作人回答」，可以附上建議。

## 參考的既有作品（同一位製作人，可以參考做法）
- `HAO-YULIU/hospital-`（千山夜錄）：夜語工作室大廳登入、Supabase 多人房間、伺服器判斷答案、Edge Function。多人與登入的做法以它為範本（`src/game/platform.mjs`、`src/game/net.mjs`、`supabase/`）。
- `HAO-YULIU/arg`、`HAO-YULIU/Bang`：`_build/build.mjs` 產生 `dist/`（答案雜湊、JS 混淆）、Cloudflare Workers 部署。
- `HAO-YULIU/escape-room`：夜語工作室大廳本身。
