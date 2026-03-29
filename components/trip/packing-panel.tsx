"use client";

import { useState, useCallback, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import type { PackingItem } from "@/lib/types";
import { updatePackingList } from "@/lib/firestore";
import toast from "react-hot-toast";

interface PackingPanelProps {
  tripId: string;
  items: PackingItem[];
  onChange: (items: PackingItem[]) => void;
}

export function PackingPanel({ tripId, items, onChange }: PackingPanelProps) {
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const save = useCallback(
    (next: PackingItem[]) => {
      onChange(next);
      updatePackingList(tripId, next).catch(() => toast.error("Failed to save packing list"));
    },
    [tripId, onChange],
  );

  const handleAdd = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    const next = [...items, { id: nanoid(), text, checked: false }];
    save(next);
    setInputText("");
    inputRef.current?.focus();
  }, [inputText, items, save]);

  const handleToggle = useCallback(
    (id: string) => {
      save(items.map((item) => item.id === id ? { ...item, checked: !item.checked } : item));
    },
    [items, save],
  );

  const handleDelete = useCallback(
    (id: string) => {
      save(items.filter((item) => item.id !== id));
    },
    [items, save],
  );

  const handleClearChecked = useCallback(() => {
    save(items.filter((item) => !item.checked));
  }, [items, save]);

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <div className="pt-3 flex flex-col gap-3">
      {/* Add input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Add an item..."
          className="flex-1 rounded-md border border-border bg-stone px-3 py-1.5 text-sm text-charcoal placeholder:text-muted focus:border-terracotta focus:ring-1 focus:ring-terracotta/20 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!inputText.trim()}
          className="flex items-center justify-center h-8 w-8 rounded-md bg-terracotta text-white hover:bg-terracotta/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Unchecked items */}
      {unchecked.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {unchecked.map((item) => (
            <PackingRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Checked items */}
      {checked.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted uppercase tracking-wide font-medium">
              Packed ({checked.length})
            </span>
            <button
              type="button"
              onClick={handleClearChecked}
              className="text-xs text-muted hover:text-danger transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-col gap-0.5">
            {checked.map((item) => (
              <PackingRow key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-xs text-muted italic text-center py-6">
          Nothing added yet. Type above to start your packing list.
        </p>
      )}
    </div>
  );
}

function PackingRow({
  item,
  onToggle,
  onDelete,
}: {
  item: PackingItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1 group">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={() => onToggle(item.id)}
        className="rounded border-border text-terracotta focus:ring-terracotta/20 cursor-pointer"
      />
      <span className={`flex-1 text-sm ${item.checked ? "line-through text-muted" : "text-charcoal"}`}>
        {item.text}
      </span>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition-all cursor-pointer"
        aria-label={`Remove ${item.text}`}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
