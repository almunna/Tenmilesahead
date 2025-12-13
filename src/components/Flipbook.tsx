"use client";
import { collection, onSnapshot, orderBy, query, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState, useCallback, useRef } from "react";
import type { MediaItem, Trip } from "@/lib/types";

// Preload an image and return a promise
function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // Don't block on errors
    img.src = src;
  });
}

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

/** Fix legacy captions with typos (e.g., "Activitie" → "Activity") */
function fixCaption(caption: string | undefined | null): string {
  if (!caption) return "";
  return caption.replace(/\bActivitie\b/g, "Activity");
}

// Zoomable Image Viewer Component
function ZoomableImage({
  src,
  alt,
  onClose,
  tripInfo
}: {
  src: string;
  alt: string;
  onClose: () => void;
  tripInfo?: {
    name: string;
    location: string;
    dateRange: string;
  };
}) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const positionStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(Math.max(0.5, prev + delta), 5));
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    positionStart.current = position;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPosition({
      x: positionStart.current.x + dx,
      y: positionStart.current.y + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.5, 5));
  const zoomOut = () => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale <= 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  };
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Handle keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
      if (e.key === "0") resetZoom();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/95 flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 1}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all"
            title="Zoom Out (-)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <span className="text-white/70 text-sm min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            disabled={scale >= 5}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all"
            title="Zoom In (+)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </button>
          <button
            onClick={resetZoom}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all ml-2"
            title="Reset (0)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-sm">Close</span>
        </button>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center"
        onWheel={handleWheel}
        style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in" }}
        onClick={(e) => {
          if (scale <= 1 && e.target === e.currentTarget) {
            // Don't zoom on background click
          }
        }}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-none select-none transition-transform duration-100"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            maxHeight: scale === 1 ? "90vh" : "none",
            maxWidth: scale === 1 ? "90vw" : "none",
          }}
          draggable={false}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={(e) => {
            e.stopPropagation();
            if (scale === 1) zoomIn();
          }}
        />
      </div>

      {/* Trip info overlay for cover photo */}
      {tripInfo && (
        <div className="absolute bottom-16 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-4 text-white max-w-md">
            <h2 className="text-xl font-bold mb-2">{tripInfo.name}</h2>
            <div className="flex items-center gap-2 mb-1 text-white/90">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">{tripInfo.location}</span>
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">{tripInfo.dateRange}</span>
            </div>
          </div>
        </div>
      )}

      {/* Helper text */}
      <div className="text-center py-2 text-white/50 text-xs">
        {scale > 1 ? "Drag to pan • Scroll to zoom • Click outside or ESC to close" : "Click image to zoom • Scroll to zoom • ESC to close"}
      </div>
    </div>
  );
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
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ src: string; alt: string; tripInfo?: { name: string; location: string; dateRange: string } } | null>(null);

  // Swipe state
  const dragging = useRef(false);
  const startX = useRef(0);
  const deltaX = useRef(0);
  const deltaY = useRef(0);
  const swipeDirection = useRef<"horizontal" | "vertical" | null>(null);
  const SWIPE_THRESHOLD = 50;


  // Fetch trip data
  useEffect(() => {
    const tripRef = doc(db, "trips", tripId);
    const unsub = onSnapshot(tripRef, (snap) => {
      if (snap.exists()) {
        const tripData = { id: snap.id, ...(snap.data() as any) } as Trip;
        setTrip(tripData);
      }
    });
    return () => unsub();
  }, [tripId]);

  useEffect(() => {
    const q = query(
      collection(db, "trips", tripId, "media"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, async (snap) => {
      const arr: MediaItem[] = [];
      const docsToUpdate: { id: string; createdAt: number }[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        arr.push({ id: docSnap.id, ...data });

        // Collect docs that need takenAt backfilled
        if (data.takenAt === undefined && data.createdAt !== undefined) {
          docsToUpdate.push({ id: docSnap.id, createdAt: getMillis(data.createdAt) });
        }
      });

      // Backfill takenAt for legacy media (one-time migration per doc)
      // This ensures all photos use takenAt for sorting
      if (docsToUpdate.length > 0) {
        const { updateDoc, doc: docRef } = await import("firebase/firestore");
        for (const item of docsToUpdate) {
          try {
            await updateDoc(docRef(db, "trips", tripId, "media", item.id), {
              takenAt: item.createdAt
            });
          } catch (err) {
            // Silently ignore - user may not have write permission
          }
        }
      }

      // Sort chronologically by takenAt (if available) or createdAt (oldest first)
      // Use document ID as tiebreaker for stable sort when timestamps are equal
      arr.sort((a, b) => {
        const aWhen = getMillis((a as any).takenAt ?? (a as any).createdAt);
        const bWhen = getMillis((b as any).takenAt ?? (b as any).createdAt);
        if (aWhen !== bWhen) return aWhen - bWhen;
        // Stable sort: use ID as tiebreaker
        return (a.id || '').localeCompare(b.id || '');
      });
      setItems(arr);
      if (currentPage > arr.length) setCurrentPage(0);

      // Preload first few images for faster initial display
      const imagesToPreload = arr.slice(0, 5).filter(m => m.type === "image");
      imagesToPreload.forEach(m => preloadImage(m.downloadURL));
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // All photos in chronological order - no separate cover page
  const photoItems = items;

  // No artificial cover page - totalPages = number of photos
  const totalPages = photoItems.length;

  // Preload adjacent images when page changes
  useEffect(() => {
    if (photoItems.length === 0) return;

    // Preload next 2 and previous 1 images
    const indicesToPreload = [
      currentPage,
      currentPage + 1,
      currentPage + 2,
      currentPage - 1,
    ].filter(i => i >= 0 && i < photoItems.length);

    indicesToPreload.forEach(i => {
      const item = photoItems[i];
      if (item?.type === "image") {
        preloadImage(item.downloadURL);
      }
    });
  }, [currentPage, photoItems]);

  const goToPage = useCallback((newPage: number, direction: "next" | "prev") => {
    if (isFlipping) return;
    setIsFlipping(true);
    setFlipDirection(direction);

    // Reduced animation time from 500ms to 250ms for snappier feel
    setTimeout(() => {
      setCurrentPage(newPage);
      setIsFlipping(false);
      setFlipDirection(null);
    }, 250);
  }, [isFlipping]);

  const prev = useCallback(() => {
    const newPage = (currentPage - 1 + totalPages) % totalPages;
    goToPage(newPage, "prev");
  }, [currentPage, totalPages, goToPage]);

  const next = useCallback(() => {
    const newPage = (currentPage + 1) % totalPages;
    goToPage(newPage, "next");
  }, [currentPage, totalPages, goToPage]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open || zoomedImage) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next, onClose, zoomedImage]);

  // Track if this was a swipe or a tap (for mobile)
  const wasSwipe = useRef(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch handlers for swipe - better control on mobile
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (zoomedImage || isFlipping) return;
    const touch = e.touches[0];
    dragging.current = true;
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    deltaX.current = 0;
    deltaY.current = 0;
    swipeDirection.current = null;
    wasSwipe.current = false;
  };

  // Use native event listener for touchmove to allow preventDefault on non-passive listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragging.current || zoomedImage || isFlipping) return;
      const touch = e.touches[0];
      deltaX.current = touch.clientX - startX.current;
      deltaY.current = touch.clientY - startY.current;

      // Determine swipe direction on first significant movement
      if (swipeDirection.current === null) {
        const absX = Math.abs(deltaX.current);
        const absY = Math.abs(deltaY.current);
        if (absX > 10 || absY > 10) {
          swipeDirection.current = absX > absY ? "horizontal" : "vertical";
        }
      }

      // If horizontal swipe, prevent vertical scroll
      if (swipeDirection.current === "horizontal") {
        e.preventDefault();
        wasSwipe.current = true;
      }
    };

    // Add non-passive listener to allow preventDefault
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, [zoomedImage, isFlipping]);

  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragging.current || zoomedImage || isFlipping) return;
    dragging.current = false;

    // Only trigger navigation for horizontal swipes
    if (swipeDirection.current === "horizontal") {
      const dx = deltaX.current;
      if (dx <= -SWIPE_THRESHOLD && photoItems.length > 0) {
        next();
      } else if (dx >= SWIPE_THRESHOLD && photoItems.length > 0) {
        prev();
      }
    }

    deltaX.current = 0;
    deltaY.current = 0;
    swipeDirection.current = null;
  };

  // Mouse handlers for desktop
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomedImage || isFlipping) return;
    dragging.current = true;
    startX.current = e.clientX;
    startY.current = e.clientY;
    deltaX.current = 0;
    wasSwipe.current = false;
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging.current || zoomedImage || isFlipping) return;
    deltaX.current = e.clientX - startX.current;
    const dy = Math.abs(e.clientY - startY.current);
    if (Math.abs(deltaX.current) > 10 && Math.abs(deltaX.current) > dy) {
      wasSwipe.current = true;
    }
  };

  const onMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging.current || zoomedImage || isFlipping) return;
    dragging.current = false;

    const dx = deltaX.current;
    if (dx <= -SWIPE_THRESHOLD && photoItems.length > 0) {
      wasSwipe.current = true;
      next();
    } else if (dx >= SWIPE_THRESHOLD && photoItems.length > 0) {
      wasSwipe.current = true;
      prev();
    }
    deltaX.current = 0;
  };

  // Handle tap on image to zoom (only if not swiping)
  const handleImageTap = (e: React.MouseEvent, src: string, alt: string, tripInfo?: { name: string; location: string; dateRange: string }) => {
    // Small delay to check if this was a swipe
    setTimeout(() => {
      if (!wasSwipe.current) {
        openZoomedImage(src, alt, tripInfo);
      }
    }, 10);
  };

  // Open image in zoom viewer
  const openZoomedImage = (src: string, alt: string, tripInfo?: { name: string; location: string; dateRange: string }) => {
    setZoomedImage({ src, alt, tripInfo });
  };

  if (!open) return null;

  const locationStr = trip
    ? [trip.city, trip.state, trip.country].filter(Boolean).join(", ") || "—"
    : "";
  const dateRange = trip
    ? `${fmtMDY(trip.startDate)} → ${fmtMDY(trip.endDate)}`
    : "";

  // Direct indexing - no artificial cover page offset
  const currentMediaIndex = currentPage;
  const currentMedia = photoItems[currentMediaIndex];

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Zoomed Image Viewer */}
      {zoomedImage && (
        <ZoomableImage
          src={zoomedImage.src}
          alt={zoomedImage.alt}
          onClose={() => setZoomedImage(null)}
          tripInfo={zoomedImage.tripInfo}
        />
      )}

      {/* Ambient light effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-3 sm:px-6 py-2 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all backdrop-blur-sm border border-white/10"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-xs sm:text-sm font-medium">Close</span>
          </button>
          <h2 className="text-white/90 font-semibold text-lg hidden sm:block">
            {trip?.name || "Trip Flipbook"}
          </h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-white/60 text-xs sm:text-sm">
            {photoItems.length > 0 ? `${currentMediaIndex + 1} of ${photoItems.length}` : "No photos"}
          </span>
          <div className="hidden sm:flex gap-1">
            {Array.from({ length: Math.min(totalPages, 10) }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentPage ? "bg-primary w-6" : "bg-white/30 hover:bg-white/50"
                }`}
              />
            ))}
            {totalPages > 10 && <span className="text-white/40 text-xs ml-1">+{totalPages - 10}</span>}
          </div>
        </div>
      </div>

      {/* Main Book Container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center relative px-2 sm:px-4 py-2 sm:py-6"
        style={{ touchAction: "none" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { dragging.current = false; }}
      >
        {/* ========== MOBILE LAYOUT (single page, full screen) ========== */}
        <div className="md:hidden w-full h-full flex flex-col">
          <div
            className={`flex-1 bg-gradient-to-b from-[#f8f5f0] to-[#fdfcfa] rounded-xl overflow-hidden shadow-xl relative
              ${isFlipping ? "animate-fade" : ""}
            `}
          >
            {currentMedia ? (
              /* Mobile Photo Page */
              <div className="w-full h-full flex flex-col">
                {/* Photo - fills most of the space */}
                <div className="flex-1 flex items-center justify-center bg-slate-100 relative min-h-0">
                  {currentMedia.type === "image" ? (
                    <img
                      src={currentMedia.downloadURL}
                      alt={currentMedia.caption || ""}
                      className="max-w-full max-h-full object-contain"
                      draggable={false}
                      loading="eager"
                      decoding="async"
                    />
                  ) : (
                    <video
                      src={currentMedia.downloadURL}
                      className="max-w-full max-h-full object-contain"
                      controls
                      playsInline
                    />
                  )}
                  {/* Trip info overlay on first photo */}
                  {currentMediaIndex === 0 && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white pointer-events-none">
                        <h1 className="text-2xl font-bold mb-2 drop-shadow-lg">{trip?.name || "Trip"}</h1>
                        <div className="flex items-center gap-2 mb-1 text-white/90">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm">{locationStr}</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/80">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm">{dateRange}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {/* Caption - visible area at bottom (not shown on first photo with overlay) */}
                {currentMedia.caption && currentMediaIndex !== 0 && (
                  <div className="flex-shrink-0 bg-white/95 px-4 py-3 border-t border-slate-200">
                    <p className="text-sm text-slate-600 text-center">
                      {fixCaption(currentMedia.caption)}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                No photos yet
              </div>
            )}
          </div>
        </div>

        {/* ========== DESKTOP LAYOUT (two-page book) ========== */}
        <div className="hidden md:block relative w-full max-w-6xl xl:max-w-7xl max-h-[calc(100vh-220px)]">
          {/* Book Shadow */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[90%] h-16 bg-black/40 blur-2xl rounded-[50%]" />

          {/* Book Spine/Binding */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-8 z-20"
            style={{
              background: "linear-gradient(90deg, #1a1a2e 0%, #2d2d44 20%, #3d3d55 50%, #2d2d44 80%, #1a1a2e 100%)",
              borderRadius: "2px",
              boxShadow: "inset 0 0 10px rgba(0,0,0,0.5)"
            }}
          />

          {/* Pages Container */}
          <div className="relative flex">
            {/* Left Page */}
            <div
              className={`relative w-1/2 h-[min(calc(100vh-220px),75vw*0.75)] bg-gradient-to-l from-[#f8f5f0] to-[#f0ebe5] rounded-l-lg overflow-hidden shadow-xl
                ${isFlipping && flipDirection === "prev" ? "animate-flip-reverse" : ""}
              `}
              style={{
                transformOrigin: "right center",
                boxShadow: "inset -5px 0 20px rgba(0,0,0,0.1), -2px 0 5px rgba(0,0,0,0.1)",
              }}
            >
              {/* Paper texture overlay */}
              <div className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
                }}
              />

              {/* Page edge lines */}
              <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-black/10 to-transparent" />

              {currentMediaIndex > 0 ? (
                /* Previous Photo */
                <div className="w-full h-full p-4 flex flex-col">
                  <div
                    className="flex-1 flex items-center justify-center rounded-lg overflow-hidden bg-slate-100 relative min-h-0 cursor-zoom-in group"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (photoItems[currentMediaIndex - 1]?.type === "image") {
                        openZoomedImage(photoItems[currentMediaIndex - 1].downloadURL, photoItems[currentMediaIndex - 1].caption || "");
                      }
                    }}
                  >
                    {photoItems[currentMediaIndex - 1]?.type === "image" ? (
                      <>
                        <img
                          src={photoItems[currentMediaIndex - 1].downloadURL}
                          alt={photoItems[currentMediaIndex - 1].caption || ""}
                          className="max-w-full max-h-full object-contain"
                          draggable={false}
                          loading="eager"
                          decoding="async"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                            </svg>
                          </div>
                        </div>
                      </>
                    ) : photoItems[currentMediaIndex - 1] ? (
                      <video
                        src={photoItems[currentMediaIndex - 1].downloadURL}
                        className="max-w-full max-h-full object-contain"
                        muted
                        playsInline
                      />
                    ) : null}
                  </div>
                  {photoItems[currentMediaIndex - 1]?.caption && (
                    <p className="mt-2 text-xs text-slate-500 text-center italic line-clamp-2 flex-shrink-0">
                      {fixCaption(photoItems[currentMediaIndex - 1].caption)}
                    </p>
                  )}
                </div>
              ) : (
                /* First photo - show cover info on left */
                <div className="w-full h-full flex items-center justify-center p-8">
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-slate-700 mb-2">{trip?.name}</h3>
                    <p className="text-slate-500 text-sm">{locationStr}</p>
                    <p className="text-slate-400 text-xs mt-2">{dateRange}</p>
                    <div className="mt-6 w-16 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent mx-auto" />
                    <p className="mt-4 text-primary text-sm font-medium">
                      {items.length} Photos
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Page */}
            <div
              className={`relative w-1/2 h-[min(calc(100vh-220px),75vw*0.75)] bg-gradient-to-r from-[#f8f5f0] to-[#fdfcfa] rounded-r-lg overflow-hidden shadow-xl
                ${isFlipping && flipDirection === "next" ? "animate-flip" : ""}
              `}
              style={{
                transformOrigin: "left center",
                boxShadow: "inset 5px 0 20px rgba(0,0,0,0.05), 2px 0 5px rgba(0,0,0,0.1)",
              }}
            >
              {/* Paper texture overlay */}
              <div className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
                }}
              />

              {/* Page edge line */}
              <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-black/10 to-transparent" />

              {currentMedia ? (
                /* Current Photo */
                <div className="w-full h-full p-4 flex flex-col">
                  <div
                    className="flex-1 flex items-center justify-center rounded-lg overflow-hidden bg-slate-100 relative shadow-lg min-h-0 cursor-zoom-in group"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentMedia.type === "image") {
                        openZoomedImage(currentMedia.downloadURL, currentMedia.caption || "", currentMediaIndex === 0 ? {
                          name: trip?.name || "Trip",
                          location: locationStr,
                          dateRange: dateRange
                        } : undefined);
                      }
                    }}
                  >
                    {currentMedia.type === "image" ? (
                      <>
                        <img
                          src={currentMedia.downloadURL}
                          alt={currentMedia.caption || ""}
                          className="max-w-full max-h-full object-contain"
                          draggable={false}
                          loading="eager"
                          decoding="async"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3">
                            <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                            </svg>
                          </div>
                        </div>
                        {/* Trip info overlay on first photo */}
                        {currentMediaIndex === 0 && (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                            <div className="absolute bottom-0 left-0 right-0 p-4 text-white pointer-events-none">
                              <h1 className="text-xl font-bold mb-1 drop-shadow-lg">{trip?.name || "Trip"}</h1>
                              <div className="flex items-center gap-2 mb-1 text-white/90">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs">{locationStr}</span>
                              </div>
                              <div className="flex items-center gap-2 text-white/80">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs">{dateRange}</span>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <video
                        src={currentMedia.downloadURL}
                        className="max-w-full max-h-full object-contain"
                        controls
                      />
                    )}
                  </div>
                  {currentMedia.caption && currentMediaIndex !== 0 && (
                    <p className="mt-2 text-xs text-slate-500 text-center italic line-clamp-2 flex-shrink-0">
                      {fixCaption(currentMedia.caption)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  No photos yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        {totalPages > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={isFlipping}
              className="absolute left-1 sm:left-4 md:left-8 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-white/20 active:bg-white/40 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 z-30 group"
              style={{ touchAction: "manipulation" }}
            >
              <svg className="w-6 h-6 sm:w-6 sm:h-6 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={isFlipping}
              className="absolute right-1 sm:right-4 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-white/20 active:bg-white/40 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 z-30 group"
              style={{ touchAction: "manipulation" }}
            >
              <svg className="w-6 h-6 sm:w-6 sm:h-6 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Footer - Page thumbnails */}
      <div className="relative z-10 px-2 sm:px-6 py-2 sm:py-4 flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto">
        {photoItems.slice(0, 7).map((item, i) => (
          <button
            key={item.id}
            onClick={() => goToPage(i, currentPage > i ? "prev" : "next")}
            className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden border-2 transition-all ${
              currentPage === i ? "border-primary ring-2 ring-primary/30" : "border-white/20 hover:border-white/40"
            }`}
          >
            {item.type === "image" ? (
              <img src={item.downloadURL} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white/60" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        ))}
        {photoItems.length > 7 && (
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white/10 flex items-center justify-center text-white/60 text-xs border border-white/20">
            +{photoItems.length - 7}
          </div>
        )}
      </div>

      {/* Hint text */}
      {currentMedia?.type === "image" && (
        <div className="text-center pb-2 text-white/40 text-xs">
          <span className="hidden sm:inline">Click on photo to zoom and view full quality</span>
          <span className="sm:hidden">Swipe to navigate</span>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes flip {
          0% {
            transform: rotateY(0deg);
          }
          100% {
            transform: rotateY(-180deg);
          }
        }
        @keyframes flip-reverse {
          0% {
            transform: rotateY(0deg);
          }
          100% {
            transform: rotateY(180deg);
          }
        }
        @keyframes fade {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
          100% {
            opacity: 1;
          }
        }
        .animate-flip {
          animation: flip 0.25s ease-out;
        }
        .animate-flip-reverse {
          animation: flip-reverse 0.25s ease-out;
        }
        .animate-fade {
          animation: fade 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}
