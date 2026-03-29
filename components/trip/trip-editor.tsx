"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Trip, Destination, PointOfInterest, BudgetData, PackingItem } from "@/lib/types";
import { DEFAULT_BUDGET } from "@/lib/types";
import { Map as MapIcon, PanelLeftClose, MapPin, Calculator, CheckSquare } from "lucide-react";
import { BudgetPanel } from "./budget-panel";
import { PackingPanel } from "./packing-panel";
import toast from "react-hot-toast";
import { decodePolyline } from "@/lib/polyline";
import {
  addDay as firestoreAddDay,
  removeDay as firestoreRemoveDay,
  insertDayBefore as firestoreInsertDayBefore,
  addDestination,
} from "@/lib/firestore";
import { TripTitle } from "./trip-title";
import { PlaceSearch } from "./place-search";
import { DestinationList } from "./destination-list";
import { TripActions } from "./trip-actions";
import { TotalDriveTime } from "./total-drive-time";
import { TripMap } from "@/components/map/trip-map";

export type RouteSegment = {
  fromId: string;
  toId: string;
  duration: number; // seconds
  distance: number; // meters
  geometry: [number, number][];
};

interface TripEditorProps {
  trip: Trip;
}

function TripEditor({ trip }: TripEditorProps) {
  const [destinations, setDestinations] = useState<Destination[]>(
    trip.destinations,
  );
  const [totalDays, setTotalDays] = useState(trip.totalDays);
  const [routes, setRoutes] = useState<RouteSegment[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeTab, setActiveTab] = useState<"itinerary" | "budget" | "packing">("itinerary");
  const [routesLoading, setRoutesLoading] = useState(false);
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const [budget, setBudget] = useState<BudgetData>(trip.budget ?? DEFAULT_BUDGET);
  const [packingList, setPackingList] = useState<PackingItem[]>(trip.packingList ?? []);
  const routeCacheRef = useRef<Map<string, RouteSegment>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const fetchRoutes = useCallback(async (dests: Destination[]) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (dests.length < 2) {
      setRoutes([]);
      setRoutesLoading(false);
      return;
    }

    setRoutesLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // Sort by sortOrder to ensure correct pairing
    const sorted = [...dests].sort((a, b) => a.sortOrder - b.sortOrder);

    const pairs: { from: Destination; to: Destination }[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      pairs.push({ from: sorted[i], to: sorted[i + 1] });
    }

    const newRoutes: RouteSegment[] = [];

    for (const pair of pairs) {
      if (controller.signal.aborted) return;

      const cacheKey = `${pair.from.id}-${pair.to.id}`;
      const cached = routeCacheRef.current.get(cacheKey);

      if (cached) {
        newRoutes.push(cached);
        continue;
      }

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

          routeCacheRef.current.set(cacheKey, segment);
          newRoutes.push(segment);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch route:", err);
      }

      if (!controller.signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!controller.signal.aborted) {
      setRoutes(newRoutes);
      setRoutesLoading(false);
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

  const handleDestinationAdded = useCallback((dest: Destination) => {
    setDestinations((prev) => [...prev, dest]);
    toast.success(`Added ${dest.name}`);
  }, []);

  const handleDestinationRemoved = useCallback((destId: string) => {
    setDestinations((prev) => prev.filter((d) => d.id !== destId));
    routeCacheRef.current.forEach((_, key) => {
      if (key.includes(destId)) {
        routeCacheRef.current.delete(key);
      }
    });
  }, []);

  const handleDestinationsReordered = useCallback((reordered: Destination[]) => {
    setDestinations(reordered);
    routeCacheRef.current.clear();
  }, []);

  const handleMarkerClick = useCallback((destId: string) => {
    setHighlightedId(destId);
    setShowSidebar(true);
  }, []);

  const handleImportDestinations = useCallback((imported: Destination[]) => {
    setDestinations(imported);
    routeCacheRef.current.clear();
  }, []);

  // Day management
  const handleAddDay = useCallback(async () => {
    const newTotal = totalDays + 1;
    setTotalDays(newTotal);
    try {
      await firestoreAddDay(trip.id);
    } catch {
      setTotalDays(totalDays);
      toast.error("Failed to add day");
    }
  }, [trip.id, totalDays]);

  const handleRemoveDay = useCallback(
    async (dayIndex: number) => {
      if (totalDays <= 1) return;

      const prevDests = destinations;
      const prevTotal = totalDays;

      // Optimistic: move destinations and shift days
      const targetDay = dayIndex > 0 ? dayIndex - 1 : 1;
      const updated = destinations.map((d) => {
        if (d.dayIndex === dayIndex) return { ...d, dayIndex: targetDay };
        if (d.dayIndex > dayIndex) return { ...d, dayIndex: d.dayIndex - 1 };
        return d;
      });
      setDestinations(updated);
      setTotalDays(totalDays - 1);

      try {
        await firestoreRemoveDay(trip.id, dayIndex);
      } catch {
        setDestinations(prevDests);
        setTotalDays(prevTotal);
        toast.error("Failed to remove day");
      }
    },
    [trip.id, destinations, totalDays],
  );

  const handleInsertDayBefore = useCallback(
    async (dayIndex: number) => {
      const prevDests = destinations;
      const prevTotal = totalDays;

      // Optimistic: shift destinations at or after dayIndex up by 1
      const updated = destinations.map((d) => {
        if (d.dayIndex >= dayIndex) return { ...d, dayIndex: d.dayIndex + 1 };
        return d;
      });
      setDestinations(updated);
      setTotalDays(totalDays + 1);

      try {
        await firestoreInsertDayBefore(trip.id, dayIndex);
      } catch {
        setDestinations(prevDests);
        setTotalDays(prevTotal);
        toast.error("Failed to insert day");
      }
    },
    [trip.id, destinations, totalDays],
  );

  // POI overlay: add POI as destination
  const handleAddPOI = useCallback(
    async (poi: PointOfInterest) => {
      try {
        const dest = await addDestination(trip.id, {
          name: poi.name,
          address: `${poi.type === "gym" ? "Gym" : "Library"} — ${poi.name}`,
          lat: poi.lat,
          lng: poi.lng,
        });
        setDestinations((prev) => [...prev, dest]);
        toast.success(`Added ${poi.name}`);
      } catch {
        toast.error("Failed to add destination");
      }
    },
    [trip.id],
  );

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Mobile sidebar toggle */}
      <button
        type="button"
        onClick={() => setShowSidebar((v) => !v)}
        className="lg:hidden fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-terracotta text-white shadow-lg hover:bg-terracotta-dark transition-colors cursor-pointer"
        aria-label={showSidebar ? "Hide sidebar" : "Show sidebar"}
      >
        {showSidebar ? <PanelLeftClose size={20} /> : <MapIcon size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          ${showSidebar ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 transition-transform duration-300 ease-in-out
          fixed lg:relative inset-y-0 left-0 top-16 lg:top-0 z-30
          w-full sm:w-[400px] lg:w-[400px] flex-shrink-0
          flex flex-col bg-cream border-r border-border
          overflow-hidden
        `}
      >
        <div className="flex flex-col h-full overflow-hidden">
          <div className="px-5 pt-5 pb-0">
            <TripTitle tripId={trip.id} initialTitle={trip.title} />
          </div>

          {/* Tab bar */}
          <div className="px-5 mt-3 border-b border-border">
            <nav className="flex gap-0 -mb-px">
              {([
                { id: "itinerary", label: "Itinerary", icon: MapPin },
                { id: "budget",    label: "Budget",    icon: Calculator },
                { id: "packing",   label: "Packing",   icon: CheckSquare },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer
                    ${activeTab === id
                      ? "border-terracotta text-terracotta"
                      : "border-transparent text-muted hover:text-charcoal hover:border-border"
                    }
                  `}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-5 pb-3">
            {activeTab === "itinerary" && (
              <>
                <div className="pt-3 pb-3">
                  <PlaceSearch
                    tripId={trip.id}
                    onDestinationAdded={handleDestinationAdded}
                  />
                </div>
                <DestinationList
                  tripId={trip.id}
                  destinations={destinations}
                  routes={routes}
                  routesLoading={routesLoading}
                  totalDays={totalDays}
                  highlightedId={highlightedId}
                  onReorder={handleDestinationsReordered}
                  onRemove={handleDestinationRemoved}
                  onHighlight={setHighlightedId}
                  onAddDay={handleAddDay}
                  onRemoveDay={handleRemoveDay}
                  onInsertDayBefore={handleInsertDayBefore}
                />
              </>
            )}
            {activeTab === "budget" && (
              <BudgetPanel
                tripId={trip.id}
                budget={budget}
                totalDays={totalDays}
                routes={routes}
                onChange={setBudget}
              />
            )}
            {activeTab === "packing" && (
              <PackingPanel
                tripId={trip.id}
                items={packingList}
                onChange={setPackingList}
              />
            )}
          </div>

          <div className="border-t border-border px-5 py-3 space-y-2">
            {activeTab === "itinerary" && (
              <TotalDriveTime routes={routes} destinationCount={destinations.length} />
            )}
            <TripActions
              trip={trip}
              destinations={destinations}
              onImportComplete={handleImportDestinations}
            />
          </div>
        </div>
      </aside>

      {showSidebar && (
        <div
          className="lg:hidden fixed inset-0 top-16 z-20 bg-charcoal/40 backdrop-blur-sm"
          onClick={() => setShowSidebar(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 relative">
        <TripMap
          destinations={destinations}
          routes={routes}
          highlightedId={highlightedId}
          onMarkerClick={handleMarkerClick}
          pois={pois}
          onPoisChange={setPois}
          onAddPOI={handleAddPOI}
        />
      </div>
    </div>
  );
}

export { TripEditor };
