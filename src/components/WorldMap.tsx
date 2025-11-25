"use client";

import { useEffect, useRef, useState } from "react";
import { Trip } from "@/lib/types";
import "leaflet/dist/leaflet.css";

type WithId<T> = T & { id: string };

export default function WorldMap({
  trips,
  onOpenFlip,
}: {
  trips: WithId<Trip>[];
  onOpenFlip: (tripId: string) => void;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const markersByTripId = useRef<Map<string, any>>(new Map());
  const countryLayersRef = useRef<any[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Set client-side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isClient || !mapContainer.current || map.current) return;

    // Dynamic import of Leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      if (!mapContainer.current || map.current) return;

      // Create map instance (attributionControl: false removes the attribution)
      map.current = L.default.map(mapContainer.current, {
        attributionControl: false,
        preferCanvas: true,
        fadeAnimation: true,
        zoomAnimation: true,
        maxBounds: [[-90, -180], [90, 180]], // Restrict to world bounds
        maxBoundsViscosity: 1.0, // Make bounds rigid (no bouncing outside)
      }).setView([20, 0], 2);

      // Add OpenStreetMap tiles (free!)
      L.default.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        minZoom: 2,
        keepBuffer: 4, // Keep extra tiles loaded around the visible area
        updateWhenIdle: false, // Update tiles while panning
        updateWhenZooming: false,
        crossOrigin: true,
        noWrap: true, // Prevent world from repeating horizontally
        bounds: [[-90, -180], [90, 180]], // Tile layer bounds
      }).addTo(map.current);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [isClient]);

  // Add markers for trips and highlight visited countries
  useEffect(() => {
    if (!map.current || !isClient) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    markersByTripId.current.clear();

    // Remove existing country layers
    countryLayersRef.current.forEach((layer) => layer.remove());
    countryLayersRef.current = [];

    // Expose function to window for popup button
    (window as any).openTripFlipbook = (tripId: string) => {
      onOpenFlip(tripId);
    };

    // Add markers for each trip and highlight countries (async)
    const addMarkersAsync = async () => {
      // Wait a bit for map to be fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));

      // Dynamic import of Leaflet for markers
      const L = await import("leaflet");
      const validCoordinates: any[] = [];
      const visitedCountries = new Set<string>();

      console.log(`Adding markers for ${trips.length} trips`);

      for (const trip of trips) {
        console.log(`Processing trip: ${trip.name}, City: ${trip.city}, Country: ${trip.country}`);

        if (!trip.city || !trip.country) {
          console.warn(`Skipping trip ${trip.name} - missing city or country`);
          continue;
        }

        // Add country to visited set
        if (trip.country) {
          visitedCountries.add(trip.country.toLowerCase().trim());
        }

        const coordinates = await getCityCoordinates(trip.city, trip.country);
        console.log(`Coordinates for ${trip.city}, ${trip.country}:`, coordinates);

        if (coordinates && map.current) {
          // Create custom red pin icon
          const customIcon = L.default.divIcon({
            html: `<svg width="24" height="32" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 0C7.163 0 0 7.163 0 16c0 13 16 26 16 26s16-13 16-26C32 7.163 24.837 0 16 0z"
                fill="#DC2626"
                stroke="#991B1B"
                stroke-width="2"/>
              <circle cx="16" cy="16" r="6" fill="white"/>
            </svg>`,
            className: "custom-leaflet-marker",
            iconSize: [24, 32],
            iconAnchor: [12, 32],
            popupAnchor: [0, -32],
          });

          // Create marker
          const marker = L.default.marker([coordinates[1], coordinates[0]], {
            icon: customIcon,
          });

          // Create popup
          const popupContent = `
            <div style="padding: 8px; min-width: 200px;">
              <strong style="font-size: 14px;">${trip.name}</strong><br/>
              <span style="color: #666; font-size: 12px;">
                ${trip.city}, ${trip.state ? trip.state + ", " : ""}${trip.country}
              </span><br/>
              <button
                onclick="window.openTripFlipbook('${trip.id}')"
                style="
                  margin-top: 8px;
                  padding: 6px 12px;
                  background: #66bfcc;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 12px;
                "
              >
                View Flipbook
              </button>
            </div>
          `;

          marker.bindPopup(popupContent);
          marker.addTo(map.current);
          markersRef.current.push(marker);
          markersByTripId.current.set(trip.id, marker);

          validCoordinates.push([coordinates[1], coordinates[0]]);
          console.log(`Added marker for ${trip.city}, ${trip.country}`);
        } else {
          console.warn(`Failed to add marker for ${trip.city}, ${trip.country}`);
        }
      }

      console.log(`Total markers added: ${validCoordinates.length}`);
      console.log(`Visited countries:`, Array.from(visitedCountries));

      // Highlight visited countries
      if (visitedCountries.size > 0 && map.current) {
        try {
          // Fetch country boundaries GeoJSON
          const response = await fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson');
          const countriesGeoJSON = await response.json();

          // Country name mapping for common variations
          const countryNameMap: { [key: string]: string[] } = {
            'united states': ['united states of america', 'usa', 'us', 'united states'],
            'united kingdom': ['united kingdom', 'uk', 'great britain', 'england', 'scotland', 'wales'],
            'south korea': ['south korea', 'korea, republic of', 'republic of korea'],
            'north korea': ['north korea', 'korea, democratic people\'s republic of'],
            'czech republic': ['czech republic', 'czechia'],
            'netherlands': ['netherlands', 'holland'],
            'india': ['india', 'republic of india'],
            'china': ['china', 'people\'s republic of china'],
            'france': ['france', 'french republic'],
            'germany': ['germany', 'federal republic of germany'],
            'italy': ['italy', 'italian republic'],
            'spain': ['spain', 'kingdom of spain'],
            'canada': ['canada'],
            'mexico': ['mexico', 'united mexican states'],
            'brazil': ['brazil', 'federative republic of brazil'],
            'australia': ['australia', 'commonwealth of australia'],
            'japan': ['japan'],
            'thailand': ['thailand', 'kingdom of thailand'],
            'bangladesh': ['bangladesh', 'people\'s republic of bangladesh'],
            'belgium': ['belgium', 'kingdom of belgium'],
            'anguilla': ['anguilla'],
            'aruba': ['aruba'],
          };

          // Log all available countries in GeoJSON for debugging
          console.log('Sample GeoJSON feature properties:', countriesGeoJSON.features.slice(0, 3).map((f: any) => f.properties));
          console.log('Sample GeoJSON countries:', countriesGeoJSON.features.slice(0, 10).map((f: any) => f.properties.ADMIN));
          console.log('All GeoJSON countries:', countriesGeoJSON.features.map((f: any) => f.properties.ADMIN).sort());

          // Filter GeoJSON to only include visited countries
          const visitedFeatures = countriesGeoJSON.features.filter((feature: any) => {
            const geoCountryName = feature.properties.ADMIN || '';
            const geoCountryLower = geoCountryName.toLowerCase();

            console.log(`Checking GeoJSON country: "${geoCountryName}" (lowercase: "${geoCountryLower}")`);

            // Check direct match
            if (visitedCountries.has(geoCountryLower)) {
              console.log(`✓ Direct match found: ${geoCountryLower}`);
              return true;
            }

            // Check against mapping
            for (const visited of visitedCountries) {
              const mappedNames = countryNameMap[visited] || [visited];
              for (const mappedName of mappedNames) {
                const mappedLower = mappedName.toLowerCase();
                if (geoCountryLower === mappedLower ||
                    (geoCountryLower.includes(mappedLower) && mappedLower.length > 3) ||
                    (mappedLower.includes(geoCountryLower) && geoCountryLower.length > 3)) {
                  console.log(`✓ Mapped match found: ${visited} -> ${geoCountryName}`);
                  return true;
                }
              }
            }

            return false;
          });

          console.log(`Found ${visitedFeatures.length} country boundaries to highlight`);
          console.log(`Matched countries:`, visitedFeatures.map((f: any) => f.properties.ADMIN));

          // Add highlighted country layers
          visitedFeatures.forEach((feature: any) => {
            const layer = L.default.geoJSON(feature, {
              style: {
                fillColor: '#66bfcc',
                fillOpacity: 0.35,
                color: '#66bfcc',
                weight: 2,
                opacity: 0.7,
              },
            });

            if (map.current) {
              layer.addTo(map.current);
              layer.bringToBack(); // Ensure country layers are behind markers
              countryLayersRef.current.push(layer);
            }
          });
        } catch (error) {
          console.error('Error loading country boundaries:', error);
        }
      }

      // Fit map to show all markers if there are trips
      if (validCoordinates.length > 0 && map.current) {
        const bounds = L.default.latLngBounds(validCoordinates);
        map.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 8,
        });
      }
    };

    addMarkersAsync();
  }, [trips, onOpenFlip, isClient]);

  // Function to pan to a marker and open its popup
  const handlePinClick = (tripId: string) => {
    const marker = markersByTripId.current.get(tripId);
    if (marker && map.current) {
      // Pan to marker location
      map.current.setView(marker.getLatLng(), 10, {
        animate: true,
        duration: 0.5,
      });
      // Open popup
      marker.openPopup();
    }
  };

  return (
    <section className="card">
      <h2 className="text-xl font-semibold">World Map</h2>
      <p className="text-muted-foreground text-sm mt-1">
        Visited countries are shaded in blue with pins marking your specific destinations. Click a pin to view details.
      </p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-[70%_30%] gap-4">
        <div
          ref={mapContainer}
          className="min-h-[400px] sm:min-h-[500px] md:min-h-[600px] w-full rounded-xl overflow-hidden border border-border"
          style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', minHeight: '400px' }}
        />

        <div className="rounded-xl border border-border p-3">
          <div className="text-sm font-semibold mb-2">Trip Pins</div>
          <ul className="max-h-[368px] sm:max-h-[468px] md:max-h-[568px] overflow-auto text-sm space-y-1">
            {trips.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2"
              >
                <button
                  onClick={() => handlePinClick(t.id)}
                  className="flex-1 truncate text-left hover:text-[#66bfcc] transition-colors"
                >
                  <span className="mr-2">📍</span>
                  {t.city || "—"}, {t.state ? `${t.state}, ` : ""}
                  {t.country || "—"}
                </button>
                <button
                  className="navlink text-xs flex-shrink-0"
                  onClick={() => onOpenFlip(t.id)}
                >
                  View Flipbook
                </button>
              </li>
            ))}
            {trips.length === 0 && (
              <li className="text-muted-foreground">No trips yet.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

// Client-side cache for geocoding results
const geocodeCache = new Map<string, [number, number] | null>();

async function getCityCoordinates(
  city: string,
  country: string
): Promise<[number, number] | null> {
  const cacheKey = `${city.toLowerCase()},${country.toLowerCase()}`;

  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    console.log(`Using cached coordinates for ${city}, ${country}`);
    return geocodeCache.get(cacheKey)!;
  }

  try {
    // Call our API route instead of Nominatim directly (avoids CORS)
    console.log(`Fetching coordinates for: ${city}, ${country}`);

    const response = await fetch(
      `/api/geocode?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`
    );

    if (!response.ok) {
      console.warn(`Geocoding HTTP error for ${city}, ${country}: ${response.status}`);
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const data = await response.json();
    console.log(`Geocoding response for ${city}, ${country}:`, data);

    if (data.coordinates) {
      const coords: [number, number] = data.coordinates;
      console.log(`Successfully geocoded ${city}, ${country} to [${coords[1]}, ${coords[0]}]`);
      geocodeCache.set(cacheKey, coords);
      return coords;
    }

    console.warn(`No results found for ${city}, ${country}`);
    geocodeCache.set(cacheKey, null);
    return null;
  } catch (error) {
    console.error(`Error geocoding ${city}, ${country}:`, error);
    geocodeCache.set(cacheKey, null);
    return null;
  }
}
