export type PokeeSearchResultItem = {
  title?: string;
  url?: string;
  link?: string;
  snippet?: string;
  description?: string;
  [key: string]: unknown;
};

export type PokeeSearchResponse = {
  success?: boolean;
  query?: string;
  results?: PokeeSearchResultItem[];
  error?: string;
  [key: string]: unknown;
};

export type PokeeReadResponse = {
  success?: boolean;
  url?: string;
  question?: string;
  summary?: string;
  content?: string;
  discovered_urls?: string[];
  error?: string;
  [key: string]: unknown;
};

export type PokeeResearchClient = {
  search: (query: string) => Promise<PokeeSearchResponse>;
  read: (url: string, question: string) => Promise<PokeeReadResponse>;
};

type FetchLike = typeof fetch;

export function createPokeeResearchClient(baseUrl: string, fetchImpl: FetchLike = fetch): PokeeResearchClient {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  async function requestJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(`PokeeResearch request failed: ${response.status} ${responseBody}`);
    }

    return response.json() as Promise<T>;
  }

  return {
    search(query) {
      return requestJson<PokeeSearchResponse>("/search", { query });
    },
    read(url, question) {
      return requestJson<PokeeReadResponse>("/read", { url, question });
    },
  };
}
