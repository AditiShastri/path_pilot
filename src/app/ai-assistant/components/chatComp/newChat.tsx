import { PromptSuggestion } from "@/components/ui/prompt-suggestion"
import { Pencil,Database,Plane,Recycle } from "lucide-react";

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
                Query data • Preview changes • Execute with confidence
              </p>
            </div>

            {/* Suggestions */}
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <PromptSuggestion
                className="bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20"
                onClick={() =>
                  setInput(
                    "What can you do with aircraft and engine data?"
                  )
                }
              >
                <Pencil className="text-blue-500"/>
                Get Started
              </PromptSuggestion>

              <PromptSuggestion
                className="bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20"
                onClick={() =>
                  setInput(
                    "Show me what data is available in the database"
                  )
                }
              >
                <Database className="text-amber-500"/>
                Schema Info
              </PromptSuggestion>

              <PromptSuggestion
                className="bg-emerald-500/10  border border-emerald-500/20 hover:bg-emerald-500/20"
                onClick={() =>
                  setInput(
                    "List all aircraft with their delivery and retirement dates"
                  )
                }
              >
                <Plane className="text-emerald-500"/>
                Aircraft Insight
              </PromptSuggestion>

              <PromptSuggestion
                className="bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20"
                onClick={() =>
                  setInput(
                    "Which aircraft are closest to retirement?"
                  )
                }
              >
                <Recycle className="text-purple-500"/>
                Lifecycle Insight
              </PromptSuggestion>
            </div>
          </div>
        </div>
    );
}
