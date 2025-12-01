"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import Link from "next/link";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!sessionId) {
      router.push("/subscribe");
      return;
    }

    async function verifyAndUpdateSubscription() {
      try {
        // Call our API to verify the Stripe session
        const response = await fetch("/api/stripe/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || data.message || "Verification failed");
        }

        // Update Firebase directly from client if we have the subscription data
        if (data.subscription && user) {
          try {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
              subscription: data.subscription,
              updatedAt: Date.now(),
            });

            // Refresh the user profile to get updated subscription
            if (refreshProfile) {
              await refreshProfile();
            }
          } catch (firebaseError) {
            console.error("Firebase update error:", firebaseError);
            // Continue anyway - webhook might handle it
          }
        }

        setStatus("success");

        // Redirect to subscribe page (which will now show management view)
        setTimeout(() => {
          router.push("/subscribe");
        }, 2000);
      } catch (error) {
        console.error("Verification error:", error);
        setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
        setStatus("error");
      }
    }

    verifyAndUpdateSubscription();
  }, [sessionId, user, router, refreshProfile]);

  if (status === "loading") {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Processing Payment...
        </h1>
        <p className="text-slate-600">
          Please wait while we activate your subscription.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Something went wrong
        </h1>
        <p className="text-slate-600 mb-6">
          {errorMessage || "We couldn't verify your subscription. Please contact support if you were charged."}
        </p>
        <div className="space-y-3">
          <Link
            href="/subscribe"
            className="block w-full bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="block w-full bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
      <div className="w-20 h-20 bg-gradient-to-r from-emerald-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-12 h-12 text-white" />
      </div>
      <h1 className="text-3xl font-bold text-slate-800 mb-2">
        Welcome to Pro!
      </h1>
      <p className="text-slate-600 mb-6">
        Your subscription has been activated successfully. You now have access
        to all premium features.
      </p>
      <div className="bg-emerald-50 rounded-xl p-4 mb-6">
        <p className="text-emerald-700 text-sm">
          Redirecting to your dashboard...
        </p>
      </div>
      <button
        onClick={() => router.push("/subscribe")}
        className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
      >
        Go to Dashboard Now
      </button>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="text-center">
      <Loader2 className="w-12 h-12 animate-spin text-white mx-auto mb-4" />
      <p className="text-white/70">Loading...</p>
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <Suspense fallback={<LoadingFallback />}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
