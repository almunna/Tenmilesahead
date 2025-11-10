"use client";

import { Trip } from "@/lib/types";

type WithId<T> = T & { id: string };

export default function WorldMap({
  trips,
  onOpenFlip,
}: {
  trips: WithId<Trip>[];
  onOpenFlip: (tripId: string) => void;
}) {
  return (
    <section className="card">
      <h2 className="text-xl font-semibold">World Map</h2>
      <p className="text-muted-foreground text-sm mt-1">
        Countries you’ve visited are shaded; pins mark your trip cities. Click a
        pin to open the trip.
      </p>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <div className="min-h-[280px] rounded-xl bg-haiti-800/5 flex items-center justify-center">
          <span className="text-sm text-muted-foreground">
            (Map goes here — ready to hook up to your preferred library)
          </span>
        </div>

        <div className="rounded-xl border border-border p-3">
          <div className="text-sm font-semibold mb-2">Trip Pins</div>
          <ul className="max-h-64 overflow-auto text-sm space-y-1">
            {trips.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2"
              >
                <div className="truncate">
                  <span className="mr-2">📍</span>
                  {t.city || "—"}, {t.state ? `${t.state}, ` : ""}
                  {t.country || "—"}
                </div>
                <button
                  className="navlink text-xs"
                  onClick={() => onOpenFlip(t.id)}
                >
                  View Flipbook
                </button>
              </li>
            ))}
            {trips.length === 0 && (
              <li className="text-muted-foreground">No trips yet.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        • Country shading uses the first time you visit a country • Pins drop at
        address if present, otherwise city center.
      </div>
    </section>
  );
}
