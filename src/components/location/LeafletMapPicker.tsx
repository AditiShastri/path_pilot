"use client";

import * as React from "react";
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

export type MapPickerValue = { lat: number; lng: number };

function ClickToSetMarker({ onPick }: { onPick: (value: MapPickerValue) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function Recenter({ center }: { center: LatLngExpression }) {
  const map = useMapEvents({});

  React.useEffect(() => {
    map.setView(center);
  }, [center, map]);

  return null;
}

export function LeafletMapPicker({
  value,
  onChange,
  current,
  height = 280,
}: {
  value: MapPickerValue;
  onChange: (value: MapPickerValue) => void;
  current?: MapPickerValue | null;
  height?: number;
}) {
  const center = React.useMemo<LatLngExpression>(() => [value.lat, value.lng], [value.lat, value.lng]);

  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-md border">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={center} />
        <ClickToSetMarker onPick={onChange} />
        {current ? (
          <CircleMarker
            center={[current.lat, current.lng]}
            radius={8}
            pathOptions={{
              color: "var(--sidebar-primary)",
              fillColor: "var(--sidebar-primary)",
              fillOpacity: 0.2,
              weight: 2,
            }}
          />
        ) : null}
        <CircleMarker
          center={center}
          radius={10}
          pathOptions={{
            color: "var(--destructive)",
            fillColor: "var(--destructive)",
            fillOpacity: 0.35,
            weight: 2,
          }}
        />
      </MapContainer>
    </div>
  );
}
