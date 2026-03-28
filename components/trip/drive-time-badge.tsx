"use client";

import { Clock } from "lucide-react";
import { formatDuration } from "@/lib/format-duration";

interface DriveTimeBadgeProps {
  seconds: number;
}

function DriveTimeBadge({ seconds }: DriveTimeBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone px-2 py-0.5 text-xs text-muted">
      <Clock size={10} className="shrink-0" />
      {formatDuration(seconds)}
    </span>
  );
}

export { DriveTimeBadge };
