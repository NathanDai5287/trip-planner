"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";

export async function createTrip(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const title = formData.get("title") as string;
  const description = formData.get("description") as string | null;

  if (!title?.trim()) return { error: "Title is required" };

  const trip = await prisma.trip.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      userId: session.user.id,
    },
  });

  redirect(`/trip/${trip.id}`);
}

export async function updateTrip(
  tripId: string,
  data: { title?: string; description?: string },
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.trip.update({
    where: { id: tripId, userId: session.user.id },
    data,
  });

  revalidatePath(`/trip/${tripId}`);
  revalidatePath("/dashboard");
}

export async function deleteTrip(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.trip.delete({
    where: { id: tripId, userId: session.user.id },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function toggleSharing(tripId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const trip = await prisma.trip.findUnique({
    where: { id: tripId, userId: session.user.id },
  });
  if (!trip) throw new Error("Trip not found");

  const isPublic = !trip.isPublic;
  const shareSlug = isPublic ? (trip.shareSlug || nanoid(10)) : trip.shareSlug;

  await prisma.trip.update({
    where: { id: tripId },
    data: { isPublic, shareSlug },
  });

  revalidatePath(`/trip/${tripId}`);
  return { isPublic, shareSlug };
}
