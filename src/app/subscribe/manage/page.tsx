"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  CreditCard,
  Calendar,
  Sparkles,
  Shield,
  Award,
  Loader2,
  XCircle,
} from "lucide-react";

const PLAN_DETAILS: Record<string, { name: string; price: string }> = {
  trial: { name: "Free Trial", price: "$0.00" },
  monthly: { name: "Monthly Pro", price: "$3.99" },
  annual: { name: "Annual Pro", price: "$24.99" },
};

const BENEFITS = [
  "Unlimited trips",
  "Advanced tracking",
  "Detailed reports",
  "Photo exports",
  "Multi-trip support",
  "Priority support",
];

export default function ManageSubscriptionPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signin?redirect=/subscribe/manage");
    }
  }, [user, authLoading, router]);

  const subscription = profile?.subscription;
  const isActive =
    subscription?.status === "active" || subscription?.status === "trialing";
  const planDetails = PLAN_DETAILS[subscription?.plan || "monthly"];
  const validUntil = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      })
    : "N/A";

  const handleCancelSubscription = async () => {
    if (!subscription?.stripeSubscriptionId) return;

    setCanceling(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: subscription.stripeSubscriptionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel subscription");
      }

      // Refresh the page to show updated status
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCanceling(false);
      setShowCancelConfirm(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-white" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-900 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 inline-flex items-center gap-2 mb-6">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-white font-medium">No Active Subscription</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Subscribe to Pro
          </h1>
          <p className="text-white/70 mb-8">
            Get access to all premium features and enhance your travel planning
            experience.
          </p>
          <Link
            href="/subscribe"
            className="inline-block bg-gradient-to-r from-emerald-500 to-green-600 text-white px-8 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            View Plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-900 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-full px-4 py-2 inline-flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-white" />
            <span className="text-white font-medium">Active Subscription</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Your Subscription
          </h1>
          <p className="text-white/70">
            Manage your current plan and billing details
          </p>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-center">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Subscription Card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              {/* Green Header */}
              <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-6 relative">
                <div className="bg-white/20 rounded-full px-3 py-1 inline-flex items-center gap-1.5 text-sm text-white mb-3">
                  <Award className="w-4 h-4" />
                  Premium Member
                </div>
                <div className="absolute top-6 right-6">
                  <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  Active Subscription
                </h2>
                <p className="text-white/80">
                  You have an active{" "}
                  <span className="font-semibold">{planDetails.name}</span> plan
                </p>
              </div>

              {/* Subscription Details */}
              <div className="p-6">
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                    <CreditCard className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm text-slate-500">Current Plan</p>
                      <p className="font-semibold text-slate-800">
                        {planDetails.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl">
                    <div className="w-5 h-5 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Last Payment</p>
                      <p className="font-semibold text-emerald-600">
                        {planDetails.price}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl mb-6">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Valid Until</p>
                    <p className="font-semibold text-slate-800">{validUntil}</p>
                  </div>
                </div>

                {subscription?.cancelAtPeriodEnd ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                    <p className="text-amber-800 text-sm">
                      Your subscription will be canceled on {validUntil}. You
                      can continue using all features until then.
                    </p>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="w-full py-3 px-4 border-2 border-red-200 text-red-500 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-5 h-5" />
                      Cancel Subscription
                    </button>
                    <p className="text-center text-slate-500 text-sm mt-3">
                      You can continue using the service until the end of your
                      billing period
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Side Cards */}
          <div className="space-y-6">
            {/* Benefits Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <div className="flex items-center gap-2 text-white mb-4">
                <Award className="w-5 h-5 text-yellow-400" />
                <h3 className="font-semibold">Your Benefits</h3>
              </div>
              <ul className="space-y-3">
                {BENEFITS.map((benefit, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                    <span className="text-white/80 text-sm">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Security Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <div className="flex items-center gap-2 text-white mb-4">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold">Secure & Protected</h3>
              </div>
              <p className="text-white/70 text-sm">
                Your subscription is secured with industry-standard encryption
                and can be cancelled at any time.
              </p>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="text-white/60 hover:text-white/90 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              Cancel Subscription?
            </h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to cancel your subscription? You&apos;ll
              continue to have access until {validUntil}, but your subscription
              won&apos;t renew.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                disabled={canceling}
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={canceling}
                className="flex-1 py-3 px-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {canceling ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Canceling...
                  </>
                ) : (
                  "Yes, Cancel"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
