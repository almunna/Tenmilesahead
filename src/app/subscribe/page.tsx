"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import dynamic from "next/dynamic";

// Dynamically import Stripe component to avoid SSR issues
const StripePaymentForm = dynamic(
  () => import("@/components/StripePaymentForm"),
  { ssr: false }
);

type PlanId = "trial" | "monthly" | "annual";

interface PricingPlan {
  id: PlanId;
  name: string;
  description: string;
  price: string;
  period: string;
  badge?: string;
  highlighted?: boolean;
  features: string[];
  buttonText: string;
}

const plans: PricingPlan[] = [
  {
    id: "trial",
    name: "7-Day Free Trial",
    description:
      "Try all premium features free for 7 days. No credit card required!",
    price: "$0",
    period: "/7 days",
    badge: "100% Free",
    features: [
      "Smart Trip Management",
      "Photo Uploader with captions",
      "Flipbook Viewer",
      "Flexible Date Editing",
      "Advanced Exports (CSV, PDF)",
      "Private Share Links",
      "Global Reviews",
      "Multi-Device Access",
    ],
    buttonText: "Start Free Trial",
  },
  {
    id: "monthly",
    name: "Monthly Pro",
    description:
      "Perfect for trying out our premium features with full flexibility.",
    price: "$3.99",
    period: "/month",
    features: [
      "Smart Trip Management",
      "Photo Uploader with captions",
      "Flipbook Viewer",
      "Flexible Date Editing",
      "Advanced Exports (CSV, PDF)",
      "Private Share Links",
      "Global Reviews",
      "Multi-Device Access",
    ],
    buttonText: "Get Started - $3.99/month",
  },
  {
    id: "annual",
    name: "Annual Pro",
    description: "Best value plan with significant savings for committed users.",
    price: "$39.99",
    period: "/year",
    badge: "Save 17%",
    highlighted: true,
    features: [
      "Smart Trip Management",
      "Photo Uploader with captions",
      "Flipbook Viewer",
      "Flexible Date Editing",
      "Advanced Exports (CSV, PDF)",
      "Private Share Links",
      "Global Reviews",
      "Multi-Device Access",
    ],
    buttonText: "Get Started - $39.99/year",
  },
];

const PLAN_DETAILS: Record<string, { name: string; price: string }> = {
  trial: { name: "Free Trial", price: "$0.00" },
  monthly: { name: "Monthly Pro", price: "$3.99" },
  annual: { name: "Annual Pro", price: "$39.99" },
};

const BENEFITS = [
  "Smart Trip Management",
  "Photo Uploader with captions",
  "Flipbook Viewer",
  "Flexible Date Editing",
  "Advanced Exports (CSV, PDF)",
  "Private Share Links",
  "Global Reviews",
  "Multi-Device Access",
];

