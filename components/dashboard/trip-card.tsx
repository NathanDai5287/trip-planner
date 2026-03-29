"use client";

import Link from "next/link";
import { useState } from "react";
import { MapPin, Calendar, Share2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DeleteTripDialog } from "@/components/dashboard/delete-trip-dialog";
import type { Trip } from "@/lib/types";

interface TripCardProps {
  trip: Trip;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function TripCard({ trip }: TripCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const destCount = trip.destinations.length;

  return (
    <>
      <Card accent className="group relative transition-shadow duration-200 hover:shadow-md">
        <Link
          href={`/trip/${trip.id}`}
          className="block px-6 py-5"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-charcoal leading-snug line-clamp-2">
              {trip.title}
            </h3>
            {trip.isPublic && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-medium text-forest">
                <Share2 size={12} />
                Public
              </span>
            )}
          </div>

          {trip.description && (
            <p className="mt-1.5 text-sm text-muted font-body line-clamp-2">
              {trip.description}
            </p>
          )}

          <div className="mt-4 flex items-center gap-4 text-xs text-muted font-body">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} className="text-terracotta" />
              {destCount} {destCount === 1 ? "destination" : "destinations"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} className="text-terracotta" />
              {formatDate(trip.createdAt)}
            </span>
          </div>
        </Link>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDeleteOpen(true);
          }}
          className="absolute top-4 right-4 rounded-md p-1.5 text-muted opacity-0 transition-all duration-150 hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
          aria-label={`Delete ${trip.title}`}
        >
          <Trash2 size={16} />
        </button>
      </Card>

      <DeleteTripDialog
        tripId={trip.id}
        tripTitle={trip.title}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

export { TripCard };
export type { TripCardProps };
