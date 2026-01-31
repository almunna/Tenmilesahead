import { NextRequest, NextResponse } from "next/server";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const input = searchParams.get("input");

  if (!input || input.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json(
      { error: "Google Places API key not configured" },
      { status: 500 }
    );
  }

  try {
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    );
    url.searchParams.set("input", input);
    url.searchParams.set("key", GOOGLE_PLACES_API_KEY);
    // Use 'establishment' to get businesses, restaurants, hotels, attractions etc.
    url.searchParams.set("types", "establishment");

    const response = await fetch(url.toString());
    const data = await response.json();

    // Log for debugging
    console.log("Google Places API response status:", data.status);

    if (data.status === "OK" || data.status === "ZERO_RESULTS") {
      return NextResponse.json({
        predictions: data.predictions || [],
      });
    }

    console.error("Google Places API error:", data.status, data.error_message);
    return NextResponse.json(
      { error: data.error_message || "Failed to fetch places" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Places autocomplete error:", error);
    return NextResponse.json(
      { error: "Failed to fetch place suggestions" },
      { status: 500 }
    );
  }
}
