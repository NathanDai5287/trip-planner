#!/usr/bin/env python3
"""
Scrape all Planet Fitness locations from planetfitness.com.
Outputs: public/data/planet_fitness.geojson

Uses curl_cffi to impersonate Chrome's TLS fingerprint and bypass Cloudflare.
Lat/lng is extracted directly from page HTML — no geocoding needed.

Usage:
    pip install curl_cffi beautifulsoup4 --break-system-packages
    python3 scripts/scrape_planet_fitness.py

    # Run in parallel (faster, slight rate-limit risk):
    python3 scripts/scrape_planet_fitness.py --parallel
    python3 scripts/scrape_planet_fitness.py --parallel --workers 12

    # Resume from a checkpoint:
    python3 scripts/scrape_planet_fitness.py --resume

    # Single state for testing:
    python3 scripts/scrape_planet_fitness.py --state ca
"""

import argparse
import json
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from bs4 import BeautifulSoup
from curl_cffi import requests as cffi_requests

BASE_URL = "https://www.planetfitness.com"
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "data" / "planet_fitness.geojson"
CHECKPOINT_PATH = Path(__file__).parent / ".pf_checkpoint.json"

US_STATES = [
    "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga",
    "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me", "md",
    "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj",
    "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc",
    "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy",
    "dc", "pr",
]

# Sequential mode uses a single shared session.
# Parallel mode uses thread-local sessions (curl_cffi isn't thread-safe).
SESSION = cffi_requests.Session(impersonate="chrome124")
_thread_local = threading.local()
_print_lock = threading.Lock()


def thread_session() -> cffi_requests.Session:
    if not hasattr(_thread_local, "session"):
        _thread_local.session = cffi_requests.Session(impersonate="chrome124")
    return _thread_local.session


def log(msg: str):
    with _print_lock:
        print(msg)


def fetch(url: str, retries: int = 3, parallel: bool = False) -> BeautifulSoup | None:
    session = thread_session() if parallel else SESSION
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=15)
            if resp.status_code == 200:
                return BeautifulSoup(resp.text, "html.parser")
            if resp.status_code == 404:
                return None
            if resp.status_code == 429:
                wait = 10 * (attempt + 1)
                log(f"  429 rate limited on {url}, waiting {wait}s")
                time.sleep(wait)
                continue
            log(f"  HTTP {resp.status_code} for {url}, attempt {attempt + 1}/{retries}")
        except Exception as e:
            log(f"  Error: {e}, attempt {attempt + 1}/{retries}")
        time.sleep(2 * (attempt + 1))
    return None


def extract_latlong_from_maps_url(maps_url: str) -> tuple[float, float] | None:
    match = re.search(r"/@(-?\d+\.\d+),(-?\d+\.\d+)", maps_url)
    if match:
        return float(match.group(1)), float(match.group(2))
    return None


def extract_latlong_from_gym_href(href: str) -> tuple[float, float] | None:
    lat_match = re.search(r"[?&]lat=(-?\d+\.\d+)", href)
    lng_match = re.search(r"[?&]long=(-?\d+\.\d+)", href)
    if lat_match and lng_match:
        return float(lat_match.group(1)), float(lng_match.group(1))
    return None


def parse_single_gym_page(url: str, slug: str, parallel: bool = False) -> dict | None:
    soup = fetch(url, parallel=parallel)
    if not soup:
        return None

    lat, lng = None, None
    address = ""

    maps_link = soup.find("a", href=re.compile(r"google\.com/maps"))
    if maps_link:
        coords = extract_latlong_from_maps_url(maps_link["href"])
        if coords:
            lat, lng = coords
        address = maps_link.get("aria-label", "").strip()

    if not address:
        addr_link = soup.find("a", {"aria-label": re.compile(r"\d+.*,.*[A-Z]{2}\s+\d{5}")})
        if addr_link:
            address = addr_link.get("aria-label", "").strip()

    name = "Planet Fitness"
    h1 = soup.find("h1")
    if h1:
        text = h1.get_text(strip=True)
        if text:
            name = text

    if lat is None or lng is None:
        card_link = soup.find("a", href=re.compile(r"/gyms/\?lat="))
        if card_link:
            coords = extract_latlong_from_gym_href(card_link["href"])
            if coords:
                lat, lng = coords

    if lat is None or lng is None:
        log(f"  WARNING: no coordinates found for {url}")
        return None

    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
        "properties": {
            "name": name,
            "address": address,
            "slug": slug,
            "url": url,
            "brand": "Planet Fitness",
        },
    }


