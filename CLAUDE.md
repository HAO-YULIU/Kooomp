# 米爾納學校（Kooomp，暫定名稱）

夜語工作室的新作：西方魔法學院主題、第一人稱、1～4 人的網頁解謎遊戲。**不是恐怖遊戲。**

## 每次開工先做這三件事
這個專案由**兩個帳號同時開發**，彼此看不到對方的對話，所以一切以儲存庫裡的文件為準。
1. 先讀 `docs/DECISIONS.md`（製作人確認過的決定，不要自己推翻）和 `docs/PROGRESS.md`（目前進度、誰在做什麼）。
2. 先拉最新的 `main`（`git fetch origin main`），把它合併進自己的分支再開始。
3. 開始做一件事之前，先在 `docs/PROGRESS.md` 的「進行中」登記（寫上分支名稱、在做什麼、會動到哪些檔案），commit 並推上去。別人登記過的區域不要動，要動的話先問製作人。

## 收工前
- 更新 `docs/PROGRESS.md`：做完什麼、做到哪、下一步、還在等製作人回答什麼。從「進行中」移除自己的登記。
- 製作人新確認的決定寫進 `docs/DECISIONS.md`（附日期）。
- commit、推上自己的分支，再合併進 `main`（先合併最新的 `main` 進來、解決衝突）。

## 開發方式
- 依 `docs/PLAN.md` 的階段進行，**每個階段做完都停下來等製作人確認**，確認後才進入下一階段。
- 跟製作人溝通用繁體中文，用詞淺白，不要用太多工程術語。
- 還沒決定的事不要自己定案：寫進 `docs/PROGRESS.md` 的「等製作人回答」，可以附上建議。

## 參考的既有作品（同一位製作人，可以參考做法）
- `HAO-YULIU/hospital-`（千山夜錄）：夜語工作室大廳登入、Supabase 多人房間、伺服器判斷答案、Edge Function。多人與登入的做法以它為範本（`src/game/platform.mjs`、`src/game/net.mjs`、`supabase/`）。
- `HAO-YULIU/arg`、`HAO-YULIU/Bang`：`_build/build.mjs` 產生 `dist/`（答案雜湊、JS 混淆）、Cloudflare Workers 部署。
- `HAO-YULIU/escape-room`：夜語工作室大廳本身。
