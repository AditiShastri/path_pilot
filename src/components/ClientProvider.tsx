"use client";

// import { ThemeToggle } from "@/components/ThemeToggle";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
const queryClient = new QueryClient();
import { UserProvider } from '@/hooks/useUserInfo';
import { LocationProvider } from "@/hooks/useLocationContext";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const useDark = savedTheme ? savedTheme === "dark" : prefersDark

    document.documentElement.classList.toggle("dark", useDark)
    document.documentElement.setAttribute("data-theme", useDark ? "dark" : "light")
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <LocationProvider>
          <main>
            {children}
          </main>
        </LocationProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </UserProvider>
    </QueryClientProvider>
  );
}
