"use client";

import { memo, useEffect, useMemo, useState } from "react";
import type { UIMessage } from "ai";
import { RefreshCw } from "lucide-react";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import { ScrollButton } from "@/components/ui/scroll-button";
import { SystemMessage } from "@/components/ui/system-message";
import { ChatMessage } from "./chatMessage";
import { WriteCommitStateMap } from "./writeSqlCards";

type ChatTimelineProps = {
  chatId: string;
  messages: UIMessage[];
  status: string;
  isLoadingHistory: boolean;
  copiedId: string | null;
  devMode: boolean;
  error: Error | null | undefined;
  speakingId: string | null;
  writeCommitState: WriteCommitStateMap;
  onCopyMessage: (message: any) => void | Promise<void>;
  onRegenerate: (messageId: string) => void;
  onReadAloud: (message: any) => void;
  onConfirmWritePreview: (previewId: string) => Promise<void>;
  setMessages: (messages: UIMessage[]) => void;
  send: (message?: string) => void | Promise<void>;
};

function getMessageText(message: any): string {
  if (!message?.parts) return "";

  return message.parts
    .filter((part: any) => part.type === "text")
    .map((part: any) => part.text)
    .join("");
}

function isStreamingStatus(status: string) {
  return status === "streaming" || status === "submitted";
}

function areMessageListsEqual(a: UIMessage[], b: UIMessage[]) {
  if (a.length !== b.length) return false;

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }

  return true;
}

const StableMessageList = memo(
  function StableMessageList({
    messages,
    hasActiveMessage,
    copiedId,
    devMode,
    speakingId,
    writeCommitState,
    onCopyMessage,
    onRegenerate,
    onReadAloud,
    onConfirmWritePreview,
  }: Pick<
    ChatTimelineProps,
    | "copiedId"
    | "devMode"
    | "speakingId"
    | "writeCommitState"
    | "onCopyMessage"
    | "onRegenerate"
    | "onReadAloud"
    | "onConfirmWritePreview"
  > & {
    messages: UIMessage[];
    hasActiveMessage: boolean;
  }) {
    const lastAssistantId = useMemo(() => {
      if (hasActiveMessage) return null;

      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index]?.role === "assistant") {
          return messages[index].id;
        }
      }

      return null;
    }, [hasActiveMessage, messages]);

    return (
      <>
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            status="ready"
            isCopied={copiedId === message.id}
            onCopyMessage={onCopyMessage}
            onRegenerate={onRegenerate}
            isLastAssistant={message.id === lastAssistantId}
            isSpeaking={speakingId === message.id}
            onReadAloud={onReadAloud}
            devMode={devMode}
            onConfirmWritePreview={onConfirmWritePreview}
            writeCommitState={writeCommitState}
          />
        ))}
      </>
    );
  },
  (prev, next) =>
    prev.messages === next.messages &&
    prev.hasActiveMessage === next.hasActiveMessage &&
    prev.copiedId === next.copiedId &&
    prev.devMode === next.devMode &&
    prev.speakingId === next.speakingId &&
    prev.writeCommitState === next.writeCommitState &&
    prev.onCopyMessage === next.onCopyMessage &&
    prev.onRegenerate === next.onRegenerate &&
    prev.onReadAloud === next.onReadAloud &&
    prev.onConfirmWritePreview === next.onConfirmWritePreview,
);

const ActiveMessageRow = memo(function ActiveMessageRow({
  message,
  status,
  copiedId,
  devMode,
  speakingId,
  writeCommitState,
  onCopyMessage,
  onRegenerate,
  onReadAloud,
  onConfirmWritePreview,
}: {
  message: UIMessage | null;
  status: string;
  copiedId: string | null;
  devMode: boolean;
  speakingId: string | null;
  writeCommitState: WriteCommitStateMap;
  onCopyMessage: (message: any) => void | Promise<void>;
  onRegenerate: (messageId: string) => void;
  onReadAloud: (message: any) => void;
  onConfirmWritePreview: (previewId: string) => Promise<void>;
}) {
  if (!message) return null;

  return (
    <ChatMessage
      message={message}
      status={status}
      isCopied={copiedId === message.id}
      onCopyMessage={onCopyMessage}
      onRegenerate={onRegenerate}
      isLastAssistant={message.role === "assistant"}
      isSpeaking={speakingId === message.id}
      onReadAloud={onReadAloud}
      devMode={devMode}
      onConfirmWritePreview={onConfirmWritePreview}
      writeCommitState={writeCommitState}
    />
  );
});

