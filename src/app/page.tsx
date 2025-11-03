// app/page.tsx
import Link from "next/link";

/** --- FAQ DATA --- */
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

/** --- FEATURE DATA (8 tiles like the SS) --- */
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

export default function Landing() {
  return (
    // make page content sit above the decorative site-bg layers
    <main className="bg-background relative z-10">
      {/* ————————— HERO ————————— */}
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
            <div className="btn">Start Your Journey!</div>
            <div className="flex items-center gap-3">
              {/* Replace with real store badge images/links when ready */}
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
          <p className=" mt-2 text-muted-foreground">
            Start Your Journey to be a link to subscription page
          </p>
        </div>
      </section>

      {/* ————————— FEATURE GRID (like SS with many tiles) ————————— */}
      <section className="container py-10">
        <h2 className="text-center text-2xl md:text-3xl font-bold">
          Everything You Need to Manage Your Trips
        </h2>
        <p className="text-center text-muted-foreground mt-2">
          Effortlessly document all your journeys, from weekend getaways to epic
          adventures across the globe.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <FeatureCard key={i} title={f.title} bullets={f.bullets} />
          ))}
        </div>
      </section>

      {/* ————————— VALUE STRIP (gradient band with 3 points) ————————— */}
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

      {/* ————————— PRICING (two cards; annual highlighted) ————————— */}
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
            price="$2.50"
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
            price="$19.99"
            period="/yr"
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

      {/* ————————— FAQ (accordion list like SS) ————————— */}
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

      {/* ————————— FINAL CTA (footer-like) ————————— */}
      <section className="container py-12 text-center">
        <h2 className="text-2xl md:text-3xl font-bold">
          Ready to Transform Your Travel Journal?
        </h2>
        <p className="text-muted-foreground mt-2">
          Join travelers already saving time and staying organized with Ten
          Miles Ahead.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link className="btn" href="/trip">
            Get Started{" "}
          </Link>
          <Link className="navlin" href="/signi">
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

/** ——— Helpers ——— */

function FeatureCard({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <div className="card">
      <div className="flex items-start gap-3">
        {/* Icon placeholder (keeps your palette) */}
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
  bullets,
  highlight,
  cta,
}: {
  label: string;
  badge?: string;
  price: string;
  period: string;
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

      <ul className="mt-4 space-y-2 text-muted-foreground text-sm">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 inline-block w-2 h-2 rounded-full bg-primary/80" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {/* Make both buttons identical (remove highlight-based width) */}
      <Link href={cta.href} className="btn mt-6">
        {cta.text}
      </Link>
    </div>
  );
}
