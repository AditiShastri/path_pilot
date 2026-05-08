"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useUserInfo } from "@/hooks/useUserInfo";

export type LocationSource = "home" | "current" | "manual";

export type LatLng = {
  lat: number;
  lng: number;
  label?: string;
};

type CurrentStatus = "idle" | "loading" | "error";

type LocationContextValue = {
  source: LocationSource;
  setSource: (source: LocationSource) => void;

  home: LatLng | null;
  manual: LatLng | null;
  current: LatLng | null;
  currentStatus: CurrentStatus;

  refreshHome: () => Promise<void>;
  saveHome: (coords: LatLng) => Promise<boolean>;

  setManual: (coords: LatLng | null) => void;
  requestCurrent: () => Promise<LatLng | null>;

  effective: LatLng | null;
};

const STORAGE_KEY_SOURCE = "path-pilot.location.source";
const STORAGE_KEY_MANUAL = "path-pilot.location.manual";

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

function safeParseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeLatLng(input: any): LatLng | null {
  const lat = input?.lat;
  const lng = input?.lng;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const label = typeof input?.label === "string" ? input.label : undefined;
  return { lat, lng, label };
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUserInfo();
  const [source, setSourceState] = useState<LocationSource>("home");

  const [home, setHome] = useState<LatLng | null>(null);
  const [manual, setManualState] = useState<LatLng | null>(null);
  const [current, setCurrent] = useState<LatLng | null>(null);
  const [currentStatus, setCurrentStatus] = useState<CurrentStatus>("idle");

  useEffect(() => {
    const storedSource = localStorage.getItem(STORAGE_KEY_SOURCE);
    if (storedSource === "home" || storedSource === "current" || storedSource === "manual") {
      setSourceState(storedSource);
    }

    const storedManual = normalizeLatLng(safeParseJson(localStorage.getItem(STORAGE_KEY_MANUAL)));
    if (storedManual) setManualState(storedManual);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SOURCE, source);
  }, [source]);

  const refreshHome = useCallback(async () => {
    if (!user?.auth_id) {
      setHome(null);
      return;
    }

    try {
      const res = await fetch("/api/user/home-location", { credentials: "include" });
      if (!res.ok) {
        setHome(null);
        return;
      }
      const data = (await res.json()) as { home?: { lat: number; lng: number } | null };
      const normalized = normalizeLatLng(data?.home);
      setHome(normalized);
    } catch {
      setHome(null);
    }
  }, [user?.auth_id]);

  useEffect(() => {
    refreshHome();
  }, [refreshHome]);

  const saveHome = useCallback(async (coords: LatLng) => {
    if (!user?.auth_id) {
      toast.error("You must be logged in to save a home location.");
      return false;
    }

    const normalized = normalizeLatLng(coords);
    if (!normalized) {
      toast.error("Invalid coordinates.");
      return false;
    }

    const res = await fetch("/api/user/home-location", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: normalized.lat, lng: normalized.lng }),
    });

    if (!res.ok) {
      toast.error("Failed to save home location.");
      return false;
    }

    setHome({ lat: normalized.lat, lng: normalized.lng });
    toast.success("Home location saved.");
    return true;
  }, [user?.auth_id]);

  const setManual = useCallback((coords: LatLng | null) => {
    if (!coords) {
      setManualState(null);
      localStorage.removeItem(STORAGE_KEY_MANUAL);
      return;
    }

    const normalized = normalizeLatLng(coords);
    if (!normalized) {
      toast.error("Invalid coordinates.");
      return;
    }

    setManualState(normalized);
    localStorage.setItem(STORAGE_KEY_MANUAL, JSON.stringify(normalized));
  }, []);

  const requestCurrent = useCallback(async (): Promise<LatLng | null> => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported in this browser.");
      setCurrentStatus("error");
      return null;
    }

    setCurrentStatus("loading");
    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrent(coords);
          setCurrentStatus("idle");
          resolve(coords);
        },
        () => {
          setCurrentStatus("error");
          toast.error("Could not get current location.");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  const setSource = useCallback((next: LocationSource) => {
    setSourceState(next);
  }, []);

  const effective = useMemo(() => {
    if (source === "home") return home;
    if (source === "manual") return manual;
    if (source === "current") return current;
    return null;
  }, [source, home, manual, current]);

  const value: LocationContextValue = {
    source,
    setSource,
    home,
    manual,
    current,
    currentStatus,
    refreshHome,
    saveHome,
    setManual,
    requestCurrent,
    effective,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocationContext must be used within a LocationProvider");
  return ctx;
}
