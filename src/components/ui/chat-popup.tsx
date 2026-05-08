"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2, X, PanelRightClose } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

type ChatPopupProps = {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
  title?: string;
};

export function ChatPopup({
  isOpen,
  onToggle,
  onClose,
  children,
  title = "Chat",
}: ChatPopupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");

    const updateIsMobile = () => setIsMobile(mediaQuery.matches);
    updateIsMobile();

    mediaQuery.addEventListener("change", updateIsMobile);
    return () => mediaQuery.removeEventListener("change", updateIsMobile);
  }, []);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {!isOpen && (
          <>
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                "group pointer-events-auto absolute right-0 top-1/2 z-50 hidden h-32 w-12 -translate-y-1/2 flex-col items-center justify-center gap-2 overflow-hidden rounded-l-2xl border border-r-0 border-border bg-background/95 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:w-14 hover:bg-accent/80 sm:flex"
              )}
              aria-label={`Open ${title}`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full text-primary shadow-sm transition-transform duration-300 group-hover:scale-105">
                <ChevronLeft className="size-4 text-bold" />
              </div>
              <span className="whitespace-nowrap text-[10px] font-medium tracking-[0.24em] text-muted-foreground [writing-mode:vertical-rl]">
                {title}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggle}
              className="pointer-events-auto fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl transition-transform duration-300 hover:scale-[1.02] sm:hidden"
              aria-label={`Open ${title}`}
            >
              <ChevronUp className="size-4 text-primary" />
              <span>{title}</span>
            </button>
          </>
      )}

      {isOpen && isMobile ? (
        <div className="pointer-events-auto fixed inset-0 z-[60] flex h-[100dvh] w-screen flex-col overflow-y-auto overscroll-contain bg-background/95 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out">
          <div className="shrink-0 flex items-center justify-between border-b border-border bg-gradient-to-r from-accent/80 via-background/90 to-background px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.45)]" />
              <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
                title="Close"
              >
                <ChevronDown className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      ) : null}

      {isOpen && !isMobile ? (
        <div
        className={cn(
          "pointer-events-auto absolute right-0 top-0 z-[60] flex h-[100dvh] flex-col overflow-y-auto overscroll-contain border-l border-border bg-background/95 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out",
          isOpen
            ? isExpanded
              ? "left-0 w-full rounded-none"
              : "w-full sm:w-[24rem] lg:w-[24rem] xl:w-[28rem]"
            : "translate-x-full w-full sm:w-[24rem] lg:w-[28rem] xl:w-[32rem] rounded-none sm:rounded-l-2xl"
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-border bg-background px-4 py-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold tracking-widest">{title}</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              className="w-auto gap-2"
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? "Restore sidebar" : "Fullscreen"}
            >
              {isExpanded ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-auto gap-2"
              onClick={onClose}
              title="Collapse"
            >
              <PanelRightClose className="size-5" />
            </Button>
          </div>
        </div>

        {/* Content - Flex Container */}
        <div className={cn("flex-1 min-h-0 flex flex-col", !isOpen && "pointer-events-none")}>
          {children}
        </div>
      </div>
      ) : null}
    </div>
  );
}
