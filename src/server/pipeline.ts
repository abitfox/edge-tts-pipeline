/**
 * Server pipeline — content-addressed TTS cache.
 *
 * Flow: sha1(voice:text) → cache lookup → hit: return the stored public URL
 * (302 from your route handler); miss: synthesize → upload → index. The cache
 * and storage are global and shared (no user data), so every sentence is
 * synthesized exactly once per deployment.
 *
 * Ported from the HackerEnglish project's lib/tts.ts (MIT), with Supabase
 * generalized behind Storage/Cache adapters.
 */

import type {
  CacheAdapter,
  StorageAdapter,
  SynthAdapter,
} from "../shared/adapters";
import { ttsKey } from "../shared/keys";

export interface TtsPipelineOptions {
  storage: StorageAdapter;
  cache: CacheAdapter;
  synth: SynthAdapter;
  /** Default voice when a request doesn't name one */
  defaultVoice?: string;
  /** contentType for stored audio (default "audio/mpeg") */
  contentType?: string;
}

export interface TtsResult {
  cacheKey: string;
  /** Storage key/path written for this audio */
  storageKey: string;
  /** Public URL returned by the storage adapter */
  publicUrl: string;
  /** true when this call synthesized and stored the audio; false on cache hit */
  generated: boolean;
}

/**
 * Ensure audio for (voice, text) exists in the cache, and return its public
 * URL. Safe to call concurrently for the same key — worst case the same
 * sentence is synthesized twice and the index upsert converges.
 */
export async function ensureTts(
  opts: TtsPipelineOptions,
  text: string,
  voice?: string,
): Promise<TtsResult> {
  const v = voice || opts.defaultVoice;
  if (!v) throw new Error("No voice: pass one or set defaultVoice");
  if (!text.trim()) throw new Error("Empty text");

  const key = ttsKey(v, text);

  // 1) index lookup
  const existing = await opts.cache.get(key);
  if (existing) {
    return {
      cacheKey: key,
      storageKey: existing,
      publicUrl: opts.storage.url(existing),
      generated: false,
    };
  }

  // 2) miss → synthesize → upload → index
  const audio = await opts.synth.synthesize(text, v);
  const contentType = opts.contentType ?? "audio/mpeg";
  const publicUrl = await opts.storage.put(`${key}.mp3`, audio, contentType);
  await opts.cache.set(key, `${key}.mp3`, { voice: v, text });
  return { cacheKey: key, storageKey: `${key}.mp3`, publicUrl, generated: true };
}

export { ttsKey, parseTtsQuery } from "../shared/keys";
export type { CacheAdapter, StorageAdapter, SynthAdapter } from "../shared/adapters";
export { createMemoryAdapters } from "../shared/adapters";
