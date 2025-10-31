"use client";
import Protected from "@/components/Protected";
import { useAuth } from "@/components/AuthProvider";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc, // ⬅️ added
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Trip, MediaItem } from "@/lib/types";

const TRANSPORT_OPTIONS = [
  "Flight",
  "Train",
  "Bus",
  "Car",
  "Ferry/Boat",
  "Bicycle",
  "Walking",
  "Other",
];

const ACCOMMODATION_OPTIONS = [
  "Hotel",
  "Hostel",
  "Guesthouse",
  "Apartment / Airbnb",
  "Resort",
  "Camping",
  "Friend/Family",
  "Other",
];

export default function TripsPage() {
  return (
    <Protected>
      <TripsInner />
    </Protected>
  );
}

function TripsInner() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [form, setForm] = useState({
    name: "", // Trip Title
    city: "",
    state: "",
    country: "",
    transportationType: "",
    accommodationType: "",
    specificAddress: "",
    startDate: "",
    endDate: "",
    description: "",
  });

  // derived flags for submit button
  const canSubmit = useMemo(() => {
    return (
      !!form.name &&
      !!form.city &&
      !!form.country &&
      !!form.transportationType &&
      !!form.startDate &&
      !!form.endDate
    );
  }, [form]);

  useEffect(() => {
    if (!user) return;

    // Only current user's trips
    const q = query(
      collection(db, "trips"),
      where("ownerId", "==", user.uid),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const arr: Trip[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setTrips(arr);
    });

    return () => unsub();
  }, [user]);

  async function createTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !canSubmit) return;

    const now = Date.now();
    const payload: Trip = {
      ownerId: user.uid,
      name: form.name,
      city: form.city,
      state: form.state || null,
      country: form.country,
      transportationType: form.transportationType,
      accommodationType: form.accommodationType,
      specificAddress: form.specificAddress || null,
      startDate: form.startDate,
      endDate: form.endDate,
      description: form.description || null,

      coverMediaId: null,
      createdAt: now,
      updatedAt: now,
    };

    await addDoc(collection(db, "trips"), payload as any);

    setForm({
      name: "",
      city: "",
      state: "",
      country: "",
      transportationType: "",
      accommodationType: "",
      specificAddress: "",
      startDate: "",
      endDate: "",
      description: "",
    });
  }

  // Helpers for card display
  const locationOf = (t: Trip) => {
    const cityState = t.city ? `${t.city}${t.state ? ", " + t.state : ""}` : "";
    if (t.country) return cityState ? `${cityState}, ${t.country}` : t.country;
    return cityState || "—";
  };
  const dateRangeOf = (t: Trip) => `${t.startDate} → ${t.endDate}`;
  const clip = (s?: string | null, n = 120) =>
    s ? (s.length > n ? s.slice(0, n) + "…" : s) : "";

  return (
    <div className="container py-10 space-y-8 bg-blue-50 ">
      <div className="card">
        <h1 className="text-2xl font-semibold mb-4">Add New Trip</h1>

        <form className="grid md:grid-cols-3 gap-4" onSubmit={createTrip}>
          {/* Trip Title */}
          <div className="md:col-span-3">
            <label className="label">Trip Title *</label>
            <input
              className="input"
              placeholder="e.g., Summer in Paris"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          {/* City */}
          <div>
            <label className="label">City *</label>
            <input
              className="input"
              placeholder="e.g., Paris"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
            />
          </div>

          {/* State / Province */}
          <div>
            <label className="label">State</label>
            <input
              className="input"
              placeholder="e.g., California"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
          </div>

          {/* Country */}
          <div>
            <label className="label">Country *</label>
            <input
              className="input"
              placeholder="e.g., France"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              required
            />
          </div>

          {/* Mode of Transportation */}
          <div>
            <label className="label">Mode of Transportation *</label>
            <select
              className="input"
              value={form.transportationType}
              onChange={(e) =>
                setForm({ ...form, transportationType: e.target.value })
              }
              required
            >
              <option value="">Select transportation</option>
              {TRANSPORT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Accommodation Type */}
          <div>
            <label className="label">Accommodation Type</label>
            <select
              className="input"
              value={form.accommodationType}
              onChange={(e) =>
                setForm({ ...form, accommodationType: e.target.value })
              }
            >
              <option value="">Select accommodation</option>
              {ACCOMMODATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Specific Address */}
          <div className="md:col-span-3">
            <label className="label">Specific Address</label>
            <input
              className="input"
              placeholder="e.g., Eiffel Tower"
              value={form.specificAddress}
              onChange={(e) =>
                setForm({ ...form, specificAddress: e.target.value })
              }
            />
          </div>

          {/* Dates */}
          <div>
            <label className="label">Start Date *</label>
            <input
              className="input"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">End Date *</label>
            <input
              className="input"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              required
            />
          </div>

          {/* Spacer to align grid */}
          <div className="hidden md:block" />

          {/* Description */}
          <div className="md:col-span-3">
            <label className="label">Description</label>
            <textarea
              className="input h-32 resize-y"
              placeholder="Share your memories..."
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          {/* Actions */}
          <div className="md:col-span-3 flex gap-3">
            <button className="btn" type="submit" disabled={!canSubmit}>
              Add Trip
            </button>
            <button
              className="navlink"
              type="button"
              onClick={() =>
                setForm({
                  name: "",
                  city: "",
                  state: "",
                  country: "",
                  transportationType: "",
                  accommodationType: "",
                  specificAddress: "",
                  startDate: "",
                  endDate: "",
                  description: "",
                })
              }
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Your Trips</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((t) => (
            <div key={t.id} className="card overflow-hidden">
              {/* Cover (image/video) or placeholder */}
              <CoverThumb tripId={t.id!} coverMediaId={t.coverMediaId} />

              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-base line-clamp-1">
                    {t.name}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">
                    {t.transportationType || "—"}
                  </span>
                </div>

                <div className="text-sm text-slate-600">{locationOf(t)}</div>

                <div className="text-sm text-slate-700">{dateRangeOf(t)}</div>

                {t.accommodationType && (
                  <div className="text-xs text-slate-600">
                    Stay:{" "}
                    <span className="px-2 py-0.5 rounded-full bg-slate-100">
                      {t.accommodationType}
                    </span>
                  </div>
                )}

                {t.specificAddress && (
                  <div className="text-xs text-slate-600">
                    Address: {t.specificAddress}
                  </div>
                )}

                {t.description && (
                  <p className="text-sm text-slate-700 line-clamp-3">
                    {clip(t.description)}
                  </p>
                )}

                <div className="pt-2 flex items-center justify-between">
                  <Link className="btn" href={`/trips/${t.id}`}>
                    Open
                  </Link>
                  <div className="text-xs text-slate-500">
                    Created {new Date(t.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {trips.length === 0 && (
            <div className="text-slate-600">No trips yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** --- CoverThumb: fetches only the chosen cover media doc --- */
function CoverThumb({
  tripId,
  coverMediaId,
}: {
  tripId: string;
  coverMediaId?: string | null;
}) {
  const [cover, setCover] = useState<MediaItem | null>(null);

  useEffect(() => {
    if (!coverMediaId) {
      setCover(null);
      return;
    }
    const ref = doc(db, "trips", tripId, "media", coverMediaId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setCover(null);
          return;
        }
        setCover({ id: snap.id, ...(snap.data() as any) });
      },
      () => setCover(null)
    );
    return () => unsub();
  }, [tripId, coverMediaId]);

  if (!cover) {
    return (
      <div className="h-28 w-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
        No cover yet
      </div>
    );
  }

  if (cover.type === "image") {
    return (
      <img
        src={cover.downloadURL}
        alt={cover.caption || "Cover"}
        className="w-full h-28 object-cover"
      />
    );
  }

  // video cover (simple inline video)
  return (
    <video
      src={cover.downloadURL}
      className="w-full h-28 object-cover"
      muted
      playsInline
      controls={false}
    />
  );
}
