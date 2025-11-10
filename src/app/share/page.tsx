"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Trip, MediaItem } from "@/lib/types";
import Flipbook from "@/components/Flipbook";
import Link from "next/link";

type WithId<T> = T & { id: string };

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

function SharePageContent() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");

  const [trip, setTrip] = useState<WithId<Trip> | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flipbookOpen, setFlipbookOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (!tripId) {
      setError("No trip ID provided");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // Fetch trip
        const tripDoc = await getDoc(doc(db, "trips", tripId));
        if (!tripDoc.exists()) {
          setError("Trip not found");
          setLoading(false);
          return;
        }

        setTrip({ id: tripDoc.id, ...(tripDoc.data() as any) });

        // Fetch media
        const mediaQuery = query(
          collection(db, "trips", tripId, "media"),
          orderBy("createdAt", "desc")
        );
        const mediaSnap = await getDocs(mediaQuery);
        const mediaArr: MediaItem[] = [];
        mediaSnap.forEach((d) => mediaArr.push({ id: d.id, ...(d.data() as any) }));
        setMedia(mediaArr);

        setLoading(false);
      } catch (err) {
        console.error("Error loading trip:", err);
        setError("Failed to load trip");
        setLoading(false);
      }
    })();
  }, [tripId]);

  // Dismiss banner and store in localStorage
  const dismissBanner = () => {
    setBannerDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("shareBannerDismissed", "true");
    }
  };

  // Check if banner was previously dismissed
  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem("shareBannerDismissed");
      if (dismissed === "true") {
        setBannerDismissed(true);
      }
    }
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading trip...</div>
      </main>
    );
  }

  if (error || !trip) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="card max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600">Error</h1>
          <p className="mt-2 text-muted-foreground">{error || "Trip not found"}</p>
          <Link href="/" className="btn mt-4">
            Go to Home
          </Link>
        </div>
      </main>
    );
  }

  // Get cover image
  const coverImage = media.find((m) => m.type === "image" && m.id === trip.coverMediaId) || media.find((m) => m.type === "image");

  return (
    <>
      <main className="min-h-screen bg-background">
        {/* Subscribe Banner */}
        {!bannerDismissed && (
          <div className="bg-gradient-to-r from-primary/90 to-primary/70 text-white">
            <div className="container py-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="font-semibold">Love this? Create your own trip journal!</div>
                <p className="text-sm text-white/90 mt-1">
                  Join Ten Miles Ahead to document your adventures, upload photos, and share with the world.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/subscribe" className="btn bg-white text-primary hover:bg-white/90">
                  Get Started
                </Link>
                <button
                  onClick={dismissBanner}
                  className="text-white/80 hover:text-white text-sm underline"
                  aria-label="Dismiss banner"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trip Content */}
        <div className="container py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Trip Header */}
            <div className="card">
              {coverImage && (
                <div className="aspect-[21/9] w-full rounded-xl overflow-hidden bg-surface mb-4">
                  <img
                    src={coverImage.downloadURL}
                    alt={trip.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <h1 className="text-3xl font-bold">{trip.name}</h1>

              <div className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Destination</div>
                  <div className="font-medium">
                    {[trip.city, trip.state, trip.country].filter(Boolean).join(", ") || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Dates</div>
                  <div className="font-medium">
                    {fmtMDY(trip.startDate)} → {fmtMDY(trip.endDate)}
                  </div>
                </div>
                {trip.transportationType && (
                  <div>
                    <div className="text-muted-foreground">Transportation</div>
                    <div className="font-medium">{trip.transportationType}</div>
                  </div>
                )}
                {trip.description && (
                  <div className="sm:col-span-2">
                    <div className="text-muted-foreground">Description</div>
                    <div className="font-medium">{trip.description}</div>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <button
                  className="btn"
                  onClick={() => setFlipbookOpen(true)}
                  disabled={media.length === 0}
                >
                  {media.length === 0 ? "No Photos Yet" : `View Trip Photos (${media.length})`}
                </button>
              </div>
            </div>

            {/* Media Grid */}
            {media.length > 0 && (
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">Photos & Videos</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {media.slice(0, 9).map((item) => (
                    <div
                      key={item.id}
                      className="aspect-square rounded-xl overflow-hidden bg-surface cursor-pointer hover:opacity-80 transition"
                      onClick={() => setFlipbookOpen(true)}
                    >
                      {item.type === "image" ? (
                        <img
                          src={item.downloadURL}
                          alt={item.caption || ""}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={item.downloadURL}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                        />
                      )}
                    </div>
                  ))}
                </div>
                {media.length > 9 && (
                  <div className="mt-4 text-center">
                    <button className="navlink" onClick={() => setFlipbookOpen(true)}>
                      View all {media.length} photos
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CTA Footer */}
            <div className="card bg-gradient-to-br from-primary/10 to-primary/5 text-center">
              <h3 className="text-2xl font-bold">Ready to start your own travel journal?</h3>
              <p className="mt-2 text-muted-foreground">
                Sign up for Ten Miles Ahead and create beautiful trip memories like this one.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link href="/subscribe" className="btn">
                  Get Started
                </Link>
                <Link href="/signin" className="navlink">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Flipbook Modal */}
      {flipbookOpen && tripId && (
        <Flipbook tripId={tripId} open={flipbookOpen} onClose={() => setFlipbookOpen(false)} />
      )}
    </>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </main>
      }
    >
      <SharePageContent />
    </Suspense>
  );
}
