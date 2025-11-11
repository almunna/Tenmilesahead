"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Trip, MediaItem } from "@/lib/types";
import { useRouter } from "next/navigation";
import EditTripModal from "@/components/EditTripModal";
import AddTripModal from "@/components/AddTripModal";
import PhotosModal from "@/components/modals/PhotosModal";
import ItineraryModal from "@/components/modals/ItineraryModal";
import PlaceModal from "@/components/modals/PlaceModal";
import ShareTripModal from "@/components/modals/ShareTripModal";

type WithId<T> = T & { id: string };

export default function MyTrips({ trips }: { trips: WithId<Trip>[] }) {
  const [collapsedTrips, setCollapsedTrips] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredTrips = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() : null;
    return trips.filter((t) => {
      const s = new Date(t.startDate).getTime();
      const e = new Date(t.endDate).getTime();
      if (from && e < from) return false;
      if (to && s > to) return false;
      return true;
    });
  }, [trips, dateFrom, dateTo]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Trips</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-foreground/80">From</label>
            <input
              type="date"
              className="input h-9"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-foreground/80">To</label>
            <input
              type="date"
              className="input h-9"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <button
            className="navlink"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear
          </button>
          <button
            className="btn"
            onClick={() => setCollapsedTrips((v) => !v)}
            aria-expanded={!collapsedTrips}
          >
            {collapsedTrips ? "Expand" : "Collapse"}
          </button>
          <button className="btn" onClick={() => setAddOpen(true)}>
            Add Trip
          </button>
        </div>
      </div>

      {!collapsedTrips && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTrips.map((t) => (
            <TripTile key={t.id} trip={t} />
          ))}
          {filteredTrips.length === 0 && (
            <div className="text-muted-foreground">No trips in this range.</div>
          )}
        </div>
      )}
      {addOpen && (
        <AddTripModal
          onClose={() => setAddOpen(false)}
          onCreated={() => setAddOpen(false)}
        />
      )}
    </section>
  );
}

/* --------------------------- Local helpers/components --------------------------- */

