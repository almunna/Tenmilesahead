"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import Link from "next/link";

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
  const [error, setError] = useState<string | null>(null);

  // --- Derived helpers
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
  const dateRange = trip ? `${trip.startDate} → ${trip.endDate}` : "";

  // Listen to the trip doc (ownership enforced by rules; we also check client-side)
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
        // Client-side guard: ensure owner matches signed-in user
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

  // Listen to media for this trip
  useEffect(() => {
    if (!tripId || !user) return;

    const q = query(
      collection(db, "trips", tripId, "media"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: MediaItem[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setMedia(arr);
      },
      (err) => {
        // Typically permission or (rarely) index issues
        setError(err.message || "Failed to load media.");
        setMedia([]);
      }
    );

    return () => unsub();
  }, [tripId, user]);

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

  return (
    <div className="container py-8 space-y-6 bg-blue-50 ">
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
                <img
                  src={coverMedia.downloadURL}
                  alt={trip.name}
                  className="w-full max-h-[360px] object-cover"
                />
              ) : (
                <video
                  src={coverMedia.downloadURL}
                  className="w-full max-h-[360px] object-cover"
                  controls
                />
              )
            ) : (
              <div className="h-40 w-full bg-slate-100 flex items-center justify-center text-slate-500 text-sm">
                No cover yet — choose “Set as cover” on any media below
              </div>
            )}

            <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">{trip.name}</h1>
                <div className="text-sm text-slate-600">{locationStr}</div>
                <div className="text-sm text-slate-700">{dateRange}</div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {trip.transportationType && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">
                      {trip.transportationType}
                    </span>
                  )}
                  {trip.accommodationType && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">
                      {trip.accommodationType}
                    </span>
                  )}
                </div>

                {trip.specificAddress && (
                  <div className="mt-2 text-xs text-slate-600">
                    Address: {trip.specificAddress}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button className="btn" onClick={() => setOpenFlip(true)}>
                  Open Flipbook
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
              <p className="text-slate-700 whitespace-pre-wrap">
                {trip.description}
              </p>
            </div>
          )}
        </>
      )}

      {user && trip && !error && (
        <Uploader ownerId={user.uid} tripId={trip.id!} />
      )}

      {!error && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Media</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {media.map((m) => (
              <div key={m.id} className="card space-y-2">
                {m.type === "image" ? (
                  <img
                    src={m.downloadURL}
                    alt={m.caption || ""}
                    className="fluid-img"
                  />
                ) : (
                  <video
                    src={m.downloadURL}
                    className="w-full rounded-lg"
                    controls
                  />
                )}
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
                  <input
                    className="input"
                    defaultValue={m.caption || ""}
                    onBlur={(e) => saveCaption(m.id!, e.target.value)}
                    placeholder="Add a caption…"
                  />
                </div>
              </div>
            ))}
            {media.length === 0 && (
              <div className="text-slate-600">
                No media yet. Use the uploader above.
              </div>
            )}
          </div>
        </div>
      )}

      <Flipbook
        tripId={tripId}
        open={openFlip}
        onClose={() => setOpenFlip(false)}
      />
    </div>
  );
}
