"use client";

import { useMemo, useState, useEffect } from "react";
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
import type { Trip, MediaItem } from "@/lib/types";
import Link from "next/link";
import { COUNTRIES } from "@/lib/geo";

type WithId<T> = T & { id: string };

export default function MyTrips({
  trips,
  onOpenFlip,
}: {
  trips: WithId<Trip>[];
  onOpenFlip: (tripId: string) => void;
}) {
  const [collapsedTrips, setCollapsedTrips] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredTrips = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() : null;
    return trips.filter((t) => {
      const s = new Date(t.startDate).getTime();
      const e = new Date(t.endDate).getTime();
      if (from && e < from) return false;
      if (to && s > to) return false;
      return true;
    });
  }, [trips, dateFrom, dateTo]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Trips</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">From</label>
            <input
              type="date"
              className="input h-9"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">To</label>
            <input
              type="date"
              className="input h-9"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <button
            className="navlink"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear
          </button>
          <button
            className="btn"
            onClick={() => setCollapsedTrips((v) => !v)}
            aria-expanded={!collapsedTrips}
          >
            {collapsedTrips ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>

      {!collapsedTrips && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTrips.map((t) => (
            <TripTile key={t.id} trip={t} onOpenFlip={() => onOpenFlip(t.id)} />
          ))}
          {filteredTrips.length === 0 && (
            <div className="text-muted-foreground">No trips in this range.</div>
          )}
        </div>
      )}
    </section>
  );
}

/* --------------------------- Local helpers/components --------------------------- */

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

