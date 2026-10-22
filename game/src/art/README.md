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
- 第三幕（圖書館）：牆面、所有謎題物件的外觀（元素鎖柵門、滑軌梯、留聲水晶、東方典藏櫃、符文大門、鏡座、石像鬼、井……）、閱覽室的長桌和綠色檯燈、入口的書架、散落的書。屍體、血跡、會動的書架、暗室石板還是帳號一的 library.mjs 畫。
- 第四幕：卡住的鐵門和拉桿、牆上的齒輪組、刻童謠的石框門、躲藏點（工具櫃、斜靠的大齒輪、壁龕、煙囪）、機械室的工作台和油桶。大齒輪、鐘擺、黑根、屋頂石板還是帳號一的 act4scene.mjs 畫。
- 燈：只多加三盞小燈，都在碼頭（船燈、城門的火光、淡淡的月光，不投影）；蠟燭、火爐用發光材質。
- 出錯時只印警告，灰盒照樣能玩。測試頁：在儲存庫根目錄開伺服器，開 `prototype/scene-test.html`（`window.view('hall', 0, 138, 0)`）。

## 小裝飾、小細節
- `game/src/art/props.mjs`：茶壺、茶杯、書堆、攤開的書、墨水瓶和羽毛筆、捲軸、藥水瓶（微微發光）、水晶球、頭骨、地球儀、盤子上的食物、高腳杯、水壺、燭台、圓桌、書桌和椅子、箱子、木箱、木桶、繩子、石甕、長凳、望遠鏡、衣帽架、掃把、坩堝、鹿角、交叉的劍、銜尾蛇雕像、符文石、牆上的星圖、蜘蛛網。
- 擺在：碼頭（新生的行李、木箱、木桶）、大廳（長凳、石甕、公告板）、典禮廳（每張長桌上的食物、高腳杯、水壺）、星盤廳（望遠鏡、星圖、地球儀）、四間交誼廳（火爐前的茶桌、書桌、行李箱、學院特色小物：艾爾德林望遠鏡、格里莫瓦水晶球和符文石、貝爾蒙特鹿角和劍、烏洛波斯坩堝和蛇雕像），天花板角落的蜘蛛網。
- 只是外觀：不擋路、不能調查。長廊不放（找異常用）。

## 第一人稱的法杖
- `game/src/art/staff.mjs`：星月法杖、龍首法杖（`game/models/staff/`），場景蓋好時自動掛到相機上（預設星月法杖），右下角，走路時輕輕晃，施咒時往前一揮、杖頭發光。
- `game/src/art/preview.mjs`：等待室選角色的展示台（學院色魔法陣、光點、可以拖曳轉動）。選角色卡片的頭像由 `prototype/thumbs.html` 烘焙成 `game/img/chars/<代號>.webp`（角色模型或衣服改了要重新烘焙）。
- **請帳號一**（兩行，`import { setStaff, staffCast } from '../art/index.mjs'`）：
  1. 知道玩家角色後 `setStaff(女生 ? 'moon' : 'dragon')`（艾洛拉、月晞 `moon`；沃恩、西里爾 `dragon`）；不想顯示時 `setStaff(null)`。
  2. 施咒成功時 `staffCast(咒語的顏色)`（例如顯影咒 `'#9fc4ff'`）。

## 長廊的畫像
- `game/src/art/portraits.mjs` 的 `paintPortrait(kind, seed)`：油畫風格（筆觸、泛黃的亮油、龜裂紋、四角變暗），每個人的髮型（短、長、盤起）、眼鏡、鬍子、袍子顏色不同。
- 帳號一的 `corridor.mjs` 只改了一行：`paint` 改成呼叫 `paintPortrait`（原本的簡單版本改名 `paintPlain` 留著）。異常的種類（移位、空框、背對、沒瞳孔、莉安娜、臉被挖掉）跟原本一樣；眼睛的位置對齊「眼睛跟著你」的活瞳孔。
- 測試頁：`prototype/portraits-test.html`。

## 守夜人
`game/src/art/warden.mjs` 用美術掛鉤 `decorators.npc`（key＝`warden`）把 `game/src/world/warden.mjs` 的灰盒換成正式模型，綠色的光（玩法用）不動。
動作照 AI 狀態：`idle`、`stun` → 待機；`patrol`、`search` → 走路；`chase` → 跑步；`grab` → 撲抓。
測試頁：在儲存庫根目錄開伺服器，開 `prototype/warden-game.html#chase`（`#patrol`、`#grab`、`#auto`）。
守夜人用 `prototype/bake-warden.html` 烘焙。
蝕化（`warden.mjs` 的 `corrupt()`）：背後沿脊椎裂開的血肉、往兩側翻開的肋骨、從背上和肩膀刺出的黑色結晶、左臉剝落的臉皮和底下的紅肉、發綠光的眼睛。都掛在骨頭上，跟著走路、跑步、撲抓一起動。測試頁：`prototype/warden-view.html`。

## 怎麼重新烘焙（帳號二）
1. 在 `prototype/` 開伺服器，用瀏覽器開 `bake.html`（加 `window.JOB = { key, tex }`，用 Playwright 跑，見帳號二的工作紀錄），存成 `<代號>_raw.glb`。
2. 減面（順暢度，2026-10-22）：`node prototype/bake-slim.mjs <代號>_raw.glb <代號>_slim.glb '<規則>'`（要先 `npm install @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer`）。
   規則：`{"Teeth":0.2,"Nails":0.3,"Skin_Arm":0.45,"Skin_Leg":0.45,"Skin_Body":0.5,"Transparency$|^hair$":[0.4,0.01,false],"^shoes$":[0.4,0.006,false],"^cloth$":[0.5,0.004,false]}`
   只減皮膚、細髮絲、鞋子、制服；**袍子（robe）不減**（滾邊的顏色會花掉）、臉不減（表情會壞）。
3. `gltfpack -i <代號>_slim.glb -o game/models/chars/<代號>.glb -cc -kn -km -kv -vt 16 -vp 16`（不要加 -si，整個模型一起簡化會讓衣服變形；-vt／-vp 16 保留精度，少了襯衫會花掉、眼鏡會碎）。
   法杖（`game/models/staff/`）減面後用 `-cc -kn -km -noq` 打包（`staff.mjs` 會改頂點，不能壓成整數座標）。
4. 在儲存庫根目錄開伺服器，開 `prototype/avatars.html#yuexi,vaughn` 檢查；選角色的頭像用 `prototype/thumbs.html` 重新拍。

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
