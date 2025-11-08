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
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Trip, MediaItem } from "@/lib/types";
import { COUNTRIES, getStates } from "@/lib/geo";
import EditTripModal from "@/components/EditTripModal";
import TripCreateMediaPicker from "@/components/TripCreateMediaPicker";

/** A→Z sort with “Other/Others/—/N/A/None/-” pinned to the end */
const isOtherish = (s: string) => {
  const t = s.trim().toLowerCase();
  return (
    t === "other" ||
    t === "others" ||
    t === "—" ||
    t === "-" ||
    t === "n/a" ||
    t === "none"
  );
};
const sortAZWithOtherLast = (
  list: readonly string[] | string[] = []
): string[] => {
  const arr = [...list].sort((a, b) => a.localeCompare(b));
  const tail = arr.filter(isOtherish);
  const head = arr.filter((x) => !isOtherish(x));
  return [...head, ...tail];
};

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

  // NEW: pre-create media selection + preview/captions/cover
  const [photosToAdd, setPhotosToAdd] = useState<File[]>([]);
  const [videosToAdd, setVideosToAdd] = useState<File[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // captions keyed by file key; preview URLs for object URLs; chosen cover key
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [coverKey, setCoverKey] = useState<string | null>(null);

  const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;
  const selectedFiles = useMemo(
    () => [...photosToAdd, ...videosToAdd],
    [photosToAdd, videosToAdd]
  );
  const selectedKeys = useMemo(
    () => selectedFiles.map(fileKey),
    [selectedFiles]
  );

  // Manage preview object URLs and cleanup removed ones
  useEffect(() => {
    setPreviewUrls((prev) => {
      const next = { ...prev };
      // Add new previews
      for (const f of selectedFiles) {
        const k = fileKey(f);
        if (!next[k]) next[k] = URL.createObjectURL(f);
      }
      // Remove previews for files no longer selected
      for (const k of Object.keys(next)) {
        if (!selectedKeys.includes(k)) {
          URL.revokeObjectURL(next[k]);
          delete next[k];
        }
      }
      return next;
    });
  }, [selectedFiles, selectedKeys]);

  // Cleanup all object URLs on unmount
  useEffect(() => {
    return () => {
      for (const u of Object.values(previewUrls)) URL.revokeObjectURL(u);
    };
  }, [previewUrls]);

  // Ensure a cover is chosen: default to first image if none or removed
  useEffect(() => {
    const firstImg = photosToAdd[0];
    if (!coverKey) {
      if (firstImg) setCoverKey(fileKey(firstImg));
    } else if (!selectedKeys.includes(coverKey)) {
      setCoverKey(firstImg ? fileKey(firstImg) : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photosToAdd, selectedKeys.join("|")]);

  function setCaption(k: string, v: string) {
    setCaptions((prev) => ({ ...prev, [k]: v }));
  }
  function removeDraft(k: string) {
    setPhotosToAdd((prev) => prev.filter((f) => fileKey(f) !== k));
    setVideosToAdd((prev) => prev.filter((f) => fileKey(f) !== k));
    setCaptions((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    setPreviewUrls((prev) => {
      const next = { ...prev };
      if (next[k]) {
        URL.revokeObjectURL(next[k]);
        delete next[k];
      }
      return next;
    });
    if (coverKey === k) {
      const firstImg = photosToAdd.find((f) => fileKey(f) !== k);
      setCoverKey(firstImg ? fileKey(firstImg) : null);
    }
  }

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
    if (!user || !canSubmit || uploadingMedia) return;

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

    // 1) Create the trip
    const tripRef = await addDoc(collection(db, "trips"), payload as any);

    // 2) Upload selected media (use captions + chosen cover)
    // 2) Upload selected media (use captions + chosen cover)
    const allFiles = [...selectedFiles];
    if (allFiles.length > 0) {
      setUploadingMedia(true);
      try {
        let chosenCoverMediaId: string | null = null;
        let firstImageMediaId: string | null = null;

        for (const file of allFiles) {
          const k = fileKey(file);
          const isImage = file.type.startsWith("image/");
          const isVideo = file.type.startsWith("video/");
          const kind = isImage ? "image" : isVideo ? "video" : "other";
          if (kind === "other") continue;

          // Pre-create a Firestore media doc so we have a stable mediaId
          const mediaRef = doc(collection(db, "trips", tripRef.id, "media"));
          const mediaId = mediaRef.id;

          // Storage path that matches your Storage rules
          const safeName = file.name.replace(/[^\w.\-]+/g, "_");
          const storagePath = `trip_media/${user.uid}/${tripRef.id}/${mediaId}/${safeName}`;

          // Upload to Storage
          const sref = storageRef(storage, storagePath);
          await uploadBytes(sref, file);
          const downloadURL = await getDownloadURL(sref);

          // Write media doc with all required fields (matches Firestore rules)
          await setDoc(mediaRef, {
            tripId: tripRef.id,
            type: kind, // "image" | "video"
            storagePath, // REQUIRED by rules
            downloadURL, // REQUIRED by rules
            createdAt: Date.now(), // REQUIRED by rules
            caption: captions[k] || "", // optional
            fileName: file.name, // optional (kept for convenience)
            size: file.size, // optional
            contentType: file.type, // optional
          } as any);

          if (isImage) {
            if (k === coverKey && !chosenCoverMediaId)
              chosenCoverMediaId = mediaId;
            if (!firstImageMediaId) firstImageMediaId = mediaId;
          }
        }

        const coverIdToUse = chosenCoverMediaId || firstImageMediaId;
        if (coverIdToUse) {
          await updateDoc(doc(db, "trips", tripRef.id), {
            coverMediaId: coverIdToUse,
            updatedAt: Date.now(),
          } as any);
        }
      } finally {
        setUploadingMedia(false);
      }
    }

    // 3) Reset the form and file pickers
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
    setPhotosToAdd([]);
    setVideosToAdd([]);
    setCaptions({});
    setPreviewUrls({});
    setCoverKey(null);
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
    // Handle ISO date strings (YYYY-MM-DD) without timezone conversion
    if (typeof d === "string") {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
      if (match) {
        return `${match[2]}/${match[3]}/${match[1]}`;
      }
    }
    // Fallback for timestamps
    const dt = new Date(d);
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    const y = dt.getFullYear();
    return `${m}/${day}/${y}`;
  };

  const dateRangeOf = (t: Trip) => `${fmt(t.startDate)} → ${fmt(t.endDate)}`;

  const clip = (s?: string | null, n = 120) =>
    s ? (s.length > n ? s.slice(0, n) + "…" : s) : "";

  // --- sorted lists for UI ---
  const sortedCountries = useMemo(() => sortAZWithOtherLast(COUNTRIES), []);
  const availableStates = useMemo(
    () => sortAZWithOtherLast(getStates(form.country)),
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
              {sortedCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* State / Province / Island */}
          <div>
            <label className="label">State / Province / Island</label>
            {availableStates.length ? (
              <>
                <select
                  className="input"
                  value={availableStates.includes(form.state) ? form.state : ""}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                >
                  <option value="">Select from list</option>
                  {availableStates.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  className="input mt-2"
                  placeholder="Enter manually"
                  value={availableStates.includes(form.state) ? "" : form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
              </>
            ) : (
              <input
                className="input"
                placeholder="e.g., California, Bali, etc."
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

          {/* Media pickers (separate component) */}
          <TripCreateMediaPicker
            photos={photosToAdd}
            videos={videosToAdd}
            onPhotosChange={setPhotosToAdd}
            onVideosChange={setVideosToAdd}
          />

          {/* NEW: Media preview/editor like the screenshot */}
          <div className="md:col-span-3">
            <h3 className="text-lg font-semibold mb-3">Media</h3>

            {selectedFiles.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No media selected yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedFiles.map((f) => {
                  const k = fileKey(f);
                  const isImage = f.type.startsWith("image/");
                  const url = previewUrls[k];
                  return (
                    <div key={k} className="card space-y-2">
                      <div className="w-full h-60 rounded-xl overflow-hidden bg-haiti-800/5">
                        {isImage ? (
                          <img
                            src={url}
                            alt={f.name}
                            className="w-full h-full object-cover"
                            draggable={false}
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
                              ? "text-sm text-green-600 cursor-default"
                              : "text-sm link"
                          }
                          onClick={() => coverKey !== k && setCoverKey(k)}
                          disabled={coverKey === k}
                        >
                          {coverKey === k ? "✓ Cover" : "Set as cover"}
                        </button>

                        <button
                          type="button"
                          className="text-sm text-red-600"
                          onClick={() => removeDraft(k)}
                        >
                          Delete
                        </button>
                      </div>

                      <div>
                        <label className="label">Caption</label>
                        <textarea
                          className="input h-auto min-h-[44px] leading-5 resize-none overflow-hidden"
                          rows={1}
                          placeholder="Add a caption…"
                          value={captions[k] || ""}
                          onChange={(e) => {
                            setCaption(k, e.target.value);
                          }}
                          onInput={(e) => {
                            const ta = e.currentTarget;
                            ta.style.height = "auto";
                            ta.style.height = `${ta.scrollHeight}px`;
                          }}
                          ref={(el) => {
                            if (el) {
                              el.style.height = "auto";
                              el.style.height = `${el.scrollHeight}px`;
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="md:col-span-3 flex gap-3">
            <button
              className="btn"
              type="submit"
              disabled={!canSubmit || uploadingMedia}
            >
              {uploadingMedia ? "Creating & Uploading…" : "Add Trip"}
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
                    className="absolute top-full right-0 mt-2 w-36 rounded-md border border-border bg-surface shadow-md text-sm"
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
      {editingTrip ? (
        <EditTripModal
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
        />
      ) : null}
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
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showArrows, setShowArrows] = useState(false);
  const [focus, setFocus] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });
  const [dragging, setDragging] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // watch all media for this trip
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

  // set current media based on navigation
  useEffect(() => {
    if (allMedia.length === 0) {
      setCover(null);
      return;
    }
    const media = allMedia[currentIndex];
    if (media) {
      setCover(media);
    }
  }, [allMedia, currentIndex]);

  // initialize index based on cover media
  useEffect(() => {
    if (!coverMediaId || allMedia.length === 0) return;
    const idx = allMedia.findIndex((m) => m.id === coverMediaId);
    if (idx !== -1) {
      setCurrentIndex(idx);
    }
  }, [coverMediaId, allMedia]);

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

  function clamp01(n: number) {
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  let lastSaved: { x: number; y: number } | null = null;

  async function persistFocus(next: { x: number; y: number }) {
    // clamp to 0..100 and avoid redundant writes
    const clamped = { x: clamp01(next.x), y: clamp01(next.y) };
    if (lastSaved && lastSaved.x === clamped.x && lastSaved.y === clamped.y)
      return;

    try {
      await updateDoc(doc(db, "trips", tripId), {
        coverFocus: clamped,
        updatedAt: Date.now(),
      } as any);
      lastSaved = clamped;
    } catch (err) {
      // optional: surface or log to help debug rules
      // console.warn("persistFocus failed", err);
    }
  }

  function startDrag(e: React.MouseEvent | React.TouchEvent) {
    // e.preventDefault();
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
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  function goToNext(e: React.MouseEvent) {
    e.stopPropagation();
    if (currentIndex < allMedia.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  if (!cover) {
    return (
      <div className="aspect-[16/9] w-full bg-haiti-800/5 flex items-center justify-center text-muted-foreground text-xs">
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
      className="relative aspect-[16/9] w-full overflow-hidden bg-black/5 group"
      onMouseDown={startDrag}
      onMouseMove={moveDrag}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchStart={startDrag}
      onTouchMove={moveDrag}
      onTouchEnd={endDrag}
      onMouseEnter={() => setShowArrows(true)}
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

      {/* Navigation arrows - show on hover when multiple images */}
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

      {/* Image counter */}
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
