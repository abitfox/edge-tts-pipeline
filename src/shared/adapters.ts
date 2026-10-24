/**
 * Storage / cache abstractions for the TTS pipeline.
 *
 * The pipeline itself only knows these two interfaces — bring your own
 * backend (Supabase Storage, S3, local FS, a database table, ...). Reference
 * implementations ship in `server/adapters/*`.
 */

/** Binary storage for synthesized audio files. */
export interface StorageAdapter {
  /**
   * Upload an audio buffer. Implementations should upsert (idempotent).
   * @returns the public URL of the stored file
   */
  put(key: string, audio: Buffer, contentType: string): Promise<string>;
  /**
   * Public URL for a stored key without uploading (cache-hit path).
   * Must agree with the URL returned by `put` for the same key.
   */
  url(key: string): string;
}

/** Index for "this voice+text was already synthesized" lookups. */
export interface CacheAdapter {
  /** @returns the storage key previously written for this cache key, or null */
  get(cacheKey: string): Promise<string | null>;
  /**
   * Record the storage key for a cache key (idempotent upsert).
   * `meta` carries the voice/text for debugging and audit; implementations
   * may ignore it.
   */
  set(
    cacheKey: string,
    storageKey: string,
    meta?: { voice?: string; text?: string },
  ): Promise<void>;
}

/** Synthesizer backend. `msedge-tts` ships a reference implementation. */
export interface SynthAdapter {
  /** @returns synthesized audio (mp3 bytes by convention) */
  synthesize(text: string, voice: string): Promise<Buffer>;
}

/** In-memory adapters — useful for tests and single-process dev servers. */
export function createMemoryAdapters(): {
  storage: StorageAdapter & { files: Map<string, Buffer> };
  cache: CacheAdapter & { index: Map<string, string> };
} {
  const files = new Map<string, Buffer>();
  const index = new Map<string, string>();
  return {
    storage: {
      files,
      async put(key, audio, _contentType) {
        files.set(key, audio);
        // The memory adapter doubles as a static file "server": the caller
        // decides how to expose these bytes (route handler, etc.).
        return `memory://${key}`;
      },
      url(key) {
        return `memory://${key}`;
      },
    },
    cache: {
      index,
      async get(cacheKey) {
        return index.get(cacheKey) ?? null;
      },
      async set(cacheKey, storageKey, meta) {
        if (meta?.text) index.set(`${cacheKey}:text`, meta.text);
        index.set(cacheKey, storageKey);
      },
    },
  };
}
