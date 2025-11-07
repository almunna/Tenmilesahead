"use client";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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

  // keep the latest profile unsubscribe so we can tear it down properly
  const profileUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      // tear down any prior profile listener when auth changes
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }

      setUser(u);
      setProfile(null);
      setLoading(true);

      if (!u) {
        // signed out: nothing to read
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "users", u.uid);

        // Ensure the profile doc exists BEFORE we attach onSnapshot.
        // Keep payload minimal to satisfy stricter rules variants.
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          const p: UserProfile = {
            uid: u.uid,
            email: u.email ?? null,
            username: "", // filled later by user
            // omit extra fields if rules enforce a tight schema
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await setDoc(ref, p);
        }

        // Now safe to listen live
        profileUnsubRef.current = onSnapshot(
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
      } catch (e) {
        console.error("Auth/profile bootstrap error:", e);
        setLoading(false);
      }
    });

    // On unmount, also tear down profile listener
    return () => {
      unsubAuth();
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
    };
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
