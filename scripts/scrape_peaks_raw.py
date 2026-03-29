#!/usr/bin/env python3
"""
Scrape every OSM node tagged  natural=peak  that also carries  name  and  ele
from the Overpass API for the United States (contiguous + Alaska + Hawaii +
Puerto Rico).  Saves raw results to scripts/raw_data/peaks_raw.json.

No filtering is applied here — run build_peaks.py afterwards to apply an
isolation filter and write the final GeoJSON for the app.

Each US region is tiled into 15°×15° bounding-box chunks.  Requests are
distributed across three public Overpass mirrors in round-robin so no single
server is hammered.

Usage:
    pip install requests
    python3 scripts/scrape_peaks_raw.py                 # US, 3 parallel workers
    python3 scripts/scrape_peaks_raw.py --workers 1     # sequential, safest
    python3 scripts/scrape_peaks_raw.py --resume        # skip already-done chunks
    python3 scripts/scrape_peaks_raw.py --chunk-deg 10  # smaller chunks (lower timeout risk)
    python3 scripts/scrape_peaks_raw.py --bbox "-125,24,-66,50"  # custom single bbox
"""

import argparse
import json
import math
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("requests not found — run: pip install requests")

RAW_OUT = Path(__file__).parent / "raw_data" / "peaks_raw.json"
CHECKPOINT = Path(__file__).parent / "raw_data" / "peaks_checkpoint.json"

# Three public Overpass mirrors — requests are round-robined across them.
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

_print_lock = threading.Lock()
_checkpoint_lock = threading.Lock()

# Each worker thread gets a dedicated mirror index so they never share one.
_thread_local = threading.local()


def log(msg: str) -> None:
    with _print_lock:
        print(msg, flush=True)


def mirror_for_thread(worker_id: int) -> str:
    """Assign a fixed mirror to this worker thread (round-robin by worker id)."""
    if not hasattr(_thread_local, "mirror"):
        _thread_local.mirror = MIRRORS[worker_id % len(MIRRORS)]
    return _thread_local.mirror


# ── US regions ────────────────────────────────────────────────────────────────

# (south, west, north, east, label)
US_REGIONS = [
    (24.0, -125.0, 50.0,  -66.0, "Contiguous US"),
    (51.0, -168.0, 72.0, -130.0, "Alaska"),
    (18.0, -161.0, 24.0, -154.0, "Hawaii"),
    (17.8,  -67.9, 18.5,  -65.2, "Puerto Rico"),
]


# ── Chunk generation ──────────────────────────────────────────────────────────

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


# ── Overpass fetch ────────────────────────────────────────────────────────────

def fetch_chunk(south: float, west: float, north: float, east: float,
                mirror: str, retries: int = 4) -> list[dict]:
    """Query Overpass for named peaks with elevation inside the bbox."""
    query = (
        f"[out:json][timeout:120][bbox:{south},{west},{north},{east}];\n"
        f'node["natural"="peak"]["name"]["ele"];\n'
        f"out body;"
    )
    for attempt in range(retries):
        try:
            resp = requests.post(mirror, data={"data": query}, timeout=150)
            if resp.status_code == 200:
                return resp.json().get("elements", [])
            if resp.status_code == 429:
                wait = 30 * (attempt + 1)
                log(f"  429 on {mirror} — waiting {wait}s")
                time.sleep(wait)
                continue
            log(f"  HTTP {resp.status_code} from {mirror} (attempt {attempt + 1}/{retries})")
        except Exception as exc:
            log(f"  Error ({mirror}): {exc} (attempt {attempt + 1}/{retries})")
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


# ── Worker function ───────────────────────────────────────────────────────────

