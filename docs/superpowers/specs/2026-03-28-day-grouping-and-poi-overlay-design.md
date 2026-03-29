# Day Grouping & POI Overlay Design

## Overview

Two features for the trip planner:

1. **Day Grouping** — split destinations into days with drag-and-drop reordering across days
2. **POI Overlay** — toggle free campsites, gym chains, and libraries on the map along your route, with the ability to add them as destinations

---

## Data Model

### Destination (modified)

```typescript
interface Destination {
  id: string;
  osmId: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
  notes: string;
  sortOrder: number;
  dayIndex: number;  // NEW — 0-based day number (0 = Day 1, 1 = Day 2, etc.)
}
```

### Trip (modified)

```typescript
interface Trip {
  id: string;
  title: string;
  description: string | null;
  shareSlug: string | null;
  isPublic: boolean;
  userId: string;
  destinations: Destination[];
  totalDays: number;  // NEW — minimum 1, preserves empty trailing days
  createdAt: Date;
  updatedAt: Date;
}
```

### PointOfInterest (new, ephemeral — not persisted)

```typescript
interface PointOfInterest {
  id: string;             // OSM node ID
  name: string;
  type: 'campsite' | 'gym' | 'library';
  lat: number;
  lng: number;
  tags: Record<string, string>;  // raw OSM tags (opening hours, brand, etc.)
}
```

POIs are query results only. Adding one to the trip converts it into a regular `Destination`.

---

## Feature 1: Day Grouping

### UI Structure

The destination list changes from a flat list to grouped day sections:

- **Day headers** with a delete button
- **Destinations** listed within each day, drag-and-drop within and across days
- **Intra-day drive times** between consecutive destinations within a day
- **Cross-day drive times** between last destination of one day and first of the next, visually distinct (muted/italic)
- **Per-day subtotals** at the bottom of each day section
- **Continuous numbering** across days (1, 2, 3... not restarting per day)
- **"+ Add Day"** button at the bottom to append a new empty day (increments `totalDays`)
- **"+ Add Day Above"** option on each day header to insert a day before it

### Behaviors

- New destinations from PlaceSearch are added to the last day by default
- Deleting a day moves its destinations into the previous day (or next if Day 1), or just removes the day if empty
- Dragging a destination into a different day section updates its `dayIndex`
- `@dnd-kit` handles the drag-and-drop; the existing vertical sortable strategy extends to support multiple containers (one per day)

### Firestore Changes

- `createTrip()` — sets `totalDays: 1`, new destinations get `dayIndex: 0`
- `addDestination()` — sets `dayIndex` to `totalDays - 1` (last day)
- `reorderDestinations()` — now also accepts updated `dayIndex` values
- New functions: `addDay()`, `removeDay(dayIndex)`, `insertDayBefore(dayIndex)`

### Backward Compatibility

Existing trips won't have `dayIndex` on destinations or `totalDays` on the trip. Handle at read time:

- If `totalDays` is missing, default to `1`
- If a destination has no `dayIndex`, default to `0`

No Firestore migration needed — just defensive defaults when reading.

---

## Feature 2: POI Overlay

### Toggle Controls

A control panel on the map with:

- Checkboxes for each POI type: Free Campsites, Gyms, Libraries
- Radius slider (5–50 miles, default 15) — appears once any checkbox is toggled on
- Changing the slider or toggles triggers a new Overpass query

### Map Markers

Distinct from numbered destination markers, smaller so they don't compete:

- Campsites: green tent/tree icon
- Gyms: blue dumbbell icon
- Libraries: orange book icon

### Click Interaction

1. Click POI marker -> popup with name, type, and relevant OSM tags (opening hours, brand, etc.)
2. Popup has "Add to Trip" button
3. Clicking it adds the POI as a destination to the last day

### Query Strategy

- Only queries when at least one toggle is on and a route exists
- Re-fetches when: route changes, radius changes, or toggles change
- Results cached in component state
- Route coordinates simplified to ~20-30 points to keep Overpass queries reasonable

---

## API Route: `/api/overpass`

### Request

```typescript
POST /api/overpass
{
  coordinates: [number, number][],  // [lat, lng] points along the route
  radius: number,                    // meters (converted from miles on client)
  types: ('campsite' | 'gym' | 'library')[]
}
```

### Overpass Query Construction

Only includes toggled-on types. Example with all types:

```
[out:json][timeout:25];
(
  node["tourism"="camp_site"]["fee"="no"](around:24000,lat1,lng1,lat2,lng2,...);
  node["tourism"="camp_site"]["fee:conditional"](around:24000,lat1,lng1,lat2,lng2,...);
  node["tourism"="camp_site"][!"fee"](around:24000,lat1,lng1,lat2,lng2,...);
  node["leisure"="fitness_centre"]["name"~"Planet Fitness|24 Hour Fitness|Anytime Fitness"](around:24000,lat1,lng1,lat2,lng2,...);
  node["amenity"="library"](around:24000,lat1,lng1,lat2,lng2,...);
);
out body;
```

- Campsites: includes `fee=no`, `fee:conditional`, and missing `fee` tag (common for dispersed camping)
- Gyms: name regex for major chains (Planet Fitness, 24 Hour Fitness, Anytime Fitness)
- Libraries: `amenity=library`
- Rate limited: 1 request/second server-side

### Response

```typescript
{
  pois: PointOfInterest[]
}
```

---

## Component Changes Summary

| Component | Change |
|---|---|
| `lib/types.ts` | Add `dayIndex` to Destination, `totalDays` to Trip, new `PointOfInterest` type |
| `lib/firestore.ts` | Update `createTrip`, `addDestination`, `reorderDestinations`; add `addDay`, `removeDay`, `insertDayBefore` |
| `components/trip/destination-list.tsx` | Group by `dayIndex`, render day headers, multi-container dnd-kit, per-day subtotals, cross-day drive times |
| `components/trip/destination-card.tsx` | No structural changes, just receives updated props |
| `components/trip/trip-editor.tsx` | Manage `totalDays` state, pass day-related callbacks to destination list, manage POI overlay state |
| `components/map/trip-map.tsx` | Add POI marker layer, popup with "Add to Trip", toggle/slider control panel |
| `app/api/overpass/route.ts` | New API route proxying to Overpass API |
| `components/trip/place-search.tsx` | No changes |
