"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";


interface UserInfo {
  auth_id: string;
  email: string;
  name: string;
  avatar:string;
}

interface UserContextType {
  user: UserInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async (): Promise<void> => {
    setLoading(true);

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const authUserId = authUser?.id;
    if (!authUserId) {
      setUser(null);
      setLoading(false);
      return;
    }
    else{

    

    setUser({
      auth_id: authUserId,
      email: authUser?.email ?? "",
      name: authUser?.user_metadata?.name ?? "",
      avatar: authUser?.user_metadata?.avatar_url || ""
    });

    setLoading(false);
  }
  };

  useEffect(() => {
    fetchUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        fetchUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return React.createElement(
    UserContext.Provider,
    { value: { user, loading, refresh: fetchUser } },
    children
  );
}

export function useUserInfo() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserInfo must be used within a UserProvider');
  }
  return context;
}