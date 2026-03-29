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
const ALL_TYPES: POIType[] = ["campsite", "gym", "library"];
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── localStorage POI cache ──

interface CachedPOIEntry {
  pois: PointOfInterest[];
  timestamp: number;
}

function getStorageKey(cacheKey: string): string {
  return `poi-cache:${cacheKey}`;
}

function readCache(cacheKey: string): Map<POIType, PointOfInterest[]> | null {
  try {
    const raw = localStorage.getItem(getStorageKey(cacheKey));
    if (!raw) return null;
    const entry: CachedPOIEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(getStorageKey(cacheKey));
      return null;
    }
    const map = new Map<POIType, PointOfInterest[]>();
    for (const type of ALL_TYPES) {
      map.set(type, entry.pois.filter((p) => p.type === type));
    }
    return map;
  } catch {
    return null;
  }
}

function writeCache(cacheKey: string, pois: PointOfInterest[]) {
  try {
    const entry: CachedPOIEntry = { pois, timestamp: Date.now() };
    localStorage.setItem(getStorageKey(cacheKey), JSON.stringify(entry));
    // Evict old cache entries (keep only the 5 most recent)
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("poi-cache:")) keys.push(key);
    }
    if (keys.length > 5) {
      const toEvict = keys
        .map((k) => {
          try {
            const e: CachedPOIEntry = JSON.parse(localStorage.getItem(k) || "");
            return { key: k, ts: e.timestamp };
          } catch {
            return { key: k, ts: 0 };
          }
        })
        .sort((a, b) => a.ts - b.ts)
        .slice(0, keys.length - 5);
      for (const { key } of toEvict) localStorage.removeItem(key);
    }
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

// ── Component ──

function POIOverlayControls({
  destinations,
  routes,
  onPoisChange,
}: POIOverlayControlsProps) {
  const [activeTypes, setActiveTypes] = useState<Set<POIType>>(new Set());
  const [radiusMiles, setRadiusMiles] = useState(15);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // In-memory cache (mirrors localStorage for the current session)
  const cacheRef = useRef<Map<POIType, PointOfInterest[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const cacheKeyRef = useRef<string>("");

  const hasRoute = routes.length > 0;

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

  // Cache key: round coords to 3 decimal places (~111m) to avoid cache misses from tiny GPS drift
  const currentCacheKey = `${routeCoordinates.map(([a, b]) => `${a.toFixed(3)},${b.toFixed(3)}`).join("|")}@${radiusMiles}`;

  // Prefetch ALL POI types whenever route or radius changes
  useEffect(() => {
    if (!hasRoute || routeCoordinates.length < 2) {
      cacheRef.current.clear();
      cacheKeyRef.current = "";
      return;
    }

    if (cacheKeyRef.current === currentCacheKey) return;

    // Check localStorage first
    const stored = readCache(currentCacheKey);
    if (stored) {
      cacheRef.current = stored;
      cacheKeyRef.current = currentCacheKey;
      const visible = ALL_TYPES
        .filter((t) => activeTypes.has(t))
        .flatMap((t) => stored.get(t) || []);
      onPoisChange(visible);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const prefetch = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/overpass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coordinates: routeCoordinates,
            radius: Math.round(radiusMiles * MILES_TO_METERS),
            types: ALL_TYPES,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("POI fetch failed");

        const data = await res.json();
        if (!controller.signal.aborted) {
          const allPois: PointOfInterest[] = data.pois || [];

          // Populate in-memory cache
          const newCache = new Map<POIType, PointOfInterest[]>();
          for (const type of ALL_TYPES) {
            newCache.set(type, allPois.filter((p: PointOfInterest) => p.type === type));
          }
          cacheRef.current = newCache;
          cacheKeyRef.current = currentCacheKey;

          // Persist to localStorage
          writeCache(currentCacheKey, allPois);

          // Update visible POIs
          const visible = ALL_TYPES
            .filter((t) => activeTypes.has(t))
            .flatMap((t) => newCache.get(t) || []);
          onPoisChange(visible);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to prefetch POIs:", err);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    const timer = setTimeout(prefetch, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [hasRoute, currentCacheKey]);

  // When toggles change, just filter from cache — no network request
  useEffect(() => {
    if (!cacheRef.current.size) {
      onPoisChange([]);
      return;
    }

    const visible = ALL_TYPES
      .filter((t) => activeTypes.has(t))
      .flatMap((t) => cacheRef.current.get(t) || []);
    onPoisChange(visible);
  }, [activeTypes]);

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
