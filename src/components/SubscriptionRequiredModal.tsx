"use client";

import Link from "next/link";

interface SubscriptionRequiredModalProps {
  title?: string;
  description?: string;
}

const FEATURES = [
  "Smart Trip Management",
  "Photo Uploader with captions",
  "Flipbook Viewer",
  "Flexible Date Editing",
  "Advanced Exports (CSV, PDF)",
  "Private Share Links",
  "Global Reviews",
  "Multi-Device Access",
];

export default function SubscriptionRequiredModal({
  title = "Homepage",
  description = "Access to this page requires an active subscription.",
}: SubscriptionRequiredModalProps) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="card overflow-hidden p-0">
          {/* Header with gradient matching app theme */}
          <div className="relative bg-gradient-to-r from-primary via-primary-600 to-primary-700 px-6 pt-8 pb-10">
            {/* Premium badge */}
            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full mb-4">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Premium Required
            </div>

            {/* Lock icon */}
            <div className="absolute top-6 right-6 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="text-white/80 mt-1 text-sm">{description}</p>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Subscribe to unlock section */}
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="font-semibold text-foreground">Subscribe to unlock:</span>
            </div>

            {/* Features list */}
            <ul className="space-y-3 mb-6">
              {FEATURES.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA Button - matches app's btn style */}
            <Link
              href="/subscribe"
              className="btn w-full justify-center py-3.5 text-base font-semibold"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              View Subscription Plans
            </Link>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-border">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>7-Day Free Trial</span>
              </div>
              <div className="flex flex-col items-center text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium text-foreground">Cancel Anytime</span>
                </div>
                <span className="text-xs">No commitments</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom link */}
        <div className="text-center mt-6">
          <span className="text-sm text-muted-foreground">
            Already have a subscription?{" "}
            <Link href="/subscribe/manage" className="link font-medium">
              Check your account
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
