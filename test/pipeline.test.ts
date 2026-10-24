import { describe, expect, it } from "vitest";
import { createMemoryAdapters } from "../src/shared/adapters";
import { ensureTts } from "../src/server/pipeline";
import { ttsKey, parseTtsQuery } from "../src/shared/keys";

describe("ttsKey", () => {
  it("is stable for the same voice+text", () => {
    expect(ttsKey("v1", "hello world")).toBe(ttsKey("v1", "hello world"));
  });

  it("differs by voice", () => {
    expect(ttsKey("v1", "hi")).not.toBe(ttsKey("v2", "hi"));
  });

  it("normalizes whitespace but preserves word boundaries", () => {
    expect(ttsKey("v", "hello   world")).toBe(ttsKey("v", "hello world"));
    expect(ttsKey("v", "helloworld")).not.toBe(ttsKey("v", "hello world"));
  });
});

describe("parseTtsQuery", () => {
  it("extracts text and voice", () => {
    const { text, voice } = parseTtsQuery("https://x/api/tts?text=hi%20there&voice=v9");
    expect(text).toBe("hi there");
    expect(voice).toBe("v9");
  });
});

describe("ensureTts pipeline", () => {
  function setup() {
    const { storage, cache } = createMemoryAdapters();
    let synthCalls = 0;
    const opts = {
      storage,
      cache,
      defaultVoice: "test-voice",
      synth: {
        async synthesize() {
          synthCalls++;
          return Buffer.from("fake-mp3");
        },
      },
    };
    return { opts, storage, cache, counter: () => synthCalls };
  }

  it("synthesizes once, then serves from cache", async () => {
    const s = setup();
    const first = await ensureTts(s.opts, "hello", undefined);
    expect(first.generated).toBe(true);
    expect(s.counter()).toBe(1);
    expect(s.storage.files.has(first.storageKey)).toBe(true);

    const second = await ensureTts(s.opts, "hello", undefined);
    expect(second.generated).toBe(false);
    expect(second.publicUrl).toBe(first.publicUrl);
    expect(s.counter()).toBe(1);
  });

  it("requires a voice", async () => {
    const s = setup();
    const noDefault = { ...s.opts, defaultVoice: undefined };
    await expect(ensureTts(noDefault as never, "hello", undefined)).rejects.toThrow(/voice/i);
  });

  it("rejects empty text", async () => {
    const s = setup();
    await expect(ensureTts(s.opts, "   ", undefined)).rejects.toThrow(/empty/i);
  });

  it("records voice+text meta for audit", async () => {
    const s = setup();
    const r = await ensureTts(s.opts, "audit me", undefined);
    expect(s.cache.index.get(`${r.cacheKey}:text`)).toBe("audit me");
  });
});
