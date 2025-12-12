"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ModalShell from "./ModalShell";
import ItemFlipbook from "./ItemFlipbook";

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

export default function ItineraryModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<
    Array<{ kind: string; subcollection: string; data: any }>
  >([]);
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    name: string;
    subcollection: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const rows: Array<{ kind: string; subcollection: string; data: any }> =
        [];

      // Fetch the main trip to add as primary destination
      const tripDoc = await getDoc(doc(db, "trips", tripId));
      if (tripDoc.exists()) {
        const trip = tripDoc.data();
        rows.push({
          kind: "Primary Destination",
          subcollection: "trip",
          data: {
            id: "trip-destination",
            name: trip.city || trip.country,
            city: trip.city,
            state: trip.state || null,
            country: trip.country,
            address: trip.specificAddress || null,
            startDate: trip.startDate,
            endDate: trip.endDate,
          },
        });
      }

      const dest = await getDocs(
        collection(db, "trips", tripId, "destinations")
      );
      dest.forEach((d) =>
        rows.push({
          kind: "Destination",
          subcollection: "destinations",
          data: { id: d.id, ...(d.data() as any) },
        })
      );
      const acts = await getDocs(collection(db, "trips", tripId, "activities"));
      acts.forEach((d) =>
        rows.push({
          kind: "Activity",
          subcollection: "activities",
          data: { id: d.id, ...(d.data() as any) },
        })
      );
      const acc = await getDocs(
        collection(db, "trips", tripId, "accommodations")
      );
      acc.forEach((d) =>
        rows.push({
          kind: "Accommodation",
          subcollection: "accommodations",
          data: { id: d.id, ...(d.data() as any) },
        })
      );
      const res = await getDocs(collection(db, "trips", tripId, "restaurants"));
      res.forEach((d) =>
        rows.push({
          kind: "Restaurant",
          subcollection: "restaurants",
          data: { id: d.id, ...(d.data() as any) },
        })
      );

      rows.sort((a, b) => {
        const sa = new Date(a.data.startDate || 0).getTime();
        const sb = new Date(b.data.startDate || 0).getTime();
        return sa - sb;
      });

      setItems(rows);
    })();
  }, [tripId]);

  return (
    <>
      <ModalShell title="Itinerary (chronological summary)" onClose={onClose}>
        <div className="text-sm text-muted-foreground mb-3">
          Click any entry to view its details and photos in a flipbook.
        </div>

        {/* Desktop table view - hidden on mobile */}
        <div className="hidden md:block rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Dates</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => {
                const d = row.data;
                return (
                  <tr
                    key={i}
                    className="border-t border-border hover:bg-surface/50"
                  >
                    <td className="px-3 py-2">{row.kind}</td>
                    <td className="px-3 py-2">{d.name || "—"}</td>
                    <td className="px-3 py-2">
                      {d.startDate ? (
                        <>
                          {fmtMDY(d.startDate)}
                          {d.endDate ? ` → ${fmtMDY(d.endDate)}` : ""}
                        </>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {[d.address, d.city, d.state, d.country]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.subcollection !== "trip" ? (
                        <button
                          className="text-xs navlink"
                          onClick={() =>
                            setSelectedItem({
                              id: d.id,
                              name: d.name,
                              subcollection: row.subcollection,
                            })
                          }
                        >
                          View Photos
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-4 text-center text-muted-foreground"
                  >
                    No entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card view - shown only on mobile */}
        <div className="md:hidden space-y-3">
          {items.length === 0 ? (
            <div className="rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">
              No entries yet.
            </div>
          ) : (
            items.map((row, i) => {
              const d = row.data;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-border p-3 bg-surface/50 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-primary mb-1">
                        {row.kind}
                      </div>
                      <div className="font-semibold text-sm truncate">
                        {d.name || "—"}
                      </div>
                    </div>
                    {row.subcollection !== "trip" && (
                      <button
                        className="text-xs navlink flex-shrink-0"
                        onClick={() =>
                          setSelectedItem({
                            id: d.id,
                            name: d.name,
                            subcollection: row.subcollection,
                          })
                        }
                      >
                        View
                      </button>
                    )}
                  </div>

                  {d.startDate && (
                    <div className="text-xs text-muted-foreground">
                      {fmtMDY(d.startDate)}
                      {d.endDate ? ` → ${fmtMDY(d.endDate)}` : ""}
                    </div>
                  )}

                  {[d.address, d.city, d.state, d.country].filter(Boolean).length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {[d.address, d.city, d.state, d.country]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ModalShell>

      {selectedItem && (
        <ItemFlipbook
          tripId={tripId}
          linkedId={selectedItem.id}
          subcollection={selectedItem.subcollection}
          itemName={selectedItem.name}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}
