import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for geocoding results
const geocodeCache = new Map<string, [number, number] | null>();
let lastRequestTime = 0;

// Rate limiter: ensure at least 1 second between requests
async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get('city');
  const country = searchParams.get('country');

  if (!city || !country) {
    return NextResponse.json(
      { error: 'Missing city or country parameter' },
      { status: 400 }
    );
  }

  const cacheKey = `${city.toLowerCase()},${country.toLowerCase()}`;

  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    const coords = geocodeCache.get(cacheKey);
    return NextResponse.json({ coordinates: coords });
  }

  try {
    // Rate limit
    await waitForRateLimit();

    // Use Nominatim API
    const query = encodeURIComponent(`${city}, ${country}`);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`,
      {
        headers: {
          'User-Agent': 'TenMilesAhead-TravelApp/1.0',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Geocoding HTTP error for ${city}, ${country}: ${response.status}`);
      geocodeCache.set(cacheKey, null);
      return NextResponse.json({ coordinates: null });
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const coords: [number, number] = [
        parseFloat(data[0].lon),
        parseFloat(data[0].lat),
      ];
      geocodeCache.set(cacheKey, coords);
      return NextResponse.json({ coordinates: coords });
    }

    geocodeCache.set(cacheKey, null);
    return NextResponse.json({ coordinates: null });
  } catch (error) {
    console.error(`Error geocoding ${city}, ${country}:`, error);
    geocodeCache.set(cacheKey, null);
    return NextResponse.json({ coordinates: null }, { status: 500 });
  }
}
