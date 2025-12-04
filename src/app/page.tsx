// app/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import Protected from "@/components/Protected";
import { useAuth } from "@/components/AuthProvider";
import Flipbook from "@/components/Flipbook";
import SubscriptionRequiredModal from "@/components/SubscriptionRequiredModal";

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Trip, MediaItem } from "@/lib/types";

import MyTrips from "@/components/MyTrips";
import WorldMap from "@/components/WorldMap";
import TravelOverview from "@/components/TravelOverview";

/* ============================== LANDING (logged out) ============================== */

const faqs = [
  {
    q: "What is Ten Miles Ahead?",
    a: "Ten Miles Ahead is a dynamic travel journal app designed for modern explorers to log trips, create photo stories, and share adventures with a global community.",
  },
  {
    q: "How do I log a new trip?",
    a: "From your dashboard, click 'Add Trip', fill destination and dates, then save.",
  },
  {
    q: "Can I add photos to my trips?",
    a: "Yes—upload photos and add notes. Your trip becomes a beautiful flipbook.",
  },
  {
    q: "How do I share my trip?",
    a: "Generate a private share link. Anyone with the link can view—no account needed.",
  },
  {
    q: "Is my data secure?",
    a: "We use robust authentication and Firestore rules to protect your data.",
  },
  {
    q: "Does my subscription include updates?",
    a: "Yes—new features and improvements are included while subscribed.",
  },
];

const features = [
  {
    title: "Smart Trip Management",
    bullets: [
      "Create trips in seconds",
      "Edit details anytime",
      "Archive when you’re done",
    ],
  },
  {
    title: "Photo Uploader",
    bullets: [
      "Drag & drop bulk upload",
      "Per-photo captions",
      "Set trip cover",
    ],
  },
  {
    title: "Flipbook Viewer",
    bullets: [
      "All media in one place",
      "Smooth navigation",
      "Mobile & desktop ready",
    ],
  },
  {
    title: "Flexible Date Editing",
    bullets: ["Adjust if plans shift", "Clean timeline", "Stay consistent"],
  },
  {
    title: "Advanced Exports",
    bullets: ["CSV export (soon)", "PDF flipbook (soon)", "Media backups"],
  },
  {
    title: "Share Privately",
    bullets: [
      "Private share links",
      "No account required to view",
      "Control visibility",
    ],
  },
  {
    title: "Global Reviews",
    bullets: [
      "Discover places to go",
      "See what travelers love",
      "Get inspired",
    ],
  },
  {
    title: "Multi-Device Access",
    bullets: ["Seamless sync", "Fast on mobile", "Works anywhere"],
  },
];

