"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ModalShell from "./ModalShell";

export default function ShareTripModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const [link, setLink] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setLink(`${base}/share?tripId=${encodeURIComponent(tripId)}`);
  }, [tripId]);

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
    const input = document.querySelector('input[readonly]') as HTMLInputElement;
    if (input) {
      try {
        input.select();
        input.setSelectionRange(0, 99999); // For mobile devices

        const successful = document.execCommand('copy');
        if (successful) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          alert("Unable to copy. Please select the text and copy manually (Ctrl+C or Cmd+C).");
        }
      } catch (error) {
        console.error("Fallback copy failed:", error);
        alert("Unable to copy. Please select the text and copy manually (Ctrl+C or Cmd+C).");
      }
    } else {
      alert("Unable to copy. Please select the text and copy manually (Ctrl+C or Cmd+C).");
    }
  };

  return (
    <ModalShell title="Share Trip" onClose={onClose}>
      <p className="text-sm">
        Anyone with this link can view your flipbook—no account needed.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          className="btn"
          onClick={handleCopy}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-border p-4 text-sm bg-haiti-800/5">
        <div className="font-semibold mb-2">No account? No worries.</div>
        <p>
          But if you want the coolest photo journaling app ever invented— we're
          just sitting here looking cute, waiting for you to sign up. 😎
        </p>
        <div className="mt-3">
          <Link className="btn" href="/subscribe">
            Subscribe
          </Link>
        </div>
      </div>
    </ModalShell>
  );
}
