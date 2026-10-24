import { createHash } from "node:crypto";

/**
 * Content-addressed cache key: sha1(voice:tilde-text).
 * The tilde preserves word boundaries — normalizing arbitrary whitespace
 * would let "hello world" and "helloworld" collide audibly.
 */
export function ttsKey(voice: string, text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return createHash("sha1").update(`${voice}:${normalized}`).digest("hex");
}

/** Standard query parsing for GET /api/tts style endpoints. */
export function parseTtsQuery(url: string): { text: string; voice?: string } {
  const u = new URL(url);
  return {
    text: u.searchParams.get("text") ?? "",
    voice: u.searchParams.get("voice") ?? undefined,
  };
}
