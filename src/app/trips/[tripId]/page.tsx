// File: app/trips/[tripId]/page.tsx (or wherever your TripPage lives)
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
import EditTripModal from "@/components/EditTripModal"; // ✅ use the shared component
import Link from "next/link";

/* Helpers */
function fmtMDY(s: string | undefined | null) {
  if (!s) return "";

  // Convert to string if needed (in case Firestore returns an object)
  const str = typeof s === "string" ? s : String(s);

  // Handle "yyyy-mm-dd" format (ISO date string)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;

  // Handle "mm/dd/yyyy" format (already formatted)
  const m2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);
  if (m2) return str;

  // If it's already in some other format, just return it
  return str;
}

/** Auto-size helper for textareas (shows full caption immediately) */
function autoSizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

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
  const [openEdit, setOpenEdit] = useState(false); // ← uses shared modal
  const [error, setError] = useState<string | null>(null);

  // cover position state (percent, 0–100; default 50 = center)
  const [coverPosY, setCoverPosY] = useState<number>(50);
  const draggingRef = useRef(false);

  // uploader visibility & auto-hide after upload completes
  const [showUploader, setShowUploader] = useState(true);
  const prevMediaCount = useRef<number>(0);

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

    const q = query(
      collection(db, "trips", tripId, "media"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
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
    const getMillis = (t: any) => {
      if (!t) return 0;
      if (typeof t === "number") return t;
      if (typeof t === "object" && typeof t.seconds === "number") {
        return t.seconds * 1000 + (t.nanoseconds ? t.nanoseconds / 1e6 : 0);
      }
      return 0;
    };
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

      {/* Media grid */}
      {!error && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Media</h2>
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

      {/* Flipbook */}
      <Flipbook
        tripId={tripId}
        open={openFlip}
        onClose={() => setOpenFlip(false)}
      />

      {/* Shared Edit Modal */}
      {openEdit && trip && (
        <EditTripModal trip={trip} onClose={() => setOpenEdit(false)} />
      )}
    </div>
  );
}
