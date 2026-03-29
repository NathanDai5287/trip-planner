"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSharedTrip } from "@/lib/firestore";
import type { Trip } from "@/lib/types";
import { SharedTripView } from "@/components/trip/shared-trip-view";

export default function SharedTripPage() {
  const { slug } = useParams<{ slug: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSharedTrip(slug).then((t) => {
      setTrip(t);
      setLoading(false);
    });
  }, [slug]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone border-t-terracotta" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-cream text-center px-4">
        <h1 className="font-display text-2xl font-semibold text-charcoal">
          Trip not found
        </h1>
        <p className="mt-2 text-sm text-muted">
          This trip may have been removed or is no longer shared.
        </p>
      </div>
    );
  }

  return <SharedTripView trip={trip} />;
}
