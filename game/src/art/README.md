# 美術（帳號二）

## 角色模型
- 檔案：`game/models/chars/<代號>.glb`，每個 5MB 以下。代號照 `docs/08-world-format.md`：`yuexi`、`vaughn`、`elora`、`cyril`、`helga`、`aldric`、`moray`、`knox`。
- 程式：`game/src/art/characters.mjs`

```js
import { loadCharacter } from '../art/characters.mjs';
const c = await loadCharacter('yuexi');   // 下載過一次之後會重複使用（複製）
group.add(c.root);                          // 正面朝 -z，腳底在 y=0，跟 placeAvatar 的方向一致
// 每一格：
c.update(dt, camera.position);              // 眨眼、呼吸、轉頭看第二個參數的位置（可以不給）
c.setMoving(速度);                          // 走路時身體輕微上下晃（還沒有走路動作）
c.talk(秒數); c.setMood('calm' | 'smile' | 'scared');
```

## 目前的檔案大小
| 角色 | 大小 | 說明 |
|---|---|---|
| elora 艾洛拉 | 4.1 MB | 有骨架、表情、JK 制服＋大衣 |
| yuexi 月晞 | 4.0 MB | 同上 |
| vaughn 沃恩 | 2.2 MB | 有骨架、表情、男生制服＋大衣 |
| cyril 西里爾 | 0.6 MB | 沒有骨架（不會轉頭、眨眼），制服＋大衣 |
| moray 副校長 | 0.3 MB | 沒有骨架 |
| aldric 校長 | 0.25 MB | 沒有骨架 |
| helga、knox | 製作中 | |

## 怎麼重新烘焙（帳號二）
1. 在 `prototype/` 開伺服器，用瀏覽器開 `bake.html`（加 `window.JOB = { key, tex }`，用 Playwright 跑，見帳號二的工作紀錄），存成 `<代號>_raw.glb`。
2. `gltfpack -i <代號>_raw.glb -o game/models/chars/<代號>.glb -cc -kn -km -kv -vt 16 -vp 16`（不要加 -si，簡化形狀會讓衣服變形；-vt／-vp 16 保留精度，少了襯衫會花掉、眼鏡會碎）。
3. 在儲存庫根目錄開伺服器，開 `prototype/avatars.html#yuexi,vaughn` 檢查。

## 需要帳號一幫忙的（`tools/`、`game/src/world/` 是帳號一的）
1. **build 要複製模型**：`tools/build.mjs` 的「2. 網頁與素材」加一行
   `if (existsSync(join(ROOT, 'game/models'))) cpSync(join(ROOT, 'game/models'), join(DIST, 'models'), { recursive: true });`
   （模型在網頁上的路徑是 `models/chars/`，就是 `characters.mjs` 預設的位置。）
2. **換掉簡單人形**：`world.mjs` 的 `makeAvatar` 先放簡單人形，再非同步載入正式模型，載好就換掉身體（名牌保留），例如：
   ```js
   loadCharacter(charKey).then((c) => { 人形的身體.visible = false; g.add(c.root); g.userData.char = c; }).catch(() => {});
   ```
   每一格對看得見的角色呼叫 `g.userData.char?.update(dt, camera.position)`；有移動就 `setMoving(速度)`。
   赫爾嘉夫人用 `loadCharacter('helga')`。
3. 手機效能：同一個畫面裡的角色建議 4 個以內。
