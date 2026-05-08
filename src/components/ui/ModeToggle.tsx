"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Cloud, Server, Key } from "lucide-react";
import { cn } from "@/lib/utils";

export type AIMode = "gateway" | "server-key" | "user-key";

const modes: { value: AIMode; icon: any; label: string }[] = [
  { value: "gateway", icon: Cloud, label: "Vercel Gateway" },
  { value: "server-key", icon: Server, label: "Server Keys" },
  { value: "user-key", icon: Key, label: "User Keys" },
];

export function ModeToggle({
  value,
  onChange,
}: {
  value: AIMode;
  onChange: (v: AIMode) => void;
}) {
  const activeIndex = modes.findIndex((m) => m.value === value);

  return (
    <div className="flex flex-col items-center gap-2 w-[150px]">
      <TooltipProvider>
        <div className="relative flex items-center bg-muted rounded-xl p-1 w-full h-10">
          {/* Sliding indicator */}
          <div
            className="absolute top-1 left-1 h-8 w-[calc(33.333%-2px)] rounded-lg bg-background shadow-sm border transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />

          {modes.map(({ value: v, icon: Icon, label }) => (
            <Tooltip key={v}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onChange(v)}
                  className={cn(
                    "relative z-10 flex items-center justify-center flex-1 h-5 rounded-lg transition-colors",
                    value === v
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
