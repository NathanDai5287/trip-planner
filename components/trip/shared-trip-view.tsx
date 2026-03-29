"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type { Trip, Destination, RouteSegment } from "@/lib/types";
import {
  Compass,
  Map as MapIcon,
  List,
  MapPin,
  Car,
  Clock,
} from "lucide-react";
import { decodePolyline } from "@/lib/polyline";
import { formatDuration } from "@/lib/format-duration";
import { TripMap } from "@/components/map/trip-map";
import { Button } from "@/components/ui/button";

type TripWithDestinations = Trip & { destinations: Destination[] };

interface SharedTripViewProps {
  trip: TripWithDestinations;
}

function SharedTripView({ trip }: SharedTripViewProps) {
  const [routes, setRoutes] = useState<RouteSegment[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const abortRef = useRef<AbortController | null>(null);

  const destinations = trip.destinations;

  const fetchRoutes = useCallback(async (dests: Destination[]) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (dests.length < 2) {
      setRoutes([]);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const pairs: { from: Destination; to: Destination }[] = [];
    for (let i = 0; i < dests.length - 1; i++) {
      pairs.push({ from: dests[i], to: dests[i + 1] });
    }

    const newRoutes: RouteSegment[] = [];

    for (const pair of pairs) {
      if (controller.signal.aborted) return;

      try {
        const coords = `${pair.from.lng},${pair.from.lat};${pair.to.lng},${pair.to.lat}`;
        const res = await fetch(`/api/osrm?coordinates=${coords}`, {
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Route fetch failed");

        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const osrmRoute = data.routes[0];
          const decoded = decodePolyline(osrmRoute.geometry);
          const geometry: [number, number][] = decoded.map(([lat, lng]) => [
            lng,
            lat,
          ]);

          const segment: RouteSegment = {
            fromId: pair.from.id,
            toId: pair.to.id,
            duration: osrmRoute.duration,
            distance: osrmRoute.distance,
            geometry,
          };

          newRoutes.push(segment);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch route:", err);
      }

      // Rate limit: wait 1s between requests
      if (!controller.signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!controller.signal.aborted) {
      setRoutes(newRoutes);
    }
  }, []);

  useEffect(() => {
    fetchRoutes(destinations);
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [destinations, fetchRoutes]);

  const handleMarkerClick = useCallback((destId: string) => {
    setHighlightedId(destId);
    // On mobile, switch to list view when marker is clicked
    setMobileView("list");
  }, []);

  function getDriveTimeToNext(destId: string): number | null {
    const route = routes.find((r) => r.fromId === destId);
    return route ? route.duration : null;
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

                    return (
                      <div key={dayIndex}>
                        {trip.totalDays > 1 && (
                          <div className="flex items-center gap-2 pt-3 first:pt-0 pb-1">
                            <h3 className="font-display text-sm font-semibold text-charcoal tracking-wide uppercase">
                              Day {dayIndex + 1}
                            </h3>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                        )}

                        {dayDests.map((dest) => {
                          const driveTime = getDriveTimeToNext(dest.id);
                          return (
                            <div key={dest.id} className="flex flex-col">
                              <div
                                className={`
                                  flex items-start gap-3 rounded-lg border bg-cream p-3
                                  border-l-4 border-l-terracotta
                                  transition-all duration-200 cursor-pointer
                                  shadow-sm
                                  ${
                                    highlightedId === dest.id
                                      ? "ring-2 ring-terracotta/40 bg-stone-light"
                                      : "border-border hover:bg-stone-light/50"
                                  }
                                `}
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
                                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-terracotta text-white text-xs font-bold">
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

                              {driveTime !== null && (
                                <div className="flex justify-center py-1.5">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-stone px-2 py-0.5 text-xs text-muted">
                                    <Clock size={10} className="shrink-0" />
                                    {formatDuration(driveTime)}
                                  </span>
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
