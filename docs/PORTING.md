# PORTING.md — 20_HackerEnglish → edge-tts-pipeline

| 原位置 | 新位置 | 改动 |
|---|---|---|
| `frontend/src/lib/tts.ts`（Supabase 直连的 ensureTts） | `src/server/pipeline.ts`（`ensureTts(pipeline, text, voice?)`） | Supabase Storage + `tts_cache` 表抽象为 `StorageAdapter` / `CacheAdapter`；Supabase 版移入 `server/adapters/supabase.ts`（附建表 SQL）；新增内存实现供测试/单机开发 |
| `frontend/src/app/api/tts/route.ts`（手写路由） | `src/server/route.ts`（`createTtsRoute()` 工厂） | 请求解析/长度校验/302 收口为工厂；错误统一 502 JSON |
| `frontend/src/lib/tts-client.ts` | `src/client/player.ts`（`createTtsClient()` 工厂 + 默认实例） | 端点 URL 从硬编码 `/api/tts` 改为选项；新增 `speakUrl`、`clearCache`；预取并发数可配（默认 2，原样保留） |
| `frontend/src/lib/azure-tts.ts` | 未搬运 | Azure 直连合成留给使用者自实现 `SynthAdapter`（接口即文档），避免包携带云 SDK 代码 |
| `frontend/scripts/pregen-tts.mjs` | README 批量预生成示例 | 脚本本身依赖项目内 DB 配置，抽为文档化模式 |
| `frontend/src/lib/audio-inventory.ts`（音色槽位） | 未搬运 | 业务归类逻辑（教学/反派槽位）；通用化价值待真实需求再评估 |

关键设计保留：

- `sha1(voice:text)` 内容寻址，文本先归一化空白（tilde 保留词边界，防碰撞）
- 缓存/存储全局共享、不含用户数据的纪律（README 明示）
- 客户端 LRU：命中刷新新近度、未命中顺路后台预热、有界并发
- 全局单音源语义（新播放打断旧的）+ pub/sub 播放状态
