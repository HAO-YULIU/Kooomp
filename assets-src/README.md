# 原始素材（不發佈）

這個資料夾放原始素材，**不會發佈**（之後要列進 `.assetsignore`）。遊戲用的是處理過的版本，放在 `assets/`。

## voice/
| 檔案 | 說明 |
|---|---|
| `liana_zh_en_elevenlabs.mp3` | 製作人提供的莉安娜語音（ElevenLabs 生成，49 秒）。0～16.6 秒是中文，16.6～31.6 秒是英文，31.9 秒以後是另一段（沒有使用） |
| `p15_zh_preview.mp3`、`p15_en_preview.mp3` | 玩家調對轉盤後聽到的樣子：錄音 → 停 1.2 秒 → 呼吸聲（給製作人試聽用，**含 P15 答案**） |

## sfx/
製作人提供的呼吸聲（檔名後面的數字是素材網站的編號）。

| 檔案 | 用途 |
|---|---|
| `breath_heavy_close_294195.mp3` | P15 錄音最後的呼吸聲（取 0.47～7.30 秒） |
| `breath_heavy_long_34377.mp3` | 預定：躲在櫃子裡時，守夜人在外面的呼吸 |
| `breath_soft_6811.mp3` | 預定：玩家躲藏時自己的呼吸 |
| `breath_fast_247449.mp3` | 預定：玩家跑到沒體力時的喘氣 |
| `monster_heavy_footsteps_321629.mp3` | 守夜人的腳步（2026-10-22，Pixabay：tanweraman）。切成 5 個單步 → `assets/audio/sfx/warden_step_1～5.mp3`（0.15、1.45、2.72、3.83、7.49 秒起，各約 1 秒，尾巴淡出） |
| `monster_roar_6985.mp3` | 守夜人發現你時的嘶吼（2026-10-22，Pixabay：freesound_community）→ `warden_roar.mp3` |
| `demon_breathing_619441.mp3` | 守夜人的呼吸（2026-10-22，Pixabay：pantoman）。取 0.30～7.35 秒（頭尾都在換氣的空檔，接起來不會斷）→ `warden_breath.mp3`，循環播放 |

| `female_scream_251068.mp3` | 被抓到時的尖叫（Pixabay：wakanatsukiko）。取 0.5～1.45 秒 → `grab_scream.mp3`（走廊東西衝出來時也用） |
| `scare_407345.mp3` | 驚嚇聲（Pixabay：magiaz）。取 0～3.1 秒 → `stinger.mp3` |
| `heartbeat_372448.mp3` | 心跳（Pixabay：dragon-studio）。取 0.2～5.25 秒（剛好一輪，頭尾在兩下之間）→ `heartbeat.mp3`，第四幕被追時循環，越緊張越快 |
| `walking_wooden_floor_14743.mp3` | 木地板腳步（Pixabay：freesound_community）。切 4 個單步 → `step_wood_1～4.mp3` |
| `fire_crackling_427410.mp3` | 爐火（Pixabay：dragon-studio）→ `amb_fire.mp3` |
| `rain_loop_515268.mp3` | 雨聲（Pixabay：dragon-studio）→ `amb_rain.mp3`（第二幕長廊） |
| `scary_night_ambience_75274.mp3` | 城堡夜晚的空氣聲（Pixabay：freesound_community）→ `amb_castle.mp3`（長廊、圖書館） |
| `old_wooden_door_latch_544539.mp3` | 木門打開（Pixabay：strachszydlo）。取 0.17～4.27 秒 → `door_wood.mp3` |
| `lake_lapping_331501.mp3` | 碼頭湖水（Pixabay：dragon-studio）→ `amb_lake.mp3` |
| `dripping_water_257182.mp3` | 水滴（Pixabay：tanweraman）。取前 20 秒 → `amb_drip.mp3` |
| `wall_clock_ticking_308746.mp3` | 時鐘（Pixabay：audiopapkin）。取 1～11 秒（剛好 10 下）→ `amb_clock.mp3`；星盤廳原速，鐘塔機械室放慢到 0.55 倍當大鐘 |
| `howling_wind_109590.mp3` | 屋頂的風（Pixabay：liecio）→ `amb_wind.mp3` |
| `iron_gate_opening_392362.mp3` | 鐵門（Pixabay：tanweraman）→ `door_iron.mp3`（圖書館深處、鐘塔的門） |
| `stone_steps_6748.mp3` | 石地腳步（Pixabay：freesound_community）。挑 5 個清楚的單步 → `step_stone_1～5.mp3` |
| `open_sliding_door_105746.mp3` | 石門滑開（Pixabay：freesound_community）。取 0.5～2.55 秒 → `door_stone.mp3`（創辦人廳） |
| `heavy_door_unlocking_515258.mp3` | 解鎖（Pixabay：dragon-studio）。取 0～1.35 秒 → `unlock.mp3`（解謎打開的門先響一聲） |
| `magic_twinkle_244951.mp3` | 施咒（Pixabay：universfield）。取 0.3～1.7 秒 → `spell_cast.mp3`（揮法杖） |
| `quest_complete_540182.mp3` | 解開謎題（Pixabay：yodguard）→ `solved.mp3` |
| `giant_gears_504025.mp3` | 齒輪（Pixabay：dragon-studio）→ `gear.mp3` |
| `strange_whispers_415245.mp3` | 耳語（Pixabay：u_5hx6qi66bg）→ `whisper.mp3`（圖書館黑暗中、鬧鬼的小事件） |
| `dark_academia_piano_loop_570541.mp3` | 主選單音樂（Pixabay：the217amlibrary）。取 0～164.2 秒、頭尾疊 3 秒接成循環 → `music_menu.mp3`（雙聲道） |
| `cinematic_tension_loop_297627.mp3` | 被追時的音樂（Pixabay：cyberwave-orchestra）。頭尾疊 2 秒接成循環 → `music_chase.mp3`（雙聲道；守夜人越近越大聲） |

循環的環境音：把開頭 1.5～3 秒疊到結尾（交叉淡入淡出），接回開頭就不會斷。

遊戲用的音效（`assets/audio/sfx/`）：轉單聲道、44.1kHz、mp3 96k，音量拉到最大聲的地方 −1.5 dB；列進 `assets/audio/sfx/list.json` 才會用。

## 處理方式（P15）
- 莉安娜的錄音切出中文或英文段，前後淡入淡出、音量標準化（-20 LUFS）。
- 接上 1.2 秒靜音和呼吸聲，得到 `p15_*_preview.mp3`。
- 遊戲用的 `assets/audio/ch1/p15_liana_zh.mp3`、`p15_liana_en.mp3`：把 preview **加速 2 倍（音高跟著升高）再倒放**。遊戲裡把聲音「反轉＋0.5 倍」播放，就剛好還原成 preview。

## 3D 模型（2026-10-23，製作人從 Sketchfab 下載）
遊戲用的是處理過的版本 `game/models/props/*.glb`（glTF、貼圖縮成 1K WebP、太多面的減面、meshopt 壓縮），清單 `game/models/props/list.json`。作者與網址列在 `game/src/data/credits.mjs`（遊戲設定裡的「素材來源」會顯示，CC BY 要標註）。
- 沒有用的：`macabre_gargoyle_statue`（Sketchfab Standard 授權）、`marcus_aurelius`、`colossal_marble_bust_of_zeus`（CC BY-NC-SA，不能商用）、`heavy_knight`（沒有授權說明，等製作人確認來源）。
- `vintage-black-wooden-desk`（書桌）沒有附授權說明，等製作人確認來源。
