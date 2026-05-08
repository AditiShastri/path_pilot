"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type CalendarStatus = {
  connected: boolean;
  expiryDate?: string | null;
};

export function GoogleCalendarConnect() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [open, setOpen] = useState(true);

  async function loadStatus() {
    const response = await fetch("/api/calendar/status");
    if (!response.ok) {
      throw new Error("Could not load Google Calendar status");
    }

    setStatus(await response.json());
  }

  useEffect(() => {
    loadStatus().catch((error) => {
      console.error(error);
      setStatus({ connected: false });
    });
  }, []);

  if (!open) return null;

  return (
    <div className="rounded-xl border border-border bg-background p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">Google Calendar</div>
          <div className="text-muted-foreground">
            Connect calendar events for commute reminders.
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen(false)}
          aria-label="Close calendar connect"
        >
          x
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          disabled={isBusy}
          onClick={() => {
            window.location.href = "/api/calendar/connect";
          }}
        >
          {status?.connected ? "Reconnect calendar" : "Connect calendar"}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={isBusy}
          onClick={async () => {
            try {
              setIsBusy(true);
              await loadStatus();
              toast.success("Google Calendar status refreshed.");
            } catch (error: any) {
              toast.error(error?.message ?? "Could not refresh calendar status.");
            } finally {
              setIsBusy(false);
            }
          }}
        >
          Refresh
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={isBusy || !status?.connected}
          onClick={async () => {
            try {
              setIsBusy(true);
              const response = await fetch("/api/calendar/status", {
                method: "DELETE",
              });

              if (!response.ok) {
                throw new Error(await response.text());
              }

              setStatus(await response.json());
              toast.success("Google Calendar disconnected.");
            } catch (error: any) {
              toast.error(error?.message ?? "Could not disconnect calendar.");
            } finally {
              setIsBusy(false);
            }
          }}
        >
          Disconnect
        </Button>
      </div>

      <div className="mt-3 text-muted-foreground">
        {!status ? (
          <>Loading calendar status...</>
        ) : status.connected ? (
          <>
            Connected
            {status.expiryDate ? (
              <>. Access token expires {new Date(status.expiryDate).toLocaleString()}.</>
            ) : null}
          </>
        ) : (
          <>Not connected yet.</>
        )}
      </div>
    </div>
  );
}
