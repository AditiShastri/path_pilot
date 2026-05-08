import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function assertReadOnly(query: string) {
  const q = query.toLowerCase().trim();

  if (!q.startsWith("select")) {
    throw new Error("Only SELECT queries are allowed");
  }

  const forbidden = ["insert", "update", "delete", "drop", "alter", "truncate"];
  if (forbidden.some((kw) => q.includes(kw))) {
    throw new Error("Forbidden SQL detected");
  }
}

export const readSqlTool = tool({
  description: `
    Executes a PostgreSQL SELECT query and returns the result as table data.
    
    This is the ONLY way to access the database.
    The query must strictly follow the provided schema and join rules.
    The output will be rendered as a table by the UI.
    `,

  inputSchema: z.object({
    query: z
      .string()
      .describe("Valid PostgreSQL SELECT query using provided schema"),
    present: z
      .boolean()
      .optional()
      .describe("If true, the output will be presented to the user directly like present_data."),
    title: z
      .string()
      .optional()
      .describe("Short title for the displayed content (used if present is true)"),
    summary: z
      .string()
      .optional()
      .describe("Short speakable summary for the voice assistant (used if present is true)"),
    viewType: z
      .enum(["table", "markdown", "summary"])
      .optional()
      .describe("Preferred visual presentation mode (used if present is true)"),
  }),

  execute: async ({ query, present, title, summary, viewType }) => {
    assertReadOnly(query);
    const cleaned = query.replace(/;/g, "");
    // console.log(query);
    const { data, error } = await supabase.rpc("execute_read_sql", {
      sql: cleaned,
    });

    if (error) throw error;

    const rows = data ?? [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    // If the assistant requested presentation, return the fields expected by PresentDataCard
    if (present) {
      return {
        columns,
        rows,
        title: title || "Query Results",
        summary: summary || `Found ${rows.length} rows.`,
        viewType: viewType || "table",
        markdown: "",
        notes: [],
        presented: true // Flag to tell frontend to show it
      };
    }

    // ✅ Return UI-ready table
    return {
      columns,
      rows,
    };
  },
});
