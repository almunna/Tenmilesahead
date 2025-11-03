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
  doc,
  deleteDoc,
  updateDoc, // ⬅️ NEW
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Trip, MediaItem } from "@/lib/types";
import { COUNTRIES, getStates } from "@/lib/geo";

const TRANSPORT_OPTIONS = [
  "Bicycle",
  "Bus",
  "Car",
  "Cruise",
  "Ferry/Boat",
  "Flight",
  "Train",
  "Walking",
  "Other",
];

const ACCOMMODATION_OPTIONS = [
  "Apartment / Airbnb",
  "Camping",
  "Cruise",
  "Friend/Family",
  "Guesthouse",
  "Hostel",
  "Hotel",
  "Resort",
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

  // ⋯ menu & editing state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

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

  async function deleteTrip(id: string) {
    try {
      await deleteDoc(doc(db, "trips", id));
    } finally {
      setMenuOpenId(null);
    }
  }

  const locationOf = (t: Trip) => {
    const cityState = t.city ? `${t.city}${t.state ? ", " + t.state : ""}` : "";
    if (t.country) return cityState ? `${cityState}, ${t.country}` : t.country;
    return cityState || "—";
  };
  const fmt = (d: string | number | Date) => {
    const dt = new Date(d);
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    const y = dt.getFullYear();
    return `${m}/${day}/${y}`;
  };

  const dateRangeOf = (t: Trip) => `${fmt(t.startDate)} → ${fmt(t.endDate)}`;

  const clip = (s?: string | null, n = 120) =>
    s ? (s.length > n ? s.slice(0, n) + "…" : s) : "";

  // --- derived states list for creator form based on selected country
  const availableStates = useMemo(
    () => getStates(form.country),
    [form.country]
  );

  return (
    <div className="container py-10 space-y-8">
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

          {/* Country */}
          <div>
            <label className="label">Country *</label>
            <select
              className="input"
              value={form.country}
              onChange={(e) => {
                const newCountry = e.target.value;
                const states = getStates(newCountry);
                const nextState = states.includes(form.state) ? form.state : "";
                setForm({ ...form, country: newCountry, state: nextState });
              }}
              required
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* State / Province */}
          <div>
            <label className="label">
              {availableStates.length
                ? "State / Province"
                : "State / Province (free text)"}
            </label>
            {availableStates.length ? (
              <select
                className="input"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              >
                <option value="">Select state/province</option>
                {availableStates.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                placeholder="e.g., California"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            )}
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
            <div key={t.id} className="card overflow-hidden relative">
              {/* ⋯ menu trigger */}
              <div className="absolute top-2 right-2 z-10">
                <button
                  type="button"
                  className="h-8 w-8 rounded-full bg-surface/90 border border-border flex items-center justify-center text-muted-foreground hover:bg-surface"
                  aria-label="More actions"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId((prev) =>
                      prev === t.id ? null : t.id || null
                    );
                  }}
                >
                  ⋯
                </button>

                {menuOpenId === t.id && (
                  <div
                    className="mt-2 w-36 rounded-md border border-border bg-surface shadow-md text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="block w-full text-left px-3 py-2 hover:bg-haiti-800/5"
                      onClick={() => {
                        setEditingTrip(t);
                        setMenuOpenId(null);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="block w-full text-left px-3 py-2 hover:bg-haiti-800/5 text-red-600"
                      onClick={() => deleteTrip(t.id!)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Cover */}
              <CoverThumb tripId={t.id!} coverMediaId={t.coverMediaId} />

              <div
                className="p-4 space-y-2"
                onClick={() => setMenuOpenId(null)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-base line-clamp-1">
                    {t.name}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-haiti-800/5">
                    {t.transportationType || "—"}
                  </span>
                </div>

                <div className="text-sm text-muted-foreground">
                  {locationOf(t)}
                </div>
                <div className="text-sm text-foreground">{dateRangeOf(t)}</div>

                {t.accommodationType && (
                  <div className="text-xs text-muted-foreground">
                    Stay:{" "}
                    <span className="px-2 py-0.5 rounded-full bg-haiti-800/5">
                      {t.accommodationType}
                    </span>
                  </div>
                )}

                {t.specificAddress && (
                  <div className="text-xs text-muted-foreground">
                    Address: {t.specificAddress}
                  </div>
                )}

                {t.description && (
                  <p className="text-sm text-foreground line-clamp-3">
                    {clip(t.description)}
                  </p>
                )}

                <div className="pt-2 flex items-center justify-between">
                  <Link className="btn" href={`/trips/${t.id}`}>
                    Open
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    Created {fmt(t.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {trips.length === 0 && (
            <div className="text-muted-foreground">No trips yet.</div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editingTrip && (
        <EditTripModal
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
        />
      )}
    </div>
  );
}

/** --- EditTripModal: in-place editing for all fields --- */
function EditTripModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    name: trip.name || "",
    city: trip.city || "",
    state: trip.state || "",
    country: trip.country || "",
    transportationType: trip.transportationType || "",
    accommodationType: trip.accommodationType || "",
    specificAddress: trip.specificAddress || "",
    startDate: trip.startDate || "",
    endDate: trip.endDate || "",
    description: trip.description || "",
  });

  const canSave =
    f.name &&
    f.city &&
    f.country &&
    f.transportationType &&
    f.startDate &&
    f.endDate;

  // --- derived states list for modal based on selected country
  const availableStates = useMemo(() => getStates(f.country), [f.country]);

  async function save() {
    if (!canSave || !trip.id) return;
    setSaving(true);
    try {
      const ref = doc(db, "trips", trip.id);
      await updateDoc(ref, {
        name: f.name,
        city: f.city,
        state: f.state || null,
        country: f.country,
        transportationType: f.transportationType,
        accommodationType: f.accommodationType,
        specificAddress: f.specificAddress || null,
        startDate: f.startDate,
        endDate: f.endDate,
        description: f.description || null,
        updatedAt: Date.now(),
      } as any);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-surface text-foreground border border-border shadow-lg p-4 md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Edit Trip</h3>
          <button className="navlink" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Trip Title */}
          <div className="md:col-span-3">
            <label className="label">Trip Title *</label>
            <input
              className="input"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </div>

          {/* City / State / Country */}
          <div>
            <label className="label">City *</label>
            <input
              className="input"
              value={f.city}
              onChange={(e) => setF({ ...f, city: e.target.value })}
            />
          </div>

          <div>
            <label className="label">
              {availableStates.length
                ? "State / Province"
                : "State / Province (free text)"}
            </label>
            {availableStates.length ? (
              <select
                className="input"
                value={f.state}
                onChange={(e) => setF({ ...f, state: e.target.value })}
              >
                <option value="">Select state/province</option>
                {availableStates.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                value={f.state}
                onChange={(e) => setF({ ...f, state: e.target.value })}
              />
            )}
          </div>

          <div>
            <label className="label">Country *</label>
            <select
              className="input"
              value={f.country}
              onChange={(e) => {
                const newCountry = e.target.value;
                const states = getStates(newCountry);
                const nextState = states.includes(f.state) ? f.state : "";
                setF({ ...f, country: newCountry, state: nextState });
              }}
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Transportation / Accommodation */}
          <div>
            <label className="label">Mode of Transportation *</label>
            <select
              className="input"
              value={f.transportationType}
              onChange={(e) =>
                setF({ ...f, transportationType: e.target.value })
              }
            >
              <option value="">Select transportation</option>
              {TRANSPORT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Accommodation Type</label>
            <select
              className="input"
              value={f.accommodationType}
              onChange={(e) =>
                setF({ ...f, accommodationType: e.target.value })
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

          {/* Address */}
          <div className="md:col-span-3">
            <label className="label">Specific Address</label>
            <input
              className="input"
              value={f.specificAddress}
              onChange={(e) => setF({ ...f, specificAddress: e.target.value })}
            />
          </div>

          {/* Dates */}
          <div>
            <label className="label">Start Date *</label>
            <input
              className="input"
              type="date"
              value={f.startDate}
              onChange={(e) => setF({ ...f, startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="label">End Date *</label>
            <input
              className="input"
              type="date"
              value={f.endDate}
              onChange={(e) => setF({ ...f, endDate: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="md:col-span-3">
            <label className="label">Description</label>
            <textarea
              className="input h-28 resize-y"
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button className="btn" onClick={save} disabled={!canSave || saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button className="navlink" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** --- CoverThumb: bigger, crisp, and draggable to reposition crop --- */
function CoverThumb({
  tripId,
  coverMediaId,
}: {
  tripId: string;
  coverMediaId?: string | null;
}) {
  const [cover, setCover] = useState<MediaItem | null>(null);
  const [focus, setFocus] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });
  const [dragging, setDragging] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // watch selected cover media
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

  // read coverFocus from trip (if present)
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

  // helpers to convert pointer position → % focus
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

  async function persistFocus(next: { x: number; y: number }) {
    try {
      await updateDoc(doc(db, "trips", tripId), { coverFocus: next } as any);
    } catch {
      /* ignore */
    }
  }

  function startDrag(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setDragging(true);
    const next = calcFocusFromEvent(e);
    setFocus(next);
    // save on start so quick taps work
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

  // empty state
  if (!cover) {
    return (
      <div className="aspect-[16/9] w-full bg-haiti-800/5 flex items-center justify-center text-muted-foreground text-xs">
        No cover yet
      </div>
    );
  }

  // shared props for image/video
  const mediaProps = {
    style: { objectPosition: `${focus.x}% ${focus.y}%` },
    className: "w-full h-full object-cover select-none pointer-events-none",
    draggable: false,
  } as const;

  return (
    <div
      ref={boxRef}
      className="relative aspect-[16/9] w-full overflow-hidden bg-black/5"
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

      <div className="pointer-events-none absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded bg-black/40 text-white">
        Drag to reposition
      </div>
    </div>
  );
}