def parse_multi_gym_page(url: str, parallel: bool = False) -> list[dict]:
    soup = fetch(url, parallel=parallel)
    if not soup:
        return []

    locations = []
    cards = soup.find_all("a", href=re.compile(r"/gyms/\?lat="))
    for card in cards:
        href = card.get("href", "")
        coords = extract_latlong_from_gym_href(href)
        if not coords:
            continue
        lat, lng = coords
        address = card.get("aria-label", "").strip()

        parent = card.find_parent("div")
        name = "Planet Fitness"
        if parent:
            b_tag = parent.find("b")
            if b_tag:
                name = b_tag.get_text(strip=True)

        details_link = None
        if parent:
            details_link = parent.find("a", string=re.compile(r"Club Details", re.I))
        slug = ""
        gym_url = ""
        if details_link:
            slug = details_link["href"].removeprefix("/gyms/")
            gym_url = BASE_URL + details_link["href"]

        locations.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {
                "name": name,
                "address": address,
                "slug": slug,
                "url": gym_url,
                "brand": "Planet Fitness",
            },
        })

    return locations


def process_city_href(href: str) -> list[dict]:
    """Used by thread pool — each call fetches one city URL."""
    full_url = BASE_URL + href
    if href.startswith("/clubs/"):
        gyms = parse_multi_gym_page(full_url, parallel=True)
        log(f"  {href} → {len(gyms)}")
        return gyms
    elif href.startswith("/gyms/"):
        slug = href.removeprefix("/gyms/")
        gym = parse_single_gym_page(full_url, slug, parallel=True)
        if gym:
            log(f"  {href} → 1")
            return [gym]
        log(f"  {href} → 0 (failed)")
    return []


def scrape_state(state: str, parallel: bool = False, workers: int = 8) -> list[dict]:
    state_url = f"{BASE_URL}/clubs/{state}"
    log(f"\n[{state.upper()}] {state_url}")
    soup = fetch(state_url)
    if not soup:
        log(f"  Could not load state page")
        return []

    city_links = soup.select("ul li a[href]")
    if not city_links:
        log(f"  No city links found")
        return []

    hrefs = [
        link["href"] for link in city_links
        if link.get("href", "").startswith(("/gyms/", "/clubs/"))
    ]
    log(f"  {len(hrefs)} locations to fetch {'(parallel)' if parallel else '(sequential)'}")

    locations = []

    if parallel:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(process_city_href, href): href for href in hrefs}
            for future in as_completed(futures):
                try:
                    locations.extend(future.result())
                except Exception as e:
                    log(f"  Error on {futures[future]}: {e}")
    else:
        for href in hrefs:
            full_url = BASE_URL + href
            if href.startswith("/clubs/"):
                gyms = parse_multi_gym_page(full_url)
                log(f"  {href} → {len(gyms)}")
                locations.extend(gyms)
            elif href.startswith("/gyms/"):
                slug = href.removeprefix("/gyms/")
                gym = parse_single_gym_page(full_url, slug)
                if gym:
                    log(f"  {href} → 1")
                    locations.append(gym)
                else:
                    log(f"  {href} → 0 (failed)")
            time.sleep(0.4)

    return locations


def load_checkpoint() -> dict:
    if CHECKPOINT_PATH.exists():
        return json.loads(CHECKPOINT_PATH.read_text())
    return {"done_states": [], "features": []}


def save_checkpoint(done_states: list[str], features: list[dict]):
    CHECKPOINT_PATH.write_text(json.dumps({"done_states": done_states, "features": features}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", help="Single state only (e.g. ca)")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument("--parallel", action="store_true", help="Fetch city pages concurrently (faster, higher rate-limit risk)")
    parser.add_argument("--workers", type=int, default=8, help="Thread pool size when --parallel is set (default 8)")
    args = parser.parse_args()

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    if args.state:
        states = [args.state.lower()]
        all_features = []
        done_states = []
    elif args.resume:
        checkpoint = load_checkpoint()
        done_states = checkpoint["done_states"]
        all_features = checkpoint["features"]
        states = [s for s in US_STATES if s not in done_states]
        print(f"Resuming: {len(done_states)} done, {len(states)} remaining, {len(all_features)} locations so far")
    else:
        states = US_STATES
        all_features = []
        done_states = []

    for state in states:
        features = scrape_state(state, parallel=args.parallel, workers=args.workers)
        all_features.extend(features)
        done_states.append(state)
        print(f"  → {len(features)} for {state.upper()} | total: {len(all_features)}")
        save_checkpoint(done_states, all_features)
        time.sleep(0.5 if args.parallel else 1.0)

    geojson = {
        "type": "FeatureCollection",
        "features": all_features,
        "metadata": {
            "source": "planetfitness.com",
            "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total": len(all_features),
        },
    }
    OUTPUT_PATH.write_text(json.dumps(geojson, indent=2))
    print(f"\nDone! {len(all_features)} locations → {OUTPUT_PATH}")

    if not args.state and CHECKPOINT_PATH.exists():
        CHECKPOINT_PATH.unlink()


if __name__ == "__main__":
    main()
