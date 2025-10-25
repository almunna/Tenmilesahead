// app/subscribe/page.tsx
import Link from "next/link";

export default function SubscribePage() {
  return (
    <div className="container py-10 space-y-6">
      <h1 className="text-3xl font-bold">Subscribe</h1>
      <p className="text-slate-600">
        Subscribe on the web via Stripe or install the mobile app to subscribe
        via your app store.
      </p>
      <div className="card space-y-3">
        <p>Connect your Stripe checkout/session here.</p>
        {/* Replace the href with your Stripe Checkout link or build a server route */}
        <Link href="#" className="btn">
          Continue with Stripe
        </Link>
      </div>
      <div className="card">
        <p className="mb-3">Or download the app:</p>
        <div className="flex gap-3">
          <img
            src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
            alt="App Store"
            className="h-10"
          />
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
            alt="Google Play"
            className="h-10"
          />
        </div>
      </div>
    </div>
  );
}
