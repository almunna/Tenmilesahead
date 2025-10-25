// components/StoreBadges.tsx
import Link from "next/link";

export default function StoreBadges() {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Replace hrefs with your live links when ready */}
      <Link href="https://apps.apple.com/" className="inline-flex">
        <img
          src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
          alt="Download on the App Store"
          className="h-10"
        />
      </Link>
      <Link href="https://play.google.com/store" className="inline-flex">
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
          alt="Get it on Google Play"
          className="h-10"
        />
      </Link>
      {/* Optional: Stripe subscription link */}
      <Link href="/subscribe" className="btn">
        Subscribe (Stripe)
      </Link>
    </div>
  );
}
