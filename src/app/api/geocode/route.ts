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

  // Build query string for caching
  const queryString = [address, city, state, country].filter(Boolean).join(', ');
  const cacheKey = queryString.toLowerCase();

  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    const coords = geocodeCache.get(cacheKey);
    return NextResponse.json({ coordinates: coords });
  }

  try {
    // Rate limit
    await waitForRateLimit();

    // If city equals country (e.g., "Anguilla, Anguilla"), just use country
    const effectiveCity = city && country && city.toLowerCase().trim() === country.toLowerCase().trim() ? null : city;

    // Build query URL
    // Use free-form query (q=) instead of structured parameters for better multilingual support
    const params = new URLSearchParams();
    params.set('format', 'json');
    params.set('limit', '5'); // Get multiple results to filter
    params.set('addressdetails', '1');

    // Build the search query from components
    const queryParts: string[] = [];
    if (address) queryParts.push(address);
    if (effectiveCity) queryParts.push(effectiveCity);
    if (state) queryParts.push(state);
    if (country) queryParts.push(country);

    params.set('q', queryParts.join(', '));

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
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
      // Common US state abbreviations mapping
      const stateAbbreviations: { [key: string]: string } = {
        'al': 'alabama', 'ak': 'alaska', 'az': 'arizona', 'ar': 'arkansas',
        'ca': 'california', 'co': 'colorado', 'ct': 'connecticut', 'de': 'delaware',
        'fl': 'florida', 'ga': 'georgia', 'hi': 'hawaii', 'id': 'idaho',
        'il': 'illinois', 'in': 'indiana', 'ia': 'iowa', 'ks': 'kansas',
        'ky': 'kentucky', 'la': 'louisiana', 'me': 'maine', 'md': 'maryland',
        'ma': 'massachusetts', 'mi': 'michigan', 'mn': 'minnesota', 'ms': 'mississippi',
        'mo': 'missouri', 'mt': 'montana', 'ne': 'nebraska', 'nv': 'nevada',
        'nh': 'new hampshire', 'nj': 'new jersey', 'nm': 'new mexico', 'ny': 'new york',
        'nc': 'north carolina', 'nd': 'north dakota', 'oh': 'ohio', 'ok': 'oklahoma',
        'or': 'oregon', 'pa': 'pennsylvania', 'ri': 'rhode island', 'sc': 'south carolina',
        'sd': 'south dakota', 'tn': 'tennessee', 'tx': 'texas', 'ut': 'utah',
        'vt': 'vermont', 'va': 'virginia', 'wa': 'washington', 'wv': 'west virginia',
        'wi': 'wisconsin', 'wy': 'wyoming', 'dc': 'district of columbia'
      };

      // Country name variations for matching
      const countryAliases: { [key: string]: string[] } = {
        'united states': ['usa', 'us', 'united states of america'],
        'united kingdom': ['uk', 'great britain', 'england', 'scotland', 'wales'],
        'anguilla': ['anguilla'],
      };

      // First, filter results to only those matching the expected country
      let filteredResults = data;
      if (country) {
        const countryLower = country.toLowerCase().trim();
        const countryVariants = [countryLower, ...(countryAliases[countryLower] || [])];

        // Also add reverse lookup - if user entered "usa", match "united states"
        for (const [key, aliases] of Object.entries(countryAliases)) {
          if (aliases.includes(countryLower)) {
            countryVariants.push(key);
          }
        }

        filteredResults = data.filter((result: any) => {
          const addressDetails = result.address || {};
          const resultCountry = (addressDetails.country || '').toLowerCase().trim();
          const resultCountryCode = (addressDetails.country_code || '').toLowerCase().trim();

          // Check if result country matches any of our variants (by name or country code)
          return countryVariants.some(variant => {
            // Match by country name
            if (resultCountry.includes(variant) || variant.includes(resultCountry)) {
              return true;
            }
            // Match by country code (e.g., "bd" for Bangladesh, "us" for USA)
            // Country codes are typically 2-letter ISO codes
            if (variant.length === 2 && resultCountryCode === variant) {
              return true;
            }
            // Also check if the variant might be a country name that maps to this code
            // For example: "bangladesh" should match country_code="bd"
            const countryCodeMappings: { [key: string]: string } = {
              'bangladesh': 'bd',
              'united states': 'us',
              'usa': 'us',
              'us': 'us',
              'india': 'in',
              'pakistan': 'pk',
              'united kingdom': 'gb',
              'uk': 'gb',
              'canada': 'ca',
              'australia': 'au',
              'anguilla': 'ai',
            };
            const expectedCode = countryCodeMappings[variant];
            if (expectedCode && resultCountryCode === expectedCode) {
              return true;
            }
            return false;
          });
        });
      }

      // If no results match the country, the city might be wrong - return null to trigger fallback
      if (filteredResults.length === 0) {
        // Don't cache as null yet - let the fallbacks handle it
        console.log(`No results in expected country ${country} for query`);
      } else {
        // Find best match from filtered results
        let bestMatch = filteredResults[0];

        // If we have a state, try to find a result that matches the state
        if (state && filteredResults.length > 1) {
          const stateLower = state.toLowerCase();
          const stateExpanded = stateAbbreviations[stateLower] || stateLower;

          for (const result of filteredResults) {
            const addressDetails = result.address || {};
            const resultState = (addressDetails.state || '').toLowerCase();
            const resultStateCode = (addressDetails['ISO3166-2-lvl4'] || '').toLowerCase().replace('us-', '');

            // Check if the result matches our expected state
            if (resultState.includes(stateExpanded) ||
                stateExpanded.includes(resultState) ||
                resultStateCode === stateLower ||
                stateAbbreviations[resultStateCode] === stateExpanded) {
              bestMatch = result;
              break;
            }
          }
        }

        const coords: [number, number] = [
          parseFloat(bestMatch.lon),
          parseFloat(bestMatch.lat),
        ];
        geocodeCache.set(cacheKey, coords);
        return NextResponse.json({ coordinates: coords });
      }
    }

    // Fallback 1: If full address didn't work, try without the street address (city + state + country)
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

    // Fallback 2: If city didn't work, try state + country only
    if (city && (state || country)) {
      const fallbackParts2 = [state, country].filter(Boolean);
      const fallbackQuery2 = encodeURIComponent(fallbackParts2.join(', '));
      const fallbackCacheKey2 = fallbackParts2.join(', ').toLowerCase();

      if (geocodeCache.has(fallbackCacheKey2)) {
        const coords = geocodeCache.get(fallbackCacheKey2);
        if (coords) {
          geocodeCache.set(cacheKey, coords);
          return NextResponse.json({ coordinates: coords });
        }
      }

      await waitForRateLimit();
      const fallbackResponse2 = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${fallbackQuery2}&limit=1`,
        {
          headers: {
            'User-Agent': 'TenMilesAhead-TravelApp/1.0',
          },
        }
      );

      if (fallbackResponse2.ok) {
        const fallbackData2 = await fallbackResponse2.json();
        if (fallbackData2 && fallbackData2.length > 0) {
          const coords: [number, number] = [
            parseFloat(fallbackData2[0].lon),
            parseFloat(fallbackData2[0].lat),
          ];
          geocodeCache.set(fallbackCacheKey2, coords);
          geocodeCache.set(cacheKey, coords);
          return NextResponse.json({ coordinates: coords });
        }
      }
    }

    // Fallback 3: If state + country didn't work, try just country
    if (country && (city || state)) {
      const fallbackCacheKey3 = country.toLowerCase();

      if (geocodeCache.has(fallbackCacheKey3)) {
        const coords = geocodeCache.get(fallbackCacheKey3);
        if (coords) {
          geocodeCache.set(cacheKey, coords);
          return NextResponse.json({ coordinates: coords });
        }
      }

      await waitForRateLimit();
      const fallbackResponse3 = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(country)}&limit=1`,
        {
          headers: {
            'User-Agent': 'TenMilesAhead-TravelApp/1.0',
          },
        }
      );

      if (fallbackResponse3.ok) {
        const fallbackData3 = await fallbackResponse3.json();
        if (fallbackData3 && fallbackData3.length > 0) {
          const coords: [number, number] = [
            parseFloat(fallbackData3[0].lon),
            parseFloat(fallbackData3[0].lat),
          ];
          geocodeCache.set(fallbackCacheKey3, coords);
          geocodeCache.set(cacheKey, coords);
          return NextResponse.json({ coordinates: coords });
        }
      }
    }

    geocodeCache.set(cacheKey, null);
    return NextResponse.json({ coordinates: null });
  } catch (error) {
    console.error(`Error geocoding:`, error);
    console.error('Query params:', { address, city, state, country });
    return NextResponse.json(
      {
        error: 'Internal geocoding error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
