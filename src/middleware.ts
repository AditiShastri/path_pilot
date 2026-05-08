import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Protected routes that require authentication
    const protectedRoutes = ["/ai-assistant"];

    const isProtectedRoute = protectedRoutes.some((route) =>
      request.nextUrl.pathname.startsWith(route)
    );

    // If accessing protected route without auth, redirect to login
    if (isProtectedRoute && !user) {
      return redirect("/login");
    }

    // If logged in and trying to access auth pages, redirect to home
    const authRoutes = ["/login", "/signup"];
    const isAuthRoute = authRoutes.some((route) =>
      request.nextUrl.pathname.startsWith(route)
    );

    if (isAuthRoute && user) {
      return redirect("/");
    }

    return NextResponse.next();
  } catch (error) {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/ai-assistant/:path*", "/login", "/signup"],
};
