"use client";

import * as React from "react";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type SearchResult = {
  label: string;
  lat: number;
  lng: number;
};

export function LocationSearch({
  placeholder = "Search an address or place…",
  onPick,
}: {
  placeholder?: string;
  onPick: (value: { lat: number; lng: number }) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}` , {
          signal: controller.signal,
          credentials: "include",
        });
        if (!res.ok) {
          setResults([]);
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { results?: SearchResult[] };
        setResults(Array.isArray(data?.results) ? data.results : []);
        setLoading(false);
      } catch {
        setResults([]);
        setLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [query]);

  return (
    <Command className="rounded-md border">
      <CommandInput
        placeholder={placeholder}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[220px]">
        <CommandEmpty>
          {loading ? "Searching…" : "No results"}
        </CommandEmpty>
        {results.map((r) => (
          <CommandItem
            key={`${r.lat}:${r.lng}:${r.label}`}
            value={r.label}
            onSelect={() => {
              onPick({ lat: r.lat, lng: r.lng });
              setQuery(r.label);
            }}
          >
            <div className="flex flex-col">
              <div className="text-sm leading-snug break-words">{r.label}</div>
              <div className="text-xs text-muted-foreground">
                {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
              </div>
            </div>
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
}
