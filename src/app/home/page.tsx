"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Protected from "@/components/Protected";
import { useAuth } from "@/components/AuthProvider";
import Flipbook from "@/components/Flipbook";
import EditTripModal from "@/components/EditTripModal";
import TripCreateMediaPicker from "@/components/TripCreateMediaPicker";
import ConfirmModal from "@/components/modals/ConfirmModal";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage, auth } from "@/lib/firebase";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import type { Trip, MediaItem } from "@/lib/types";
import { COUNTRIES, getStates } from "@/lib/geo";
import { getPhotoTakenAt } from "@/lib/utils";

/* --------------------------------- Helpers --------------------------------- */

// Properly singularize title names (Activities → Activity, Destinations → Destination, etc.)
function singularize(title: string): string {
  if (title === "Activities") return "Activity";
  if (title.endsWith("ies")) return title.slice(0, -3) + "y";
  if (title.endsWith("s")) return title.slice(0, -1);
  return title;
}

/* --------------------------------- Types --------------------------------- */

type WithId<T> = T & { id: string };

type SimplePlace = {
  id?: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  city?: string | null;
  state?: string | null;
  country: string;
  price?: number | null;
  priceUnit?: string | null; // e.g., "Per Night", "Per Couple", etc.
  address?: string | null;
  createdAt?: number;
  updatedAt?: number;
};

type Activity = SimplePlace & {
  category?: string | null;
};
type Destination = SimplePlace & {
  transportationType?: string | null;
  accommodationType?: string | null;
};
type Accommodation = SimplePlace & {};
type Restaurant = SimplePlace & {};

/* ------------------------------ Helper utils ----------------------------- */

