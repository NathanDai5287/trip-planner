"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function addDestination(
  tripId: string,
  data: {
    osmId?: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
  }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify trip ownership
  const trip = await prisma.trip.findUnique({
    where: { id: tripId, userId: session.user.id },
    include: { destinations: { orderBy: { sortOrder: "desc" }, take: 1 } },
  });
  if (!trip) throw new Error("Trip not found");

  const nextOrder =
    trip.destinations.length > 0 ? trip.destinations[0].sortOrder + 1 : 0;

  const destination = await prisma.destination.create({
    data: {
      ...data,
      sortOrder: nextOrder,
      tripId,
    },
  });

  revalidatePath(`/trip/${tripId}`);
  return destination;
}

export async function removeDestination(
  destinationId: string,
  tripId: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify trip ownership
  const trip = await prisma.trip.findUnique({
    where: { id: tripId, userId: session.user.id },
  });
  if (!trip) throw new Error("Trip not found");

  await prisma.destination.delete({
    where: { id: destinationId, tripId },
  });

  revalidatePath(`/trip/${tripId}`);
}

export async function updateDestinationNotes(
  destinationId: string,
  tripId: string,
  notes: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const trip = await prisma.trip.findUnique({
    where: { id: tripId, userId: session.user.id },
  });
  if (!trip) throw new Error("Trip not found");

  await prisma.destination.update({
    where: { id: destinationId, tripId },
    data: { notes },
  });

  revalidatePath(`/trip/${tripId}`);
}

export async function reorderDestinations(
  tripId: string,
  orderedIds: string[]
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const trip = await prisma.trip.findUnique({
    where: { id: tripId, userId: session.user.id },
  });
  if (!trip) throw new Error("Trip not found");

  // Update all sort orders in a transaction
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.destination.update({
        where: { id, tripId },
        data: { sortOrder: index },
      })
    )
  );

  revalidatePath(`/trip/${tripId}`);
}
