"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { Destination } from "@prisma/client";
import toast from "react-hot-toast";
import { removeDestination, updateDestinationNotes } from "@/app/actions/destinations";
import { DriveTimeBadge } from "./drive-time-badge";

interface DestinationCardProps {
  destination: Destination;
  tripId: string;
  index: number;
  driveTimeToNext: number | null;
  isHighlighted: boolean;
  onRemove: (destId: string) => void;
  onHighlight: (destId: string | null) => void;
}

function DestinationCard({
  destination,
  tripId,
  index,
  driveTimeToNext,
  isHighlighted,
  onRemove,
  onHighlight,
}: DestinationCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(destination.notes);
  const [isDeleting, setIsDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: destination.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const saveNotes = useCallback(
    async (value: string) => {
      try {
        await updateDestinationNotes(destination.id, tripId, value);
      } catch {
        toast.error("Failed to save notes");
      }
    },
    [destination.id, tripId],
  );

  const handleNotesChange = useCallback(
    (value: string) => {
      setNotes(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveNotes(value);
      }, 500);
    },
    [saveNotes],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await removeDestination(destination.id, tripId);
      onRemove(destination.id);
      toast.success(`Removed ${destination.name}`);
    } catch {
      toast.error("Failed to remove destination");
      setIsDeleting(false);
    }
  }, [destination.id, destination.name, tripId, onRemove]);

  return (
    <div className="flex flex-col">
      <div
        ref={setNodeRef}
        style={style}
        className={`
          flex items-start gap-2 rounded-lg border bg-cream p-3
          border-l-4 border-l-terracotta
          transition-all duration-200
          ${isDragging ? "opacity-50 shadow-lg scale-[1.02]" : "shadow-sm"}
          ${isHighlighted ? "ring-2 ring-terracotta/40 bg-stone-light" : "border-border"}
        `}
        onClick={() => onHighlight(destination.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onHighlight(destination.id);
          }
        }}
      >
        {/* Drag handle */}
        <button
          type="button"
          className="mt-1 shrink-0 cursor-grab active:cursor-grabbing text-muted hover:text-charcoal transition-colors touch-none"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>

        {/* Number badge */}
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-terracotta text-white text-xs font-bold">
          {index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-charcoal truncate">
            {destination.name}
          </p>
          <p className="text-xs text-muted truncate mt-0.5">
            {destination.address}
          </p>

          {driveTimeToNext !== null && (
            <div className="mt-1.5">
              <DriveTimeBadge seconds={driveTimeToNext} />
            </div>
          )}

          {/* Notes toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowNotes((v) => !v);
            }}
            className="mt-2 flex items-center gap-1 text-xs text-muted hover:text-charcoal transition-colors cursor-pointer"
          >
            {showNotes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {notes ? "Edit notes" : "Add notes"}
          </button>
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          disabled={isDeleting}
          className="mt-1 shrink-0 text-muted hover:text-danger transition-colors cursor-pointer disabled:opacity-50"
          aria-label={`Remove ${destination.name}`}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Notes section */}
      {showNotes && (
        <div className="ml-12 mr-8 mt-1 animate-fade-in">
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Add notes about this stop..."
            rows={3}
            className="w-full rounded-md border border-border bg-stone-light px-3 py-2 text-sm text-charcoal font-body placeholder:text-muted focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 focus:outline-none resize-none"
          />
        </div>
      )}
    </div>
  );
}

export { DestinationCard };
