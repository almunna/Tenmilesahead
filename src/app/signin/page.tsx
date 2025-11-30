"use client";
import Link from "next/link";
import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetStatus(null);
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetStatus({
        type: "success",
        message: "Password reset email sent! Check your inbox.",
      });
      setResetEmail("");
    } catch (err: any) {
      let message = "Failed to send reset email. Please try again.";
      if (err.code === "auth/user-not-found") {
        message = "No account found with this email address.";
      } else if (err.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      }
      setResetStatus({ type: "error", message });
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="container py-10">
      <div className="max-w-md mx-auto card">
        <h1 className="text-2xl font-semibold mb-4">Sign In</h1>

        {/* Let the browser/password managers autofill */}
        <form className="space-y-3" onSubmit={submit} autoComplete="on">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username" // <- key for login forms
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password" // <- key for login forms
            />
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(true);
                setResetEmail(email); // Pre-fill with email if already entered
                setResetStatus(null);
              }}
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button className="btn w-full" type="submit">
            Sign In
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          No account?{" "}
          <Link className="link" href="/signup">
            Create one
          </Link>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Reset Password</h2>
              <button
                onClick={() => setShowForgotPassword(false)}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="label" htmlFor="reset-email">
                  Email
                </label>
                <input
                  id="reset-email"
                  className="input"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  autoComplete="email"
                />
              </div>

              {resetStatus && (
                <div
                  className={`text-sm p-3 rounded-lg ${
                    resetStatus.type === "success"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {resetStatus.message}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 btn disabled:opacity-50"
                >
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
