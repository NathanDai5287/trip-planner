"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import type { Destination } from "@/lib/types";
import { MapPin, Plus, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { reorderDestinations } from "@/lib/firestore";
import { DestinationCard } from "./destination-card";
import { DayHeader } from "./day-header";
import { formatDuration } from "@/lib/format-duration";
import type { RouteSegment } from "./trip-editor";

interface DestinationListProps {
  tripId: string;
  destinations: Destination[];
  routes: RouteSegment[];
  routesLoading: boolean;
  totalDays: number;
  highlightedId: string | null;
  onReorder: (destinations: Destination[]) => void;
  onRemove: (destId: string) => void;
  onHighlight: (destId: string | null) => void;
  onAddDay: () => void;
  onRemoveDay: (dayIndex: number) => void;
  onInsertDayBefore: (dayIndex: number) => void;
}

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

function DriveTimeDivider({ seconds, loading }: { seconds: number | null; loading: boolean }) {
  return (
    <div className="flex items-center gap-2 py-0.5 px-1">
      <div className="flex-1 h-px bg-border/60" />
      <span className="text-xs text-muted/50 shrink-0 tabular-nums">
        {loading && seconds === null
          ? <Loader2 size={10} className="animate-spin" />
          : seconds !== null
            ? formatDuration(seconds)
            : null
        }
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

function DestinationList({
  tripId,
  destinations,
  routes,
  routesLoading,
  totalDays,
  highlightedId,
  onReorder,
  onRemove,
  onHighlight,
  onAddDay,
  onRemoveDay,
  onInsertDayBefore,
}: DestinationListProps) {
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
  const lastOverIdRef = useRef<string | null>(null);

  const toggleCollapse = useCallback((dayIndex: number) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayIndex)) next.delete(dayIndex);
      else next.add(dayIndex);
      return next;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dayGroups = useMemo(() => {
    const groups: Destination[][] = Array.from({ length: totalDays }, () => []);
    for (const dest of destinations) {
      const day = dest.dayIndex;
      if (day >= 0 && day < totalDays) groups[day].push(dest);
      else groups[totalDays - 1].push(dest);
    }
    for (const group of groups) group.sort((a, b) => a.sortOrder - b.sortOrder);
    return groups;
  }, [destinations, totalDays]);

  const flatSorted = useMemo(() => dayGroups.flat(), [dayGroups]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    if (event.over) lastOverIdRef.current = String(event.over.id);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active } = event;
      // Fall back to last tracked over when cursor is on a non-sortable element (e.g. day header)
      const overId = event.over ? String(event.over.id) : lastOverIdRef.current;
      lastOverIdRef.current = null;
      if (!overId || active.id === overId) return;

      const oldIndex = flatSorted.findIndex((d) => d.id === active.id);
      const newIndex = flatSorted.findIndex((d) => d.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(flatSorted, oldIndex, newIndex);
      const targetDayIndex = flatSorted[newIndex].dayIndex;

      const updated = reordered.map((d, i) => ({
        ...d,
        sortOrder: i,
        dayIndex: d.id === String(active.id) ? targetDayIndex : d.dayIndex,
      }));

      onReorder(updated);

      try {
        await reorderDestinations(
          tripId,
          updated.map((d) => ({ id: d.id, dayIndex: d.dayIndex })),
        );
      } catch {
        onReorder(destinations);
        toast.error("Failed to reorder destinations");
      }
    },
    [flatSorted, destinations, tripId, onReorder],
  );

  function getDriveTime(fromId: string, toId: string): number | null {
    const route = routes.find((r) => r.fromId === fromId && r.toId === toId);
    return route ? route.duration : null;
  }

  function getDayDriveTime(dayDests: Destination[]): number {
    let total = 0;
    for (let i = 0; i < dayDests.length - 1; i++) {
      const t = getDriveTime(dayDests[i].id, dayDests[i + 1].id);
      if (t) total += t;
    }
    return total;
  }

  let runningIndex = 0;

  if (destinations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone">
          <MapPin size={24} className="text-muted" />
        </div>
        <p className="text-sm font-medium text-charcoal mb-1">No destinations yet</p>
        <p className="text-xs text-muted max-w-[200px]">
          Search for a place above to start planning your trip
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { lastOverIdRef.current = null; }}
    >
      <SortableContext items={flatSorted.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1">
          {dayGroups.map((dayDests, dayIndex) => {
            const dayStartIndex = runningIndex;
            runningIndex += dayDests.length;
            const collapsed = collapsedDays.has(dayIndex);

            const prevDay = dayIndex > 0 ? dayGroups[dayIndex - 1] : null;
            const crossDayTime =
              prevDay && prevDay.length > 0 && dayDests.length > 0
                ? getDriveTime(prevDay[prevDay.length - 1].id, dayDests[0].id)
                : null;

            return (
              <div key={dayIndex}>
                {/* Cross-day drive time divider */}
                {dayIndex > 0 && (
                  <DriveTimeDivider seconds={crossDayTime} loading={routesLoading} />
                )}

                <DayHeader
                  dayIndex={dayIndex}
                  dayDriveTime={getDayDriveTime(dayDests)}
                  destinationCount={dayDests.length}
                  isOnlyDay={totalDays <= 1}
                  collapsed={collapsed}
                  onToggleCollapse={() => toggleCollapse(dayIndex)}
                  onInsertDayBefore={() => onInsertDayBefore(dayIndex)}
                  onRemoveDay={() => onRemoveDay(dayIndex)}
                />

                {!collapsed && (
                  <div className="flex flex-col ml-1">
                    {dayDests.map((dest, i) => {
                      const globalIndex = dayStartIndex + i;
                      const nextDest = dayDests[i + 1];
                      const driveTime = nextDest
                        ? getDriveTime(dest.id, nextDest.id)
                        : null;

                      return (
                        <div key={dest.id}>
                          <DestinationCard
                            destination={dest}
                            tripId={tripId}
                            index={globalIndex}
                            isHighlighted={highlightedId === dest.id}
                            onRemove={onRemove}
                            onHighlight={onHighlight}
                          />
                          {nextDest && (
                            <DriveTimeDivider seconds={driveTime} loading={routesLoading} />
                          )}
                        </div>
                      );
                    })}
                    {dayDests.length === 0 && (
                      <p className="text-xs text-muted italic py-2 pl-2">
                        No stops planned for this day
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={onAddDay}
            className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-xs text-muted hover:text-terracotta hover:border-terracotta/40 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Add Day
          </button>
        </div>
      </SortableContext>
    </DndContext>
  );
}

export { DestinationList };
