"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { Destination } from "@/lib/types";
import { addDestination } from "@/lib/firestore";

interface NominatimResult {
  place_id: number;
  osm_id: number;
  osm_type: string;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
}

interface PlaceSearchProps {
  tripId: string;
  onDestinationAdded: (dest: Destination) => void;
}

function PlaceSearch({ tripId, onDestinationAdded }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchPlaces = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/nominatim?q=${encodeURIComponent(q.trim())}`,
      );
      if (!res.ok) throw new Error("Search failed");
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setIsOpen(data.length > 0);
    } catch {
      toast.error("Failed to search places");
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        searchPlaces(value);
      }, 300);
    },
    [searchPlaces],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectResult = useCallback(
    async (result: NominatimResult) => {
      setIsAdding(true);
      try {
        const dest = await addDestination(tripId, {
          osmId: `${result.osm_type}/${result.osm_id}`,
          name: result.name || result.display_name.split(",")[0],
          address: result.display_name,
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
        });
        onDestinationAdded(dest);
        setQuery("");
        setResults([]);
        setIsOpen(false);
      } catch {
        toast.error("Failed to add destination");
      } finally {
        setIsAdding(false);
      }
    },
    [tripId, onDestinationAdded],
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search for a place..."
          disabled={isAdding}
          className="w-full rounded-lg border border-border bg-cream pl-9 pr-9 py-2.5 text-sm text-charcoal font-body placeholder:text-muted transition-colors duration-150 focus:bg-stone-light focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 focus:outline-none disabled:opacity-50"
        />
        {isLoading && (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted animate-spin"
          />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-cream shadow-lg">
          {results.map((result) => (
            <button
              key={result.place_id}
              type="button"
              onClick={() => handleSelectResult(result)}
              disabled={isAdding}
              className="w-full text-left px-4 py-3 hover:bg-stone-light transition-colors border-b border-border/50 last:border-b-0 cursor-pointer disabled:opacity-50"
            >
              <p className="text-sm font-medium text-charcoal truncate">
                {result.name || result.display_name.split(",")[0]}
              </p>
              <p className="text-xs text-muted truncate mt-0.5">
                {result.display_name}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { PlaceSearch };
