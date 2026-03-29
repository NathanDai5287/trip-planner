"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getTrip } from "@/lib/firestore";
import type { Trip, Destination } from "@/lib/types";
import { DEFAULT_BUDGET } from "@/lib/types";
import { MapPin, DollarSign, Package } from "lucide-react";

function fmt(n: number): string {
  return n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString()}`;
}

export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    getTrip(id).then((t) => {
      if (!t || t.userId !== user.uid) { router.replace("/dashboard"); return; }
      setTrip(t);
      setLoading(false);
    });
  }, [id, user, authLoading, router]);

  useEffect(() => {
    if (!loading && trip) {
      setTimeout(() => window.print(), 300);
    }
  }, [loading, trip]);

  if (authLoading || loading || !trip) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  const budget = trip.budget ?? DEFAULT_BUDGET;
  const destinations = [...trip.destinations].sort((a, b) =>
    a.dayIndex !== b.dayIndex ? a.dayIndex - b.dayIndex : a.sortOrder - b.sortOrder
  );

  const dayGroups: Destination[][] = Array.from({ length: trip.totalDays }, () => []);
  for (const dest of destinations) {
    const day = Math.min(Math.max(dest.dayIndex, 0), trip.totalDays - 1);
    dayGroups[day].push(dest);
  }

  // Budget calculations (gas excluded — requires route distance not stored in Firestore)
  const foodCost = budget.food.perDayPerPerson * trip.totalDays * budget.food.people;
  const lodgingCost = budget.lodging.perNight * budget.lodging.nights;
  const subtotal =
    foodCost + lodgingCost + budget.parking.total +
    budget.attractions.total + budget.activities.total +
    budget.shopping.total +
    budget.laundry.perLoad * budget.laundry.loads +
    budget.tolls.total + budget.misc.total;

  const budgetRows = [
    { label: "Food", value: foodCost, note: `${budget.food.people} person${budget.food.people !== 1 ? "s" : ""} · $${budget.food.perDayPerPerson}/day · ${trip.totalDays} days` },
    { label: "Lodging", value: lodgingCost, note: `${budget.lodging.nights} night${budget.lodging.nights !== 1 ? "s" : ""} · $${budget.lodging.perNight}/night` },
    { label: "Parking", value: budget.parking.total, note: "" },
    { label: "Attractions & Fees", value: budget.attractions.total, note: "" },
    { label: "Activities", value: budget.activities.total, note: "" },
    { label: "Shopping & Souvenirs", value: budget.shopping.total, note: "" },
    { label: "Laundry", value: budget.laundry.perLoad * budget.laundry.loads, note: `${budget.laundry.loads} loads · $${budget.laundry.perLoad}/load` },
    { label: "Tolls", value: budget.tolls.total, note: "" },
    { label: "Miscellaneous", value: budget.misc.total, note: "" },
  ].filter((r) => r.value > 0);

  const unchecked = (trip.packingList ?? []).filter((i) => !i.checked);
  const checked = (trip.packingList ?? []).filter((i) => i.checked);

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.75in; size: letter; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: Georgia, serif; color: #1a1a1a; background: white; }
      `}</style>

      <div className="max-w-2xl mx-auto px-6 py-8 text-gray-900">
        {/* Header */}
        <div className="border-b-2 border-gray-900 pb-4 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{trip.title}</h1>
          {trip.description && (
            <p className="mt-1 text-gray-600 text-sm">{trip.description}</p>
          )}
          <p className="mt-2 text-xs text-gray-400">
            {destinations.length} stop{destinations.length !== 1 ? "s" : ""} · {trip.totalDays} day{trip.totalDays !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Itinerary */}
        <section className="mb-8">
          <h2 className="flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-gray-500 mb-4">
            <MapPin size={16} />
            Itinerary
          </h2>

          {dayGroups.map((dayDests, dayIndex) => (
            <div key={dayIndex} className="mb-5">
              {trip.totalDays > 1 && (
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-2">
                  Day {dayIndex + 1}
                </h3>
              )}
              {dayDests.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No stops planned</p>
              ) : (
                <ol className="space-y-2">
                  {dayDests.map((dest, i) => (
                    <li key={dest.id} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-sm">{dest.name}</p>
                        <p className="text-xs text-gray-500">{dest.address}</p>
                        {dest.notes && (
                          <p className="text-xs text-gray-600 mt-0.5 italic">{dest.notes}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </section>

        {/* Budget */}
        {budgetRows.length > 0 && (
          <section className="mb-8">
            <h2 className="flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-gray-500 mb-4">
              <DollarSign size={16} />
              Budget
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {budgetRows.map((row) => (
                  <tr key={row.label} className="border-b border-gray-100">
                    <td className="py-1.5 font-medium">{row.label}</td>
                    <td className="py-1.5 text-gray-500 text-xs">{row.note}</td>
                    <td className="py-1.5 text-right font-mono font-semibold">{fmt(row.value)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-900">
                  <td className="pt-2 font-bold text-base" colSpan={2}>Estimated Total</td>
                  <td className="pt-2 text-right font-mono font-bold text-base">{fmt(subtotal)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-2">* Gas cost not shown — requires driving routes</p>
          </section>
        )}

        {/* Packing list */}
        {(unchecked.length > 0 || checked.length > 0) && (
          <section>
            <h2 className="flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-gray-500 mb-4">
              <Package size={16} />
              Packing List
            </h2>
            <div className="columns-2 gap-6">
              {unchecked.map((item) => (
                <div key={item.id} className="flex items-center gap-2 py-0.5 text-sm break-inside-avoid">
                  <span className="w-4 h-4 border border-gray-400 rounded-sm flex-shrink-0" />
                  {item.text}
                </div>
              ))}
              {checked.map((item) => (
                <div key={item.id} className="flex items-center gap-2 py-0.5 text-sm text-gray-400 line-through break-inside-avoid">
                  <span className="w-4 h-4 border border-gray-300 rounded-sm flex-shrink-0 bg-gray-200" />
                  {item.text}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="mt-10 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center no-print">
          Press <kbd className="border border-gray-300 rounded px-1 py-0.5 font-mono">Ctrl+P</kbd> to print or save as PDF
        </div>
      </div>
    </>
  );
}