export function ChatTimeline({
  chatId,
  messages,
  status,
  isLoadingHistory,
  copiedId,
  devMode,
  error,
  speakingId,
  writeCommitState,
  onCopyMessage,
  onRegenerate,
  onReadAloud,
  onConfirmWritePreview,
  setMessages,
  send,
}: ChatTimelineProps) {
  const [stableMessages, setStableMessages] = useState<UIMessage[]>([]);
  const [activeMessage, setActiveMessage] = useState<UIMessage | null>(null);

  useEffect(() => {
    const streaming = isStreamingStatus(status);
    const nextActiveMessage = streaming && messages.length > 0 ? messages[messages.length - 1] : null;
    const nextStableMessages = nextActiveMessage ? messages.slice(0, -1) : messages;

    setStableMessages((current) =>
      areMessageListsEqual(current, nextStableMessages) ? current : nextStableMessages,
    );
    setActiveMessage((current) =>
      current === nextActiveMessage ? current : nextActiveMessage,
    );
  }, [messages, status]);

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <ChatContainerRoot className="relative h-full w-full items-center" key={chatId}>
        <ChatContainerContent className="px-1 py-2 space-y-2 mt-10">
          {isLoadingHistory ? (
            <div className="flex flex-col gap-8 p-8 w-full">
              <div className="flex justify-end w-full">
                <div
                  className="bg-muted rounded-3xl animate-pulse"
                  style={{
                    height: "10vh",
                    width: "55%",
                    minHeight: "120px",
                  }}
                />
              </div>

              <div className="flex justify-start w-full">
                <div
                  className="bg-muted rounded-3xl animate-pulse"
                  style={{
                    height: "30vh",
                    width: "75%",
                    minHeight: "120px",
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              <StableMessageList
                messages={stableMessages}
                hasActiveMessage={activeMessage !== null}
                copiedId={copiedId}
                devMode={devMode}
                speakingId={speakingId}
                writeCommitState={writeCommitState}
                onCopyMessage={onCopyMessage}
                onRegenerate={onRegenerate}
                onReadAloud={onReadAloud}
                onConfirmWritePreview={onConfirmWritePreview}
              />
              <ActiveMessageRow
                message={activeMessage}
                status={status}
                copiedId={copiedId}
                devMode={devMode}
                speakingId={speakingId}
                writeCommitState={writeCommitState}
                onCopyMessage={onCopyMessage}
                onRegenerate={onRegenerate}
                onReadAloud={onReadAloud}
                onConfirmWritePreview={onConfirmWritePreview}
              />
            </>
          )}

          {error && (
            <SystemMessage
              variant="error"
              isIconHidden={false}
              className="relative max-w-[90%] w-auto self-start break-all"
              cta={{
                label: <RefreshCw className="w-4 h-4 text-foreground" />,
                variant: "ghost",
                onClick: () => {
                  if (status === "error") {
                    const lastUser = [...messages].reverse().find((message) => message.role === "user");
                    setMessages(messages.slice(0, messages.length - 1));
                    send(lastUser ? getMessageText(lastUser) : "");
                  }
                },
              }}
            >
              {typeof error.message === "string"
                ? error.message
                : "An error occurred. Please try again."}
            </SystemMessage>
          )}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>

        <div className="absolute bottom-6 right-6 z-10">
          <ScrollButton />
        </div>
      </ChatContainerRoot>
    </div>
  );
}