const iso = (d: Date | number) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const fmtMDY = (s?: string | number | null) => {
  if (!s) return "";
  if (typeof s === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  }
  const d = new Date(s as number);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}/${d.getFullYear()}`;
};
const unique = <T,>(arr: T[]) => Array.from(new Set(arr));

/* -------------------------------- Page root ------------------------------- */

export default function HomePage() {
  return (
    <Protected>
      <HomeInner />
    </Protected>
  );
}

/* ---------------------------------- App ---------------------------------- */

function HomeInner() {
  const { user } = useAuth();

  /* ------------------------------ USERNAME EDIT ----------------------------- */
  const [username, setUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const uref = doc(db, "users", user.uid);
    const unsub = onSnapshot(uref, (snap) => {
      const d = snap.data() as any;
      setUsername(d?.username || "");
    });
    return () => unsub();
  }, [user]);

  async function saveUsername() {
    if (!user || !username.trim()) return;
    setUsernameSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email || null,
          username: username.trim(),
          updatedAt: Date.now(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    } finally {
      setUsernameSaving(false);
    }
  }

  /* ----------------------------- TRIPS + FILTERS ---------------------------- */

  const [trips, setTrips] = useState<WithId<Trip>[]>([]);
  const [collapsedTrips, setCollapsedTrips] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!user) return;
    const qTrips = query(
      collection(db, "trips"),
      where("ownerId", "==", user.uid),
      orderBy("startDate", "desc")
    );
    const unsub = onSnapshot(qTrips, (snap) => {
      const arr: WithId<Trip>[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      // newest to oldest (by startDate desc already)
      setTrips(arr);
    });
    return () => unsub();
  }, [user]);

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

  /* -------------------------- GLOBAL STATS (OVERVIEW) ----------------------- */

  const [photoCount, setPhotoCount] = useState(0);
  const [visitedCountries, setVisitedCountries] = useState<string[]>([]);
  const [visitedStates, setVisitedStates] = useState<string[]>([]);
  const [visitedCities, setVisitedCities] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    // aggregate across all trips
    async function aggregate() {
      const qTrips = query(
        collection(db, "trips"),
        where("ownerId", "==", user.uid)
      );
      const tSnap = await getDocs(qTrips);

      const cSet = new Set<string>();
      const sSet = new Set<string>();
      const citySet = new Set<string>();

      let imgTotal = 0;

      for (const docSnap of tSnap.docs) {
        const t = docSnap.data() as Trip;
        if (t.country) cSet.add(t.country);
        if (t.state) sSet.add(t.state);
        if (t.city) citySet.add(`${t.city}|${t.country || ""}`);

        // include destinations as well for counts/pins
        const destSnap = await getDocs(
          collection(db, "trips", docSnap.id, "destinations")
        );
        destSnap.forEach((d) => {
          const x = d.data() as Destination;
          if (x.country) cSet.add(x.country);
          if (x.state) sSet.add(x.state!);
          if (x.city) citySet.add(`${x.city}|${x.country || ""}`);
        });

        // media images only
        const mediaSnap = await getDocs(
          collection(db, "trips", docSnap.id, "media")
        );
        mediaSnap.forEach((m) => {
          const mm = m.data() as MediaItem;
          if (mm.type === "image") imgTotal += 1;
        });
      }

      setVisitedCountries(Array.from(cSet));
      setVisitedStates(Array.from(sSet));
      setVisitedCities(Array.from(citySet).map((s) => s.split("|")[0]));
      setPhotoCount(imgTotal);
    }

    aggregate();
  }, [user, trips.length]);

  /* --------------------------------- PINS ---------------------------------- */
  // For now, we scaffold the map section: show a pin list & future map mount point.
  // Clicking a pin opens the trip’s Flipbook.

  const [flipTripId, setFlipTripId] = useState<string | null>(null);

  return (
    <main className="bg-background min-h-dvh">
      {/* content starts below the global Navbar from layout */}
      <div className="container py-6 space-y-10">
        {/* Username editor */}
        <section className="card">
          <h2 className="text-xl font-semibold">Your Display Name</h2>
          <p className="text-muted-foreground text-sm mt-1">
            This name is shown on your reviews. (Required)
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <input
              className="input flex-1"
              placeholder="e.g., Williams’ Family Adventures"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <button
              className="btn"
              onClick={saveUsername}
              disabled={!username.trim() || usernameSaving}
            >
              {usernameSaving ? "Saving..." : "Save Name"}
            </button>
          </div>
        </section>

        {/* My Trips (collapsible) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">My Trips</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">From</label>
                <input
                  type="date"
                  className="input h-9"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">To</label>
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
            </div>
          </div>

          {!collapsedTrips && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTrips.map((t) => (
                <TripTile
                  key={t.id}
                  trip={t}
                  onOpenFlip={() => setFlipTripId(t.id)}
                />
              ))}
              {filteredTrips.length === 0 && (
                <div className="text-muted-foreground">
                  No trips in this range.
                </div>
              )}
            </div>
          )}
        </section>

        {/* World Map (scaffold) */}
        <section className="card">
          <h2 className="text-xl font-semibold">World Map</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Countries you’ve visited are shaded; pins mark your trip cities.
            Click a pin to open the trip.
          </p>

          {/* Placeholder for future map library (Leaflet / react-simple-maps) */}
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div className="min-h-[280px] rounded-xl bg-haiti-800/5 flex items-center justify-center">
              <span className="text-sm text-muted-foreground">
                (Map goes here — ready to hook up to your preferred library)
              </span>
            </div>

            {/* Pin list (clickable) */}
            <div className="rounded-xl border border-border p-3">
              <div className="text-sm font-semibold mb-2">Trip Pins</div>
              <ul className="max-h-64 overflow-auto text-sm space-y-1">
                {trips.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="truncate">
                      <span className="mr-2">📍</span>
                      {t.city || "—"}, {t.state ? `${t.state}, ` : ""}
                      {t.country || "—"}
                    </div>
                    <button
                      className="navlink text-xs"
                      onClick={() => setFlipTripId(t.id)}
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

          <div className="mt-3 text-xs text-muted-foreground">
            • Country shading uses the first time you visit a country • Pins
            drop at address if present, otherwise city center.
          </div>
        </section>

        {/* Travel Overview */}
        <section className="card">
          <h2 className="text-xl font-semibold">Your Travel Overview</h2>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Photos captured" value={`${photoCount}`} />
            <StatTile
              label="Countries"
              value={`${visitedCountries.length}/197`}
            />
            <StatTile
              label="States (US)"
              value={`${visitedStates.length}/50`}
            />
            <StatTile label="Cities" value={`${visitedCities.length}`} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Counts are cumulative and unique (repeat visits don’t increase
            totals).
          </div>
        </section>
      </div>

      {/* Flipbook modal */}
      {flipTripId && (
        <div className="fixed inset-x-0 top-[60px] bottom-0 z-[100] bg-black/70 flex items-center justify-center">
          <div className="relative w-[95vw] h-[92vh] bg-background rounded-xl overflow-hidden">
            <button
              className="absolute top-2 right-2 z-10 btn"
              onClick={() => setFlipTripId(null)}
            >
              Close
            </button>
            <div className="w-full h-full">
              <Flipbook
                tripId={flipTripId}
                open={true}
                onClose={() => setFlipTripId(null)}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ------------------------------- Subcomponents ------------------------------ */

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-muted-foreground text-sm">{label}</div>
    </div>
  );
}

function TripTile({
  trip,
  onOpenFlip,
}: {
  trip: WithId<Trip>;
  onOpenFlip: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cover, setCover] = useState<MediaItem | null>(null);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  const [photosOpen, setPhotosOpen] = useState(false);
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [accommodationsOpen, setAccommodationsOpen] = useState(false);
  const [restaurantsOpen, setRestaurantsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Cover
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
    await deleteDoc(doc(db, "trips", trip.id));
    setDeleteConfirmOpen(false);
  }

  return (
    <>
      <div className="card overflow-hidden relative">
        {/* Menu */}
        <div className="absolute top-2 right-2 z-10">
          <button
            type="button"
            className="h-8 w-8 rounded-full bg-surface/90 border border-border flex items-center justify-center text-muted-foreground hover:bg-surface"
            aria-label="More actions"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-40 rounded-md border border-border bg-surface shadow-md text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="block w-full text-left px-3 py-2 hover:bg-haiti-800/5"
                onClick={() => {
                  setEditingTrip(trip as Trip);
                  setMenuOpen(false);
                }}
              >
                Edit trip info
              </button>
              <button
                type="button"
                className="block w-full text-left px-3 py-2 hover:bg-haiti-800/5 text-red-600"
                onClick={() => {
                  setDeleteConfirmOpen(true);
                  setMenuOpen(false);
                }}
              >
                Delete trip
              </button>
            </div>
          )}
        </div>

        {/* Cover */}
        <div className="aspect-[16/9] w-full bg-haiti-800/5 overflow-hidden relative">
          <CoverThumbHome tripId={trip.id!} coverMediaId={trip.coverMediaId} />
        </div>

        {/* Body */}
        <div className="p-4 space-y-2" onClick={() => setMenuOpen(false)}>
          <div className="flex items-start justify-between gap-3">
            <div className="font-semibold text-base line-clamp-1">
              {trip.name}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-haiti-800/5">
              {trip.transportationType || "—"}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {trip.city || "—"}
            {trip.state ? `, ${trip.state}` : ""}
            {trip.country ? `, ${trip.country}` : ""}
          </div>
          <div className="text-sm text-foreground">
            {fmtMDY(trip.startDate)} → {fmtMDY(trip.endDate)}
          </div>

          {/* Action row */}
          <div className="pt-3 flex flex-wrap items-center gap-2">
            <button className="btn" onClick={onOpenFlip}>
              View Trip
            </button>

            {/* 4a Photos */}
            <button
              className="navlink"
              onClick={() => setPhotosOpen(true)}
              title="Photos"
            >
              📷 Photos
            </button>
            {/* 4b Itinerary */}
            <button
              className="navlink"
              onClick={() => setItineraryOpen(true)}
              title="Itinerary"
            >
              🗓️ Itinerary
            </button>
            {/* 4c Destinations */}
            <button
              className="navlink"
              onClick={() => setDestinationsOpen(true)}
              title="Destinations"
            >
              📍 Destinations
            </button>
            {/* 4d Activities */}
            <button
              className="navlink"
              onClick={() => setActivitiesOpen(true)}
              title="Activities"
            >
              🎟️ Activities
            </button>
            {/* 4e Accommodations */}
            <button
              className="navlink"
              onClick={() => setAccommodationsOpen(true)}
              title="Accommodations"
            >
              🏨 Accommodations
            </button>
            {/* 4f Restaurants */}
            <button
              className="navlink"
              onClick={() => setRestaurantsOpen(true)}
              title="Restaurants"
            >
              🍽️ Restaurants
            </button>
            {/* Share */}
            <button
              className="navlink"
              onClick={() => setShareOpen(true)}
              title="Share link"
            >
              🔗 Share
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
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
        <DestinationModal
          tripId={trip.id}
          onClose={() => setDestinationsOpen(false)}
        />
      )}

      {activitiesOpen && (
        <ActivityModal
          tripId={trip.id}
          onClose={() => setActivitiesOpen(false)}
        />
      )}

      {accommodationsOpen && (
        <AccommodationModal
          tripId={trip.id}
          onClose={() => setAccommodationsOpen(false)}
        />
      )}

      {restaurantsOpen && (
        <RestaurantModal
          tripId={trip.id}
          onClose={() => setRestaurantsOpen(false)}
        />
      )}

      {shareOpen && (
        <ShareTripModal tripId={trip.id} onClose={() => setShareOpen(false)} />
      )}

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Trip"
        message={`Are you sure you want to delete "${trip.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={deleteTrip}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>
  );
}

