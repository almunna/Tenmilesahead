"use client";
import Protected from "@/components/Protected";
import { useAuth } from "@/components/AuthProvider";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  where, // ✅ added
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Trip } from "@/lib/types";

export default function TripsPage() {
  return (
    <Protected>
      <TripsInner />
    </Protected>
  );
}

function TripsInner() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    country: "",
    transportationType: "",
    accommodationType: "",
  });

  useEffect(() => {
    if (!user) return;

    // ✅ Query only documents the user is allowed to read (matches rules)
    const q = query(
      collection(db, "trips"),
      where("ownerId", "==", user.uid),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const arr: Trip[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setTrips(arr);
    });

    return () => unsub();
  }, [user]);

  async function createTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const now = Date.now();
    const payload: Trip = {
      ownerId: user.uid,
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      country: form.country,
      transportationType: form.transportationType,
      accommodationType: form.accommodationType,
      coverMediaId: null,
      createdAt: now,
      updatedAt: now,
    };
    await addDoc(collection(db, "trips"), payload as any);
    setForm({
      name: "",
      startDate: "",
      endDate: "",
      country: "",
      transportationType: "",
      accommodationType: "",
    });
  }

  return (
    <div className="container py-10 space-y-8">
      <div className="card">
        <h1 className="text-2xl font-semibold mb-4">
          Create Trip (required fields only)
        </h1>
        <form className="grid md:grid-cols-3 gap-4" onSubmit={createTrip}>
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Start Date</label>
            <input
              className="input"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              className="input"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Country</label>
            <input
              className="input"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Transportation</label>
            <input
              className="input"
              value={form.transportationType}
              onChange={(e) =>
                setForm({ ...form, transportationType: e.target.value })
              }
              required
            />
          </div>
          <div>
            <label className="label">Accommodation</label>
            <input
              className="input"
              value={form.accommodationType}
              onChange={(e) =>
                setForm({ ...form, accommodationType: e.target.value })
              }
              required
            />
          </div>
          <div className="md:col-span-3">
            <button className="btn" type="submit">
              Create Trip
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Your Trips</h2>
        <div className="grid-auto">
          {trips.map((t) => (
            <div key={t.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-sm text-slate-600">
                    {t.country} · {t.startDate} → {t.endDate}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link className="btn" href={`/trips/${t.id}`}>
                    Open
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {trips.length === 0 && (
            <div className="text-slate-600">No trips yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
