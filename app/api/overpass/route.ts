import { NextRequest, NextResponse } from "next/server";

let lastOverpassRequest = 0;

type POIType = "campsite" | "gym" | "library";

// Convert meters to approximate degrees of latitude
function metersToDegLat(meters: number): number {
  return meters / 111_320;
}

// Convert meters to approximate degrees of longitude at a given latitude
function metersToDegLng(meters: number, lat: number): number {
  return meters / (111_320 * Math.cos((lat * Math.PI) / 180));
}

function buildOverpassQuery(
  bbox: [number, number, number, number], // [south, west, north, east]
  types: POIType[],
): string {
  const bboxStr = `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`;

  const queries: string[] = [];

  for (const type of types) {
    switch (type) {
      case "campsite":
        // fee=no or fee=yes but with free conditional access
        // Exclude the [!"fee"] query — too broad, returns thousands of nodes
        queries.push(
          `node["tourism"="camp_site"]["fee"="no"](${bboxStr});`,
          `node["tourism"="camp_site"]["fee:conditional"](${bboxStr});`,
        );
        break;
      case "gym":
        queries.push(
          `node["leisure"="fitness_centre"]["name"~"Planet Fitness|24 Hour Fitness|Anytime Fitness",i](${bboxStr});`,
        );
        break;
      case "library":
        queries.push(
          `node["amenity"="library"](${bboxStr});`,
        );
        break;
    }
  }

  return `[out:json][timeout:25];\n(\n  ${queries.join("\n  ")}\n);\nout body 200;`;
}

export async function POST(request: NextRequest) {
  let body: { coordinates: [number, number][]; radius: number; types: POIType[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { coordinates, radius, types } = body;

  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
    return NextResponse.json(
      { error: "At least 2 coordinates required" },
      { status: 400 },
    );
  }
  if (!types || !Array.isArray(types) || types.length === 0) {
    return NextResponse.json(
      { error: "At least one POI type required" },
      { status: 400 },
    );
  }
  if (typeof radius !== "number" || radius <= 0) {
    return NextResponse.json(
      { error: "Valid radius required" },
      { status: 400 },
    );
  }

  // Rate limit: 1 request per second
  const now = Date.now();
  const elapsed = now - lastOverpassRequest;
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastOverpassRequest = Date.now();

  // Compute bounding box from route coordinates expanded by radius
  const lats = coordinates.map(([lat]) => lat);
  const lngs = coordinates.map(([, lng]) => lng);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

  const padLat = metersToDegLat(radius);
  const padLng = metersToDegLng(radius, centerLat);

  const bbox: [number, number, number, number] = [
    Math.min(...lats) - padLat,
    Math.min(...lngs) - padLng,
    Math.max(...lats) + padLat,
    Math.max(...lngs) + padLng,
  ];

  const query = buildOverpassQuery(bbox, types);

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Wayfinder-TripPlanner/1.0 (educational-project)",
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Overpass API error:", response.status, text.slice(0, 500));
      return NextResponse.json(
        {
          error: "Overpass API request failed",
          detail: text.slice(0, 200),
          debug: { bbox, query, overpassStatus: response.status },
        },
        { status: 502 },
      );
    }

    const data = await response.json();

    // Transform OSM elements to our POI format
    const pois = (data.elements || [])
      .filter((el: { lat?: number; lon?: number }) => el.lat && el.lon)
      .map((el: { id: number; lat: number; lon: number; tags?: Record<string, string> }) => {
        const tags = el.tags || {};
        let type: POIType;
        if (tags.tourism === "camp_site") {
          type = "campsite";
        } else if (tags.leisure === "fitness_centre") {
          type = "gym";
        } else {
          type = "library";
        }

        return {
          id: String(el.id),
          name: tags.name || (type === "campsite" ? "Campsite" : type === "gym" ? "Gym" : "Library"),
          type,
          lat: el.lat,
          lng: el.lon,
          tags,
        };
      });

    return NextResponse.json({ pois });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch POIs" },
      { status: 500 },
    );
  }
}
