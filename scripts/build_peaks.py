#!/usr/bin/env python3
"""
Build public/data/peaks.geojson from scripts/raw_data/peaks_raw.json.

Applies an isolation filter: a peak is kept only if no taller already-kept
peak is within --radius km.  This approximates topographic prominence —
peaks that dominate their local neighbourhood — without needing raw DEM data.

Run scrape_peaks_raw.py first to populate the raw data file.

Usage:
    python3 scripts/build_peaks.py                  # default 15 km radius
    python3 scripts/build_peaks.py --radius 10      # denser  (more peaks)
    python3 scripts/build_peaks.py --radius 25      # sparser (fewer peaks)
    python3 scripts/build_peaks.py --min-ele 500    # also require ≥500 m elevation
    python3 scripts/build_peaks.py --stats          # print distribution, don't write

Isolation filter algorithm
--------------------------
Sort all peaks by elevation descending.  Maintain a spatial grid (cell size
≈ radius / 1.2).  For each peak, check whether any already-kept peak in the
surrounding 3×3 grid neighbourhood is within --radius km.  If yes, discard.
Otherwise keep it and register it in the grid.  O(n) amortised.
"""

import argparse
import json
import math
import sys
import time
from pathlib import Path

RAW_IN = Path(__file__).parent / "raw_data" / "peaks_raw.json"
OUT_FILE = Path(__file__).parent.parent / "public" / "data" / "peaks.geojson"


# ── Haversine ─────────────────────────────────────────────────────────────────

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Isolation filter ──────────────────────────────────────────────────────────

def isolation_filter(peaks: list[dict], radius_km: float) -> list[dict]:
    """
    Greedy isolation filter.  Process peaks highest-first; keep a peak only
    if no already-kept peak is within radius_km.
    """
    if not peaks:
        return []

    # Grid cell slightly smaller than radius so a 3×3 neighbourhood is always
    # sufficient to find any kept peak within radius.
    cell_deg = (radius_km / 111.0) * 0.85
    grid: dict[tuple[int, int], list[dict]] = {}

    def cell_key(lat: float, lng: float) -> tuple[int, int]:
        return (int(lat / cell_deg), int(lng / cell_deg))

    sorted_peaks = sorted(peaks, key=lambda p: p["ele"], reverse=True)
    kept: list[dict] = []

    for peak in sorted_peaks:
        lat, lng = peak["lat"], peak["lng"]
        row, col = cell_key(lat, lng)

        dominated = False
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                for other in grid.get((row + dr, col + dc), []):
                    if haversine_km(lat, lng, other["lat"], other["lng"]) <= radius_km:
                        dominated = True
                        break
                if dominated:
                    break
            if dominated:
                break

        if not dominated:
            kept.append(peak)
            grid.setdefault((row, col), []).append(peak)

    return kept


# ── Stats helper ──────────────────────────────────────────────────────────────

def print_stats(peaks: list[dict], label: str = "") -> None:
    if not peaks:
        print(f"{label}: 0 peaks")
        return
    eles = sorted(p["ele"] for p in peaks)
    n = len(eles)
    print(f"{label}: {n:,} peaks")
    for pct, name in [(0, "min"), (25, "p25"), (50, "median"), (75, "p75"), (90, "p90"), (99, "p99"), (100, "max")]:
        idx = min(int(pct / 100 * n), n - 1)
        print(f"  {name:>7}: {eles[idx]:,.0f} m")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--radius", type=float, default=15.0,
                        help="Isolation radius in km (default 15). "
                             "Larger → fewer peaks kept.")
    parser.add_argument("--min-ele", type=float, default=0.0,
                        help="Discard peaks below this elevation in metres "
                             "before filtering (default 0 = keep all).")
    parser.add_argument("--stats", action="store_true",
                        help="Print elevation distribution stats and exit "
                             "without writing the output file.")
    parser.add_argument("--input", type=Path, default=RAW_IN,
                        help=f"Raw peaks JSON (default: {RAW_IN})")
    parser.add_argument("--output", type=Path, default=OUT_FILE,
                        help=f"Output GeoJSON (default: {OUT_FILE})")
    args = parser.parse_args()

    if not args.input.exists():
        sys.exit(f"Raw data not found: {args.input}\n"
                 "Run  python3 scripts/scrape_peaks_raw.py  first.")

    print(f"Loading {args.input} …")
    raw = json.loads(args.input.read_text())
    peaks: list[dict] = raw["peaks"]
    print(f"  {len(peaks):,} raw peaks loaded")

    # Optional elevation pre-filter
    if args.min_ele > 0:
        peaks = [p for p in peaks if p["ele"] >= args.min_ele]
        print(f"  {len(peaks):,} after --min-ele {args.min_ele} m filter")

    if args.stats:
        print_stats(peaks, "Before isolation filter")
        # Show what different radii would yield
        for r in (5, 10, 15, 20, 30, 50):
            kept = isolation_filter(peaks, radius_km=r)
            print(f"  radius {r:>3} km → {len(kept):>7,} peaks")
        return

    # Apply isolation filter
    print(f"\nApplying isolation filter (radius = {args.radius} km) …")
    t0 = time.perf_counter()
    filtered = isolation_filter(peaks, radius_km=args.radius)
    elapsed = time.perf_counter() - t0
    print(f"  {len(filtered):,} peaks kept  ({elapsed:.1f}s)")

    print_stats(filtered, "Output")

    # Build GeoJSON
    features = []
    for p in filtered:
        props: dict = {
            "name": p["name"],
            "ele": p["ele"],
            "type": "peak",
        }
        if p.get("wikidata"):
            props["wikidata"] = p["wikidata"]
        if p.get("wikipedia"):
            props["wikipedia"] = p["wikipedia"]

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [p["lng"], p["lat"]]},
            "properties": props,
        })

    geojson = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "source": "OpenStreetMap via Overpass API",
            "isolation_radius_km": args.radius,
            "min_ele_m": args.min_ele,
            "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total": len(features),
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(geojson, separators=(",", ":")))
    size_mb = args.output.stat().st_size / 1_048_576
    print(f"\nWrote {len(features):,} peaks → {args.output} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
