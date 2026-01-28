// File: app/trips/[tripId]/page.tsx
"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  orderBy,
  query,
  deleteDoc,
} from "firebase/firestore";
import type { Trip, MediaItem } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import Protected from "@/components/Protected";
import SubscriptionRequiredModal from "@/components/SubscriptionRequiredModal";
import Uploader from "@/components/Uploader";
import Flipbook from "@/components/Flipbook";
import EditTripModal from "@/components/EditTripModal";
import TripDetailMap from "@/components/TripDetailMap";
import Link from "next/link";
import Image from "next/image";

/* Helpers */
function fmtMDY(s: string | undefined | null) {
  if (!s) return "";
  const str = typeof s === "string" ? s : String(s);

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;

  const m2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);
  if (m2) return str;

  return str;
}

function getMillis(t: any): number {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t === "object" && typeof t.seconds === "number") {
    return t.seconds * 1000 + (t.nanoseconds ? t.nanoseconds / 1e6 : 0);
  }
  return 0;
}

/** Auto-size helper for textareas (shows full caption immediately) */
function autoSizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/** Fix legacy captions with typos (e.g., "Activitie" → "Activity") */
function fixCaption(caption: string | undefined | null): string {
  if (!caption) return "";
  return caption.replace(/\bActivitie\b/g, "Activity");
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
  country: string;
  address?: string | null;
  phoneNumber?: string | null;
  websiteUrl?: string | null;
  notes?: string | null;
  review?: string | null;
  qualityRating?: number | null;
  valueRating?: number | null;
  serviceRating?: number | null;
  locationRating?: number | null;
  // Cruise-specific fields
  cruiseLine?: string | null;
  shipName?: string | null;
  foodRating?: number | null;
  entertainmentRating?: number | null;
  transportationMode?: string | null;
  createdAt?: number;
  updatedAt?: number;
  // optional extras (transportationType/accommodationType, etc.)
  [key: string]: any;
};

/** Transportation mode icon component */
function TransportIcon({ mode }: { mode: string }) {
  const iconClass = "w-4 h-4 inline-block";

  switch (mode) {
    case "Airplane":
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>
      );
    case "Boat/Ferry":
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
        </svg>
      );
    case "Bus":
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
        </svg>
      );
    case "Car":
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      );
    case "Cruise":
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
        </svg>
      );
    case "RV":
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M18 4h-5V1h-2v3H6c-1.1 0-2 .9-2 2v8h1c0 1.66 1.34 3 3 3s3-1.34 3-3h4c0 1.66 1.34 3 3 3s3-1.34 3-3h1V8l-4-4zm-6 2h3l2 2h-5V6zM8 15c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm10 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
        </svg>
      );
    case "Taxi/Rideshare":
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H15V3H9v2H6.5c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      );
    case "Train":
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
      );
    case "Walk":
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8"/>
        </svg>
      );
  }
}

/** Format phone number to (555) 123-1234 format */
function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Format based on length
  if (cleaned.length === 10) {
    // US format: (555) 123-1234
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    // US format with country code: (555) 123-1234
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length > 10) {
    // International format: +XX XXX XXX XXXX
    return phoneNumber; // Return as-is for international numbers
  }

  // If it doesn't match expected formats, return as-is
  return phoneNumber;
}

