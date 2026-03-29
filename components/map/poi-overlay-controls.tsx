"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Dumbbell, BookOpen, MapPin, Loader2, Mountain } from "lucide-react";
import type { POIType, PointOfInterest } from "@/lib/types";
import type { RouteSegment } from "@/lib/types";
import type { Destination } from "@/lib/types";

interface POIOverlayControlsProps {
  destinations: Destination[];
  routes: RouteSegment[];
  onPoisChange: (pois: PointOfInterest[]) => void;
  showPublicLands: boolean;
  onPublicLandsChange: (show: boolean) => void;
  publicLandsLoading: boolean;
}

const POI_OPTIONS: { type: POIType; label: string; icon: typeof Dumbbell; color: string }[] = [
  { type: "gym",     label: "Gyms",      icon: Dumbbell,  color: "text-blue-600" },
  { type: "library", label: "Libraries", icon: BookOpen,   color: "text-orange-600" },
  { type: "peak",    label: "Peaks",     icon: Mountain,   color: "text-emerald-700" },
];

// ── Static dataset loaders (module-level, fetched once per session) ───────────

type DatasetKey = "gym" | "library" | "peak";

const DATASET_URLS: Record<DatasetKey, string> = {
  gym:     "/data/planet_fitness.geojson",
  library: "/data/libraries.geojson",
  peak:    "/data/peaks.geojson",
};

const _datasets: Partial<Record<DatasetKey, PointOfInterest[]>> = {};
const _fetches: Partial<Record<DatasetKey, Promise<PointOfInterest[]>>> = {};

