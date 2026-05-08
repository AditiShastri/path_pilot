"use client";

import { useState } from "react";
import { useKeyVault } from "./useKeyVault";
import { Provider } from "./models";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key } from "lucide-react";

const PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "groq",
  "openrouter",
] as const;



export function KeyManagerDialog() {
  const { keys, setKey, removeKey } = useKeyVault();

  // draft ONLY for newly typed values
  const [draft, setDraft] = useState<Partial<Record<Provider, string>>>({});
  const [open, setOpen] = useState(false);
  function handleSave() {
    PROVIDERS.forEach((p) => {
      const value = draft[p]?.trim();

      if (value) setKey(p, value);
      if (value === "") removeKey(p);
    });

    setDraft({});
  }

  function handleRemove(p: Provider) {
    removeKey(p);
    setDraft((d) => ({ ...d, [p]: "" }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Key />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API Keys</DialogTitle>
          <DialogDescription>
            Manage your API keys for different AI providers. Keys are stored securely in your browser.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          {PROVIDERS.map((p) => (
            <Field key={p}>
              <Label className="capitalize">{p}</Label>

              <div className="flex gap-2">
                <Input
                  type="text"
                  value={draft[p] ?? ""}
                  placeholder={
                    keys[p]
                      ? keys[p]
                      : `Enter ${p} API key`
                  }
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [p]: e.target.value }))
                  }
                />

                {keys[p] && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleRemove(p)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </Field>
          ))}
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => {
              setDraft({});
              setOpen(false);
            }
          }>
            Cancel
          </Button>

          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
