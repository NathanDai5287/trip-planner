#!/usr/bin/env python3
"""
Scrape every OSM node tagged  natural=peak  that also carries  name  and  ele
from the Overpass API for the United States (contiguous + Alaska + Hawaii +
Puerto Rico).  Saves raw results to scripts/raw_data/peaks_raw.json.

No filtering is applied here — run build_peaks.py afterwards to apply an
isolation filter and write the final GeoJSON for the app.

Each US region is tiled into 15°×15° bounding-box chunks (~16 total) and
queried sequentially with a short delay between requests.

Usage:
    pip install requests
    python3 scripts/scrape_peaks_raw.py                 # full US run
    python3 scripts/scrape_peaks_raw.py --resume        # skip already-done chunks
    python3 scripts/scrape_peaks_raw.py --chunk-deg 10  # smaller chunks (lower timeout risk)
    python3 scripts/scrape_peaks_raw.py --bbox "-125,24,-66,50"  # custom single bbox
"""

import argparse
import json
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("requests not found — run: pip install requests")

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
RAW_OUT = Path(__file__).parent / "raw_data" / "peaks_raw.json"
CHECKPOINT = Path(__file__).parent / "raw_data" / "peaks_checkpoint.json"

# (south, west, north, east, label)
US_REGIONS = [
    (24.0, -125.0, 50.0,  -66.0, "Contiguous US"),
    (51.0, -168.0, 72.0, -130.0, "Alaska"),
    (18.0, -161.0, 24.0, -154.0, "Hawaii"),
    (17.8,  -67.9, 18.5,  -65.2, "Puerto Rico"),
]


def us_chunks(chunk_deg: int = 15) -> list[tuple[float, float, float, float]]:
    """Tile each US region into chunk_deg×chunk_deg bboxes."""
    chunks = []
    for s, w, n, e, _ in US_REGIONS:
        lat = s
        while lat < n:
            lng = w
            while lng < e:
                chunks.append((lat, lng,
                                min(lat + chunk_deg, n),
                                min(lng + chunk_deg, e)))
                lng += chunk_deg
            lat += chunk_deg
    return chunks


def fetch_chunk(south: float, west: float, north: float, east: float,
                retries: int = 4) -> list[dict]:
    """Query Overpass for named peaks with elevation inside the bbox."""
    query = (
        f"[out:json][timeout:120][bbox:{south},{west},{north},{east}];\n"
        f'node["natural"="peak"]["name"]["ele"];\n'
        f"out body;"
    )
    for attempt in range(retries):
        try:
            resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=150)
            if resp.status_code == 200:
                return resp.json().get("elements", [])
            if resp.status_code == 429:
                wait = 30 * (attempt + 1)
                print(f"  429 rate-limited — waiting {wait}s …")
                time.sleep(wait)
                continue
            print(f"  HTTP {resp.status_code} (attempt {attempt + 1}/{retries})")
        except Exception as exc:
            print(f"  Error: {exc} (attempt {attempt + 1}/{retries})")
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
    try:
        return float(raw.split()[0])
    except (ValueError, IndexError):
        return None


def elements_to_peaks(elements: list[dict]) -> list[dict]:
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
        peak: dict = {
            "id": el["id"],
            "name": name,
            "lat": el["lat"],
            "lng": el["lon"],
            "ele": ele,
        }
        if tags.get("wikidata"):
            peak["wikidata"] = tags["wikidata"]
        if tags.get("wikipedia"):
            peak["wikipedia"] = tags["wikipedia"]
        peaks.append(peak)
    return peaks


def load_checkpoint() -> dict:
    if CHECKPOINT.exists():
        return json.loads(CHECKPOINT.read_text())
    return {"done_chunks": [], "peaks": []}


def save_checkpoint(done_chunks: list, peaks: list[dict]) -> None:
    CHECKPOINT.write_text(json.dumps({"done_chunks": done_chunks, "peaks": peaks}))


def write_raw(peaks: list[dict]) -> None:
    out = {
        "peaks": peaks,
        "metadata": {
            "source": "OpenStreetMap via Overpass API",
            "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total": len(peaks),
        },
    }
    RAW_OUT.write_text(json.dumps(out, separators=(",", ":")))
    size_mb = RAW_OUT.stat().st_size / 1_048_576
    print(f"Wrote {len(peaks):,} raw peaks → {RAW_OUT} ({size_mb:.1f} MB)")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--resume", action="store_true",
                        help="Skip already-completed chunks (reads checkpoint file).")
    parser.add_argument("--chunk-deg", type=int, default=15,
                        help="Chunk size in degrees (default 15). Smaller = more "
                             "requests but lower per-request timeout risk.")
    parser.add_argument("--bbox", metavar="W,S,E,N",
                        help='Query a single custom bbox instead of the US regions, '
                             'e.g. "-125,24,-66,50".')
    args = parser.parse_args()

    RAW_OUT.parent.mkdir(parents=True, exist_ok=True)

    # ── Single bbox mode ──────────────────────────────────────────────────────
    if args.bbox:
        try:
            w, s, e, n = [float(x) for x in args.bbox.split(",")]
        except ValueError:
            sys.exit("--bbox must be W,S,E,N  e.g.  -125,24,-66,50")
        print(f"Querying single bbox ({s},{w}) → ({n},{e}) …")
        elements = fetch_chunk(s, w, n, e)
        peaks = elements_to_peaks(elements)
        print(f"  {len(peaks):,} peaks")
        write_raw(peaks)
        return

    # ── Chunked US mode ───────────────────────────────────────────────────────
    all_chunks = us_chunks(args.chunk_deg)

    if args.resume:
        cp = load_checkpoint()
        done = [tuple(c) for c in cp["done_chunks"]]
        all_peaks: list[dict] = cp["peaks"]
        todo = [c for c in all_chunks if c not in done]
        print(f"Resuming: {len(done)} done, {len(todo)} remaining, "
              f"{len(all_peaks):,} peaks so far")
    else:
        done = []
        all_peaks = []
        todo = all_chunks

    total = len(todo)
    print(f"Querying {total} chunks sequentially …\n")

    for i, (south, west, north, east) in enumerate(todo, 1):
        print(f"[{i}/{total}]  ({south:+.1f},{west:+.1f}) → ({north:+.1f},{east:+.1f}) … ",
              end="", flush=True)
        elements = fetch_chunk(south, west, north, east)
        peaks = elements_to_peaks(elements)
        all_peaks.extend(peaks)
        done.append((south, west, north, east))
        print(f"{len(peaks):,} peaks  (running total: {len(all_peaks):,})")
        save_checkpoint(list(done), all_peaks)
        time.sleep(2)

    # Deduplicate by OSM id (chunk edges overlap slightly)
    seen: set[int] = set()
    unique: list[dict] = []
    for p in all_peaks:
        if p["id"] not in seen:
            seen.add(p["id"])
            unique.append(p)

    print(f"\n{len(unique):,} unique named peaks after dedup")
    write_raw(unique)

    if CHECKPOINT.exists():
        CHECKPOINT.unlink()


if __name__ == "__main__":
    main()
