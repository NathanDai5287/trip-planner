"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, BookOpen, Tent } from "lucide-react";
import type { Destination, DestinationCategory } from "@/lib/types";
import toast from "react-hot-toast";
import { updateDestinationNotes } from "@/lib/firestore";

const CATEGORY_CONFIG = {
  library:  { icon: BookOpen, bg: "bg-orange-600",  label: "Library" },
  campsite: { icon: Tent,     bg: "bg-emerald-700", label: "Campsite" },
} as const;

interface DestinationCardProps {
  destination: Destination;
  tripId: string;
  index: number;
  isHighlighted: boolean;
  onRemove: (destId: string) => void;
  onHighlight: (destId: string | null) => void;
  onCategoryChange: (destId: string, category: DestinationCategory | null) => void;
}

function DestinationCard({
  destination,
  tripId,
  index,
  isHighlighted,
  onRemove,
  onHighlight,
  onCategoryChange,
}: DestinationCardProps) {
  const [notes, setNotes] = useState(destination.notes);
  const [editingNotes, setEditingNotes] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesRef = useRef(notes);

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
        await updateDestinationNotes(tripId, destination.id, value);
      } catch {
        toast.error("Failed to save notes");
      }
    },
    [destination.id, tripId],
  );

  const handleNotesChange = useCallback(
    (value: string) => {
      setNotes(value);
      notesRef.current = value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => saveNotes(value), 500);
    },
    [saveNotes],
  );

  const exitEditing = useCallback(() => {
    setEditingNotes(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      saveNotes(notesRef.current);
    }
  }, [saveNotes]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  useEffect(() => {
    if (!showCategoryMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setShowCategoryMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCategoryMenu]);

  const handleCategorySelect = useCallback(
    (category: DestinationCategory | null) => {
      setShowCategoryMenu(false);
      onCategoryChange(destination.id, category);
    },
    [destination.id, onCategoryChange],
  );

  const handleDelete = useCallback(() => {
    onRemove(destination.id);
  }, [destination.id, onRemove]);

  return (
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
      <button
        type="button"
        className="mt-1 shrink-0 cursor-grab active:cursor-grabbing text-muted hover:text-charcoal transition-colors touch-none"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>

      <div className="relative" ref={categoryMenuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowCategoryMenu((v) => !v);
          }}
          className={`
            mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full
            text-white text-xs font-bold transition-colors cursor-pointer
            ${destination.category ? CATEGORY_CONFIG[destination.category].bg : "bg-terracotta"}
          `}
          aria-label="Set destination category"
        >
          {destination.category
            ? (() => { const Icon = CATEGORY_CONFIG[destination.category!].icon; return <Icon size={12} />; })()
            : index + 1}
        </button>

        {showCategoryMenu && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-cream border border-border rounded-lg shadow-lg py-1 min-w-[130px]">
            {([
              { key: "library",  cat: "library"  as DestinationCategory },
              { key: "campsite", cat: "campsite" as DestinationCategory },
              { key: "none",     cat: null },
            ]).map(({ key, cat }) => {
              const isActive = (destination.category ?? null) === cat;
              const config = cat ? CATEGORY_CONFIG[cat] : null;
              const Icon = config?.icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCategorySelect(cat);
                  }}
                  className={`
                    flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors cursor-pointer
                    ${isActive ? "bg-stone-light text-charcoal font-medium" : "text-muted hover:bg-stone-light hover:text-charcoal"}
                  `}
                >
                  {Icon ? <Icon size={12} /> : <span className="w-3" />}
                  {cat ? config!.label : "None"}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-charcoal truncate">
          {destination.name}
        </p>
        <p className="text-xs text-muted truncate mt-0.5">
          {destination.address}
        </p>

        {/* Notes area */}
        {editingNotes ? (
          <textarea
            autoFocus
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            onBlur={exitEditing}
            placeholder="Add notes about this stop..."
            rows={3}
            className="mt-1.5 w-full rounded border border-border bg-stone px-2 py-1.5 text-xs text-charcoal font-body placeholder:text-muted focus:border-terracotta focus:ring-1 focus:ring-terracotta/20 focus:outline-none resize-none"
          />
        ) : notes ? (
          <p
            className="mt-1.5 text-xs text-charcoal whitespace-pre-wrap cursor-text"
            onClick={(e) => { e.stopPropagation(); setEditingNotes(true); }}
          >
            {notes}
          </p>
        ) : (
          <p
            className="mt-1.5 text-xs text-muted italic cursor-text"
            onClick={(e) => { e.stopPropagation(); setEditingNotes(true); }}
          >
            Add notes...
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleDelete(); }}
        className="mt-1 shrink-0 text-muted hover:text-danger transition-colors cursor-pointer"
        aria-label={`Remove ${destination.name}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export { DestinationCard };
