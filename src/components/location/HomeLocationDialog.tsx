"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocationContext } from "@/hooks/useLocationContext";
import { LocationSearch } from "@/components/location/LocationSearch";

const LeafletMapPicker = dynamic(
  () => import("@/components/location/LeafletMapPicker").then((m) => m.LeafletMapPicker),
  { ssr: false }
);

function round(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

export function HomeLocationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { home, saveHome, requestCurrent, current } = useLocationContext();

  const [draft, setDraft] = React.useState<{ lat: number; lng: number }>(() => {
    return home ?? { lat: 37.7749, lng: -122.4194 };
  });

  React.useEffect(() => {
    if (open) {
      setDraft(home ?? { lat: 37.7749, lng: -122.4194 });
    }
  }, [open, home]);

  const onSave = async () => {
    const ok = await saveHome({ lat: draft.lat, lng: draft.lng });
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Set home location</DialogTitle>
          <DialogDescription>
            Click on the map to choose your home. This is used as your default origin for commute/travel planning.
          </DialogDescription>
        </DialogHeader>

        <LocationSearch
          onPick={(coords) => {
            setDraft(coords);
          }}
        />

        <LeafletMapPicker value={draft} onChange={setDraft} current={current} height={320} />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Latitude</div>
            <Input
              inputMode="decimal"
              value={String(draft.lat)}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                setDraft((d) => ({ ...d, lat: next }));
              }}
              onBlur={() => setDraft((d) => ({ lat: round(d.lat), lng: round(d.lng) }))}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Longitude</div>
            <Input
              inputMode="decimal"
              value={String(draft.lng)}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                setDraft((d) => ({ ...d, lng: next }));
              }}
              onBlur={() => setDraft((d) => ({ lat: round(d.lat), lng: round(d.lng) }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const coords = await requestCurrent();
              if (!coords) {
                toast.error("Could not get your current location.");
                return;
              }
              setDraft(coords);
            }}
          >
            Use current location
          </Button>
          <Button type="button" onClick={onSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
