// File: app/share/page.tsx (or wherever your Share page lives)
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Trip, MediaItem } from "@/lib/types";
import Flipbook from "@/components/Flipbook";
import Link from "next/link";

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
  priceUnit?: string | null;
  address?: string | null;
  createdAt?: number;
  updatedAt?: number;
  // optional extras (transportationType/accommodationType, etc.)
  [key: string]: any;
};

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

function SharePageContent() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");

  const [trip, setTrip] = useState<WithId<Trip> | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flipbookOpen, setFlipbookOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // NEW: itinerary subcollections
  const [destinations, setDestinations] = useState<WithId<SimplePlace>[]>([]);
  const [activities, setActivities] = useState<WithId<SimplePlace>[]>([]);
  const [accommodations, setAccommodations] = useState<WithId<SimplePlace>[]>(
    []
  );
  const [restaurants, setRestaurants] = useState<WithId<SimplePlace>[]>([]);

  // NEW: item-level flipbook selection
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    name: string;
    subcollection:
      | "destinations"
      | "activities"
      | "accommodations"
      | "restaurants";
  } | null>(null);

  useEffect(() => {
    if (!tripId) {
      setError("No trip ID provided");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // Fetch trip
        const tripDoc = await getDoc(doc(db, "trips", tripId));
        if (!tripDoc.exists()) {
          setError("Trip not found");
          setLoading(false);
          return;
        }
        setTrip({ id: tripDoc.id, ...(tripDoc.data() as any) });

        // Fetch media (latest-first)
        const mediaQuery = query(
          collection(db, "trips", tripId, "media"),
          orderBy("createdAt", "desc")
        );
        const mediaSnap = await getDocs(mediaQuery);
        const mediaArr: MediaItem[] = [];
        mediaSnap.forEach((d) =>
          mediaArr.push({ id: d.id, ...(d.data() as any) })
        );
        setMedia(mediaArr);

        // Fetch subcollections (latest-first for consistency)
        const fetchList = async (sub: string) => {
          const qx = query(
            collection(db, "trips", tripId, sub),
            orderBy("createdAt", "desc")
          );
          const snap = await getDocs(qx);
          const arr: WithId<SimplePlace>[] = [];
          snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
          return arr;
        };

        const [dest, acts, accs, rests] = await Promise.all([
          fetchList("destinations"),
          fetchList("activities"),
          fetchList("accommodations"),
          fetchList("restaurants"),
        ]);

        setDestinations(dest);
        setActivities(acts);
        setAccommodations(accs);
        setRestaurants(rests);

        setLoading(false);
      } catch (err) {
        console.error("Error loading trip:", err);
        setError("Failed to load trip");
        setLoading(false);
      }
    })();
  }, [tripId]);

  // Itinerary rows (chronological by startDate)
  const itineraryRows = (() => {
    const rows: Array<{
      kind: "Destination" | "Activity" | "Accommodation" | "Restaurant";
      subcollection:
        | "destinations"
        | "activities"
        | "accommodations"
        | "restaurants";
      data: WithId<SimplePlace>;
    }> = [];

    destinations.forEach((d) =>
      rows.push({ kind: "Destination", subcollection: "destinations", data: d })
    );
    activities.forEach((d) =>
      rows.push({ kind: "Activity", subcollection: "activities", data: d })
    );
    accommodations.forEach((d) =>
      rows.push({
        kind: "Accommodation",
        subcollection: "accommodations",
        data: d,
      })
    );
    restaurants.forEach((d) =>
      rows.push({ kind: "Restaurant", subcollection: "restaurants", data: d })
    );

    rows.sort((a, b) => {
      const sa = a.data.startDate ? new Date(a.data.startDate).getTime() : 0;
      const sb = b.data.startDate ? new Date(b.data.startDate).getTime() : 0;
      return sa - sb;
    });

    return rows;
  })();

  // Dismiss banner and store in localStorage
  const dismissBanner = () => {
    setBannerDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("shareBannerDismissed", "true");
    }
  };

  // Check if banner was previously dismissed
  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem("shareBannerDismissed");
      if (dismissed === "true") setBannerDismissed(true);
    }
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading trip...</div>
      </main>
    );
  }

  if (error || !trip) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="card max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600">Error</h1>
          <p className="mt-2 text-muted-foreground">
            {error || "Trip not found"}
          </p>
          <Link href="/" className="btn mt-4">
            Go to Home
          </Link>
        </div>
      </main>
    );
  }

  // Get cover image
  const coverImage =
    media.find((m) => m.type === "image" && m.id === trip.coverMediaId) ||
    media.find((m) => m.type === "image");

  return (
    <>
      <main className="min-h-screen bg-background">
        {/* Subscribe Banner */}
        {!bannerDismissed && (
          <div className="bg-gradient-to-r from-primary/90 to-primary/70 text-white">
            <div className="container py-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="font-semibold">
                  Love this? Create your own trip journal!
                </div>
                <p className="text-sm text-white/90 mt-1">
                  Join Ten Miles Ahead to document your adventures, upload
                  photos, and share with the world.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/subscribe"
                  className="btn bg-white text-primary hover:bg-white/90"
                >
                  Get Started
                </Link>
                <button
                  onClick={dismissBanner}
                  className="text-white/80 hover:text-white text-sm underline"
                  aria-label="Dismiss banner"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trip Content */}
        <div className="container py-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Trip Header */}
            <div className="card">
              {coverImage && (
                <div className="aspect-[21/9] w-full rounded-xl overflow-hidden bg-surface mb-4">
                  <img
                    src={coverImage.downloadURL}
                    alt={trip.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <h1 className="text-3xl font-bold">{trip.name}</h1>

              <div className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Destination</div>
                  <div className="font-medium">
                    {[trip.city, trip.state, trip.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Dates</div>
                  <div className="font-medium">
                    {fmtMDY(trip.startDate)} → {fmtMDY(trip.endDate)}
                  </div>
                </div>
                {trip.transportationType && (
                  <div>
                    <div className="text-muted-foreground">Transportation</div>
                    <div className="font-medium">{trip.transportationType}</div>
                  </div>
                )}
                {trip.description && (
                  <div className="sm:col-span-2">
                    <div className="text-muted-foreground">Description</div>
                    <div className="font-medium whitespace-pre-wrap">
                      {trip.description}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <button
                  className="btn"
                  onClick={() => setFlipbookOpen(true)}
                  disabled={media.length === 0}
                >
                  {media.length === 0
                    ? "No Photos Yet"
                    : `View Trip Photos (${media.length})`}
                </button>
              </div>
            </div>

            {/* Media Grid */}
            {media.length > 0 && (
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">Photos & Videos</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {media.slice(0, 9).map((item) => (
                    <div key={item.id}>
                      <div
                        className="aspect-square rounded-xl overflow-hidden bg-surface cursor-pointer hover:opacity-80 transition"
                        onClick={() => setFlipbookOpen(true)}
                        title={item.caption || ""}
                        aria-label={item.caption || "Open photo"}
                        role="button"
                      >
                        {item.type === "image" ? (
                          <img
                            src={item.downloadURL}
                            alt={item.caption || ""}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <video
                            src={item.downloadURL}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        )}
                      </div>

                      {/* visible caption under tile */}
                      {item.caption?.trim() && (
                        <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {item.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {media.length > 9 && (
                  <div className="mt-4 text-center">
                    <button
                      className="navlink"
                      onClick={() => setFlipbookOpen(true)}
                    >
                      View all {media.length} photos
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* NEW: Itinerary (chronological) */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-3">Itinerary</h2>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface">
                    <tr>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Dates</th>
                      <th className="px-3 py-2 text-left">Location</th>
                      <th className="px-3 py-2 text-left">Price</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itineraryRows.map((row, i) => {
                      const d = row.data;
                      const loc = [d.address, d.city, d.state, d.country]
                        .filter(Boolean)
                        .join(", ");
                      return (
                        <tr
                          key={i}
                          className="border-t border-border hover:bg-surface/50"
                        >
                          <td className="px-3 py-2">{row.kind}</td>
                          <td className="px-3 py-2">{d.name || "—"}</td>
                          <td className="px-3 py-2">
                            {fmtMDY(d.startDate)}
                            {d.endDate ? ` → ${fmtMDY(d.endDate)}` : ""}
                          </td>
                          <td className="px-3 py-2">{loc || "—"}</td>
                          <td className="px-3 py-2">
                            {d.price != null
                              ? `${d.price} ${d.priceUnit || ""}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              className="text-xs navlink"
                              onClick={() =>
                                setSelectedItem({
                                  id: d.id!,
                                  name: d.name,
                                  subcollection: row.subcollection,
                                })
                              }
                            >
                              View Photos
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {itineraryRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-4 text-center text-muted-foreground"
                        >
                          No entries yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* NEW: Destinations */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-2">Destinations</h2>
              <div className="space-y-2">
                {destinations.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm flex-1">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-muted-foreground">
                          {fmtMDY(r.startDate)}
                          {r.endDate ? ` → ${fmtMDY(r.endDate)}` : ""} •{" "}
                          {[r.address, r.city, r.state, r.country]
                            .filter(Boolean)
                            .join(", ") || "—"}
                          {r.price != null
                            ? ` • ${r.price} ${r.priceUnit || ""}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-sm navlink"
                          onClick={() =>
                            setSelectedItem({
                              id: r.id!,
                              name: r.name,
                              subcollection: "destinations",
                            })
                          }
                        >
                          View Photos
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {destinations.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No items yet.
                  </div>
                )}
              </div>
            </div>

            {/* NEW: Activities */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-2">Activities</h2>
              <div className="space-y-2">
                {activities.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm flex-1">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-muted-foreground">
                          {fmtMDY(r.startDate)}
                          {r.endDate ? ` → ${fmtMDY(r.endDate)}` : ""} •{" "}
                          {[r.address, r.city, r.state, r.country]
                            .filter(Boolean)
                            .join(", ") || "—"}
                          {r.price != null
                            ? ` • ${r.price} ${r.priceUnit || ""}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-sm navlink"
                          onClick={() =>
                            setSelectedItem({
                              id: r.id!,
                              name: r.name,
                              subcollection: "activities",
                            })
                          }
                        >
                          View Photos
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No items yet.
                  </div>
                )}
              </div>
            </div>

            {/* NEW: Accommodations */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-2">Accommodations</h2>
              <div className="space-y-2">
                {accommodations.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm flex-1">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-muted-foreground">
                          {fmtMDY(r.startDate)}
                          {r.endDate ? ` → ${fmtMDY(r.endDate)}` : ""} •{" "}
                          {[r.address, r.city, r.state, r.country]
                            .filter(Boolean)
                            .join(", ") || "—"}
                          {r.price != null
                            ? ` • ${r.price} ${r.priceUnit || ""}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-sm navlink"
                          onClick={() =>
                            setSelectedItem({
                              id: r.id!,
                              name: r.name,
                              subcollection: "accommodations",
                            })
                          }
                        >
                          View Photos
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {accommodations.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No items yet.
                  </div>
                )}
              </div>
            </div>

            {/* NEW: Restaurants */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-2">Restaurants</h2>
              <div className="space-y-2">
                {restaurants.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm flex-1">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-muted-foreground">
                          {fmtMDY(r.startDate)}
                          {r.endDate ? ` → ${fmtMDY(r.endDate)}` : ""} •{" "}
                          {[r.address, r.city, r.state, r.country]
                            .filter(Boolean)
                            .join(", ") || "—"}
                          {r.price != null
                            ? ` • ${r.price} ${r.priceUnit || ""}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-sm navlink"
                          onClick={() =>
                            setSelectedItem({
                              id: r.id!,
                              name: r.name,
                              subcollection: "restaurants",
                            })
                          }
                        >
                          View Photos
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {restaurants.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No items yet.
                  </div>
                )}
              </div>
            </div>

            {/* CTA Footer */}
            <div className="card bg-gradient-to-br from-primary/10 to-primary/5 text-center">
              <h3 className="text-2xl font-bold">
                Ready to start your own travel journal?
              </h3>
              <p className="mt-2 text-muted-foreground">
                Sign up for Ten Miles Ahead and create beautiful trip memories
                like this one.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link href="/subscribe" className="btn">
                  Get Started
                </Link>
                <Link href="/signin" className="navlink">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Trip-level Flipbook */}
      {flipbookOpen && tripId && (
        <Flipbook
          tripId={tripId}
          open={flipbookOpen}
          onClose={() => setFlipbookOpen(false)}
        />
      )}

      {/* NEW: Item-level Flipbook */}
      {selectedItem && tripId && (
        <ItemFlipbook
          tripId={tripId}
          linkedId={selectedItem.id}
          subcollection={selectedItem.subcollection}
          itemName={selectedItem.name}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </main>
      }
    >
      <SharePageContent />
    </Suspense>
  );
}

/* ---------- NEW: Item-level Flipbook (per-entry) ---------- */
function ItemFlipbook({
  tripId,
  linkedId,
  subcollection,
  itemName,
  onClose,
}: {
  tripId: string;
  linkedId: string;
  subcollection:
    | "destinations"
    | "activities"
    | "accommodations"
    | "restaurants";
  itemName: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    (async () => {
      const qx = query(
        collection(db, "trips", tripId, "media"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(qx);
      const arr: MediaItem[] = [];
      snap.forEach((docu) => {
        const data = docu.data() as any;
        if (
          data.linkedId === linkedId &&
          data.linkedSubcollection === subcollection
        ) {
          arr.push({ id: docu.id, ...data });
        }
      });
      setItems(arr);
      if (arr.length > 0) setIndex(0);
    })();
  }, [tripId, linkedId, subcollection]);

  const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);
  const next = () => setIndex((i) => (i + 1) % items.length);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="text-sm">
          {itemName} — {items.length} item{items.length === 1 ? "" : "s"}
        </div>
        <button
          className="rounded-lg px-3 py-1 bg-white/10 hover:bg-white/20"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {items.length === 0 ? (
          <div className="text-white/80">No media for this item yet</div>
        ) : (
          <div className="w-full h-full max-w-5xl flex items-center justify-center">
            {items[index].type === "image" ? (
              <img
                src={items[index].downloadURL}
                className="max-h-[80vh] max-w-full rounded-xl"
                alt={items[index].caption || ""}
                draggable={false}
              />
            ) : (
              <video
                src={items[index].downloadURL}
                className="max-h-[80vh] max-w-full rounded-xl"
                controls
              />
            )}
          </div>
        )}

        {items.length > 1 && (
          <>
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2"
              onClick={prev}
            >
              ◀
            </button>
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2"
              onClick={next}
            >
              ▶
            </button>
          </>
        )}
      </div>

      {items.length > 0 && (
        <div className="px-4 py-3 text-center text-white/80 text-sm">
          {items[index].caption || ""}
        </div>
      )}
    </div>
  );
}
