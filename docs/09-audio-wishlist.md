# 音效清單（2026-10-22）

**清單上的音效全部收到並放進遊戲了（2026-10-22，共 36 個檔，來源見 `assets-src/README.md`）。** 之後要換掉哪一個，照同樣的檔名給新的檔就好。

遊戲裡的聲音目前全部用程式即時合成（`game/src/art/sfx.mjs`），配樂（`music_menu`、`music_chase`）、驚嚇聲（`stinger`）、耳語（`whisper`）、心跳（`heartbeat`）也有合成的版本。製作人找到真的音檔後，放進 `assets/audio/sfx/`，
檔名照下表，並把檔名加進 `assets/audio/sfx/list.json`（例如 `["amb_fire.mp3", "step_stone_1.mp3", "step_stone_2.mp3"]`），
遊戲就會改用音檔（沒有的照樣用合成的）。同一種聲音可以給好幾個檔（`_1`、`_2`…），每次隨機挑一個。

來源：Pixabay Sound Effects（不用標註）、Freesound（選 CC0）。下載時記下網址，寫進 `assets-src/CREDITS.md`。
格式：mp3／ogg，單聲道，每檔 1MB 以下（太大由帳號二壓縮）。環境音要能無縫循環（搜尋加 loop / seamless）。

## 第一批
| 用途 | 檔名 | 英文搜尋字 | 長度 | 循環 |
|---|---|---|---|---|
| 守夜人平常的呼吸／低吼 | `warden_breath` | monster breathing growl, creature breathing loop | 3～8 秒 | ✔ |
| 守夜人發現你時的嘶吼 | `warden_roar` | monster roar, creature scream horror | 1～3 秒 | |
| 守夜人沉重的腳步（單步） | `warden_step` | heavy monster footstep | 0.5～1 秒 | |
| 被抓到時的尖叫 | `grab_scream` | female scream horror | 1～3 秒 | |
| 驚嚇音效 | `stinger` | horror jump scare stinger | 1～3 秒 | |
| 心跳 | `heartbeat` | heartbeat loop | 3～6 秒 | ✔ |
| 石地腳步（單步，給 3～4 個） | `step_stone_1`… | footstep stone single, castle footstep | 0.3 秒 | |
| 木地板腳步（單步，給 3～4 個） | `step_wood_1`… | footstep wooden floor single | 0.3 秒 | |
| 爐火 | `amb_fire` | fireplace crackling loop | 10～30 秒 | ✔ |
| 雨打窗戶 | `amb_rain` | rain on window loop | 20～60 秒 | ✔ |
| 城堡夜晚的空氣聲 | `amb_castle` | castle interior ambience night, dark room tone | 20～60 秒 | ✔ |
| 打開沉重的木門 | `door_wood` | old wooden door creak open | 1～3 秒 | |

## 第二批
| 用途 | 檔名 | 英文搜尋字 | 長度 | 循環 |
|---|---|---|---|---|
| 碼頭湖水 | `amb_lake` | lake water lapping night | 20～60 秒 | ✔ |
| 水滴 | `amb_drip` | cave water drips echo loop | 20～60 秒 | ✔ |
| 鐘塔機械室 | `amb_clocktower` | clock tower mechanism ticking loop | 10～30 秒 | ✔ |
| 屋頂的風 | `amb_wind` | wind howling loop | 20～60 秒 | ✔ |
| 鐵柵門 | `door_iron` | iron gate open creak | 1～3 秒 | |
| 石門滑開 | `door_stone` | stone door sliding | 1～3 秒 | |
| 解鎖 | `unlock` | old key lock unlock | 0.5～1 秒 | |
| 施咒 | `spell_cast` | magic spell cast whoosh sparkle | 1～2 秒 | |
| 解開謎題 | `solved` | magic chime success | 1～3 秒 | |
| 齒輪 | `gear` | gears turning mechanism | 1～3 秒 | |
| 耳語 | `whisper` | creepy whispers | 3～8 秒 | |
| 主選單音樂 | `music_menu` | dark ambient music loop | 1～3 分鐘 | ✔ |
| 被追時的音樂 | `music_chase` | horror chase music loop | 30 秒～2 分鐘 | ✔ |

謎題機關的聲音（`sfx(名稱)`）也可以換：click、tick、stone、gear、chime、sand、paper、wood、glass、metal、lever、knock、thud、wrong、solved、whoosh。
