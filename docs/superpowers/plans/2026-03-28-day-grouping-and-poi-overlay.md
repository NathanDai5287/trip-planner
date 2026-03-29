# Day Grouping & POI Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add day-based destination grouping with drag-and-drop between days, and a map overlay showing free campsites, gym chains, and libraries along the route via the Overpass API.

**Architecture:** Two independent features sharing the same data layer. Day grouping adds a `dayIndex` field to destinations and `totalDays` to trips, with the destination list rendering grouped sections. POI overlay adds a new `/api/overpass` proxy route and a map control panel with toggle checkboxes and a radius slider, rendering results as clickable markers with "Add to Trip" popups.

**Tech Stack:** Next.js 16, React 19, Firestore, MapLibre GL via react-map-gl, @dnd-kit, Overpass API (OSM), Tailwind CSS 4, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-03-28-day-grouping-and-poi-overlay-design.md`

---

## File Structure

### New Files
- `app/api/overpass/route.ts` — Overpass API proxy route with rate limiting
- `components/map/poi-overlay-controls.tsx` — Toggle checkboxes + radius slider control panel
- `components/map/poi-popup.tsx` — Popup content for POI markers with "Add to Trip" button
- `components/trip/day-header.tsx` — Day section header with delete/insert buttons

### Modified Files
- `lib/types.ts` — Add `dayIndex` to `Destination`, `totalDays` to `Trip`, new `PointOfInterest` type
- `lib/firestore.ts` — Update `createTrip`, `addDestination`, `reorderDestinations`; add `addDay`, `removeDay`, `insertDayBefore`
- `lib/export.ts` — Include `dayIndex` in export
- `lib/import-schema.ts` — Accept optional `dayIndex` in import
- `components/trip/destination-list.tsx` — Group by `dayIndex`, multi-container dnd-kit, per-day subtotals, cross-day drive times
- `components/trip/trip-editor.tsx` — Manage `totalDays`, day callbacks, POI overlay state, pass POI props to map
- `components/map/trip-map.tsx` — Render POI markers, popups, accept POI props
- `components/trip/place-search.tsx` — Pass `totalDays` to `addDestination` for correct `dayIndex`
- `components/trip/shared-trip-view.tsx` — Group shared view destinations by day

---

## Task 1: Update Data Model (`lib/types.ts`)

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add `dayIndex` to `Destination`, `totalDays` to `Trip`, and new `PointOfInterest` type**

Replace the entire contents of `lib/types.ts` with:

```typescript
export interface Destination {
  id: string;
  osmId: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
  notes: string;
  sortOrder: number;
  dayIndex: number;
}

