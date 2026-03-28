import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/header";
import { TripCard } from "@/components/dashboard/trip-card";
import { NewTripButton } from "@/components/dashboard/new-trip-button";

export const metadata = {
  title: "Dashboard — Wayfinder",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const trips = await prisma.trip.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { destinations: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 mb-10 stagger-children">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-charcoal sm:text-4xl">
              Your Trips
            </h1>
            <p className="mt-1 text-sm text-muted font-body">
              {trips.length === 0
                ? "Plan your first adventure"
                : `${trips.length} ${trips.length === 1 ? "trip" : "trips"} planned`}
            </p>
          </div>
          <NewTripButton />
        </div>

        {/* Trip grid or empty state */}
        {trips.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-stone-light/50 px-6 py-20 text-center">
            <div className="mb-5 inline-flex items-center justify-center rounded-full bg-stone p-5">
              <Compass size={40} className="text-terracotta" />
            </div>
            <h2 className="font-display text-xl font-semibold text-charcoal">
              No trips yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted font-body leading-relaxed">
              Every great journey starts with a single step. Create your first
              trip and begin plotting destinations on the map.
            </p>
            <div className="mt-6">
              <NewTripButton />
            </div>
          </div>
        )}
      </main>
    </>
  );
}
