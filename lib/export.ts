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
