# 場景配置格式（給帳號二：美術）

遊戲的玩法（房間範圍、門、可以調查的東西、碰撞）由**帳號一**寫在場景配置裡；美術由**帳號二**依同樣的位置換上正式的模型與材質。目前第一章用到的配置在 `game/src/data/world-ch1.mjs`（序幕～第二幕）、`game/src/data/library-ch1.mjs`（第三幕：沉眠圖書館，在地底，x 從 100 開始；書架迷宮、血跡、屍體、暗室石板由 `game/src/world/library.mjs` 畫）與 `game/src/data/act4-ch1.mjs`（第四幕：通道、機械室、蝕巢、屋頂，x 從 115 開始；屋頂符文石板、齒輪、黑根、月亮由 `game/src/world/act4scene.mjs` 畫）。

## 座標
- 單位：公尺。x 往東、z 往南（北邊是 -z），y 往上；地板高度 0，玩家眼睛高度 1.6。
- `yaw`：面向，0＝朝北（-z），`Math.PI / 2`＝朝西。

## ROOMS（房間＝區域）
| 欄位 | 說明 |
|---|---|
| `id` | 房間代號，也是同步用的「區域」名稱（同一區的人才互傳位置） |
| `name` | 中英文名稱 |
| `x`、`z` | 範圍 `[最小, 最大]`，房間都是長方形 |
| `h` | 天花板高度 |
| `floor` | `stone`／`wood` |
| `sky` | `true`＝沒有天花板（碼頭） |
| `light` | 房間燈的顏色（只有玩家所在的房間會亮） |
| `house` | 宿舍屬於哪個學院 |

## DOORS（門）
| 欄位 | 說明 |
|---|---|
| `a`、`b` | 門兩邊的房間 |
| `x`、`z` | 門的中心（在兩個房間共用的牆上） |
| `w` | 門寬 |
| `axis` | 門所在那面牆的方向：`'x'`＝東西向的牆、`'z'`＝南北向的牆 |
| `lock` | `null`＝一直開；`{ puzzle: 'P03' }`＝解開才開；`{ segment: 'act2' }`＝進到那一段才開 |

## THINGS（可以調查的東西）
| 欄位 | 說明 |
|---|---|
| `id` | 代號（美術用它來對應模型） |
| `room` | 在哪個房間 |
| `kind` | `prop` 擺設、`rumor` 傳聞、`puzzle` 謎題、`hide` 躲藏點、`pillar` 柱子（擋赫爾嘉夫人的視線）、`loopdoor` 長廊盡頭的門、`snuff` 熄燈、`plaques` 校長銘牌牆、`note` 撿得起來的筆記、`letter` 月晞的家書、`overview` 從高處看迷宮的梯子、`nest` 蝕巢裡綁住同伴的黑根 |
| `hidden` | `true`＝不畫灰盒方塊，外觀由別的程式畫（長廊、創辦人的房間在 `game/src/world/corridor.mjs`），美術換這些東西時改 corridor.mjs 或用掛鉤蓋掉 |
| `x`、`z`、`y` | 位置（`y` 是底部離地多高，預設 0） |
| `size` | `[寬, 高, 深]`，也是「調查」的範圍 |
| `solid` | 會不會擋路 |
| `puzzle`、`house`、`label`、`text` | 玩法用的資料，美術不用動 |

## 怎麼換上美術
在 `game/src/world/art-hooks.mjs` 註冊裝飾函式。灰盒場景（`game/src/world/greybox.mjs`）蓋好每個房間、門、東西時會呼叫：

```js
import { decorators } from '../world/art-hooks.mjs';
decorators.thing.push(({ thing, mesh, group, THREE }) => {
  if (thing.id !== 'mirror') return;
  mesh.visible = false;            // 藏起灰盒的方塊
  group.add(載入的鏡子模型);         // 放在 thing.x, thing.z
});
decorators.room.push(({ room, group, THREE }) => { /* 牆面、地板材質、擺設 */ });
decorators.door.push(({ door, mesh, group, THREE }) => { /* 換門的模型；開關由 mesh.visible 控制，請跟著它 */ });
```

規則：
- 位置、大小、碰撞以場景配置為準；裝飾只換外觀。
- 要改位置或新增可以調查的東西，請在 `docs/PROGRESS.md` 寫下來，由帳號一改配置。
- 美術的檔案放在 `game/src/art/`、`game/models/`（帳號二的資料夾），在 `game/src/main.mjs` 載入前註冊即可。
- 燈：只有玩家所在的房間有一盞燈（手機效能）。美術要加燈的話，請用少量、不投影的燈。

## 角色
- 隊友、電腦控制的同伴、赫爾嘉夫人目前是簡單的人形（`game/src/world/world.mjs` 的 `makeAvatar`）。
- 換成正式模型時：
  - 角色代號用 `yuexi`／`vaughn`／`elora`／`cyril`；配角用 `helga`、`aldric`、`moray`、`knox`。
  - 守夜人（蝕化後）在 `game/src/world/warden.mjs`，用 `decorators.npc.push(({ key, group, THREE }) => { if (key !== 'warden') return; … })` 換模型；綠色提燈的光要留著（玩法用）。
  - 位置與面向由 `placeAvatar(key, x, z, yaw)` 決定，模型的正面要朝 -z。
