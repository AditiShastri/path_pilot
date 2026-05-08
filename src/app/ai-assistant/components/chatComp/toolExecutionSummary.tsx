import { cn } from "@/lib/utils";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from "@/components/ui/chain-of-thought";
import {
  CalendarCheck2,
  CalendarClock,
  Globe,
  Loader2,
  Presentation,
  Route,
  Wrench,
} from "lucide-react";

function getToolVisual(toolType: string) {
  const normalizedType = toolType.replace(/^tool-/, "");

  const visualMap: Record<
    string,
    {
      Icon: any;
      iconClassName: string;
      iconContainerClassName: string;
    }
  > = {
    web_search: {
      Icon: Globe,
      iconClassName: "text-blue-600 dark:text-blue-400",
      iconContainerClassName: "bg-blue-500/15",
    },
    present_data: {
      Icon: Presentation,
      iconClassName: "text-violet-600 dark:text-violet-400",
      iconContainerClassName: "bg-violet-500/15",
    },
    upcoming_events: {
      Icon: CalendarClock,
      iconClassName: "text-cyan-600 dark:text-cyan-400",
      iconContainerClassName: "bg-cyan-500/15",
    },
    create_calendar_event: {
      Icon: CalendarCheck2,
      iconClassName: "text-emerald-600 dark:text-emerald-400",
      iconContainerClassName: "bg-emerald-500/15",
    },
    plan_route: {
      Icon: Route,
      iconClassName: "text-indigo-600 dark:text-indigo-400",
      iconContainerClassName: "bg-indigo-500/15",
    },
  };

  return (
    visualMap[normalizedType] ?? {
      Icon: Wrench,
      iconClassName: "text-muted-foreground",
      iconContainerClassName: "bg-muted/50",
    }
  );
}

function getToolSummary(toolType: string) {
  const normalizedType = toolType.replace(/^tool-/, "");

  const summaryMap: Record<string, { title: string; description: string }> = {
    web_search: {
      title: "Performing web search",
      description: "Retrieving information from online websites.",
    },
    present_data: {
      title: "Presenting data",
      description: "Formatting data for on-screen display instead of speech.",
    },
    upcoming_events: {
      title: "Checking calendar events",
      description: "Loading events for the requested day or time range.",
    },
    create_calendar_event: {
      title: "Creating calendar event",
      description: "Saving a new event to your Google Calendar.",
    },
    plan_route: {
      title: "Planning route",
      description: "Calculating route distance and ETA.",
    },
  };

  const fallback = normalizedType.replace(/_/g, " ");

  return (
    summaryMap[normalizedType] ?? {
      title: `Calling ${fallback}`,
      description: "Executing tool action and processing results.",
    }
  );
}
export function ToolExecutionSummary({ toolParts }: { toolParts: any[] }) {
  const parts = Array.isArray(toolParts) ? toolParts : [];

  if (parts.length === 0) {
    return null;
  }

  const stateLabelMap: Record<string, string> = {
    "input-streaming": "Running",
    "input-available": "Running",
    "output-available": "Completed",
    "output-error": "Failed",
  };

  return (
    <div className="rounded-xl space-y-2 p-2">
      <ChainOfThought>
        <ChainOfThoughtStep defaultOpen={true}>
          <ChainOfThoughtTrigger className="text-md ">
            Execution Trace
          </ChainOfThoughtTrigger>
          <ChainOfThoughtContent>
            {parts.map((toolPart, index) => {
              const toolType =
                typeof toolPart?.type === "string" ? toolPart.type : "tool-unknown";
              const state = toolPart?.state ?? "pending";
              const { title, description } = getToolSummary(toolType);
              const { Icon, iconClassName, iconContainerClassName } = getToolVisual(toolType);
              const stateLabel = stateLabelMap[state] ?? "Pending";
              const isRunning = stateLabel === "Running";
              const isFailed = stateLabel === "Failed";
              const isCompleted = stateLabel === "Completed";
              const isLast = index === parts.length - 1;
              const showConnector = parts.length === 1 ? true : !isLast;

              return (
                <div key={`${toolPart?.toolCallId ?? toolType}-${index}`} className="grid grid-cols-[min-content_minmax(0,1fr)] gap-x-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "relative inline-flex size-5 items-center justify-center rounded-md",
                        isFailed
                          ? "bg-red-500/15"
                          : isCompleted
                            ? "bg-emerald-500/15"
                            : iconContainerClassName
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-3.5",
                          isFailed ? "text-red-500" : isCompleted ? "text-emerald-500" : iconClassName,
                          isRunning && "animate-pulse"
                        )}
                      />
                    </span>
                    <span
                      className={cn(
                        "mt-1 w-px bg-primary/20 min-h-4",
                        showConnector ? "flex-1" : "opacity-0"
                      )}
                    />
                  </div>
                  <div className="rounded-lg space-y-1 mb-2">
                    <div className="min-h-5 flex items-center text-sm leading-5 font-medium text-foreground">
                      {title}{isRunning&&<Loader2 className="ml-2 size-4 animate-spin text-muted-foreground" />}
                    </div>
                    <ChainOfThoughtItem className="pl-7">{description}</ChainOfThoughtItem>
                    <ChainOfThoughtItem
                      className={cn(
                        "pl-7",
                        isFailed
                          ? "text-red-600 dark:text-red-400"
                          : isCompleted
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                      )}
                    >
                      Status: {stateLabel}
                    </ChainOfThoughtItem>
                  </div>
                </div>
              );
            })}
          </ChainOfThoughtContent>
        </ChainOfThoughtStep>
      </ChainOfThought>
    </div>
  );
}