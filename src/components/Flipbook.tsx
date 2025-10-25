"use client";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState, useCallback } from "react";
import type { MediaItem } from "@/lib/types";
import { classNames } from "@/lib/utils";

export default function Flipbook({ tripId, open, onClose }: { tripId: string; open: boolean; onClose: () => void; }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "trips", tripId, "media"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: MediaItem[] = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...(doc.data() as any) }));
      setItems(arr);
      if (index >= arr.length) setIndex(0);
    });
    return () => unsub();
  }, [tripId]);

  const prev = useCallback(() => setIndex(i => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setIndex(i => (i + 1) % items.length), [items.length]);

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

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="text-sm">Flipbook — {items.length} item{items.length === 1 ? "" : "s"}</div>
        <button className="rounded-lg px-3 py-1 bg-white/10 hover:bg-white/20" onClick={onClose}>Close</button>
      </div>
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {items.length === 0 ? (
          <div className="text-white/80">No media yet</div>
        ) : (
          <div className="w-full h-full max-w-5xl flex items-center justify-center">
            {items[index].type === "image" ? (
              // Avoid next/image to keep token URLs simple
              <img src={items[index].downloadURL} className="max-h-[80vh] max-w-full rounded-xl" alt={items[index].caption || ""} />
            ) : (
              <video src={items[index].downloadURL} className="max-h-[80vh] max-w-full rounded-xl" controls />
            )}
          </div>
        )}
        {items.length > 1 && (
          <>
            <button className={classNames(
              "absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2")}
              onClick={prev}>◀</button>
            <button className={classNames(
              "absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full px-4 py-2")}
              onClick={next}>▶</button>
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
