import { Markdown } from "@/components/Markdown";


export function PresentDataCard({ toolPart }: { toolPart: any }) {
  if (!toolPart.output && toolPart.state !== "result" && toolPart.state !== "output-available") {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-sm">
        <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        Preparing data visualization...
      </div>
    );
  }

  const MAX_VISIBLE_ROWS = 120;
  const MAX_VISIBLE_COLUMNS = 24;
  const output = (toolPart?.output ?? {}) as Record<string, any>;
  const title = typeof output.title === "string" ? output.title : "Presented Data";
  const summary = typeof output.summary === "string" ? output.summary : "";
  const markdown = typeof output.markdown === "string" ? output.markdown : "";
  const rows = Array.isArray(output.rows)
    ? output.rows.filter((row): row is Record<string, any> => row && typeof row === "object" && !Array.isArray(row))
    : [];
  const columns = Array.isArray(output.columns)
    ? output.columns.map((column) => String(column))
    : [];
  const notes = Array.isArray(output.notes) ? output.notes : [];
  const viewType = typeof output.viewType === "string" ? output.viewType : "markdown";
  const derivedColumns = (columns.length > 0 ? columns : Object.keys(rows[0] || {})).slice(0, MAX_VISIBLE_COLUMNS);
  const visibleRows = rows.slice(0, MAX_VISIBLE_ROWS);

  const formatCell = (value: unknown) => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return "[unserializable object]";
      }
    }
    return String(value);
  };

  return (
    <div className="mt-3 rounded-xl bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
      </div>

      {markdown && (
          <Markdown content={markdown} />
      )}

      {viewType === "table" && rows.length > 0 && (
        <div className="max-h-96 overflow-auto rounded-lg border bg-background">
          {(rows.length > MAX_VISIBLE_ROWS || (columns.length > 0 && columns.length > MAX_VISIBLE_COLUMNS)) && (
            <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Showing {Math.min(rows.length, MAX_VISIBLE_ROWS)} of {rows.length} rows
              {columns.length > MAX_VISIBLE_COLUMNS ? ` and ${MAX_VISIBLE_COLUMNS} of ${columns.length} columns` : ""}
              . Refine your query to narrow results.
            </div>
          )}
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-muted/50">
              <tr>
                {derivedColumns.map((column) => (
                  <th
                    key={column}
                    className="border-b border-border px-3 py-2 text-left font-semibold text-muted-foreground"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row: Record<string, any>, rowIndex: number) => (
                <tr key={rowIndex} className="border-b border-border hover:bg-muted/30">
                    {derivedColumns.map((column) => (
                    <td key={`${rowIndex}-${column}`} className="px-3 py-2 align-top text-xs">
                      <span className="max-w-sm break-words font-mono">
                        {formatCell(row?.[column])}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {notes.length > 0 && (
        <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground space-y-1">
          {notes.map((note: string, index: number) => (
            <div key={`${index}-${note}`}>{note}</div>
          ))}
        </div>
      )}
    </div>
  );
}