function loadDataset(type: DatasetKey): Promise<PointOfInterest[]> {
  if (_datasets[type]) return Promise.resolve(_datasets[type]!);
  if (_fetches[type]) return _fetches[type]!;

  _fetches[type] = fetch(DATASET_URLS[type])
    .then((r) => r.json())
    .then((data) => {
      _datasets[type] = (data.features as {
        geometry: { coordinates: [number, number] };
        properties: Record<string, unknown>;
      }[]).map((f, i) => ({
        id: `${type}-${i}`,  // index guarantees uniqueness for React keys
        name: String(f.properties.name),
        type,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        tags: Object.fromEntries(
          Object.entries(f.properties).map(([k, v]) => [k, String(v ?? "")])
        ),
      }));
      return _datasets[type]!;
    });
  return _fetches[type]!;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Extract [lat, lng] sample from route geometry (max ~300 points for performance)
function sampleRoutePoints(routes: RouteSegment[]): [number, number][] {
  const all: [number, number][] = [];
  for (const seg of routes) {
    for (const [lng, lat] of seg.geometry) all.push([lat, lng]);
  }
  if (all.length <= 300) return all;
  const step = Math.ceil(all.length / 300);
  return all.filter((_, i) => i % step === 0);
}

function computeBbox(
  points: [number, number][], // [lat, lng]
  radiusKm: number,
): [number, number, number, number] {
  const lats = points.map(([lat]) => lat);
  const lngs = points.map(([, lng]) => lng);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const padLat = radiusKm / 111.32;
  const padLng = radiusKm / (111.32 * Math.cos(centerLat * Math.PI / 180));
  return [
    Math.min(...lats) - padLat,
    Math.min(...lngs) - padLng,
    Math.max(...lats) + padLat,
    Math.max(...lngs) + padLng,
  ];
}

// First bbox pre-filter, then exact distance check against sampled route points
function filterNearRoute(
  pois: PointOfInterest[],
  bbox: [number, number, number, number],
  routePoints: [number, number][], // [lat, lng]
  radiusKm: number,
): PointOfInterest[] {
  const [south, west, north, east] = bbox;
  return pois.filter((p) => {
    if (p.lat < south || p.lat > north || p.lng < west || p.lng > east) return false;
    return routePoints.some(([lat, lng]) => haversineKm(p.lat, p.lng, lat, lng) <= radiusKm);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

function POIOverlayControls({
  destinations,
  routes,
  onPoisChange,
  showPublicLands,
  onPublicLandsChange,
  publicLandsLoading,
}: POIOverlayControlsProps) {
  const [activeTypes, setActiveTypes] = useState<Set<POIType>>(new Set());
  const activeTypesRef = useRef<Set<POIType>>(new Set());
  const [radiusMiles, setRadiusMiles] = useState(15);

  // Per-type filtered results and the bbox key they were computed for
  const filteredRef = useRef<Record<DatasetKey, PointOfInterest[]>>({ gym: [], library: [], peak: [] });
  const bboxKeyRef = useRef<string>("");

  // Keep ref in sync so async callbacks always read the latest activeTypes
  useEffect(() => { activeTypesRef.current = activeTypes; }, [activeTypes]);

  const hasRoute = destinations.length >= 2;

  // Use actual route geometry points for accurate corridor filtering.
  // Falls back to destination endpoints while routes are still loading.
  const routePoints: [number, number][] = routes.length > 0
    ? sampleRoutePoints(routes)
    : [...destinations].sort((a, b) => a.sortOrder - b.sortOrder).map((d) => [d.lat, d.lng]);

  const routeKey = routes.map((r) => `${r.fromId}-${r.toId}`).join("|");
  const currentBboxKey = `${routeKey}@${radiusMiles}`;

  const toggleType = useCallback((type: POIType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const emitVisible = useCallback(
    () => {
      const visible: PointOfInterest[] = [];
      for (const type of (["gym", "library", "peak"] as DatasetKey[])) {
        if (activeTypesRef.current.has(type)) visible.push(...filteredRef.current[type]);
      }
      onPoisChange(visible);
    },
    [onPoisChange],
  );

  // Refilter all datasets whenever route or radius changes
  useEffect(() => {
    if (!hasRoute || routePoints.length === 0) {
      filteredRef.current = { gym: [], library: [], peak: [] };
      bboxKeyRef.current = "";
      emitVisible();
      return;
    }

    if (bboxKeyRef.current === currentBboxKey) return;

    const radiusKm = radiusMiles * 1.60934;
    const bbox = computeBbox(routePoints, radiusKm);
    const pts = routePoints; // stable ref for async closures
    const key = currentBboxKey;

    for (const type of (["gym", "library", "peak"] as DatasetKey[])) {
      if (_datasets[type]) {
        filteredRef.current[type] = filterNearRoute(_datasets[type]!, bbox, pts, radiusKm);
        bboxKeyRef.current = key;
        emitVisible();
      } else {
        loadDataset(type).then((all) => {
          filteredRef.current[type] = filterNearRoute(all, bbox, pts, radiusKm);
          bboxKeyRef.current = key;
          emitVisible();
        });
      }
    }
  }, [hasRoute, currentBboxKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-emit when active types change
  useEffect(() => {
    emitVisible();
  }, [activeTypes, emitVisible]);

  return (
    <div className="absolute bottom-4 left-4 z-10 w-52">
      <div className="bg-cream rounded-xl border border-border shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-stone-light">
          <span className="text-sm font-semibold text-charcoal">Map Layers</span>
        </div>

        <div className="px-4 py-3 space-y-4">

          {/* Public Lands */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Camping</p>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={showPublicLands}
                onChange={(e) => onPublicLandsChange(e.target.checked)}
                className="rounded border-border text-terracotta focus:ring-terracotta/20"
              />
              <span className="flex items-center gap-2 text-sm text-charcoal">
                {publicLandsLoading
                  ? <Loader2 size={15} className="text-green-700 animate-spin" />
                  : <MapPin size={15} className="text-green-700" />
                }
                Public Lands
              </span>
            </label>
            <p className="mt-1 ml-7 text-xs text-muted leading-snug">
              BLM &amp; USFS — free dispersed camping
            </p>
          </div>

          {/* POIs */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Nearby</p>
            <div className="space-y-2">
              {POI_OPTIONS.map(({ type, label, icon: Icon, color }) => (
                <label key={type} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeTypes.has(type)}
                    onChange={() => toggleType(type)}
                    disabled={!hasRoute}
                    className="rounded border-border text-terracotta focus:ring-terracotta/20 disabled:opacity-40"
                  />
                  <span className={`flex items-center gap-2 text-sm text-charcoal ${!hasRoute ? "opacity-40" : ""}`}>
                    <Icon size={15} className={color} />
                    {label}
                  </span>
                </label>
              ))}
            </div>

            {/* Radius slider */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted mb-1.5">
                <span>Search radius</span>
                <span className="font-medium text-charcoal">{radiusMiles} mi</span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(Number(e.target.value))}
                disabled={!hasRoute}
                className="w-full h-1.5 rounded-full appearance-none bg-stone cursor-pointer accent-terracotta disabled:opacity-40"
              />
            </div>

            {!hasRoute && (
              <p className="mt-2 text-xs text-muted italic">
                Add 2+ destinations to search nearby
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export { POIOverlayControls };
