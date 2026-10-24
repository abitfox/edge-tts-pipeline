import { defineConfig } from "tsup";

/**
 * Each entry is bundled standalone (splitting: false). The optional peer
 * dependencies (msedge-tts / @supabase/supabase-js) are externalized by tsup —
 * they are only imported inside the modules that need them, so consumers
 * without them never load those code paths.
 */
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    target: "es2020",
    clean: true,
  },
  {
    entry: { server: "src/server/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    target: "es2020",
  },
  {
    entry: { client: "src/client/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    target: "es2020",
  },
]);
