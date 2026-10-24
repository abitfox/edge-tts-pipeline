/**
 * Root entry re-exports both halves so tree shaking picks what you import;
 * prefer the explicit "./server" and "./client" entries in production.
 */
export {
  ensureTts,
  ttsKey,
  parseTtsQuery,
  createMemoryAdapters,
  createTtsRoute,
  createEdgeTtsSynth,
  EDGE_VOICES,
  createSupabaseAdapters,
  type TtsPipelineOptions,
  type TtsResult,
  type TtsRouteOptions,
  type StorageAdapter,
  type CacheAdapter,
  type SynthAdapter,
} from "./server/index";
export {
  createTtsClient,
  getDefaultTtsClient,
  speak,
  stopSpeaking,
  prefetchTts,
  subscribeTts,
  isTtsPlaying,
  type TtsClient,
  type TtsClientOptions,
} from "./client/index";
