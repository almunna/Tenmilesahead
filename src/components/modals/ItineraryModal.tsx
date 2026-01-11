"use client";

import React, { useState, useEffect } from "react";
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
                  <React.Fragment key={i}>
                    <tr className="border-t border-border hover:bg-surface/50">
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
                        <div className="flex items-center gap-2">
                          {/* Call icon */}
                          {d.phoneNumber && (
                            <a
                              href={`tel:${d.phoneNumber}`}
                              className="p-1.5 hover:bg-surface rounded-lg transition-colors"
                              title="Call"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                              </svg>
                            </a>
                          )}

                          {/* Location/Directions icon */}
                          {(d.address || d.city) && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                                [d.address, d.city, d.state, d.country]
                                  .filter(Boolean)
                                  .join(", ")
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-surface rounded-lg transition-colors"
                              title="Get Directions"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                            </a>
                          )}

                          {/* Website icon */}
                          {d.websiteUrl && (
                            <a
                              href={
                                d.websiteUrl.startsWith("http")
                                  ? d.websiteUrl
                                  : `https://${d.websiteUrl}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-surface rounded-lg transition-colors"
                              title="Visit Website"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                                />
                              </svg>
                            </a>
                          )}

                          {/* Photos icon */}
                          {row.subcollection !== "trip" && (
                            <button
                              onClick={() =>
                                setSelectedItem({
                                  id: d.id,
                                  name: d.name,
                                  subcollection: row.subcollection,
                                })
                              }
                              className="p-1.5 hover:bg-surface rounded-lg transition-colors"
                              title="View Photos"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {d.notes && (
                      <tr>
                        <td colSpan={5} className="px-3 py-1.5">
                          <div className="text-s text-muted-foreground">
                            Notes: {d.notes}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
                      <div className="font-semibold text-sm">
                        {d.name || "—"}
                      </div>
                      {d.notes && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Notes: {d.notes}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Call icon */}
                      {d.phoneNumber && (
                        <a
                          href={`tel:${d.phoneNumber}`}
                          className="p-1.5 hover:bg-surface rounded-lg transition-colors"
                          title="Call"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                          </svg>
                        </a>
                      )}

                      {/* Location/Directions icon */}
                      {(d.address || d.city) && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                            [d.address, d.city, d.state, d.country]
                              .filter(Boolean)
                              .join(", ")
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-surface rounded-lg transition-colors"
                          title="Get Directions"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </a>
                      )}

                      {/* Website icon */}
                      {d.websiteUrl && (
                        <a
                          href={
                            d.websiteUrl.startsWith("http")
                              ? d.websiteUrl
                              : `https://${d.websiteUrl}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-surface rounded-lg transition-colors"
                          title="Visit Website"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 919-9"
                            />
                          </svg>
                        </a>
                      )}

                      {/* Photos icon */}
                      {row.subcollection !== "trip" && (
                        <button
                          onClick={() =>
                            setSelectedItem({
                              id: d.id,
                              name: d.name,
                              subcollection: row.subcollection,
                            })
                          }
                          className="p-1.5 hover:bg-surface rounded-lg transition-colors"
                          title="View Photos"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {d.startDate && (
                    <div className="text-xs text-muted-foreground">
                      {fmtMDY(d.startDate)}
                      {d.endDate ? ` → ${fmtMDY(d.endDate)}` : ""}
                    </div>
                  )}

                  {[d.address, d.city, d.state, d.country].filter(Boolean)
                    .length > 0 && (
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
