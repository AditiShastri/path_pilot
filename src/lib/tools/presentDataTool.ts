import { tool } from "ai";
import { z } from "zod";

const rowSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .describe("A single row of display data");

export const presentDataTool = tool({
  description: `
    Present data in a user-friendly way when it is not ideal to read aloud directly.
    Use this for tables, grouped rows, key/value summaries, or markdown-formatted details.

    The assistant should say a short spoken summary first, such as:
    "I found 12 matching rows. Showing them now."
    Then call this tool to display the richer content on screen.
  `,
  inputSchema: z.object({
    title: z
      .string()
      .describe("Short title for the displayed content"),
    summary: z
      .string()
      .describe("Short speakable summary for the voice assistant"),
    markdown: z
      .string()
      .optional()
      .describe("Markdown content to render in the chat UI"),
    columns: z
      .array(z.string())
      .optional()
      .describe("Column names for tabular display"),
    rows: z
      .array(rowSchema)
      .optional()
      .describe("Tabular rows for structured display"),
    notes: z
      .array(z.string())
      .optional()
      .describe("Optional short notes to show below the data"),
    viewType: z
      .enum(["markdown", "table", "summary"])
      .default("markdown")
      .describe("Preferred visual presentation mode"),
  }),
  execute: async (input) => {
    return {
      title: input.title,
      summary: input.summary,
      markdown: input.markdown ?? "",
      columns: input.columns ?? [],
      rows: input.rows ?? [],
      notes: input.notes ?? [],
      viewType: input.viewType,
    };
  },
});