"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MediaItem } from "@/lib/types";

export default function ItemFlipbook({
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
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr: MediaItem[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as any;
        if (
          data.linkedId === linkedId &&
          data.linkedSubcollection === subcollection
        ) {
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
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-3">
      <div className="w-full max-w-5xl h-[75vh] flex flex-col rounded-2xl overflow-hidden bg-black/50">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 text-white bg-black/30">
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
            <div className="w-full h-full flex items-center justify-center p-4">
              {items[index].type === "image" ? (
                <img
                  src={items[index].downloadURL}
                  className="max-h-full max-w-full rounded-xl object-contain"
                  alt={items[index].caption || ""}
                  draggable={false}
                />
              ) : (
                <video
                  src={items[index].downloadURL}
                  className="max-h-full max-w-full rounded-xl"
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
          <div className="flex-shrink-0 px-4 py-3 text-center text-white/80 text-sm bg-black/30">
            {items[index].caption || ""}
          </div>
        )}
      </div>
    </div>
  );
}
