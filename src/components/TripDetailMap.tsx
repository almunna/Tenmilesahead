"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

// Add custom styles for markers
const markerStyles = `
  .custom-trip-detail-marker {
    background: transparent !important;
    border: none !important;
  }
  .custom-pin-wrapper {
    display: block;
  }
  .leaflet-marker-icon.custom-trip-detail-marker {
    background: none !important;
    border: none !important;
    box-shadow: none !important;
  }
`;

type PlaceItem = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  country: string;
  address?: string | null;
  transportationMode?: string | null;
  transportationType?: string | null;
  onShip?: boolean;
  startDate?: string | null;
};

type TripDetailMapProps = {
  destinations: PlaceItem[];
  activities: PlaceItem[];
  restaurants: PlaceItem[];
  tripCity: string;
  tripCountry: string;
  // Origin/Starting point
  originCity?: string | null;
  originState?: string | null;
  originCountry?: string | null;
  originAddress?: string | null;
  originTransportationType?: string | null;
};

// Transportation mode icons (SVG paths)
const TRANSPORT_ICONS: Record<string, string> = {
  Airplane: `<path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>`,
  "Boat/Ferry": `<path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>`,
  Bus: `<path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>`,
  Car: `<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>`,
  Cruise: `<path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>`,
  RV: `<path d="M18 4h-5V1h-2v3H6c-1.1 0-2 .9-2 2v8h1c0 1.66 1.34 3 3 3s3-1.34 3-3h4c0 1.66 1.34 3 3 3s3-1.34 3-3h1V8l-4-4zm-6 2h3l2 2h-5V6zM8 15c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm10 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>`,
  "Taxi/Rideshare": `<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H15V3H9v2H6.5c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>`,
  Train: `<path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>`,
  Walk: `<path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>`,
  Other: `<circle cx="12" cy="12" r="8"/>`,
};

// Color coding for different types
const PIN_COLORS = {
  destination: { fill: "#DC2626", stroke: "#991B1B" }, // Red (same as world map)
  activity: { fill: "#16a34a", stroke: "#15803d" }, // Green
  restaurant: { fill: "#eab308", stroke: "#ca8a04" }, // Yellow
  trip: { fill: "#DC2626", stroke: "#991B1B" }, // Red (main trip location)
  origin: { fill: "#9333ea", stroke: "#7e22ce" }, // Purple (starting point)
};

