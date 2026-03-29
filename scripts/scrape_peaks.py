#!/usr/bin/env python3
"""
Scrape mountain peaks from OpenStreetMap via the Overpass API, then apply
an isolation filter so only the tallest peak within a given radius is kept.
This approximates topographic prominence without needing raw DEM data.

The world is queried in 30°×30° bounding-box chunks.  Each chunk fetches all
OSM nodes tagged  natural=peak  that also carry  name  and  ele  attributes.
After collection, a greedy isolation filter removes any peak that is dominated
by a taller neighbour within --radius km.

Outputs: public/data/peaks.geojson

Usage:
    pip install requests
    python3 scripts/scrape_peaks.py                  # full world, 15 km radius
    python3 scripts/scrape_peaks.py --radius 20      # looser filter → fewer peaks
    python3 scripts/scrape_peaks.py --radius 8       # tighter filter → more peaks
    python3 scripts/scrape_peaks.py --resume         # skip already-fetched chunks
    python3 scripts/scrape_peaks.py --bbox "-125,24,-66,50"  # contiguous US only

Isolation filter algorithm
--------------------------
Sort all collected peaks by elevation descending.  Maintain a spatial grid
(cell size ≈ radius).  For each peak, check whether any already-kept peak
falls within --radius km.  If yes, skip (it is "dominated").  Otherwise keep
it and add it to the grid.  O(n) amortised thanks to the grid index.
"""

import argparse
import json
import math
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("requests not found — run: pip install requests")

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "data" / "peaks.geojson"
CHECKPOINT_PATH = Path(__file__).parent / ".peaks_checkpoint.json"

# 30°×30° chunks covering the whole world (lng -180→180, lat -90→90)
# Overpass uses (south, west, north, east) order.
def world_chunks(chunk_deg: int = 30):
    chunks = []
    for lat in range(-90, 90, chunk_deg):
        for lng in range(-180, 180, chunk_deg):
            chunks.append((lat, lng, lat + chunk_deg, lng + chunk_deg))
    return chunks


# ── Haversine distance ────────────────────────────────────────────────────────

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Overpass query ────────────────────────────────────────────────────────────

def query_chunk(south: float, west: float, north: float, east: float,
                retries: int = 4) -> list[dict]:
    """Return a list of raw peak dicts for the given bounding box."""
    query = (
        f"[out:json][timeout:120][bbox:{south},{west},{north},{east}];\n"
        f'node["natural"="peak"]["name"]["ele"];\n'
        f"out body;"
    )
    for attempt in range(retries):
        try:
            resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=150)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("elements", [])
            if resp.status_code == 429:
                wait = 30 * (attempt + 1)
                print(f"    429 rate-limited, waiting {wait}s …")
                time.sleep(wait)
                continue
            print(f"    HTTP {resp.status_code} (attempt {attempt + 1}/{retries})")
        except Exception as exc:
            print(f"    Error: {exc} (attempt {attempt + 1}/{retries})")
        time.sleep(5 * (attempt + 1))
    return []


def parse_ele(raw: str) -> float | None:
    """Parse an OSM ele tag.  Handles '1234', '1234 m', '1234.5', '4050ft'."""
    raw = raw.strip().lower().replace(",", ".")
    if raw.endswith("ft"):
        try:
            return round(float(raw[:-2].strip()) * 0.3048, 1)
        except ValueError:
            return None
    # Drop trailing units like ' m'
    num = raw.split()[0]
    try:
        return float(num)
    except ValueError:
        return None


def collect_peaks(elements: list[dict]) -> list[dict]:
    """Convert Overpass elements to clean peak dicts."""
    peaks = []
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name", "").strip()
        ele_raw = tags.get("ele", "").strip()
        if not name or not ele_raw:
            continue
        ele = parse_ele(ele_raw)
        if ele is None or ele < 0:
            continue
        peaks.append({
            "id": el["id"],
            "name": name,
            "lat": el["lat"],
            "lng": el["lon"],
            "ele": ele,
            "wikidata": tags.get("wikidata"),
            "wikipedia": tags.get("wikipedia"),
        })
    return peaks


# ── Isolation filter ──────────────────────────────────────────────────────────

