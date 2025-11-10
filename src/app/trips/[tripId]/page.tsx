// File: app/trips/[tripId]/page.tsx
"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  orderBy,
  query,
  deleteDoc,
} from "firebase/firestore";
import type { Trip, MediaItem } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import Protected from "@/components/Protected";
import Uploader from "@/components/Uploader";
import Flipbook from "@/components/Flipbook";
import EditTripModal from "@/components/EditTripModal";
import Link from "next/link";

/* Helpers */
function fmtMDY(s: string | undefined | null) {
  if (!s) return "";
  const str = typeof s === "string" ? s : String(s);

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;

  const m2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);
  if (m2) return str;

  return str;
}

function getMillis(t: any): number {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t === "object" && typeof t.seconds === "number") {
    return t.seconds * 1000 + (t.nanoseconds ? t.nanoseconds / 1e6 : 0);
  }
  return 0;
}

/** Auto-size helper for textareas (shows full caption immediately) */
function autoSizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

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

export default function TripPage() {
  return (
    <Protected>
      <TripInner />
    </Protected>
  );
}

function TripInner() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId;
  const router = useRouter();
  const { user } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [openFlip, setOpenFlip] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // cover position state (percent, 0–100; default 50 = center)
  const [coverPosY, setCoverPosY] = useState<number>(50);
  const draggingRef = useRef(false);

  // uploader visibility & auto-hide after upload completes
  const [showUploader, setShowUploader] = useState(true);
  const prevMediaCount = useRef<number>(0);

  // ---- NEW: Subcollections for itinerary & lists ----
  const [destinations, setDestinations] = useState<WithId<SimplePlace>[]>([]);
  const [activities, setActivities] = useState<WithId<SimplePlace>[]>([]);
  const [accommodations, setAccommodations] = useState<WithId<SimplePlace>[]>(
    []
  );
  const [restaurants, setRestaurants] = useState<WithId<SimplePlace>[]>([]);

  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    name: string;
    subcollection:
      | "destinations"
      | "activities"
      | "accommodations"
      | "restaurants";
  } | null>(null);
  // ---- END NEW ----

  // Derived helpers
  const coverMedia = useMemo(
    () => (trip ? media.find((m) => m.id === trip.coverMediaId) : undefined),
    [media, trip]
  );

  const locationStr = useMemo(() => {
    if (!trip) return "";
    const cityState = trip.city
      ? `${trip.city}${trip.state ? ", " + trip.state : ""}`
      : "";
    if (trip.country)
      return cityState ? `${cityState}, ${trip.country}` : trip.country;
    return cityState || "—";
  }, [trip]);

  const dateRange = trip
    ? `${fmtMDY(trip.startDate)} → ${fmtMDY(trip.endDate)}`
    : "";

  // Keep cover position in sync with doc
  useEffect(() => {
    if (trip && typeof (trip as any).coverPositionY === "number") {
      setCoverPosY((trip as any).coverPositionY as number);
    } else {
      setCoverPosY(50);
    }
  }, [trip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen to the trip doc
  useEffect(() => {
    if (!tripId || !user) return;

    const ref = doc(db, "trips", tripId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setError("Trip not found or you don't have access.");
          setTrip(null);
          return;
        }
        const data = { id: snap.id, ...(snap.data() as any) } as Trip;
        if (data.ownerId !== user.uid) {
          setError("You don't have permission to view this trip.");
          setTrip(null);
          return;
        }
        setError(null);
        setTrip(data);
      },
      (err) => {
        setError(err.message || "Failed to load trip.");
        setTrip(null);
      }
    );

    return () => unsub();
  }, [tripId, user]);

  // Listen to media (LATEST FIRST)
  useEffect(() => {
    if (!tripId || !user) return;

    const qx = query(
      collection(db, "trips", tripId, "media"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      qx,
      (snap) => {
        const arr: MediaItem[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setMedia(arr);
      },
      (err) => {
        setError(err.message || "Failed to load media.");
        setMedia([]);
      }
    );

    return () => unsub();
  }, [tripId, user]);

  // Auto-hide uploader after a successful upload
  useEffect(() => {
    const prev = prevMediaCount.current;
    if (showUploader && media.length > prev) {
      setShowUploader(false);
    }
    prevMediaCount.current = media.length;
  }, [media.length, showUploader]);

  async function setCover(mid: string) {
    if (!trip) return;
    await updateDoc(doc(db, "trips", trip.id!), {
      coverMediaId: mid,
      updatedAt: Date.now(),
    });
    setTrip({ ...trip, coverMediaId: mid });
  }

  async function saveCaption(mid: string, caption: string) {
    await updateDoc(doc(db, "trips", tripId, "media", mid), { caption });
  }

  async function deleteMedia(mid: string) {
    await deleteDoc(doc(db, "trips", tripId, "media", mid));
  }

  // cover dragging handlers
  function onCoverPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    onCoverPointerMove(e);
  }
  async function onCoverPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    if (trip?.id) {
      await updateDoc(doc(db, "trips", trip.id), {
        coverPositionY: coverPosY,
        updatedAt: Date.now(),
      } as any);
    }
  }
  function onCoverPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const box = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const y = e.clientY - box.top;
    const pct = Math.max(0, Math.min(100, (y / box.height) * 100));
    setCoverPosY(pct);
  }

  // cover first, then latest-first
  const sortedMedia = useMemo(() => {
    const coverId = trip?.coverMediaId;
    const arr = media.slice();
    arr.sort((a, b) => {
      if (coverId) {
        if (a.id === coverId && b.id !== coverId) return -1;
        if (b.id === coverId && a.id !== coverId) return 1;
      }
      return getMillis(b.createdAt) - getMillis(a.createdAt);
    });
    return arr;
  }, [media, trip?.coverMediaId]);

  // ---- NEW: Live subscriptions for each place subcollection ----
  useEffect(() => {
    if (!tripId || !user) return;
    const unsubDest = onSnapshot(
      query(
        collection(db, "trips", tripId, "destinations"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const arr: WithId<SimplePlace>[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setDestinations(arr);
      }
    );
    const unsubActs = onSnapshot(
      query(
        collection(db, "trips", tripId, "activities"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const arr: WithId<SimplePlace>[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setActivities(arr);
      }
    );
    const unsubAcc = onSnapshot(
      query(
        collection(db, "trips", tripId, "accommodations"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const arr: WithId<SimplePlace>[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setAccommodations(arr);
      }
    );
    const unsubRes = onSnapshot(
      query(
        collection(db, "trips", tripId, "restaurants"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const arr: WithId<SimplePlace>[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setRestaurants(arr);
      }
    );

    return () => {
      unsubDest();
      unsubActs();
      unsubAcc();
      unsubRes();
    };
  }, [tripId, user]);

  const itineraryRows = useMemo(() => {
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
  }, [destinations, activities, accommodations, restaurants]);
  // ---- END NEW ----

  return (
    <div className="container py-8 space-y-6">
      {error && (
        <div className="card border-red-300">
          <div className="text-red-700 text-sm">{error}</div>
          <div className="mt-2">
            <button className="btn" onClick={() => router.push("/trips")}>
              Back to Trips
            </button>
          </div>
        </div>
      )}

      {trip && !error && (
        <>
          {/* Header & Cover */}
          <div className="card overflow-hidden">
            {coverMedia ? (
              coverMedia.type === "image" ? (
                <div
                  key={trip?.coverMediaId}
                  className="relative w-full"
                  style={{ height: "360px", cursor: "grab" }}
                  title="Drag to reposition"
                  onPointerDown={onCoverPointerDown}
                  onPointerMove={onCoverPointerMove}
                  onPointerUp={onCoverPointerUp}
                >
                  <img
                    src={coverMedia.downloadURL}
                    alt={coverMedia.caption || trip.name || "Cover photo"}
                    className="absolute inset-0 w-full h-full object-cover select-none"
                    style={{ objectPosition: `50% ${coverPosY}%` }}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    draggable={false}
                  />
                </div>
              ) : (
                <video
                  key={trip?.coverMediaId}
                  src={coverMedia.downloadURL}
                  className="w-full max-h-[360px] object-cover"
                  controls
                  preload="metadata"
                />
              )
            ) : (
              <div className="h-40 w-full bg-haiti-800/5 flex items-center justify-center text-muted-foreground text-sm">
                No cover yet — choose “Set as cover” on any media below
              </div>
            )}

            <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">{trip.name}</h1>
                <div className="text-sm text-muted-foreground">
                  {locationStr}
                </div>
                <div className="text-sm text-foreground">{dateRange}</div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {trip.transportationType && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-haiti-800/5">
                      {trip.transportationType}
                    </span>
                  )}
                  {trip.accommodationType && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-haiti-800/5">
                      {trip.accommodationType}
                    </span>
                  )}
                </div>

                {trip.specificAddress && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Address: {trip.specificAddress}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button className="btn" onClick={() => setOpenFlip(true)}>
                  Open Flipbook
                </button>
                <button className="btn" onClick={() => setOpenEdit(true)}>
                  Edit
                </button>
                <Link className="navlink" href="/trips">
                  Back
                </Link>
              </div>
            </div>
          </div>

          {/* Description */}
          {(trip.description || "").trim().length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-2">Description</h2>
              <p className="text-foreground whitespace-pre-wrap">
                {trip.description}
              </p>
            </div>
          )}
        </>
      )}

      {/* Uploader */}
      {user && trip && !error && (
        <div className="card">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Add Photos/Videos</h3>
            {!showUploader && (
              <button className="btn" onClick={() => setShowUploader(true)}>
                Add more
              </button>
            )}
          </div>
          {showUploader && (
            <div className="mt-3">
              <Uploader ownerId={user.uid} tripId={trip.id!} />
            </div>
          )}
          {!showUploader && (
            <p className="text-xs text-muted-foreground mt-2">
              Click “Add more” to upload again.
            </p>
          )}
        </div>
      )}

      {/* Photos (renamed from Media) */}
      {!error && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Photos</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedMedia.map((m) => (
              <div key={m.id} className="card space-y-2">
                <div className="w-full h-60 rounded-lg overflow-hidden bg-haiti-800/5">
                  {m.type === "image" ? (
                    <img
                      src={m.downloadURL}
                      alt={m.caption || ""}
                      className="w-full h-full object-cover"
                      decoding="async"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <video
                      src={m.downloadURL}
                      className="w-full h-full object-cover"
                      controls
                      preload="metadata"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <button
                    className="text-sm link"
                    onClick={() => setCover(m.id!)}
                  >
                    {trip?.coverMediaId === m.id ? "✓ Cover" : "Set as cover"}
                  </button>
                  <button
                    className="text-sm text-red-600"
                    onClick={() => deleteMedia(m.id!)}
                  >
                    Delete
                  </button>
                </div>

                <div>
                  <label className="label">Caption</label>
                  <textarea
                    className="input h-auto min-h-[44px] leading-5 resize-none overflow-hidden"
                    defaultValue={m.caption || ""}
                    ref={autoSizeTextarea}
                    onInput={(e) => autoSizeTextarea(e.currentTarget)}
                    onBlur={(e) => saveCaption(m.id!, e.target.value)}
                    placeholder="Add a caption…"
                    rows={1}
                  />
                </div>
              </div>
            ))}
            {sortedMedia.length === 0 && (
              <div className="text-muted-foreground">
                No media yet. Use the uploader above.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- NEW: Itinerary (chronological) ---- */}
      {!error && (
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
      )}
      {/* ---- END NEW: Itinerary ---- */}

      {/* ---- NEW: Destinations list ---- */}
      {!error && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-2">Destinations</h2>
          <div className="space-y-2">
            {destinations.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-3">
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
              <div className="text-sm text-muted-foreground">No items yet.</div>
            )}
          </div>
        </div>
      )}

      {/* ---- NEW: Activities list ---- */}
      {!error && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-2">Activities</h2>
          <div className="space-y-2">
            {activities.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-3">
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
              <div className="text-sm text-muted-foreground">No items yet.</div>
            )}
          </div>
        </div>
      )}

      {/* ---- NEW: Accommodations list ---- */}
      {!error && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-2">Accommodations</h2>
          <div className="space-y-2">
            {accommodations.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-3">
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
              <div className="text-sm text-muted-foreground">No items yet.</div>
            )}
          </div>
        </div>
      )}

      {/* ---- NEW: Restaurants list ---- */}
      {!error && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-2">Restaurants</h2>
          <div className="space-y-2">
            {restaurants.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-3">
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
              <div className="text-sm text-muted-foreground">No items yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Flipbook (all media) */}
      <Flipbook
        tripId={tripId}
        open={openFlip}
        onClose={() => setOpenFlip(false)}
      />

      {/* Shared Edit Modal */}
      {openEdit && trip && (
        <EditTripModal trip={trip} onClose={() => setOpenEdit(false)} />
      )}

      {/* ---- NEW: Item-level Flipbook for a specific itinerary entry ---- */}
      {selectedItem && (
        <ItemFlipbook
          tripId={tripId}
          linkedId={selectedItem.id}
          subcollection={selectedItem.subcollection}
          itemName={selectedItem.name}
          onClose={() => setSelectedItem(null)}
        />
      )}
      {/* ---- END NEW ---- */}
    </div>
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
    const qx = query(
      collection(db, "trips", tripId, "media"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(qx, (snap) => {
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
      if (index >= arr.length) setIndex(0);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