function Landing() {
  const { user } = useAuth();
  const router = useRouter();

  const handleStartJourney = () => {
    if (user) router.push("/");
    else router.push("/signin?redirect=/");
  };

  return (
    <main className="relative z-10">
      <section className="py-12 md:py-16 bg-surface/50">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Your Adventure <span className="text-primary">Awaits</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            Ten Miles Ahead is the ultimate travel journal for modern explorers.
            Log your trips, create beautiful photo stories, and share your
            journey with the world
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button className="btn" onClick={handleStartJourney}>
              Start Your Journey!
            </button>
            <div className="flex items-center gap-3">
              <a
                className="btn"
                href="/subscrib"
                aria-label="Get it on Google Play"
              >
                Google Play
              </a>
              <a
                className="btn"
                href="/subscrie"
                aria-label="Download on the App Store"
              >
                App Store
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-10">
        <h2 className="text-center text-2xl md:text-3xl font-bold">
          Everything You Need to Manage Your Trips
        </h2>
        <p className="text-center text-muted-foreground mt-2">
          Effortlessly document all your journeys, from weekend getaways to epic
          adventures across the globe.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((f, i) => (
            <FeatureCard key={i} title={f.title} bullets={f.bullets} />
          ))}
        </div>
      </section>

      <section className="py-12">
        <div className="container">
          <div className="card bg-gradient-to-br from-primary/15 to-primary/5 text-center">
            <h3 className="text-2xl font-bold">
              Why Travelers Love Ten Miles Ahead
            </h3>
            <div className="mt-6 grid gap-6 md:grid-cols-3 text-foreground">
              <ValueItem
                title="Save Time"
                text="Bulk uploads and clear organization so you can focus on your adventures."
              />
              <ValueItem
                title="Better Insights"
                text="Flipbooks and timelines help you remember, reflect, and share."
              />
              <ValueItem
                title="Stay Organized"
                text="Your trips, photos, and notes are always tidy and easy to access."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="container py-12">
        <h2 className="text-center text-2xl md:text-3xl font-bold">
          Simple, Affordable Pricing
        </h2>
        <p className="text-center text-muted-foreground mt-2">
          Choose the plan that works for you
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          <PricingCard
            label="Monthly Plan"
            price="$4.99"
            period="/mo"
            bullets={[
              "Unlimited trips & flipbooks",
              "Private share links",
              "Sync across all your devices",
              "Early access to new features",
              "Offline flipbook (soon)",
              "Export PDF/CSV (soon)",
            ]}
            cta={{ href: "/subscribe", text: "Choose Monthly" }}
          />
          <PricingCard
            label="Annual Plan"
            badge="Best value"
            price="$39.99"
            period="/yr"
            savings="Save $19.89 annually"
            bullets={[
              "Everything in Monthly",
              "Priority support for creators",
              "Bonus: 2 months free vs monthly",
              "Perfect for frequent travelers",
              "Advanced media backups",
              "Early access to experimental features",
            ]}
            highlight
            cta={{ href: "/subscribe", text: "Choose Annual" }}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Launch pricing — secure your rate.
        </p>
      </section>

      <section className="container py-12">
        <h2 className="text-center text-2xl md:text-3xl font-bold">
          Frequently Asked Questions
        </h2>
        <p className="text-center text-muted-foreground mt-2">
          Get answers to common questions
        </p>
        <div className="mt-6 space-y-3 max-w-3xl mx-auto">
          {faqs.map((f, i) => (
            <details key={i} className="card">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <div className="mt-2 text-foreground">{f.a}</div>
            </details>
          ))}

          <div className="card text-center">
            <div className="font-semibold">Still have questions?</div>
            <p className="text-muted-foreground mt-1">We’re here to help.</p>
            <div className="mt-3 flex justify-center gap-4">
              <a className="navlink" href="mailto:admin@tenmilesahead.com">
                Contact Us
              </a>
              <Link className="navlink" href="/faq">
                View All FAQs
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-12 text-center">
        <h2 className="text-2xl md:text-3xl font-bold">
          Ready to Transform Your Travel Journal?
        </h2>
        <p className="text-muted-foreground mt-2">
          Join travelers already saving time and staying organized with Ten
          Miles Ahead.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button className="btn" onClick={handleStartJourney}>
            Get Started
          </button>
          <Link className="navlink" href="/signin">
            Sign in
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          No setup. Cancel anytime. Secure payments.
        </p>
      </section>
    </main>
  );
}

function FeatureCard({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-primary/80" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <ul className="mt-3 space-y-2 text-muted-foreground text-sm">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 inline-block w-2 h-2 rounded-full bg-primary/80" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ValueItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="px-2">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-primary/80" />
      </div>
      <div className="mt-3 text-lg font-semibold">{title}</div>
      <p className="text-foreground mt-1">{text}</p>
    </div>
  );
}

