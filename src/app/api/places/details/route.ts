import { NextRequest, NextResponse } from "next/server";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get("place_id");

  if (!placeId) {
    return NextResponse.json(
      { error: "place_id is required" },
      { status: 400 }
    );
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json(
      { error: "Google Places API key not configured" },
      { status: 500 }
    );
  }

  try {
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/details/json"
    );
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("key", GOOGLE_PLACES_API_KEY);
    url.searchParams.set(
      "fields",
      "name,formatted_address,formatted_phone_number,international_phone_number,website,address_components,geometry"
    );

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "OK" && data.result) {
      const result = data.result;

      // Parse address components
      const addressComponents = result.address_components || [];
      let country = "";
      let state = "";
      let city = "";
      let streetNumber = "";
      let route = "";

      for (const component of addressComponents) {
        const types = component.types || [];

        if (types.includes("country")) {
          country = component.long_name;
        }
        if (
          types.includes("administrative_area_level_1") ||
          types.includes("administrative_area_level_2")
        ) {
          // Prefer level 1 for state, but use level 2 as fallback
          if (types.includes("administrative_area_level_1")) {
            state = component.long_name;
          } else if (!state) {
            state = component.long_name;
          }
        }
        if (
          types.includes("locality") ||
          types.includes("sublocality") ||
          types.includes("postal_town")
        ) {
          // Prefer locality over sublocality
          if (types.includes("locality") || types.includes("postal_town")) {
            city = component.long_name;
          } else if (!city) {
            city = component.long_name;
          }
        }
        if (types.includes("street_number")) {
          streetNumber = component.long_name;
        }
        if (types.includes("route")) {
          route = component.long_name;
        }
      }

      // Build street address
      let address = "";
      if (streetNumber && route) {
        address = `${streetNumber} ${route}`;
      } else if (route) {
        address = route;
      }

      return NextResponse.json({
        name: result.name || "",
        address,
        city,
        state,
        country,
        phoneNumber: result.formatted_phone_number || result.international_phone_number || "",
        websiteUrl: result.website || "",
        formattedAddress: result.formatted_address || "",
      });
    }

    console.error("Google Places Details API error:", data.status, data.error_message);
    return NextResponse.json(
      { error: data.error_message || "Failed to fetch place details" },
      { status: 500 }
    );
  } catch (error) {
    console.error("Places details error:", error);
    return NextResponse.json(
      { error: "Failed to fetch place details" },
      { status: 500 }
    );
  }
}
