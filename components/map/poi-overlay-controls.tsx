"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Tent, Dumbbell, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import type { POIType, PointOfInterest } from "@/lib/types";
import type { RouteSegment } from "@/components/trip/trip-editor";
import type { Destination } from "@/lib/types";

interface POIOverlayControlsProps {
  destinations: Destination[];
  routes: RouteSegment[];
  onPoisChange: (pois: PointOfInterest[]) => void;
}

const POI_OPTIONS: { type: POIType; label: string; icon: typeof Tent }[] = [
  { type: "campsite", label: "Free Campsites", icon: Tent },
  { type: "gym", label: "Gyms", icon: Dumbbell },
  { type: "library", label: "Libraries", icon: BookOpen },
];

const MILES_TO_METERS = 1609.34;

function POIOverlayControls({
  destinations,
  routes,
  onPoisChange,
}: POIOverlayControlsProps) {
  const [activeTypes, setActiveTypes] = useState<Set<POIType>>(new Set());
  const [radiusMiles, setRadiusMiles] = useState(15);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const hasRoute = routes.length > 0;
  const hasActiveTypes = activeTypes.size > 0;

  const toggleType = useCallback((type: POIType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Build route coordinates from destinations (sorted by sortOrder)
  const routeCoordinates: [number, number][] = [...destinations]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((d) => [d.lat, d.lng]);

  // Fetch POIs when toggles/radius/route change
  useEffect(() => {
    if (!hasActiveTypes || !hasRoute || routeCoordinates.length < 2) {
      onPoisChange([]);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const fetchPois = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/overpass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coordinates: routeCoordinates,
            radius: Math.round(radiusMiles * MILES_TO_METERS),
            types: Array.from(activeTypes),
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("POI fetch failed");

        const data = await res.json();
        if (!controller.signal.aborted) {
          onPoisChange(data.pois || []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch POIs:", err);
        if (!controller.signal.aborted) {
          onPoisChange([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    // Debounce the fetch slightly to avoid rapid re-fetches during slider drag
    const timer = setTimeout(fetchPois, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [hasActiveTypes, hasRoute, radiusMiles, activeTypes, routeCoordinates.length]);

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <div className="bg-cream/95 backdrop-blur-sm rounded-lg border border-border shadow-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-charcoal hover:bg-stone-light transition-colors cursor-pointer w-full"
        >
          <span>Show Nearby</span>
          {isLoading && (
            <span className="w-3 h-3 border-2 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
          )}
          <span className="ml-auto">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </span>
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
            {POI_OPTIONS.map(({ type, label, icon: Icon }) => (
              <label
                key={type}
                className="flex items-center gap-2 text-xs text-charcoal cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={activeTypes.has(type)}
                  onChange={() => toggleType(type)}
                  disabled={!hasRoute}
                  className="rounded border-border text-terracotta focus:ring-terracotta/20 disabled:opacity-50"
                />
                <Icon
                  size={14}
                  className={
                    type === "campsite"
                      ? "text-green-600"
                      : type === "gym"
                        ? "text-blue-600"
                        : "text-orange-600"
                  }
                />
                <span>{label}</span>
              </label>
            ))}

            {hasActiveTypes && (
              <div className="pt-1">
                <div className="flex items-center justify-between text-xs text-muted mb-1">
                  <span>Search radius</span>
                  <span className="font-medium text-charcoal">{radiusMiles} mi</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={radiusMiles}
                  onChange={(e) => setRadiusMiles(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-stone cursor-pointer accent-terracotta"
                />
              </div>
            )}

            {!hasRoute && (
              <p className="text-xs text-muted italic">
                Add at least 2 destinations to search nearby
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { POIOverlayControls };
