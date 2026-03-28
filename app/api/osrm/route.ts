import { NextRequest, NextResponse } from "next/server";

let lastOsrmRequest = 0;

export async function GET(request: NextRequest) {
  const coordinates = request.nextUrl.searchParams.get("coordinates");
  if (!coordinates) {
    return NextResponse.json(
      { error: "coordinates required" },
      { status: 400 }
    );
  }

  // Rate limit: 1 request per second
  const now = Date.now();
  const elapsed = now - lastOsrmRequest;
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastOsrmRequest = Date.now();

  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=polyline`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Wayfinder-TripPlanner/1.0 (educational-project)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "OSRM request failed" },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch route" },
      { status: 500 }
    );
  }
}
