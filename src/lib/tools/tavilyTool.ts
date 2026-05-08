import { tool } from "ai";
import { z } from "zod";

const TAVILY_API_URL = "https://api.tavily.com/search";

export const tavilyTool = tool({
  description: `
    Search the public web for up-to-date information.
    Use this when the answer is not in the database or requires current events.
    Return a concise summary and sources.
  `,
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Maximum number of results (1-10)"),
    search_depth: z
      .enum(["basic", "advanced"])
      .optional()
      .describe("Search depth"),
  }),
  execute: async ({ query, max_results = 5, search_depth = "basic" }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error("Missing TAVILY_API_KEY");
    }

    const response = await fetch(TAVILY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results,
        search_depth,
        include_answer: true,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tavily error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const results = Array.isArray(data.results)
      ? data.results.map((result: any) => ({
          title: result.title,
          url: result.url,
          content: result.content,
        }))
      : [];

    return {
      query,
      answer: data.answer ?? "",
      results,
    };
  },
});
