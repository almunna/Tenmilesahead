"use client";

import { useEffect, useRef, useState } from "react";
import { Trip } from "@/lib/types";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import "leaflet/dist/leaflet.css";

// Type for destination from subcollection
type Destination = {
  id: string;
  tripId: string;
  tripName: string;
  name?: string;
  city: string;
  state?: string;
  country: string;
  specificAddress?: string;
};

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
  const markersByDestId = useRef<Map<string, any>>(new Map());
  const countryLayersRef = useRef<any[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);

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

      // Calculate minimum zoom to prevent empty space
      const containerWidth = mapContainer.current.clientWidth;
      const containerHeight = mapContainer.current.clientHeight;

      // Calculate min zoom so that world fills the container
      // World is 360 degrees wide, each tile at zoom 0 is 256px and covers 360 degrees
      // At zoom N, world width = 256 * 2^N pixels
      const minZoomX = Math.ceil(Math.log2(containerWidth / 256));
      const minZoomY = Math.ceil(Math.log2(containerHeight / 256));
      const calculatedMinZoom = Math.max(minZoomX, minZoomY, 2);

      // Create map instance (attributionControl: false removes the attribution)
      map.current = L.default.map(mapContainer.current, {
        attributionControl: false,
        preferCanvas: false, // Use SVG renderer for better GeoJSON edge rendering
        fadeAnimation: true,
        zoomAnimation: true,
        minZoom: calculatedMinZoom,
        worldCopyJump: true, // Jump to the "main" world copy when panning far
        maxBounds: [[-85, -Infinity], [85, Infinity]], // Restrict to where tiles exist
        maxBoundsViscosity: 1.0, // Rigid bounds to prevent scrolling into empty space
      }).setView([20, 0], calculatedMinZoom);

      // Add Carto Voyager Labels tiles - shows labels on top including remote areas
      // Using the labels-only layer on top of base for better visibility
      L.default.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png", {
        maxZoom: 20,
        minZoom: calculatedMinZoom,
        attribution: '© OpenStreetMap contributors, © CARTO',
        keepBuffer: 4, // Keep extra tiles loaded around the visible area
        updateWhenIdle: false, // Update tiles while panning
        updateWhenZooming: false,
        crossOrigin: true,
        subdomains: 'abcd',
      }).addTo(map.current);

      // Invalidate size after a short delay to ensure proper rendering
      setTimeout(() => {
        if (map.current) {
          map.current.invalidateSize();
        }
      }, 200);
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

    // Track if this effect is still active (prevents stale async operations)
    let isActive = true;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    markersByTripId.current.clear();
    markersByDestId.current.clear();

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

      // Check if effect is still active after the delay
      if (!isActive || !map.current) return;

      // Dynamic import of Leaflet for markers
      const L = await import("leaflet");
      const validCoordinates: any[] = [];

      // Collect all visited countries from trips AND their destinations
      const visitedCountries = new Set<string>();

      // Collect all destinations from subcollections
      const allDestinations: Destination[] = [];

      // FIRST: Collect countries and destinations from all trips
      for (const trip of trips) {
        // Add main trip country
        if (trip.country) {
          visitedCountries.add(trip.country.toLowerCase().trim());
        }

        // Fetch destinations subcollection for this trip
        try {
          const destSnap = await getDocs(collection(db, "trips", trip.id, "destinations"));
          destSnap.forEach((doc) => {
            const data = doc.data();
            if (data.country) {
              visitedCountries.add(data.country.toLowerCase().trim());
              allDestinations.push({
                id: doc.id,
                tripId: trip.id,
                tripName: trip.name,
                name: data.name,
                city: data.city || "",
                state: data.state,
                country: data.country,
                specificAddress: data.specificAddress,
              });
            }
          });
        } catch (error) {
          console.error("Error fetching destinations for trip", trip.id, error);
        }
      }

      // Create custom red pin icon for primary destinations
      const primaryIcon = L.default.divIcon({
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

      // Create custom red pin icon for additional destinations (same as primary)
      const destinationIcon = L.default.divIcon({
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

      // SECOND: Add markers for primary trip destinations (red pins)
      for (const trip of trips) {
        // Skip if effect was cancelled
        if (!isActive || !map.current) return;

        // Skip trips without country for marker placement
        if (!trip.country) {
          continue;
        }

        // Try to get coordinates - the API will fallback to state/country if city is wrong
        const coordinates = await getCoordinates(trip.specificAddress, trip.city, trip.state, trip.country);

        if (coordinates && map.current && isActive) {
          // Create marker
          const marker = L.default.marker([coordinates[1], coordinates[0]], {
            icon: primaryIcon,
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

      // THIRD: Add markers for additional destinations from subcollections (blue pins)
      for (const dest of allDestinations) {
        // Skip if effect was cancelled
        if (!isActive || !map.current) return;

        if (!dest.country) continue;

        const coordinates = await getCoordinates(dest.specificAddress, dest.city, dest.state, dest.country);

        if (coordinates && map.current && isActive) {
          const marker = L.default.marker([coordinates[1], coordinates[0]], {
            icon: destinationIcon,
          });

          const locationStr = [dest.city, dest.state, dest.country].filter(Boolean).join(", ");
          const popupContent = `
            <div style="padding: 8px; min-width: 200px;">
              <strong style="font-size: 14px;">${dest.name || locationStr}</strong><br/>
              <span style="color: #666; font-size: 12px;">
                ${locationStr}
              </span><br/>
              <span style="color: #888; font-size: 11px;">
                Part of: ${dest.tripName}
              </span><br/>
              <button
                onclick="window.openTripFlipbook('${dest.tripId}')"
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
          markersByDestId.current.set(dest.id, marker);

          validCoordinates.push([coordinates[1], coordinates[0]]);
        }
      }

      // Store destinations in state for the sidebar
      if (isActive) {
        setDestinations(allDestinations);
      }

      // Highlight visited countries
      if (visitedCountries.size > 0 && map.current && isActive) {
        try {
          // Fetch country boundaries GeoJSON (using Natural Earth 10m for most detailed island boundaries)
          const response = await fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson');

          // Check if still active after fetch
          if (!isActive || !map.current) return;

          if (!response.ok) {
            console.error('Failed to fetch GeoJSON:', response.status);
            return;
          }

          const countriesGeoJSON = await response.json();

          // Check again after parsing JSON
          if (!isActive || !map.current) return;

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
            'bahamas': ['the bahamas', 'bahamas', 'commonwealth of the bahamas'],
            'the bahamas': ['the bahamas', 'bahamas', 'commonwealth of the bahamas'],
            'new providence': ['the bahamas', 'bahamas'], // Nassau is on New Providence island
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
            'anguilla': ['anguilla'],
            'aruba': ['aruba'],
            'bonaire': ['bonaire', 'caribbean netherlands'],
            'curacao': ['curacao', 'curaçao'],
            'curaçao': ['curacao', 'curaçao'],
            'bermuda': ['bermuda'],
            'cayman islands': ['cayman islands'],
            'turks and caicos islands': ['turks and caicos islands'],
            'turks and caicos': ['turks and caicos islands'],
            'british virgin islands': ['british virgin islands'],
            'u.s. virgin islands': ['united states virgin islands', 'u.s. virgin islands'],
            'virgin islands': ['united states virgin islands', 'british virgin islands'],
            'guadeloupe': ['guadeloupe'],
            'guadeloupe (france)': ['guadeloupe'],
            'martinique': ['martinique'],
            'martinique (france)': ['martinique'],
            'sint maarten': ['sint maarten'],
            'st. maarten': ['sint maarten'],
            'saint martin': ['saint martin', 'sint maarten'],
            'st. martin': ['saint martin', 'sint maarten'],
            'netherlands antilles': ['sint maarten', 'curacao'],
            'montserrat': ['montserrat'],
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
            'france (mayotte)': ['mayotte'],
            'mayotte': ['mayotte'],
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
            'greenland': ['greenland'],
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

          // Build a set of all countries that should be shaded (including parent/sovereign countries)
          const countriesToShade = new Set<string>();

          for (const visited of visitedCountries) {
            // Add the visited country itself
            countriesToShade.add(visited);

            // Get mapped names (including parent/sovereign countries)
            const mappedNames = countryNameMap[visited] || [];
            for (const mappedName of mappedNames) {
              countriesToShade.add(mappedName.toLowerCase().trim());
            }
          }

          console.log('Countries to shade (including parent countries):', Array.from(countriesToShade));

          // Filter GeoJSON to only include visited countries
          const visitedFeatures = countriesGeoJSON.features.filter((feature: any) => {
            // Try multiple property names for country name (Natural Earth uses ADMIN, NAME, NAME_LONG)
            const props = feature.properties;
            const geoCountryName = props.ADMIN || props.NAME || props.name || props.NAME_LONG || '';
            const geoCountryLower = geoCountryName.toLowerCase().trim();

            // Check direct match against our expanded set
            if (countriesToShade.has(geoCountryLower)) {
              console.log('Direct match found:', geoCountryLower);
              return true;
            }

            // Also check if the GeoJSON name maps to any country we should shade
            for (const [key, values] of Object.entries(countryNameMap)) {
              if (values.some(v => v.toLowerCase() === geoCountryLower) && countriesToShade.has(key)) {
                console.log('Reverse map match:', geoCountryLower, '->', key);
                return true;
              }
            }

            return false;
          });

          console.log('Found', visitedFeatures.length, 'matching countries to shade');

          // Create a single GeoJSON layer for all visited countries
          // This prevents clipping issues at viewport edges
          const allVisitedGeoJSON = {
            type: 'FeatureCollection',
            features: visitedFeatures,
          };

          // Create SVG renderer with large padding to prevent edge clipping
          // padding: 2.0 means 200% extra space beyond viewport for rendering
          const svgRenderer = L.default.svg({ padding: 2.0 });

          const layer = L.default.geoJSON(allVisitedGeoJSON as any, {
            style: {
              fillColor: '#ec4899',
              fillOpacity: 0.15, // Reduced opacity so roads/cities are visible
              color: '#ec4899',
              weight: 1.5,
              opacity: 0.5,
            },
            renderer: svgRenderer,
          } as any);

          if (map.current && isActive) {
            layer.addTo(map.current);
            layer.bringToBack(); // Ensure country layers are behind markers
            countryLayersRef.current.push(layer);
          }
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

    // Cleanup function to prevent stale async operations from adding layers
    return () => {
      isActive = false;
    };
  }, [trips, onOpenFlip, isClient]);

  // Function to pan to a trip marker and open its popup
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

  // Function to pan to a destination marker and open its popup
  const handleDestPinClick = (destId: string) => {
    const marker = markersByDestId.current.get(destId);
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
      </p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-[75%_25%] gap-4">
        <div
          ref={mapContainer}
          className="min-h-[350px] sm:min-h-[500px] md:min-h-[700px] lg:min-h-[750px] w-full rounded-xl overflow-hidden border border-border"
          style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', minHeight: '350px', backgroundColor: '#aad3df' }}
        />

        <div className="rounded-xl border border-border p-3">
          <div className="text-sm font-semibold mb-2">All Pins</div>
          <ul className="max-h-[300px] sm:max-h-[450px] md:max-h-[650px] lg:max-h-[700px] overflow-auto text-sm space-y-1">
            {/* Primary trip destinations (red pins) */}
            {trips.map((t) => {
              const fullLocation = [t.city, t.state, t.country].filter(Boolean).join(", ") || "—";
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2"
                >
                  <button
                    onClick={() => handlePinClick(t.id)}
                    className="flex-1 truncate text-left hover:text-[#66bfcc] transition-colors"
                    title={`${t.name}\n${fullLocation}`}
                  >
                    <span className="mr-2 text-red-500">📍</span>
                    {fullLocation}
                  </button>
                  <button
                    className="navlink text-xs flex-shrink-0"
                    onClick={() => onOpenFlip(t.id)}
                  >
                    View Flipbook
                  </button>
                </li>
              );
            })}
            {/* Additional destinations from subcollections (red pins) */}
            {destinations.map((d) => {
              const fullLocation = [d.city, d.state, d.country].filter(Boolean).join(", ") || "—";
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2"
                >
                  <button
                    onClick={() => handleDestPinClick(d.id)}
                    className="flex-1 truncate text-left hover:text-[#66bfcc] transition-colors"
                    title={`${d.name || fullLocation}\nPart of: ${d.tripName}`}
                  >
                    <span className="mr-2 text-red-500">📍</span>
                    {fullLocation}
                  </button>
                  <button
                    className="navlink text-xs flex-shrink-0"
                    onClick={() => onOpenFlip(d.tripId)}
                  >
                    View Flipbook
                  </button>
                </li>
              );
            })}
            {trips.length === 0 && destinations.length === 0 && (
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
