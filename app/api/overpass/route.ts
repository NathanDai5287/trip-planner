import { NextRequest, NextResponse } from "next/server";

let lastOverpassRequest = 0;

type POIType = "campsite" | "gym" | "library";

function buildOverpassQuery(
  coordinates: [number, number][],
  radius: number,
  types: POIType[],
): string {
  const coordStr = coordinates.map(([lat, lng]) => `${lat},${lng}`).join(",");

  const queries: string[] = [];

  for (const type of types) {
    switch (type) {
      case "campsite":
        queries.push(
          `node["tourism"="camp_site"]["fee"="no"](around:${radius},${coordStr});`,
          `node["tourism"="camp_site"]["fee:conditional"](around:${radius},${coordStr});`,
          `node["tourism"="camp_site"][!"fee"](around:${radius},${coordStr});`,
        );
        break;
      case "gym":
        queries.push(
          `node["leisure"="fitness_centre"]["name"~"Planet Fitness|24 Hour Fitness|Anytime Fitness",i](around:${radius},${coordStr});`,
        );
        break;
      case "library":
        queries.push(
          `node["amenity"="library"](around:${radius},${coordStr});`,
        );
        break;
    }
  }

  return `[out:json][timeout:25];\n(\n  ${queries.join("\n  ")}\n);\nout body;`;
}

function simplifyCoordinates(
  coords: [number, number][],
  maxPoints: number,
): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const result: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  return result;
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

  const simplified = simplifyCoordinates(coordinates, 25);
  const query = buildOverpassQuery(simplified, radius, types);

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
      return NextResponse.json(
        { error: "Overpass API request failed" },
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
