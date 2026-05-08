"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'

export type TabKey = "clubs" | "departments" | "students" | "faculty" | "club"|"department"|"stats"|"report"|"settings";

export function NavMain({
  items,
  activeTab,
  onTabClick,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
      tab?: TabKey
    }[]
  }[]
  activeTab?: TabKey
  onTabClick?: (tab: TabKey) => void
}) {
  const router = useRouter();

  const handleSubItemClick = (e: React.MouseEvent, subItem: { url: string; tab?: TabKey }) => {
    if (subItem.tab && onTabClick) {
      e.preventDefault();
      onTabClick(subItem.tab);
    } else if (subItem.url && subItem.url !== "#") {
      e.preventDefault();
      router.push(subItem.url);
    }
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={item.isActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items?.map((subItem) => {
                    const isActive = subItem.tab === activeTab;
                    return (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton 
                          asChild
                          isActive={isActive}
                          onClick={(e) => handleSubItemClick(e, subItem)}
                        >
                          <a href={subItem.url} onClick={(e) => handleSubItemClick(e, subItem)}>
                            <span>{subItem.title}</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
