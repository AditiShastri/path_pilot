"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { MODEL_GROUPS } from "./models";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export function ModelCombobox({ value, onChange }: Props) {
  const [open, setOpen] = React.useState(false);

  // Find current label
  const currentLabel = React.useMemo(() => {
    for (const group of Object.values(MODEL_GROUPS)) {
      const found = group.models.find((m) => m.value === value);
      if (found) return found.label;
    }
    return "Select model...";
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-[150px] justify-between"
        >
          {currentLabel}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[260px] p-0">
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>

            {Object.entries(MODEL_GROUPS).map(([provider, group]) => (
              <CommandGroup key={provider} heading={group.label}>
                {group.models.map((m) => (
                  <CommandItem
                    key={m.value}
                    value={`${group.label} ${m.label}`}
                    onSelect={() => {
                      onChange(m.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === m.value
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {m.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
