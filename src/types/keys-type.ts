// key-types.ts
export type Provider =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "openrouter";

export type KeyStore = Partial<Record<Provider, string>>;
