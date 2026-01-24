// components/SiteFooter.tsx
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t mt-12 bg-white">
      <div className="container py-8 grid md:grid-cols-3 gap-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand"></div>
            <span className="font-bold">Ten Miles Ahead</span>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Travel journals, photo flipbooks, and shared adventures.
          </p>
          <div className="mt-4 flex gap-2">
            <a
              href="https://play.google.com/store"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                alt="Get it on Google Play"
                className="h-10 w-auto"
              />
            </a>
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                alt="Download on the App Store"
                className="h-10 w-auto"
              />
            </a>
          </div>
        </div>

        <div className="text-sm space-y-2">
          <div className="font-semibold">Explore</div>
          <div className="flex gap-4">
            <Link className="link" href="/faqs">
              FAQs
            </Link>
            <Link className="link" href="/tutorials">
              Tutorials
            </Link>
            <Link className="link" href="/subscribe">
              Subscribe
            </Link>
          </div>
        </div>

        <div className="text-sm space-y-2">
          <div className="font-semibold">Legal</div>
          <div className="flex gap-4">
            <Link className="link" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="link" href="/terms">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t text-center text-xs text-slate-500 py-4">
        © {new Date().getFullYear()} Ten Miles Ahead. All rights reserved.
      </div>
    </footer>
  );
}
