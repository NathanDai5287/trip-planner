#!/usr/bin/env python3
"""
Build public/data/libraries.geojson from IMLS FY2023 Public Libraries Survey data.

Sources:
  scripts/raw_data/pls_fy23_outlet_pud23i.csv  — outlet locations (imputed)
  scripts/raw_data/PLS_FY23_AE_pud23i.csv      — system-level Wi-Fi data (imputed)

Filters applied:
  - C_OUT_TY in {CE, BR}       physical buildings only (no bookmobiles)
  - WIFISESS > 0               system reports Wi-Fi usage
  - HOURS >= 1300              open ~25+ hours/week (~25h * 52w)
  - valid lat/lng              LATITUDE != 0, LONGITUD != 0
"""

import json
import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    sys.exit("pandas not found — run: pip install pandas --break-system-packages")

ROOT = Path(__file__).parent.parent
OUTLET_CSV = Path(__file__).parent / "raw_data" / "pls_fy23_outlet_pud23i.csv"
AE_CSV = Path(__file__).parent / "raw_data" / "PLS_FY23_AE_pud23i.csv"
OUT_FILE = ROOT / "public" / "data" / "libraries.geojson"


def main():
    if not OUTLET_CSV.exists():
        sys.exit(f"Missing: {OUTLET_CSV}")
    if not AE_CSV.exists():
        sys.exit(f"Missing: {AE_CSV}")

    print("Loading outlet file...")
    outlet = pd.read_csv(OUTLET_CSV, dtype=str, low_memory=False, encoding="latin-1")
    print(f"  {len(outlet):,} total outlets")

    print("Loading AE file...")
    ae = pd.read_csv(AE_CSV, dtype=str, low_memory=False, encoding="latin-1")
    print(f"  {len(ae):,} total library systems")

    # Filter outlet types
    outlet = outlet[outlet["C_OUT_TY"].isin(["CE", "BR"])]
    print(f"  {len(outlet):,} after CE/BR filter")

    # Drop temporarily closed outlets (STATSTRU == '23')
    outlet = outlet[outlet["STATSTRU"] != "23"]
    print(f"  {len(outlet):,} after removing temporarily closed")

    # Merge Wi-Fi data from AE
    ae_wifi = ae[["FSCSKEY", "WIFISESS"]].copy()
    merged = outlet.merge(ae_wifi, on="FSCSKEY", how="left")

    # Convert numeric columns
    for col in ["WIFISESS", "HOURS", "LATITUDE", "LONGITUD"]:
        merged[col] = pd.to_numeric(merged[col], errors="coerce")

    # Apply filters
    merged = merged[merged["WIFISESS"] > 0]
    print(f"  {len(merged):,} after WIFISESS > 0")

    merged = merged[merged["HOURS"] >= 1300]
    print(f"  {len(merged):,} after HOURS >= 1300")

    merged = merged[
        merged["LATITUDE"].notna()
        & merged["LONGITUD"].notna()
        & (merged["LATITUDE"] != 0)
        & (merged["LONGITUD"] != 0)
    ]
    print(f"  {len(merged):,} with valid coordinates")

    # Build GeoJSON
    features = []
    for _, row in merged.iterrows():
        name = str(row.get("LIBNAME", "")).strip() or "Library"
        address = str(row.get("ADDRESS", "")).strip()
        city = str(row.get("CITY", "")).strip()
        state = str(row.get("STABR", "")).strip()
        phone = str(row.get("PHONE", "")).strip()
        if phone in ("nan", "-3", "-4", ""):
            phone = None

        addr_parts = [p for p in [address, city, state] if p and p != "nan"]
        full_address = ", ".join(addr_parts)

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [round(float(row["LONGITUD"]), 6), round(float(row["LATITUDE"]), 6)],
            },
            "properties": {
                "id": str(row.get("FSCSSEQ", row.get("FSCSKEY", ""))).strip(),
                "name": name,
                "address": full_address,
                "state": state,
                "phone": phone,
                "type": "library",
            },
        })

    geojson = {"type": "FeatureCollection", "features": features}

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(geojson, f, separators=(",", ":"))

    size_kb = OUT_FILE.stat().st_size / 1024
    print(f"\nWrote {len(features):,} libraries → {OUT_FILE} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
