"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  addDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import { COUNTRIES, getStates } from "@/lib/geo";
import { getPhotoTakenAt } from "@/lib/utils";
import ItemFlipbook from "./ItemFlipbook";

// Properly singularize title names (Activities → Activity, Destinations → Destination, etc.)
function singularize(title: string): string {
  if (title === "Activities") return "Activity";
  if (title.endsWith("ies")) return title.slice(0, -3) + "y";
  if (title.endsWith("s")) return title.slice(0, -1);
  return title;
}

type WithId<T> = T & { id: string };

type SimplePlace = {
  id?: string;
  name: string;
  onShip?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  websiteUrl?: string | null;
  notes?: string | null;
  review?: string | null;
  qualityRating?: number | null;
  valueRating?: number | null;
  serviceRating?: number | null;
  locationRating?: number | null;
  accommodationType?: string | null;
  transportationMode?: string | null;
  createdAt?: number;
  updatedAt?: number;
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

// Format phone number - supports US format and international numbers (up to 15 digits)
function formatPhoneUS(input: string): string {
  const digits = (input || "").replace(/\D+/g, "");

  // If more than 10 digits, treat as international - format with country code
  if (digits.length > 10) {
    // Allow up to 15 digits (E.164 standard max)
    const limited = digits.slice(0, 15);
    // Format as: +XX XXX XXX XXXX or similar groupings
    if (limited.length <= 11) {
      // e.g., +1 555 456 7890
      return `+${limited.slice(0, 1)} ${limited.slice(1, 4)} ${limited.slice(4, 7)} ${limited.slice(7)}`.trim();
    } else if (limited.length <= 12) {
      // e.g., +91 98765 43210
      return `+${limited.slice(0, 2)} ${limited.slice(2, 7)} ${limited.slice(7)}`.trim();
    } else {
      // e.g., +123 456 789 0123
      return `+${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6, 9)} ${limited.slice(9)}`.trim();
    }
  }

  // Standard US format for 10 or fewer digits
  const a = digits.slice(0, 3); // area code
  const b = digits.slice(3, 6); // first 3 digits
  const c = digits.slice(6, 10); // last 4 digits

  if (!a) return "";
  if (!b) return `(${a}`;
  if (!c) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

/** A→Z sort with "Other/Others/—/N/A/None/-" pinned to the end */
const isOtherish = (s: string) => {
  const t = s.trim().toLowerCase();
  return t === "other" || t === "others" || t === "—" || t === "-" || t === "n/a" || t === "none";
};
const sortAZWithOtherLast = (
  list: readonly string[] | string[] = []
): string[] => {
  const arr = [...list].sort((a, b) => a.localeCompare(b));
  const tail = arr.filter(isOtherish);
  const head = arr.filter((x) => !isOtherish(x));
  return [...head, ...tail];
};

export default function PlaceModal({
  title,
  tripId,
  subcollection,
  extraLeft = [],
  extraRight = [],
  onClose,
}: {
  title: string;
  tripId: string;
  subcollection:
    | "destinations"
    | "activities"
    | "accommodations"
    | "restaurants"
    | "cruises";
  extraLeft?: { key: string; label: string; options: string[] }[];
  extraRight?: { key: string; label: string; options: string[] }[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<WithId<SimplePlace>[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SimplePlace>({
    name: "",
    onShip: false,
    startDate: "",
    endDate: "",
    address: "",
    city: "",
    state: "",
    country: "",
    phoneNumber: "",
    websiteUrl: "",
    notes: "",
    review: "",
    qualityRating: null,
    valueRating: null,
    serviceRating: null,
    locationRating: null,
    accommodationType: "",
    transportationMode: "",
  });
  const [itemFlipbookOpen, setItemFlipbookOpen] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const availableStates = useMemo(
    () => sortAZWithOtherLast(getStates(form.country)),
    [form.country]
  );

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...fs]);
  }

  useEffect(() => {
    setPreviews((prev) => {
      const next = { ...prev };
      for (const f of files) {
        const k = fileKey(f);
        if (!next[k]) next[k] = URL.createObjectURL(f);
      }
      for (const k of Object.keys(next)) {
        if (!files.find((f) => fileKey(f) === k)) {
          URL.revokeObjectURL(next[k]);
          delete next[k];
        }
      }
      return next;
    });
  }, [files]);

  useEffect(() => {
    const qx = query(
      collection(db, "trips", tripId, subcollection),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(qx, (snap) => {
      const arr: WithId<SimplePlace>[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setRows(arr);
    });
    return () => unsub();
  }, [tripId, subcollection]);

  function canSave() {
    // If on ship, only name is required
    if (form.onShip) {
      return !!form.name;
    }
    return !!form.name && !!form.city && !!form.country;
  }

  async function saveRow() {
    if (!canSave()) return;

    const now = Date.now();

    if (editingId) {
      // Update existing
      await updateDoc(doc(db, "trips", tripId, subcollection, editingId), {
        ...form,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        updatedAt: now,
      } as any);

      // Upload new files if any
      for (const f of files) {
        const mediaRef = doc(collection(db, "trips", tripId, "media"));
        const safe = f.name.replace(/[^\w.\-]+/g, "_");
        const path = `trip_media/${auth.currentUser?.uid}/${tripId}/${mediaRef.id}/${safe}`;
        await uploadBytes(storageRef(storage, path), f);
        const url = await getDownloadURL(storageRef(storage, path));

        // Extract EXIF date for proper chronological ordering
        const takenAt = await getPhotoTakenAt(f);

        await setDoc(mediaRef, {
          tripId,
          type: f.type.startsWith("video/") ? "video" : "image",
          storagePath: path,
          downloadURL: url,
          createdAt: Date.now(),
          takenAt,
          caption: `${singularize(title)} • ${form.name}`,
          linkedSubcollection: subcollection,
          linkedId: editingId,
        } as any);
      }

      setEditingId(null);
    } else {
      // Create new
      const rowRef = await addDoc(
        collection(db, "trips", tripId, subcollection),
        {
          ...form,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          createdAt: now,
          updatedAt: now,
        } as any
      );

      for (const f of files) {
        const mediaRef = doc(collection(db, "trips", tripId, "media"));
        const safe = f.name.replace(/[^\w.\-]+/g, "_");
        const path = `trip_media/${auth.currentUser?.uid}/${tripId}/${mediaRef.id}/${safe}`;
        await uploadBytes(storageRef(storage, path), f);
        const url = await getDownloadURL(storageRef(storage, path));

        // Extract EXIF date for proper chronological ordering
        const takenAt = await getPhotoTakenAt(f);

        await setDoc(mediaRef, {
          tripId,
          type: f.type.startsWith("video/") ? "video" : "image",
          storagePath: path,
          downloadURL: url,
          createdAt: Date.now(),
          takenAt,
          caption: `${singularize(title)} • ${form.name}`,
          linkedSubcollection: subcollection,
          linkedId: rowRef.id,
        } as any);
      }
    }

    resetForm();
  }

  function resetForm() {
    setForm({
      name: "",
      onShip: false,
      startDate: "",
      endDate: "",
      address: "",
      city: "",
      state: "",
      country: "",
      phoneNumber: "",
      websiteUrl: "",
      notes: "",
      review: "",
      qualityRating: null,
      valueRating: null,
      serviceRating: null,
      locationRating: null,
      accommodationType: "",
      transportationMode: "",
    });
    setFiles([]);
    setEditingId(null);
  }

  function editRow(r: WithId<SimplePlace>) {
    setEditingId(r.id!);
    setForm({
      name: r.name,
      onShip: r.onShip || false,
      startDate: r.startDate || "",
      endDate: r.endDate || "",
      address: r.address || "",
      city: r.city || "",
      state: r.state || "",
      country: r.country || "",
      phoneNumber: r.phoneNumber || "",
      websiteUrl: r.websiteUrl || "",
      notes: r.notes || "",
      review: r.review || "",
      qualityRating: r.qualityRating ?? null,
      valueRating: r.valueRating ?? null,
      serviceRating: r.serviceRating ?? null,
      locationRating: r.locationRating ?? null,
      accommodationType: r.accommodationType || "",
      transportationMode: r.transportationMode || "",
      ...extraLeft.reduce(
        (acc, ex) => ({ ...acc, [ex.key]: (r as any)[ex.key] || "" }),
        {}
      ),
      ...extraRight.reduce(
        (acc, ex) => ({ ...acc, [ex.key]: (r as any)[ex.key] || "" }),
        {}
      ),
    } as SimplePlace);
  }

  async function removeRow(id: string) {
    await deleteDoc(doc(db, "trips", tripId, subcollection, id));
  }

  return (
    <div
      className="fixed inset-x-0 top-[60px] bottom-0 z-[100] bg-black/50 flex items-stretch md:items-center justify-center p-0 md:p-4"
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
            <h3 className="text-lg font-semibold">{title}</h3>
            <button className="navlink" onClick={onClose} aria-label="Close">
              Close
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 px-4 md:px-6 py-4 overflow-y-auto">
          <div className="rounded-xl border border-border p-3">
            <div className="space-y-3">
              {/* Name field - full width */}
              <div>
                <label className="label">Name *</label>
                <input
                  className="input"
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* On Ship checkbox - only for restaurants, activities, accommodations */}
              {(subcollection === "restaurants" || subcollection === "activities" || subcollection === "accommodations") && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="onShip"
                    checked={form.onShip || false}
                    onChange={(e) => setForm({ ...form, onShip: e.target.checked })}
                    className="w-4 h-4 rounded border-border"
                  />
                  <label htmlFor="onShip" className="text-sm cursor-pointer">
                    On Ship
                  </label>
                </div>
              )}

              {/* Start Date and End Date - horizontal row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.startDate || ""}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.endDate || ""}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Country, State, City - horizontal row (hidden when onShip) */}
              {!form.onShip && (
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Country *</label>
                    <select
                      className="input"
                      value={form.country || ""}
                      onChange={(e) =>
                        setForm({ ...form, country: e.target.value })
                      }
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">State / Province / Island *</label>
                    {availableStates.length ? (
                      <>
                        <select
                          className="input"
                          value={availableStates.includes(form.state || "") ? form.state : ""}
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
                          placeholder="Or enter manually (e.g., custom island)"
                          value={availableStates.includes(form.state || "") ? "" : form.state || ""}
                          onChange={(e) => setForm({ ...form, state: e.target.value })}
                        />
                      </>
                    ) : (
                      <input
                        className="input"
                        placeholder="e.g., California, Bali, etc."
                        value={form.state || ""}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                      />
                    )}
                  </div>
                  <div>
                    <label className="label">City *</label>
                    <input
                      className="input"
                      value={form.city || ""}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Address and Phone - horizontal row (hidden when onShip) */}
              {!form.onShip && (
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Address</label>
                    <input
                      className="input"
                      value={form.address || ""}
                      onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input
                      className="input"
                      type="tel"
                      inputMode="tel"
                      value={form.phoneNumber || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          phoneNumber: formatPhoneUS(e.target.value),
                        })
                      }
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              )}

              {/* Accommodation Type - only for accommodations subcollection, hidden when onShip */}
              {subcollection === "accommodations" && !form.onShip && (
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Accommodation Type</label>
                    <select
                      className="input"
                      value={(form as any).accommodationType || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          accommodationType: e.target.value,
                        } as any)
                      }
                    >
                      <option value="">Select accommodation</option>
                      <option value="Airbnb/VRBO">Airbnb/VRBO</option>
                      <option value="Camp">Camp</option>
                      <option value="Condo">Condo</option>
                      <option value="Cruise">Cruise</option>
                      <option value="Friends/Family">Friends/Family</option>
                      <option value="Hostel">Hostel</option>
                      <option value="Hotel">Hotel</option>
                      <option value="House">House</option>
                      <option value="Resort">Resort</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Extra fields - combined in one row (hidden when onShip for restaurants, activities, accommodations) */}
              {(extraLeft.length > 0 || extraRight.length > 0) &&
               !(form.onShip && (subcollection === "restaurants" || subcollection === "activities" || subcollection === "accommodations")) && (
                <div className="grid md:grid-cols-2 gap-3">
                  {extraLeft.map((ex) => (
                    <div key={ex.key}>
                      <label className="label">{ex.label}</label>
                      <select
                        className="input"
                        value={(form as any)[ex.key] || ""}
                        onChange={(e) =>
                          setForm({ ...form, [ex.key]: e.target.value } as any)
                        }
                      >
                        <option value="">Select</option>
                        {ex.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {extraRight.map((ex) => (
                    <div key={ex.key}>
                      <label className="label">{ex.label}</label>
                      <select
                        className="input"
                        value={(form as any)[ex.key] || ""}
                        onChange={(e) =>
                          setForm({ ...form, [ex.key]: e.target.value } as any)
                        }
                      >
                        <option value="">Select</option>
                        {ex.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Website URL - hidden when onShip */}
            {!form.onShip && (
              <div className="mt-3">
                <label className="label">Website URL</label>
                <input
                  className="input"
                  type="url"
                  value={form.websiteUrl || ""}
                  onChange={(e) =>
                    setForm({ ...form, websiteUrl: e.target.value })
                  }
                  placeholder="https://example.com"
                />
              </div>
            )}

            <div className="mt-3">
              <label className="label">Notes</label>
              <textarea
                className="input h-auto min-h-[80px]"
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g., reservation details, opening hours"
                rows={3}
              />
            </div>

            <div className="mt-3">
              <label className="label">Your Review</label>
              <textarea
                className="input h-auto min-h-[80px]"
                value={form.review || ""}
                onChange={(e) => setForm({ ...form, review: e.target.value })}
                placeholder="Share your experience..."
                rows={3}
              />
            </div>

            {/* Rating Section */}
            <div className="mt-3">
              <h3 className="font-semibold mb-3">Rate your experience</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Quality</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        className={`w-8 h-8 rounded transition-colors ${
                          (form.qualityRating ?? 0) >= rating
                            ? "text-yellow-500"
                            : "text-gray-300"
                        }`}
                        onClick={() =>
                          setForm({ ...form, qualityRating: rating })
                        }
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Value</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        className={`w-8 h-8 rounded transition-colors ${
                          (form.valueRating ?? 0) >= rating
                            ? "text-yellow-500"
                            : "text-gray-300"
                        }`}
                        onClick={() =>
                          setForm({ ...form, valueRating: rating })
                        }
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Service</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        className={`w-8 h-8 rounded transition-colors ${
                          (form.serviceRating ?? 0) >= rating
                            ? "text-yellow-500"
                            : "text-gray-300"
                        }`}
                        onClick={() =>
                          setForm({ ...form, serviceRating: rating })
                        }
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Location</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        className={`w-8 h-8 rounded transition-colors ${
                          (form.locationRating ?? 0) >= rating
                            ? "text-yellow-500"
                            : "text-gray-300"
                        }`}
                        onClick={() =>
                          setForm({ ...form, locationRating: rating })
                        }
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="label mb-2">Photos / Videos</div>
              <div
                className="rounded-[18px] p-6 text-center bg-[#f7fafd] border-2 border-dashed"
                style={{ borderColor: "#c7d7e6" }}
              >
                <div className="text-[15px] font-semibold text-foreground">
                  Drag &amp; drop photos/videos here
                </div>
                <div className="text-xs text-muted-foreground my-1">or</div>

                <label className="inline-block">
                  <span className="px-4 py-2 rounded-xl shadow-sm bg-[#5eb9b3] hover:bg-[#4ea9a3] text-white cursor-pointer select-none">
                    Choose files
                  </span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={onPick}
                    className="sr-only"
                  />
                </label>
              </div>
              {files.length > 0 && (
                <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {files.map((f) => {
                    const k = fileKey(f);
                    const url = previews[k];
                    const isImage = f.type.startsWith("image/");
                    return (
                      <div
                        key={k}
                        className="rounded-xl overflow-hidden border border-border"
                      >
                        <div className="w-full h-48 bg-haiti-800/5">
                          {isImage ? (
                            <img
                              src={url}
                              alt={f.name}
                              className="w-full h-full object-cover"
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
                        <div className="p-2 text-right">
                          <button
                            className="text-xs text-red-600"
                            onClick={() =>
                              setFiles((prev) =>
                                prev.filter((x) => fileKey(x) !== k)
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button className="btn" onClick={saveRow} disabled={!canSave()}>
                {editingId ? "Update" : "Add"}
              </button>
              {editingId && (
                <button className="navlink" onClick={resetForm}>
                  Cancel Edit
                </button>
              )}
            </div>
          </div>

          <div className="mt-4">
            <h4 className="font-semibold mb-2">Added</h4>
            <div className="space-y-2">
              {rows.map((r) => (
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
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-sm navlink"
                        onClick={() =>
                          setItemFlipbookOpen({ id: r.id!, name: r.name })
                        }
                      >
                        View
                      </button>
                      <button
                        className="text-sm navlink"
                        onClick={() => editRow(r)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-sm text-red-600"
                        onClick={() => removeRow(r.id!)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No items yet.
                </div>
              )}
            </div>
          </div>

          {/* Item-level Flipbook */}
          {itemFlipbookOpen && (
            <ItemFlipbook
              tripId={tripId}
              linkedId={itemFlipbookOpen.id}
              subcollection={subcollection}
              itemName={itemFlipbookOpen.name}
              onClose={() => setItemFlipbookOpen(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
