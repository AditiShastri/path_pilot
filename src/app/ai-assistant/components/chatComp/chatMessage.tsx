import { memo, useDeferredValue } from "react";
import { WriteCommitStateMap,WriteSqlPreviewCard,WriteSqlCommitCard } from "./writeSqlCards";
import { Tool } from "@/components/ui/tool";
import { Message,MessageAction, MessageActions, MessageContent } from "@/components/ui/message";
import { ToolExecutionSummary } from "./toolExecutionSummary";
import { cn } from "@/lib/utils";
import { PresentDataCard } from "./presentDataCard";
import { CheckCheck, Copy, RefreshCcw, Volume2, VolumeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";


export type ChatMessageProps = {
  message: any;
  status: string;
  isCopied: boolean;
  onCopyMessage: (message: any) => void | Promise<void>;
  onRegenerate: (messageId: string) => void;
  isLastAssistant: boolean;
  isSpeaking: boolean;
  onReadAloud: (message: any) => void;
  devMode: boolean;
  onConfirmWritePreview: (previewId: string) => Promise<void>;
  writeCommitState: WriteCommitStateMap;
};

const TextPart = memo(function TextPart({
  text,
  isAssistant,
}: {
  text: string;
  isAssistant: boolean;
  isStreaming: boolean;
}) {
  const deferredText = useDeferredValue(text);

  return (
    <MessageContent
      className={
        isAssistant
          ? "bg-background prose prose-neutral max-w-none"
          : "bg-foreground/70 p-2 px-5 rounded-2xl my-0 text-background prose prose-neutral max-w-none"
      }
    >
      {isAssistant ? <Markdown content={deferredText} /> : deferredText}
    </MessageContent>
  );
});
function getPreviewIdsFromMessage(message: any): string[] {
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  return parts
    .map((part: any) => {
      if (part?.type !== "tool-execute_preview_write_sql") return null;
      const output = (part?.output ?? {}) as Record<string, any>;
      return typeof output.preview_id === "string" ? output.preview_id : null;
    })
    .filter((id: string | null): id is string => Boolean(id));
}
function areChatMessagePropsEqual(prev: ChatMessageProps, next: ChatMessageProps) {
  if (prev.message?.id !== next.message?.id) return false;
  if (prev.message !== next.message) return false;
  if (prev.status !== next.status) return false;
  if (prev.isCopied !== next.isCopied) return false;
  if (prev.isLastAssistant !== next.isLastAssistant) return false;
  if (prev.isSpeaking !== next.isSpeaking) return false;
  if (prev.devMode !== next.devMode) return false;

  const previewIds = new Set([
    ...getPreviewIdsFromMessage(prev.message),
    ...getPreviewIdsFromMessage(next.message),
  ]);

  for (const previewId of previewIds) {
    if (prev.writeCommitState?.[previewId] !== next.writeCommitState?.[previewId]) {
      return false;
    }
  }

  return true;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  status,
  isCopied,
  onCopyMessage,
  onRegenerate,
  isLastAssistant,
  isSpeaking,
  onReadAloud,
  devMode,
  onConfirmWritePreview,
  writeCommitState,
}: ChatMessageProps) {
  const isAssistant = message.role === "assistant";
  const messageParts = Array.isArray(message?.parts) ? message.parts : [];
  const previewIds = messageParts
    .map((part: any) => {
      if (part?.type !== "tool-execute_preview_write_sql") return null;
      const output = (part?.output ?? {}) as Record<string, any>;
      return typeof output.preview_id === "string" ? output.preview_id : null;
    })
    .filter((id: string | null): id is string => Boolean(id));

  const directCommitToolParts = previewIds
    .map((previewId: string) => {
      const entry = writeCommitState?.[previewId];
      if (!entry || entry.status === "idle") return null;

      const stateMap: Record<string, string> = {
        loading: "input-available",
        success: "output-available",
        error: "output-error",
      };

      return {
        type: "tool-execute_write_sql",
        toolCallId: `direct-commit-${previewId}`,
        state: stateMap[entry.status] ?? "input-available",
        input: { preview_id: previewId },
        output:
          entry.status === "success"
            ? entry.output ?? { preview_id: previewId, summary: entry.message }
            : undefined,
        errorText: entry.status === "error" ? entry.message : undefined,
      };
    })
    .filter(Boolean) as any[];

  const directCommitByPreviewId = new Map<string, any>();
  for (const toolPart of directCommitToolParts) {
    const previewId =
      typeof toolPart?.input?.preview_id === "string"
        ? toolPart.input.preview_id
        : undefined;
    if (previewId) {
      directCommitByPreviewId.set(previewId, toolPart);
    }
  }

  const expandedParts: any[] = [];
  const consumedPreviewIds = new Set<string>();
  for (const part of messageParts) {
    expandedParts.push(part);

    if (part?.type !== "tool-execute_preview_write_sql") {
      continue;
    }

    const previewId =
      typeof part?.output?.preview_id === "string"
        ? part.output.preview_id
        : undefined;
    if (!previewId || consumedPreviewIds.has(previewId)) {
      continue;
    }

    const directCommitPart = directCommitByPreviewId.get(previewId);
    if (directCommitPart) {
      expandedParts.push(directCommitPart);
      consumedPreviewIds.add(previewId);
    }
  }

  for (const toolPart of directCommitToolParts) {
    const previewId =
      typeof toolPart?.input?.preview_id === "string"
        ? toolPart.input.preview_id
        : undefined;
    if (previewId && consumedPreviewIds.has(previewId)) {
      continue;
    }
    expandedParts.push(toolPart);
  }

  const timelineItems: Array<
    | { kind: "text"; key: string; text: string }
    | { kind: "tools"; key: string; toolParts: any[] }
  > = [];

  let pendingToolParts: any[] = [];
  const flushPendingToolParts = () => {
    if (pendingToolParts.length === 0) {
      return;
    }

    timelineItems.push({
      kind: "tools",
      key: `tools-${timelineItems.length}`,
      toolParts: pendingToolParts,
    });
    pendingToolParts = [];
  };

  for (const part of expandedParts) {
    const isToolPart =
      typeof part?.type === "string" && part.type.startsWith("tool-");

    if (isToolPart) {
      pendingToolParts.push(part);
      continue;
    }

    flushPendingToolParts();

    if (part?.type === "text") {
      timelineItems.push({
        kind: "text",
        key: `text-${timelineItems.length}`,
        text: part.text,
      });
    }
  }
  flushPendingToolParts();

  function isWithinPreviewWindow(output: Record<string, any>) {
    const now = Date.now();

    if (typeof output?.preview_expires_at === "string") {
      const expiresTs = new Date(output.preview_expires_at).getTime();
      if (!Number.isNaN(expiresTs)) {
        return now <= expiresTs;
      }
    }

    if (typeof output?.preview_created_at === "string") {
      const createdTs = new Date(output.preview_created_at).getTime();
      if (!Number.isNaN(createdTs)) {
        return now - createdTs <= 10 * 60 * 1000;
      }
    }

    return false;
  }

  function renderSpecialDisplay(toolPart: any, key: string) {
    if (toolPart?.type === "tool-execute_preview_write_sql") {
      const output = (toolPart?.output ?? {}) as Record<string, any>;
      const previewId =
        typeof output.preview_id === "string" ? output.preview_id : undefined;
      const canConfirmByWindow = isWithinPreviewWindow(output);

      return (
        <WriteSqlPreviewCard
          key={key}
          toolPart={toolPart}
          onConfirm={onConfirmWritePreview}
          isBusy={status === "streaming" || status === "submitted"}
          commitState={previewId ? writeCommitState?.[previewId] : undefined}
          canConfirmByWindow={canConfirmByWindow}
        />
      );
    }

    if (toolPart?.type === "tool-execute_write_sql") {
      return <WriteSqlCommitCard key={key} toolPart={toolPart} />;
    }

    if (toolPart?.type === "tool-present_data") {
      return <PresentDataCard key={key} toolPart={toolPart} />;
    }

    if (toolPart?.type === "tool-read_sql" && toolPart?.input?.present) {
      return <PresentDataCard key={key} toolPart={toolPart} />;
    }

    return null;
  }

  return (
    <Message
      className={cn(
        "gap-1",
        isAssistant
          ? "justify-start flex-col group"
          : "justify-end flex-col group",
      )}
    >
      <div
        className={cn(
          "break-words min-w-0",
          isAssistant
            ? "max-w-full"
            : "max-w-[80%] sm:max-w-[50%] ml-auto w-fit min-w-[40px]",
        )}
      >
        {timelineItems.map((item, itemIndex) => {
          if (item.kind === "text") {
            return (
              <TextPart
                key={item.key}
                text={item.text}
                isAssistant={isAssistant}
                isStreaming={status === "streaming"}
              />
            );
          }

          if (devMode) {
            return (
              <div key={item.key} className="space-y-3">
                {item.toolParts.map((toolPart: any, toolIndex: number) => {
                  const specialDisplay = renderSpecialDisplay(
                    toolPart,
                    `dev-special-${itemIndex}-${toolIndex}`
                  );

                  return (
                    <div
                      key={`dev-tool-${itemIndex}-${toolIndex}-${toolPart?.toolCallId ?? toolPart?.type ?? "unknown"}`}
                      className="space-y-3"
                    >
                      <Tool toolPart={toolPart} />
                      {specialDisplay}
                    </div>
                  );
                })}
              </div>
            );
          }

          return (
            <div key={item.key} className="space-y-3">
              <ToolExecutionSummary toolParts={item.toolParts} />
              {item.toolParts.map((toolPart: any, toolIndex: number) =>
                renderSpecialDisplay(
                  toolPart,
                  `prod-special-${itemIndex}-${toolIndex}`
                )
              )}
            </div>
          );
        })}
      </div>

      <MessageActions
        className={cn(
          "opacity-0",
          isAssistant
            ? "opacity-100 self-start"
            : "self-end group-hover:opacity-100 transition",
        )}
      >
        <MessageAction tooltip="Copy to clipboard">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => onCopyMessage(message)}
          >
            {isCopied ? (
              <CheckCheck className="text-green-500 size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </MessageAction>
        {isAssistant && (
          <MessageAction tooltip={isSpeaking ? "Stop reading" : "Read aloud"}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => onReadAloud(message)}
            >
              {isSpeaking ? (
                <VolumeOff className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </Button>
          </MessageAction>
        )}
        {isAssistant && isLastAssistant && (
          <MessageAction tooltip="Regenerate response">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => onRegenerate(message.id)}
              disabled={status === "streaming" || status === "submitted"}
            >
              <RefreshCcw className="size-4" />
            </Button>
          </MessageAction>
        )}
      </MessageActions>
    </Message>
  );
}, areChatMessagePropsEqual);