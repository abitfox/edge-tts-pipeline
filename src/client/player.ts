/**
 * Client player — singleton audio element + session-memory LRU blob prefetch.
 *
 * The server route (302 → storage) already makes playback fast; prefetching
 * the texts you know you'll need makes it instant (~0ms on first play).
 * Global playing state is exposed via pub/sub for waveform animations etc.
 *
 * Ported from the HackerEnglish project's lib/tts-client.ts (MIT), with the
 * endpoint URL and concurrency made configurable.
 */

export interface TtsClientOptions {
  /** GET endpoint returning audio or a 302 to it (default "/api/tts") */
  endpoint?: string;
  /** LRU cache size in texts (default 50) */
  maxCache?: number;
  /** Parallel prefetch requests (default 2) */
  prefetchConcurrency?: number;
}

export interface TtsClient {
  /** Speak a text (global single audio source; caches for next time). */
  speak(text: string, onEnd?: () => void): void;
  /** Speak a direct audio URL (e.g. pre-rendered clips). */
  speakUrl(url: string, onEnd?: () => void): void;
  /** Queue texts for prefetch into the LRU blob cache (fire-and-forget). */
  prefetch(texts: string[]): void;
  /** Stop current playback. */
  stop(): void;
  /** Subscribe to playing-state changes; returns an unsubscribe function. */
  subscribe(l: (playing: boolean) => void): () => void;
  /** Current playing state (useSyncExternalStore snapshot). */
  isPlaying(): boolean;
  /** Drop all cached blobs. */
  clearCache(): void;
}

export function createTtsClient(options: TtsClientOptions = {}): TtsClient {
  const endpoint = options.endpoint ?? "/api/tts";
  const maxCache = options.maxCache ?? 50;
  const concurrency = options.prefetchConcurrency ?? 2;

  /* ---- LRU blob cache (text -> objectURL) ---- */
  const blobCache = new Map<string, string>();
  const inflight = new Set<string>();

  function cachePut(text: string, url: string) {
    const old = blobCache.get(text);
    if (old) {
      blobCache.delete(text);
      try {
        URL.revokeObjectURL(old);
      } catch {
        /* ignore */
      }
    }
    blobCache.set(text, url);
    while (blobCache.size > maxCache) {
      const oldest = blobCache.keys().next().value;
      if (oldest === undefined) break;
      blobCache.delete(oldest);
    }
  }

  /* ---- prefetch (bounded concurrency) ---- */
  function prefetch(texts: string[]) {
    if (typeof window === "undefined") return;
    const queue = Array.from(new Set(texts)).filter(
      (t) => t && !blobCache.has(t) && !inflight.has(t),
    );
    queue.forEach((t) => inflight.add(t));
    let active = 0;
    let idx = 0;
    const next = () => {
      while (active < concurrency && idx < queue.length) {
        const text = queue[idx++];
        active++;
        fetch(`${endpoint}?text=${encodeURIComponent(text)}`)
          .then((r) =>
            r.ok ? r.blob() : Promise.reject(new Error(`tts ${r.status}`)),
          )
          .then((b) => cachePut(text, URL.createObjectURL(b)))
          .catch(() => {
            /* silent: playback falls back to the endpoint on demand */
          })
          .finally(() => {
            inflight.delete(text);
            active--;
            next();
          });
      }
    };
    next();
  }

  /* ---- global playing state ---- */
  type Listener = (playing: boolean) => void;
  const listeners = new Set<Listener>();
  let current: HTMLAudioElement | null = null;
  let playing = false;

  function setPlaying(p: boolean) {
    if (playing === p) return;
    playing = p;
    listeners.forEach((l) => l(p));
  }

  function attachDone(a: HTMLAudioElement, onEnd?: () => void) {
    const done = () => {
      if (current === a) {
        current = null;
        setPlaying(false);
      }
      onEnd?.();
    };
    a.onended = done;
    a.onerror = done;
    a.play().catch(done);
  }

  return {
    speak(text: string, onEnd?: () => void) {
      if (current) {
        try {
          current.pause();
        } catch {
          /* ignore */
        }
      }
      const cached = blobCache.get(text);
      // Refresh LRU recency on hit; on miss warm the cache in the background
      // so replays and later texts land instantly.
      if (cached) {
        blobCache.delete(text);
        blobCache.set(text, cached);
      } else {
        prefetch([text]);
      }
      const a = new Audio(cached ?? `${endpoint}?text=${encodeURIComponent(text)}`);
      current = a;
      setPlaying(true);
      attachDone(a, onEnd);
    },
    speakUrl(url: string, onEnd?: () => void) {
      if (current) {
        try {
          current.pause();
        } catch {
          /* ignore */
        }
      }
      const a = new Audio(url);
      current = a;
      setPlaying(true);
      attachDone(a, onEnd);
    },
    prefetch,
    stop() {
      try {
        current?.pause();
      } catch {
        /* ignore */
      }
      current = null;
      setPlaying(false);
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    isPlaying() {
      return playing;
    },
    clearCache() {
      for (const url of blobCache.values()) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      }
      blobCache.clear();
    },
  };
}

/* ---- Default shared client ---- */

let defaultClient: TtsClient | null = null;

export function getDefaultTtsClient(): TtsClient {
  if (!defaultClient) defaultClient = createTtsClient();
  return defaultClient;
}

export function speak(text: string, onEnd?: () => void): void {
  getDefaultTtsClient().speak(text, onEnd);
}

export function stopSpeaking(): void {
  getDefaultTtsClient().stop();
}

export function prefetchTts(texts: string[]): void {
  getDefaultTtsClient().prefetch(texts);
}

export function subscribeTts(l: (playing: boolean) => void): () => void {
  return getDefaultTtsClient().subscribe(l);
}

export function isTtsPlaying(): boolean {
  return getDefaultTtsClient().isPlaying();
}
