"use client";

import { Button } from "@/components/ui/button";

export function CalendarConnectCard({ connectUrl }: { connectUrl: string }) {
  return (
    <div className="mt-3 rounded-xl bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Connect Google Calendar</p>
        <p className="text-sm text-muted-foreground">
          To use commute assistance based on your next events, connect Calendar permissions.
        </p>
      </div>
      <div>
        <Button asChild>
          <a href={connectUrl}>Connect Calendar</a>
        </Button>
      </div>
    </div>
  );
}
