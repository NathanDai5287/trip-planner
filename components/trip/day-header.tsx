"use client";

import { Plus, Trash2, ChevronRight } from "lucide-react";
import { formatDuration } from "@/lib/format-duration";

interface DayHeaderProps {
  dayIndex: number;
  dayDriveTime: number;
  destinationCount: number;
  isOnlyDay: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onInsertDayBefore: () => void;
  onRemoveDay: () => void;
}

function DayHeader({
  dayIndex,
  dayDriveTime,
  destinationCount,
  isOnlyDay,
  collapsed,
  onToggleCollapse,
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

      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex-1 flex items-center gap-1.5 min-w-0 text-left group"
        aria-label={collapsed ? `Expand Day ${dayIndex + 1}` : `Collapse Day ${dayIndex + 1}`}
      >
        <ChevronRight
          size={12}
          className={`shrink-0 text-muted transition-transform duration-150 ${collapsed ? "" : "rotate-90"}`}
        />
        <h3 className="font-display text-sm font-semibold text-charcoal tracking-wide uppercase group-hover:text-terracotta transition-colors">
          Day {dayIndex + 1}
        </h3>
        <div className="flex-1 h-px bg-border" />
        {destinationCount > 0 && dayDriveTime > 0 && (
          <span className="text-xs text-muted shrink-0">
            {formatDuration(dayDriveTime)}
          </span>
        )}
        {collapsed && destinationCount > 0 && (
          <span className="text-xs text-muted/60 shrink-0">
            {destinationCount} stop{destinationCount !== 1 ? "s" : ""}
          </span>
        )}
      </button>

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
