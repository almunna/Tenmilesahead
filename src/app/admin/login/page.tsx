"use client";
import Link from "next/link";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check if user has admin role
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (!userDoc.exists()) {
        setError("User profile not found. Please contact support.");
        await auth.signOut();
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      console.log("User data:", userData);
      console.log("Role field:", userData?.role);
      console.log("Role type:", typeof userData?.role);

      if (userData?.role !== "admin") {
        setError(`Access denied. Admin privileges required. (Current role: ${userData?.role || "none"})`);
        await auth.signOut();
        setLoading(false);
        return;
      }

      router.push("/admin");
    } catch (err: any) {
      if (err.code === "auth/invalid-credential") {
        setError("Invalid email or password");
      } else {
        setError(err.message);
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-haiti-900 via-haiti-800 to-haiti-700">
      <div className="w-full max-w-md mx-4">
        <div className="card">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold mb-2">Admin Access</h1>
            <p className="text-sm text-muted-foreground">
              Restricted area - Admin credentials required
            </p>
          </div>

          <form className="space-y-4" onSubmit={submit} autoComplete="on">
            <div>
              <label className="label" htmlFor="admin-email">
                Admin Email
              </label>
              <input
                id="admin-email"
                name="email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                disabled={loading}
              />
            </div>

            <div>
              <label className="label" htmlFor="admin-password">
                Password
              </label>
              <input
                id="admin-password"
                name="password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              className="btn w-full"
              type="submit"
              disabled={loading}
            >
              {loading ? "Verifying..." : "Sign In as Admin"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border text-center">
            <Link className="text-sm link" href="/">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
