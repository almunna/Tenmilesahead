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
  const address = searchParams.get('address');
  const city = searchParams.get('city');
  const state = searchParams.get('state');
  const country = searchParams.get('country');

  // At minimum, we need city and country, or just address
  if (!country && !address) {
    return NextResponse.json(
      { error: 'Missing required location parameters' },
      { status: 400 }
    );
  }

  // Build query parts from most specific to least specific
  const queryParts: string[] = [];
  if (address) queryParts.push(address);
  if (city) queryParts.push(city);
  if (state) queryParts.push(state);
  if (country) queryParts.push(country);

  const queryString = queryParts.join(', ');
  const cacheKey = queryString.toLowerCase();

  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    const coords = geocodeCache.get(cacheKey);
    return NextResponse.json({ coordinates: coords });
  }

  try {
    // Rate limit
    await waitForRateLimit();

    // Use Nominatim API with full address for more accurate results
    const query = encodeURIComponent(queryString);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'TenMilesAhead-TravelApp/1.0',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Geocoding HTTP error for ${queryString}: ${response.status}`);
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

    // If full address didn't work, try without the street address
    if (address && city) {
      const fallbackParts = [city, state, country].filter(Boolean);
      const fallbackQuery = encodeURIComponent(fallbackParts.join(', '));
      const fallbackCacheKey = fallbackParts.join(', ').toLowerCase();

      if (geocodeCache.has(fallbackCacheKey)) {
        const coords = geocodeCache.get(fallbackCacheKey);
        return NextResponse.json({ coordinates: coords });
      }

      await waitForRateLimit();
      const fallbackResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${fallbackQuery}&limit=1`,
        {
          headers: {
            'User-Agent': 'TenMilesAhead-TravelApp/1.0',
          },
        }
      );

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData && fallbackData.length > 0) {
          const coords: [number, number] = [
            parseFloat(fallbackData[0].lon),
            parseFloat(fallbackData[0].lat),
          ];
          geocodeCache.set(fallbackCacheKey, coords);
          geocodeCache.set(cacheKey, coords); // Also cache original key
          return NextResponse.json({ coordinates: coords });
        }
      }
    }

    geocodeCache.set(cacheKey, null);
    return NextResponse.json({ coordinates: null });
  } catch (error) {
    console.error(`Error geocoding ${queryString}:`, error);
    geocodeCache.set(cacheKey, null);
    return NextResponse.json({ coordinates: null }, { status: 500 });
  }
}