function PricingCard({
  label,
  badge,
  price,
  period,
  savings,
  bullets,
  highlight,
  cta,
}: {
  label: string;
  badge?: string;
  price: string;
  period: string;
  savings?: string;
  bullets: string[];
  highlight?: boolean;
  cta: { href: string; text: string };
}) {
  return (
    <div
      className={`card relative ${highlight ? "ring-2 ring-primary/70" : ""}`}
    >
      {badge && (
        <div className="absolute -top-3 right-3 text-xs bg-primary/90 text-foreground px-2 py-1 rounded-md">
          {badge}
        </div>
      )}

      <div className="text-foreground">{label}</div>
      <div className="mt-1 flex items-end gap-2">
        <div className="text-3xl font-bold">{price}</div>
        <div className="text-muted-foreground mb-1">{period}</div>
      </div>
      {savings && <div className="text-sm text-primary/80 mt-1">{savings}</div>}

      <ul className="mt-4 space-y-2 text-muted-foreground text-sm">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 inline-block w-2 h-2 rounded-full bg-primary/80" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <Link href={cta.href} className="btn mt-6">
        {cta.text}
      </Link>
    </div>
  );
}

/* ============================== DASHBOARD (logged in) ============================== */

type WithId<T> = T & { id: string };

function HomeDashboard() {
  return (
    <Protected>
      <HomeInner />
    </Protected>
  );
}

export default function Page() {
  const { user } = useAuth();
  return user ? <HomeDashboard /> : <Landing />;
}

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

