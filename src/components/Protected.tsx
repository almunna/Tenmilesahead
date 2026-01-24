"use client";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/signin?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, pathname, router]);

  if (loading || !user) {
    return <div className="container py-10">Loading…</div>;
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