function fmtMDY(s?: string | number | null) {
  if (!s) return "";
  if (typeof s === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  }
  const d = new Date(s as number);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

function TripTile({ trip }: { trip: WithId<Trip> }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cover, setCover] = useState<MediaItem | null>(null);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [showMenuAbove, setShowMenuAbove] = useState(false);
  const buttonContainerRef = useRef<HTMLDivElement>(null);

  const [photosOpen, setPhotosOpen] = useState(false);
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [accommodationsOpen, setAccommodationsOpen] = useState(false);
  const [restaurantsOpen, setRestaurantsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Check position when menu opens to decide if menu should show above or below
  useEffect(() => {
    if (menuOpen && buttonContainerRef.current) {
      const rect = buttonContainerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // If there's more space above than below, or if we're in the bottom half of viewport
      // show menu above, otherwise show below
      setShowMenuAbove(
        spaceAbove > spaceBelow || rect.bottom > viewportHeight / 2
      );
    }
  }, [menuOpen]);

  // cover fetch
  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, "trips", trip.id, "media"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        let chosen: MediaItem | null = null;
        const arr: MediaItem[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        if (trip.coverMediaId) {
          chosen = arr.find((m) => m.id === trip.coverMediaId) || null;
        } else {
          chosen = arr.find((m) => m.type === "image") || null;
        }
        setCover(chosen);
      }
    );
    return () => unsub();
  }, [trip.id, trip.coverMediaId]);

  async function deleteTrip() {
    if (!confirm("Delete this entire trip? This cannot be undone.")) return;
    await deleteDoc(doc(db, "trips", trip.id));
  }

  return (
    <>
      <div
        className="rounded-2xl shadow-lg bg-[#2a3544]"
        style={{ overflow: "visible" }}
      >
        {/* cover with overlay content */}
        <div className="aspect-[16/9] w-full bg-haiti-800/5 overflow-hidden relative">
          {cover?.type === "image" ? (
            <img
              src={cover.downloadURL}
              alt={cover.caption || trip.name}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : cover?.type === "video" ? (
            <video
              src={cover.downloadURL}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/60 text-xs bg-gradient-to-b from-slate-800 to-slate-900">
              No cover yet
            </div>
          )}

          {/* Dark gradient overlay at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>

          {/* Trip info overlay on image - only title and location */}
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <h3 className="text-lg font-semibold mb-1 line-clamp-1">
              {trip.name}
            </h3>

            {/* Location */}
            <div className="flex items-start gap-1.5">
              <svg
                className="w-4 h-4 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm">
                {trip.city || "—"}
                {trip.state ? `, ${trip.state}` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Content below image */}
        <div className="p-4 space-y-3">
          {/* Date with calendar icon */}
          <div className="flex items-center gap-2 text-white/80">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm">
              {fmtMDY(trip.startDate)} - {fmtMDY(trip.endDate)}
            </span>
          </div>

          {/* Bottom action bar */}
          <div
            ref={buttonContainerRef}
            className="relative flex items-center gap-2"
          >
            {/* Menu dropdown - positioned relative to button container */}
            {menuOpen && (
              <div
                className={`absolute left-0 w-64 rounded-xl bg-[#3a4557] shadow-2xl overflow-hidden z-[100] border border-white/10 ${
                  showMenuAbove ? "bottom-full mb-2" : "top-full mt-2"
                }`}
              >
                <div className="flex flex-col py-2">
                  <button
                    className="flex items-center gap-4 px-5 py-3.5 text-white text-base hover:bg-white/10 transition-colors text-left"
                    onClick={() => {
                      setPhotosOpen(true);
                      setMenuOpen(false);
                    }}
                    title="Photos"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Photos</span>
                  </button>
                  <button
                    className="flex items-center gap-4 px-5 py-3.5 text-white text-base hover:bg-white/10 transition-colors text-left"
                    onClick={() => {
                      setItineraryOpen(true);
                      setMenuOpen(false);
                    }}
                    title="Itinerary"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Itinerary</span>
                  </button>
                  <button
                    className="flex items-center gap-4 px-5 py-3.5 text-white text-base hover:bg-white/10 transition-colors text-left"
                    onClick={() => {
                      setDestinationsOpen(true);
                      setMenuOpen(false);
                    }}
                    title="Destinations"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Destinations</span>
                  </button>
                  <button
                    className="flex items-center gap-4 px-5 py-3.5 text-white text-base hover:bg-white/10 transition-colors text-left"
                    onClick={() => {
                      setActivitiesOpen(true);
                      setMenuOpen(false);
                    }}
                    title="Activities"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                    <span>Activities</span>
                  </button>
                  <button
                    className="flex items-center gap-4 px-5 py-3.5 text-white text-base hover:bg-white/10 transition-colors text-left"
                    onClick={() => {
                      setAccommodationsOpen(true);
                      setMenuOpen(false);
                    }}
                    title="Accommodations"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                    <span>Accommodations</span>
                  </button>
                  <button
                    className="flex items-center gap-4 px-5 py-3.5 text-white text-base hover:bg-white/10 transition-colors text-left"
                    onClick={() => {
                      setRestaurantsOpen(true);
                      setMenuOpen(false);
                    }}
                    title="Restaurants"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                      <path
                        fillRule="evenodd"
                        d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Restaurants</span>
                  </button>
                </div>
              </div>
            )}

            {/* View Trip button */}
            <button
              className="flex items-center gap-2 px-4 py-2 bg-[#5eb9b3] hover:bg-[#4ea9a3] rounded-lg text-white text-sm font-medium transition-colors"
              onClick={() => router.push(`/trips/${trip.id}`)}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path
                  fillRule="evenodd"
                  d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                  clipRule="evenodd"
                />
              </svg>
              View Trip
            </button>

            {/* Menu button - toggles dropdown */}
            <button
              type="button"
              className="h-9 w-9 rounded-lg bg-[#3a4557] hover:bg-[#4a5567] flex items-center justify-center text-white transition-colors"
              aria-label="Menu"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Share button */}
            <button
              type="button"
              className="h-9 w-9 rounded-lg bg-[#3a4557] hover:bg-[#4a5567] flex items-center justify-center text-white transition-colors"
              aria-label="Share"
              onClick={(e) => {
                e.stopPropagation();
                setShareOpen(true);
              }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
            </button>

            {/* Edit button */}
            <button
              type="button"
              className="h-9 w-9 rounded-lg bg-[#3a4557] hover:bg-[#4a5567] flex items-center justify-center text-white transition-colors"
              aria-label="Edit"
              onClick={(e) => {
                e.stopPropagation();
                setEditingTrip(trip as Trip);
              }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>

            {/* Delete button */}
            <button
              type="button"
              className="h-9 w-9 rounded-lg bg-[#c94040] hover:bg-[#b93030] flex items-center justify-center text-white transition-colors"
              aria-label="Delete"
              onClick={(e) => {
                e.stopPropagation();
                deleteTrip();
              }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* lightweight inline modals (unchanged functionality, scoped here) */}
      {editingTrip && (
        <EditTripModal
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
        />
      )}

      {photosOpen && (
        <PhotosModal tripId={trip.id} onClose={() => setPhotosOpen(false)} />
      )}
      {itineraryOpen && (
        <ItineraryModal
          tripId={trip.id}
          onClose={() => setItineraryOpen(false)}
        />
      )}
      {destinationsOpen && (
        <PlaceModal
          title="Destinations"
          tripId={trip.id}
          subcollection="destinations"
          priceUnits={["Per Person", "Per Couple", "Per Group", "Total"]}
          extraLeft={[
            {
              key: "transportationType",
              label: "Mode of Transportation",
              options: [
                "Bicycle",
                "Bus",
                "Car",
                "Cruise",
                "Ferry/Boat",
                "Flight",
                "Train",
                "Walking",
                "Other",
              ],
            },
          ]}
          extraRight={[
            {
              key: "accommodationType",
              label: "Accommodation Type",
              options: [
                "Apartment / Airbnb",
                "Camping",
                "Cruise",
                "Friend/Family",
                "Guesthouse",
                "Hostel",
                "Hotel",
                "Resort",
                "Other",
              ],
            },
          ]}
          onClose={() => setDestinationsOpen(false)}
        />
      )}
      {activitiesOpen && (
        <PlaceModal
          title="Activities"
          tripId={trip.id}
          subcollection="activities"
          priceUnits={["Per User", "Per Couple", "Per Group"]}
          onClose={() => setActivitiesOpen(false)}
        />
      )}
      {accommodationsOpen && (
        <PlaceModal
          title="Accommodations"
          tripId={trip.id}
          subcollection="accommodations"
          priceUnits={["Per Night", "Total Stay"]}
          onClose={() => setAccommodationsOpen(false)}
        />
      )}
      {restaurantsOpen && (
        <PlaceModal
          title="Restaurants"
          tripId={trip.id}
          subcollection="restaurants"
          priceUnits={["Per Person", "Per Couple"]}
          onClose={() => setRestaurantsOpen(false)}
        />
      )}
      {shareOpen && (
        <ShareTripModal tripId={trip.id} onClose={() => setShareOpen(false)} />
      )}
    </>
  );
}
