"use client";

import { useCallback, useEffect, useRef } from "react";
import type { BudgetData } from "@/lib/types";
import type { RouteSegment } from "./trip-editor";
import { updateBudget } from "@/lib/firestore";
import toast from "react-hot-toast";

interface BudgetPanelProps {
  tripId: string;
  budget: BudgetData;
  totalDays: number;
  routes: RouteSegment[];
  onChange: (budget: BudgetData) => void;
}

const METERS_TO_MILES = 0.000621371;

function totalMiles(routes: RouteSegment[]): number {
  return routes.reduce((sum, r) => sum + r.distance, 0) * METERS_TO_MILES;
}

function fmt(n: number): string {
  return n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString()}`;
}

// Compact number input — shows placeholder "0" when value is 0
function N({
  value,
  onChange,
  step = 1,
  min = 0,
  placeholder = "0",
  width = "w-16",
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  placeholder?: string;
  width?: string;
}) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={value || ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
      className={`${width} rounded border border-border bg-stone px-1.5 py-0.5 text-xs text-charcoal text-right focus:border-terracotta focus:ring-1 focus:ring-terracotta/20 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
    />
  );
}

function Row({
  label,
  cost,
  children,
}: {
  label: string;
  cost: number;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2 border-b border-border/50 last:border-0">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-charcoal">{label}</span>
        <span className="text-xs font-mono font-semibold text-charcoal tabular-nums">{fmt(cost)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {children}
      </div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`whitespace-nowrap ${className ?? ""}`}>{children}</span>;
}

export function BudgetPanel({ tripId, budget, totalDays, routes, onChange }: BudgetPanelProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const miles = totalMiles(routes);

  const update = useCallback(
    (patch: Partial<BudgetData>) => {
      const next = { ...budget, ...patch };
      onChange(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateBudget(tripId, next).catch(() => toast.error("Failed to save budget"));
      }, 800);
    },
    [budget, onChange, tripId],
  );

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const gasCost = budget.gas.mpg > 0
    ? (miles / budget.gas.mpg) * budget.gas.pricePerGallon
    : 0;
  const foodCost = budget.food.perDayPerPerson * totalDays * budget.food.people;
  const lodgingCost = budget.lodging.perNight * budget.lodging.nights;
  const parkingCost = budget.parking.perDay * totalDays;
  const laundryCost = budget.laundry.perLoad * budget.laundry.loads;
  const subtotal = gasCost + foodCost + lodgingCost + parkingCost
    + budget.attractions.total + budget.activities.total
    + budget.shopping.total + laundryCost
    + budget.tolls.total + budget.misc.total;

  return (
    <div className="pt-3">
      <Row label="Gas" cost={gasCost}>
        <Label>{miles > 0 ? `${Math.round(miles)} mi` : "no route yet"}</Label>
        <Label>MPG <N value={budget.gas.mpg} step={1} onChange={(v) => update({ gas: { ...budget.gas, mpg: v } })} /></Label>
        <Label>$/gal <N value={budget.gas.pricePerGallon} step={0.01} onChange={(v) => update({ gas: { ...budget.gas, pricePerGallon: v } })} width="w-14" /></Label>
      </Row>

      <Row label="Food" cost={foodCost}>
        <Label>$/day <N value={budget.food.perDayPerPerson} step={5} onChange={(v) => update({ food: { ...budget.food, perDayPerPerson: v } })} /></Label>
        <Label>people <N value={budget.food.people} step={1} min={1} onChange={(v) => update({ food: { ...budget.food, people: Math.max(1, v) } })} width="w-12" /></Label>
        <Label className="opacity-60">{totalDays} days</Label>
      </Row>

      <Row label="Lodging" cost={lodgingCost}>
        <Label>$/night <N value={budget.lodging.perNight} step={5} onChange={(v) => update({ lodging: { ...budget.lodging, perNight: v } })} /></Label>
        <Label>nights <N value={budget.lodging.nights} step={1} onChange={(v) => update({ lodging: { ...budget.lodging, nights: v } })} width="w-12" /></Label>
      </Row>

      <Row label="Parking" cost={parkingCost}>
        <Label>$/day <N value={budget.parking.perDay} step={5} onChange={(v) => update({ parking: { perDay: v } })} /></Label>
        <Label className="opacity-60">{totalDays} days</Label>
      </Row>

      <Row label="Attractions & Fees" cost={budget.attractions.total}>
        <Label>$ <N value={budget.attractions.total} step={5} width="w-20" onChange={(v) => update({ attractions: { total: v } })} /></Label>
        <Label className="opacity-60">parks, museums, entry fees</Label>
      </Row>

      <Row label="Activities" cost={budget.activities.total}>
        <Label>$ <N value={budget.activities.total} step={5} width="w-20" onChange={(v) => update({ activities: { total: v } })} /></Label>
        <Label className="opacity-60">tours, rentals, recreation</Label>
      </Row>

      <Row label="Shopping & Souvenirs" cost={budget.shopping.total}>
        <Label>$ <N value={budget.shopping.total} step={5} width="w-20" onChange={(v) => update({ shopping: { total: v } })} /></Label>
      </Row>

      <Row label="Laundry" cost={laundryCost}>
        <Label>$/load <N value={budget.laundry.perLoad} step={1} onChange={(v) => update({ laundry: { ...budget.laundry, perLoad: v } })} /></Label>
        <Label>loads <N value={budget.laundry.loads} step={1} width="w-12" onChange={(v) => update({ laundry: { ...budget.laundry, loads: v } })} /></Label>
      </Row>

      <Row label="Tolls" cost={budget.tolls.total}>
        <Label>$ <N value={budget.tolls.total} step={5} width="w-20" onChange={(v) => update({ tolls: { total: v } })} /></Label>
      </Row>

      <Row label="Miscellaneous" cost={budget.misc.total}>
        <Label>$ <N value={budget.misc.total} step={5} width="w-20" onChange={(v) => update({ misc: { total: v } })} /></Label>
        <Label className="opacity-60">buffer, unexpected costs</Label>
      </Row>

      {/* Total */}
      <div className="mt-3 pt-3 border-t-2 border-border flex justify-between items-baseline">
        <span className="text-sm font-semibold text-charcoal">Estimated Total</span>
        <span className="text-base font-mono font-bold text-terracotta tabular-nums">{fmt(subtotal)}</span>
      </div>
    </div>
  );
}
