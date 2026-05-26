export type DeckWorkerConfig = {
  port: number;
  storagePath: string;
  publicMediaBaseUrl: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DeckWorkerConfig {
  return {
    port: Number(env.PORT ?? 3004),
    storagePath: env.DECK_STORAGE_PATH ?? "/tmp/socialops-rendered-decks",
    publicMediaBaseUrl: env.PUBLIC_MEDIA_BASE_URL ?? "",
  };
}