function TripTile({
  trip,
  onOpenFlip,
}: {
  trip: WithId<Trip>;
  onOpenFlip: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cover, setCover] = useState<MediaItem | null>(null);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  const [photosOpen, setPhotosOpen] = useState(false);
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [accommodationsOpen, setAccommodationsOpen] = useState(false);
  const [restaurantsOpen, setRestaurantsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // cover fetch
  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, "trips", trip.id, "media"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        let chosen: MediaItem | null = null;
        const arr: MediaItem[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        if (trip.coverMediaId) {
          chosen = arr.find((m) => m.id === trip.coverMediaId) || null;
        } else {
          chosen = arr.find((m) => m.type === "image") || null;
        }
        setCover(chosen);
      }
    );
    return () => unsub();
  }, [trip.id, trip.coverMediaId]);

  async function deleteTrip() {
    if (!confirm("Delete this entire trip? This cannot be undone.")) return;
    await deleteDoc(doc(db, "trips", trip.id));
  }

  return (
    <>
      <div className="card overflow-hidden relative">
        {/* menu */}
        <div className="absolute top-2 right-2 z-10">
          <button
            type="button"
            className="h-8 w-8 rounded-full bg-surface/90 border border-border flex items-center justify-center text-muted-foreground hover:bg-surface"
            aria-label="More actions"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-40 rounded-md border border-border bg-surface shadow-md text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="block w-full text-left px-3 py-2 hover:bg-haiti-800/5"
                onClick={() => {
                  setEditingTrip(trip as Trip);
                  setMenuOpen(false);
                }}
              >
                Edit trip info
              </button>
              <button
                type="button"
                className="block w-full text-left px-3 py-2 hover:bg-haiti-800/5 text-red-600"
                onClick={deleteTrip}
              >
                Delete trip
              </button>
            </div>
          )}
        </div>

        {/* cover */}
        <div className="aspect-[16/9] w-full bg-haiti-800/5 overflow-hidden">
          {cover?.type === "image" ? (
            <img
              src={cover.downloadURL}
              alt={cover.caption || trip.name}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : cover?.type === "video" ? (
            <video
              src={cover.downloadURL}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              No cover yet
            </div>
          )}
        </div>

        {/* body */}
        <div className="p-4 space-y-2" onClick={() => setMenuOpen(false)}>
          <div className="flex items-start justify-between gap-3">
            <div className="font-semibold text-base line-clamp-1">
              {trip.name}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-haiti-800/5">
              {trip.transportationType || "—"}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {trip.city || "—"}
            {trip.state ? `, ${trip.state}` : ""}
            {trip.country ? `, ${trip.country}` : ""}
          </div>
          <div className="text-sm text-foreground">
            {fmtMDY(trip.startDate)} → {fmtMDY(trip.endDate)}
          </div>

          <div className="pt-3 flex flex-wrap items-center gap-2">
            <button className="btn" onClick={onOpenFlip}>
              View Trip
            </button>
            <button
              className="navlink"
              onClick={() => setPhotosOpen(true)}
              title="Photos"
            >
              📷 Photos
            </button>
            <button
              className="navlink"
              onClick={() => setItineraryOpen(true)}
              title="Itinerary"
            >
              🗓️ Itinerary
            </button>
            <button
              className="navlink"
              onClick={() => setDestinationsOpen(true)}
              title="Destinations"
            >
              📍 Destinations
            </button>
            <button
              className="navlink"
              onClick={() => setActivitiesOpen(true)}
              title="Activities"
            >
              🎟️ Activities
            </button>
            <button
              className="navlink"
              onClick={() => setAccommodationsOpen(true)}
              title="Accommodations"
            >
              🏨 Accommodations
            </button>
            <button
              className="navlink"
              onClick={() => setRestaurantsOpen(true)}
              title="Restaurants"
            >
              🍽️ Restaurants
            </button>
            <button
              className="navlink"
              onClick={() => setShareOpen(true)}
              title="Share link"
            >
              🔗 Share
            </button>
          </div>
        </div>
      </div>

      {/* lightweight inline modals (unchanged functionality, scoped here) */}
      {editingTrip && (
        // Lazy import avoided to keep parity; reuse your existing component if desired
        <InlineEditTripModal
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
        />
      )}

      {photosOpen && (
        <PhotosModal tripId={trip.id} onClose={() => setPhotosOpen(false)} />
      )}
      {itineraryOpen && (
        <ItineraryModal
          tripId={trip.id}
          onClose={() => setItineraryOpen(false)}
        />
      )}
      {destinationsOpen && (
        <PlaceModal
          title="Destinations"
          tripId={trip.id}
          subcollection="destinations"
          priceUnits={["Per Person", "Per Couple", "Per Group", "Total"]}
          extraLeft={[
            {
              key: "transportationType",
              label: "Mode of Transportation",
              options: [
                "Bicycle",
                "Bus",
                "Car",
                "Cruise",
                "Ferry/Boat",
                "Flight",
                "Train",
                "Walking",
                "Other",
              ],
            },
          ]}
          extraRight={[
            {
              key: "accommodationType",
              label: "Accommodation Type",
              options: [
                "Apartment / Airbnb",
                "Camping",
                "Cruise",
                "Friend/Family",
                "Guesthouse",
                "Hostel",
                "Hotel",
                "Resort",
                "Other",
              ],
            },
          ]}
          onClose={() => setDestinationsOpen(false)}
        />
      )}
      {activitiesOpen && (
        <PlaceModal
          title="Activities"
          tripId={trip.id}
          subcollection="activities"
          priceUnits={["Per User", "Per Couple", "Per Group"]}
          onClose={() => setActivitiesOpen(false)}
        />
      )}
      {accommodationsOpen && (
        <PlaceModal
          title="Accommodations"
          tripId={trip.id}
          subcollection="accommodations"
          priceUnits={["Per Night", "Total Stay"]}
          onClose={() => setAccommodationsOpen(false)}
        />
      )}
      {restaurantsOpen && (
        <PlaceModal
          title="Restaurants"
          tripId={trip.id}
          subcollection="restaurants"
          priceUnits={["Per Person", "Per Couple"]}
          onClose={() => setRestaurantsOpen(false)}
        />
      )}
      {shareOpen && (
        <ShareTripModal tripId={trip.id} onClose={() => setShareOpen(false)} />
      )}
    </>
  );
}

/* ------------------------- Inline modals (scoped) ------------------------- */

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-auto rounded-2xl bg-background shadow-xl border border-border">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur">
          <div className="font-semibold">{title}</div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// Minimal “edit trip” placeholder — use your existing EditTripModal if you prefer.
// Kept to preserve original behavior/location for this refactor.
function InlineEditTripModal({
  trip,
  onClose,
}: {
  trip: Trip;
  onClose: () => void;
}) {
  return (
    <ModalShell title="Edit trip info" onClose={onClose}>
      <div className="text-sm text-muted-foreground">
        Use your existing EditTripModal here.
      </div>
      <div className="mt-3">
        <button className="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </ModalShell>
  );
}

