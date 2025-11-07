"use client";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState, useCallback, useRef } from "react";
import type { MediaItem } from "@/lib/types";
import { classNames } from "@/lib/utils";

function getMillis(t: any): number {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t === "object" && typeof t.seconds === "number") {
    return t.seconds * 1000 + (t.nanoseconds ? t.nanoseconds / 1e6 : 0);
  }
  return 0;
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
  const [index, setIndex] = useState(0);

  // --- swipe state ---
  const dragging = useRef(false);
  const startX = useRef(0);
  const deltaX = useRef(0);
  const SWIPE_THRESHOLD = 60; // px

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
      if (index >= arr.length) setIndex(0);
    });
    return () => unsub();
    // keep other behavior unchanged
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const prev = useCallback(
    () => setIndex((i) => (i - 1 + items.length) % items.length),
    [items.length]
  );
  const next = useCallback(
    () => setIndex((i) => (i + 1) % items.length),
    [items.length]
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
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="text-sm">
          Flipbook — {items.length} item{items.length === 1 ? "" : "s"}
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
        {items.length === 0 ? (
          <div className="text-white/80">No media yet</div>
        ) : (
          <div className="w-full h-full max-w-5xl flex items-center justify-center">
            {items[index].type === "image" ? (
              // Avoid next/image to keep token URLs simple
              <img
                src={items[index].downloadURL}
                className="max-h[80vh] max-w-full rounded-xl"
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
              className={classNames(
                "absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2"
              )}
              onClick={prev}
            >
              ◀
            </button>
            <button
              className={classNames(
                "absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2"
              )}
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
