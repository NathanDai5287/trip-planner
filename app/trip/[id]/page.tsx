import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/header";
import { TripEditor } from "@/components/trip/trip-editor";

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const trip = await prisma.trip.findUnique({
    where: { id, userId: session.user.id },
    include: { destinations: { orderBy: { sortOrder: "asc" } } },
  });

  if (!trip) notFound();

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <TripEditor trip={trip} />
    </div>
  );
}
