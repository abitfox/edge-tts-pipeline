// src/client/player.ts
function createTtsClient(options = {}) {
  const endpoint = options.endpoint ?? "/api/tts";
  const maxCache = options.maxCache ?? 50;
  const concurrency = options.prefetchConcurrency ?? 2;
  const blobCache = /* @__PURE__ */ new Map();
  const inflight = /* @__PURE__ */ new Set();
  function cachePut(text, url) {
    const old = blobCache.get(text);
    if (old) {
      blobCache.delete(text);
      try {
        URL.revokeObjectURL(old);
      } catch {
      }
    }
    blobCache.set(text, url);
    while (blobCache.size > maxCache) {
      const oldest = blobCache.keys().next().value;
      if (oldest === void 0) break;
      blobCache.delete(oldest);
    }
  }
  function prefetch(texts) {
    if (typeof window === "undefined") return;
    const queue = Array.from(new Set(texts)).filter(
      (t) => t && !blobCache.has(t) && !inflight.has(t)
    );
    queue.forEach((t) => inflight.add(t));
    let active = 0;
    let idx = 0;
    const next = () => {
      while (active < concurrency && idx < queue.length) {
        const text = queue[idx++];
        active++;
        fetch(`${endpoint}?text=${encodeURIComponent(text)}`).then(
          (r) => r.ok ? r.blob() : Promise.reject(new Error(`tts ${r.status}`))
        ).then((b) => cachePut(text, URL.createObjectURL(b))).catch(() => {
        }).finally(() => {
          inflight.delete(text);
          active--;
          next();
        });
      }
    };
    next();
  }
  const listeners = /* @__PURE__ */ new Set();
  let current = null;
  let playing = false;
  function setPlaying(p) {
    if (playing === p) return;
    playing = p;
    listeners.forEach((l) => l(p));
  }
  function attachDone(a, onEnd) {
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
    speak(text, onEnd) {
      if (current) {
        try {
          current.pause();
        } catch {
        }
      }
      const cached = blobCache.get(text);
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
    speakUrl(url, onEnd) {
      if (current) {
        try {
          current.pause();
        } catch {
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
      }
      current = null;
      setPlaying(false);
    },
    subscribe(l) {
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
        }
      }
      blobCache.clear();
    }
  };
}
var defaultClient = null;
function getDefaultTtsClient() {
  if (!defaultClient) defaultClient = createTtsClient();
  return defaultClient;
}
function speak(text, onEnd) {
  getDefaultTtsClient().speak(text, onEnd);
}
function stopSpeaking() {
  getDefaultTtsClient().stop();
}
function prefetchTts(texts) {
  getDefaultTtsClient().prefetch(texts);
}
function subscribeTts(l) {
  return getDefaultTtsClient().subscribe(l);
}
function isTtsPlaying() {
  return getDefaultTtsClient().isPlaying();
}
export {
  createTtsClient,
  getDefaultTtsClient,
  isTtsPlaying,
  prefetchTts,
  speak,
  stopSpeaking,
  subscribeTts
};
//# sourceMappingURL=client.js.map