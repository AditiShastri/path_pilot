"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type TelegramLinkStatus = {
  connected: boolean;
  chatId?: string | null;
  link?: string | null;
};

export function TelegramConnect() {
  const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const refreshFromLocalStorage = () => {
      const localChatId = localStorage.getItem("telegramChatId");
      if (localChatId) {
        setStatus({ connected: true, chatId: localChatId, link: null });
      } else {
        setStatus({ connected: false, chatId: null, link: null });
      }
    };

    refreshFromLocalStorage();
    window.addEventListener("storage", refreshFromLocalStorage);
    return () => window.removeEventListener("storage", refreshFromLocalStorage);
  }, []);

  if (!open) return null;

  if (!status) {
    return (
      <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
        Loading Telegram connection...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">Telegram</div>
          <div className="text-muted-foreground">
            Set your chat id so the chatbot can send messages.
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen(false)}
          aria-label="Close telegram connect"
        >
          ×
        </Button>
      </div>

      <div className="flex flex-col gap-4 mt-3">
        <div className="flex flex-col gap-3">
          <div className="text-muted-foreground text-xs">
            Stored locally in your browser:{" "}
            <span className="font-mono">localStorage.telegramChatId</span>
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <input
              className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g. 123456789"
              value={status.chatId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setStatus((prev) =>
                  prev
                    ? { ...prev, chatId: v, connected: Boolean(v) }
                    : { connected: Boolean(v), chatId: v }
                );
              }}
              inputMode="numeric"
            />

            <Button
              onClick={() => {
                const v = status.chatId;
                if (!v) {
                  toast.error("Enter a Telegram chat id first.");
                  return;
                }
                localStorage.setItem("telegramChatId", String(v));
                toast.success("Telegram chat id saved locally.");
                setStatus((prev) =>
                  prev
                    ? { ...prev, connected: true, chatId: String(v) }
                    : { connected: true, chatId: String(v) }
                );
              }}
            >
              Save chat id
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const v = localStorage.getItem("telegramChatId");
                setStatus({ connected: Boolean(v), chatId: v ?? null, link: null });
              }}
            >
              Refresh from localStorage
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                localStorage.removeItem("telegramChatId");
                setStatus({ connected: false, chatId: null, link: null });
                toast.success("Removed telegramChatId from localStorage.");
              }}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="font-medium">Connection method</div>
          <div className="text-muted-foreground text-xs mb-2">
            For now the app uses <span className="font-mono">localStorage.telegramChatId</span> (no DB).
          </div>

          <div className="text-muted-foreground">
            {status.connected ? (
              <>Using chat id: {status.chatId}</>
            ) : (
              <>Not connected yet. Paste your Telegram chat id above and click Save chat id.</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