def process_chunk(args_tuple: tuple) -> tuple[tuple, list[dict]]:
    """Fetch one chunk.  Returns (chunk_key, peaks).  Called from thread pool."""
    chunk, worker_id = args_tuple
    south, west, north, east = chunk
    mirror = mirror_for_thread(worker_id)
    elements = fetch_chunk(south, west, north, east, mirror)
    peaks = elements_to_peaks(elements)
    log(f"  ({south:+.0f},{west:+.0f})→({north:+.0f},{east:+.0f})  "
        f"{len(peaks):>5,} peaks  [{mirror.split('/')[2]}]")
    time.sleep(0.5)   # small per-request courtesy delay even in parallel mode
    return chunk, peaks


# ── Checkpoint helpers ────────────────────────────────────────────────────────

def load_checkpoint() -> dict:
    if CHECKPOINT.exists():
        return json.loads(CHECKPOINT.read_text())
    return {"done_chunks": [], "peaks": []}


def save_checkpoint(done_chunks: list, peaks: list[dict]) -> None:
    with _checkpoint_lock:
        CHECKPOINT.write_text(json.dumps({"done_chunks": done_chunks, "peaks": peaks}))


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--workers", type=int, default=3,
                        help="Number of parallel workers (default 3, one per mirror). "
                             "Set to 1 for sequential/safest.")
    parser.add_argument("--resume", action="store_true",
                        help="Skip already-completed chunks using checkpoint file.")
    parser.add_argument("--bbox", metavar="W,S,E,N",
                        help='Restrict to a single bbox, e.g. "-125,24,-66,50".')
    parser.add_argument("--chunk-deg", type=int, default=15,
                        help="Chunk size in degrees (default 15). Smaller = more "
                             "requests but lower per-request timeout risk.")
    args = parser.parse_args()

    RAW_OUT.parent.mkdir(parents=True, exist_ok=True)

    # ── Single bbox mode ──────────────────────────────────────────────────────
    if args.bbox:
        try:
            w, s, e, n = [float(x) for x in args.bbox.split(",")]
        except ValueError:
            sys.exit("--bbox must be W,S,E,N  e.g.  -125,24,-66,50")
        log(f"Single bbox ({s},{w}) → ({n},{e})")
        elements = fetch_chunk(s, w, n, e, MIRRORS[0])
        peaks = elements_to_peaks(elements)
        log(f"  {len(peaks):,} peaks")
        _write_raw(peaks)
        return

    # ── Chunked US mode ───────────────────────────────────────────────────────
    all_chunks = us_chunks(args.chunk_deg)

    if args.resume:
        cp = load_checkpoint()
        done = [tuple(c) for c in cp["done_chunks"]]
        all_peaks: list[dict] = cp["peaks"]
        todo = [c for c in all_chunks if c not in done]
        log(f"Resuming: {len(done)} done, {len(todo)} remaining, "
            f"{len(all_peaks):,} peaks so far")
    else:
        done = []
        all_peaks = []
        todo = all_chunks

    workers = min(args.workers, len(MIRRORS))
    log(f"\nQuerying {len(todo)} chunks with {workers} parallel worker(s) "
        f"across {workers} Overpass mirror(s) …\n")

    # Assign a stable worker_id to each chunk so mirror assignment is deterministic
    work_items = [(chunk, i % workers) for i, chunk in enumerate(todo)]

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(process_chunk, item): item[0] for item in work_items}
        for future in as_completed(futures):
            chunk = futures[future]
            try:
                _, peaks = future.result()
            except Exception as exc:
                log(f"  Chunk {chunk} failed: {exc}")
                peaks = []
            all_peaks.extend(peaks)
            done.append(chunk)
            save_checkpoint(list(done), all_peaks)

    # Deduplicate by OSM id (chunks share edges)
    seen: set[int] = set()
    unique: list[dict] = []
    for p in all_peaks:
        if p["id"] not in seen:
            seen.add(p["id"])
            unique.append(p)

    log(f"\n{len(unique):,} unique named peaks with elevation after dedup")
    _write_raw(unique)

    # Clean up checkpoint on successful full run
    if CHECKPOINT.exists():
        CHECKPOINT.unlink()


def _write_raw(peaks: list[dict]) -> None:
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
    log(f"Wrote {len(peaks):,} raw peaks → {RAW_OUT} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
