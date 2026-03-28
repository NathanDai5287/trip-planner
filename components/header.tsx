"use client";

import Link from "next/link";
import { Compass, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 bg-charcoal text-cream">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Compass
            size={28}
            className="text-terracotta-light transition-transform duration-300 group-hover:rotate-45"
          />
          <span className="font-display text-xl font-semibold tracking-tight text-cream">
            Wayfinder
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          {status === "loading" && (
            <div className="h-4 w-24 animate-shimmer rounded" />
          )}

          {status === "authenticated" && session?.user && (
            <>
              <span className="hidden text-sm text-stone-light sm:block">
                {session.user.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-stone-light hover:text-cream hover:bg-ink"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </>
          )}

          {status === "unauthenticated" && (
            <>
              <Link
                href="/login"
                className="text-sm text-stone-light hover:text-cream transition-colors"
              >
                Sign In
              </Link>
              <Link href="/signup">
                <Button variant="primary" size="sm">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export { Header };
