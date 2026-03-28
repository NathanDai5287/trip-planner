import type { Trip, Destination } from "@prisma/client";

export function buildTripExport(trip: Trip & { destinations: Destination[] }) {
  return {
    title: trip.title,
    description: trip.description,
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
      })),
    exportedAt: new Date().toISOString(),
    version: 1,
  };
}
