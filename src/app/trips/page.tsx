"use client";
import Protected from "@/components/Protected";
import { useAuth } from "@/components/AuthProvider";
import SubscriptionRequiredModal from "@/components/SubscriptionRequiredModal";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Trip, MediaItem } from "@/lib/types";
import { COUNTRIES, getStates } from "@/lib/geo";
import { getCruiseLineNames, getShipsForCruiseLine, OTHER_CRUISE_LINE } from "@/lib/cruiseData";
import EditTripModal from "@/components/EditTripModal";
import TripCreateMediaPicker from "@/components/TripCreateMediaPicker";

/* NEW: modals for the extra menu options */
import PhotosModal from "@/components/modals/PhotosModal";
import ItineraryModal from "@/components/modals/ItineraryModal";
import PlaceModal from "@/components/modals/PlaceModal";
import ShareTripModal from "@/components/modals/ShareTripModal";

/** A→Z sort with “Other/Others/—/N/A/None/-” pinned to the end */
const isOtherish = (s: string) => {
  const t = s.trim().toLowerCase();
  return (
    t === "other" ||
    t === "others" ||
    t === "—" ||
    t === "-" ||
    t === "n/a" ||
    t === "none"
  );
};
const sortAZWithOtherLast = (
  list: readonly string[] | string[] = []
): string[] => {
  const arr = [...list].sort((a, b) => a.localeCompare(b));
  const tail = arr.filter(isOtherish);
  const head = arr.filter((x) => !isOtherish(x));
  return [...head, ...tail];
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const TRANSPORT_OPTIONS = [
  "Airplanes",
  "Bus",
  "Car",
  "Cruise",
  "RV",
  "Train",
  "Uber/Taxi",
  "Walk",
];

export default function TripsPage() {
  return (
    <Protected>
      <TripsInner />
    </Protected>
  );
}

function TripsInner() {
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
        title="My Trips"
        description="Access to trips requires an active subscription."
      />
    );
  }

  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [shouldLoadTrips, setShouldLoadTrips] = useState(false); // ← defer trips subscription
  const [shareFor, setShareFor] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    city: "",
    state: "",
    country: "",
    originCity: "",
    originState: "",
    originCountry: "",
    originAddress: "",
    originTransportationType: "",
    cruiseLine: "",
    cruiseShip: "",
    customCruiseLine: "",
    customCruiseShip: "",
    specificAddress: "",
    startDate: "",
    endDate: "",
    description: "",
  });

  // ⋯ menu & editing state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  /* NEW: which tripId each modal is open for (null = closed) */
  const [photosFor, setPhotosFor] = useState<string | null>(null);
  const [itineraryFor, setItineraryFor] = useState<string | null>(null);
  const [destinationsFor, setDestinationsFor] = useState<string | null>(null);
  const [activitiesFor, setActivitiesFor] = useState<string | null>(null);
  const [accommodationsFor, setAccommodationsFor] = useState<string | null>(
    null
  );
  const [restaurantsFor, setRestaurantsFor] = useState<string | null>(null);

  // NEW: pre-create media selection + preview/captions/cover
  const [photosToAdd, setPhotosToAdd] = useState<File[]>([]);
  const [videosToAdd, setVideosToAdd] = useState<File[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // captions keyed by file key; preview URLs for object URLs; chosen cover key
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [coverKey, setCoverKey] = useState<string | null>(null);

  const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;
  const selectedFiles = useMemo(
    () => [...photosToAdd, ...videosToAdd],
    [photosToAdd, videosToAdd]
  );
  const selectedKeys = useMemo(
    () => selectedFiles.map(fileKey),
    [selectedFiles]
  );

  // Manage preview object URLs and cleanup removed ones
  useEffect(() => {
    setPreviewUrls((prev) => {
      const next = { ...prev };
      for (const f of selectedFiles) {
        const k = fileKey(f);
        if (!next[k]) next[k] = URL.createObjectURL(f);
      }
      for (const k of Object.keys(next)) {
        if (!selectedKeys.includes(k)) {
          URL.revokeObjectURL(next[k]);
          delete next[k];
        }
      }
      return next;
    });
  }, [selectedFiles, selectedKeys]);

  useEffect(() => {
    return () => {
      for (const u of Object.values(previewUrls)) URL.revokeObjectURL(u);
    };
  }, [previewUrls]);

  useEffect(() => {
    const firstImg = photosToAdd[0];
    if (!coverKey) {
      if (firstImg) setCoverKey(fileKey(firstImg));
    } else if (!selectedKeys.includes(coverKey)) {
      setCoverKey(firstImg ? fileKey(firstImg) : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photosToAdd, selectedKeys.join("|")]);

  // Close dropdown when clicking anywhere on the screen
  useEffect(() => {
    function handleClickOutside() {
      if (menuOpenId !== null) {
        setMenuOpenId(null);
      }
    }

    if (menuOpenId !== null) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [menuOpenId]);

  function setCaption(k: string, v: string) {
    setCaptions((prev) => ({ ...prev, [k]: v }));
  }
  function removeDraft(k: string) {
    setPhotosToAdd((prev) => prev.filter((f) => fileKey(f) !== k));
    setVideosToAdd((prev) => prev.filter((f) => fileKey(f) !== k));
    setCaptions((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    setPreviewUrls((prev) => {
      const next = { ...prev };
      if (next[k]) {
        URL.revokeObjectURL(next[k]);
        delete next[k];
      }
      return next;
    });
    if (coverKey === k) {
      const firstImg = photosToAdd.find((f) => fileKey(f) !== k);
      setCoverKey(firstImg ? fileKey(firstImg) : null);
    }
  }

  // Check if cruise info is complete when Cruise is selected
  const isCruise = form.originTransportationType === "Cruise";
  const cruiseLineValue = form.cruiseLine === OTHER_CRUISE_LINE ? form.customCruiseLine : form.cruiseLine;
  const cruiseShipValue = form.cruiseShip === "Other" ? form.customCruiseShip : form.cruiseShip;
  const isCruiseComplete = !isCruise || (!!cruiseLineValue && !!cruiseShipValue);

  const canSubmit = useMemo(() => {
    return (
      !!form.name &&
      !!form.city &&
      !!form.country &&
      isCruiseComplete &&
      !!form.startDate &&
      !!form.endDate
    );
  }, [form, isCruiseComplete]);

  // Defer subscribing to trips until after first paint / browser idle
  useEffect(() => {
    let timeoutId: any = null;
    let idleId: any = null;
    const enable = () => setShouldLoadTrips(true);

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = (window as any).requestIdleCallback(enable, { timeout: 700 });
    } else {
      timeoutId = setTimeout(enable, 200);
    }

    return () => {
      if (idleId && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Subscribe to trips only when we decided to load them
  useEffect(() => {
    if (!user || !shouldLoadTrips) return;

    const q = query(
      collection(db, "trips"),
      where("ownerId", "==", user.uid),
      orderBy("startDate", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Trip[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setTrips(arr);
        setTripsLoaded(true);
      },
      () => setTripsLoaded(true)
    );

    return () => unsub();
  }, [user, shouldLoadTrips]);

  async function createTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !canSubmit || uploadingMedia) return;

    const now = Date.now();
    const payload: Trip = {
      ownerId: user.uid,
      name: form.name,
      city: form.city,
      state: form.state || null,
      country: form.country,
      originCity: form.originCity || null,
      originState: form.originState || null,
      originCountry: form.originCountry || null,
      originAddress: form.originAddress || null,
      originTransportationType: form.originTransportationType || null,
      cruiseLine: isCruise ? cruiseLineValue || null : null,
      cruiseShip: isCruise ? cruiseShipValue || null : null,
      specificAddress: form.specificAddress || null,
      totalMiles: null,
      startDate: form.startDate,
      endDate: form.endDate,
      description: form.description || null,
      coverMediaId: null,
      createdAt: now,
      updatedAt: now,
    };

    const tripRef = await addDoc(collection(db, "trips"), payload as any);

    const allFiles = [...selectedFiles];
    if (allFiles.length > 0) {
      setUploadingMedia(true);
      try {
        let chosenCoverMediaId: string | null = null;
        let firstImageMediaId: string | null = null;

        for (const file of allFiles) {
          const k = fileKey(file);
          const isImage = file.type.startsWith("image/");
          const isVideo = file.type.startsWith("video/");
          const kind = isImage ? "image" : isVideo ? "video" : "other";
          if (kind === "other") continue;

          const mediaRef = doc(collection(db, "trips", tripRef.id, "media"));
          const mediaId = mediaRef.id;

          const safeName = file.name.replace(/[^\w.\-]+/g, "_");
          const storagePath = `trip_media/${user.uid}/${tripRef.id}/${mediaId}/${safeName}`;

          const sref = storageRef(storage, storagePath);
          await uploadBytes(sref, file);
          const downloadURL = await getDownloadURL(sref);

          await setDoc(mediaRef, {
            tripId: tripRef.id,
            type: kind,
            storagePath,
            downloadURL,
            createdAt: Date.now(),
            caption: captions[k] || "",
            fileName: file.name,
            size: file.size,
            contentType: file.type,
          } as any);

          if (isImage) {
            if (k === coverKey && !chosenCoverMediaId)
              chosenCoverMediaId = mediaId;
            if (!firstImageMediaId) firstImageMediaId = mediaId;
          }
        }

        const coverIdToUse = chosenCoverMediaId || firstImageMediaId;
        if (coverIdToUse) {
          await updateDoc(doc(db, "trips", tripRef.id), {
            coverMediaId: coverIdToUse,
            updatedAt: Date.now(),
          } as any);
        }
      } finally {
        setUploadingMedia(false);
      }
    }

    setForm({
      name: "",
      city: "",
      state: "",
      country: "",
      originCity: "",
      originState: "",
      originCountry: "",
      originAddress: "",
      originTransportationType: "",
      cruiseLine: "",
      cruiseShip: "",
      customCruiseLine: "",
      customCruiseShip: "",
      specificAddress: "",
      startDate: "",
      endDate: "",
      description: "",
    });
    setPhotosToAdd([]);
    setVideosToAdd([]);
    setCaptions({});
    setPreviewUrls({});
    setCoverKey(null);
  }

  async function deleteTrip(id: string) {
    try {
      await deleteDoc(doc(db, "trips", id));
    } finally {
      setMenuOpenId(null);
    }
  }

  const locationOf = (t: Trip) => {
    const cityState = t.city ? `${t.city}${t.state ? ", " + t.state : ""}` : "";
    if (t.country) return cityState ? `${cityState}, ${t.country}` : t.country;
    return cityState || "—";
  };
  const fmt = (d: string | number | Date) => {
    if (typeof d === "string") {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
      if (match) return `${match[2]}/${match[3]}/${match[1]}`;
    }
    const dt = new Date(d);
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    const y = dt.getFullYear();
    return `${m}/${day}/${y}`;
  };

  const dateRangeOf = (t: Trip) => `${fmt(t.startDate)} → ${fmt(t.endDate)}`;

  const sortedCountries = useMemo(() => sortAZWithOtherLast(COUNTRIES), []);
  const availableStates = useMemo(
    () => sortAZWithOtherLast(getStates(form.country)),
    [form.country]
  );

  const availableOriginStates = useMemo(
    () => sortAZWithOtherLast(getStates(form.originCountry)),
    [form.originCountry]
  );

  return (
    <div className="container py-10 space-y-8">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Your Trips</h2>

        {/* Skeleton / placeholder while trips subscription is deferred or loading */}
        {!shouldLoadTrips || !tripsLoaded ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-busy="true"
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-[#2a3544] overflow-hidden animate-pulse"
              >
                <div className="aspect-[16/9] w-full bg-white/10" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-2/3 bg-white/10 rounded" />
                  <div className="h-4 w-1/3 bg-white/10 rounded" />
                  <div className="flex gap-2">
                    <div className="h-9 w-24 bg-white/10 rounded-lg" />
                    <div className="h-9 w-9 bg-white/10 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {trips.map((t) => (
              <TripCard
                key={t.id}
                trip={t}
                locationOf={locationOf}
                dateRangeOf={dateRangeOf}
                setMenuOpenId={setMenuOpenId}
                menuOpenId={menuOpenId}
                setPhotosFor={setPhotosFor}
                setItineraryFor={setItineraryFor}
                setDestinationsFor={setDestinationsFor}
                setActivitiesFor={setActivitiesFor}
                setAccommodationsFor={setAccommodationsFor}
                setRestaurantsFor={setRestaurantsFor}
                setShareFor={setShareFor}
                setEditingTrip={setEditingTrip}
                deleteTrip={deleteTrip}
              />
            ))}

            {trips.length === 0 && (
              <div className="text-muted-foreground">No trips yet.</div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h1 className="text-2xl font-semibold mb-4">Add New Trip</h1>

        <form className="grid md:grid-cols-3 gap-4" onSubmit={createTrip}>
          {/* Trip Title */}
          <div className="md:col-span-3">
            <label className="label">Trip Title *</label>
            <input
              className="input"
              placeholder="e.g., Summer in Paris"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          {/* Dates */}
          <div>
            <label className="label">Start Date *</label>
            <input
              className="input"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">End Date *</label>
            <input
              className="input"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              required
            />
          </div>
          <div></div>{/* Empty div for grid alignment */}

          {/* Origin Section Header */}
          <div className="md:col-span-3">
            <h3 className="text-lg font-semibold text-foreground mb-2">Starting From</h3>
          </div>

          {/* Origin Country */}
          <div>
            <label className="label">Origin Country</label>
            <select
              className="input"
              value={form.originCountry}
              onChange={(e) => {
                const newCountry = e.target.value;
                const states = getStates(newCountry);
                const nextState = states.includes(form.originState) ? form.originState : "";
                setForm({ ...form, originCountry: newCountry, originState: nextState });
              }}
            >
              <option value="">Select origin country</option>
              {sortedCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Origin State / Province / Island */}
          <div>
            <label className="label">Origin State / Province</label>
            {availableOriginStates.length ? (
              <>
                <select
                  className="input"
                  value={availableOriginStates.includes(form.originState) ? form.originState : ""}
                  onChange={(e) => setForm({ ...form, originState: e.target.value })}
                >
                  <option value="">Select from list</option>
                  {availableOriginStates.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  className="input mt-2"
                  placeholder="Enter manually"
                  value={availableOriginStates.includes(form.originState) ? "" : form.originState}
                  onChange={(e) => setForm({ ...form, originState: e.target.value })}
                />
              </>
            ) : (
              <input
                className="input"
                placeholder="e.g., Florida"
                value={form.originState}
                onChange={(e) => setForm({ ...form, originState: e.target.value })}
              />
            )}
          </div>

          {/* Origin City */}
          <div>
            <label className="label">Origin City</label>
            <input
              className="input"
              placeholder="e.g., St. Augustine"
              value={form.originCity}
              onChange={(e) => setForm({ ...form, originCity: e.target.value })}
            />
          </div>

          {/* Origin Address */}
          <div className="md:col-span-3">
            <label className="label">Origin Address</label>
            <input
              className="input"
              placeholder="e.g., 123 Main Street, Suite 100"
              value={form.originAddress}
              onChange={(e) => setForm({ ...form, originAddress: e.target.value })}
            />
          </div>

          {/* Origin Mode of Transportation */}
          <div className="md:col-span-3">
            <label className="label">Mode of Transportation</label>
            <select
              className="input"
              value={form.originTransportationType}
              onChange={(e) => {
                const newTransport = e.target.value;
                // Reset cruise fields when changing transportation type
                if (newTransport !== "Cruise") {
                  setForm({
                    ...form,
                    originTransportationType: newTransport,
                    cruiseLine: "",
                    cruiseShip: "",
                    customCruiseLine: "",
                    customCruiseShip: "",
                  });
                } else {
                  setForm({ ...form, originTransportationType: newTransport });
                }
              }}
            >
              <option value="">Select transportation</option>
              {TRANSPORT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Destination Section Header */}
          <div className="md:col-span-3">
            <h3 className="text-lg font-semibold text-foreground mb-2 mt-4">Destination</h3>
          </div>

          {/* Country */}
          <div>
            <label className="label">Country *</label>
            <select
              className="input"
              value={form.country}
              onChange={(e) => {
                const newCountry = e.target.value;
                const states = getStates(newCountry);
                const nextState = states.includes(form.state) ? form.state : "";
                setForm({ ...form, country: newCountry, state: nextState });
              }}
              required
            >
              <option value="">Select country</option>
              {sortedCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* State / Province / Island */}
          <div>
            <label className="label">State / Province / Island</label>
            {availableStates.length ? (
              <>
                <select
                  className="input"
                  value={availableStates.includes(form.state) ? form.state : ""}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                >
                  <option value="">Select from list</option>
                  {availableStates.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  className="input mt-2"
                  placeholder="Enter manually"
                  value={availableStates.includes(form.state) ? "" : form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
              </>
            ) : (
              <input
                className="input"
                placeholder="e.g., California, Bali, etc."
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            )}
          </div>

          {/* City */}
          <div>
            <label className="label">City *</label>
            <input
              className="input"
              placeholder="e.g., Paris"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
            />
          </div>

          {/* Cruise Line Selection (only shown when Cruise is selected via origin transportation) */}
          {isCruise && (
            <>
              <div className="md:col-span-3">
                <label className="label">Cruise Line *</label>
                <select
                  className="input"
                  value={form.cruiseLine}
                  onChange={(e) => {
                    const newCruiseLine = e.target.value;
                    // Reset ship selection when cruise line changes
                    setForm({
                      ...form,
                      cruiseLine: newCruiseLine,
                      cruiseShip: "",
                      customCruiseShip: "",
                    });
                  }}
                >
                  <option value="">Select cruise line</option>
                  {getCruiseLineNames().map((cl) => (
                    <option key={cl} value={cl}>
                      {cl}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Cruise Line (when Other selected) */}
              {form.cruiseLine === OTHER_CRUISE_LINE && (
                <div className="md:col-span-3">
                  <label className="label">Cruise Line Name *</label>
                  <input
                    className="input"
                    placeholder="Enter cruise line name"
                    value={form.customCruiseLine}
                    onChange={(e) =>
                      setForm({ ...form, customCruiseLine: e.target.value })
                    }
                  />
                </div>
              )}

              {/* Ship Selection */}
              {form.cruiseLine && (
                <div className="md:col-span-3">
                  <label className="label">Ship Name *</label>
                  {form.cruiseLine === OTHER_CRUISE_LINE ? (
                    <input
                      className="input"
                      placeholder="Enter ship name"
                      value={form.customCruiseShip}
                      onChange={(e) =>
                        setForm({ ...form, customCruiseShip: e.target.value })
                      }
                    />
                  ) : (
                    <>
                      <select
                        className="input"
                        value={form.cruiseShip}
                        onChange={(e) =>
                          setForm({ ...form, cruiseShip: e.target.value })
                        }
                      >
                        <option value="">Select ship</option>
                        {getShipsForCruiseLine(form.cruiseLine).map((ship) => (
                          <option key={ship} value={ship}>
                            {ship}
                          </option>
                        ))}
                      </select>
                      {/* Custom ship input when Other selected */}
                      {form.cruiseShip === "Other" && (
                        <input
                          className="input mt-2"
                          placeholder="Enter ship name"
                          value={form.customCruiseShip}
                          onChange={(e) =>
                            setForm({ ...form, customCruiseShip: e.target.value })
                          }
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Specific Address */}
          <div className="md:col-span-3">
            <label className="label">Specific Address</label>
            <input
              className="input"
              placeholder="e.g., Eiffel Tower"
              value={form.specificAddress}
              onChange={(e) =>
                setForm({ ...form, specificAddress: e.target.value })
              }
            />
          </div>

          {/* Media pickers */}
          <TripCreateMediaPicker
            photos={photosToAdd}
            videos={videosToAdd}
            onPhotosChange={setPhotosToAdd}
            onVideosChange={setVideosToAdd}
          />

          {/* Media preview/editor */}
          <div className="md:col-span-3">
            <h3 className="text-lg font-semibold mb-3">Media</h3>

            {selectedFiles.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No media selected yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedFiles.map((f) => {
                  const k = fileKey(f);
                  const isImage = f.type.startsWith("image/");
                  const url = previewUrls[k];
                  return (
                    <div key={k} className="card space-y-2">
                      <div className="w-full h-60 rounded-xl overflow-hidden bg-haiti-800/5">
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
                          onClick={() => removeDraft(k)}
                        >
                          Delete
                        </button>
                      </div>

                      <div>
                        <label className="label">Caption</label>
                        <textarea
                          className="input h-auto min-h-[44px] leading-5 resize-none overflow-hidden"
                          rows={1}
                          placeholder="Add a caption…"
                          value={captions[k] || ""}
                          onChange={(e) => {
                            setCaption(k, e.target.value);
                          }}
                          onInput={(e) => {
                            const ta = e.currentTarget;
                            ta.style.height = "auto";
                            ta.style.height = `${ta.scrollHeight}px`;
                          }}
                          ref={(el) => {
                            if (el) {
                              el.style.height = "auto";
                              el.style.height = `${el.scrollHeight}px`;
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="md:col-span-3 flex gap-3">
            <button
              className="btn"
              type="submit"
              disabled={!canSubmit || uploadingMedia}
            >
              {uploadingMedia ? "Creating & Uploading…" : "Add Trip"}
            </button>
            <button
              className="navlink"
              type="button"
              onClick={() =>
                setForm({
                  name: "",
                  city: "",
                  state: "",
                  country: "",
                  originCity: "",
                  originState: "",
                  originCountry: "",
                  originAddress: "",
                  originTransportationType: "",
                  cruiseLine: "",
                  cruiseShip: "",
                  customCruiseLine: "",
                  customCruiseShip: "",
                  specificAddress: "",
                  startDate: "",
                  endDate: "",
                  description: "",
                })
              }
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Edit modal */}
      {editingTrip ? (
        <EditTripModal
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
        />
      ) : null}

      {/* NEW: Modals hooked to the new menu options */}
      {photosFor && (
        <PhotosModal tripId={photosFor} onClose={() => setPhotosFor(null)} />
      )}
      {itineraryFor && (
        <ItineraryModal
          tripId={itineraryFor}
          onClose={() => setItineraryFor(null)}
        />
      )}
      {destinationsFor && (
        <PlaceModal
          title="Destinations"
          tripId={destinationsFor}
          subcollection="destinations"
          onClose={() => setDestinationsFor(null)}
        />
      )}
      {activitiesFor && (
        <PlaceModal
          title="Activities"
          tripId={activitiesFor}
          subcollection="activities"
          extraLeft={[
            {
              key: "transportationType",
              label: "Mode of Transportation",
              options: TRANSPORT_OPTIONS,
            },
          ]}
          onClose={() => setActivitiesFor(null)}
        />
      )}
      {accommodationsFor && (
        <PlaceModal
          title="Accommodations"
          tripId={accommodationsFor}
          subcollection="accommodations"
          extraLeft={[
            {
              key: "transportationType",
              label: "Mode of Transportation",
              options: TRANSPORT_OPTIONS,
            },
          ]}
          onClose={() => setAccommodationsFor(null)}
        />
      )}
      {restaurantsFor && (
        <PlaceModal
          title="Restaurants"
          tripId={restaurantsFor}
          subcollection="restaurants"
          onClose={() => setRestaurantsFor(null)}
        />
      )}

      {/* Share modal */}
      {shareFor && (
        <ShareTripModal tripId={shareFor} onClose={() => setShareFor(null)} />
      )}
    </div>
  );
}

/** --- TripCard with inline drag implementation --- */
function TripCard({
  trip,
  locationOf,
  dateRangeOf,
  setMenuOpenId,
  menuOpenId,
  setPhotosFor,
  setItineraryFor,
  setDestinationsFor,
  setActivitiesFor,
  setAccommodationsFor,
  setRestaurantsFor,
  setShareFor,
  setEditingTrip,
  deleteTrip,
}: {
  trip: Trip;
  locationOf: (t: Trip) => string;
  dateRangeOf: (t: Trip) => string;
  setMenuOpenId: (id: string | null) => void;
  menuOpenId: string | null;
  setPhotosFor: (id: string) => void;
  setItineraryFor: (id: string) => void;
  setDestinationsFor: (id: string) => void;
  setActivitiesFor: (id: string) => void;
  setAccommodationsFor: (id: string) => void;
  setRestaurantsFor: (id: string) => void;
  setShareFor: (id: string) => void;
  setEditingTrip: (trip: Trip) => void;
  deleteTrip: (id: string) => void;
}) {
  const [cover, setCover] = useState<MediaItem | null>(null);
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // --- Cover focus (drag to reposition) ---
  const [coverFocus, setCoverFocus] = useState<{ x: number; y: number }>(() => {
    const cf: any = (trip as any).coverFocus;
    return {
      x: typeof cf?.x === "number" ? cf.x : 50,
      y: typeof cf?.y === "number" ? cf.y : 50,
    };
  });

  useEffect(() => {
    const cf: any = (trip as any).coverFocus;
    if (cf && typeof cf.x === "number" && typeof cf.y === "number") {
      setCoverFocus({ x: cf.x, y: cf.y });
    }
  }, [(trip as any).coverFocus?.x, (trip as any).coverFocus?.y]);

  const coverRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const startRef = useRef<{
    x: number;
    y: number;
    fx: number;
    fy: number;
  } | null>(null);

  function startDrag(clientX: number, clientY: number) {
    if (!coverRef.current) return;
    const fx = coverFocus.x;
    const fy = coverFocus.y;
    startRef.current = { x: clientX, y: clientY, fx, fy };
    draggingRef.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!draggingRef.current || !coverRef.current || !startRef.current) return;
    const rect = coverRef.current.getBoundingClientRect();
    const dx = ((clientX - startRef.current.x) / rect.width) * 100;
    const dy = ((clientY - startRef.current.y) / rect.height) * 100;
    const nx = clamp(startRef.current.fx + dx, 0, 100);
    const ny = clamp(startRef.current.fy + dy, 0, 100);
    setCoverFocus({ x: nx, y: ny });
  }

  async function endDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    try {
      await updateDoc(doc(db, "trips", trip.id), {
        coverFocus: {
          x: Math.round(coverFocus.x),
          y: Math.round(coverFocus.y),
        },
        updatedAt: Date.now(),
      } as any);
    } catch (e) {
      console.error("Failed to save coverFocus", e);
    }
  }

  // Window-level mouse listeners
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      moveDrag(e.clientX, e.clientY);
    }
    function onUp() {
      endDrag();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [coverFocus.x, coverFocus.y]);

  // Window-level touch listeners
  useEffect(() => {
    function onTouchMove(e: TouchEvent) {
      if (!draggingRef.current) return;
      const t = e.touches[0];
      if (t) moveDrag(t.clientX, t.clientY);
    }
    function onTouchEnd() {
      endDrag();
    }
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [coverFocus.x, coverFocus.y]);

  // Fetch all media for this trip
  useEffect(() => {
    const q = query(
      collection(db, "trips", trip.id, "media"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: MediaItem[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
        setAllMedia(arr);
      },
      () => setAllMedia([])
    );
    return () => unsub();
  }, [trip.id]);

  // Set current cover based on index
  useEffect(() => {
    if (allMedia.length === 0) {
      setCover(null);
      return;
    }
    const media = allMedia[currentIndex];
    if (media) setCover(media);
  }, [allMedia, currentIndex]);

  // Set initial index based on coverMediaId
  useEffect(() => {
    if (!trip.coverMediaId || allMedia.length === 0) return;
    const idx = allMedia.findIndex((m) => m.id === trip.coverMediaId);
    if (idx !== -1) setCurrentIndex(idx);
  }, [trip.coverMediaId, allMedia]);

  function goToPrevious(e: React.MouseEvent) {
    e.stopPropagation();
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }

  function goToNext(e: React.MouseEvent) {
    e.stopPropagation();
    if (currentIndex < allMedia.length - 1) setCurrentIndex(currentIndex + 1);
  }

  return (
    <div
      className="rounded-2xl shadow-lg bg-[#2a3544]"
      style={{ overflow: "visible" }}
    >
      {/* Cover with overlay content */}
      <div
        ref={coverRef}
        className="aspect-[16/9] w-full bg-haiti-800/5 overflow-hidden relative rounded-t-2xl group"
      >
        {cover?.type === "image" ? (
          <img
            src={cover.downloadURL}
            alt={cover.caption || trip.name}
            className="w-full h-full object-cover select-none"
            style={{ objectPosition: `${coverFocus.x}% ${coverFocus.y}%` }}
            draggable={false}
          />
        ) : cover?.type === "video" ? (
          <video
            src={cover.downloadURL}
            className="w-full h-full object-cover select-none"
            style={{ objectPosition: `${coverFocus.x}% ${coverFocus.y}%` }}
            muted
            playsInline
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/60 text-xs bg-gradient-to-b from-slate-800 to-slate-900">
            No cover yet
          </div>
        )}

        {/* Drag overlay (only when there is media) */}
        {(cover?.type === "image" || cover?.type === "video") && (
          <div
            className="absolute inset-0 cursor-grab"
            onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (t) startDrag(t.clientX, t.clientY);
            }}
            onContextMenu={(e) => {
              if (draggingRef.current) e.preventDefault();
            }}
          />
        )}

        {/* Dark gradient overlay at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none"></div>

        {/* Trip info overlay on image - only title and location */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white pointer-events-none">
          <h3 className="text-lg font-semibold mb-1 line-clamp-1">
            {trip.name}
          </h3>

          {/* Location */}
          <div className="flex items-start gap-1.5">
            <svg
              className="w-4 h-4 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm">{locationOf(trip)}</span>
          </div>
        </div>

        {/* Navigation arrows (show on hover when multiple media) */}
        {allMedia.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button
                type="button"
                onClick={goToPrevious}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto z-10"
                aria-label="Previous image"
              >
                ←
              </button>
            )}
            {currentIndex < allMedia.length - 1 && (
              <button
                type="button"
                onClick={goToNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto z-10"
                aria-label="Next image"
              >
                →
              </button>
            )}
          </>
        )}

        {/* Photo counter */}
        {allMedia.length > 1 && (
          <div className="pointer-events-none absolute top-2 left-2 text-xs px-2 py-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            {currentIndex + 1} / {allMedia.length}
          </div>
        )}

        {/* Drag hint */}
        {(cover?.type === "image" || cover?.type === "video") && (
          <div className="pointer-events-none absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded bg-black/40 text-white">
            Drag to reposition
          </div>
        )}
      </div>

                {/* Content below image */}
      <div className="p-4 space-y-3">
        {/* Date with calendar icon */}
        <div className="flex items-center gap-2 text-white/80">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm">{dateRangeOf(trip)}</span>
        </div>

        {/* Origin to Destination */}
        {trip.originCity && (
          <div className="flex items-center gap-2 text-white/80">
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
            <span className="text-sm">
              From {trip.originCity}
              {trip.originState ? `, ${trip.originState}` : ""}
            </span>
          </div>
        )}

        {/* Total Miles */}
        {trip.totalMiles !== null && trip.totalMiles !== undefined && (
          <div className="flex items-center gap-2 text-white/80">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
            </svg>
            <span className="text-sm">{trip.totalMiles.toLocaleString()} miles</span>
          </div>
        )}

        {/* Bottom action bar with dropdown and standalone icons */}
        <div className="relative flex items-center gap-2">
          {/* View Trip */}
          <Link
            className="flex items-center gap-2 px-4 py-2 bg-[#5eb9b3] hover:bg-[#4ea9a3] rounded-lg text-white text-sm font-medium transition-colors"
            href={`/trips/${trip.id}`}
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path
                fillRule="evenodd"
                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                clipRule="evenodd"
              />
            </svg>
            View Trip
          </Link>

          {/* Menu button (opens dropdown for Photos/Itinerary/Places) */}
          <button
            type="button"
            className="h-9 w-9 rounded-lg bg-[#3a4557] hover:bg-[#4a5567] flex items-center justify-center text-white transition-colors"
            aria-label="Menu"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(menuOpenId === trip.id ? null : trip.id || null);
            }}
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Share (opens ShareTripModal) */}
          <button
            type="button"
            className="h-9 w-9 rounded-lg bg-[#3a4557] hover:bg-[#4a5567] flex items-center justify-center text-white transition-colors"
            aria-label="Share"
            title="Share"
            onClick={() => setShareFor(trip.id!)}
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
            </svg>
          </button>

          {/* Edit (standalone) */}
          <button
            type="button"
            className="h-9 w-9 rounded-lg bg-[#3a4557] hover:bg-[#4a5567] flex items-center justify-center text-white transition-colors"
            aria-label="Edit"
            title="Edit"
            onClick={() => setEditingTrip(trip)}
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793z" />
              <path d="M11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>

          {/* Delete (standalone, red) */}
          <button
            type="button"
            className="h-9 w-9 rounded-lg bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors"
            aria-label="Delete"
            title="Delete"
            onClick={() => deleteTrip(trip.id!)}
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Dropdown (anchored to the Menu button) */}
          {menuOpenId === trip.id && (
            <div className="absolute left-0 bottom-full mb-2 w-56 rounded-xl bg-[#3a4557] shadow-2xl overflow-hidden z-[100] border border-white/10">
              <div className="flex flex-col py-2">
                {/* Photos */}
                <button
                  type="button"
                  className="flex items-center gap-3 px-4 py-3 text-white text-sm hover:bg:white/10 hover:bg-white/10 transition-colors text-left"
                  onClick={() => {
                    setPhotosFor(trip.id!);
                    setMenuOpenId(null);
                  }}
                  title="Photos"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Photos</span>
                </button>

                {/* Itinerary */}
                <button
                  type="button"
                  className="flex items-center gap-3 px-4 py-3 text-white text-sm hover:bg-white/10 transition-colors text-left"
                  onClick={() => {
                    setItineraryFor(trip.id!);
                    setMenuOpenId(null);
                  }}
                  title="Itinerary"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Itinerary</span>
                </button>

                {/* Destinations */}
                <button
                  type="button"
                  className="flex items-center gap-3 px-4 py-3 text-white text-sm hover:bg-white/10 transition-colors text-left"
                  onClick={() => {
                    setDestinationsFor(trip.id!);
                    setMenuOpenId(null);
                  }}
                  title="Destinations"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Destinations</span>
                </button>

                {/* Activities */}
                <button
                  type="button"
                  className="flex items-center gap-3 px-4 py-3 text-white text-sm hover:bg-white/10 transition-colors text-left"
                  onClick={() => {
                    setActivitiesFor(trip.id!);
                    setMenuOpenId(null);
                  }}
                  title="Activities"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                  </svg>
                  <span>Activities</span>
                </button>

                {/* Accommodations */}
                <button
                  type="button"
                  className="flex items-center gap-3 px-4 py-3 text-white text-sm hover:bg-white/10 transition-colors text-left"
                  onClick={() => {
                    setAccommodationsFor(trip.id!);
                    setMenuOpenId(null);
                  }}
                  title="Accommodations"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                  <span>Accommodations</span>
                </button>

                {/* Restaurants */}
                <button
                  type="button"
                  className="flex items-center gap-3 px-4 py-3 text-white text-sm hover:bg-white/10 transition-colors text-left"
                  onClick={() => {
                    setRestaurantsFor(trip.id!);
                    setMenuOpenId(null);
                  }}
                  title="Restaurants"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path
                      fillRule="evenodd"
                      d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Restaurants</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
