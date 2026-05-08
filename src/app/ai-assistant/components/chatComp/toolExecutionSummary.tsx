import { cn } from "@/lib/utils";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from "@/components/ui/chain-of-thought";
import { CalendarClock, Database, Eye, Globe, Loader2, Network, PenLine, Presentation, Wrench } from "lucide-react";

function getToolVisual(toolType: string) {
  const normalizedType = toolType.replace(/^tool-/, "");

  const visualMap: Record<
    string,
    {
      Icon: any;
      iconClassName: string;
    }
  > = {
    web_search: {
      Icon: Globe,
      iconClassName: "text-blue-500",
    },
    read_sql: {
      Icon: Database,
      iconClassName: "text-teal-500",
    },
    schema_info: {
      Icon: Network,
      iconClassName: "text-cyan-500",
    },
    execute_preview_write_sql: {
      Icon: Eye,
      iconClassName: "text-orange-500",
    },
    execute_write_sql: {
      Icon: PenLine,
      iconClassName: "text-green-500",
    },
    present_data: {
      Icon: Presentation,
      iconClassName: "text-primary",
    },
    commute_plan: {
      Icon: CalendarClock,
      iconClassName: "text-indigo-500",
    },
  };

  return (
    visualMap[normalizedType] ?? {
      Icon: Wrench,
      iconClassName: "text-muted-foreground",
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
    read_sql: {
      title: "Running database query",
      description: "Accessing structured records from the database.",
    },
    schema_info: {
      title: "Inspecting schema",
      description: "Reviewing table and relationship metadata.",
    },
    execute_preview_write_sql: {
      title: "Previewing write SQL",
      description: "Running write in rollback transaction to inspect impact.",
    },
    execute_write_sql: {
      title: "Committing write SQL",
      description: "Applying confirmed write changes to the database.",
    },
    present_data: {
      title: "Presenting data",
      description: "Formatting data for on-screen display instead of speech.",
    },
    commute_plan: {
      title: "Planning commute",
      description: "Checking mock events, routes, travel modes, conflicts, and bookings.",
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
              const { Icon, iconClassName } = getToolVisual(toolType);
              const stateLabel = stateLabelMap[state] ?? "Pending";
              const isRunning = stateLabel === "Running";
              const isFailed = stateLabel === "Failed";
              const isLast = index === parts.length - 1;
              const showConnector = parts.length === 1 ? true : !isLast;

              return (
                <div key={`${toolPart?.toolCallId ?? toolType}-${index}`} className="grid grid-cols-[min-content_minmax(0,1fr)] gap-x-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "relative inline-flex size-5 items-center justify-center rounded-md",
                        isFailed ? "bg-red-500/15" : "bg-background"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-3.5",
                          isFailed ? "text-red-500" : iconClassName,
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
                    <ChainOfThoughtItem className="pl-7">Status: {stateLabel}</ChainOfThoughtItem>
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
