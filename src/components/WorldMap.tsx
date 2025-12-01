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

      // FIRST: Collect all visited countries from trips (only requires country field)
      const visitedCountries = new Set<string>();
      for (const trip of trips) {
        if (trip.country) {
          visitedCountries.add(trip.country.toLowerCase().trim());
        }
      }

      // SECOND: Add origin markers (green pins for starting points)
      for (const trip of trips) {
        // Only add origin marker if origin city and country are set
        if (trip.originCity && trip.originCountry) {
          const originCoords = await getCoordinates(trip.originAddress, trip.originCity, trip.originState, trip.originCountry);

          if (originCoords && map.current) {
            // Create custom green pin icon for origin
            const originIcon = L.default.divIcon({
              html: `<svg width="24" height="32" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C7.163 0 0 7.163 0 16c0 13 16 26 16 26s16-13 16-26C32 7.163 24.837 0 16 0z"
                  fill="#16a34a"
                  stroke="#15803d"
                  stroke-width="2"/>
                <circle cx="16" cy="16" r="6" fill="white"/>
              </svg>`,
              className: "custom-leaflet-marker",
              iconSize: [24, 32],
              iconAnchor: [12, 32],
              popupAnchor: [0, -32],
            });

            // Create origin marker
            const originMarker = L.default.marker([originCoords[1], originCoords[0]], {
              icon: originIcon,
            });

            // Create popup for origin
            const originPopupContent = `
              <div style="padding: 8px; min-width: 200px;">
                <strong style="font-size: 14px; color: #16a34a;">Starting Point</strong><br/>
                <span style="font-size: 13px;">${trip.name}</span><br/>
                <span style="color: #666; font-size: 12px;">
                  ${trip.originCity}${trip.originState ? ", " + trip.originState : ""}, ${trip.originCountry}
                </span>
              </div>
            `;

            originMarker.bindPopup(originPopupContent);
            originMarker.addTo(map.current);
            markersRef.current.push(originMarker);

            validCoordinates.push([originCoords[1], originCoords[0]]);
          }
        }
      }

      // THIRD: Add destination markers (red pins) for trips that have city coordinates
      for (const trip of trips) {
        // Skip trips without city for marker placement (but country already collected above)
        if (!trip.city || !trip.country) {
          continue;
        }

        const coordinates = await getCoordinates(trip.specificAddress, trip.city, trip.state, trip.country);

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
        }
      }

      // Highlight visited countries
      if (visitedCountries.size > 0 && map.current) {
        try {
          // Fetch country boundaries GeoJSON (using smaller, simplified version)
          const response = await fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json');

          if (!response.ok) {
            console.error('Failed to fetch GeoJSON:', response.status);
            return;
          }

          const countriesGeoJSON = await response.json();
          console.log('Visited countries from DB:', Array.from(visitedCountries));

          // Comprehensive country name mapping for GeoJSON matching
          // Maps our app country names (lowercase) to GeoJSON ADMIN field values
          const countryNameMap: { [key: string]: string[] } = {
            // Americas
            'united states': ['united states of america', 'usa', 'us', 'united states'],
            'usa': ['united states of america'],
            'united states (usvi)': ['united states of america'], // US Virgin Islands - shade USA
            'canada': ['canada'],
            'mexico': ['mexico', 'united mexican states'],
            'brazil': ['brazil', 'federative republic of brazil'],
            'argentina': ['argentina'],
            'chile': ['chile'],
            'colombia': ['colombia'],
            'peru': ['peru'],
            'venezuela': ['venezuela'],
            'ecuador': ['ecuador'],
            'bolivia': ['bolivia'],
            'paraguay': ['paraguay'],
            'uruguay': ['uruguay'],
            'costa rica': ['costa rica'],
            'panama': ['panama'],
            'guatemala': ['guatemala'],
            'honduras': ['honduras'],
            'el salvador': ['el salvador'],
            'nicaragua': ['nicaragua'],
            'belize': ['belize'],
            'cuba': ['cuba'],
            'dominican republic': ['dominican republic'],
            'haiti': ['haiti'],
            'jamaica': ['jamaica'],
            'puerto rico': ['puerto rico', 'united states of america'],
            'bahamas': ['the bahamas', 'bahamas'],
            'barbados': ['barbados'],
            'trinidad and tobago': ['trinidad and tobago'],
            'antigua and barbuda': ['antigua and barbuda'],
            'saint lucia': ['saint lucia'],
            'st. lucia': ['saint lucia'],
            'st lucia': ['saint lucia'],
            'grenada': ['grenada'],
            'saint kitts and nevis': ['saint kitts and nevis'],
            'st. kitts and nevis': ['saint kitts and nevis'],
            'dominica': ['dominica'],
            'saint vincent and the grenadines': ['saint vincent and the grenadines'],
            'saint vincent and grenadines': ['saint vincent and the grenadines'],
            'anguilla': ['anguilla', 'united kingdom'], // UK territory
            'aruba': ['aruba', 'netherlands'],
            'bonaire': ['bonaire', 'caribbean netherlands', 'netherlands'],
            'curacao': ['curacao', 'curaçao', 'netherlands'],
            'curaçao': ['curacao', 'curaçao', 'netherlands'],
            'bermuda': ['bermuda', 'united kingdom'],
            'cayman islands': ['cayman islands', 'united kingdom'],
            'turks and caicos islands': ['turks and caicos islands', 'united kingdom'],
            'turks and caicos': ['turks and caicos islands', 'united kingdom'],
            'british virgin islands': ['british virgin islands', 'united kingdom'],
            'u.s. virgin islands': ['united states virgin islands', 'u.s. virgin islands', 'united states of america'],
            'virgin islands': ['united states virgin islands', 'british virgin islands'],
            'guadeloupe': ['guadeloupe', 'france'],
            'guadeloupe (france)': ['guadeloupe', 'france'],
            'martinique': ['martinique', 'france'],
            'martinique (france)': ['martinique', 'france'],
            'sint maarten': ['sint maarten', 'netherlands'],
            'st. maarten': ['sint maarten', 'netherlands'],
            'saint martin': ['saint martin', 'sint maarten', 'france'],
            'st. martin': ['saint martin', 'sint maarten', 'france'],
            'netherlands antilles': ['netherlands', 'sint maarten', 'curacao'],
            'montserrat': ['montserrat', 'united kingdom'],
            // Europe
            'united kingdom': ['united kingdom', 'uk', 'great britain'],
            'uk': ['united kingdom'],
            'uk overseas territory': ['united kingdom'],
            'england': ['united kingdom'],
            'scotland': ['united kingdom'],
            'wales': ['united kingdom'],
            'northern ireland': ['united kingdom'],
            'ireland': ['ireland'],
            'france': ['france', 'french republic'],
            'france (mayotte)': ['france', 'mayotte'],
            'germany': ['germany', 'federal republic of germany'],
            'italy': ['italy', 'italian republic'],
            'spain': ['spain', 'kingdom of spain'],
            'portugal': ['portugal'],
            'netherlands': ['netherlands', 'holland'],
            'holland': ['netherlands'],
            'belgium': ['belgium', 'kingdom of belgium'],
            'luxembourg': ['luxembourg'],
            'switzerland': ['switzerland'],
            'austria': ['austria'],
            'greece': ['greece'],
            'poland': ['poland'],
            'czech republic': ['czech republic', 'czechia'],
            'czechia': ['czech republic', 'czechia'],
            'slovakia': ['slovakia'],
            'hungary': ['hungary'],
            'croatia': ['croatia'],
            'slovenia': ['slovenia'],
            'romania': ['romania'],
            'bulgaria': ['bulgaria'],
            'serbia': ['serbia', 'republic of serbia'],
            'montenegro': ['montenegro'],
            'bosnia and herzegovina': ['bosnia and herzegovina'],
            'albania': ['albania'],
            'macedonia': ['north macedonia', 'macedonia'],
            'north macedonia': ['north macedonia'],
            'denmark': ['denmark'],
            'sweden': ['sweden'],
            'norway': ['norway'],
            'finland': ['finland'],
            'iceland': ['iceland'],
            'greenland': ['greenland', 'denmark'],
            'estonia': ['estonia'],
            'latvia': ['latvia'],
            'lithuania': ['lithuania'],
            'russia': ['russia', 'russian federation'],
            'ukraine': ['ukraine'],
            'belarus': ['belarus'],
            'moldova': ['moldova', 'republic of moldova'],
            'malta': ['malta'],
            'cyprus': ['cyprus'],
            'monaco': ['monaco'],
            'andorra': ['andorra'],
            'san marino': ['san marino'],
            'liechtenstein': ['liechtenstein'],
            'vatican city': ['vatican'],
            // Asia
            'china': ['china', 'people\'s republic of china'],
            'japan': ['japan'],
            'south korea': ['south korea', 'korea, republic of', 'republic of korea'],
            'korea': ['south korea', 'republic of korea'],
            'north korea': ['north korea', 'democratic people\'s republic of korea'],
            'taiwan': ['taiwan'],
            'hong kong': ['hong kong', 'china'],
            'macau': ['macau', 'macao', 'china'],
            'india': ['india', 'republic of india'],
            'pakistan': ['pakistan'],
            'bangladesh': ['bangladesh', 'people\'s republic of bangladesh'],
            'sri lanka': ['sri lanka'],
            'nepal': ['nepal'],
            'bhutan': ['bhutan'],
            'maldives': ['maldives'],
            'thailand': ['thailand', 'kingdom of thailand'],
            'vietnam': ['vietnam', 'viet nam'],
            'cambodia': ['cambodia'],
            'laos': ['laos', 'lao people\'s democratic republic'],
            'myanmar': ['myanmar', 'burma'],
            'burma': ['myanmar', 'burma'],
            'malaysia': ['malaysia'],
            'singapore': ['singapore'],
            'indonesia': ['indonesia'],
            'philippines': ['philippines'],
            'brunei': ['brunei', 'brunei darussalam'],
            'timor-leste': ['timor-leste', 'east timor'],
            'mongolia': ['mongolia'],
            // Middle East
            'turkey': ['turkey', 'türkiye'],
            'israel': ['israel'],
            'palestine': ['palestine', 'palestinian territories'],
            'jordan': ['jordan'],
            'lebanon': ['lebanon'],
            'syria': ['syria', 'syrian arab republic'],
            'iraq': ['iraq'],
            'iran': ['iran', 'islamic republic of iran'],
            'saudi arabia': ['saudi arabia'],
            'united arab emirates': ['united arab emirates', 'uae'],
            'uae': ['united arab emirates'],
            'qatar': ['qatar'],
            'bahrain': ['bahrain'],
            'kuwait': ['kuwait'],
            'oman': ['oman'],
            'yemen': ['yemen'],
            // Central Asia
            'kazakhstan': ['kazakhstan'],
            'uzbekistan': ['uzbekistan'],
            'turkmenistan': ['turkmenistan'],
            'tajikistan': ['tajikistan'],
            'kyrgyzstan': ['kyrgyzstan'],
            'afghanistan': ['afghanistan'],
            // Africa
            'egypt': ['egypt'],
            'morocco': ['morocco'],
            'algeria': ['algeria'],
            'tunisia': ['tunisia'],
            'libya': ['libya'],
            'sudan': ['sudan'],
            'south sudan': ['south sudan'],
            'ethiopia': ['ethiopia'],
            'kenya': ['kenya'],
            'tanzania': ['tanzania', 'united republic of tanzania'],
            'uganda': ['uganda'],
            'rwanda': ['rwanda'],
            'south africa': ['south africa'],
            'nigeria': ['nigeria'],
            'ghana': ['ghana'],
            'senegal': ['senegal'],
            'ivory coast': ['ivory coast', 'côte d\'ivoire', 'cote d\'ivoire'],
            'côte d\'ivoire': ['ivory coast', 'côte d\'ivoire', 'cote d\'ivoire'],
            'cameroon': ['cameroon'],
            'democratic republic of the congo': ['democratic republic of the congo', 'drc', 'congo'],
            'congo': ['congo', 'republic of the congo', 'democratic republic of the congo'],
            'angola': ['angola'],
            'mozambique': ['mozambique'],
            'zimbabwe': ['zimbabwe'],
            'zambia': ['zambia'],
            'botswana': ['botswana'],
            'namibia': ['namibia'],
            'madagascar': ['madagascar'],
            'mauritius': ['mauritius'],
            'seychelles': ['seychelles'],
            'comoros': ['comoros'],
            'são tomé & príncipe': ['sao tome and principe', 'são tomé and príncipe'],
            'sao tome and principe': ['sao tome and principe'],
            // Oceania
            'australia': ['australia', 'commonwealth of australia'],
            'new zealand': ['new zealand'],
            'papua new guinea': ['papua new guinea'],
            'fiji': ['fiji'],
            'samoa': ['samoa'],
            'tonga': ['tonga'],
            'vanuatu': ['vanuatu'],
            'solomon islands': ['solomon islands'],
            'new caledonia': ['new caledonia', 'france'],
            'new caledonia (france)': ['new caledonia', 'france'],
            'french polynesia': ['french polynesia', 'france'],
            'guam': ['guam', 'united states of america'],
            'hawaii': ['united states of america'], // Hawaii is part of USA
            'tahiti': ['french polynesia', 'france'],
            'bora bora': ['french polynesia', 'france'],
            'cook islands': ['cook islands', 'new zealand'],
            'kiribati': ['kiribati'],
            'marshall islands': ['marshall islands'],
            'micronesia': ['micronesia', 'federated states of micronesia'],
            'nauru': ['nauru'],
            'palau': ['palau'],
            'tuvalu': ['tuvalu'],
            // French territories
            'réunion (france)': ['france', 'reunion'],
            'reunion': ['france', 'reunion'],
            'saint barthélemy (france)': ['france', 'saint barthelemy'],
            'saint barthelemy': ['france'],
            // Antarctica
            'antarctica': ['antarctica'],
          };

          // Filter GeoJSON to only include visited countries
          const visitedFeatures = countriesGeoJSON.features.filter((feature: any) => {
            // Try multiple property names for country name
            const geoCountryName = feature.properties.name || feature.properties.NAME || feature.properties.ADMIN || '';
            const geoCountryLower = geoCountryName.toLowerCase().trim();

            // Check direct match
            if (visitedCountries.has(geoCountryLower)) {
              console.log('Direct match found:', geoCountryLower);
              return true;
            }

            // Check against mapping - both directions
            for (const visited of visitedCountries) {
              // Get mapped names for the visited country
              const mappedNames = countryNameMap[visited] || [visited];
              for (const mappedName of mappedNames) {
                const mappedLower = mappedName.toLowerCase().trim();
                if (geoCountryLower === mappedLower) {
                  console.log('Mapped match found:', visited, '->', geoCountryLower);
                  return true;
                }
                // Partial matching for longer names
                if (mappedLower.length > 4 && geoCountryLower.includes(mappedLower)) {
                  console.log('Partial match found:', visited, 'in', geoCountryLower);
                  return true;
                }
                if (geoCountryLower.length > 4 && mappedLower.includes(geoCountryLower)) {
                  console.log('Partial match found:', geoCountryLower, 'in', mappedLower);
                  return true;
                }
              }

              // Also check if the GeoJSON name maps to our visited country
              for (const [key, values] of Object.entries(countryNameMap)) {
                if (values.some(v => v.toLowerCase() === geoCountryLower) && visited === key) {
                  console.log('Reverse map match:', geoCountryLower, '->', key);
                  return true;
                }
              }
            }

            return false;
          });

          console.log('Found', visitedFeatures.length, 'matching countries to shade');

          // Add highlighted country layers
          visitedFeatures.forEach((feature: any) => {
            const layer = L.default.geoJSON(feature, {
              style: {
                fillColor: '#ec4899',
                fillOpacity: 0.35,
                color: '#ec4899',
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
        Visited countries are shaded in pink. Click a pin to view details.
        <span className="inline-flex items-center gap-2 ml-2">
          <span className="inline-block w-3 h-3 rounded-full bg-[#16a34a]"></span>
          <span className="text-xs">Starting Point</span>
          <span className="inline-block w-3 h-3 rounded-full bg-[#DC2626]"></span>
          <span className="text-xs">Destination</span>
        </span>
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

async function getCoordinates(
  address?: string | null,
  city?: string | null,
  state?: string | null,
  country?: string | null
): Promise<[number, number] | null> {
  // Build cache key from all parts
  const parts = [address, city, state, country].filter(Boolean).map(s => s!.toLowerCase());
  const cacheKey = parts.join(',');

  // Check cache first
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

    // Call our API route instead of Nominatim directly (avoids CORS)
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
    geocodeCache.set(cacheKey, null);
    return null;
  }
}
