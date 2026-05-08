import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

type TableSchema = {
  sheetName: string;
  columns: string[];
  dateColumns?: string[];
};

const TABLE_SCHEMAS: Record<string, TableSchema> = {
  aircraft: {
    sheetName: "Aircraft",
    columns: [
      "aircraft_tail_number",
      "delivery_date",
      "aircraft_cycles",
      "aircraft_time",
      "retirement_date",
    ],
    dateColumns: ["delivery_date", "retirement_date"],
  },
  engine: {
    sheetName: "Engine",
    columns: [
      "engine_serial_number",
      "delivery_date",
      "operational_date",
      "retirement_date",
      "cycles",
      "asvn",
    ],
    dateColumns: ["delivery_date", "operational_date", "retirement_date"],
  },
  workscope_cost: {
    sheetName: "Workscope Cost",
    columns: [
      "id",
      "trigger_type",
      "trigger_value",
      "cost_bucket_name",
      "unit",
      "distribution_curve_type",
      "mean",
      "standard_deviation",
      "cost_type",
      "etsv_max",
      "etsv_min",
    ],
  },
  life_limited_parts: {
    sheetName: "Life Limited Parts",
    columns: [
      "id",
      "part_nomencleture",
      "part_number",
      "part_code",
      "part_iin",
      "llpind",
      "part_availability_start_date",
      "cycles",
    ],
    dateColumns: ["part_availability_start_date"],
  },
};

function toTitleCaseHeader(rawColumnName: string) {
  return rawColumnName
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function toMMDDYYYY(value: unknown): string {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();

  return `${mm}/${dd}/${yyyy}`;
}

function formatTableRows(rows: Record<string, unknown>[], schema: TableSchema) {
  const dateColumns = new Set(schema.dateColumns ?? []);

  return rows.map((row) => {
    const formatted: Record<string, unknown> = {};

    for (const column of schema.columns) {
      const header = toTitleCaseHeader(column);
      const value = row[column];
      formatted[header] = dateColumns.has(column) ? toMMDDYYYY(value) : (value ?? "");
    }

    return formatted;
  });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const workbook = XLSX.utils.book_new();

  for (const [tableName, schema] of Object.entries(TABLE_SCHEMAS)) {
    const { data, error } = await supabase.from(tableName).select(schema.columns.join(","));

    if (error) {
      return NextResponse.json(
        { message: `Failed to fetch ${tableName}`, error: error.message },
        { status: 500 }
      );
    }

    const rows = (Array.isArray(data) ? data : []) as unknown as Record<string, unknown>[];
    const formattedRows = formatTableRows(rows, schema);
    const worksheet = XLSX.utils.json_to_sheet(formattedRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, schema.sheetName);
  }

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const filename = `pixie-data-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
