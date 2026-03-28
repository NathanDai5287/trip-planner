"use client";

import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import type { Destination } from "@prisma/client";
import { MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { reorderDestinations } from "@/app/actions/destinations";
import { DestinationCard } from "./destination-card";
import type { RouteSegment } from "./trip-editor";

interface DestinationListProps {
  tripId: string;
  destinations: Destination[];
  routes: RouteSegment[];
  highlightedId: string | null;
  onReorder: (destinations: Destination[]) => void;
  onRemove: (destId: string) => void;
  onHighlight: (destId: string | null) => void;
}

// Custom modifier to restrict drag to vertical axis
const restrictToVerticalAxis: Modifier = ({ transform }) => {
  return {
    ...transform,
    x: 0,
  };
};

function DestinationList({
  tripId,
  destinations,
  routes,
  highlightedId,
  onReorder,
  onRemove,
  onHighlight,
}: DestinationListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = destinations.findIndex((d) => d.id === active.id);
      const newIndex = destinations.findIndex((d) => d.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(destinations, oldIndex, newIndex).map(
        (d, i) => ({ ...d, sortOrder: i }),
      );

      // Optimistic update
      onReorder(reordered);

      try {
        await reorderDestinations(
          tripId,
          reordered.map((d) => d.id),
        );
      } catch {
        // Revert on failure
        onReorder(destinations);
        toast.error("Failed to reorder destinations");
      }
    },
    [destinations, tripId, onReorder],
  );

  function getDriveTimeToNext(destId: string): number | null {
    const route = routes.find((r) => r.fromId === destId);
    return route ? route.duration : null;
  }

  if (destinations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone">
          <MapPin size={24} className="text-muted" />
        </div>
        <p className="text-sm font-medium text-charcoal mb-1">
          No destinations yet
        </p>
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
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={destinations.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2">
          {destinations.map((dest, index) => (
            <DestinationCard
              key={dest.id}
              destination={dest}
              tripId={tripId}
              index={index}
              driveTimeToNext={getDriveTimeToNext(dest.id)}
              isHighlighted={highlightedId === dest.id}
              onRemove={onRemove}
              onHighlight={onHighlight}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export { DestinationList };