// Subscription Management View
function SubscriptionManagement() {
  const { profile } = useAuth();
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const subscription = profile?.subscription;
  const planDetails = PLAN_DETAILS[subscription?.plan || "monthly"];

  // Calculate valid until date based on plan type if currentPeriodEnd is not set
  const getValidUntilDate = () => {
    if (subscription?.currentPeriodEnd) {
      return new Date(subscription.currentPeriodEnd);
    }
    // Fallback: calculate from now based on plan
    const now = new Date();
    switch (subscription?.plan) {
      case "trial":
        return new Date(now.setDate(now.getDate() + 7)); // 7 days
      case "annual":
        return new Date(now.setFullYear(now.getFullYear() + 1)); // 1 year
      case "monthly":
      default:
        return new Date(now.setMonth(now.getMonth() + 1)); // 1 month
    }
  };

  const validUntilDate = getValidUntilDate();
  const validUntil = validUntilDate.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  const handleCancelSubscription = async () => {
    setCanceling(true);
    setError(null);

    try {
      // For free trial (no Stripe subscription), just update Firebase directly
      if (!subscription?.stripeSubscriptionId) {
        if (profile?.uid) {
          const userRef = doc(db, "users", profile.uid);
          await updateDoc(userRef, {
            "subscription.cancelAtPeriodEnd": true,
            updatedAt: Date.now(),
          });
        }
        // Redirect to pricing page after successful cancellation
        window.location.href = "/subscribe?canceled=true";
        return;
      }

      // For paid subscriptions, cancel through Stripe
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

      // Update Firebase with cancelAtPeriodEnd flag
      if (profile?.uid) {
        const userRef = doc(db, "users", profile.uid);
        await updateDoc(userRef, {
          "subscription.cancelAtPeriodEnd": true,
          updatedAt: Date.now(),
        });
      }

      // Redirect to pricing page after successful cancellation
      window.location.href = "/subscribe?canceled=true";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCanceling(false);
      setShowCancelConfirm(false);
    }
  };

  return (
    <div className="container py-10 space-y-8">
      {/* Header */}
      <section className="rounded-2xl bg-primary p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-white/80 text-sm font-medium">Active Subscription</span>
        </div>
        <p className="text-3xl font-bold">Your Subscription</p>
        <p className="text-white/80 mt-1">Manage your current plan and billing details</p>
      </section>

      {error && (
        <div className="card bg-red-50 border-red-200 text-red-700 text-center">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Subscription Card */}
        <div className="lg:col-span-2">
          <div className="card space-y-6">
            {/* Plan Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-muted-foreground">Premium Member</span>
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  {planDetails.name}
                </h2>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Subscription Details */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-border">
                <svg className="w-5 h-5 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <p className="font-semibold text-foreground">{planDetails.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-xl border border-primary/20">
                <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Payment</p>
                  <p className="font-semibold text-primary">{planDetails.price}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-border">
              <svg className="w-5 h-5 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm text-muted-foreground">Valid Until</p>
                <p className="font-semibold text-foreground">{validUntil}</p>
              </div>
            </div>

            {subscription?.cancelAtPeriodEnd ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-amber-800 text-sm">
                  Your subscription will be canceled on {validUntil}. You can
                  continue using all features until then.
                </p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full py-3 px-4 border-2 border-red-200 text-red-500 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Cancel Subscription
                </button>
                <p className="text-center text-muted-foreground text-sm">
                  You can continue using the service until the end of your
                  billing period
                </p>
              </>
            )}
          </div>
        </div>

        {/* Side Cards */}
        <div className="space-y-6">
          {/* Benefits Card */}
          <div className="card">
            <div className="flex items-center gap-2 text-foreground mb-4">
              <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <h3 className="font-semibold">Your Benefits</h3>
            </div>
            <ul className="space-y-3">
              {BENEFITS.map((benefit, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span className="text-muted-foreground text-sm">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Security Card */}
          <div className="card bg-primary/10 border-primary/20">
            <div className="flex items-center gap-2 text-foreground mb-4">
              <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <h3 className="font-semibold">Secure & Protected</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Your subscription is secured with industry-standard encryption
              and can be cancelled at any time.
            </p>
          </div>
        </div>
      </div>

      {/* Back Link */}
      <div className="text-center">
        <Link href="/" className="navlink">
          ← Back to Home
        </Link>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card max-w-md w-full">
            <h3 className="text-xl font-bold text-foreground mb-2">
              Cancel Subscription?
            </h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to cancel your subscription? You&apos;ll
              continue to have access until {validUntil}, but your subscription
              won&apos;t renew.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-3 px-4 bg-surface border border-border text-foreground rounded-xl font-medium hover:bg-border/50 transition-colors"
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
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
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

// Pricing Plans View with Embedded Payment
function PricingPlans() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual" | null>(null);

  const handleSubscribe = async (planId: PlanId) => {
    if (!user) {
      window.location.href = "/signin?redirect=/subscribe";
      return;
    }

    // For free trial, create subscription directly in Firebase without Stripe
    if (planId === "trial") {
      setLoading(planId);
      setError(null);

      try {
        const userRef = doc(db, "users", user.uid);
        const trialEndDate = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days from now

        await updateDoc(userRef, {
          subscription: {
            status: "trialing",
            plan: "trial",
            currentPeriodEnd: trialEndDate,
            cancelAtPeriodEnd: false,
          },
          updatedAt: Date.now(),
        });

        // Refresh the page to show the management view
        window.location.reload();
      } catch (err) {
        console.error("Trial error:", err);
        setError(err instanceof Error ? err.message : "Something went wrong");
        setLoading(null);
      }
      return;
    }

    // For paid plans, show embedded payment form
    setSelectedPlan(planId as "monthly" | "annual");
  };

  const handlePaymentSuccess = () => {
    // Redirect to success page or reload
    window.location.href = "/subscribe/success";
  };

  const handlePaymentCancel = () => {
    setSelectedPlan(null);
  };

  // Show embedded payment form when a paid plan is selected
  if (selectedPlan && user) {
    return (
      <div className="container py-10">
        <StripePaymentForm
          planId={selectedPlan}
          userId={user.uid}
          userEmail={user.email || ""}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      </div>
    );
  }

  return (
    <div className="container py-10 space-y-8">
      {/* Header */}
      <section className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Choose Your Plan
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Unlock the full potential of Ten Miles Ahead with our premium
          features. Start with a free trial or choose the plan that works best
          for you.
        </p>
      </section>

      {error && (
        <div className="max-w-md mx-auto card bg-red-50 border-red-200 text-red-700 text-center">
          {error}
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`card relative transition-transform hover:scale-[1.02] ${
              plan.highlighted ? "ring-2 ring-primary" : ""
            }`}
          >
            {/* Best Value Badge */}
            {plan.highlighted && (
              <div className="absolute -top-3 right-4">
                <div className="bg-primary text-black px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Best Value
                </div>
              </div>
            )}

            {/* Plan Header */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                {plan.badge && !plan.highlighted && (
                  <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full font-medium">
                    {plan.badge}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{plan.description}</p>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-foreground">{plan.price}</span>
              <span className="text-muted-foreground">{plan.period}</span>
              {plan.highlighted && (
                <span className="ml-2 bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                  {plan.badge}
                </span>
              )}
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-6">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-muted-foreground text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Button */}
            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={loading !== null}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                plan.highlighted
                  ? "bg-primary text-black hover:bg-primary-600"
                  : "bg-surface border border-border text-foreground hover:bg-border/50"
              }`}
            >
              {loading === plan.id ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  {plan.buttonText}
                  <span className="opacity-70">→</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Trust Badges */}
      <div className="card bg-gradient-to-br from-primary/15 to-primary/5">
        <h2 className="text-2xl font-bold text-center text-foreground mb-8">
          Why Choose Ten Miles Ahead?
        </h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground mb-1">Secure Payments</h3>
            <p className="text-muted-foreground text-sm">
              Bank-level security with encrypted transactions
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground mb-1">Cancel Anytime</h3>
            <p className="text-muted-foreground text-sm">
              No long-term commitments or hidden fees
            </p>
          </div>
        </div>
      </div>

      {/* Back Link */}
      <div className="text-center">
        <Link href="/" className="navlink">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}

// Main Page Component
export default function SubscribePage() {
  const { profile, loading } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-primary" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  // Check if user has active subscription
  const subscription = profile?.subscription;
  // Only show management if active/trialing AND not set to cancel
  const isActive =
    (subscription?.status === "active" || subscription?.status === "trialing") &&
    !subscription?.cancelAtPeriodEnd;

  // Show management view if subscribed, otherwise show pricing plans
  if (isActive) {
    return <SubscriptionManagement />;
  }

  return <PricingPlans />;
}
