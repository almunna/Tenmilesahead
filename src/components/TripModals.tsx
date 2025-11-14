// components/TripModals.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  addDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import type { MediaItem } from "@/lib/types";
import Link from "next/link";
import { COUNTRIES } from "@/lib/geo";

/* --------------------------- shared helpers --------------------------- */

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

/* ------------------------------ shell ------------------------------ */
/* Visual-only: consistent overlay, rounded panel, sticky header/footer */
export function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-stretch md:items-center justify-center p-0 md:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="
          w-full max-w-full md:max-w-5xl
          bg-surface text-foreground border border-border shadow-xl
          md:rounded-xl flex flex-col max-h-[90vh]
        "
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/70 border-b border-border">
          <div className="px-4 md:px-6 py-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button className="navlink" onClick={onClose} aria-label="Close">
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- PhotosModal --------------------------- */

export function PhotosModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  useEffect(
    () => () => Object.values(previews).forEach((u) => URL.revokeObjectURL(u)),
    [previews]
  );

  async function save() {
    if (files.length === 0) return;
    setSaving(true);
    try {
      let chosenCoverMediaId: string | null = null;
      let firstImageMediaId: string | null = null;

      for (const f of files) {
        const k = fileKey(f);
        const isImage = f.type.startsWith("image/");
        const isVideo = f.type.startsWith("video/");
        const kind = isImage ? "image" : isVideo ? "video" : "other";
        if (kind === "other") continue;

        const mediaRef = doc(collection(db, "trips", tripId, "media"));
        const mediaId = mediaRef.id;

        const safeName = f.name.replace(/[^\w.\-]+/g, "_");
        const path = `trip_media/${auth.currentUser?.uid}/${tripId}/${mediaId}/${safeName}`;
        const sref = storageRef(storage, path);
        await uploadBytes(sref, f);
        const url = await getDownloadURL(sref);

        await setDoc(mediaRef, {
          tripId,
          type: kind,
          storagePath: path,
          downloadURL: url,
          createdAt: Date.now(),
          caption: captions[k] || "",
          fileName: f.name,
          size: f.size,
          contentType: f.type,
        } as any);

        if (isImage) {
          if (!firstImageMediaId) firstImageMediaId = mediaId;
          if (coverKey === k) chosenCoverMediaId = mediaId;
        }
      }

      const coverId = chosenCoverMediaId || firstImageMediaId;
      if (coverId) {
        await updateDoc(doc(db, "trips", tripId), {
          coverMediaId: coverId,
          updatedAt: Date.now(),
        } as any);
      }

      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-stretch md:items-center justify-center p-0 md:p-4"
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
            <h3 className="text-lg font-semibold">Add Photos/Videos</h3>
            <button className="navlink" onClick={onClose} aria-label="Close">
              Close
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 px-4 md:px-6 py-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Picker block */}
            <div>
              <div className="label mb-2">Add Photos/Videos</div>
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
            </div>

            {/* Grid */}
            {files.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No media selected yet. Use the picker above.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {files.map((f) => {
                  const k = fileKey(f);
                  const url = previews[k];
                  const isImage = f.type.startsWith("image/");
                  return (
                    <div key={k} className="card space-y-2">
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
                          onClick={() =>
                            setFiles((prev) => prev.filter((x) => fileKey(x) !== k))
                          }
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
                          onChange={(e) =>
                            setCaptions((p) => ({ ...p, [k]: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 z-10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/70 border-t border-border">
          <div className="px-4 md:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              className="btn w-full sm:w-auto"
              onClick={save}
              disabled={saving || files.length === 0}
            >
              {saving ? "Saving…" : "Save Photos"}
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

/* -------------------------- ItineraryModal -------------------------- */

export function ItineraryModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<
    Array<{ kind: string; subcollection: string; data: any }>
  >([]);
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    name: string;
    subcollection: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const rows: Array<{ kind: string; subcollection: string; data: any }> =
        [];
      const dest = await getDocs(
        collection(db, "trips", tripId, "destinations")
      );
      dest.forEach((d) =>
        rows.push({
          kind: "Destination",
          subcollection: "destinations",
          data: { id: d.id, ...(d.data() as any) },
        })
      );
      const acts = await getDocs(collection(db, "trips", tripId, "activities"));
      acts.forEach((d) =>
        rows.push({
          kind: "Activity",
          subcollection: "activities",
          data: { id: d.id, ...(d.data() as any) },
        })
      );
      const acc = await getDocs(
        collection(db, "trips", tripId, "accommodations")
      );
      acc.forEach((d) =>
        rows.push({
          kind: "Accommodation",
          subcollection: "accommodations",
          data: { id: d.id, ...(d.data() as any) },
        })
      );
      const res = await getDocs(collection(db, "trips", tripId, "restaurants"));
      res.forEach((d) =>
        rows.push({
          kind: "Restaurant",
          subcollection: "restaurants",
          data: { id: d.id, ...(d.data() as any) },
        })
      );

      rows.sort((a, b) => {
        const sa = new Date(a.data.startDate || 0).getTime();
        const sb = new Date(b.data.startDate || 0).getTime();
        return sa - sb;
      });

      setItems(rows);
    })();
  }, [tripId]);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 flex items-stretch md:items-center justify-center p-0 md:p-4"
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
              <h3 className="text-lg font-semibold">Itinerary (chronological summary)</h3>
              <button className="navlink" onClick={onClose} aria-label="Close">
                Close
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 px-4 md:px-6 py-4 overflow-y-auto">
            <div className="text-sm text-muted-foreground mb-3">
              Click any entry to view its details and photos in a flipbook.
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Dates</th>
                    <th className="px-3 py-2 text-left">Location</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, i) => {
                    const d = row.data;
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
                        <td className="px-3 py-2">
                          {[d.address, d.city, d.state, d.country]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            className="text-xs navlink"
                            onClick={() =>
                              setSelectedItem({
                                id: d.id,
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
                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
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
        </div>
      </div>

      {selectedItem && (
        <ItemFlipbook
          tripId={tripId}
          linkedId={selectedItem.id}
          subcollection={selectedItem.subcollection}
          itemName={selectedItem.name}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}

/* ---------------------------- PlaceModal ---------------------------- */

type SimplePlace = {
  id?: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  city?: string | null;
  state?: string | null;
  country: string;
  address?: string | null;
  phoneNumber?: string | null;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: any;
};

// format to "(555) 456-7890" as you type (max 10 digits: 3 + 3 + 4)
function formatPhoneUS(input: string): string {
  const digits = (input || "").replace(/\D+/g, "").slice(0, 10);
  const a = digits.slice(0, 3);  // area code
  const b = digits.slice(3, 6);  // first 3 digits
  const c = digits.slice(6, 10); // last 4 digits

  if (!a) return "";
  if (!b) return `(${a}`;
  if (!c) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

export function PlaceModal({
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
    | "restaurants";
  extraLeft?: { key: string; label: string; options: string[] }[];
  extraRight?: { key: string; label: string; options: string[] }[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<(SimplePlace & { id: string })[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SimplePlace>({
    name: "",
    startDate: "",
    endDate: "",
    address: "",
    city: "",
    state: "",
    country: "",
    phoneNumber: "",
  });
  const [itemFlipbookOpen, setItemFlipbookOpen] = useState<{
    id: string;
    name: string;
  } | null>(null);

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
      const arr: (SimplePlace & { id: string })[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) })); // visual only
      setRows(arr);
    });
    return () => unsub();
  }, [tripId, subcollection]);

  function canSave() {
    return !!form.name && !!form.city && !!form.country;
  }

  async function saveRow() {
    if (!canSave()) return;

    const now = Date.now();

    if (editingId) {
      await updateDoc(doc(db, "trips", tripId, subcollection, editingId), {
        ...form,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        updatedAt: now,
      } as any);

      for (const f of files) {
        const mediaRef = doc(collection(db, "trips", tripId, "media"));
        const safe = f.name.replace(/[^\w.\-]+/g, "_");
        const path = `trip_media/${auth.currentUser?.uid}/${tripId}/${mediaRef.id}/${safe}`;
        await uploadBytes(storageRef(storage, path), f);
        const url = await getDownloadURL(storageRef(storage, path));

        await setDoc(mediaRef, {
          tripId,
          type: f.type.startsWith("video/") ? "video" : "image",
          storagePath: path,
          downloadURL: url,
          createdAt: Date.now(),
          caption: `${title.slice(0, -1)} • ${form.name}`,
          linkedSubcollection: subcollection,
          linkedId: editingId,
        } as any);
      }

      setEditingId(null);
    } else {
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

        await setDoc(mediaRef, {
          tripId,
          type: f.type.startsWith("video/") ? "video" : "image",
          storagePath: path,
          downloadURL: url,
          createdAt: Date.now(),
          caption: `${title.slice(0, -1)} • ${form.name}`,
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
      startDate: "",
      endDate: "",
      address: "",
      city: "",
      state: "",
      country: "",
      phoneNumber: "",
    });
    setFiles([]);
    setEditingId(null);
  }

  function editRow(r: SimplePlace & { id: string }) {
    setEditingId(r.id);
    setForm({
      name: r.name,
      startDate: r.startDate || "",
      endDate: r.endDate || "",
      address: r.address || "",
      city: r.city || "",
      state: r.state || "",
      country: r.country || "",
      phoneNumber: r.phoneNumber || "",
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
      className="fixed inset-0 z-40 bg-black/50 flex items-stretch md:items-center justify-center p-0 md:p-4"
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
            <div className="grid md:grid-cols-2 gap-3">
          {/* Left column */}
          <div className="space-y-2">
            <div>
              <label className="label">Name *</label>
              <input
                className="input"
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
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

            <div>
              <label className="label">Address</label>
              <input
                className="input"
                value={form.address || ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

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
          </div>

          {/* Right column */}
          <div className="space-y-2">
            <div>
              <label className="label">City *</label>
              <input
                className="input"
                value={form.city || ""}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label className="label">State / Province</label>
              <input
                className="input"
                value={form.state || ""}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Country *</label>
              <select
                className="input"
                value={form.country || ""}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone (formats as (555) 456-7890) */}
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                inputMode="tel"
                placeholder="(555) 456-7890"
                value={form.phoneNumber || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phoneNumber: formatPhoneUS(e.target.value),
                  })
                }
              />
            </div>

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
        </div>

        {/* Media picker block */}
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
            <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

            {/* Footer actions */}
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

          {/* Added list styled as cards */}
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Added</h4>
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm flex-1">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-muted-foreground">
                        {fmtMDY(r.startDate)}
                        {r.endDate ? ` → ${fmtMDY(r.endDate)}` : ""} •{" "}
                        {[r.address, r.city, r.state, r.country]
                          .filter(Boolean)
                          .join(", ") || "—"}
                        {r.phoneNumber ? ` • ${r.phoneNumber}` : ""}{" "}
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
                <div className="text-sm text-muted-foreground">No items yet.</div>
              )}
            </div>
          </div>

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

/* --------------------------- ItemFlipbook --------------------------- */

export function ItemFlipbook({
  tripId,
  linkedId,
  subcollection,
  itemName,
  onClose,
}: {
  tripId: string;
  linkedId: string;
  subcollection: string;
  itemName: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, "trips", tripId, "media"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
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
  }, [tripId, linkedId, subcollection, index]);

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
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-3">
      <div className="w-full max-w-5xl max-h-[90vh] bg-surface border border-border rounded-xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="text-sm">
            {itemName} — {items.length} item{items.length === 1 ? "" : "s"}
          </div>
          <button className="navlink" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center relative overflow-hidden p-3">
          {items.length === 0 ? (
            <div className="text-muted-foreground">
              No media for this item yet
            </div>
          ) : (
            <div className="w-full h-full max-w-5xl flex items-center justify-center">
              {items[index].type === "image" ? (
                <img
                  src={items[index].downloadURL}
                  className="max-h-[70vh] max-w-full rounded-lg"
                  alt={items[index].caption || ""}
                  draggable={false}
                />
              ) : (
                <video
                  src={items[index].downloadURL}
                  className="max-h-[70vh] max-w-full rounded-lg"
                  controls
                />
              )}
            </div>
          )}

          {items.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 btn"
                onClick={prev}
              >
                ◀
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 btn"
                onClick={next}
              >
                ▶
              </button>
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-4 py-3 border-t border-border text-center text-sm text-muted-foreground">
            {items[index].caption || ""}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------- ShareTripModal -------------------------- */

export function ShareTripModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const [link, setLink] = useState<string>("");

  useEffect(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setLink(`${base}/share?tripId=${encodeURIComponent(tripId)}`);
  }, [tripId]);

  return (
    <ModalShell title="Share Trip" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Anyone with this link can view your flipbook—no account needed.
        </p>

        <div className="rounded-xl border border-border p-3">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              className="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  alert("Copied.");
                } catch {}
              }}
            >
              Copy
            </button>
          </div>
        </div>

        <div className="card">
          <div className="font-semibold mb-1">No account? No worries.</div>
          <p className="text-sm text-muted-foreground">
            But if you want the coolest photo journaling app ever invented—we’re
            just sitting here looking cute, waiting for you to sign up. 😎
          </p>
          <div className="mt-3">
            <Link className="btn" href="/subscribe">
              Subscribe
            </Link>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