def isolation_filter(peaks: list[dict], radius_km: float = 15.0) -> list[dict]:
    """
    Keep a peak only if no taller already-kept peak is within radius_km.
    Uses a spatial grid for O(n) average-case performance.
    """
    if not peaks:
        return []

    # Grid cell slightly smaller than radius so 3×3 neighbourhood is sufficient
    cell_deg = (radius_km / 111.0) * 0.85
    grid: dict[tuple[int, int], list[dict]] = {}

    def cell_key(lat: float, lng: float) -> tuple[int, int]:
        return (int(lat / cell_deg), int(lng / cell_deg))

    # Process highest peaks first
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


# ── Checkpoint helpers ────────────────────────────────────────────────────────

def load_checkpoint() -> dict:
    if CHECKPOINT_PATH.exists():
        return json.loads(CHECKPOINT_PATH.read_text())
    return {"done_chunks": [], "raw_peaks": []}


def save_checkpoint(done_chunks: list, raw_peaks: list[dict]):
    CHECKPOINT_PATH.write_text(
        json.dumps({"done_chunks": done_chunks, "raw_peaks": raw_peaks})
    )


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--radius", type=float, default=15.0,
                        help="Isolation radius in km (default 15). "
                             "Larger = fewer peaks kept.")
    parser.add_argument("--resume", action="store_true",
                        help="Skip already-fetched chunks (reads checkpoint file).")
    parser.add_argument("--bbox", metavar="W,S,E,N",
                        help="Restrict to a single bounding box, e.g. "
                             '"-125,24,-66,50" for the contiguous US. '
                             "Skips chunking entirely.")
    parser.add_argument("--chunk-deg", type=int, default=30,
                        help="Chunk size in degrees (default 30). Smaller = "
                             "more requests but lower timeout risk.")
    args = parser.parse_args()

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # ── Single bbox mode ──────────────────────────────────────────────────────
    if args.bbox:
        try:
            w, s, e, n = [float(x) for x in args.bbox.split(",")]
        except ValueError:
            sys.exit("--bbox must be four comma-separated floats: W,S,E,N")
        print(f"Querying single bbox ({s},{w} → {n},{e}) …")
        elements = query_chunk(s, w, n, e)
        raw_peaks = collect_peaks(elements)
        print(f"  {len(raw_peaks):,} named peaks with elevation")
        done_chunks_list: list = []

    # ── Chunked world mode ────────────────────────────────────────────────────
    else:
        chunks = world_chunks(args.chunk_deg)

        if args.resume:
            cp = load_checkpoint()
            done_chunks_list = cp["done_chunks"]
            raw_peaks = cp["raw_peaks"]
            todo = [c for c in chunks if list(c) not in done_chunks_list]
            print(f"Resuming: {len(done_chunks_list)} chunks done, "
                  f"{len(todo)} remaining, {len(raw_peaks):,} peaks so far")
        else:
            done_chunks_list = []
            raw_peaks = []
            todo = chunks

        total = len(todo)
        for i, (south, west, north, east) in enumerate(todo, 1):
            print(f"[{i}/{total}] bbox ({south},{west}) → ({north},{east}) …", end=" ", flush=True)
            elements = query_chunk(south, west, north, east)
            chunk_peaks = collect_peaks(elements)
            raw_peaks.extend(chunk_peaks)
            done_chunks_list.append([south, west, north, east])
            print(f"{len(chunk_peaks):,} peaks  (total {len(raw_peaks):,})")
            save_checkpoint(done_chunks_list, raw_peaks)
            time.sleep(1.5)  # be polite to the Overpass servers

    # ── Dedup by OSM id (chunks overlap at edges) ─────────────────────────────
    seen: set[int] = set()
    unique: list[dict] = []
    for p in raw_peaks:
        if p["id"] not in seen:
            seen.add(p["id"])
            unique.append(p)
    print(f"\n{len(unique):,} unique named peaks with elevation")

    # ── Isolation filter ──────────────────────────────────────────────────────
    print(f"Applying isolation filter (radius = {args.radius} km) …")
    filtered = isolation_filter(unique, radius_km=args.radius)
    print(f"{len(filtered):,} peaks survive the filter")

    # ── Write GeoJSON ─────────────────────────────────────────────────────────
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
            "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total": len(features),
        },
    }

    OUTPUT_PATH.write_text(json.dumps(geojson, separators=(",", ":")))
    size_mb = OUTPUT_PATH.stat().st_size / 1_048_576
    print(f"\nWrote {len(features):,} peaks → {OUTPUT_PATH} ({size_mb:.1f} MB)")

    # Clean up checkpoint on successful full-world run
    if not args.bbox and not args.resume and CHECKPOINT_PATH.exists():
        CHECKPOINT_PATH.unlink()


if __name__ == "__main__":
    main()
