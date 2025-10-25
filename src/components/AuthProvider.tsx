"use client";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import type { UserProfile } from "../lib/types";

type Ctx = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOutNow: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  user: null,
  profile: null,
  loading: true,
  signOutNow: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthCtx);
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Watch Firebase Auth state
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      // Clean any previous profile listener
      setProfile(null);

      if (!u) {
        setLoading(false);
        return;
      }

      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);

      // Create profile doc once if missing
      if (!snap.exists()) {
        try {
          const p: UserProfile = {
            uid: u.uid,
            email: u.email ?? null,
            username: "", // force set by user later (Protected will gate)
            photoURL: u.photoURL ?? null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await setDoc(ref, p);
        } catch (e) {
          // If rules or network fail, surface minimal info and continue
          console.error("Failed to create profile:", e);
        }
      }

      // Live-listen to profile for changes (username, etc.)
      const unsubProfile = onSnapshot(
        ref,
        (s) => {
          if (s.exists()) setProfile(s.data() as UserProfile);
          setLoading(false);
        },
        (err) => {
          console.error("Profile listener error:", err);
          setLoading(false);
        }
      );

      // Teardown when auth user changes/unmounts
      return () => unsubProfile();
    });

    return () => unsubAuth();
  }, []);

  async function refreshProfile() {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) setProfile(snap.data() as UserProfile);
  }

  return (
    <AuthCtx.Provider
      value={{
        user,
        profile,
        loading,
        signOutNow: () => signOut(auth),
        refreshProfile,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
