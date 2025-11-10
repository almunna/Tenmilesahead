"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function Navbar() {
  const { user, signOutNow, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <nav className="border-b bg-white sticky top-0 z-40">
      <div className="container flex items-center justify-between py-3">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Ten Miles Ahead"
              className="w-8 h-8 rounded-m bg-slate-100"
            />
            <span className="font-bold">Ten Miles Ahead</span>
          </Link>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          <Link className="navlink" href="/trips">
            Trips
          </Link>
          <Link className="navlink" href="/reviews">
            Global Reviews
          </Link>

          <Link className="navlink" href="/faqs">
            FAQs
          </Link>
          <Link className="navlink" href="/tutorials">
            Tutorials
          </Link>
          <Link className="navlink" href="/subscribe">
            Subscribe
          </Link>

          {user ? (
            <>
              <Link className="navlink" href="/profile">
                @{profile?.username || "you"}
              </Link>
              <button className="btn" onClick={() => signOutNow()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link className="navlink" href="/signin">
                Sign in
              </Link>
              <Link className="btn" href="/signup">
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile: hamburger */}
        <div className="md:hidden">
          <button
            className="p-2 rounded-lg border"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          >
            {/* Simple icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 7h18M3 12h18M3 17h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-5/6 max-w-xs bg-white shadow-xl p-5 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src="/logo.svg"
                  alt="Ten Miles Ahead"
                  className="w-8 h-8 rounded-xl bg-brand"
                />
                <span className="font-bold">Ten Miles Ahead</span>
              </div>
              <button
                aria-label="Close menu"
                className="p-2 rounded-lg border"
                onClick={() => setOpen(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 6l12 12M18 6l-12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <nav className="mt-6 flex flex-col gap-2">
              <Link className="navlink" href="/trips">
                Trips
              </Link>
              <Link className="navlink" href="/reviews">
                Global Reviews
              </Link>

              <Link className="navlink" href="/faqs">
                FAQs
              </Link>
              <Link className="navlink" href="/tutorials">
                Tutorials
              </Link>
              <Link className="navlink" href="/subscribe">
                Subscribe
              </Link>

              <div className="h-px bg-slate-200 my-3" />

              {user ? (
                <>
                  <Link className="navlink" href="/profile">
                    @{profile?.username || "you"}
                  </Link>
                  <button className="btn" onClick={() => signOutNow()}>
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link className="navlink" href="/signin">
                    Sign in
                  </Link>
                  <Link className="btn" href="/signup">
                    Get started
                  </Link>
                </>
              )}
            </nav>

            {/* Optional footer text inside drawer */}
            <div className="mt-auto pt-6 text-xs text-slate-500">
              © {new Date().getFullYear()} Ten Miles Ahead
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
