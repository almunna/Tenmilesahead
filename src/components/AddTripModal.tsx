// components/AddTripModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { addDoc, collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import type { Trip } from "@/lib/types";
import { COUNTRIES, getStates } from "@/lib/geo";
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

/** Duplicated so nothing else in the app needs to change */
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

export default function AddTripModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  /** optional callback with the new trip id */
  onCreated?: (tripId: string) => void;
}) {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);

  // ------- form -------
  const [f, setF] = useState({
    name: "",
    city: "",
    state: "",
    country: "",
    originCity: "",
    originState: "",
    originCountry: "",
    transportationType: "",
    totalMiles: "",
    startDate: "",
    endDate: "",
    description: "",
  });

  const canCreate =
    !!f.name &&
    !!f.city &&
    !!f.country &&
    !!f.transportationType &&
    !!f.startDate &&
    !!f.endDate;

  /** Ensure “Other/Others” exist, then sort with Otherish last */
  const sortedCountries = useMemo(() => {
    const withOther = new Set<string>([...COUNTRIES, "Other", "Others"]);
    return sortAZWithOtherLast(Array.from(withOther));
  }, []);
  const availableStates = useMemo(
    () => sortAZWithOtherLast(getStates(f.country)),
    [f.country]
  );

  const availableOriginStates = useMemo(
    () => sortAZWithOtherLast(getStates(f.originCountry)),
    [f.originCountry]
  );

  // ------- media pre-select (same UX as Edit modal "pending new") -------
  const [photos, setPhotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [coverKey, setCoverKey] = useState<string | null>(null);

  const fileKey = (fi: File) => `${fi.name}__${fi.size}__${fi.lastModified}`;
  const selectedFiles = useMemo(() => [...photos, ...videos], [photos, videos]);
  const selectedKeys = useMemo(
    () => selectedFiles.map(fileKey),
    [selectedFiles]
  );

  // Maintain preview URLs and cleanup stale ones
  useEffect(() => {
    setPreviewUrls((prev) => {
      const next = { ...prev };
      for (const f0 of selectedFiles) {
        const k = fileKey(f0);
        if (!next[k]) next[k] = URL.createObjectURL(f0);
      }
      for (const k of Object.keys(next)) {
        if (!selectedKeys.includes(k)) {
          URL.revokeObjectURL(next[k]);
          delete next[k];
        }
      }
      return next;
    });
  }, [selectedFiles, selectedKeys]);

  useEffect(() => {
    return () => {
      for (const u of Object.values(previewUrls)) URL.revokeObjectURL(u);
    };
  }, [previewUrls]);

  // default a cover choice among NEW images if user hasn't picked one
  useEffect(() => {
    const firstImg = photos[0];
    if (!coverKey) {
      if (firstImg) setCoverKey(fileKey(firstImg));
    } else if (!selectedKeys.includes(coverKey)) {
      setCoverKey(firstImg ? fileKey(firstImg) : null);
    }
  }, [photos, selectedKeys, coverKey]);

  function setNewCaption(k: string, v: string) {
    setCaptions((p) => ({ ...p, [k]: v }));
  }
  function removePending(k: string) {
    setPhotos((p) => p.filter((fi) => fileKey(fi) !== k));
    setVideos((p) => p.filter((fi) => fileKey(fi) !== k));
    setCaptions((p) => {
      const n = { ...p };
      delete n[k];
      return n;
    });
    setPreviewUrls((p) => {
      const n = { ...p };
      if (n[k]) {
        URL.revokeObjectURL(n[k]);
        delete n[k];
      }
      return n;
    });
    if (coverKey === k) {
      const firstImg = photos.find((fi) => fileKey(fi) !== k);
      setCoverKey(firstImg ? fileKey(firstImg) : null);
    }
  }

  // small helper for auto-growing caption inputs
  function autoGrow(el: HTMLTextAreaElement) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 480) + "px";
  }

  function PendingMediaCard(fi: File) {
    const k = fileKey(fi);
    const isImage = fi.type.startsWith("image/");
    const url = previewUrls[k];
    return (
      <div key={k} className="card space-y-2">
        <div className="w-full h-44 sm:h-56 md:h-60 xl:h-72 rounded-xl overflow-hidden bg-haiti-800/5">
          {isImage ? (
            <img
              src={url}
              alt={fi.name}
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
          {isImage ? (
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
          ) : (
            <span className="text-xs text-muted-foreground">Video</span>
          )}

          <button
            type="button"
            className="text-sm text-red-600"
            onClick={() => removePending(k)}
          >
            Remove
          </button>
        </div>

        <div>
          <label className="label">Caption</label>
          <textarea
            className="input h-9 min-h-[2.25rem] resize-none"
            rows={1}
            placeholder="Add a caption…"
            value={captions[k] || ""}
            onChange={(e) => {
              setNewCaption(k, e.target.value);
              autoGrow(e.currentTarget);
            }}
            onInput={(e) => autoGrow(e.currentTarget)}
            onFocus={(e) => autoGrow(e.currentTarget)}
          />
        </div>
      </div>
    );
  }

  async function createTrip() {
    if (!user || creating || !canCreate) return;

    setCreating(true);
    try {
      const now = Date.now();
      const payload: Trip = {
        ownerId: user.uid,
        name: f.name,
        city: f.city,
        state: f.state || null,
        country: f.country,
        originCity: f.originCity || null,
        originState: f.originState || null,
        originCountry: f.originCountry || null,
        transportationType: f.transportationType || null,
        accommodationType: null,
        specificAddress: null,
        totalMiles: f.totalMiles ? parseFloat(f.totalMiles) : null,
        startDate: f.startDate,
        endDate: f.endDate,
        description: f.description || null,
        coverMediaId: null,
        createdAt: now,
        updatedAt: now,
      };

      console.log("Creating trip with payload:", payload);
      console.log("User UID:", user.uid);

      // 1) Create trip doc
      const tripRef = await addDoc(collection(db, "trips"), payload as any);

      // 2) Upload any selected media, set cover if applicable
      const all = [...selectedFiles];
      let chosenCoverMediaId: string | null = null;
      let firstImageMediaId: string | null = null;

      for (const file of all) {
        const k = fileKey(file);
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        const kind = isImage ? "image" : isVideo ? "video" : "other";
        if (kind === "other") continue;

        // pre-create media doc for stable id in storage path
        const mediaRef = doc(collection(db, "trips", tripRef.id, "media"));
        const mediaId = mediaRef.id;

        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const storagePath = `trip_media/${user.uid}/${tripRef.id}/${mediaId}/${safeName}`;

        const sref = storageRef(storage, storagePath);
        await uploadBytes(sref, file, { contentType: file.type });
        const downloadURL = await getDownloadURL(sref);

        await setDoc(mediaRef, {
          tripId: tripRef.id,
          type: kind,
          storagePath,
          downloadURL,
          createdAt: Date.now(),
          caption: captions[k] || "",
          fileName: file.name,
          size: file.size,
          contentType: file.type,
        } as any);

        if (isImage) {
          if (!firstImageMediaId) firstImageMediaId = mediaId;
          if (k === coverKey && !chosenCoverMediaId)
            chosenCoverMediaId = mediaId;
        }
      }

      const coverId = chosenCoverMediaId || firstImageMediaId;
      if (coverId) {
        await updateDoc(doc(db, "trips", tripRef.id), {
          coverMediaId: coverId,
          updatedAt: Date.now(),
        } as any);
      }

      // Optionally notify caller
      onCreated?.(tripRef.id);

      // close + cleanup
      onClose();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-stretch md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="
    w-full max-w-full md:max-w-2xl lg:max-w-3xl
    h-auto max-h-[80vh]
    bg-surface text-foreground border border-border shadow-lg
    md:rounded-xl
    flex flex-col
  "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/70 border-b border-border">
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            <h3 className="text-lg font-semibold">Add Trip</h3>
            <button
              className="navlink"
              onClick={onClose}
              aria-label="Close add modal"
            >
              Close
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 px-4 md:px-6 py-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Trip Title */}
            <div className="md:col-span-3">
              <label className="label">Trip Title *</label>
              <input
                className="input"
                placeholder="e.g., Summer in Paris"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </div>

            {/* Origin Section Header */}
            <div className="md:col-span-3">
              <h4 className="text-lg font-semibold text-foreground mt-2 mb-1">Starting From</h4>
            </div>

            {/* Origin Country */}
            <div>
              <label className="label">Origin Country</label>
              <select
                className="input"
                value={f.originCountry}
                onChange={(e) => {
                  const newCountry = e.target.value;
                  const states = getStates(newCountry);
                  const nextState = states.includes(f.originState) ? f.originState : "";
                  setF({ ...f, originCountry: newCountry, originState: nextState });
                }}
              >
                <option value="">Select origin country</option>
                {sortedCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Origin State / Province */}
            <div>
              <label className="label">Origin State / Province</label>
              {availableOriginStates.length ? (
                <>
                  <select
                    className="input"
                    value={availableOriginStates.includes(f.originState) ? f.originState : ""}
                    onChange={(e) => setF({ ...f, originState: e.target.value })}
                  >
                    <option value="">Select from list</option>
                    {availableOriginStates.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input mt-2"
                    placeholder="Enter manually"
                    value={availableOriginStates.includes(f.originState) ? "" : f.originState}
                    onChange={(e) => setF({ ...f, originState: e.target.value })}
                  />
                </>
              ) : (
                <input
                  className="input"
                  placeholder="e.g., Florida"
                  value={f.originState}
                  onChange={(e) => setF({ ...f, originState: e.target.value })}
                />
              )}
            </div>

            {/* Origin City */}
            <div>
              <label className="label">Origin City</label>
              <input
                className="input"
                placeholder="e.g., St. Augustine"
                value={f.originCity}
                onChange={(e) => setF({ ...f, originCity: e.target.value })}
              />
            </div>

            {/* Destination Section Header */}
            <div className="md:col-span-3">
              <h4 className="text-lg font-semibold text-foreground mt-3 mb-1">Destination</h4>
            </div>

            {/* Country → State/Province → City */}
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
                {sortedCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">State / Province / Island</label>
              {availableStates.length ? (
                <>
                  <select
                    className="input"
                    value={availableStates.includes(f.state) ? f.state : ""}
                    onChange={(e) => setF({ ...f, state: e.target.value })}
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
                    value={availableStates.includes(f.state) ? "" : f.state}
                    onChange={(e) => setF({ ...f, state: e.target.value })}
                  />
                </>
              ) : (
                <input
                  className="input"
                  placeholder="e.g., California, Bali, etc."
                  value={f.state}
                  onChange={(e) => setF({ ...f, state: e.target.value })}
                />
              )}
            </div>

            <div>
              <label className="label">City *</label>
              <input
                className="input"
                placeholder="e.g., Paris"
                value={f.city}
                onChange={(e) => setF({ ...f, city: e.target.value })}
              />
            </div>

            {/* Transportation */}
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

            {/* Total Miles Traveled */}
            <div className="md:col-span-2">
              <label className="label">Total Miles Traveled</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g., 250"
                value={f.totalMiles}
                onChange={(e) => setF({ ...f, totalMiles: e.target.value })}
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

            {/* PICKER + ACTIONS */}
            <div className="md:col-span-3">
              <h4 className="text-lg font-semibold mb-2">Add Photos/Videos</h4>
              <TripCreateMediaPicker
                photos={photos}
                videos={videos}
                onPhotosChange={setPhotos}
                onVideosChange={setVideos}
              />
              {selectedFiles.length > 0 && (
                <button
                  type="button"
                  className="navlink mt-3"
                  onClick={() => {
                    for (const u of Object.values(previewUrls))
                      URL.revokeObjectURL(u);
                    setPhotos([]);
                    setVideos([]);
                    setCaptions({});
                    setPreviewUrls({});
                    setCoverKey(null);
                  }}
                  disabled={creating}
                >
                  Clear selection
                </button>
              )}
            </div>

            {/* MEDIA GRID (pending only) */}
            <div className="md:col-span-3">
              <h4 className="text-lg font-semibold mb-2">Media</h4>
              {selectedFiles.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No media selected yet. Use the picker above.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedFiles.map((fi) => PendingMediaCard(fi))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 z-10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/70 border-t border-border">
          <div className="px-4 md:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              className="btn w-full sm:w-auto"
              onClick={createTrip}
              disabled={!canCreate || creating || !user}
            >
              {creating ? "Creating…" : "Create Trip"}
            </button>
            <button
              className="navlink w-full sm:w-auto"
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
