"use client";

import { Tent, Dumbbell, BookOpen, Plus } from "lucide-react";
import type { PointOfInterest } from "@/lib/types";

interface POIPopupProps {
  poi: PointOfInterest;
  onAddToTrip: (poi: PointOfInterest) => void;
}

const TYPE_CONFIG = {
  campsite: { icon: Tent, color: "text-green-600", label: "Campsite" },
  gym: { icon: Dumbbell, color: "text-blue-600", label: "Gym" },
  library: { icon: BookOpen, color: "text-orange-600", label: "Library" },
} as const;

function POIPopup({ poi, onAddToTrip }: POIPopupProps) {
  const config = TYPE_CONFIG[poi.type];
  const Icon = config.icon;

  const openingHours = poi.tags.opening_hours;
  const brand = poi.tags.brand;
  const phone = poi.tags.phone;
  const website = poi.tags.website;

  return (
    <div className="min-w-[180px] max-w-[240px]">
      <div className="flex items-start gap-2 mb-2">
        <Icon size={16} className={`${config.color} shrink-0 mt-0.5`} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-charcoal leading-tight">
            {poi.name}
          </p>
          <p className="text-xs text-muted mt-0.5">{config.label}</p>
        </div>
      </div>

      <div className="space-y-1 text-xs text-muted">
        {brand && <p>Brand: {brand}</p>}
        {openingHours && <p>Hours: {openingHours}</p>}
        {phone && <p>Phone: {phone}</p>}
        {website && (
          <p className="truncate">
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-terracotta hover:underline"
            >
              Website
            </a>
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onAddToTrip(poi)}
        className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-md bg-terracotta text-white text-xs font-medium py-1.5 hover:bg-terracotta-dark transition-colors cursor-pointer"
      >
        <Plus size={12} />
        Add to Trip
      </button>
    </div>
  );
}

export { POIPopup };
