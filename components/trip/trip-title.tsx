"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { updateTripFields } from "@/lib/firestore";

interface TripTitleProps {
  tripId: string;
  initialTitle: string;
}

function TripTitle({ tripId, initialTitle }: TripTitleProps) {
  const [title, setTitle] = useState(initialTitle);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveTitle = useCallback(
    async (newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed || trimmed === initialTitle) return;

      try {
        await updateTripFields(tripId, { title: trimmed });
      } catch {
        toast.error("Failed to update title");
        setTitle(initialTitle);
      }
    },
    [tripId, initialTitle],
  );

  const handleChange = useCallback(
    (value: string) => {
      setTitle(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveTitle(value);
      }, 500);
    },
    [saveTitle],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    saveTitle(title);
  }, [title, saveTitle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleBlur();
      }
      if (e.key === "Escape") {
        setTitle(initialTitle);
        setIsEditing(false);
      }
    },
    [handleBlur, initialTitle],
  );

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full font-display text-2xl font-semibold text-charcoal bg-transparent border-b-2 border-terracotta outline-none pb-1"
        maxLength={100}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex items-center gap-2 w-full text-left cursor-pointer"
    >
      <h1 className="font-display text-2xl font-semibold text-charcoal truncate">
        {title}
      </h1>
      <Pencil
        size={16}
        className="text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      />
    </button>
  );
}

export { TripTitle };
