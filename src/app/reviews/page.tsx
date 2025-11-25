// app/reviews/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Protected from "@/components/Protected";
import Link from "next/link";
import {
  collectionGroup,
  getDocs,
  query,
  orderBy,
  where,
  collection,
  doc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

// ----------------------------- Types & helpers ------------------------------
type ReviewKind = "activities" | "accommodations" | "restaurants";

type ReviewDoc = {
  id: string;
  __path: string; // full ref path for debugging
  tripId: string;
  ownerId?: string; // owner of the parent trip
  kind: ReviewKind;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country: string;
  price?: number | null;
  priceUnit?: string | null;
  createdAt?: number;
  updatedAt?: number;
};

type MediaItem = {
  id: string;
  downloadURL: string;
  type: "image" | "video";
  caption?: string;
  linkedSubcollection?: ReviewKind;
  linkedId?: string;
  createdAt?: number;
};

type TileKey = string; // `${kind}|${name}|${city}|${state}|${country}`

type PlaceTile = {
  key: TileKey;
  kind: ReviewKind;
  name: string;
  city: string;
  state: string;
  country: string;
  reviewCount: number;
  // A few thumbnails for the tile
  thumbs: Array<{ url: string; type: "image" | "video" }>;
  // For details modal
  reviews: ReviewDoc[];
};

const fmtMDY = (s?: string | number | null) => {
  if (!s) return "";
  if (typeof s === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  }
  const d = new Date(s as number);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}/${d.getFullYear()}`;
};

const KIND_LABEL: Record<ReviewKind, string> = {
  activities: "Activity",
  accommodations: "Accommodation",
  restaurants: "Restaurant",
};

const KIND_OPTIONS: { value: "" | ReviewKind; label: string }[] = [
  { value: "", label: "All Types" },
  { value: "activities", label: "Activities" },
  { value: "accommodations", label: "Accommodations" },
  { value: "restaurants", label: "Restaurants" },
];

// ------------------------------- Page root ---------------------------------
export default function ReviewsPage() {
  return (
    <Protected>
      <ReviewsInner />
    </Protected>
  );
}

// --------------------------------- App -------------------------------------
function ReviewsInner() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tiles, setTiles] = useState<PlaceTile[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [filterCity, setFilterCity] = useState("");
  const [filterKind, setFilterKind] = useState<"" | ReviewKind>("");

  const [openTile, setOpenTile] = useState<PlaceTile | null>(null);

  // Load & aggregate all reviews across users (collectionGroup)
  useEffect(() => {
    (async () => {
      setLoading(true);

      // Pull each review-kind via collection group query
      const kinds: ReviewKind[] = [
        "activities",
        "accommodations",
        "restaurants",
      ];

      // Fetch docs newest-first (by createdAt desc when present)
      const all: ReviewDoc[] = [];

      // Fetch trip owners to check ownership
      const tripOwners = new Map<string, string>();

      for (const kind of kinds) {
        // If you want strict ordering, not all docs will have createdAt, but it's okay.
        const qx = query(
          collectionGroup(db, kind),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(qx);

        for (const d of snap.docs) {
          const ref = d.ref;
          // parent chain: trips/{tripId}/{kind}/{docId}
          const parent = ref.parent; // {kind}
          const trip = parent?.parent; // trips/{tripId}
          const tripId = trip?.id || "";

          // Fetch trip owner if not already cached
          if (tripId && !tripOwners.has(tripId)) {
            try {
              const tripDoc = await getDoc(doc(db, "trips", tripId));
              if (tripDoc.exists()) {
                const tripData = tripDoc.data();
                tripOwners.set(tripId, tripData.ownerId || "");
              }
            } catch (e) {
              console.error(`Failed to fetch trip ${tripId}:`, e);
            }
          }

          const data = d.data() as any;
          const item: ReviewDoc = {
            id: d.id,
            __path: ref.path,
            tripId,
            ownerId: tripOwners.get(tripId),
            kind,
            name: data.name || "",
            startDate: data.startDate || null,
            endDate: data.endDate || null,
            address: data.address || null,
            city: data.city || "",
            state: data.state || "",
            country: data.country || "",
            price: data.price ?? null,
            priceUnit: data.priceUnit || null,
            createdAt: data.createdAt || undefined,
            updatedAt: data.updatedAt || undefined,
          };
          // Only include reviews with a country (per requirement) and a name
          if (item.name && item.country) {
            all.push(item);
          }
        }
      }

      // Distinct city list for filter (non-empty)
      const citySet = new Set(
        all
          .map((r) => (r.city || "").trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
      );
      setCities(Array.from(citySet));

      // Group by place identity
      const map = new Map<TileKey, PlaceTile>();
      for (const r of all) {
        const city = (r.city || "").trim();
        const state = (r.state || "").trim();
        const key: TileKey = `${
          r.kind
        }|${r.name.trim()}|${city}|${state}|${r.country.trim()}`;

        if (!map.has(key)) {
          map.set(key, {
            key,
            kind: r.kind,
            name: r.name.trim(),
            city,
            state,
            country: r.country.trim(),
            reviewCount: 0,
            thumbs: [],
            reviews: [],
          });
        }
        const t = map.get(key)!;
        t.reviewCount += 1;
        t.reviews.push(r);
      }

      // For each tile, fetch a few thumbnails from linked media (first 3)
      const tilesArr = Array.from(map.values());

      // We’ll grab up to 3 thumbnails per tile by iterating each review & taking the first media we find
      // (keeps requests reasonable and works well in practice)
      const thumbsTasks = tilesArr.map(async (tile) => {
        const out: PlaceTile = { ...tile, thumbs: [] };
        // loop until we have 3 thumbs or run out
        for (const r of tile.reviews) {
          if (out.thumbs.length >= 3) break;
          // Fetch media for this single review: collectionGroup("media") where
          // tripId == r.tripId AND linkedSubcollection == r.kind AND linkedId == r.id
          // (All these fields are set when you wrote media from PlaceModal)
          const qMedia = query(
            collectionGroup(db, "media"),
            where("tripId", "==", r.tripId),
            where("linkedSubcollection", "==", r.kind),
            where("linkedId", "==", r.id)
          );
          const ms = await getDocs(qMedia);
          for (const m of ms.docs) {
            const d = m.data() as any;
            if (
              d &&
              (d.type === "image" || d.type === "video") &&
              d.downloadURL
            ) {
              out.thumbs.push({ url: d.downloadURL, type: d.type });
              if (out.thumbs.length >= 3) break;
            }
          }
        }
        return out;
      });

      const withThumbs = await Promise.all(thumbsTasks);

      // Sort tiles: by review count desc, then name asc
      withThumbs.sort((a, b) => {
        if (b.reviewCount !== a.reviewCount)
          return b.reviewCount - a.reviewCount;
        return a.name.localeCompare(b.name);
      });

      setTiles(withThumbs);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return tiles.filter((t) => {
      if (filterKind && t.kind !== filterKind) return false;
      if (filterCity && t.city.toLowerCase() !== filterCity.toLowerCase())
        return false;
      return true;
    });
  }, [tiles, filterCity, filterKind]);

  return (
    <main className="container py-8 space-y-6">
      {/* Header row / nav */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Global Reviews</h1>
      </div>

      {/* Filters */}
      <section className="card">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label">Location (City)</label>
            {/* Use datalist so the user can start typing and pick from prepopulated cities */}
            <input
              list="city-list"
              className="input"
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              placeholder="Start typing a city…"
            />
            <datalist id="city-list">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div className="text-xs text-muted-foreground mt-1">
              Pick any city that appears in reviewers’ entries.
            </div>
          </div>

          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value as any)}
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              className="btn"
              onClick={() => {
                setFilterCity("");
                setFilterKind("");
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </section>

      {/* Tiles */}
      <section className="space-y-3">
        <div className="text-sm text-muted-foreground">
          {loading
            ? "Loading reviews…"
            : filtered.length
            ? `Showing ${filtered.length} place${
                filtered.length > 1 ? "s" : ""
              }`
            : "No results with these filters."}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <button
                key={t.key}
                className="card text-left hover:shadow-md transition-shadow"
                onClick={() => setOpenTile(t)}
              >
                {/* Thumbs row */}
                <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-haiti-800/5">
                  {t.thumbs.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      No photos yet
                    </div>
                  ) : t.thumbs.length === 1 ? (
                    <MediaThumb item={t.thumbs[0]} />
                  ) : (
                    <div className="grid grid-cols-3 gap-1 w-full h-full">
                      {t.thumbs.map((mi, idx) => (
                        <MediaThumb key={idx} item={mi} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-base line-clamp-1">
                      {t.name}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-haiti-800/5">
                      {KIND_LABEL[t.kind]}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {[t.city, t.state, t.country].filter(Boolean).join(", ")}
                  </div>
                  <div className="text-sm mt-1">
                    <span className="font-medium">{t.reviewCount}</span> review
                    {t.reviewCount > 1 ? "s" : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Detail modal */}
      {openTile && (
        <PlaceDetailModal
          tile={openTile}
          currentUserId={user?.uid}
          onClose={() => setOpenTile(null)}
          onReviewDeleted={() => {
            // Reload reviews after deletion
            window.location.reload();
          }}
        />
      )}
    </main>
  );
}

// ----------------------------- Subcomponents --------------------------------
function MediaThumb({
  item,
}: {
  item: { url: string; type: "image" | "video" };
}) {
  return item.type === "image" ? (
    <img
      src={item.url}
      alt=""
      className="w-full h-full object-cover"
      loading="lazy"
      decoding="async"
    />
  ) : (
    <video
      src={item.url}
      className="w-full h-full object-cover"
      muted
      playsInline
    />
  );
}

function PlaceDetailModal({
  tile,
  currentUserId,
  onClose,
  onReviewDeleted,
}: {
  tile: PlaceTile;
  currentUserId?: string;
  onClose: () => void;
  onReviewDeleted: () => void;
}) {
  const [rows, setRows] = useState<
    Array<
      ReviewDoc & {
        authorUsername?: string;
        media: MediaItem[];
      }
    >
  >([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (review: ReviewDoc) => {
    if (!confirm(`Delete this review for "${review.name}"?`)) return;

    try {
      setDeleting(review.id);
      // Delete the review document
      await deleteDoc(doc(db, "trips", review.tripId, review.kind, review.id));

      // Note: We're not deleting associated media here to preserve it in the trip's media collection
      // The media will remain linked but orphaned, which is safer for data integrity

      alert("Review deleted successfully!");
      onReviewDeleted();
    } catch (error) {
      console.error("Error deleting review:", error);
      alert("Failed to delete review. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (review: ReviewDoc) => {
    // Navigate to the trip detail page where they can edit the review
    window.location.href = `/trips/${review.tripId}`;
  };

  useEffect(() => {
    (async () => {
      // Load each review's author + its media
      const enriched: Array<
        ReviewDoc & { authorUsername?: string; media: MediaItem[] }
      > = [];

      for (const r of tile.reviews) {
        let authorUsername: string | undefined = undefined;

        // get trip to discover owner
        if (r.tripId) {
          const tripRef = doc(db, "trips", r.tripId);
          const tripSnap = await getDoc(tripRef);
          const tdata = tripSnap.data() as any;
          const ownerId = tdata?.ownerId;
          if (ownerId) {
            const uref = doc(db, "users", ownerId);
            const usnap = await getDoc(uref);
            const u = usnap.data() as any;
            authorUsername = u?.username || undefined;
          }
        }

        // get media for this review
        const qMedia = query(
          collectionGroup(db, "media"),
          where("tripId", "==", r.tripId),
          where("linkedSubcollection", "==", r.kind),
          where("linkedId", "==", r.id)
        );
        const ms = await getDocs(qMedia);
        const media: MediaItem[] = [];
        ms.forEach((m) => {
          const d = m.data() as any;
          if (d.downloadURL && (d.type === "image" || d.type === "video")) {
            media.push({
              id: m.id,
              downloadURL: d.downloadURL,
              type: d.type,
              caption: d.caption || "",
              linkedSubcollection: d.linkedSubcollection,
              linkedId: d.linkedId,
              createdAt: d.createdAt,
            });
          }
        });

        enriched.push({ ...r, authorUsername, media });
      }

      // Sort details by newest first (createdAt desc)
      enriched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setRows(enriched);
    })();
  }, [tile]);

  return (
    <div className="fixed inset-x-0 top-[60px] bottom-0 z-[100] bg-black/60 flex items-center justify-center p-3">
      <div className="w-full max-w-6xl max-h-[90vh] overflow-auto rounded-2xl bg-background shadow-xl border border-border">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur">
          <div className="space-y-0.5">
            <div className="font-semibold text-lg">{tile.name}</div>
            <div className="text-sm text-muted-foreground">
              {KIND_LABEL[tile.kind]} •{" "}
              {[tile.city, tile.state, tile.country].filter(Boolean).join(", ")}
            </div>
          </div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">
                  {r.authorUsername ? `@${r.authorUsername}` : "By traveler"}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-muted-foreground">
                    {fmtMDY(r.startDate)}
                    {r.endDate ? ` → ${fmtMDY(r.endDate)}` : ""}
                  </div>
                  {/* Show edit/delete buttons if current user owns this review */}
                  {currentUserId && r.ownerId === currentUserId && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(r)}
                        className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        title="Edit this review"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        disabled={deleting === r.id}
                        className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete this review"
                      >
                        {deleting === r.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-sm text-muted-foreground mt-1">
                {[r.address, r.city, r.state, r.country]
                  .filter(Boolean)
                  .join(", ") || "—"}
                {r.price != null
                  ? ` • ${r.price}${r.priceUnit ? ` ${r.priceUnit}` : ""}`
                  : ""}
              </div>

              {/* Media list: thumbnail left, caption right */}
              {r.media.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {r.media.map((m) => (
                    <li
                      key={m.id}
                      className="grid grid-cols-[120px_1fr] gap-3 rounded-lg border border-border p-2"
                    >
                      <div className="w-full h-24 rounded-md overflow-hidden bg-haiti-800/5">
                        {m.type === "image" ? (
                          <img
                            src={m.downloadURL}
                            alt={m.caption || ""}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <video
                            src={m.downloadURL}
                            className="w-full h-full object-cover"
                            controls
                            preload="metadata"
                          />
                        )}
                      </div>
                      <div className="text-sm leading-5">
                        {m.caption ? (
                          m.caption
                        ) : (
                          <span className="text-muted-foreground">
                            No notes
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">
                  No photos/videos.
                </div>
              )}
            </div>
          ))}

          {rows.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No reviews found.
            </div>
          )}

          <div className="pt-2 text-xs text-muted-foreground">
            Tip: Photos/videos here come from the entries’ uploads (Activities,
            Accommodations, Restaurants). All photos also appear in each trip’s
            flipbook.
          </div>
        </div>
      </div>
    </div>
  );
}