export default function TripDetailMap({
  destinations,
  activities,
  restaurants,
  tripCity,
  tripCountry,
  originCity,
  originState,
  originCountry,
  originAddress,
  originTransportationType,
}: TripDetailMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isClient || !mapContainer.current || map.current) return;

    import("leaflet").then((L) => {
      if (!mapContainer.current || map.current) return;

      map.current = L.default.map(mapContainer.current, {
        attributionControl: false,
        preferCanvas: true,
        fadeAnimation: true,
        zoomAnimation: true,
        minZoom: 2,
        worldCopyJump: true, // Jump to the "main" world copy when panning far
        maxBounds: [[-85, -Infinity], [85, Infinity]], // Restrict vertical, allow horizontal wrap
        maxBoundsViscosity: 1.0, // Rigid vertical bounds
      }).setView([20, 0], 2);

      // Add Google Maps tiles - detailed with English labels (same as WorldMap)
      L.default.tileLayer(
        "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=en",
        {
          maxZoom: 20,
          minZoom: 2,
          attribution: "© Google Maps",
          keepBuffer: 4,
          updateWhenIdle: false,
          updateWhenZooming: false,
          crossOrigin: true,
        }
      ).addTo(map.current);

      // Map is ready
      setMapReady(true);
      console.log("TripDetailMap: Map initialized");
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setMapReady(false);
      }
    };
  }, [isClient]);

  // Add markers
  useEffect(() => {
    if (!map.current || !mapReady) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const addMarkersAsync = async () => {
      // Wait for map to be fully ready
      await new Promise(resolve => setTimeout(resolve, 100));

      const L = await import("leaflet");
      const validCoordinates: [number, number][] = [];

      console.log("TripDetailMap: Adding markers", {
        tripCity,
        tripCountry,
        destinations: destinations.length,
        activities: activities.length
      });

      // Create icon for a place with transportation mode
      const createIcon = (
        type: "destination" | "activity" | "restaurant" | "trip" | "origin",
        transportMode?: string | null
      ) => {
        const colors = PIN_COLORS[type];
        const transportIcon = transportMode && TRANSPORT_ICONS[transportMode]
          ? TRANSPORT_ICONS[transportMode]
          : "";

        return L.default.divIcon({
          html: `<div class="custom-pin-wrapper">
            <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
              <path d="M16 0C7.163 0 0 7.163 0 16c0 13 16 26 16 26s16-13 16-26C32 7.163 24.837 0 16 0z"
                fill="${colors.fill}"
                stroke="${colors.stroke}"
                stroke-width="2"/>
              <circle cx="16" cy="16" r="7" fill="white"/>
              ${transportIcon ? `<g transform="translate(9, 9) scale(0.58)" fill="${colors.fill}">${transportIcon}</g>` : ""}
            </svg>
          </div>`,
          className: "custom-trip-detail-marker",
          iconSize: [32, 42],
          iconAnchor: [16, 42],
          popupAnchor: [0, -42],
        });
      };

      // Variable to store origin coordinates for connecting lines
      let originCoords: [number, number] | null = null;
      // Array to store all destination coordinates with dates for chronological ordering
      const destinationData: Array<{
        coords: [number, number];
        startDate: string | null;
        name: string;
      }> = [];

      // Add origin/starting point marker (no primary destination marker)
      if (originCity && originCountry) {
        console.log("TripDetailMap: Geocoding origin location", originAddress, originCity, originState, originCountry);
        const coords = await getCoordinates(originAddress, originCity, originState, originCountry);
        console.log("TripDetailMap: Origin coords", coords);
        if (coords && map.current) {
          originCoords = coords;
          const marker = L.default.marker([coords[1], coords[0]], {
            icon: createIcon("origin", originTransportationType),
            zIndexOffset: 900, // High z-index for starting point
          });

          const transportBadge = originTransportationType
            ? `<br/><span style="background: #9333ea; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${originTransportationType}</span>`
            : "";

          const locationParts = [originCity, originState, originCountry].filter(Boolean).join(", ");

          marker.bindPopup(`
            <div style="padding: 8px; min-width: 150px;">
              <strong style="color: #9333ea;">Starting Point</strong><br/>
              <span style="color: #666;">${locationParts}</span>
              ${transportBadge}
            </div>
          `);
          marker.addTo(map.current);
          markersRef.current.push(marker);
          validCoordinates.push([coords[1], coords[0]]);
          console.log("TripDetailMap: Added origin marker at", coords);
        }
      }

      // Add destination markers
      for (const dest of destinations) {
        // Skip destinations marked as onShip (no location)
        if (dest.onShip) continue;

        const city = dest.city || tripCity;
        const country = dest.country || tripCountry;
        if (!city || !country) continue;

        console.log("TripDetailMap: Geocoding destination", dest.name, dest.address, city, dest.state, country);
        const coords = await getCoordinates(dest.address, city, dest.state, country);
        console.log("TripDetailMap: Destination coords", coords);
        if (coords && map.current) {
          // Store coordinates with date for chronological ordering
          destinationData.push({
            coords: coords,
            startDate: dest.startDate || null,
            name: dest.name,
          });

          const transportMode = dest.transportationMode || dest.transportationType;
          const marker = L.default.marker([coords[1], coords[0]], {
            icon: createIcon("destination", transportMode),
          });

          const transportBadge = transportMode
            ? `<br/><span style="background: #DC2626; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${transportMode}</span>`
            : "";

          marker.bindPopup(`
            <div style="padding: 8px; min-width: 150px;">
              <strong style="color: #DC2626;">Destination</strong><br/>
              <span style="font-weight: 500;">${dest.name}</span><br/>
              <span style="color: #666; font-size: 12px;">${city}${dest.state ? `, ${dest.state}` : ""}, ${country}</span>
              ${transportBadge}
            </div>
          `);
          marker.addTo(map.current);
          markersRef.current.push(marker);
          validCoordinates.push([coords[1], coords[0]]);
          console.log("TripDetailMap: Added destination marker at", coords);
        }
      }

      // Add activity markers
      for (const act of activities) {
        // Skip activities marked as onShip (no location)
        if (act.onShip) continue;

        const city = act.city || tripCity;
        const country = act.country || tripCountry;
        if (!city || !country) continue;

        console.log("TripDetailMap: Geocoding activity", act.name, act.address, city, act.state, country);
        const coords = await getCoordinates(act.address, city, act.state, country);
        console.log("TripDetailMap: Activity coords", coords);
        if (coords && map.current) {
          const transportMode = act.transportationMode || act.transportationType;
          const marker = L.default.marker([coords[1], coords[0]], {
            icon: createIcon("activity", transportMode),
          });

          const transportBadge = transportMode
            ? `<br/><span style="background: #16a34a; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${transportMode}</span>`
            : "";

          marker.bindPopup(`
            <div style="padding: 8px; min-width: 150px;">
              <strong style="color: #16a34a;">Activity</strong><br/>
              <span style="font-weight: 500;">${act.name}</span><br/>
              <span style="color: #666; font-size: 12px;">${city}${act.state ? `, ${act.state}` : ""}, ${country}</span>
              ${transportBadge}
            </div>
          `);
          marker.addTo(map.current);
          markersRef.current.push(marker);
          validCoordinates.push([coords[1], coords[0]]);
          console.log("TripDetailMap: Added activity marker at", coords);
        }
      }

      // Add restaurant markers
      for (const rest of restaurants) {
        // Skip restaurants marked as onShip (no location)
        if (rest.onShip) continue;

        const city = rest.city || tripCity;
        const country = rest.country || tripCountry;
        if (!city || !country) continue;

        console.log("TripDetailMap: Geocoding restaurant", rest.name, rest.address, city, rest.state, country);
        const coords = await getCoordinates(rest.address, city, rest.state, country);
        console.log("TripDetailMap: Restaurant coords", coords);
        if (coords && map.current) {
          const transportMode = rest.transportationMode || rest.transportationType;
          const marker = L.default.marker([coords[1], coords[0]], {
            icon: createIcon("restaurant", transportMode),
          });

          const transportBadge = transportMode
            ? `<br/><span style="background: #eab308; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${transportMode}</span>`
            : "";

          marker.bindPopup(`
            <div style="padding: 8px; min-width: 150px;">
              <strong style="color: #eab308;">Restaurant</strong><br/>
              <span style="font-weight: 500;">${rest.name}</span><br/>
              <span style="color: #666; font-size: 12px;">${city}${rest.state ? `, ${rest.state}` : ""}, ${country}</span>
              ${transportBadge}
            </div>
          `);
          marker.addTo(map.current);
          markersRef.current.push(marker);
          validCoordinates.push([coords[1], coords[0]]);
          console.log("TripDetailMap: Added restaurant marker at", coords);
        }
      }

      // Draw chronological connecting lines: origin → dest1 → dest2 → etc.
      if (originCoords && destinationData.length > 0 && map.current) {
        // Sort destinations chronologically by startDate
        const sortedDestinations = [...destinationData].sort((a, b) => {
          if (!a.startDate || !b.startDate) return 0;
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });

        console.log(`TripDetailMap: Drawing chronological path with ${sortedDestinations.length} destinations`);

        // Draw line from origin to first destination
        if (sortedDestinations.length > 0) {
          const firstDest = sortedDestinations[0];
          const polyline = L.default.polyline(
            [
              [originCoords[1], originCoords[0]], // Origin point [lat, lng]
              [firstDest.coords[1], firstDest.coords[0]], // First destination [lat, lng]
            ],
            {
              color: "#9333ea", // Purple to match origin pin
              weight: 2,
              opacity: 0.6,
              dashArray: "8, 8", // Dashed line
            }
          );
          polyline.addTo(map.current);
          markersRef.current.push(polyline);
          console.log(`TripDetailMap: Added line from origin to ${firstDest.name}`);
        }

        // Draw lines between consecutive destinations
        for (let i = 1; i < sortedDestinations.length; i++) {
          const prevDest = sortedDestinations[i - 1];
          const currDest = sortedDestinations[i];
          const polyline = L.default.polyline(
            [
              [prevDest.coords[1], prevDest.coords[0]], // Previous destination [lat, lng]
              [currDest.coords[1], currDest.coords[0]], // Current destination [lat, lng]
            ],
            {
              color: "#DC2626", // Red to match destination pins
              weight: 2,
              opacity: 0.6,
              dashArray: "8, 8", // Dashed line
            }
          );
          polyline.addTo(map.current);
          markersRef.current.push(polyline);
          console.log(`TripDetailMap: Added line from ${prevDest.name} to ${currDest.name}`);
        }
      }

      // Fit map to show all markers
      console.log("TripDetailMap: Total valid coordinates", validCoordinates.length);
      if (validCoordinates.length > 0 && map.current) {
        const bounds = L.default.latLngBounds(validCoordinates);
        map.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 10,
        });
      }
    };

    addMarkersAsync();
  }, [destinations, activities, restaurants, tripCity, tripCountry, originCity, originState, originCountry, originAddress, originTransportationType, mapReady]);

  // Show map if there are any destinations, activities, restaurants, trip location, or origin
  const hasContent = destinations.length > 0 || activities.length > 0 || restaurants.length > 0 || (tripCity && tripCountry) || (originCity && originCountry);

  if (!hasContent) {
    return null; // Don't show map if nothing to display
  }

  return (
    <div className="card">
      <style dangerouslySetInnerHTML={{ __html: markerStyles }} />
      <h2 className="text-xl font-semibold">Trip Map</h2>
      <p className="text-muted-foreground text-sm mt-1">
        Pin drops for your trip locations. Lines show chronological travel path by date.
        <span className="inline-flex items-center gap-2 ml-2 flex-wrap">
          <span className="inline-block w-3 h-3 rounded-full bg-[#9333ea]"></span>
          <span className="text-xs">Starting Point</span>
          <span className="inline-block w-3 h-3 rounded-full bg-[#DC2626]"></span>
          <span className="text-xs">Destination</span>
          <span className="inline-block w-3 h-3 rounded-full bg-[#16a34a]"></span>
          <span className="text-xs">Activity</span>
          <span className="inline-block w-3 h-3 rounded-full bg-[#eab308]"></span>
          <span className="text-xs">Restaurant</span>
        </span>
      </p>

      <div
        ref={mapContainer}
        className="mt-4 min-h-[500px] w-full rounded-xl overflow-hidden border border-border"
        style={{ position: "relative", zIndex: 1 }}
      />
    </div>
  );
}

// Client-side cache for geocoding results
const geocodeCache = new Map<string, [number, number] | null>();

async function getCoordinates(
  address?: string | null,
  city?: string | null,
  state?: string | null,
  country?: string | null
): Promise<[number, number] | null> {
  // Build cache key from all parts
  const parts = [address, city, state, country].filter(Boolean).map(s => s!.toLowerCase());
  const cacheKey = parts.join(',');

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  try {
    // Build query params
    const params = new URLSearchParams();
    if (address) params.set('address', address);
    if (city) params.set('city', city);
    if (state) params.set('state', state);
    if (country) params.set('country', country);

    const response = await fetch(`/api/geocode?${params.toString()}`);

    if (!response.ok) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const data = await response.json();

    if (data.coordinates) {
      const coords: [number, number] = data.coordinates;
      geocodeCache.set(cacheKey, coords);
      return coords;
    }

    geocodeCache.set(cacheKey, null);
    return null;
  } catch (error) {
    console.error(`Error geocoding ${city}, ${country}:`, error);
    geocodeCache.set(cacheKey, null);
    return null;
  }
}
