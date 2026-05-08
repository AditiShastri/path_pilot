"use client"

import * as React from "react"
import {
  Mic,
  MicOff,
  MoreHorizontal,
  SquarePen,
  PawPrint,
  CalendarDays,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { NavUser } from "@/components/nav-user"
import { cn } from "@/lib/utils"
import { useUserInfo } from "@/hooks/useUserInfo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Chat = {
  id: string
  title: string | null
  updated_at: string
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  chats?: Chat[]
  activeChatId: string | null
  onOpenChat: (id: string) => void
  refreshChats: () => void
  voiceAssistantEnabled: boolean
  onToggleVoiceAssistant: () => void
}

function groupChatsByDate(chats: Chat[]) {
  const now = new Date()
  
  const groups: Record<string, Chat[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    "Previous 30 Days": [],
    Older: [],
  }

  for (const chat of chats) {
    const created = new Date(chat.updated_at)
    const diff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)

    if (diff < 1) groups.Today.push(chat)
    else if (diff < 2) groups.Yesterday.push(chat)
    else if (diff < 7) groups["Previous 7 Days"].push(chat)
    else if (diff < 30) groups["Previous 30 Days"].push(chat)
    else groups.Older.push(chat)
  }

  return groups
}

export function AppSidebar({
  chats,
  activeChatId,
  onOpenChat,
  refreshChats,
  voiceAssistantEnabled,
  onToggleVoiceAssistant,
  ...props
}: AppSidebarProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState("")
  const { user } = useUserInfo();
  const [calendarConnected, setCalendarConnected] = React.useState<boolean | null>(null);
  const [calendarConnectUrl, setCalendarConnectUrl] = React.useState<string>("/auth/google-calendar/connect");
  const safeChats = Array.isArray(chats) ? chats : []
  const grouped = React.useMemo(() => groupChatsByDate(safeChats), [safeChats])
  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;

    async function loadCalendarStatus() {
      if (!user?.auth_id) {
        setCalendarConnected(null);
        return;
      }
      try {
        const res = await fetch("/api/calendar/status", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setCalendarConnected(false);
          return;
        }
        const data = (await res.json()) as { connected?: boolean; connectUrl?: string };
        if (cancelled) return;
        setCalendarConnected(Boolean(data?.connected));
        if (typeof data?.connectUrl === "string") {
          setCalendarConnectUrl(data.connectUrl);
        }
      } catch {
        if (!cancelled) setCalendarConnected(false);
      }
    }

    loadCalendarStatus();
    return () => {
      cancelled = true;
    };
  }, [user?.auth_id]);
  async function deleteChat(id: string) {
    await fetch(`/api/chats/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
    refreshChats()
  }

  async function renameChat(id: string) {
    await fetch(`/api/chats/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    setEditingId(null)
    refreshChats()
  }
  const userData = user ? {
    name: user.name || "User",
    email: user.email || "",
    avatar: user.avatar || "",
  } : {
    name: "Guest",
    email: "",
    avatar: "",
  };
  return (
    <Sidebar {...props}>
      <SidebarHeader className="p-3 pb-4 border-b w-full">
        <div className="flex items-center justify-between gap-2">
          
          <h1 className="text-lg font-bold tracking-widest">PATH-PILOT</h1>
          <PawPrint className="size-6" />
        </div>
      </SidebarHeader>

      <SidebarContent className="py-3 overflow-y-auto flex flex-col">
        <div className="px-2 mb-2 flex flex-col gap-2">
          <Button
            onClick={() => onOpenChat("new")}
            className="w-full justify-start items-center gap-2"
            variant="ghost"
          >
            <SquarePen className="size-5" />
            New Chat
          </Button>
          <Button
            onClick={onToggleVoiceAssistant}
            className="w-full justify-start items-center gap-2"
            variant="ghost"
            aria-pressed={voiceAssistantEnabled}
          >
            {voiceAssistantEnabled ? (
              <Mic className="size-5" />
            ) : (
              <MicOff className="size-5" />
            )}
            Voice Assistant {voiceAssistantEnabled ? "On" : "Off"}
          </Button>

          {calendarConnected !== null && (
            <div className="px-3 flex items-center gap-2 text-muted-foreground">
              {calendarConnected ? (
                <CheckCircle className="size-5 text-green-500" />
              ) : (
                <XCircle className="size-5 text-muted-foreground" />
              )}
                Calendar: {calendarConnected ? "Connected" : "Not connected"}
            </div>
          )}

          {calendarConnected === false && (
            <Button
              onClick={() => router.push(calendarConnectUrl)}
              className="w-full justify-start items-center gap-2"
              variant="ghost"
            >
              <CalendarDays className="size-5" />
              Connect Calendar
            </Button>
          )}
        </div>
        <Separator className="mb-4" />
        
        <div className="flex-1 overflow-y-auto">
        {Object.entries(grouped).map(([label, chats]) =>
          chats.length ? (
            <div key={label} className="mb-6">
              <div className="px-3 mb-2 text-xs font-medium text-muted-foreground capitalize tracking-wide">
                {label}
              </div>

              <div className="flex flex-col gap-1">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      if (editingId === chat.id) return
                      onOpenChat(chat.id)
                    }}
                    className={cn(
                      "group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer",
                      "transition-all duration-150 ease-out",
                      "hover:bg-accent",
                      activeChatId === chat.id &&
                        "bg-muted border border-border font-medium"
                    )}
                  >

                    {editingId === chat.id ? (
                      <input
                        autoFocus
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onBlur={() => renameChat(chat.id)}
                        onKeyDown={(e) => {
                          e.stopPropagation()
                          if (e.key === "Enter") {
                            e.preventDefault()
                            renameChat(chat.id)
                          }
                          if (e.key === "Escape") {
                            e.preventDefault()
                            setEditingId(null)
                          }
                        }}
                        className="bg-transparent outline-none text-sm w-full"
                      />
                    ) : (
                      <span className="text-sm truncate flex-1">
                        {chat.title || "New Chat"}
                      </span>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="transition-opacity p-1 rounded-md hover:bg-accent"
                        >
                          <MoreHorizontal className="size-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingId(chat.id)
                            setTitle(chat.title || "")
                          }}
                        >
                          Rename
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteChat(chat.id)
                            router.push("/ai-assistant/new")
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )}
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
      <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
