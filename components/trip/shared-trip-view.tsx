"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { Trip, Destination } from "@/lib/types";
import {
  Compass,
  Map as MapIcon,
  List,
  MapPin,
  Car,
} from "lucide-react";
import { formatDuration } from "@/lib/format-duration";
import { TripMap, getDayColor } from "@/components/map/trip-map";
import { Button } from "@/components/ui/button";

type TripWithDestinations = Trip & { destinations: Destination[] };

interface SharedTripViewProps {
  trip: TripWithDestinations;
}

function SharedTripView({ trip }: SharedTripViewProps) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");

  const destinations = trip.destinations;
  const routes = trip.routes;

  const handleMarkerClick = useCallback((destId: string) => {
    setHighlightedId(destId);
    // On mobile, switch to list view when marker is clicked
    setMobileView("list");
  }, []);

  function getDriveTime(fromId: string, toId: string): number | null {
    const route = routes.find((r) => r.fromId === fromId && r.toId === toId);
    return route ? route.duration : null;
  }

  function getDayDriveTime(dayDests: Destination[]): number {
    let total = 0;
    for (let i = 0; i < dayDests.length - 1; i++) {
      const t = getDriveTime(dayDests[i].id, dayDests[i + 1].id);
      if (t) total += t;
    }
    return total;
  }

  const totalSeconds = routes.reduce((sum, r) => sum + r.duration, 0);

  return (
    <div className="flex flex-col h-screen">
      {/* Top banner */}
      <header className="bg-charcoal text-cream">
        <div className="mx-auto flex h-14 max-w-full items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <Compass
                size={22}
                className="text-terracotta-light transition-transform duration-300 group-hover:rotate-45"
              />
              <span className="font-display text-lg font-semibold tracking-tight text-cream hidden sm:inline">
                Wayfinder
              </span>
            </Link>
            <span className="h-5 w-px bg-ink" aria-hidden="true" />
            <span className="text-xs font-body text-stone uppercase tracking-wider">
              Shared Trip
            </span>
          </div>

          <Link href="/dashboard">
            <Button
              variant="primary"
              size="sm"
              className="text-xs sm:text-sm"
            >
              Plan your own trip
            </Button>
          </Link>
        </div>
      </header>

      {/* Mobile view toggle */}
      <div className="lg:hidden flex border-b border-border bg-cream">
        <button
          type="button"
          onClick={() => setMobileView("map")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors cursor-pointer ${
            mobileView === "map"
              ? "text-terracotta border-b-2 border-terracotta"
              : "text-muted hover:text-charcoal"
          }`}
        >
          <MapIcon size={16} />
          Map
        </button>
        <button
          type="button"
          onClick={() => setMobileView("list")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors cursor-pointer ${
            mobileView === "list"
              ? "text-terracotta border-b-2 border-terracotta"
              : "text-muted hover:text-charcoal"
          }`}
        >
          <List size={16} />
          Itinerary
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - hidden on mobile when viewing map */}
        <aside
          className={`
            ${mobileView === "list" ? "flex" : "hidden"}
            lg:flex
            w-full lg:w-[400px] flex-shrink-0
            flex-col bg-cream border-r border-border
            overflow-hidden
          `}
        >
          <div className="flex flex-col h-full overflow-hidden">
            {/* Trip header */}
            <div className="px-5 pt-5 pb-4">
              <h1 className="font-display text-2xl font-semibold text-charcoal leading-tight">
                {trip.title}
              </h1>
              {trip.description && (
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  {trip.description}
                </p>
              )}
            </div>

            {/* Destination list */}
            <div className="flex-1 overflow-y-auto px-5 pb-3">
              {destinations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone">
                    <MapPin size={24} className="text-muted" />
                  </div>
                  <p className="text-sm font-medium text-charcoal mb-1">
                    No destinations yet
                  </p>
                  <p className="text-xs text-muted">
                    This trip doesn&apos;t have any destinations.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {Array.from({ length: trip.totalDays }, (_, dayIndex) => {
                    const dayDests = destinations
                      .filter((d) => d.dayIndex === dayIndex)
                      .sort((a, b) => a.sortOrder - b.sortOrder);

                    const prevDayDests = dayIndex > 0
                      ? destinations
                          .filter((d) => d.dayIndex === dayIndex - 1)
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                      : [];

                    const crossDayTime =
                      prevDayDests.length > 0 && dayDests.length > 0
                        ? getDriveTime(
                            prevDayDests[prevDayDests.length - 1].id,
                            dayDests[0].id,
                          )
                        : null;

                    const dayDriveTime = getDayDriveTime(dayDests);

                    return (
                      <div key={dayIndex}>
                        {dayIndex > 0 && (
                          <div className="flex items-center gap-2 py-0.5 px-1">
                            <div className="flex-1 h-px bg-border/60" />
                            {crossDayTime !== null && (
                              <span className="text-xs text-muted/50 shrink-0 tabular-nums">
                                {formatDuration(crossDayTime)}
                              </span>
                            )}
                            <div className="flex-1 h-px bg-border/60" />
                          </div>
                        )}

                        {trip.totalDays > 1 && (
                          <div className="flex items-center gap-2 pt-3 first:pt-0 pb-1">
                            <h3 className="font-display text-sm font-semibold text-charcoal tracking-wide uppercase">
                              Day {dayIndex + 1}
                            </h3>
                            <div className="flex-1 h-px bg-border" />
                            {dayDests.length > 0 && dayDriveTime > 0 && (
                              <span className="text-xs text-muted shrink-0">
                                {formatDuration(dayDriveTime)}
                              </span>
                            )}
                          </div>
                        )}

                        {dayDests.map((dest, i) => {
                          const nextDest = dayDests[i + 1];
                          const driveTime = nextDest
                            ? getDriveTime(dest.id, nextDest.id)
                            : null;

                          return (
                            <div key={dest.id}>
                              <div
                                className={`
                                  flex items-start gap-3 rounded-lg border bg-cream p-3
                                  border-l-4
                                  transition-all duration-200 cursor-pointer
                                  shadow-sm
                                  ${
                                    highlightedId === dest.id
                                      ? "ring-2 ring-terracotta/40 bg-stone-light"
                                      : "border-border hover:bg-stone-light/50"
                                  }
                                `}
                                style={{ borderLeftColor: getDayColor(dest.dayIndex) }}
                                onClick={() => setHighlightedId(dest.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setHighlightedId(dest.id);
                                  }
                                }}
                              >
                                <div
                                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
                                  style={{ backgroundColor: getDayColor(dest.dayIndex) }}
                                >
                                  {dest.sortOrder + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-charcoal truncate">
                                    {dest.name}
                                  </p>
                                  <p className="text-xs text-muted truncate mt-0.5">
                                    {dest.address}
                                  </p>
                                  {dest.notes && (
                                    <p className="mt-1.5 text-xs text-muted/80 leading-relaxed line-clamp-2">
                                      {dest.notes}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {nextDest && driveTime !== null && (
                                <div className="flex items-center gap-2 py-0.5 px-1">
                                  <div className="flex-1 h-px bg-border/60" />
                                  <span className="text-xs text-muted/50 shrink-0 tabular-nums">
                                    {formatDuration(driveTime)}
                                  </span>
                                  <div className="flex-1 h-px bg-border/60" />
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {dayDests.length === 0 && (
                          <p className="text-xs text-muted italic py-2 pl-2">
                            No stops planned for this day
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom summary */}
            {destinations.length > 0 && (
              <div className="border-t border-border px-5 py-4">
                <div className="flex items-center gap-4 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} className="text-terracotta" />
                    {destinations.length}{" "}
                    {destinations.length === 1 ? "stop" : "stops"}
                  </span>
                  {totalSeconds > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <Car size={14} className="text-terracotta" />
                      {formatDuration(totalSeconds)} total drive
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Map - hidden on mobile when viewing list */}
        <div
          className={`
            ${mobileView === "map" ? "flex" : "hidden"}
            lg:flex
            flex-1 relative
          `}
        >
          <TripMap
            destinations={destinations}
            routes={routes}
            highlightedId={highlightedId}
            onMarkerClick={handleMarkerClick}
            pois={[]}
            onPoisChange={() => {}}
            onAddPOI={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

export { SharedTripView };
