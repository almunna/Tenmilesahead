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
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [shouldLoadTrips, setShouldLoadTrips] = useState(false); // ← defer trips subscription

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

  // Defer subscribing to trips until after first paint / browser idle
  useEffect(() => {
    let timeoutId: any = null;
    let idleId: any = null;
    const enable = () => setShouldLoadTrips(true);

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = (window as any).requestIdleCallback(enable, { timeout: 700 });
    } else {
      timeoutId = setTimeout(enable, 200);
    }

    return () => {
      if (idleId && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Subscribe to trips only when we decided to load them
  useEffect(() => {
    if (!user || !shouldLoadTrips) return;

    const q = query(
      collection(db, "trips"),
      where("ownerId", "==", user.uid),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Trip[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setTrips(arr);
        setTripsLoaded(true);
      },
      () => setTripsLoaded(true) // still mark as finished to hide skeleton
    );

    return () => unsub();
  }, [user, shouldLoadTrips]);

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
            fileName: file.name, // optional
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

        {/* Skeleton / placeholder while trips subscription is deferred or loading */}
        {!shouldLoadTrips || !tripsLoaded ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy="true"
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-[#2a3544] overflow-hidden animate-pulse"
              >
                <div className="aspect-[16/9] w-full bg-white/10" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-2/3 bg-white/10 rounded" />
                  <div className="h-4 w-1/3 bg-white/10 rounded" />
                  <div className="flex gap-2">
                    <div className="h-9 w-24 bg-white/10 rounded-lg" />
                    <div className="h-9 w-9 bg-white/10 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl shadow-lg bg-[#2a3544]"
                style={{ overflow: "visible" }}
              >
                {/* Cover with overlay content */}
                <div className="aspect-[16/9] w-full bg-haiti-800/5 overflow-hidden relative rounded-t-2xl">
                  <CoverThumb tripId={t.id!} coverMediaId={t.coverMediaId} />

                  {/* Dark gradient overlay at bottom */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>

                  {/* Trip info overlay on image - only title and location */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="text-lg font-semibold mb-1 line-clamp-1">
                      {t.name}
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
                      <span className="text-sm">{locationOf(t)}</span>
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
                    <span className="text-sm">{dateRangeOf(t)}</span>
                  </div>

                  {/* Bottom action bar with menu dropdown */}
                  <div className="relative flex items-center gap-2">
                    {/* Menu dropdown */}
                    {menuOpenId === t.id && (
                      <div className="absolute left-0 bottom-full mb-2 w-48 rounded-xl bg-[#3a4557] shadow-2xl overflow-hidden z-[100] border border-white/10">
                        <div className="flex flex-col py-2">
                          <button
                            type="button"
                            className="flex items-center gap-3 px-4 py-3 text-white text-sm hover:bg-white/10 transition-colors text-left"
                            onClick={() => {
                              setEditingTrip(t);
                              setMenuOpenId(null);
                            }}
                          >
                            <svg
                              className="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="flex items-center gap-3 px-4 py-3 text-red-400 text-sm hover:bg-white/10 transition-colors text-left"
                            onClick={() => deleteTrip(t.id!)}
                          >
                            <svg
                              className="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* View Trip button */}
                    <Link
                      className="flex items-center gap-2 px-4 py-2 bg-[#5eb9b3] hover:bg-[#4ea9a3] rounded-lg text-white text-sm font-medium transition-colors"
                      href={`/trips/${t.id}`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                          fillRule="evenodd"
                          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      View Trip
                    </Link>

                    {/* Menu button - toggles dropdown */}
                    <button
                      type="button"
                      className="h-9 w-9 rounded-lg bg-[#3a4557] hover:bg-[#4a5567] flex items-center justify-center text-white transition-colors"
                      aria-label="Menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId((prev) =>
                          prev === t.id ? null : t.id || null
                        );
                      }}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {trips.length === 0 && (
              <div className="text-muted-foreground">No trips yet.</div>
            )}
          </div>
        )}
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
