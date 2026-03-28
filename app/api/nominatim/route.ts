import { NextRequest, NextResponse } from "next/server";

let lastRequestTime = 0;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return NextResponse.json([]);
  }

  // Rate limit: 1 request per second
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 1000) {
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q.trim());
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Wayfinder-TripPlanner/1.0 (educational-project)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Nominatim request failed" },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch places" },
      { status: 500 }
    );
  }
}
