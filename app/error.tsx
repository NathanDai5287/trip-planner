"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Compass, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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

      {/* Error content */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="text-center max-w-md animate-fade-up">
          <div className="topo-pattern absolute inset-0 pointer-events-none" aria-hidden="true" />

          <div className="relative z-10">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-stone">
              <AlertTriangle size={36} className="text-terracotta" />
            </div>

            <h1 className="font-display text-3xl font-semibold text-charcoal mb-3">
              Something went wrong
            </h1>

            <p className="text-muted mb-8 leading-relaxed">
              We hit an unexpected detour. This might be a temporary issue, so
              feel free to try again or head back to your dashboard.
            </p>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button
                variant="primary"
                size="lg"
                onClick={() => unstable_retry()}
              >
                <RotateCcw size={16} />
                Try again
              </Button>

              <Link href="/dashboard">
                <Button variant="secondary" size="lg">
                  Back to Dashboard
                </Button>
              </Link>
            </div>

            {error.digest && (
              <p className="mt-8 text-xs text-muted/60">
                Error reference: {error.digest}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