/** Reusable component to display a place with all its fields */
function PlaceCard({
  item,
  subcollection,
  onViewPhotos,
}: {
  item: WithId<SimplePlace>;
  subcollection:
    | "destinations"
    | "activities"
    | "accommodations"
    | "restaurants"
    | "cruises";
  onViewPhotos: () => void;
}) {
  const isCruise = subcollection === "cruises";
  const loc = item.onShip
    ? "On Ship"
    : [item.address, item.city, item.state, item.country]
        .filter(Boolean)
        .join(", ");

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      {/* Header: name + dates + location */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base break-words">{item.name}</div>
          {/* Cruise Line and Ship Name for cruises */}
          {isCruise && (item.cruiseLine || item.shipName) && (
            <div className="text-sm text-foreground break-words">
              {item.cruiseLine && <span>{item.cruiseLine}</span>}
              {item.cruiseLine && item.shipName && <span> • </span>}
              {item.shipName && <span>{item.shipName}</span>}
            </div>
          )}
          <div className="text-sm text-muted-foreground break-words">
            {fmtMDY(item.startDate)}
            {item.endDate ? ` → ${fmtMDY(item.endDate)}` : ""}
            {loc && ` • ${loc}`}
          </div>
        </div>
        <button className="text-sm navlink whitespace-nowrap flex-shrink-0" onClick={onViewPhotos}>
          View Photos
        </button>
      </div>

      {/* Transportation Mode */}
      {item.transportationMode && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Transport:</span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-haiti-800/5 text-foreground">
            <TransportIcon mode={item.transportationMode} />
            {item.transportationMode}
          </span>
        </div>
      )}

      {/* Contact Info */}
      {(item.phoneNumber || item.websiteUrl) && (
        <div className="text-sm space-y-1">
          {item.phoneNumber && (
            <div className="flex gap-2">
              <span className="text-muted-foreground">Phone:</span>
              <a href={`tel:${item.phoneNumber}`} className="link">
                {formatPhoneNumber(item.phoneNumber)}
              </a>
            </div>
          )}
          {item.websiteUrl && (
            <div className="flex gap-2">
              <span className="text-muted-foreground flex-shrink-0">Website:</span>
              <a
                href={item.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link break-all"
              >
                {item.websiteUrl}
              </a>
            </div>
          )}
        </div>
      )}


      {/* Star Ratings */}
      {(item.qualityRating != null ||
        item.valueRating != null ||
        item.serviceRating != null ||
        item.locationRating != null ||
        item.foodRating != null ||
        item.entertainmentRating != null) && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {item.qualityRating != null && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Quality:</span>
              <div className="flex gap-0.5 text-yellow-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={
                      star <= item.qualityRating! ? "" : "text-gray-300"
                    }
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
          )}
          {item.valueRating != null && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Value:</span>
              <div className="flex gap-0.5 text-yellow-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={star <= item.valueRating! ? "" : "text-gray-300"}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
          )}
          {item.serviceRating != null && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Service:</span>
              <div className="flex gap-0.5 text-yellow-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={
                      star <= item.serviceRating! ? "" : "text-gray-300"
                    }
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
          )}
          {item.locationRating != null && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Location:</span>
              <div className="flex gap-0.5 text-yellow-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={
                      star <= item.locationRating! ? "" : "text-gray-300"
                    }
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Cruise-specific ratings */}
          {item.foodRating != null && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Food:</span>
              <div className="flex gap-0.5 text-yellow-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={
                      star <= item.foodRating! ? "" : "text-gray-300"
                    }
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
          )}
          {item.entertainmentRating != null && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Entertainment:</span>
              <div className="flex gap-0.5 text-yellow-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={
                      star <= item.entertainmentRating! ? "" : "text-gray-300"
                    }
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {item.notes && (
        <div className="text-sm">
          <div className="text-muted-foreground font-medium mb-1">Notes:</div>
          <p className="whitespace-pre-wrap break-words">{item.notes}</p>
        </div>
      )}

      {/* Review */}
      {item.review && (
        <div className="text-sm">
          <div className="text-muted-foreground font-medium mb-1">Review:</div>
          <p className="whitespace-pre-wrap break-words">{item.review}</p>
        </div>
      )}
    </div>
  );
}

export default function TripPage() {
  return (
    <Protected>
      <TripInner />
    </Protected>
  );
}

