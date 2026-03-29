import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { nanoid } from "nanoid";
import type { Trip, Destination, BudgetData, PackingItem, RouteSegment } from "./types";
import { DEFAULT_BUDGET } from "./types";

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
    budget: (data.budget as BudgetData) ?? null,
    packingList: (data.packingList as PackingItem[]) ?? [],
    routes: (data.routes as RouteSegment[]) ?? [],
    createdAt: (data.createdAt as { toDate(): Date })?.toDate?.() || new Date(),
    updatedAt: (data.updatedAt as { toDate(): Date })?.toDate?.() || new Date(),
  };
}

// ── Trips ──

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
    budget: DEFAULT_BUDGET,
    packingList: [],
    routes: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getTrip(tripId: string): Promise<Trip | null> {
  const snap = await getDoc(doc(db, "trips", tripId));
  if (!snap.exists()) return null;
  return tripFromDoc(snap.id, snap.data());
}

export async function getUserTrips(userId: string): Promise<Trip[]> {
  const q = query(
    collection(db, "trips"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => tripFromDoc(d.id, d.data()));
}

export async function updateTripFields(
  tripId: string,
  data: { title?: string; description?: string },
) {
  await updateDoc(doc(db, "trips", tripId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTrip(tripId: string) {
  await deleteDoc(doc(db, "trips", tripId));
}

export async function toggleSharing(
  tripId: string,
): Promise<{ isPublic: boolean; shareSlug: string | null }> {
  const trip = await getTrip(tripId);
  if (!trip) throw new Error("Trip not found");

  const isPublic = !trip.isPublic;
  const shareSlug = isPublic ? trip.shareSlug || nanoid(10) : trip.shareSlug;

  await updateDoc(doc(db, "trips", tripId), {
    isPublic,
    shareSlug,
    updatedAt: serverTimestamp(),
  });

  return { isPublic, shareSlug };
}

export async function getSharedTrip(slug: string): Promise<Trip | null> {
  const q = query(
    collection(db, "trips"),
    where("shareSlug", "==", slug),
    where("isPublic", "==", true),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return tripFromDoc(d.id, d.data());
}

// ── Destinations (embedded in trip document) ──

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

export async function removeDestination(tripId: string, destinationId: string) {
  const trip = await getTrip(tripId);
  if (!trip) throw new Error("Trip not found");

  await updateDoc(doc(db, "trips", tripId), {
    destinations: trip.destinations.filter((d) => d.id !== destinationId),
    updatedAt: serverTimestamp(),
  });
}

export async function updateDestinationNotes(
  tripId: string,
  destinationId: string,
  notes: string,
) {
  const trip = await getTrip(tripId);
  if (!trip) throw new Error("Trip not found");

  await updateDoc(doc(db, "trips", tripId), {
    destinations: trip.destinations.map((d) =>
      d.id === destinationId ? { ...d, notes } : d,
    ),
    updatedAt: serverTimestamp(),
  });
}

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

  const targetDay = dayIndex > 0 ? dayIndex - 1 : 1;
  const updatedDestinations = trip.destinations.map((d) => {
    if (d.dayIndex === dayIndex) {
      return { ...d, dayIndex: targetDay };
    }
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

// ── Budget ──

export async function updateBudget(tripId: string, budget: BudgetData) {
  await updateDoc(doc(db, "trips", tripId), {
    budget,
    updatedAt: serverTimestamp(),
  });
}

// ── Routes ──

export async function updateRoutes(tripId: string, routes: RouteSegment[]) {
  await updateDoc(doc(db, "trips", tripId), {
    routes,
    updatedAt: serverTimestamp(),
  });
}

// ── Packing list ──

export async function updatePackingList(tripId: string, items: PackingItem[]) {
  await updateDoc(doc(db, "trips", tripId), {
    packingList: items,
    updatedAt: serverTimestamp(),
  });
}
