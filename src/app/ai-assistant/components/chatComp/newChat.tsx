import { PromptSuggestion } from "@/components/ui/prompt-suggestion"
import { Bus, CalendarClock, Globe, Route } from "lucide-react";

type newChatProps={
    setInput:(msg:string)=>void;
}
export function NewChat({setInput}:newChatProps){

    return(
        <div className="h-full w-full flex items-center justify-center">
          <div className="max-w-2xl w-full text-center space-y-2 px-6">
            {/* Title */}
            <div className="space-y-2">
              <h2 className="text-5xl sm:text-7xl font-semibold tracking-tight tracking-wider" >
                 PATH-PILOT
              </h2>
              <p className="text-muted-foreground text-sm">
                Plan your day • Organize events • Choose the best commute
              </p>
            </div>

            {/* Suggestions */}
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <PromptSuggestion
                className="bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20"
                onClick={() =>
                  setInput(
                    "Plan my day tomorrow with my calendar events and suggest ideal travel times."
                  )
                }
              >
                <CalendarClock className="text-blue-500"/>
                Plan My Day
              </PromptSuggestion>

              <PromptSuggestion
                className="bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20"
                onClick={() =>
                  setInput(
                    "I have a meeting at 10 AM in Koramangala. Calculate commute time from my saved location."
                  )
                }
              >
                <Route className="text-amber-500"/>
                Estimate Commute
              </PromptSuggestion>

              <PromptSuggestion
                className="bg-emerald-500/10  border border-emerald-500/20 hover:bg-emerald-500/20"
                onClick={() =>
                  setInput(
                    "Find the best public transit option to my next event and tell me when to leave."
                  )
                }
              >
                <Bus className="text-emerald-500"/>
                Public Transit
              </PromptSuggestion>

              <PromptSuggestion
                className="bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20"
                onClick={() =>
                  setInput(
                    "Check current conditions that could affect my commute today and summarize them."
                  )
                }
              >
                <Globe className="text-purple-500"/>
                Live Travel Context
              </PromptSuggestion>
            </div>
          </div>
        </div>
    );
}