function TripInner() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId;
  const router = useRouter();
  const { user, profile } = useAuth();

  // Check if user has an active subscription
  const subscription = profile?.subscription;
  const isSubscribed =
    (subscription?.status === "active" || subscription?.status === "trialing") &&
    !subscription?.cancelAtPeriodEnd;

  // Show subscription required modal if not subscribed
  if (!isSubscribed) {
    return (
      <SubscriptionRequiredModal
        title="Trip Details"
        description="Access to trip details requires an active subscription."
      />
    );
  }

  const [trip, setTrip] = useState<Trip | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [openFlip, setOpenFlip] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // cover position state (percent, 0–100; default 50 = center)
  const [coverPosY, setCoverPosY] = useState<number>(50);
  const draggingRef = useRef(false);
  const [mobileDragEnabled, setMobileDragEnabled] = useState(false);

  // uploader visibility & auto-hide after upload completes
  const [showUploader, setShowUploader] = useState(true);
  const prevMediaCount = useRef<number>(0);

  // ---- NEW: Subcollections for itinerary & lists ----
  const [destinations, setDestinations] = useState<WithId<SimplePlace>[]>([]);
  const [activities, setActivities] = useState<WithId<SimplePlace>[]>([]);
  const [accommodations, setAccommodations] = useState<WithId<SimplePlace>[]>(
    []
  );
  const [restaurants, setRestaurants] = useState<WithId<SimplePlace>[]>([]);
  const [cruises, setCruises] = useState<WithId<SimplePlace>[]>([]);

  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    name: string;
    subcollection:
      | "destinations"
      | "activities"
      | "accommodations"
      | "restaurants"
      | "cruises";
  } | null>(null);
  // ---- END NEW ----

  // Derived helpers
  const coverMedia = useMemo(
    () => (trip ? media.find((m) => m.id === trip.coverMediaId) : undefined),
    [media, trip]
  );

  const locationStr = useMemo(() => {
    if (!trip) return "";
    const cityState = trip.city
      ? `${trip.city}${trip.state ? ", " + trip.state : ""}`
      : "";
    if (trip.country)
      return cityState ? `${cityState}, ${trip.country}` : trip.country;
    return cityState || "—";
  }, [trip]);

  const dateRange = trip
    ? `${fmtMDY(trip.startDate)} → ${fmtMDY(trip.endDate)}`
    : "";

  // Extract unique transportation and accommodation types
  const uniqueTypes = useMemo(() => {
    const transportationTypes = new Set<string>();
    const accommodationTypes = new Set<string>();

    // Check accommodations subcollection for both transportation and accommodation types
    accommodations.forEach((acc) => {
      if (acc.transportationType && typeof acc.transportationType === 'string') {
        transportationTypes.add(acc.transportationType);
      }
      if (acc.accommodationType && typeof acc.accommodationType === 'string') {
        accommodationTypes.add(acc.accommodationType);
      }
    });

    return {
      transportation: Array.from(transportationTypes),
      accommodation: Array.from(accommodationTypes),
    };
  }, [accommodations]);

  // Keep cover position in sync with doc
  useEffect(() => {
    if (trip && typeof (trip as any).coverPositionY === "number") {
      setCoverPosY((trip as any).coverPositionY as number);
    } else {
      setCoverPosY(50);
    }
  }, [trip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen to the trip doc
  useEffect(() => {
    if (!tripId || !user) return;

    const ref = doc(db, "trips", tripId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setError("Trip not found or you don't have access.");
          setTrip(null);
          return;
        }
        const data = { id: snap.id, ...(snap.data() as any) } as Trip;
        if (data.ownerId !== user.uid) {
          setError("You don't have permission to view this trip.");
          setTrip(null);
          return;
        }
        setError(null);
        setTrip(data);
      },
      (err) => {
        setError(err.message || "Failed to load trip.");
        setTrip(null);
      }
    );

    return () => unsub();
  }, [tripId, user]);

  // Listen to media (LATEST FIRST)
  useEffect(() => {
    if (!tripId || !user) return;

    const qx = query(
      collection(db, "trips", tripId, "media"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      qx,
      (snap) => {
        const arr: MediaItem[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setMedia(arr);
      },
      (err) => {
        setError(err.message || "Failed to load media.");
        setMedia([]);
      }
    );

    return () => unsub();
  }, [tripId, user]);

  // Auto-hide uploader after a successful upload
  useEffect(() => {
    const prev = prevMediaCount.current;
    if (showUploader && media.length > prev) {
      setShowUploader(false);
    }
    prevMediaCount.current = media.length;
  }, [media.length, showUploader]);

  async function setCover(mid: string) {
    if (!trip) return;
    await updateDoc(doc(db, "trips", trip.id!), {
      coverMediaId: mid,
      updatedAt: Date.now(),
    });
    setTrip({ ...trip, coverMediaId: mid });
  }

  async function saveCaption(mid: string, caption: string) {
    await updateDoc(doc(db, "trips", tripId, "media", mid), { caption });
  }

  async function deleteMedia(mid: string) {
    await deleteDoc(doc(db, "trips", tripId, "media", mid));
  }

  // cover dragging handlers
  function onCoverPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // On touch devices, only allow drag if mobileDragEnabled is true
    const isTouchEvent = e.pointerType === "touch";
    if (isTouchEvent && !mobileDragEnabled) return;

    draggingRef.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    onCoverPointerMove(e);
  }
  async function onCoverPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setMobileDragEnabled(false);
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    if (trip?.id) {
      await updateDoc(doc(db, "trips", trip.id), {
        coverPositionY: coverPosY,
        updatedAt: Date.now(),
      } as any);
    }
  }
  function onCoverPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const box = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const y = e.clientY - box.top;
    const pct = Math.max(0, Math.min(100, (y / box.height) * 100));
    setCoverPosY(pct);
  }

  // chronological order (oldest first) - cover is already shown in hero section
  const sortedMedia = useMemo(() => {
    const arr = media.filter((m) => m.type === "image" || m.type === "video");
    // Sort chronologically by takenAt (if available) or createdAt
    // Use document ID as tiebreaker for stable sort when timestamps are equal
    arr.sort((a, b) => {
      const aWhen = getMillis((a as any).takenAt ?? a.createdAt);
      const bWhen = getMillis((b as any).takenAt ?? b.createdAt);
      if (aWhen !== bWhen) return aWhen - bWhen;
      // Stable sort: use ID as tiebreaker
      return (a.id || '').localeCompare(b.id || '');
    });
    return arr;
  }, [media]);

  // Documents (PDFs and other files)
  const sortedDocuments = useMemo(() => {
    const arr = media.filter((m) => m.type === "document");
    // Sort chronologically by createdAt
    arr.sort((a, b) => {
      const aWhen = getMillis(a.createdAt);
      const bWhen = getMillis(b.createdAt);
      if (aWhen !== bWhen) return bWhen - aWhen; // newest first for documents
      return (a.id || '').localeCompare(b.id || '');
    });
    return arr;
  }, [media]);

  // ---- NEW: Live subscriptions for each place subcollection ----
  useEffect(() => {
    if (!tripId || !user) return;
    const unsubDest = onSnapshot(
      query(
        collection(db, "trips", tripId, "destinations"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const arr: WithId<SimplePlace>[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setDestinations(arr);
      }
    );
    const unsubActs = onSnapshot(
      query(
        collection(db, "trips", tripId, "activities"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const arr: WithId<SimplePlace>[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setActivities(arr);
      }
    );
    const unsubAcc = onSnapshot(
      query(
        collection(db, "trips", tripId, "accommodations"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const arr: WithId<SimplePlace>[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setAccommodations(arr);
      }
    );
    const unsubRes = onSnapshot(
      query(
        collection(db, "trips", tripId, "restaurants"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const arr: WithId<SimplePlace>[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setRestaurants(arr);
      }
    );
    const unsubCruises = onSnapshot(
      query(
        collection(db, "trips", tripId, "cruises"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const arr: WithId<SimplePlace>[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setCruises(arr);
      }
    );

    return () => {
      unsubDest();
      unsubActs();
      unsubAcc();
      unsubRes();
      unsubCruises();
    };
  }, [tripId, user]);

  const itineraryRows = useMemo(() => {
    const rows: Array<{
      kind: "Destination" | "Activity" | "Accommodation" | "Restaurant" | "Cruise" | "Primary Destination";
      subcollection:
        | "destinations"
        | "activities"
        | "accommodations"
        | "restaurants"
        | "cruises"
        | "trip";
      data: WithId<SimplePlace>;
    }> = [];

    // Add the main trip destination as the primary destination
    if (trip) {
      rows.push({
        kind: "Primary Destination",
        subcollection: "trip",
        data: {
          id: "trip-destination",
          name: trip.city || trip.country,
          city: trip.city,
          state: trip.state || null,
          country: trip.country,
          address: trip.specificAddress || null,
          startDate: trip.startDate,
          endDate: trip.endDate,
        },
      });
    }

    destinations.forEach((d) =>
      rows.push({ kind: "Destination", subcollection: "destinations", data: d })
    );
    activities.forEach((d) =>
      rows.push({ kind: "Activity", subcollection: "activities", data: d })
    );
    accommodations.forEach((d) =>
      rows.push({
        kind: "Accommodation",
        subcollection: "accommodations",
        data: d,
      })
    );
    restaurants.forEach((d) =>
      rows.push({ kind: "Restaurant", subcollection: "restaurants", data: d })
    );
    cruises.forEach((d) =>
      rows.push({ kind: "Cruise", subcollection: "cruises", data: d })
    );

    rows.sort((a, b) => {
      const sa = a.data.startDate ? new Date(a.data.startDate).getTime() : 0;
      const sb = b.data.startDate ? new Date(b.data.startDate).getTime() : 0;
      return sa - sb;
    });

    return rows;
  }, [trip, destinations, activities, accommodations, restaurants, cruises]);
  // ---- END NEW ----

  return (
    <div className="container py-8 space-y-6">
      {error && (
        <div className="card border-red-300">
          <div className="text-red-700 text-sm">{error}</div>
          <div className="mt-2">
            <button className="btn" onClick={() => router.push("/trips")}>
              Back to Trips
            </button>
          </div>
        </div>
      )}

      {trip && !error && (
        <>
          {/* Header & Cover */}
          <div className="card overflow-hidden">
            {coverMedia ? (
              coverMedia.type === "image" ? (
                <div
                  key={trip?.coverMediaId}
                  className={`relative w-full ${mobileDragEnabled ? "cursor-grab" : "md:cursor-grab"}`}
                  style={{ height: "360px" }}
                  title="Drag to reposition"
                  onPointerDown={onCoverPointerDown}
                  onPointerMove={onCoverPointerMove}
                  onPointerUp={onCoverPointerUp}
                >
                  <img
                    src={coverMedia.downloadURL}
                    alt={coverMedia.caption || trip.name || "Cover photo"}
                    className="absolute inset-0 w-full h-full object-cover select-none"
                    style={{ objectPosition: `50% ${coverPosY}%` }}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    draggable={false}
                  />
                  {/* Mobile move button */}
                  <button
                    type="button"
                    className={`absolute top-2 left-2 md:hidden p-2 rounded-full transition-colors z-10 ${
                      mobileDragEnabled
                        ? "bg-blue-500 text-white"
                        : "bg-black/50 text-white/80"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMobileDragEnabled(!mobileDragEnabled);
                    }}
                    title={mobileDragEnabled ? "Done moving" : "Move cover photo"}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <video
                  key={trip?.coverMediaId}
                  src={coverMedia.downloadURL}
                  className="w-full max-h-[360px] object-cover"
                  controls
                  preload="metadata"
                />
              )
            ) : (
              <div className="h-40 w-full bg-haiti-800/5 flex items-center justify-center text-muted-foreground text-sm">
                No cover yet — choose “Set as cover” on any media below
              </div>
            )}

            <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold break-words">{trip.name}</h1>
                <div className="text-sm text-muted-foreground break-words">
                  {locationStr}
                </div>
                <div className="text-sm text-foreground">{dateRange}</div>

                {/* Origin Location */}
                {trip.originCity && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <svg
                      className="w-4 h-4 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>
                      From {trip.originCity}
                      {trip.originState ? `, ${trip.originState}` : ""}
                      {trip.originCountry ? `, ${trip.originCountry}` : ""}
                    </span>
                  </div>
                )}

                {/* Total Miles */}
                {trip.totalMiles !== null && trip.totalMiles !== undefined && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <svg
                      className="w-4 h-4 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                    </svg>
                    <span>{trip.totalMiles.toLocaleString()} miles traveled</span>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* Transportation types first */}
                  {uniqueTypes.transportation.map((type) => (
                    <span key={`transport-${type}`} className="text-xs px-2 py-0.5 rounded-full bg-haiti-800/5">
                      {type}
                    </span>
                  ))}
                  {/* Accommodation types second */}
                  {uniqueTypes.accommodation.map((type) => (
                    <span key={`accommodation-${type}`} className="text-xs px-2 py-0.5 rounded-full bg-haiti-800/5">
                      {type}
                    </span>
                  ))}
                </div>

                {trip.specificAddress && (
                  <div className="mt-2 text-xs text-muted-foreground break-words">
                    Address: {trip.specificAddress}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="btn" onClick={() => setOpenFlip(true)}>
                  Open Flipbook
                </button>
                <button className="btn" onClick={() => setOpenEdit(true)}>
                  Edit
                </button>
                {/* <button
                  className="btn bg-[#5eb9b3] text-white hover:bg-[#4ea9a3]"
                  onClick={() => {
                    const photobookId = `photobook_${Date.now()}`;
                    router.push(`/trips/${tripId}/photobook/${photobookId}`);
                  }}
                >
                  Create Photobook
                </button> */}
                <Link className="navlink" href="/trips">
                  Back
                </Link>
              </div>
            </div>
          </div>

          {/* Description */}
          {(trip.description || "").trim().length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-2">Description</h2>
              <p className="text-foreground whitespace-pre-wrap break-words">
                {trip.description}
              </p>
            </div>
          )}
        </>
      )}

      {/* Uploader */}
      {user && trip && !error && (
        <div className="card">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Add Photos/Videos</h3>
            {!showUploader && (
              <button className="btn" onClick={() => setShowUploader(true)}>
                Add more
              </button>
            )}
          </div>
          {showUploader && (
            <div className="mt-3">
              <Uploader ownerId={user.uid} tripId={trip.id!} />
            </div>
          )}
          {!showUploader && (
            <p className="text-xs text-muted-foreground mt-2">
              Click “Add more” to upload again.
            </p>
          )}
        </div>
      )}

      {/* Photos (renamed from Media) */}
      {!error && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Photos</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedMedia.map((m) => (
              <div
                key={m.id}
                className="card space-y-2"
                style={{ contentVisibility: "auto", containIntrinsicSize: "auto 320px" }}
              >
                <div className="relative w-full h-60 rounded-lg overflow-hidden bg-haiti-800/5">
                  {m.type === "image" ? (
                    <Image
                      src={m.downloadURL}
                      alt={m.caption || ""}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      className="object-cover"
                      loading="lazy"
                      draggable={false}
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

                <div className="flex items-center justify-between">
                  <button
                    className="text-sm link"
                    onClick={() => setCover(m.id!)}
                  >
                    {trip?.coverMediaId === m.id ? "✓ Cover" : "Set as cover"}
                  </button>
                  <button
                    className="text-sm text-red-600"
                    onClick={() => deleteMedia(m.id!)}
                  >
                    Delete
                  </button>
                </div>

                <div>
                  <label className="label">Caption</label>
                  <textarea
                    className="input h-auto min-h-[44px] leading-5 resize-none overflow-hidden"
                    defaultValue={fixCaption(m.caption)}
                    ref={autoSizeTextarea}
                    onInput={(e) => autoSizeTextarea(e.currentTarget)}
                    onBlur={(e) => saveCaption(m.id!, e.target.value)}
                    placeholder="Add a caption…"
                    rows={1}
                  />
                </div>
              </div>
            ))}
            {sortedMedia.length === 0 && (
              <div className="text-muted-foreground">
                No media yet. Use the uploader above.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents */}
      {!error && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Documents</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedDocuments.map((m) => (
              <div key={m.id} className="card space-y-2">
                <div className="flex items-center gap-3 p-4 bg-haiti-800/5 rounded-lg">
                  <svg className="w-10 h-10 text-muted-foreground flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {(m as any).fileName || "Document"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(m as any).mimeType || "File"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <a
                    href={m.downloadURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm link"
                  >
                    Download
                  </a>
                  <button
                    className="text-sm text-red-600"
                    onClick={() => deleteMedia(m.id!)}
                  >
                    Delete
                  </button>
                </div>

                <div>
                  <label className="label">Caption</label>
                  <textarea
                    className="input h-auto min-h-[44px] leading-5 resize-none overflow-hidden"
                    defaultValue={fixCaption(m.caption)}
                    ref={autoSizeTextarea}
                    onInput={(e) => autoSizeTextarea(e.currentTarget)}
                    onBlur={(e) => saveCaption(m.id!, e.target.value)}
                    placeholder="Add a caption…"
                    rows={1}
                  />
                </div>
              </div>
            ))}
            {sortedDocuments.length === 0 && (
              <div className="text-muted-foreground">
                No documents yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Trip Detail Map ---- */}
      {!error && trip && (
        <TripDetailMap
          destinations={destinations}
          activities={activities}
          restaurants={restaurants}
          tripCity={trip.city}
          tripCountry={trip.country}
          originCity={trip.originCity}
          originState={trip.originState}
          originCountry={trip.originCountry}
          originAddress={trip.originAddress}
          originTransportationType={trip.originTransportationType}
        />
      )}

      {/* ---- NEW: Itinerary (chronological) ---- */}
      {!error && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-3">Itinerary</h2>
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
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
                {itineraryRows.map((row, i) => {
                  const d = row.data;
                  const loc = [d.address, d.city, d.state, d.country]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <tr
                      key={i}
                      className="border-t border-border hover:bg-surface/50"
                    >
                      <td className="px-3 py-2">{row.kind}</td>
                      <td className="px-3 py-2">{d.name || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {fmtMDY(d.startDate)}
                        {d.endDate ? ` → ${fmtMDY(d.endDate)}` : ""}
                      </td>
                      <td className="px-3 py-2">{loc || "—"}</td>
                      <td className="px-3 py-2">
                        {row.subcollection !== "trip" ? (
                          <button
                            className="text-xs navlink whitespace-nowrap"
                            onClick={() =>
                              setSelectedItem({
                                id: d.id!,
                                name: d.name,
                                subcollection: row.subcollection as "destinations" | "activities" | "accommodations" | "restaurants" | "cruises",
                              })
                            }
                          >
                            View Photos
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {itineraryRows.length === 0 && (
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
      )}
      {/* ---- END NEW: Itinerary ---- */}

      {/* ---- NEW: Destinations list ---- */}
      {!error && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-2">Destinations</h2>
          <div className="space-y-3">
            {destinations.map((r) => (
              <PlaceCard
                key={r.id}
                item={r}
                subcollection="destinations"
                onViewPhotos={() =>
                  setSelectedItem({
                    id: r.id!,
                    name: r.name,
                    subcollection: "destinations",
                  })
                }
              />
            ))}
            {destinations.length === 0 && (
              <div className="text-sm text-muted-foreground">No items yet.</div>
            )}
          </div>
        </div>
      )}

      {/* ---- NEW: Activities list ---- */}
      {!error && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-2">Activities</h2>
          <div className="space-y-3">
            {activities.map((r) => (
              <PlaceCard
                key={r.id}
                item={r}
                subcollection="activities"
                onViewPhotos={() =>
                  setSelectedItem({
                    id: r.id!,
                    name: r.name,
                    subcollection: "activities",
                  })
                }
              />
            ))}
            {activities.length === 0 && (
              <div className="text-sm text-muted-foreground">No items yet.</div>
            )}
          </div>
        </div>
      )}

      {/* ---- NEW: Accommodations list ---- */}
      {!error && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-2">Accommodations</h2>
          <div className="space-y-3">
            {accommodations.map((r) => (
              <PlaceCard
                key={r.id}
                item={r}
                subcollection="accommodations"
                onViewPhotos={() =>
                  setSelectedItem({
                    id: r.id!,
                    name: r.name,
                    subcollection: "accommodations",
                  })
                }
              />
            ))}
            {accommodations.length === 0 && (
              <div className="text-sm text-muted-foreground">No items yet.</div>
            )}
          </div>
        </div>
      )}

      {/* ---- NEW: Restaurants list ---- */}
      {!error && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-2">Restaurants</h2>
          <div className="space-y-3">
            {restaurants.map((r) => (
              <PlaceCard
                key={r.id}
                item={r}
                subcollection="restaurants"
                onViewPhotos={() =>
                  setSelectedItem({
                    id: r.id!,
                    name: r.name,
                    subcollection: "restaurants",
                  })
                }
              />
            ))}
            {restaurants.length === 0 && (
              <div className="text-sm text-muted-foreground">No items yet.</div>
            )}
          </div>
        </div>
      )}

      {/* ---- NEW: Cruises list ---- */}
      {!error && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-2">Cruises</h2>
          <div className="space-y-3">
            {cruises.map((r) => (
              <PlaceCard
                key={r.id}
                item={r}
                subcollection="cruises"
                onViewPhotos={() =>
                  setSelectedItem({
                    id: r.id!,
                    name: r.name,
                    subcollection: "cruises",
                  })
                }
              />
            ))}
            {cruises.length === 0 && (
              <div className="text-sm text-muted-foreground">No items yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Flipbook (all media) */}
      <Flipbook
        tripId={tripId}
        open={openFlip}
        onClose={() => setOpenFlip(false)}
      />

      {/* Shared Edit Modal */}
      {openEdit && trip && (
        <EditTripModal trip={trip} onClose={() => setOpenEdit(false)} />
      )}

      {/* ---- NEW: Item-level Flipbook for a specific itinerary entry ---- */}
      {selectedItem && (
        <ItemFlipbook
          tripId={tripId}
          linkedId={selectedItem.id}
          subcollection={selectedItem.subcollection}
          itemName={selectedItem.name}
          onClose={() => setSelectedItem(null)}
        />
      )}
      {/* ---- END NEW ---- */}
    </div>
  );
}

/* ---------- NEW: Item-level Flipbook (per-entry) ---------- */
function ItemFlipbook({
  tripId,
  linkedId,
  subcollection,
  itemName,
  onClose,
}: {
  tripId: string;
  linkedId: string;
  subcollection:
    | "destinations"
    | "activities"
    | "accommodations"
    | "restaurants"
    | "cruises";
  itemName: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const qx = query(
      collection(db, "trips", tripId, "media"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(qx, (snap) => {
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
  }, [tripId, linkedId, subcollection]);

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
