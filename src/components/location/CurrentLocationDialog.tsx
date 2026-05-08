"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocationContext } from "@/hooks/useLocationContext";

export function CurrentLocationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { current, currentStatus, requestCurrent } = useLocationContext();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Use current location</DialogTitle>
          <DialogDescription>
            We’ll ask your browser for your location and use it as the origin for travel planning.
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground">
          {current ? (
            <div>
              Current: {current.lat.toFixed(6)}, {current.lng.toFixed(6)}
            </div>
          ) : (
            <div>No current location captured yet.</div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={async () => {
              await requestCurrent();
            }}
            disabled={currentStatus === "loading"}
          >
            {currentStatus === "loading" ? "Getting location…" : "Get current location"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
