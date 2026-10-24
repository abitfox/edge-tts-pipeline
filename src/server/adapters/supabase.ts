/**
 * Supabase reference adapters (Storage bucket + cache table).
 * Import path: "edge-tts-pipeline/server/adapters" — requires the optional
 * `@supabase/supabase-js` peer dependency.
 *
 * Cache table shape (create with the SQL below):
 *
 *   create table tts_cache (
 *     id text primary key,          -- sha1(voice:normalized text)
 *     voice text not null,
 *     content text not null,
 *     storage_path text not null
 *   );
 *
 * The bucket should be public so clients can fetch the audio directly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CacheAdapter, StorageAdapter } from "../../shared/adapters";

export interface SupabaseAdaptersOptions {
  /** Service-role client (server side only) */
  client: SupabaseClient;
  /** Storage bucket name (default "tts-audio") */
  bucket?: string;
  /** Cache table name (default "tts_cache") */
  table?: string;
  /** Public base URL of the project, e.g. https://xxx.supabase.co */
  publicBaseUrl: string;
}

export function createSupabaseAdapters(
  options: SupabaseAdaptersOptions,
): { storage: StorageAdapter; cache: CacheAdapter } {
  const bucket = options.bucket ?? "tts-audio";
  const table = options.table ?? "tts_cache";

  const publicUrl = (path: string) =>
    `${options.publicBaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path}`;

  return {
    storage: {
      async put(key, audio, contentType) {
        const { error } = await options.client.storage
          .from(bucket)
          .upload(key, audio, { contentType, cacheControl: "3600", upsert: true });
        if (error && !error.message.includes("exists")) throw error;
        return publicUrl(key);
      },
      url(key) {
        return publicUrl(key);
      },
    },
    cache: {
      async get(cacheKey) {
        const { data } = await options.client
          .from(table)
          .select("storage_path")
          .eq("id", cacheKey)
          .maybeSingle();
        return data?.storage_path ?? null;
      },
      async set(cacheKey, storageKey, meta) {
        const { error } = await options.client.from(table).upsert(
          {
            id: cacheKey,
            voice: meta?.voice ?? "",
            content: meta?.text ?? "",
            storage_path: storageKey,
          },
          { onConflict: "id" },
        );
        if (error) throw error;
      },
    },
  };
}
