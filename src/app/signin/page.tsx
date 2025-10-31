"use client";
import Link from "next/link";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/trips");
    } catch (err: any) {
      setError(err.message);
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
    </div>
  );
}
