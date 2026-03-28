import Link from "next/link";
import { MapPinOff, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SharedTripNotFound() {
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

      {/* Content */}
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center max-w-md px-6 animate-fade-up">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-stone">
            <MapPinOff size={36} className="text-muted" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-charcoal mb-3">
            Trip not found
          </h1>
          <p className="text-muted mb-8 leading-relaxed">
            This trip doesn&apos;t exist or is no longer shared publicly. The
            owner may have made it private or deleted it.
          </p>
          <Link href="/signup">
            <Button variant="primary" size="lg">
              Plan your own trip
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
