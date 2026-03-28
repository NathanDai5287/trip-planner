import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-screen bg-cream">
      {/* Minimal header */}
      <header className="bg-charcoal text-cream">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Compass
              size={28}
              className="text-terracotta-light transition-transform duration-300 group-hover:rotate-45"
            />
            <span className="font-display text-xl font-semibold tracking-tight text-cream">
              Wayfinder
            </span>
          </Link>
        </div>
      </header>

      {/* 404 content */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="relative text-center max-w-md">
          <div className="topo-pattern absolute inset-0 -m-20 pointer-events-none" aria-hidden="true" />

          <div className="relative z-10 animate-fade-up">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-stone">
              <Compass size={36} className="text-muted" />
            </div>

            <h1 className="font-display text-3xl font-semibold text-charcoal mb-3">
              Page not found
            </h1>

            <p className="text-muted mb-8 leading-relaxed">
              Looks like you&apos;ve wandered off the map. The page you&apos;re
              looking for doesn&apos;t exist or may have been moved.
            </p>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/">
                <Button variant="primary" size="lg">
                  Return Home
                </Button>
              </Link>

              <Link href="/dashboard">
                <Button variant="secondary" size="lg">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
