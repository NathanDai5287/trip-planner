"use client";

import { Car, MapPin } from "lucide-react";
import { formatDuration } from "@/lib/format-duration";
import type { RouteSegment } from "./trip-editor";

interface TotalDriveTimeProps {
  routes: RouteSegment[];
  destinationCount: number;
}

function TotalDriveTime({ routes, destinationCount }: TotalDriveTimeProps) {
  const totalSeconds = routes.reduce((sum, r) => sum + r.duration, 0);

  if (destinationCount === 0) return null;

  return (
    <div className="flex items-center gap-4 text-sm text-muted">
      <span className="inline-flex items-center gap-1.5">
        <MapPin size={14} className="text-terracotta" />
        {destinationCount} {destinationCount === 1 ? "stop" : "stops"}
      </span>
      {totalSeconds > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <Car size={14} className="text-terracotta" />
          {formatDuration(totalSeconds)} total drive
        </span>
      )}
    </div>
  );
}

export { TotalDriveTime };