function PhotosModal({
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
    <ModalShell title="Photos" onClose={onClose}>
      <div className="space-y-3">
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={onPick}
        />
        {files.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No media selected.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((f) => {
              const k = fileKey(f);
              const url = previews[k];
              const isImage = f.type.startsWith("image/");
              return (
                <div key={k} className="card space-y-2">
                  <div className="w-full h-56 rounded-xl overflow-hidden bg-haiti-800/5">
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
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className={
                        coverKey === k
                          ? "text-sm text-green-600"
                          : "text-sm link"
                      }
                      onClick={() => setCoverKey(k)}
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
                      className="input h-auto min-h-[44px]"
                      rows={1}
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
        <div className="pt-2 flex justify-end gap-2">
          <button className="navlink" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={save}
            disabled={saving || files.length === 0}
          >
            {saving ? "Saving..." : "Save Photos"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ItineraryModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Array<{ kind: string; subcollection: string; data: any }>>([]);
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; subcollection: string } | null>(null);

  useEffect(() => {
    (async () => {
      const rows: Array<{ kind: string; subcollection: string; data: any }> = [];
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
      <ModalShell title="Itinerary (chronological summary)" onClose={onClose}>
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
                <th className="px-3 py-2 text-left">Price</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => {
                const d = row.data;
                return (
                  <tr key={i} className="border-t border-border hover:bg-surface/50">
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
                      {d.price != null ? `${d.price} ${d.priceUnit || ""}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        className="text-xs navlink"
                        onClick={() => setSelectedItem({ id: d.id, name: d.name, subcollection: row.subcollection })}
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
                    colSpan={6}
                    className="px-3 py-4 text-center text-muted-foreground"
                  >
                    No entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ModalShell>

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
  createdAt?: number;
  updatedAt?: number;
};

function PlaceModal({
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
  });
  const [itemFlipbookOpen, setItemFlipbookOpen] = useState<{ id: string; name: string } | null>(null);

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
      ...(extraLeft.reduce((acc, ex) => ({ ...acc, [ex.key]: (r as any)[ex.key] || "" }), {})),
      ...(extraRight.reduce((acc, ex) => ({ ...acc, [ex.key]: (r as any)[ex.key] || "" }), {})),
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
            <div
              key={r.id}
              className="rounded-xl border border-border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-muted-foreground">
                    {fmtMDY(r.startDate)}
                    {r.endDate ? ` → ${fmtMDY(r.endDate)}` : ""} •{" "}
                    {[r.address, r.city, r.state, r.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                    {r.price != null ? ` • ${r.price} ${r.priceUnit || ""}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-sm navlink"
                    onClick={() => setItemFlipbookOpen({ id: r.id!, name: r.name })}
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

function ItemFlipbook({
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
      snap.forEach((doc) => {
        const data = doc.data() as any;
        if (data.linkedId === linkedId && data.linkedSubcollection === subcollection) {
          arr.push({ id: doc.id, ...data });
        }
      });
      setItems(arr);
      if (index >= arr.length) setIndex(0);
    });
    return () => unsub();
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
  }, [items.length]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="text-sm">
          {itemName} — {items.length} item{items.length === 1 ? "" : "s"}
        </div>
        <button
          className="rounded-lg px-3 py-1 bg-white/10 hover:bg-white/20"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {items.length === 0 ? (
          <div className="text-white/80">No media for this item yet</div>
        ) : (
          <div className="w-full h-full max-w-5xl flex items-center justify-center">
            {items[index].type === "image" ? (
              <img
                src={items[index].downloadURL}
                className="max-h-[80vh] max-w-full rounded-xl"
                alt={items[index].caption || ""}
                draggable={false}
              />
            ) : (
              <video
                src={items[index].downloadURL}
                className="max-h-[80vh] max-w-full rounded-xl"
                controls
              />
            )}
          </div>
        )}

        {items.length > 1 && (
          <>
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2"
              onClick={prev}
            >
              ◀
            </button>
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2"
              onClick={next}
            >
              ▶
            </button>
          </>
        )}
      </div>

      {items.length > 0 && (
        <div className="px-4 py-3 text-center text-white/80 text-sm">
          {items[index].caption || ""}
        </div>
      )}
    </div>
  );
}

function ShareTripModal({
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
      <p className="text-sm">
        Anyone with this link can view your flipbook—no account needed.
      </p>
      <div className="mt-3 flex gap-2">
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

      <div className="mt-6 rounded-xl border border-border p-4 text-sm bg-haiti-800/5">
        <div className="font-semibold mb-2">No account? No worries.</div>
        <p>
          But if you want the coolest photo journaling app ever invented— we’re
          just sitting here looking cute, waiting for you to sign up. 😎
        </p>
        <div className="mt-3">
          <Link className="btn" href="/subscribe">
            Subscribe
          </Link>
        </div>
      </div>
    </ModalShell>
  );
}
