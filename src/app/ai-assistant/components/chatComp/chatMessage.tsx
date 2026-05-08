import { memo, useDeferredValue } from "react";
import { Tool } from "@/components/ui/tool";
import { Message,MessageAction, MessageActions, MessageContent } from "@/components/ui/message";
import { ToolExecutionSummary } from "./toolExecutionSummary";
import { cn } from "@/lib/utils";
import { PresentDataCard } from "./presentDataCard";
import { CalendarConnectCard } from "./calendarConnectCard";
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
function areChatMessagePropsEqual(prev: ChatMessageProps, next: ChatMessageProps) {
  if (prev.message?.id !== next.message?.id) return false;
  if (prev.message !== next.message) return false;
  if (prev.status !== next.status) return false;
  if (prev.isCopied !== next.isCopied) return false;
  if (prev.isLastAssistant !== next.isLastAssistant) return false;
  if (prev.isSpeaking !== next.isSpeaking) return false;
  if (prev.devMode !== next.devMode) return false;

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
}: ChatMessageProps) {
  const isAssistant = message.role === "assistant";
  const messageParts = Array.isArray(message?.parts) ? message.parts : [];
  const expandedParts: any[] = messageParts;

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

  function renderSpecialDisplay(toolPart: any, key: string) {
    if (toolPart?.type === "tool-present_data") {
      return <PresentDataCard key={key} toolPart={toolPart} />;
    }

    const toolType = typeof toolPart?.type === "string" ? toolPart.type : "";
    const output = (toolPart?.output ?? {}) as Record<string, any>;
    const connectUrl = typeof output.connectUrl === "string" ? output.connectUrl : null;
    const connected = typeof output.connected === "boolean" ? output.connected : null;

    if (
      (
        toolType === "tool-upcoming_events" ||
        toolType === "tool-commute_advice_next_event" ||
        toolType === "tool-create_calendar_event"
      ) &&
      connected === false &&
      connectUrl
    ) {
      return <CalendarConnectCard key={key} connectUrl={connectUrl} />;
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