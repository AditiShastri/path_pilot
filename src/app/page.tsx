"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";

export default function Home() {
  const [user, setUser] = useState<User>();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if(user)
        setUser(user);
    };

    getUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(undefined);
  };

  const userEmail = user?.email;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-xl shadow-xl border-border">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl" /*onClick={()=>console.log(user)}*/>Pixie Home</CardTitle>
          <CardDescription>
            {userEmail
              ? `Signed in as ${userEmail}`
              : "Welcome. Sign in to start chatting with AI."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button asChild className="w-full">
            <Link href="/ai-assistant">Go to AI Assistant</Link>
          </Button>

          {user ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}