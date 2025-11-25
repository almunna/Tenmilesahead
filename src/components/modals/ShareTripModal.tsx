"use client";

import { useState, useEffect } from "react";
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Trip, MediaItem } from "@/lib/types";
import Link from "next/link";

function fmtMDY(s: string | undefined | null) {
  if (!s) return "";
  const str = typeof s === "string" ? s : String(s);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  const m2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);
  if (m2) return str;
  return str;
}

export default function ShareTripModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const [link, setLink] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [coverMedia, setCoverMedia] = useState<MediaItem | null>(null);
  const [coverFocus, setCoverFocus] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });

  useEffect(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setLink(`${base}/share?tripId=${encodeURIComponent(tripId)}`);
  }, [tripId]);

  // Fetch trip data
  useEffect(() => {
    const tripRef = doc(db, "trips", tripId);
    const unsub = onSnapshot(tripRef, (snap) => {
      if (snap.exists()) {
        const tripData = { id: snap.id, ...(snap.data() as any) } as Trip;
        setTrip(tripData);

        // Set cover focus from trip data
        const cf: any = (tripData as any).coverFocus;
        if (cf && typeof cf.x === "number" && typeof cf.y === "number") {
          setCoverFocus({ x: cf.x, y: cf.y });
        }
      }
    });
    return () => unsub();
  }, [tripId]);

  // Fetch cover media
  useEffect(() => {
    if (!trip?.coverMediaId) return;

    const mediaQuery = query(
      collection(db, "trips", tripId, "media"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(mediaQuery, (snap) => {
      snap.forEach((doc) => {
        if (doc.id === trip.coverMediaId) {
          setCoverMedia({ id: doc.id, ...(doc.data() as any) } as MediaItem);
        }
      });
    });
    return () => unsub();
  }, [tripId, trip?.coverMediaId]);

  const handleCopy = async () => {
    if (!link) {
      alert("Link not ready yet. Please wait a moment.");
      return;
    }

    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch (error) {
        console.error("Clipboard API failed:", error);
        // Fall through to fallback method
      }
    }

    // Fallback method using execCommand
    const input = document.querySelector("input[readonly]") as HTMLInputElement;
    if (input) {
      try {
        input.select();
        input.setSelectionRange(0, 99999); // For mobile devices

        const successful = document.execCommand("copy");
        if (successful) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          alert(
            "Unable to copy. Please select the text and copy manually (Ctrl+C or Cmd+C)."
          );
        }
      } catch (error) {
        console.error("Fallback copy failed:", error);
        alert(
          "Unable to copy. Please select the text and copy manually (Ctrl+C or Cmd+C)."
        );
      }
    } else {
      alert(
        "Unable to copy. Please select the text and copy manually (Ctrl+C or Cmd+C)."
      );
    }
  };

  return (
    <div
      className="fixed inset-x-0 top-[60px] bottom-0 z-[100] bg-black/50 flex items-stretch md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="
          w-full max-w-full md:max-w-2xl lg:max-w-3xl
          h-auto max-h-[80vh]
          bg-surface text-foreground border border-border shadow-lg
          md:rounded-xl
          flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/70 border-b border-border">
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            <h3 className="text-lg font-semibold">Share Trip</h3>
            <button className="navlink" onClick={onClose} aria-label="Close">
              Close
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 px-4 md:px-6 py-4 overflow-y-auto space-y-4">
          {/* Cover Photo Preview */}
          {trip && (
            <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-lg">
              {/* Background Image */}
              {coverMedia ? (
                coverMedia.type === "image" ? (
                  <img
                    src={coverMedia.downloadURL}
                    alt={trip.name || "Cover"}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      objectPosition: `${coverFocus.x}% ${coverFocus.y}%`,
                    }}
                  />
                ) : (
                  <video
                    src={coverMedia.downloadURL}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      objectPosition: `${coverFocus.x}% ${coverFocus.y}%`,
                    }}
                    muted
                    playsInline
                  />
                )
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900" />
              )}

              {/* Dark gradient overlay at bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

              {/* Text overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 text-white">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                  {trip.name}
                </h2>

                <div className="flex items-start gap-2 mb-1.5">
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm md:text-base">
                    {[trip.city, trip.state, trip.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm md:text-base">
                    {fmtMDY(trip.startDate)} → {fmtMDY(trip.endDate)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <p className="text-sm">
            Anyone with this link can view your flipbook—no account needed.
          </p>

          <div className="flex gap-2">
            <input
              className="input flex-1"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button className="btn" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <div className="rounded-xl border border-border p-4 text-sm bg-haiti-800/5">
            <div className="font-semibold mb-2">No account? No worries.</div>
            <p>
              But if you want the coolest photo journaling app ever invented—
              we're just sitting here looking cute, waiting for you to sign up.
              😎
            </p>
            <div className="mt-3">
              <Link className="btn" href="/subscribe">
                Subscribe
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
