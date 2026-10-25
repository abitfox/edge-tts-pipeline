<div align="center">

# edge-tts-pipeline

**免费 TTS 的生产级方案：EdgeTTS 合成 + 内容寻址缓存（服务端），LRU 预取播放器（客户端）。同一句话永远只合成一次。**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/abitfox/edge-tts-pipeline/actions/workflows/ci.yml/badge.svg)](./.github/workflows/ci.yml)

[English](./README.md)

</div>

---

> ▶ **在线演示：[www.hackerenglish.com](https://www.hackerenglish.com)** —— 站点里所有语音都经本管线播放。

`msedge-tts` 提供了免费的微软神经音色——但每次请求实时合成又慢又飘又浪费。这条管线把它变成基础设施组件：

- **服务端**：`sha1(voice:text)` → 查缓存索引 → 命中：302 直达已存音频；未命中：合成 → 上传 → 写索引。存储和缓存都是 adapter——Supabase、S3、本地文件系统都可以接。
- **客户端**：全局单例播放器 + 会话内存 LRU blob 预取。把你知道要用的文本批量预取，播放等待 ≈0ms。
- **批量工具**：用同一条管线离线预生成整个语料库（见下文示例）。
<div align="center">
  <img src="docs/media/demo.png" alt="edge-tts-pipeline 播放器演示" width="820" />
</div>


```ts
// app/api/tts/route.ts  (Next.js App Router)
import { createTtsRoute, createEdgeTtsSynth, createMemoryAdapters } from "edge-tts-pipeline/server";

export const GET = createTtsRoute({
  ...createMemoryAdapters(), // 生产环境换 createSupabaseAdapters(...)
  synth: createEdgeTtsSynth(),
  defaultVoice: "en-US-AriaNeural",
});
```

## 特性

- **内容寻址缓存** —— 同一句话每个部署只合成一次；索引全局共享，不含用户数据。
- **Adapter 化** —— `StorageAdapter` / `CacheAdapter` / `SynthAdapter` 三个接口；内置内存实现，Supabase 与 EdgeTTS 作为参考实现。
- **客户端 LRU 预取** —— 有界并发预取到 object-URL 缓存，LRU 淘汰，命中刷新新近度。
- **全局播放状态** —— pub/sub `subscribe()`，波形动画和播放按钮直接消费。
- **可选 peer 零负担** —— `msedge-tts` 与 `@supabase/supabase-js` 均为可选 peer 依赖；不导入对应功能就不会加载相关代码。

## 安装

```bash
npm install edge-tts-pipeline
npm install msedge-tts             # 服务端合成（可选 peer）
npm install @supabase/supabase-js  # Supabase adapter（可选 peer）
```

| 部分 | 导入 |
| --- | --- |
| 路由工厂 + adapters | `"edge-tts-pipeline/server"` |
| 播放器 + 预取 | `"edge-tts-pipeline/client"` |

## 服务端用法

```ts
// Next.js App Router — app/api/tts/route.ts
import {
  createTtsRoute,
  createEdgeTtsSynth,
  createSupabaseAdapters,
} from "edge-tts-pipeline/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export const GET = createTtsRoute({
  ...createSupabaseAdapters({
    client: supabase,
    bucket: "tts-audio",
    publicBaseUrl: process.env.SUPABASE_URL!,
  }),
  synth: createEdgeTtsSynth(),
  defaultVoice: "en-US-AriaNeural",
});
```

路由响应 `GET /api/tts?text=...&voice=...`，302 跳转到已存音频。缓存表 SQL 见
[`src/server/adapters/supabase.ts`](./src/server/adapters/supabase.ts) 文档注释。

## 客户端用法

```ts
import { createTtsClient } from "edge-tts-pipeline/client";

const tts = createTtsClient({ endpoint: "/api/tts" });

// 用户点击之前你就知道要播什么——先预取：
tts.prefetch(["欢迎回来。", "连接已建立。", "信号已丢失。"]);

tts.speak("欢迎回来。", () => console.log("done"));
tts.subscribe((playing) => animateWaveform(playing));
```

### 批量预生成

```js
// 示例 —— 用 tsx/node 运行
import { ensureTts } from "edge-tts-pipeline/server";
for (const text of loadCorpus()) {
  await ensureTts(pipeline, text, "en-US-AriaNeural"); // 自动缓存；第二次跑直接命中
}
```

## 注意与限制

- `msedge-tts` 使用微软未公开端点——把它当尽力而为的免费档，保留 `SynthAdapter`
  接缝，随时可换 Azure/Google 而不动管线。
- 缓存与存储只含音色与文本，不含用户数据——加分析功能时也请保持这一纪律。

## 来源

抽取自 HackerEnglish 项目——全部学习语料的语音都在零 TTS 预算下由它驱动。见 [`docs/PORTING.md`](./docs/PORTING.md)。

## 许可

[MIT](./LICENSE)。
