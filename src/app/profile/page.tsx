"use client";
import Protected from "@/components/Protected";
import { useAuth } from "@/components/AuthProvider";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useState } from "react";

export default function ProfilePage() {
  return (
    <Protected>
      <ProfileInner />
    </Protected>
  );
}

function ProfileInner() {
  const { user, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState(profile?.username || "");
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    if (!user) return;
    setStatus(null);
    await updateDoc(doc(db, "users", user.uid), {
      username,
      updatedAt: Date.now(),
    });
    await refreshProfile();
    setStatus("Saved");
  }

  return (
    <div className="container py-10">
      <div className="max-w-lg card">
        <h1 className="text-2xl font-semibold mb-4">Your Profile</h1>
        <div className="space-y-3">
          <div>
            <label className="label">Username (required)</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <button className="btn" onClick={save}>
            Save
          </button>
          {status && <div className="text-green-700 text-sm">{status}</div>}
        </div>
      </div>
    </div>
  );
}
