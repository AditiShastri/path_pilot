import { tool } from "ai";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";

const WRITE_START = /^(insert|update|delete)\b/i;
const UPSERT_HINT = /\bon\s+conflict\b/i;
const FORBIDDEN = [
  "alter",
  "drop",
  "truncate",
  "grant",
  "revoke",
  "create",
  "comment",
  "vacuum",
  "analyze",
  "copy",
  "execute",
  "do",
  "show",
];

function assertSafeWriteSql(rawSql: string) {
  const sql = rawSql.trim();
  const lower = sql.toLowerCase();

  if (!sql) {
    throw new Error("SQL is required");
  }

  if (sql.includes("--") || sql.includes("/*") || sql.includes("*/")) {
    throw new Error("SQL comments are not allowed in write_sql requests");
  }

  const semicolonCount = (sql.match(/;/g) || []).length;
  if (semicolonCount > 1 || (semicolonCount === 1 && !sql.endsWith(";"))) {
    throw new Error("Only a single SQL statement is allowed");
  }

  if (!WRITE_START.test(lower)) {
    throw new Error("Only INSERT, UPDATE, DELETE, or UPSERT SQL is allowed");
  }

  const containsForbidden = FORBIDDEN.some((kw) =>
    new RegExp(`\\b${kw}\\b`, "i").test(lower)
  );

  if (containsForbidden) {
    throw new Error("Forbidden SQL keyword detected for write execution");
  }
}

function cleanSql(rawSql: string) {
  return rawSql.trim().replace(/;+\s*$/, "");
}

function inferOperation(sql: string) {
  const lower = sql.toLowerCase().trim();

  if (lower.startsWith("insert")) {
    if (UPSERT_HINT.test(lower)) return "upsert";
    return "insert";
  }

  if (lower.startsWith("update")) return "update";
  if (lower.startsWith("delete")) return "delete";
  return "unknown";
}

export const previewWriteSqlTool = tool({
  description: `
    Previews a SQL write operation in a database transaction and rolls it back.

    Use this tool before every write operation.
    Allowed statements: INSERT, UPDATE, DELETE, and INSERT ... ON CONFLICT (upsert).
    The tool returns affected rows and a preview_id needed for final execution.
  `,
  inputSchema: z.object({
    sql: z
      .string()
      .describe("Single PostgreSQL write statement (insert/update/delete/upsert)"),
  }),
  execute: async ({ sql }) => {
    assertSafeWriteSql(sql);
    const cleaned = cleanSql(sql);
    const supabase = await createServerClient();
    const previewCreatedAt = new Date();
    const previewExpiresAt = new Date(previewCreatedAt.getTime() + 10 * 60 * 1000);

    const { data, error } = await supabase.rpc("execute_preview_write_sql", {
      p_sql: cleaned,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    return {
      ok: true,
      requires_confirmation: true,
      operation: row?.operation ?? inferOperation(cleaned),
      table: row?.table_name ?? null,
      affected_rows: row?.affected_rows ?? 0,
      preview_id: row?.preview_id ?? null,
      sql: row?.query ?? cleaned,
      preview_created_at: previewCreatedAt.toISOString(),
      preview_expires_at: previewExpiresAt.toISOString(),
      changes: row?.changes ?? [],
      summary:
        row?.summary ??
        "Preview executed in transaction and rolled back. Ask user for confirmation before commit.",
    };
  },
});

export const executeWriteSqlTool = tool({
  description: `
    Commits a previously previewed SQL write operation.

    Call this only after the user explicitly confirms a preview.
    Requires preview_id returned by execute_preview_write_sql.
  `,
  inputSchema: z.object({
    preview_id: z
      .string()
      .min(1)
      .describe("Preview ID from execute_preview_write_sql"),
  }),
  execute: async ({ preview_id }) => {
    const supabase = await createServerClient();

    const { data, error } = await supabase.rpc("execute_write_sql", {
      p_preview_id:preview_id,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    return {
      ok: true,
      committed: true,
      preview_id,
      operation: row?.operation ?? null,
      table: row?.table_name ?? null,
      affected_rows: row?.affected_rows ?? 0,
      committed_at: row?.committed_at ?? null,
      summary: row?.summary ?? "Write operation committed successfully.",
    };
  },
});
