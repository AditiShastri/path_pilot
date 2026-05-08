// models.ts

export type Provider =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "openrouter";

export type ModelOption = {
  label: string;
  value: string; // provider/model-name
};
// models.ts

export function parseModelValue(value: string): {
  provider: Provider;
  model: string;
} {
  const firstSlash = value.indexOf("/");
  if (firstSlash === -1) {
    throw new Error(`Invalid model value: ${value}`);
  }

  const provider = value.slice(0, firstSlash) as Provider;
  const model = value.slice(firstSlash + 1);

  return { provider, model };
}

export const MODEL_GROUPS: Record<
  Provider,
  { label: string; models: ModelOption[] }
> = {
  openai: {
    label: "OpenAI",
    //gpt-5.4-mini, gpt-5.4-nano, gpt-5.1-codex-mini, gpt-5-mini, gpt-5-nano, gpt-4.1-mini, gpt-4.1-nano, gpt-4o-mini, o1-mini, o3-mini, o4-mini, and codex-mini-latest. 2.5mil

    // gpt-5.4, gpt-5.2, gpt-5.1, gpt-5.1-codex, gpt-5, gpt-5-codex, gpt-5-chat-latest, gpt-4.1, gpt-4o, o1, and o3. 250k
    models: [
      // — Full / Core
      { label: "gpt-5.4", value: "openai/gpt-5.4" },
      { label: "gpt-5.2", value: "openai/gpt-5.2" },
      { label: "gpt-5.1", value: "openai/gpt-5.1" },
      { label: "gpt-5.1-codex", value: "openai/gpt-5.1-codex" },
      { label: "o3", value: "openai/o3" },
  
      // — Small / Efficient
      
      { label: "gpt-5.4-mini", value: "openai/gpt-5.4-mini" },
      { label: "gpt-5.1-codex-mini", value: "openai/gpt-5.1-codex-mini" },
      { label: "gpt-5-mini", value: "openai/gpt-5-mini" },
      { label: "gpt-4o-mini", value: "openai/gpt-4o-mini" },
    ],
  },  

  anthropic: {
    label: "Anthropic (Claude)",
    models: [
      { label: "Claude 3.5 Sonnet", value: "anthropic/claude-3-5-sonnet" },
      { label: "Claude 3 Opus", value: "anthropic/claude-3-opus" },
    ],
  },

  google: {
    label: "Google Gemini",
    models: [
      { label: "Gemini 2.5 Flash", value: "google/gemini-2.5-flash" },
      { label: "Gemini 2.5 Flash-Lite", value: "google/gemini-2.5-flash-lite" },
      { label: "Gemini 2.5 Pro", value: "google/gemini-2.5-pro" },
      { label: "Gemini 2.0 Flash", value: "google/gemini-2.0-flash" },
      { label: "Gemini 2.0 Flash-Lite", value: "google/gemini-2.0-flash-lite" },
    ],
  },
  


  groq: {
    label: "Groq Cloud",
    models: [
      { label: "Llama 3.1 Instant", value: "groq/llama-3.1-8b-instant" },
      { label: "Llama 3.3 70B Versatile", value: "groq/llama-3.3-70b-versatile" },
      { label: "Qwen 3 32B", value: "groq/qwen/qwen3-32b" },
    ],
  },
  
  

  openrouter: {
    label: "OpenRouter",
    models: [
      {
        label: "Mixtral 8x7B",
        value: "openrouter/mistralai/mixtral-8x7b",
      },
    ],
  },
};
