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
import type { Trip, Destination } from "./types";

function tripFromDoc(id: string, data: Record<string, unknown>): Trip {
  return {
    id,
    title: data.title as string,
    description: (data.description as string) || null,
    shareSlug: (data.shareSlug as string) || null,
    isPublic: (data.isPublic as boolean) || false,
    userId: data.userId as string,
    destinations: (data.destinations as Destination[]) || [],
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
  orderedIds: string[],
) {
  const trip = await getTrip(tripId);
  if (!trip) throw new Error("Trip not found");

  const reordered = orderedIds
    .map((id, index) => {
      const dest = trip.destinations.find((d) => d.id === id);
      return dest ? { ...dest, sortOrder: index } : null;
    })
    .filter((d): d is Destination => d !== null);

  await updateDoc(doc(db, "trips", tripId), {
    destinations: reordered,
    updatedAt: serverTimestamp(),
  });
}
