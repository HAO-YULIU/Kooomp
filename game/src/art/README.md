# 美術（帳號二）

## 角色模型
- 檔案：`game/models/chars/<代號>.glb`，每個 5MB 以下。代號照 `docs/08-world-format.md`：`yuexi`、`vaughn`、`elora`、`cyril`、`helga`、`aldric`、`moray`、`knox`。
- 程式：`game/src/art/characters.mjs`
- 衣服：照每個角色的身體形狀做的巫師袍（`prototype/src/robe.mjs`），樣式在 `prototype/src/costumes.mjs`、`prototype/src/support.mjs`。

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
| elora 艾洛拉 | 4.1 MB | 有骨架、表情；JK 制服＋月白長袍（藍邊） |
| yuexi 月晞 | 3.9 MB | 同上；JK 制服＋酒紅短外袍（金邊、寬袖） |
| vaughn 沃恩 | 2.4 MB | 有骨架、表情；男生制服＋黑袍（金邊） |
| cyril 西里爾 | 0.6 MB | 沒有骨架（不會轉頭、眨眼）；制服＋墨綠袍（扣起來、銀邊） |
| helga 赫爾嘉夫人 | 2.8 MB | 有骨架、表情；灰色長袍、艾洛拉的短捲髮＋眼鏡 |
| knox 魔藥學教授 | 2.8 MB | 有骨架、表情；墨綠長袍 |
| aldric 校長 | 2.1 MB | 有骨架、表情（沃恩的臉）；白髮白鬍子、紫金長袍 |
| moray 副校長 | 0.6 MB | 沒有骨架；制服＋黑銀長袍 |
| warden 守夜人（蝕化後） | 0.2 MB | 有骨架、待機／走路／跑步／撲抓四個動作（見下面「守夜人」） |

## 場景（序幕、第一幕）
- `game/src/art/scene.mjs`：用美術掛鉤（`decorators.room／door／thing`）換上材質與擺設，不改位置、大小、碰撞。`textures.mjs` 的貼圖全部用程式畫（不用下載圖檔）。
- 碼頭（黑湖、木樁、燈籠、遠方的城堡和鐘塔、月亮）、大廳（石柱、學院旗、吊燈、紅地毯、分院鏡）、典禮廳（長桌、長椅、漂浮的蠟燭、教師席、高窗）、星盤廳（星圖地板、夜空天花板、黃銅星盤、石柱、厚窗簾）、四間交誼廳（學院色壁紙、護牆板、火爐、扶手椅、書架、地毯、窗戶、謎題物件的外觀）。
- 第二幕：長廊、往北翼的走廊加上尖拱的肋拱和壁紙、護牆板；創辦人的房間加方格天花板。畫像、燭台、盔甲、鐘這些「找異常」會用到的東西還是帳號一的 `corridor.mjs` 畫，美術不另外放同類的東西，免得玩家誤認成異常。
- 第三幕（圖書館）、第四幕還是帳號一的灰盒／程式畫的樣子。
- 燈：只多加三盞小燈，都在碼頭（船燈、城門的火光、淡淡的月光，不投影）；蠟燭、火爐用發光材質。
- 出錯時只印警告，灰盒照樣能玩。測試頁：在儲存庫根目錄開伺服器，開 `prototype/scene-test.html`（`window.view('hall', 0, 138, 0)`）。

## 守夜人
`game/src/art/warden.mjs` 用美術掛鉤 `decorators.npc`（key＝`warden`）把 `game/src/world/warden.mjs` 的灰盒換成正式模型，綠色的光（玩法用）不動。
動作照 AI 狀態：`idle`、`stun` → 待機；`patrol`、`search` → 走路；`chase` → 跑步；`grab` → 撲抓。
測試頁：在儲存庫根目錄開伺服器，開 `prototype/warden-game.html#chase`（`#patrol`、`#grab`、`#auto`）。
守夜人用 `prototype/bake-warden.html` 烘焙。

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
3. **註冊美術掛鉤**：在蓋場景、建立守夜人之前 `import '../art/index.mjs';`（例如放在 `world.mjs` 最上面）。沒有這行，守夜人還是灰盒。
4. **守夜人的動作**：`game/src/world/warden.mjs` 的 `frame(dt, mode)` 最後加一行 `g.userData.update?.(dt, mode);`，動作就會照 AI 狀態（撲抓也會播）。沒加的話，模型自己看移動速度選走路／跑步，不會撲抓。
5. 手機效能：同一個畫面裡的角色建議 4 個以內。
