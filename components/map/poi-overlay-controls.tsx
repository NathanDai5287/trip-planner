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

const MILES_TO_METERS = 1609.34;

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
        id: String(f.properties.id ?? f.properties.slug ?? i),
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

// ── Bbox helpers ──────────────────────────────────────────────────────────────

function metersToDegLat(m: number) { return m / 111_320; }
function metersToDegLng(m: number, lat: number) {
  return m / (111_320 * Math.cos((lat * Math.PI) / 180));
}

function computeBbox(
  coords: [number, number][],
  radiusMeters: number,
): [number, number, number, number] {
  const lats = coords.map(([lat]) => lat);
  const lngs = coords.map(([, lng]) => lng);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const padLat = metersToDegLat(radiusMeters);
  const padLng = metersToDegLng(radiusMeters, centerLat);
  return [
    Math.min(...lats) - padLat,
    Math.min(...lngs) - padLng,
    Math.max(...lats) + padLat,
    Math.max(...lngs) + padLng,
  ];
}

function filterByBbox(
  pois: PointOfInterest[],
  bbox: [number, number, number, number],
): PointOfInterest[] {
  const [south, west, north, east] = bbox;
  return pois.filter((p) => p.lat >= south && p.lat <= north && p.lng >= west && p.lng <= east);
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
  const [radiusMiles, setRadiusMiles] = useState(15);

  // Per-type filtered results and the bbox key they were computed for
  const filteredRef = useRef<Record<DatasetKey, PointOfInterest[]>>({ gym: [], library: [], peak: [] });
  const bboxKeyRef = useRef<string>("");

  const hasRoute = destinations.length >= 2;

  const routeCoordinates: [number, number][] = [...destinations]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((d) => [d.lat, d.lng]);

  const currentBboxKey = `${routeCoordinates.map(([a, b]) => `${a.toFixed(3)},${b.toFixed(3)}`).join("|")}@${radiusMiles}`;

  const toggleType = useCallback((type: POIType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const emitVisible = useCallback(
    (active: Set<POIType>) => {
      const visible: PointOfInterest[] = [];
      for (const type of (["gym", "library", "peak"] as DatasetKey[])) {
        if (active.has(type)) visible.push(...filteredRef.current[type]);
      }
      onPoisChange(visible);
    },
    [onPoisChange],
  );

  // Refilter both datasets whenever route/radius changes
  useEffect(() => {
    if (!hasRoute || routeCoordinates.length < 2) {
      filteredRef.current = { gym: [], library: [], peak: [] };
      bboxKeyRef.current = "";
      emitVisible(activeTypes);
      return;
    }

    if (bboxKeyRef.current === currentBboxKey) return;

    const radiusMeters = Math.round(radiusMiles * MILES_TO_METERS);
    const bbox = computeBbox(routeCoordinates, radiusMeters);
    const key = currentBboxKey;

    for (const type of (["gym", "library", "peak"] as DatasetKey[])) {
      if (_datasets[type]) {
        filteredRef.current[type] = filterByBbox(_datasets[type]!, bbox);
        bboxKeyRef.current = key;
        emitVisible(activeTypes);
      } else {
        loadDataset(type).then((all) => {
          filteredRef.current[type] = filterByBbox(all, bbox);
          bboxKeyRef.current = key;
          emitVisible(activeTypes);
        });
      }
    }
  }, [hasRoute, currentBboxKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-emit when active types change
  useEffect(() => {
    emitVisible(activeTypes);
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
