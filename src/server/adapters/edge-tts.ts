/**
 * EdgeTTS reference synthesizer (msedge-tts, free Microsoft Edge voices).
 * Import path: "edge-tts-pipeline/server/adapters" — requires the optional
 * `msedge-tts` peer dependency.
 */

import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { SynthAdapter } from "../../shared/adapters";

export interface EdgeTtsAdapterOptions {
  /** mp3 output format (default: 24kHz 48kbit mono) */
  format?: (typeof OUTPUT_FORMAT)[keyof typeof OUTPUT_FORMAT];
}

export function createEdgeTtsSynth(options: EdgeTtsAdapterOptions = {}): SynthAdapter {
  return {
    async synthesize(text: string, voice: string): Promise<Buffer> {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(
        voice,
        options.format ?? OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
      );
      const { audioStream } = tts.toStream(text);
      const chunks: Buffer[] = [];
      for await (const c of audioStream) chunks.push(c as Buffer);
      return Buffer.concat(chunks);
    },
  };
}

/** Common free Edge voices worth defaulting to. */
export const EDGE_VOICES = {
  enUSFemale: "en-US-AriaNeural",
  enUSMale: "en-US-GuyNeural",
  zhCNFemale: "zh-CN-XiaoxiaoNeural",
  zhCNMale: "zh-CN-YunxiNeural",
} as const;
