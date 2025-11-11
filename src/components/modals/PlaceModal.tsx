"use client";

import { useState, useEffect } from "react";
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
import { COUNTRIES } from "@/lib/geo";
import ModalShell from "./ModalShell";
import ItemFlipbook from "./ItemFlipbook";

type WithId<T> = T & { id: string };

type SimplePlace = {
  id?: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  city?: string | null;
  state?: string | null;
  country: string;
  price?: number | null;
  priceUnit?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  websiteUrl?: string | null;
  notes?: string | null;
  review?: string | null;
  qualityRating?: number | null;
  valueRating?: number | null;
  serviceRating?: number | null;
  locationRating?: number | null;
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

export default function PlaceModal({
  title,
  tripId,
  subcollection,
  priceUnits,
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
  priceUnits: string[];
  extraLeft?: { key: string; label: string; options: string[] }[];
  extraRight?: { key: string; label: string; options: string[] }[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<WithId<SimplePlace>[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SimplePlace>({
    name: "",
    startDate: "",
    endDate: "",
    address: "",
    city: "",
    state: "",
    country: "",
    price: null,
    priceUnit: priceUnits[0],
    phoneNumber: "",
    websiteUrl: "",
    notes: "",
    review: "",
    qualityRating: null,
    valueRating: null,
    serviceRating: null,
    locationRating: null,
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
      const arr: WithId<SimplePlace>[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
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
      price: null,
      priceUnit: priceUnits[0],
      phoneNumber: "",
      websiteUrl: "",
      notes: "",
      review: "",
      qualityRating: null,
      valueRating: null,
      serviceRating: null,
      locationRating: null,
    });
    setFiles([]);
    setEditingId(null);
  }

  function editRow(r: WithId<SimplePlace>) {
    setEditingId(r.id!);
    setForm({
      name: r.name,
      startDate: r.startDate || "",
      endDate: r.endDate || "",
      address: r.address || "",
      city: r.city || "",
      state: r.state || "",
      country: r.country || "",
      price: r.price ?? null,
      priceUnit: r.priceUnit || priceUnits[0],
      phoneNumber: r.phoneNumber || "",
      websiteUrl: r.websiteUrl || "",
      notes: r.notes || "",
      review: r.review || "",
      qualityRating: r.qualityRating ?? null,
      valueRating: r.valueRating ?? null,
      serviceRating: r.serviceRating ?? null,
      locationRating: r.locationRating ?? null,
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
    <ModalShell title={title} onClose={onClose}>
      <div className="rounded-xl border border-border p-3">
        <div className="grid md:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-[1fr_minmax(120px,160px)] gap-2">
              <div>
                <label className="label">Price</label>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={form.price ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      price: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <label className="label">Unit</label>
                <select
                  className="input"
                  value={form.priceUnit || ""}
                  onChange={(e) =>
                    setForm({ ...form, priceUnit: e.target.value })
                  }
                >
                  {priceUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
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

        {/* Additional Fields */}
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Phone Number</label>
            <input
              className="input"
              type="tel"
              value={form.phoneNumber || ""}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="label">Website URL</label>
            <input
              className="input"
              type="url"
              value={form.websiteUrl || ""}
              onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
        </div>

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
                    onClick={() => setForm({ ...form, qualityRating: rating })}
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
                    onClick={() => setForm({ ...form, valueRating: rating })}
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
                    onClick={() => setForm({ ...form, serviceRating: rating })}
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
                    onClick={() => setForm({ ...form, locationRating: rating })}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <label className="label">Photos / Videos</label>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={onPick}
          />
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
          {editingId && (
            <button className="navlink" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
          <button className="navlink" onClick={onClose}>
            Close
          </button>
          <button className="btn" onClick={saveRow} disabled={!canSave()}>
            {editingId ? "Update" : "Add"}
          </button>
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
                    {r.price != null
                      ? ` • ${r.price} ${r.priceUnit || ""}`
                      : ""}
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
    </ModalShell>
  );
}
