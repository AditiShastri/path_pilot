import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Loader2 } from "lucide-react";
export type WriteCommitStateEntry = {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
  output?: Record<string, any>;
};

export type WriteCommitStateMap = Record<string, WriteCommitStateEntry>;

export function WriteSqlPreviewCard({
  toolPart,
  onConfirm,
  isBusy,
  commitState,
  canConfirmByWindow,
}: {
  toolPart: any;
  onConfirm?: (previewId: string) => Promise<void>;
  isBusy: boolean;
  commitState?: WriteCommitStateEntry;
  canConfirmByWindow: boolean;
}) {
  const output = (toolPart?.output ?? {}) as Record<string, any>;
  const previewId =
    typeof output.preview_id === "string" ? output.preview_id : undefined;
  const affectedRows = Number(output.affected_rows ?? 0);
  const operation = output.operation ?? "write";
  const table = output.table ?? "unknown table";
  const sql = typeof output.sql === "string" ? output.sql : "";
  const changes = Array.isArray(output.changes) ? output.changes : [];
  const state = toolPart?.state;

  const isLoading =
    state === "input-streaming" || state === "input-available";
  const hasError = !output.ok;
  const alreadyConfirmed = commitState?.status === "success";
  const canConfirm =
    Boolean(previewId) &&
    !isBusy &&
    commitState?.status !== "loading" &&
    !alreadyConfirmed &&
    canConfirmByWindow;

  if (hasError) return null;
  return (
    <div className="mt-3 rounded-xl border border-ring bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Write SQL Preview</p>
          <p className="text-sm text-muted-foreground">
            {operation} on {table} would affect {affectedRows} row
            {affectedRows === 1 ? "" : "s"}.
          </p>
        </div>
        {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      {hasError && toolPart?.errorText && (
        <div className="mt-3 rounded-md border border-red-200 px-3 py-2 text-sm text-red-500">
          {toolPart.errorText}
        </div>
      )}

      {!isLoading && !hasError && (
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            {output.summary ??
              "Preview ran in a transaction and rolled back. Confirm to commit."}
          </p>

          {changes.length > 0 && (
            <Collapsible className="mt-3 rounded-md border bg-background">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-between px-3 py-2 text-sm font-medium"
                >
                  <span className="flex items-center gap-2">
                    <span>Affected Changes</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {changes.length} row{changes.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <ChevronDown className="size-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t p-3">
                  <div className="max-h-80 overflow-auto rounded border">
                    <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 bg-muted/50">
                        <tr>
                          {changes.length > 0 &&
                            Object.keys(changes[0] || {}).map((key) => (
                              <th
                                key={key}
                                className="border-b border-border px-3 py-2 text-left font-semibold text-muted-foreground"
                              >
                                {key}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {changes.map((change: any, idx: number) => (
                          <tr
                            key={idx}
                            className="border-b border-border hover:bg-muted/30"
                          >
                            {Object.entries(change).map(([key, value]) => (
                              <td
                                key={`${idx}-${key}`}
                                className="px-3 py-2 text-xs"
                              >
                                <span className="max-w-sm truncate break-words font-mono">
                                  {value === null || value === undefined
                                    ? "null"
                                    : typeof value === "object"
                                      ? JSON.stringify(value)
                                      : String(value)}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {sql && (
            <Collapsible className="mt-3 rounded-md border bg-background">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-between px-3 py-2 text-sm font-medium"
                >
                  SQL Preview
                  <ChevronDown className="size-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3">
                  <pre className="p-3 overflow-auto whitespace-pre-wrap p-2 text-xs">
                    {sql}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              disabled={!canConfirm}
              onClick={async () => {
                if (previewId && onConfirm) {
                  await onConfirm(previewId);
                }
              }}
            >
              {commitState?.status === "loading" ? "Committing..." : commitState?.status === "success" ? "Committed" : "Confirm and Run"}
            </Button>
            {previewId && (
              <span className="text-xs text-muted-foreground">Preview ID: {previewId}</span>
            )}
          </div>
          {commitState?.status === "error" && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {commitState.message ?? "Failed to commit write."}
            </p>
          )}
          {!canConfirmByWindow && !alreadyConfirmed && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              Confirmation is only available for the latest message or for 10 minutes after preview.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function WriteSqlCommitCard({ toolPart }: { toolPart: any }) {
  const output = (toolPart?.output ?? {}) as Record<string, any>;
  const affectedRows = Number(output.affected_rows ?? 0);
  const state = toolPart?.state;
  const isLoading =
    state === "input-streaming" || state === "input-available";

  return (
    <div className="mt-3 rounded-xl border border-green-200/60 bg-green-50/60 p-3 dark:border-green-950 dark:bg-green-950/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Write SQL Commit</p>
          <p className="text-sm text-muted-foreground">
            {output.summary ?? "Confirmed write operation committed."}
          </p>
        </div>
        {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      {!isLoading && (
        <p className="mt-2 text-xs text-muted-foreground">
          Affected rows: {affectedRows}
          {output.preview_id ? ` • Preview ID: ${output.preview_id}` : ""}
        </p>
      )}
    </div>
  );
}