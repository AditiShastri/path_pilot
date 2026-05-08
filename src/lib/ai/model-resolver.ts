import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

type Mode = "gateway" | "server-key" | "user-key";

type ResolveInput = {
  mode: Mode;
  model: string;
  userApiKey?: string;
};

export function resolveModel({ mode, model, userApiKey }: ResolveInput) {
  // ✅ Gateway mode (Vercel AI Gateway handles auth)
  if (mode === "gateway") {
    return model;
  }

  const [provider, ...rest] = model.split("/");
  const modelName = rest.join("/");

  const apiKey =
    mode === "user-key"
      ? userApiKey
      : process.env[`${provider.toUpperCase()}_API_KEY`];

  if (!apiKey) {
    throw new Error(`Missing API key for ${provider}`);
  }

  // ✅ OpenAI
  if (provider === "openai") {
    const client = createOpenAI({ apiKey });
    return client(modelName);
  }

  // ✅ Anthropic
  if (provider === "anthropic") {
    const client = createAnthropic({ apiKey });
    return client(modelName);
  }

  // ✅ Google Gemini
  if (provider === "google") {
    const client = createGoogleGenerativeAI({ apiKey });
    return client(modelName);
  }


  if (provider === "groq") {
    const client = createOpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  
    return client(modelName);
  }
  

  // ✅ OpenRouter
  if (provider === "openrouter") {
    const client = createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
    return client(modelName);
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
