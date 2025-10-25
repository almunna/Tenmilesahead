"use client";
import Link from "next/link";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      await setDoc(doc(db, "users", uid), {
        uid,
        email,
        username,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      router.push("/trips");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="container py-10">
      <div className="max-w-md mx-auto card">
        <h1 className="text-2xl font-semibold mb-4">Create an account</h1>
        <form className="space-y-3" onSubmit={submit}>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Username (required)</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button className="btn w-full" type="submit">
            Sign Up
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          Already have an account?{" "}
          <Link className="link" href="/signin">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
