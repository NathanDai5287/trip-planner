"use client";

import { Plus, Trash2 } from "lucide-react";
import { formatDuration } from "@/lib/format-duration";

interface DayHeaderProps {
  dayIndex: number;
  dayDriveTime: number;
  destinationCount: number;
  isOnlyDay: boolean;
  onInsertDayBefore: () => void;
  onRemoveDay: () => void;
}

function DayHeader({
  dayIndex,
  dayDriveTime,
  destinationCount,
  isOnlyDay,
  onInsertDayBefore,
  onRemoveDay,
}: DayHeaderProps) {
  return (
    <div className="flex items-center gap-2 pt-3 first:pt-0 pb-1">
      <button
        type="button"
        onClick={onInsertDayBefore}
        className="shrink-0 text-muted hover:text-terracotta transition-colors cursor-pointer"
        aria-label={`Insert day before Day ${dayIndex + 1}`}
        title="Insert day before"
      >
        <Plus size={14} />
      </button>

      <div className="flex-1 flex items-center gap-2">
        <h3 className="font-display text-sm font-semibold text-charcoal tracking-wide uppercase">
          Day {dayIndex + 1}
        </h3>
        <div className="flex-1 h-px bg-border" />
        {destinationCount > 0 && dayDriveTime > 0 && (
          <span className="text-xs text-muted shrink-0">
            {formatDuration(dayDriveTime)}
          </span>
        )}
      </div>

      {!isOnlyDay && (
        <button
          type="button"
          onClick={onRemoveDay}
          className="shrink-0 text-muted hover:text-danger transition-colors cursor-pointer"
          aria-label={`Remove Day ${dayIndex + 1}`}
          title="Remove day"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

export { DayHeader };
