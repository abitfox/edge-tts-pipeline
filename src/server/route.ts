/**
 * Next.js App Router route-handler factory for GET /api/tts.
 *
 *   // app/api/tts/route.ts
 *   import { createTtsRoute } from "edge-tts-pipeline/server";
 *   export const GET = createTtsRoute({ ... });
 *
 * Behavior: cache hit → 302 to the stored public URL (browser fetches storage
 * directly, your server streams nothing); miss → synthesize, store, 302.
 */

import { ensureTts, type TtsPipelineOptions } from "./pipeline";
import { parseTtsQuery } from "../shared/keys";

export interface TtsRouteOptions extends TtsPipelineOptions {
  /** Max accepted text length (default 500) */
  maxTextLength?: number;
}

export function createTtsRoute(options: TtsRouteOptions) {
  const maxTextLength = options.maxTextLength ?? 500;
  return async function GET(request: Request): Promise<Response> {
    try {
      const { text, voice } = parseTtsQuery(request.url);
      if (!text.trim()) {
        return Response.json({ error: "Missing ?text=" }, { status: 400 });
      }
      if (text.length > maxTextLength) {
        return Response.json({ error: "Text too long" }, { status: 413 });
      }
      const result = await ensureTts(options, text, voice);
      return Response.redirect(result.publicUrl, 302);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return Response.json({ error: message }, { status: 502 });
    }
  };
}
