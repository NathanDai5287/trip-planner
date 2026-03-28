import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { SharedTripView } from "@/components/trip/shared-trip-view";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trip = await prisma.trip.findUnique({
    where: { shareSlug: slug, isPublic: true },
    include: { destinations: { orderBy: { sortOrder: "asc" } } },
  });

  if (!trip) return { title: "Trip Not Found" };

  const stopCount = trip.destinations.length;
  const description =
    trip.description ||
    `A road trip with ${stopCount} ${stopCount === 1 ? "destination" : "destinations"}`;

  return {
    title: `${trip.title} — Wayfinder`,
    description,
    openGraph: {
      title: `${trip.title} — Wayfinder`,
      description,
      type: "website",
    },
  };
}

export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trip = await prisma.trip.findUnique({
    where: { shareSlug: slug, isPublic: true },
    include: { destinations: { orderBy: { sortOrder: "asc" } } },
  });

  if (!trip) notFound();

  return <SharedTripView trip={trip} />;
}
