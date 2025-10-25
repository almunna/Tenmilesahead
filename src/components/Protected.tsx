"use client";
import { useAuth } from "./AuthProvider";
import Link from "next/link";

export default function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  if (loading) return <div className="container py-10">Loading…</div>;
  if (!user) {
    return (
      <div className="container py-10">
        <div className="card">
          <h1 className="text-2xl font-semibold mb-2">Sign in required</h1>
          <p className="mb-4">Please sign in to continue.</p>
          <Link className="btn" href="/signin">
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }
  // Force user to set a username
  if (!profile?.username) {
    return (
      <div className="container py-10">
        <div className="card">
          <h1 className="text-xl font-semibold mb-2">Complete your profile</h1>
          <p className="mb-4">A username is required before using the app.</p>
          <Link className="btn" href="/profile">
            Set Username
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