// Helper function to calculate distance between two locations using Haversine formula
async function calculateDistance(
  originCity: string | null | undefined,
  originState: string | null | undefined,
  originCountry: string | null | undefined,
  destCity: string,
  destState: string | null | undefined,
  destCountry: string
): Promise<number> {
  // If no origin location, return 0
  if (!originCity && !originCountry) {
    return 0;
  }

  try {
    // Build location strings
    const originParts = [originCity, originState, originCountry].filter(Boolean);
    const destParts = [destCity, destState, destCountry].filter(Boolean);

    if (originParts.length === 0 || destParts.length === 0) {
      return 0;
    }

    const originLocation = originParts.join(", ");
    const destLocation = destParts.join(", ");

    // Use geocoding API to get coordinates
    const [originCoords, destCoords] = await Promise.all([
      geocodeLocation(originLocation),
      geocodeLocation(destLocation),
    ]);

    if (!originCoords || !destCoords) {
      return 0;
    }

    // Calculate distance using Haversine formula
    const R = 3958.8; // Earth's radius in miles
    const lat1 = (originCoords.lat * Math.PI) / 180;
    const lat2 = (destCoords.lat * Math.PI) / 180;
    const dLat = ((destCoords.lat - originCoords.lat) * Math.PI) / 180;
    const dLon = ((destCoords.lon - originCoords.lon) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  } catch (error) {
    console.error("Error calculating distance:", error);
    return 0;
  }
}

// Helper function to geocode a location string to coordinates
async function geocodeLocation(
  location: string
): Promise<{ lat: number; lon: number } | null> {
  try {
    // Parse location string (expected format: "city, state, country" or "city, country")
    const parts = location.split(",").map((p) => p.trim());
    const city = parts[0] || "";
    const country = parts[parts.length - 1] || "";

    // Use our API route to avoid CORS issues
    const response = await fetch(
      `/api/geocode?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data && data.coordinates) {
      return {
        lon: data.coordinates[0],
        lat: data.coordinates[1],
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

/** Upcoming Trips Countdown - shows countdown to all future trips */
function UpcomingTripCountdown({ trips }: { trips: WithId<Trip>[] }) {
  const [now, setNow] = useState(() => new Date());

  // Update every second to keep countdown accurate
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Find all future trips (startDate > today), sorted by start date
  const upcomingTrips = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return trips
      .filter((t) => {
        if (!t.startDate) return false;
        const startDate = new Date(t.startDate);
        startDate.setHours(0, 0, 0, 0);
        return startDate > today;
      })
      .sort((a, b) => {
        const aDate = new Date(a.startDate!);
        const bDate = new Date(b.startDate!);
        return aDate.getTime() - bDate.getTime();
      });
  }, [trips]);

  // Calculate countdown for a specific trip
  const getCountdown = (startDateStr: string) => {
    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);

    const diffMs = startDate.getTime() - now.getTime();
    if (diffMs <= 0) return null;

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  };

  if (upcomingTrips.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/20 space-y-4">
      <p className="text-lg text-white/80 font-semibold">
        Upcoming Trips
      </p>
      {upcomingTrips.map((trip) => {
        const countdown = getCountdown(trip.startDate!);
        if (!countdown) return null;

        const destination = [trip.city, trip.country].filter(Boolean).join(", ");

        return (
          <div key={trip.id} className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate text-white">{trip.name}</p>
              {destination && (
                <p className="text-sm text-white/70 truncate">{destination}</p>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="flex items-center gap-1 justify-end">
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{countdown.days}</p>
                  <p className="text-[9px] text-white/70 uppercase">days</p>
                </div>
                <span className="text-lg font-bold text-white/50">:</span>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{String(countdown.hours).padStart(2, "0")}</p>
                  <p className="text-[9px] text-white/70 uppercase">hrs</p>
                </div>
                <span className="text-lg font-bold text-white/50">:</span>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{String(countdown.minutes).padStart(2, "0")}</p>
                  <p className="text-[9px] text-white/70 uppercase">min</p>
                </div>
                <span className="text-lg font-bold text-white/50">:</span>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{String(countdown.seconds).padStart(2, "0")}</p>
                  <p className="text-[9px] text-white/70 uppercase">sec</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HomeInner() {
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
        title="Homepage"
        description="Access to the homepage requires an active subscription."
      />
    );
  }

  // Display name editor (animates up then hides after successful save)
  const [username, setUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameAnimating, setUsernameAnimating] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);

  useEffect(() => {
    if (!user) return;
    const uref = doc(db, "users", user.uid);
    const unsub = onSnapshot(uref, (snap) => {
      const d = snap.data() as any;
      const savedUsername = d?.username || "";
      setUsername(savedUsername);
      setUsernameInput(savedUsername);
    });
    return () => unsub();
  }, [user]);

  async function saveUsername() {
    if (!user || !usernameInput.trim()) return;
    setUsernameSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email || null,
          username: usernameInput.trim(),
          updatedAt: Date.now(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      // If this was the initial setup, trigger slide-up animation
      if (!username) {
        setUsernameAnimating(true);
      } else {
        // If editing, just close the editor
        setIsEditingUsername(false);
      }
    } finally {
      setUsernameSaving(false);
    }
  }

  // Trips (unchanged subscription)
  const [trips, setTrips] = useState<WithId<Trip>[]>([]);
  useEffect(() => {
    if (!user) return;
    const qTrips = query(
      collection(db, "trips"),
      where("ownerId", "==", user.uid),
      orderBy("startDate", "desc")
    );
    const unsub = onSnapshot(qTrips, (snap) => {
      const arr: WithId<Trip>[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setTrips(arr);
    });
    return () => unsub();
  }, [user]);

  // Aggregates for TravelOverview
  const [travelStats, setTravelStats] = useState({
    totalTrips: 0,
    daysExplored: 0,
    photosCaptured: 0,
    totalMiles: 0,
    countriesVisited: 0,
    statesVisited: 0,
    citiesVisited: 0,
    transportationCounts: {} as Record<string, number>,
    accommodationCounts: {} as Record<string, number>,
  });

  // Track subcollection changes to trigger stats recomputation
  const [statsVersion, setStatsVersion] = useState(0);

  // Set up real-time listeners for all trip subcollections
  useEffect(() => {
    if (!user || trips.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    // Listen to each trip's subcollections
    for (const trip of trips) {
      // Destinations
      unsubscribers.push(
        onSnapshot(collection(db, "trips", trip.id, "destinations"), () => {
          setStatsVersion((v) => v + 1);
        })
      );
      // Activities
      unsubscribers.push(
        onSnapshot(collection(db, "trips", trip.id, "activities"), () => {
          setStatsVersion((v) => v + 1);
        })
      );
      // Accommodations
      unsubscribers.push(
        onSnapshot(collection(db, "trips", trip.id, "accommodations"), () => {
          setStatsVersion((v) => v + 1);
        })
      );
      // Media
      unsubscribers.push(
        onSnapshot(collection(db, "trips", trip.id, "media"), () => {
          setStatsVersion((v) => v + 1);
        })
      );
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [user, trips]);

  // Compute stats when trips or subcollections change
  useEffect(() => {
    if (!user) return;
    (async () => {
      const tSnap = await getDocs(
        query(collection(db, "trips"), where("ownerId", "==", user.uid))
      );

      const cSet = new Set<string>();
      const sSet = new Set<string>();
      const citySet = new Set<string>();
      let imgTotal = 0;
      let totalDays = 0;
      let totalMiles = 0;
      const transportCounts: Record<string, number> = {};
      const accommodationCounts: Record<string, number> = {};

      for (const docSnap of tSnap.docs) {
        const t = docSnap.data() as Trip;

        // Track last location for chained distance calculation
        let lastCity = t.city;
        let lastState = t.state;
        let lastCountry = t.country;

        // Calculate distance from origin to main destination
        const tripDistance = await calculateDistance(
          t.originCity,
          t.originState,
          t.originCountry,
          lastCity,
          lastState,
          lastCountry
        );
        totalMiles += tripDistance;

        // Calculate days for this trip
        if (t.startDate && t.endDate) {
          const start = new Date(t.startDate);
          const end = new Date(t.endDate);
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          totalDays += days;
        }

        // Track locations (only destination locations, not origin)
        if (t.country) cSet.add(t.country);
        // Only count US states for the "States Visited (US)" stat
        const isUSA = t.country && ['united states', 'usa', 'us', 'united states of america'].includes(t.country.toLowerCase().trim());
        if (t.state && t.state.trim() && isUSA) sSet.add(t.state.trim());
        if (t.city) citySet.add(`${t.city}|${t.country || ""}`);

        // Track transportation from main trip (originTransportationType is used for the trip's primary transport)
        if (t.originTransportationType) {
          transportCounts[t.originTransportationType] = (transportCounts[t.originTransportationType] || 0) + 1;
        }

        // Note: Main trip's accommodationType is not counted here
        // Accommodations are only counted from the accommodations subcollection
        // to avoid double-counting

        // Destinations - fetch and sort by startDate for proper ordering
        const destSnap = await getDocs(
          collection(db, "trips", docSnap.id, "destinations")
        );
        const destinations = destSnap.docs
          .map((d) => d.data() as any)
          .sort((a, b) => {
            if (a.startDate && b.startDate) {
              return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
            }
            return 0;
          });

        // Calculate distances between consecutive destinations
        for (const dest of destinations) {
          // Calculate distance from last location to this destination
          if (dest.city && dest.country) {
            const segmentDistance = await calculateDistance(
              lastCity,
              lastState,
              lastCountry,
              dest.city,
              dest.state,
              dest.country
            );
            totalMiles += segmentDistance;

            // Update last location for next iteration
            lastCity = dest.city;
            lastState = dest.state;
            lastCountry = dest.country;
          }

          // Track locations from destinations
          if (dest.country) cSet.add(dest.country);
          // Only count US states for the "States Visited (US)" stat
          const destIsUSA = dest.country && ['united states', 'usa', 'us', 'united states of america'].includes(dest.country.toLowerCase().trim());
          if (dest.state && dest.state.trim() && destIsUSA) sSet.add(dest.state.trim());
          if (dest.city) citySet.add(`${dest.city}|${dest.country || ""}`);
          // Count transportation from destinations
          if (dest.transportationType) {
            transportCounts[dest.transportationType] = (transportCounts[dest.transportationType] || 0) + 1;
          }
        }

        // Activities subcollection
        const actSnap = await getDocs(
          collection(db, "trips", docSnap.id, "activities")
        );
        actSnap.forEach((a) => {
          const act = a.data() as any;
          // Count transportation from activities
          if (act.transportationType) {
            transportCounts[act.transportationType] = (transportCounts[act.transportationType] || 0) + 1;
          }
        });

        // Accommodations subcollection
        const accomSnap = await getDocs(
          collection(db, "trips", docSnap.id, "accommodations")
        );
        accomSnap.forEach((a) => {
          const acc = a.data() as any;
          if (acc.accommodationType) {
            accommodationCounts[acc.accommodationType] = (accommodationCounts[acc.accommodationType] || 0) + 1;
          }
          // Count transportation from accommodations
          if (acc.transportationType) {
            transportCounts[acc.transportationType] = (transportCounts[acc.transportationType] || 0) + 1;
          }
        });

        // Media (photos)
        const mediaSnap = await getDocs(
          collection(db, "trips", docSnap.id, "media")
        );
        mediaSnap.forEach((m) => {
          const mm = m.data() as MediaItem;
          if (mm.type === "image") imgTotal += 1;
        });
      }

      setTravelStats({
        totalTrips: tSnap.docs.length,
        daysExplored: totalDays,
        photosCaptured: imgTotal,
        totalMiles: totalMiles,
        countriesVisited: cSet.size,
        statesVisited: sSet.size,
        citiesVisited: citySet.size,
        transportationCounts: transportCounts,
        accommodationCounts: accommodationCounts,
      });
    })();
  }, [user, trips.length, statsVersion]);

  // Flipbook modal control
  const [flipTripId, setFlipTripId] = useState<string | null>(null);

  return (
    <main className="min-h-dvh relative z-10">
      <div className="container py-6 space-y-10">
        {/* Username editor - shows on first login OR when editing */}
        {(!username || isEditingUsername) && (
          <section
            className={`card ${usernameAnimating ? "tma-slideUpOut" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Name of your journal</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  This name is shown on Global Reviews. (Required)
                </p>
              </div>
              {isEditingUsername && (
                <button
                  className="navlink text-sm"
                  onClick={() => {
                    setIsEditingUsername(false);
                    setUsernameInput(username); // Reset to saved value
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <input
                className="input flex-1"
                placeholder="e.g., Williams' Family Adventures"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                required
              />
              <button
                className="btn"
                onClick={saveUsername}
                disabled={!usernameInput.trim() || usernameSaving}
              >
                {usernameSaving ? "Saving..." : "Save Name"}
              </button>
            </div>
          </section>
        )}

        {/* Display name with edit button - shows when username is set and not editing */}
        {username && !isEditingUsername && (
          <section className="rounded-2xl bg-primary p-6 text-white shadow-lg">
            <p className="text-3xl font-bold">Welcome {username}!</p>
            {/* Upcoming Trip Countdown */}
            <UpcomingTripCountdown trips={trips} />
          </section>
        )}

        {/* My Trips (moved to component) */}
        <MyTrips trips={trips} />

        {/* World Map (moved to component) */}
        <WorldMap trips={trips} onOpenFlip={(id) => setFlipTripId(id)} />

        {/* Travel Overview (moved to component) */}
        <TravelOverview stats={travelStats} />
      </div>

      {/* Flipbook modal (unchanged) */}
      {flipTripId && (
        <div className="fixed inset-x-0 top-[60px] bottom-0 z-[100] bg-black/70 flex items-center justify-center">
          <div className="relative w-[95vw] h-[92vh] bg-background rounded-xl overflow-hidden">
            <button
              className="absolute top-2 right-2 z-10 btn"
              onClick={() => setFlipTripId(null)}
            >
              Close
            </button>
            <div className="w-full h-full">
              <Flipbook
                tripId={flipTripId}
                open={true}
                onClose={() => setFlipTripId(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Local animation styles */}
      <style jsx>{`
        .tma-slideUpOut {
          animation: tma-slide-up-out 0.35s ease-in forwards;
          will-change: transform, opacity;
        }
        @keyframes tma-slide-up-out {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-24px);
          }
        }
      `}</style>
    </main>
  );
}
