"use client";
import { collection, onSnapshot, orderBy, query, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState, useCallback, useRef } from "react";
import type { MediaItem, Trip } from "@/lib/types";
import { classNames } from "@/lib/utils";

function getMillis(t: any): number {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t === "object" && typeof t.seconds === "number") {
    return t.seconds * 1000 + (t.nanoseconds ? t.nanoseconds / 1e6 : 0);
  }
  return 0;
}

function fmtMDY(s: string | undefined | null) {
  if (!s) return "";
  const str = typeof s === "string" ? s : String(s);

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;

  const m2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);
  if (m2) return str;

  return str;
}

export default function Flipbook({
  tripId,
  open,
  onClose,
}: {
  tripId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [index, setIndex] = useState(0);

  // --- swipe state ---
  const dragging = useRef(false);
  const startX = useRef(0);
  const deltaX = useRef(0);
  const SWIPE_THRESHOLD = 60; // px

  // Fetch trip data
  useEffect(() => {
    const tripRef = doc(db, "trips", tripId);
    const unsub = onSnapshot(tripRef, (snap) => {
      if (snap.exists()) {
        setTrip({ id: snap.id, ...(snap.data() as any) } as Trip);
      }
    });
    return () => unsub();
  }, [tripId]);

  useEffect(() => {
    const q = query(
      collection(db, "trips", tripId, "media"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr: MediaItem[] = [];
      snap.forEach((doc) => arr.push({ id: doc.id, ...(doc.data() as any) }));
      // Sort by takenAt (fallback createdAt) — latest first
      arr.sort((a, b) => {
        const aWhen = getMillis((a as any).takenAt ?? (a as any).createdAt);
        const bWhen = getMillis((b as any).takenAt ?? (b as any).createdAt);
        return bWhen - aWhen;
      });
      setItems(arr);
      // Reset to cover page (index 0) if current index is out of bounds
      if (index > arr.length) setIndex(0);
    });
    return () => unsub();
    // keep other behavior unchanged
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // Total pages = 1 cover + items.length media
  const totalPages = items.length + 1;

  const prev = useCallback(
    () => setIndex((i) => (i - 1 + totalPages) % totalPages),
    [totalPages]
  );
  const next = useCallback(
    () => setIndex((i) => (i + 1) % totalPages),
    [totalPages]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next, onClose]);

  // --- pointer handlers for swipe (mouse + touch) ---
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    startX.current = e.clientX;
    deltaX.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    deltaX.current = e.clientX - startX.current;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);

    const dx = deltaX.current;
    if (dx <= -SWIPE_THRESHOLD && items.length > 1) {
      // swipe left → next
      next();
    } else if (dx >= SWIPE_THRESHOLD && items.length > 1) {
      // swipe right → prev
      prev();
    }
    // otherwise, snap back (no-op; we didn't animate transform to keep behavior unchanged)
    deltaX.current = 0;
  };

  if (!open) return null;

  // Get cover media and location string
  const coverMedia = trip && items.find((m) => m.id === trip.coverMediaId);
  const locationStr = trip
    ? [trip.city, trip.state, trip.country].filter(Boolean).join(", ") || "—"
    : "";
  const dateRange = trip
    ? `${fmtMDY(trip.startDate)} → ${fmtMDY(trip.endDate)}`
    : "";

  // index 0 = cover, index 1+ = media items
  const isCoverPage = index === 0;
  const currentMediaIndex = index - 1;
  const currentMedia = items[currentMediaIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="text-sm">
          {isCoverPage ? "Cover" : `Photo ${currentMediaIndex + 1} of ${items.length}`}
        </div>
        <button
          className="rounded-lg px-3 py-1 bg-white/10 hover:bg-white/20"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        // enable horizontal swipe, allow vertical scrolling
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {isCoverPage ? (
          /* Cover Page - Image with text overlay */
          <div className="w-full h-full flex items-center justify-center p-4">
            <div className="relative w-full max-w-2xl aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
              {/* Background Image */}
              {coverMedia ? (
                coverMedia.type === "image" ? (
                  <img
                    src={coverMedia.downloadURL}
                    alt={trip?.name || "Cover"}
                    className="absolute inset-0 w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <video
                    src={coverMedia.downloadURL}
                    className="absolute inset-0 w-full h-full object-cover"
                    muted
                    playsInline
                  />
                )
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900" />
              )}

              {/* Dark gradient overlay at bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

              {/* Text overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <h1 className="text-3xl font-bold mb-3">{trip?.name || "Trip"}</h1>

                <div className="flex items-start gap-2 mb-2">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-base">{locationStr}</span>
                </div>

                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-base">{dateRange}</span>
                </div>
              </div>

              {/* Optional: Drag to reposition hint */}
              {coverMedia && (
                <div className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded bg-black/40 text-white/60">
                  Drag to reposition
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Media Pages */
          items.length === 0 ? (
            <div className="text-white/80">No media yet</div>
          ) : currentMedia ? (
            <div className="w-full h-full max-w-5xl flex items-center justify-center">
              {currentMedia.type === "image" ? (
                <img
                  src={currentMedia.downloadURL}
                  className="max-h-[80vh] max-w-full rounded-xl"
                  alt={currentMedia.caption || ""}
                  draggable={false}
                />
              ) : (
                <video
                  src={currentMedia.downloadURL}
                  className="max-h-[80vh] max-w-full rounded-xl"
                  controls
                />
              )}
            </div>
          ) : null
        )}

        {/* Navigation Arrows - show if we have cover + media OR multiple media */}
        {totalPages > 1 && (
          <>
            <button
              className={classNames(
                "absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2 pointer-events-auto z-10"
              )}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
            >
              ◀
            </button>
            <button
              className={classNames(
                "absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2 pointer-events-auto z-10"
              )}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
            >
              ▶
            </button>
          </>
        )}
      </div>

      {/* Caption - only show on media pages, not cover */}
      {!isCoverPage && currentMedia && (
        <div className="px-4 py-3 text-center text-white/80 text-sm">
          {currentMedia.caption || ""}
        </div>
      )}
    </div>
  );
}