/* ----------------------------- Photos (4a) ----------------------------- */

function PhotosModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...fs]);
  }

  useEffect(() => {
    setPreviews((prev) => {
      const next = { ...prev };
      for (const f of files) {
        const k = fileKey(f);
        if (!next[k]) next[k] = URL.createObjectURL(f);
      }
      for (const k of Object.keys(next)) {
        if (!files.find((f) => fileKey(f) === k)) {
          URL.revokeObjectURL(next[k]);
          delete next[k];
        }
      }
      return next;
    });
  }, [files]);

  useEffect(
    () => () => Object.values(previews).forEach((u) => URL.revokeObjectURL(u)),
    [previews]
  );

  async function save() {
    if (files.length === 0) return;
    setSaving(true);
    try {
      // upload each, write media docs, set cover if chosen
      let chosenCoverMediaId: string | null = null;
      let firstImageMediaId: string | null = null;

      for (const f of files) {
        const k = fileKey(f);
        const isImage = f.type.startsWith("image/");
        const isVideo = f.type.startsWith("video/");
        const kind = isImage ? "image" : isVideo ? "video" : "other";
        if (kind === "other") continue;

        const mediaRef = doc(collection(db, "trips", tripId, "media"));
        const mediaId = mediaRef.id;

        const safeName = f.name.replace(/[^\w.\-]+/g, "_");
        const path = `trip_media/${auth.currentUser?.uid}/${tripId}/${mediaId}/${safeName}`;
        const sref = storageRef(storage, path);
        await uploadBytes(sref, f);
        const url = await getDownloadURL(sref);

        // Extract EXIF date for proper chronological ordering
        const takenAt = await getPhotoTakenAt(f);

        await setDoc(mediaRef, {
          tripId,
          type: kind,
          storagePath: path,
          downloadURL: url,
          createdAt: Date.now(),
          takenAt,
          caption: captions[k] || "",
          fileName: f.name,
          size: f.size,
          contentType: f.type,
        } as any);

        if (isImage) {
          if (!firstImageMediaId) firstImageMediaId = mediaId;
          if (coverKey === k) chosenCoverMediaId = mediaId;
        }
      }

      const coverId = chosenCoverMediaId || firstImageMediaId;
      if (coverId) {
        await updateDoc(doc(db, "trips", tripId), {
          coverMediaId: coverId,
          updatedAt: Date.now(),
        } as any);
      }

      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Photos" onClose={onClose}>
      <div className="space-y-3">
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={onPick}
        />
        {files.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No media selected.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((f) => {
              const k = fileKey(f);
              const url = previews[k];
              const isImage = f.type.startsWith("image/");
              return (
                <div key={k} className="card space-y-2">
                  <div className="w-full h-56 rounded-xl overflow-hidden bg-haiti-800/5">
                    {isImage ? (
                      <img
                        src={url}
                        alt={f.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={url}
                        className="w-full h-full object-cover"
                        controls
                        preload="metadata"
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className={
                        coverKey === k
                          ? "text-sm text-green-600"
                          : "text-sm link"
                      }
                      onClick={() => setCoverKey(k)}
                    >
                      {coverKey === k ? "✓ Cover" : "Set as cover"}
                    </button>
                    <button
                      type="button"
                      className="text-sm text-red-600"
                      onClick={() =>
                        setFiles((prev) => prev.filter((x) => fileKey(x) !== k))
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <div>
                    <label className="label">Caption</label>
                    <textarea
                      className="input h-auto min-h-[44px]"
                      rows={1}
                      value={captions[k] || ""}
                      onChange={(e) =>
                        setCaptions((p) => ({ ...p, [k]: e.target.value }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="pt-2 flex justify-end gap-2">
          <button className="navlink" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={save}
            disabled={saving || files.length === 0}
          >
            {saving ? "Saving..." : "Save Photos"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* --------------------------- Itinerary (4b) --------------------------- */

function ItineraryModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Array<{ kind: string; data: any }>>([]);

  useEffect(() => {
    (async () => {
      const rows: Array<{ kind: string; data: any }> = [];

      const dest = await getDocs(
        collection(db, "trips", tripId, "destinations")
      );
      dest.forEach((d) =>
        rows.push({
          kind: "Destination",
          data: { id: d.id, ...(d.data() as any) },
        })
      );

      const acts = await getDocs(collection(db, "trips", tripId, "activities"));
      acts.forEach((d) =>
        rows.push({
          kind: "Activity",
          data: { id: d.id, ...(d.data() as any) },
        })
      );

      const acc = await getDocs(
        collection(db, "trips", tripId, "accommodations")
      );
      acc.forEach((d) =>
        rows.push({
          kind: "Accommodation",
          data: { id: d.id, ...(d.data() as any) },
        })
      );

      const res = await getDocs(collection(db, "trips", tripId, "restaurants"));
      res.forEach((d) =>
        rows.push({
          kind: "Restaurant",
          data: { id: d.id, ...(d.data() as any) },
        })
      );

      rows.sort((a, b) => {
        const sa = new Date(a.data.startDate || 0).getTime();
        const sb = new Date(b.data.startDate || 0).getTime();
        return sa - sb;
      });

      setItems(rows);
    })();
  }, [tripId]);

  return (
    <ModalShell title="Itinerary (chronological summary)" onClose={onClose}>
      <div className="text-sm text-muted-foreground mb-3">
        Click any entry to open a flipbook filtered to that item’s photos
        (coming next).
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface">
            <tr>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Dates</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-left">Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => {
              const d = row.data;
              return (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2">{row.kind}</td>
                  <td className="px-3 py-2">{d.name || "—"}</td>
                  <td className="px-3 py-2">
                    {fmtMDY(d.startDate)}
                    {d.endDate ? ` → ${fmtMDY(d.endDate)}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    {[d.address, d.city, d.state, d.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {d.price != null ? `${d.price} ${d.priceUnit || ""}` : "—"}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-4 text-center text-muted-foreground"
                >
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}

/* ---------------------- Destinations / Activities / etc --------------------- */
/* Pattern: simple create form + list. All support photo uploads inline, notes, price. */

function DestinationModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  return (
    <PlaceModal
      title="Destinations"
      tripId={tripId}
      subcollection="destinations"
      priceUnits={["Per Person", "Per Couple", "Per Group", "Total"]}
      extraLeft={[
        {
          key: "transportationType",
          label: "Mode of Transportation",
          options: [
            "Airplane",
            "Bus",
            "Car",
            "Cruise",
            "RV",
            "Train",
            "Uber/Taxi",
            "Walk",
          ],
        },
      ]}
      onClose={onClose}
    />
  );
}
function ActivityModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  return (
    <PlaceModal
      title="Activities"
      tripId={tripId}
      subcollection="activities"
      priceUnits={["Per User", "Per Couple", "Per Group"]}
      extraLeft={[
        {
          key: "transportationType",
          label: "Mode of Transportation",
          options: [
            "Airplane",
            "Bus",
            "Car",
            "Cruise",
            "RV",
            "Train",
            "Uber/Taxi",
            "Walk",
          ],
        },
      ]}
      onClose={onClose}
    />
  );
}
function AccommodationModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  return (
    <PlaceModal
      title="Accommodations"
      tripId={tripId}
      subcollection="accommodations"
      priceUnits={["Per Night", "Total Stay"]}
      onClose={onClose}
    />
  );
}
function RestaurantModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  return (
    <PlaceModal
      title="Restaurants"
      tripId={tripId}
      subcollection="restaurants"
      priceUnits={["Per Person", "Per Couple"]}
      onClose={onClose}
    />
  );
}

/* Generic place modal with upload & list */
function PlaceModal({
  title,
  tripId,
  subcollection,
  priceUnits,
  extraLeft = [],
  extraRight = [],
  onClose,
}: {
  title: string;
  tripId: string;
  subcollection:
    | "destinations"
    | "activities"
    | "accommodations"
    | "restaurants";
  priceUnits: string[];
  extraLeft?: { key: string; label: string; options: string[] }[];
  extraRight?: { key: string; label: string; options: string[] }[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<WithId<SimplePlace>[]>([]);
  const [form, setForm] = useState<SimplePlace>({
    name: "",
    startDate: "",
    endDate: "",
    address: "",
    city: "",
    state: "",
    country: "",
    price: null,
    priceUnit: priceUnits[0],
  });

  // photos inline
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...fs]);
  }
  useEffect(() => {
    setPreviews((prev) => {
      const next = { ...prev };
      for (const f of files) {
        const k = fileKey(f);
        if (!next[k]) next[k] = URL.createObjectURL(f);
      }
      for (const k of Object.keys(next)) {
        if (!files.find((f) => fileKey(f) === k)) {
          URL.revokeObjectURL(next[k]);
          delete next[k];
        }
      }
      return next;
    });
  }, [files]);

  useEffect(() => {
    const qx = query(
      collection(db, "trips", tripId, subcollection),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(qx, (snap) => {
      const arr: WithId<SimplePlace>[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setRows(arr);
    });
    return () => unsub();
  }, [tripId, subcollection]);

  function canSave() {
    return !!form.name && !!form.city && !!form.country; // city/state/country required for reviews (state optional at creation)
  }

  async function createRow() {
    if (!canSave()) return;

    const now = Date.now();
    const rowRef = await addDoc(
      collection(db, "trips", tripId, subcollection),
      {
        ...form,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        createdAt: now,
        updatedAt: now,
      } as any
    );

    // Upload photos for this row to media with a tag you can filter later (optional tag field)
    for (const f of files) {
      const mediaRef = doc(collection(db, "trips", tripId, "media"));
      const safe = f.name.replace(/[^\w.\-]+/g, "_");
      const path = `trip_media/${auth.currentUser?.uid}/${tripId}/${mediaRef.id}/${safe}`;
      await uploadBytes(storageRef(storage, path), f);
      const url = await getDownloadURL(storageRef(storage, path));

      // Extract EXIF date for proper chronological ordering
      const takenAt = await getPhotoTakenAt(f);

      await setDoc(mediaRef, {
        tripId,
        type: f.type.startsWith("video/") ? "video" : "image",
        storagePath: path,
        downloadURL: url,
        createdAt: Date.now(),
        takenAt,
        caption: `${singularize(title)} • ${form.name}`, // simple context caption
        linkedSubcollection: subcollection,
        linkedId: rowRef.id,
      } as any);
    }

    setForm({
      name: "",
      startDate: "",
      endDate: "",
      address: "",
      city: "",
      state: "",
      country: "",
      price: null,
      priceUnit: priceUnits[0],
    });
    setFiles([]);
    setPreviews({});
  }

  async function removeRow(id: string) {
    await deleteDoc(doc(db, "trips", tripId, subcollection, id));
  }

  return (
    <ModalShell title={title} onClose={onClose}>
      {/* Create */}
      <div className="rounded-xl border border-border p-3">
        <div className="grid md:grid-cols-2 gap-3">
          {/* Left */}
          <div className="space-y-2">
            <div>
              <label className="label">Name *</label>
              <input
                className="input"
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.startDate || ""}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.endDate || ""}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <input
                className="input"
                value={form.address || ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            {/* Extras (left) */}
            {extraLeft.map((ex) => (
              <div key={ex.key}>
                <label className="label">{ex.label}</label>
                <select
                  className="input"
                  value={(form as any)[ex.key] || ""}
                  onChange={(e) =>
                    setForm({ ...form, [ex.key]: e.target.value } as any)
                  }
                >
                  <option value="">Select</option>
                  {ex.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Right */}
          <div className="space-y-2">
            <div>
              <label className="label">City *</label>
              <input
                className="input"
                value={form.city || ""}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label className="label">State / Province</label>
              <input
                className="input"
                value={form.state || ""}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Country *</label>
              <select
                className="input"
                value={form.country || ""}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-[1fr_minmax(120px,160px)] gap-2">
              <div>
                <label className="label">Price</label>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={form.price ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      price: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <label className="label">Unit</label>
                <select
                  className="input"
                  value={form.priceUnit || ""}
                  onChange={(e) =>
                    setForm({ ...form, priceUnit: e.target.value })
                  }
                >
                  {priceUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Extras (right) */}
            {extraRight.map((ex) => (
              <div key={ex.key}>
                <label className="label">{ex.label}</label>
                <select
                  className="input"
                  value={(form as any)[ex.key] || ""}
                  onChange={(e) =>
                    setForm({ ...form, [ex.key]: e.target.value } as any)
                  }
                >
                  <option value="">Select</option>
                  {ex.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Inline photos for this entry */}
        <div className="mt-3">
          <label className="label">Photos / Videos</label>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={onPick}
          />
          {files.length > 0 && (
            <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {files.map((f) => {
                const k = fileKey(f);
                const url = previews[k];
                const isImage = f.type.startsWith("image/");
                return (
                  <div
                    key={k}
                    className="rounded-xl overflow-hidden border border-border"
                  >
                    <div className="w-full h-48 bg-haiti-800/5">
                      {isImage ? (
                        <img
                          src={url}
                          alt={f.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={url}
                          className="w-full h-full object-cover"
                          controls
                          preload="metadata"
                        />
                      )}
                    </div>
                    <div className="p-2 text-right">
                      <button
                        className="text-xs text-red-600"
                        onClick={() =>
                          setFiles((prev) =>
                            prev.filter((x) => fileKey(x) !== k)
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button className="navlink" onClick={onClose}>
            Close
          </button>
          <button className="btn" onClick={createRow} disabled={!canSave()}>
            Add
          </button>
        </div>
      </div>

      {/* List */}
      <div className="mt-4">
        <h4 className="font-semibold mb-2">Added</h4>
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-border p-3 flex items-center justify-between gap-3"
            >
              <div className="text-sm">
                <div className="font-medium">{r.name}</div>
                <div className="text-muted-foreground">
                  {fmtMDY(r.startDate)}
                  {r.endDate ? ` → ${fmtMDY(r.endDate)}` : ""} •{" "}
                  {[r.address, r.city, r.state, r.country]
                    .filter(Boolean)
                    .join(", ") || "—"}
                  {r.price != null ? ` • ${r.price} ${r.priceUnit || ""}` : ""}
                </div>
              </div>
              <button
                className="text-sm text-red-600"
                onClick={() => removeRow(r.id!)}
              >
                Delete
              </button>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="text-sm text-muted-foreground">No items yet.</div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

/* ------------------------------- Share Link ------------------------------- */

function ShareTripModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const [link, setLink] = useState<string>("");

  useEffect(() => {
    // simple, unauthenticated share view at /share?tripId=...
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setLink(`${base}/share?tripId=${encodeURIComponent(tripId)}`);
  }, [tripId]);

  return (
    <ModalShell title="Share Trip" onClose={onClose}>
      <p className="text-sm">
        Anyone with this link can view your flipbook—no account needed.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              alert("Copied.");
            } catch {}
          }}
        >
          Copy
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-border p-4 text-sm bg-haiti-800/5">
        <div className="font-semibold mb-2">No account? No worries.</div>
        <p>
          But if you want the coolest photo journaling app ever invented— we’re
          just sitting here looking cute, waiting for you to sign up. 😎
        </p>
        <div className="mt-3">
          <Link className="btn" href="/subscribe">
            Subscribe
          </Link>
        </div>
      </div>
    </ModalShell>
  );
}

/* --------------------------------- Modal --------------------------------- */

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-x-0 top-[60px] bottom-0 z-[100] bg-black/60 flex items-center justify-center p-3">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-auto rounded-2xl bg-background shadow-xl border border-border">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur">
          <div className="font-semibold">{title}</div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/** --- CoverThumbHome: Cover photo with drag-to-reposition and navigation arrows --- */
function CoverThumbHome({
  tripId,
  coverMediaId,
}: {
  tripId: string;
  coverMediaId?: string | null;
}) {
  const [cover, setCover] = useState<MediaItem | null>(null);
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [focus, setFocus] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });
  const [dragging, setDragging] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "trips", tripId, "media"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: MediaItem[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setAllMedia(arr);
      },
      () => setAllMedia([])
    );
    return () => unsub();
  }, [tripId]);

  useEffect(() => {
    if (allMedia.length === 0) {
      setCover(null);
      return;
    }
    const media = allMedia[currentIndex];
    if (media) setCover(media);
  }, [allMedia, currentIndex]);

  useEffect(() => {
    if (!coverMediaId || allMedia.length === 0) return;
    const idx = allMedia.findIndex((m) => m.id === coverMediaId);
    if (idx !== -1) setCurrentIndex(idx);
  }, [coverMediaId, allMedia]);

  useEffect(() => {
    const tref = doc(db, "trips", tripId);
    const unsub = onSnapshot(
      tref,
      (snap) => {
        const d = snap.data() as any;
        if (
          d?.coverFocus &&
          typeof d.coverFocus.x === "number" &&
          typeof d.coverFocus.y === "number"
        ) {
          setFocus({ x: d.coverFocus.x, y: d.coverFocus.y });
        }
      },
      () => {}
    );
    return () => unsub();
  }, [tripId]);

  function calcFocusFromEvent(e: React.MouseEvent | React.TouchEvent) {
    const box = boxRef.current;
    if (!box) return focus;
    const rect = box.getBoundingClientRect();
    const clientX =
      "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY =
      "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x: Math.round(x * 100), y: Math.round(y * 100) };
  }

  function clamp01(n: number) {
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  let lastSaved: { x: number; y: number } | null = null;

  async function persistFocus(next: { x: number; y: number }) {
    const clamped = { x: clamp01(next.x), y: clamp01(next.y) };
    if (lastSaved && lastSaved.x === clamped.x && lastSaved.y === clamped.y)
      return;

    try {
      await updateDoc(doc(db, "trips", tripId), {
        coverFocus: clamped,
        updatedAt: Date.now(),
      } as any);
      lastSaved = clamped;
    } catch {}
  }

  function startDrag(e: React.MouseEvent | React.TouchEvent) {
    setDragging(true);
    const next = calcFocusFromEvent(e);
    setFocus(next);
    persistFocus(next);
  }

  function moveDrag(e: React.MouseEvent | React.TouchEvent) {
    if (!dragging) return;
    const next = calcFocusFromEvent(e);
    setFocus(next);
  }

  function endDrag() {
    if (dragging) {
      persistFocus(focus);
      setDragging(false);
    }
  }

  function goToPrevious(e: React.MouseEvent) {
    e.stopPropagation();
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }

  function goToNext(e: React.MouseEvent) {
    e.stopPropagation();
    if (currentIndex < allMedia.length - 1) setCurrentIndex(currentIndex + 1);
  }

  if (!cover) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white/60 text-xs bg-gradient-to-b from-slate-800 to-slate-900">
        No cover yet
      </div>
    );
  }

  const mediaProps = {
    style: { objectPosition: `${focus.x}% ${focus.y}%` },
    className: "w-full h-full object-cover select-none pointer-events-none",
    draggable: false,
  } as const;

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 w-full h-full bg-black/5 group"
      onMouseDown={startDrag}
      onMouseMove={moveDrag}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchStart={startDrag}
      onTouchMove={moveDrag}
      onTouchEnd={endDrag}
      aria-label="Drag to reposition cover"
      title="Drag to reposition cover"
    >
      {cover.type === "image" ? (
        <img
          src={cover.downloadURL}
          alt={cover.caption || "Cover"}
          loading="lazy"
          decoding="async"
          {...mediaProps}
        />
      ) : (
        <video
          src={cover.downloadURL}
          muted
          playsInline
          {...(mediaProps as any)}
        />
      )}

      {allMedia.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
              aria-label="Previous image"
            >
              ←
            </button>
          )}
          {currentIndex < allMedia.length - 1 && (
            <button
              type="button"
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
              aria-label="Next image"
            >
              →
            </button>
          )}
        </>
      )}

      {allMedia.length > 1 && (
        <div className="pointer-events-none absolute top-2 left-2 text-xs px-2 py-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
          {currentIndex + 1} / {allMedia.length}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded bg-black/40 text-white">
        Drag to reposition
      </div>
    </div>
  );
}