export interface Trip {
  id: string;
  title: string;
  description: string | null;
  shareSlug: string | null;
  isPublic: boolean;
  userId: string;
  destinations: Destination[];
  totalDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PointOfInterest {
  id: string;
  name: string;
  type: "campsite" | "gym" | "library";
  lat: number;
  lng: number;
  tags: Record<string, string>;
}

export type POIType = PointOfInterest["type"];
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add dayIndex, totalDays, and PointOfInterest to data model"
```

---

## Task 2: Update Firestore Layer (`lib/firestore.ts`)

**Files:**
- Modify: `lib/firestore.ts`

- [ ] **Step 1: Update `tripFromDoc` to handle backward-compatible defaults**

In `lib/firestore.ts`, replace the `tripFromDoc` function (lines 18–30) with:

```typescript
function tripFromDoc(id: string, data: Record<string, unknown>): Trip {
  const rawDestinations = (data.destinations as Destination[]) || [];
  return {
    id,
    title: data.title as string,
    description: (data.description as string) || null,
    shareSlug: (data.shareSlug as string) || null,
    isPublic: (data.isPublic as boolean) || false,
    userId: data.userId as string,
    destinations: rawDestinations.map((d) => ({
      ...d,
      dayIndex: d.dayIndex ?? 0,
    })),
    totalDays: (data.totalDays as number) ?? 1,
    createdAt: (data.createdAt as { toDate(): Date })?.toDate?.() || new Date(),
    updatedAt: (data.updatedAt as { toDate(): Date })?.toDate?.() || new Date(),
  };
}
```

- [ ] **Step 2: Update `createTrip` to include `totalDays: 1`**

Replace the `createTrip` function (lines 34–50) with:

```typescript
export async function createTrip(
  userId: string,
  title: string,
  description: string | null,
): Promise<string> {
  const docRef = await addDoc(collection(db, "trips"), {
    title,
    description,
    shareSlug: null,
    isPublic: false,
    userId,
    destinations: [],
    totalDays: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}
```

- [ ] **Step 3: Update `addDestination` to set `dayIndex` to the last day**

Replace the `addDestination` function (lines 114–138) with:

```typescript
export async function addDestination(
  tripId: string,
  data: { osmId?: string; name: string; address: string; lat: number; lng: number },
): Promise<Destination> {
  const trip = await getTrip(tripId);
  if (!trip) throw new Error("Trip not found");

  const newDest: Destination = {
    id: nanoid(),
    osmId: data.osmId || null,
    name: data.name,
    address: data.address,
    lat: data.lat,
    lng: data.lng,
    notes: "",
    sortOrder: trip.destinations.length,
    dayIndex: Math.max(0, trip.totalDays - 1),
  };

  await updateDoc(doc(db, "trips", tripId), {
    destinations: [...trip.destinations, newDest],
    updatedAt: serverTimestamp(),
  });

  return newDest;
}
```

- [ ] **Step 4: Update `reorderDestinations` to accept `dayIndex` updates**

Replace the `reorderDestinations` function (lines 166–184) with:

```typescript
export async function reorderDestinations(
  tripId: string,
  orderedItems: { id: string; dayIndex: number }[],
) {
  const trip = await getTrip(tripId);
  if (!trip) throw new Error("Trip not found");

  const reordered = orderedItems
    .map((item, index) => {
      const dest = trip.destinations.find((d) => d.id === item.id);
      return dest ? { ...dest, sortOrder: index, dayIndex: item.dayIndex } : null;
    })
    .filter((d): d is Destination => d !== null);

  await updateDoc(doc(db, "trips", tripId), {
    destinations: reordered,
    updatedAt: serverTimestamp(),
  });
}
```

- [ ] **Step 5: Add `addDay`, `removeDay`, and `insertDayBefore` functions**

Add at the end of `lib/firestore.ts`, before the closing of the file:

```typescript
// ── Day management ──

export async function addDay(tripId: string): Promise<number> {
  const trip = await getTrip(tripId);
  if (!trip) throw new Error("Trip not found");

  const newTotalDays = trip.totalDays + 1;
  await updateDoc(doc(db, "trips", tripId), {
    totalDays: newTotalDays,
    updatedAt: serverTimestamp(),
  });
  return newTotalDays;
}

export async function removeDay(tripId: string, dayIndex: number) {
  const trip = await getTrip(tripId);
  if (!trip) throw new Error("Trip not found");

  if (trip.totalDays <= 1) throw new Error("Cannot remove the only day");

  // Move destinations from deleted day to previous day (or next if day 0)
  const targetDay = dayIndex > 0 ? dayIndex - 1 : 1;
  const updatedDestinations = trip.destinations.map((d) => {
    if (d.dayIndex === dayIndex) {
      return { ...d, dayIndex: targetDay };
    }
    // Shift days after the removed one down by 1
    if (d.dayIndex > dayIndex) {
      return { ...d, dayIndex: d.dayIndex - 1 };
    }
    return d;
  });

  await updateDoc(doc(db, "trips", tripId), {
    destinations: updatedDestinations,
    totalDays: trip.totalDays - 1,
    updatedAt: serverTimestamp(),
  });
}

export async function insertDayBefore(tripId: string, dayIndex: number) {
  const trip = await getTrip(tripId);
  if (!trip) throw new Error("Trip not found");

  // Shift all destinations at or after dayIndex up by 1
  const updatedDestinations = trip.destinations.map((d) => {
    if (d.dayIndex >= dayIndex) {
      return { ...d, dayIndex: d.dayIndex + 1 };
    }
    return d;
  });

  await updateDoc(doc(db, "trips", tripId), {
    destinations: updatedDestinations,
    totalDays: trip.totalDays + 1,
    updatedAt: serverTimestamp(),
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/firestore.ts
git commit -m "feat: update firestore layer for day grouping support"
```

---

## Task 3: Update Export/Import for `dayIndex`

**Files:**
- Modify: `lib/export.ts`
- Modify: `lib/import-schema.ts`

- [ ] **Step 1: Include `dayIndex` in export**

Replace the entire contents of `lib/export.ts` with:

```typescript
import type { Trip } from "./types";

export function buildTripExport(trip: Trip) {
  return {
    title: trip.title,
    description: trip.description,
    totalDays: trip.totalDays,
    destinations: trip.destinations
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((d) => ({
        osmId: d.osmId || undefined,
        name: d.name,
        address: d.address,
        lat: d.lat,
        lng: d.lng,
        notes: d.notes,
        order: d.sortOrder,
        dayIndex: d.dayIndex,
      })),
    exportedAt: new Date().toISOString(),
    version: 2,
  };
}
```

- [ ] **Step 2: Accept optional `dayIndex` and `totalDays` in import**

Replace the entire contents of `lib/import-schema.ts` with:

```typescript
import { z } from "zod";

export const importDestinationSchema = z.object({
  osmId: z.string().optional(),
  name: z.string().min(1),
  address: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: z.string().optional().default(""),
  order: z.number().int().min(0),
  dayIndex: z.number().int().min(0).optional().default(0),
});

export const importTripSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  totalDays: z.number().int().min(1).optional().default(1),
  destinations: z.array(importDestinationSchema),
  exportedAt: z.string().optional(),
  version: z.number().optional(),
});

export type ImportTrip = z.infer<typeof importTripSchema>;
```

- [ ] **Step 3: Commit**

```bash
git add lib/export.ts lib/import-schema.ts
git commit -m "feat: include dayIndex in trip export/import"
```

---

## Task 4: Create Day Header Component

**Files:**
- Create: `components/trip/day-header.tsx`

- [ ] **Step 1: Create the day header component**

Create `components/trip/day-header.tsx`:

```tsx
"use client";

import { Plus, Trash2 } from "lucide-react";
import { formatDuration } from "@/lib/format-duration";

interface DayHeaderProps {
  dayIndex: number;
  dayDriveTime: number;
  destinationCount: number;
  isOnlyDay: boolean;
  onInsertDayBefore: () => void;
  onRemoveDay: () => void;
}

function DayHeader({
  dayIndex,
  dayDriveTime,
  destinationCount,
  isOnlyDay,
  onInsertDayBefore,
  onRemoveDay,
}: DayHeaderProps) {
  return (
    <div className="flex items-center gap-2 pt-3 first:pt-0 pb-1">
      <button
        type="button"
        onClick={onInsertDayBefore}
        className="shrink-0 text-muted hover:text-terracotta transition-colors cursor-pointer"
        aria-label={`Insert day before Day ${dayIndex + 1}`}
        title="Insert day before"
      >
        <Plus size={14} />
      </button>

      <div className="flex-1 flex items-center gap-2">
        <h3 className="font-display text-sm font-semibold text-charcoal tracking-wide uppercase">
          Day {dayIndex + 1}
        </h3>
        <div className="flex-1 h-px bg-border" />
        {destinationCount > 0 && dayDriveTime > 0 && (
          <span className="text-xs text-muted shrink-0">
            {formatDuration(dayDriveTime)}
          </span>
        )}
      </div>

      {!isOnlyDay && (
        <button
          type="button"
          onClick={onRemoveDay}
          className="shrink-0 text-muted hover:text-danger transition-colors cursor-pointer"
          aria-label={`Remove Day ${dayIndex + 1}`}
          title="Remove day"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

export { DayHeader };
```

- [ ] **Step 2: Commit**

```bash
git add components/trip/day-header.tsx
git commit -m "feat: add DayHeader component"
```

---

## Task 5: Rewrite Destination List with Day Grouping

**Files:**
- Modify: `components/trip/destination-list.tsx`

This is the biggest change. The list goes from a flat `SortableContext` to multiple droppable day containers.

- [ ] **Step 1: Replace `destination-list.tsx` with day-grouped version**

Replace the entire contents of `components/trip/destination-list.tsx` with:

```tsx
"use client";

import { useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import type { Destination } from "@/lib/types";
import { MapPin, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { reorderDestinations } from "@/lib/firestore";
import { DestinationCard } from "./destination-card";
import { DayHeader } from "./day-header";
import { DriveTimeBadge } from "./drive-time-badge";
import type { RouteSegment } from "./trip-editor";

interface DestinationListProps {
  tripId: string;
  destinations: Destination[];
  routes: RouteSegment[];
  totalDays: number;
  highlightedId: string | null;
  onReorder: (destinations: Destination[]) => void;
  onRemove: (destId: string) => void;
  onHighlight: (destId: string | null) => void;
  onAddDay: () => void;
  onRemoveDay: (dayIndex: number) => void;
  onInsertDayBefore: (dayIndex: number) => void;
}

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

function DestinationList({
  tripId,
  destinations,
  routes,
  totalDays,
  highlightedId,
  onReorder,
  onRemove,
  onHighlight,
  onAddDay,
  onRemoveDay,
  onInsertDayBefore,
}: DestinationListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Group destinations by day
  const dayGroups = useMemo(() => {
    const groups: Destination[][] = Array.from({ length: totalDays }, () => []);
    for (const dest of destinations) {
      const day = dest.dayIndex;
      if (day >= 0 && day < totalDays) {
        groups[day].push(dest);
      } else {
        // Fallback: put in last day
        groups[totalDays - 1].push(dest);
      }
    }
    // Sort each day's destinations by sortOrder
    for (const group of groups) {
      group.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return groups;
  }, [destinations, totalDays]);

  // Flat sorted list for dnd-kit (all destinations in display order)
  const flatSorted = useMemo(() => dayGroups.flat(), [dayGroups]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = flatSorted.findIndex((d) => d.id === active.id);
      const newIndex = flatSorted.findIndex((d) => d.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(flatSorted, oldIndex, newIndex);

      // Determine which day the destination landed in by checking neighbors
      const overDest = flatSorted[newIndex];
      const targetDayIndex = overDest.dayIndex;

      const updated = reordered.map((d, i) => ({
        ...d,
        sortOrder: i,
        dayIndex: d.id === active.id ? targetDayIndex : d.dayIndex,
      }));

      onReorder(updated);

      try {
        await reorderDestinations(
          tripId,
          updated.map((d) => ({ id: d.id, dayIndex: d.dayIndex })),
        );
      } catch {
        onReorder(destinations);
        toast.error("Failed to reorder destinations");
      }
    },
    [flatSorted, destinations, tripId, onReorder],
  );

  function getDriveTime(fromId: string, toId: string): number | null {
    const route = routes.find((r) => r.fromId === fromId && r.toId === toId);
    return route ? route.duration : null;
  }

  function getDayDriveTime(dayDests: Destination[]): number {
    let total = 0;
    for (let i = 0; i < dayDests.length - 1; i++) {
      const time = getDriveTime(dayDests[i].id, dayDests[i + 1].id);
      if (time) total += time;
    }
    return total;
  }

  // Compute running index for continuous numbering
  let runningIndex = 0;

  if (destinations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone">
          <MapPin size={24} className="text-muted" />
        </div>
        <p className="text-sm font-medium text-charcoal mb-1">
          No destinations yet
        </p>
        <p className="text-xs text-muted max-w-[200px]">
          Search for a place above to start planning your trip
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={flatSorted.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-1">
          {dayGroups.map((dayDests, dayIndex) => {
            const dayStartIndex = runningIndex;
            runningIndex += dayDests.length;

            // Cross-day drive time: from last dest of previous day to first of this day
            const prevDay = dayIndex > 0 ? dayGroups[dayIndex - 1] : null;
            const crossDayTime =
              prevDay && prevDay.length > 0 && dayDests.length > 0
                ? getDriveTime(
                    prevDay[prevDay.length - 1].id,
                    dayDests[0].id,
                  )
                : null;

            return (
              <div key={dayIndex}>
                {/* Cross-day drive time */}
                {crossDayTime !== null && (
                  <div className="flex justify-center py-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-stone/60 px-2 py-0.5 text-xs text-muted/70 italic">
                      <DriveTimeBadge seconds={crossDayTime} />
                    </span>
                  </div>
                )}

                <DayHeader
                  dayIndex={dayIndex}
                  dayDriveTime={getDayDriveTime(dayDests)}
                  destinationCount={dayDests.length}
                  isOnlyDay={totalDays <= 1}
                  onInsertDayBefore={() => onInsertDayBefore(dayIndex)}
                  onRemoveDay={() => onRemoveDay(dayIndex)}
                />

                <div className="flex flex-col gap-2 ml-1">
                  {dayDests.map((dest, i) => {
                    const globalIndex = dayStartIndex + i;
                    const nextDest = dayDests[i + 1];
                    const driveTimeToNext = nextDest
                      ? getDriveTime(dest.id, nextDest.id)
                      : null;

                    return (
                      <DestinationCard
                        key={dest.id}
                        destination={dest}
                        tripId={tripId}
                        index={globalIndex}
                        driveTimeToNext={driveTimeToNext}
                        isHighlighted={highlightedId === dest.id}
                        onRemove={onRemove}
                        onHighlight={onHighlight}
                      />
                    );
                  })}
                  {dayDests.length === 0 && (
                    <p className="text-xs text-muted italic py-2 pl-2">
                      No stops planned for this day
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add Day button */}
          <button
            type="button"
            onClick={onAddDay}
            className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-xs text-muted hover:text-terracotta hover:border-terracotta/40 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Add Day
          </button>
        </div>
      </SortableContext>
    </DndContext>
  );
}

export { DestinationList };
```

- [ ] **Step 2: Commit**

```bash
git add components/trip/destination-list.tsx
git commit -m "feat: rewrite destination list with day grouping"
```

---

## Task 6: Update Trip Editor for Day Management

**Files:**
- Modify: `components/trip/trip-editor.tsx`

- [ ] **Step 1: Add day management state and callbacks, pass new props to DestinationList**

Replace the entire contents of `components/trip/trip-editor.tsx` with:

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Trip, Destination, PointOfInterest } from "@/lib/types";
import { Map as MapIcon, PanelLeftClose, PanelLeft } from "lucide-react";
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
  duration: number;
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
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const routeCacheRef = useRef<Map<string, RouteSegment>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

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
          address: `${poi.type === "campsite" ? "Campsite" : poi.type === "gym" ? "Gym" : "Library"} — ${poi.name}`,
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
        <button
          type="button"
          onClick={() => setShowSidebar((v) => !v)}
          className="hidden lg:flex absolute top-3 right-3 z-10 h-8 w-8 items-center justify-center rounded-md text-muted hover:text-charcoal hover:bg-stone-light transition-colors cursor-pointer"
          aria-label="Toggle sidebar"
        >
          {showSidebar ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>

        <div className="flex flex-col h-full overflow-hidden">
          <div className="px-5 pt-5 pb-2">
            <TripTitle tripId={trip.id} initialTitle={trip.title} />
          </div>

          <div className="px-5 pb-3">
            <PlaceSearch
              tripId={trip.id}
              onDestinationAdded={handleDestinationAdded}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-3">
            <DestinationList
              tripId={trip.id}
              destinations={destinations}
              routes={routes}
              totalDays={totalDays}
              highlightedId={highlightedId}
              onReorder={handleDestinationsReordered}
              onRemove={handleDestinationRemoved}
              onHighlight={setHighlightedId}
              onAddDay={handleAddDay}
              onRemoveDay={handleRemoveDay}
              onInsertDayBefore={handleInsertDayBefore}
            />
          </div>

          <div className="border-t border-border px-5 py-4 space-y-3">
            <TotalDriveTime
              routes={routes}
              destinationCount={destinations.length}
            />
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
```

- [ ] **Step 2: Commit**

```bash
git add components/trip/trip-editor.tsx
git commit -m "feat: add day management and POI state to trip editor"
```

---

## Task 7: Create Overpass API Route

**Files:**
- Create: `app/api/overpass/route.ts`

- [ ] **Step 1: Create the Overpass proxy API route**

Create `app/api/overpass/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

let lastOverpassRequest = 0;

type POIType = "campsite" | "gym" | "library";

function buildOverpassQuery(
  coordinates: [number, number][],
  radius: number,
  types: POIType[],
): string {
  const coordStr = coordinates.map(([lat, lng]) => `${lat},${lng}`).join(",");

  const queries: string[] = [];

  for (const type of types) {
    switch (type) {
      case "campsite":
        queries.push(
          `node["tourism"="camp_site"]["fee"="no"](around:${radius},${coordStr});`,
          `node["tourism"="camp_site"]["fee:conditional"](around:${radius},${coordStr});`,
          `node["tourism"="camp_site"][!"fee"](around:${radius},${coordStr});`,
        );
        break;
      case "gym":
        queries.push(
          `node["leisure"="fitness_centre"]["name"~"Planet Fitness|24 Hour Fitness|Anytime Fitness",i](around:${radius},${coordStr});`,
        );
        break;
      case "library":
        queries.push(
          `node["amenity"="library"](around:${radius},${coordStr});`,
        );
        break;
    }
  }

  return `[out:json][timeout:25];\n(\n  ${queries.join("\n  ")}\n);\nout body;`;
}

function simplifyCoordinates(
  coords: [number, number][],
  maxPoints: number,
): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const result: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  return result;
}

export async function POST(request: NextRequest) {
  let body: { coordinates: [number, number][]; radius: number; types: POIType[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { coordinates, radius, types } = body;

  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
    return NextResponse.json(
      { error: "At least 2 coordinates required" },
      { status: 400 },
    );
  }
  if (!types || !Array.isArray(types) || types.length === 0) {
    return NextResponse.json(
      { error: "At least one POI type required" },
      { status: 400 },
    );
  }
  if (typeof radius !== "number" || radius <= 0) {
    return NextResponse.json(
      { error: "Valid radius required" },
      { status: 400 },
    );
  }

  // Rate limit: 1 request per second
  const now = Date.now();
  const elapsed = now - lastOverpassRequest;
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastOverpassRequest = Date.now();

  const simplified = simplifyCoordinates(coordinates, 25);
  const query = buildOverpassQuery(simplified, radius, types);

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Wayfinder-TripPlanner/1.0 (educational-project)",
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Overpass API request failed" },
        { status: 502 },
      );
    }

    const data = await response.json();

    // Transform OSM elements to our POI format
    const pois = (data.elements || [])
      .filter((el: { lat?: number; lon?: number }) => el.lat && el.lon)
      .map((el: { id: number; lat: number; lon: number; tags?: Record<string, string> }) => {
        const tags = el.tags || {};
        let type: POIType;
        if (tags.tourism === "camp_site") {
          type = "campsite";
        } else if (tags.leisure === "fitness_centre") {
          type = "gym";
        } else {
          type = "library";
        }

        return {
          id: String(el.id),
          name: tags.name || (type === "campsite" ? "Campsite" : type === "gym" ? "Gym" : "Library"),
          type,
          lat: el.lat,
          lng: el.lon,
          tags,
        };
      });

    return NextResponse.json({ pois });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch POIs" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/overpass/route.ts
git commit -m "feat: add Overpass API proxy route for POI search"
```

---

## Task 8: Create POI Overlay Controls Component

**Files:**
- Create: `components/map/poi-overlay-controls.tsx`

- [ ] **Step 1: Create the toggle/slider control panel**

Create `components/map/poi-overlay-controls.tsx`:

```tsx
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
  // Note: routeCoordinates.length is used as a proxy for route changes to avoid
  // recreating the effect on every render. The full coordinates are read inside the effect.

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
```

- [ ] **Step 2: Commit**

```bash
git add components/map/poi-overlay-controls.tsx
git commit -m "feat: add POI overlay toggle controls with radius slider"
```

---

## Task 9: Create POI Popup Component

**Files:**
- Create: `components/map/poi-popup.tsx`

- [ ] **Step 1: Create the popup component for POI markers**

Create `components/map/poi-popup.tsx`:

```tsx
"use client";

import { Tent, Dumbbell, BookOpen, Plus } from "lucide-react";
import type { PointOfInterest } from "@/lib/types";

interface POIPopupProps {
  poi: PointOfInterest;
  onAddToTrip: (poi: PointOfInterest) => void;
}

const TYPE_CONFIG = {
  campsite: { icon: Tent, color: "text-green-600", label: "Campsite" },
  gym: { icon: Dumbbell, color: "text-blue-600", label: "Gym" },
  library: { icon: BookOpen, color: "text-orange-600", label: "Library" },
} as const;

function POIPopup({ poi, onAddToTrip }: POIPopupProps) {
  const config = TYPE_CONFIG[poi.type];
  const Icon = config.icon;

  const openingHours = poi.tags.opening_hours;
  const brand = poi.tags.brand;
  const phone = poi.tags.phone;
  const website = poi.tags.website;

  return (
    <div className="min-w-[180px] max-w-[240px]">
      <div className="flex items-start gap-2 mb-2">
        <Icon size={16} className={`${config.color} shrink-0 mt-0.5`} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-charcoal leading-tight">
            {poi.name}
          </p>
          <p className="text-xs text-muted mt-0.5">{config.label}</p>
        </div>
      </div>

      <div className="space-y-1 text-xs text-muted">
        {brand && <p>Brand: {brand}</p>}
        {openingHours && <p>Hours: {openingHours}</p>}
        {phone && <p>Phone: {phone}</p>}
        {website && (
          <p className="truncate">
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-terracotta hover:underline"
            >
              Website
            </a>
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onAddToTrip(poi)}
        className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-md bg-terracotta text-white text-xs font-medium py-1.5 hover:bg-terracotta-dark transition-colors cursor-pointer"
      >
        <Plus size={12} />
        Add to Trip
      </button>
    </div>
  );
}

export { POIPopup };
```

- [ ] **Step 2: Commit**

```bash
git add components/map/poi-popup.tsx
git commit -m "feat: add POI popup component with add-to-trip button"
```

---

## Task 10: Update Trip Map with POI Markers and Controls

**Files:**
- Modify: `components/map/trip-map.tsx`

- [ ] **Step 1: Add POI markers, popups, and overlay controls to the map**

Replace the entire contents of `components/map/trip-map.tsx` with:

```tsx
"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import {
  Map,
  Marker,
  Popup,
  Source,
  Layer,
  NavigationControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Tent, Dumbbell, BookOpen } from "lucide-react";
import type { Destination, PointOfInterest } from "@/lib/types";
import type { RouteSegment } from "@/components/trip/trip-editor";
import { POIOverlayControls } from "./poi-overlay-controls";
import { POIPopup } from "./poi-popup";

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
    },
  ],
};

const POI_ICON_CONFIG = {
  campsite: { icon: Tent, color: "bg-green-600", borderColor: "border-green-400" },
  gym: { icon: Dumbbell, color: "bg-blue-600", borderColor: "border-blue-400" },
  library: { icon: BookOpen, color: "bg-orange-600", borderColor: "border-orange-400" },
} as const;

interface TripMapProps {
  destinations: Destination[];
  routes: RouteSegment[];
  highlightedId: string | null;
  onMarkerClick: (destId: string) => void;
  pois: PointOfInterest[];
  onPoisChange: (pois: PointOfInterest[]) => void;
  onAddPOI: (poi: PointOfInterest) => void;
}

function TripMap({
  destinations,
  routes,
  highlightedId,
  onMarkerClick,
  pois,
  onPoisChange,
  onAddPOI,
}: TripMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedPOI, setSelectedPOI] = useState<PointOfInterest | null>(null);

  // Fit bounds when destinations change
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || destinations.length === 0) return;

    const map = mapRef.current;

    if (destinations.length === 1) {
      map.flyTo({
        center: [destinations[0].lng, destinations[0].lat],
        zoom: 12,
        duration: 1000,
      });
      return;
    }

    const lngs = destinations.map((d) => d.lng);
    const lats = destinations.map((d) => d.lat);

    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    map.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      maxZoom: 14,
      duration: 1000,
    });
  }, [destinations, mapLoaded]);

  // Fly to highlighted destination
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !highlightedId) return;

    const dest = destinations.find((d) => d.id === highlightedId);
    if (!dest) return;

    const map = mapRef.current;
    const currentZoom = map.getZoom();
    map.flyTo({
      center: [dest.lng, dest.lat],
      zoom: Math.max(currentZoom, 10),
      duration: 800,
    });
  }, [highlightedId, destinations, mapLoaded]);

  const handleLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const handleAddPOIFromPopup = useCallback(
    (poi: PointOfInterest) => {
      onAddPOI(poi);
      setSelectedPOI(null);
    },
    [onAddPOI],
  );

  const routeGeoJSON = {
    type: "FeatureCollection" as const,
    features: routes.map((route) => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: route.geometry,
      },
    })),
  };

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: 0,
        latitude: 20,
        zoom: 2,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={MAP_STYLE}
      onLoad={handleLoad}
    >
      <NavigationControl position="top-right" />

      {/* Route polylines */}
      {routes.length > 0 && (
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer
            id="route-line"
            type="line"
            paint={{
              "line-color": "#c0582f",
              "line-width": 3,
              "line-dasharray": [2, 2],
            }}
          />
        </Source>
      )}

      {/* Destination markers */}
      {destinations.map((dest, index) => (
        <Marker
          key={dest.id}
          longitude={dest.lng}
          latitude={dest.lat}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            onMarkerClick(dest.id);
          }}
        >
          <div
            className={`
              flex items-center justify-center
              w-8 h-8 rounded-full
              bg-terracotta text-white text-xs font-bold
              border-2 cursor-pointer
              transition-all duration-200
              ${
                highlightedId === dest.id
                  ? "border-gold scale-125 shadow-lg ring-2 ring-gold/40"
                  : "border-gold shadow-md hover:scale-110"
              }
            `}
          >
            {index + 1}
          </div>
        </Marker>
      ))}

      {/* POI markers */}
      {pois.map((poi) => {
        const config = POI_ICON_CONFIG[poi.type];
        const Icon = config.icon;
        return (
          <Marker
            key={`poi-${poi.id}`}
            longitude={poi.lng}
            latitude={poi.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedPOI(poi);
            }}
          >
            <div
              className={`
                flex items-center justify-center
                w-6 h-6 rounded-full
                ${config.color} text-white
                border ${config.borderColor}
                cursor-pointer shadow-sm
                hover:scale-110 transition-transform duration-150
              `}
            >
              <Icon size={12} />
            </div>
          </Marker>
        );
      })}

      {/* POI popup */}
      {selectedPOI && (
        <Popup
          longitude={selectedPOI.lng}
          latitude={selectedPOI.lat}
          anchor="bottom"
          onClose={() => setSelectedPOI(null)}
          closeOnClick={false}
          className="[&_.maplibregl-popup-content]:!p-3 [&_.maplibregl-popup-content]:!rounded-lg [&_.maplibregl-popup-content]:!shadow-lg"
        >
          <POIPopup poi={selectedPOI} onAddToTrip={handleAddPOIFromPopup} />
        </Popup>
      )}

      {/* POI overlay controls */}
      <POIOverlayControls
        destinations={destinations}
        routes={routes}
        onPoisChange={onPoisChange}
      />
    </Map>
  );
}

export { TripMap };
```

- [ ] **Step 2: Commit**

```bash
git add components/map/trip-map.tsx
git commit -m "feat: add POI markers, popups, and overlay controls to map"
```

---

## Task 11: Update Shared Trip View for Day Grouping

**Files:**
- Modify: `components/trip/shared-trip-view.tsx`

- [ ] **Step 1: Group shared trip destinations by day**

In `components/trip/shared-trip-view.tsx`, replace the destination list section (the `<div className="flex-1 overflow-y-auto px-5 pb-3">` block, lines 208–284) with:

```tsx
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
```

- [ ] **Step 2: Update the `TripMap` usage in shared view to pass empty POI props**

In the same file, find the `<TripMap` JSX (around line 316) and replace:

```tsx
          <TripMap
            destinations={destinations}
            routes={routes}
            highlightedId={highlightedId}
            onMarkerClick={handleMarkerClick}
          />
```

with:

```tsx
          <TripMap
            destinations={destinations}
            routes={routes}
            highlightedId={highlightedId}
            onMarkerClick={handleMarkerClick}
            pois={[]}
            onPoisChange={() => {}}
            onAddPOI={() => {}}
          />
```

The shared view is read-only so POI overlay is disabled (no toggles will appear since there are no route-based fetches with empty handlers).

- [ ] **Step 3: Commit**

```bash
git add components/trip/shared-trip-view.tsx
git commit -m "feat: group shared trip view destinations by day"
```

---

## Task 12: Build, Verify, and Final Commit

- [ ] **Step 1: Run the build to check for type errors**

```bash
npm run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 2: Fix any type errors found during build**

If there are type errors, fix them. Common issues to watch for:
- `DestinationList` now requires `totalDays`, `onAddDay`, `onRemoveDay`, `onInsertDayBefore` props — verify all call sites pass them
- `TripMap` now requires `pois`, `onPoisChange`, `onAddPOI` props — verify all call sites pass them
- The shared trip view doesn't use `TripMap`'s new props directly (it passes the old props), so it may need updating

- [ ] **Step 3: Test manually in the browser**

Verify:
1. Existing trips load correctly (destinations default to Day 1)
2. "Add Day" button works
3. Destinations can be dragged between days
4. Day delete moves destinations to adjacent day
5. POI toggles show markers on the map when a route exists
6. Clicking a POI marker shows a popup with "Add to Trip"
7. Adding a POI creates a destination in the last day

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix: resolve build issues for day grouping and POI overlay"
```
