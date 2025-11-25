"use client";

import { useEffect, useMemo, useState } from "react";
import {
  doc,
  updateDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  addDoc,
  deleteDoc,
  setDoc, // ✅ added
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import type { Trip, MediaItem } from "@/lib/types";
import { COUNTRIES, getStates } from "@/lib/geo";
import TripCreateMediaPicker from "@/components/TripCreateMediaPicker";

/** A→Z sort with “Other/Others/—/N/A/None/-” pinned to the end */
const isOtherish = (s: string) => {
  const t = s.trim().toLowerCase();
  return t === "other" || t === "—" || t === "-" || t === "n/a" || t === "none";
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

export default function EditTripModal({
  trip,
  onClose,
}: {
  trip: Trip;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    name: trip.name || "",
    city: trip.city || "",
    state: trip.state || "",
    country: trip.country || "",
    originCity: trip.originCity || "",
    originState: trip.originState || "",
    originCountry: trip.originCountry || "",
    transportationType: trip.transportationType || "",
    accommodationType: trip.accommodationType || "",
    specificAddress: trip.specificAddress || "",
    totalMiles: trip.totalMiles?.toString() || "",
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

  /** Ensure “Other/Others” actually exist, then sort with Otherish last */
  const sortedCountries = useMemo(() => {
    const withOther = new Set<string>([...COUNTRIES, "Other", "Others"]);
    return sortAZWithOtherLast(Array.from(withOther));
  }, []); // stable; COUNTRIES is a module const

  const availableStates = useMemo(
    () => sortAZWithOtherLast(getStates(f.country)),
    [f.country]
  );

  const availableOriginStates = useMemo(
    () => sortAZWithOtherLast(getStates(f.originCountry)),
    [f.originCountry]
  );

  /* -------------------- EXISTING MEDIA -------------------- */
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);

  useEffect(() => {
    if (!trip.id) return;
    const q = query(
      collection(db, "trips", trip.id, "media"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: MediaItem[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setMedia(arr);
        setMediaLoading(false);
      },
      () => setMediaLoading(false)
    );
    return () => unsub();
  }, [trip.id]);

  async function setCover(mediaId: string) {
    if (!trip.id) return;
    await updateDoc(doc(db, "trips", trip.id), {
      coverMediaId: mediaId,
      updatedAt: Date.now(),
    } as any);
  }

  async function saveCaption(mediaId: string, caption: string) {
    if (!trip.id) return;
    await updateDoc(doc(db, "trips", trip.id, "media", mediaId), {
      caption,
    } as any);
  }

  async function removeMedia(m: MediaItem) {
    if (!trip.id || !m.id) return;
    try {
      if ((m as any).downloadURL) {
        const sref = storageRef(storage, (m as any).downloadURL);
        await deleteObject(sref);
      }
    } catch {}
    await deleteDoc(doc(db, "trips", trip.id, "media", m.id));
    if (trip.coverMediaId === m.id) {
      await updateDoc(doc(db, "trips", trip.id), {
        coverMediaId: null,
        updatedAt: Date.now(),
      } as any);
    }
  }

  /* -------------------- ADD NEW MEDIA (APPEND) -------------------- */
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newVideos, setNewVideos] = useState<File[]>([]);
  const [uploadingNew, setUploadingNew] = useState(false);
  const [newCaptions, setNewCaptions] = useState<Record<string, string>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [newCoverKey, setNewCoverKey] = useState<string | null>(null);

  const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;
  const selectedFiles = useMemo(
    () => [...newPhotos, ...newVideos],
    [newPhotos, newVideos]
  );
  const selectedKeys = useMemo(
    () => selectedFiles.map(fileKey),
    [selectedFiles]
  );

  // Maintain preview URLs and cleanup stale ones
  useEffect(() => {
    setPreviewUrls((prev) => {
      const next = { ...prev };
      for (const f of selectedFiles) {
        const k = fileKey(f);
        if (!next[k]) next[k] = URL.createObjectURL(f);
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

  // Default a cover choice among NEW images if user hasn't picked one
  useEffect(() => {
    const firstImg = newPhotos[0];
    if (!newCoverKey) {
      if (firstImg) setNewCoverKey(fileKey(firstImg));
    } else if (!selectedKeys.includes(newCoverKey)) {
      setNewCoverKey(firstImg ? fileKey(firstImg) : null);
    }
  }, [newPhotos, selectedKeys]);

  function setNewCaption(k: string, v: string) {
    setNewCaptions((prev) => ({ ...prev, [k]: v }));
  }
  function removePending(k: string) {
    setNewPhotos((prev) => prev.filter((f) => fileKey(f) !== k));
    setNewVideos((prev) => prev.filter((f) => fileKey(f) !== k));
    setNewCaptions((prev) => {
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
    if (newCoverKey === k) {
      const firstImg = newPhotos.find((f) => fileKey(f) !== k);
      setNewCoverKey(firstImg ? fileKey(firstImg) : null);
    }
  }

  async function uploadPending() {
    if (!trip.id || uploadingNew || selectedFiles.length === 0) return;

    // ✅ REQUIRE ownerId to build secure path that matches Storage rules
    const ownerId = (trip as any).ownerId as string | undefined;
    if (!ownerId) {
      console.error(
        "Trip is missing ownerId; cannot build secure storage path."
      );
      return;
    }

    setUploadingNew(true);
    try {
      let chosenCoverId: string | null = null;

      for (const file of selectedFiles) {
        const k = fileKey(file);
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        const kind = isImage ? "image" : isVideo ? "video" : "other";
        if (kind === "other") continue;

        // Pre-create media doc to get a stable mediaId for the path
        const mediaCol = collection(db, "trips", trip.id, "media");
        const mediaRef = doc(mediaCol);

        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `trip_media/${ownerId}/${trip.id}/${mediaRef.id}/${safeName}`;

        const sref = storageRef(storage, path);
        await uploadBytes(sref, file, { contentType: file.type }); // no metadata needed
        const url = await getDownloadURL(sref);

        await setDoc(mediaRef, {
          type: kind,
          downloadURL: url,
          caption: newCaptions[k] || "",
          createdAt: Date.now(),
          fileName: file.name,
          size: file.size,
          contentType: file.type,
        } as any);

        if (isImage && k === newCoverKey && !chosenCoverId) {
          chosenCoverId = mediaRef.id;
        }
      }

      if (chosenCoverId) {
        await updateDoc(doc(db, "trips", trip.id), {
          coverMediaId: chosenCoverId,
          updatedAt: Date.now(),
        } as any);
      }

      // reset pending UI
      setNewPhotos([]);
      setNewVideos([]);
      setNewCaptions({});
      setPreviewUrls({});
      setNewCoverKey(null);
    } finally {
      setUploadingNew(false);
    }
  }

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
        originCity: f.originCity || null,
        originState: f.originState || null,
        originCountry: f.originCountry || null,
        transportationType: f.transportationType || null,
        accommodationType: f.accommodationType || null,
        specificAddress: f.specificAddress || null,
        totalMiles: f.totalMiles ? parseFloat(f.totalMiles) : null,
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

  // --- small helper for auto-growing caption inputs ---
  function autoGrow(el: HTMLTextAreaElement) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 480) + "px";
  }

  // ------- helpers to render cards (existing & pending) -------
  function ExistingMediaCard(m: MediaItem) {
    return (
      <div key={m.id} className="card space-y-2">
        {/* responsive preview container */}
        <div className="w-full h-44 sm:h-56 md:h-60 xl:h-72 rounded-xl overflow-hidden bg-haiti-800/5">
          {(m as any).type === "video" ? (
            <video
              src={(m as any).downloadURL}
              className="w-full h-full object-cover"
              controls
              preload="metadata"
            />
          ) : (
            <img
              src={(m as any).downloadURL}
              alt={(m as any).caption || ""}
              className="w-full h-full object-cover"
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            className={
              trip.coverMediaId === m.id
                ? "text-sm text-green-600 cursor-default"
                : "text-sm link"
            }
            onClick={() => trip.coverMediaId !== m.id && setCover(m.id!)}
            disabled={trip.coverMediaId === m.id}
          >
            {trip.coverMediaId === m.id ? "✓ Cover" : "Set as cover"}
          </button>

          <button
            type="button"
            className="text-sm text-red-600"
            onClick={() => removeMedia(m)}
          >
            Delete
          </button>
        </div>

        <div>
          <label className="label">Caption</label>
          <textarea
            className="input h-9 min-h-[2.25rem] resize-none"
            rows={1}
            defaultValue={(m as any).caption || ""}
            onInput={(e) => autoGrow(e.currentTarget)}
            onFocus={(e) => autoGrow(e.currentTarget)}
            onBlur={(e) => {
              saveCaption(m.id!, e.target.value);
            }}
            placeholder="Update caption…"
          />
        </div>
      </div>
    );
  }

  function PendingMediaCard(f: File) {
    const k = fileKey(f);
    const isImage = f.type.startsWith("image/");
    const url = previewUrls[k];
    return (
      <div key={k} className="card space-y-2">
        {/* responsive preview container */}
        <div className="w-full h-44 sm:h-56 md:h-60 xl:h-72 rounded-xl overflow-hidden bg-haiti-800/5">
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
          {isImage ? (
            <button
              type="button"
              className={
                newCoverKey === k
                  ? "text-sm text-green-600 cursor-default"
                  : "text-sm link"
              }
              onClick={() => newCoverKey !== k && setNewCoverKey(k)}
              disabled={newCoverKey === k}
            >
              {newCoverKey === k ? "✓ Cover (new)" : "Set as cover"}
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
            value={newCaptions[k] || ""}
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

  // Build ordered list: [coverExisting], [pending new], [rest existing]
  const coverExisting = useMemo(
    () => media.find((m) => m.id === trip.coverMediaId) || null,
    [media, trip.coverMediaId]
  );
  const restExisting = useMemo(
    () => media.filter((m) => m.id !== trip.coverMediaId),
    [media, trip.coverMediaId]
  );

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
          h-[100dvh] md:h-auto md:max-h-[90vh]
          bg-surface text-foreground border border-border shadow-lg
          md:rounded-xl
          flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/70 border-b border-border">
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            <h3 className="text-lg font-semibold">Edit Trip</h3>
            <button
              className="navlink"
              onClick={onClose}
              aria-label="Close edit modal"
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
                    placeholder="Or enter manually"
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
                    placeholder="Or enter manually (e.g., custom island)"
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

            {/* Accommodation */}
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

            {/* Total Miles Traveled */}
            <div>
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

            {/* Specific Address */}
            <div className="md:col-span-3">
              <label className="label">Specific Address</label>
              <input
                className="input"
                value={f.specificAddress}
                onChange={(e) =>
                  setF({ ...f, specificAddress: e.target.value })
                }
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

            {/* -------------------- PICKER + ACTIONS (TOP) -------------------- */}
            <div className="md:col-span-3">
              <h4 className="text-lg font-semibold mb-2">Add Photos/Videos</h4>
              <TripCreateMediaPicker
                photos={newPhotos}
                videos={newVideos}
                onPhotosChange={setNewPhotos}
                onVideosChange={setNewVideos}
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn"
                  onClick={uploadPending}
                  disabled={uploadingNew || selectedFiles.length === 0}
                >
                  {uploadingNew
                    ? "Uploading…"
                    : selectedFiles.length === 0
                    ? "Upload"
                    : `Upload ${selectedFiles.length} file${
                        selectedFiles.length > 1 ? "s" : ""
                      }`}
                </button>
                {selectedFiles.length > 0 && (
                  <button
                    type="button"
                    className="navlink"
                    onClick={() => {
                      for (const u of Object.values(previewUrls))
                        URL.revokeObjectURL(u);
                      setNewPhotos([]);
                      setNewVideos([]);
                      setNewCaptions({});
                      setPreviewUrls({});
                      setNewCoverKey(null);
                    }}
                    disabled={uploadingNew}
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>

            {/* -------------------- SINGLE MEDIA LIST (COVER → NEW → REST) -------------------- */}
            <div className="md:col-span-3">
              <h4 className="text-lg font-semibold mb-2">Media</h4>

              {mediaLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : media.length === 0 && selectedFiles.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No media yet. Select files above to add.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Cover first (if present) */}
                  {coverExisting ? ExistingMediaCard(coverExisting) : null}

                  {/* Pending new files appear right AFTER cover */}
                  {selectedFiles.map((f) => PendingMediaCard(f))}

                  {/* Then the rest of existing media */}
                  {restExisting.map((m) => ExistingMediaCard(m))}
                </div>
              )}
            </div>
            {/* -------------------- END SINGLE MEDIA LIST -------------------- */}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 z-10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/70 border-t border-border">
          <div className="px-4 md:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              className="btn w-full sm:w-auto"
              onClick={save}
              disabled={!canSave || saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              className="navlink w-full sm:w-auto"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
