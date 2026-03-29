"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getTrip } from "@/lib/firestore";
import type { Trip } from "@/lib/types";
import { Header } from "@/components/header";
import { TripEditor } from "@/components/trip/trip-editor";

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    getTrip(id).then((t) => {
      if (!t || t.userId !== user.uid) {
        router.replace("/dashboard");
        return;
      }
      setTrip(t);
      setLoading(false);
    });
  }, [id, user, authLoading, router]);

  if (authLoading || loading || !trip) {
    return (
      <div className="flex flex-col h-screen">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone border-t-terracotta" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <TripEditor trip={trip} />
    </div>
  );
}
