"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type TelegramLinkStatus = {
  connected: boolean;
  chatId?: string | null;
  username?: string | null;
  link?: string | null;
};

export function TelegramConnect() {
  const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
  const [chatId, setChatId] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [open, setOpen] = useState(true);

  async function loadStatus() {
    const response = await fetch("/api/telegram/link");
    if (!response.ok) {
      throw new Error("Could not load Telegram connection");
    }

    const nextStatus = await response.json();
    setStatus(nextStatus);
    setChatId(nextStatus.chatId ?? "");
  }

  useEffect(() => {
    loadStatus().catch((error) => {
      console.error(error);
      setStatus({ connected: false, chatId: null, link: null });
    });
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
            Connect your chat so Pixie can send reminders.
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
            Stored in Supabase:{" "}
            <span className="font-mono">path_pilot_users.telegram_chat_id</span>
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <input
              className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g. 123456789"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              inputMode="numeric"
            />

            <Button
              disabled={isBusy}
              onClick={async () => {
                const v = chatId.trim();
                if (!v) {
                  toast.error("Enter a Telegram chat id first.");
                  return;
                }

                try {
                  setIsBusy(true);
                  const response = await fetch("/api/telegram/link", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chatId: v }),
                  });

                  if (!response.ok) {
                    throw new Error(await response.text());
                  }

                  const nextStatus = await response.json();
                  setStatus(nextStatus);
                  setChatId(nextStatus.chatId ?? v);
                  toast.success("Telegram chat id saved to Supabase.");
                } catch (error: any) {
                  toast.error(error?.message ?? "Could not save Telegram chat id.");
                } finally {
                  setIsBusy(false);
                }
              }}
            >
              Save chat id
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              disabled={isBusy}
              onClick={async () => {
                try {
                  setIsBusy(true);
                  await loadStatus();
                  toast.success("Telegram status refreshed.");
                } catch (error: any) {
                  toast.error(error?.message ?? "Could not refresh Telegram status.");
                } finally {
                  setIsBusy(false);
                }
              }}
            >
              Refresh from Supabase
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={async () => {
                try {
                  setIsBusy(true);
                  const response = await fetch("/api/telegram/link", {
                    method: "DELETE",
                  });

                  if (!response.ok) {
                    throw new Error(await response.text());
                  }

                  const nextStatus = await response.json();
                  setStatus(nextStatus);
                  setChatId("");
                  toast.success("Telegram disconnected in Supabase.");
                } catch (error: any) {
                  toast.error(error?.message ?? "Could not clear Telegram chat id.");
                } finally {
                  setIsBusy(false);
                }
              }}
            >
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={async () => {
                try {
                  setIsBusy(true);
                  const response = await fetch("/api/telegram/link", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                  });

                  if (!response.ok) {
                    throw new Error(await response.text());
                  }

                  const result = await response.json();
                  setStatus((prev) => ({ ...(prev ?? { connected: false }), link: result.deepLink }));
                  await navigator.clipboard.writeText(result.deepLink);
                  toast.success("Telegram connect link copied.");
                } catch (error: any) {
                  toast.error(error?.message ?? "Could not generate Telegram link.");
                } finally {
                  setIsBusy(false);
                }
              }}
            >
              Copy bot link
            </Button>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="font-medium">Connection method</div>
          <div className="text-muted-foreground text-xs mb-2">
            Pixie now reads Telegram chat ids from Supabase for reminders and test sends.
          </div>

          <div className="text-muted-foreground">
            {status.connected ? (
              <>
                Using chat id: {status.chatId}
                {status.username ? <> (@{status.username})</> : null}
              </>
            ) : (
              <>Not connected yet. Paste your chat id or copy the bot link and send /start in Telegram.</>
            )}
          </div>
          {status.link ? (
            <a
              className="mt-2 block text-primary underline underline-offset-4"
              href={status.link}
              target="_blank"
              rel="noreferrer"
            >
              Open Telegram connect link
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

