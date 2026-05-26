export type WhisperSegment = {
  startMs: number;
  endMs: number;
  text: string;
};

export type WhisperTranscribeInput = {
  /** Public or worker-reachable URL of an audio/video asset. */
  audioUrl?: string;
  /** Local filesystem path on the Whisper service host. */
  audioPath?: string;
  /** ISO-639-1 code; default 'en'. */
  language?: string;
  /** Whisper model preset (controls cost / accuracy). */
  model?: "tiny.en" | "base.en" | "small.en" | "medium.en" | "large-v3-turbo";
};

export type WhisperTranscribeResult = {
  language: string;
  text: string;
  segments: WhisperSegment[];
  model: string;
  durationSeconds: number;
};

export type WhisperClient = {
  transcribe: (input: WhisperTranscribeInput) => Promise<WhisperTranscribeResult>;
};

export function createWhisperClient(baseUrl: string): WhisperClient {
  const normalizedBaseUrl = baseUrl.replace(/\/$/u, "");
  return {
    async transcribe(input) {
      const response = await fetch(`${normalizedBaseUrl}/transcribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          audio_url: input.audioUrl ?? null,
          audio_path: input.audioPath ?? null,
          language: input.language ?? "en",
          model: input.model ?? "small.en",
        }),
      });
      if (!response.ok) {
        throw new Error(`whisper /transcribe failed: ${response.status} ${await response.text()}`);
      }
      const body = (await response.json()) as {
        language: string;
        text: string;
        segments: Array<{ start_ms: number; end_ms: number; text: string }>;
        model: string;
        duration_seconds: number;
      };
      return {
        language: body.language,
        text: body.text,
        segments: body.segments.map((segment) => ({
          startMs: segment.start_ms,
          endMs: segment.end_ms,
          text: segment.text,
        })),
        model: body.model,
        durationSeconds: body.duration_seconds,
      };
    },
  };
}
