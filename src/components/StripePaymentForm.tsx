"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type PlanId = "monthly" | "annual";

interface PlanConfig {
  id: PlanId;
  name: string;
  description: string;
  price: string;
  priceAmount: number;
  period: string;
  features: string[];
}

const PLANS: Record<PlanId, PlanConfig> = {
  monthly: {
    id: "monthly",
    name: "Monthly Pro",
    description: "Perfect for trying out our premium features with full flexibility.",
    price: "$3.99",
    priceAmount: 3.99,
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
  },
  annual: {
    id: "annual",
    name: "Annual Pro",
    description: "Best value plan with significant savings for committed users.",
    price: "$39.99",
    priceAmount: 39.99,
    period: "/year",
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
  },
};

interface CheckoutFormProps {
  plan: PlanConfig;
  userId: string;
  userEmail: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function CheckoutForm({ plan, userId, userEmail, onSuccess, onCancel }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/subscribe/success`,
        },
        redirect: "if_required",
      });

      if (error) {
        setErrorMessage(error.message || "Payment failed. Please try again.");
        setIsProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        // Update Firebase with subscription info
        const userRef = doc(db, "users", userId);
        const periodEnd = plan.id === "annual"
          ? Date.now() + 365 * 24 * 60 * 60 * 1000
          : Date.now() + 30 * 24 * 60 * 60 * 1000;

        await updateDoc(userRef, {
          subscription: {
            status: "active",
            plan: plan.id,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            stripeCustomerId: (paymentIntent as any).customer || null,
          },
          updatedAt: Date.now(),
        });

        onSuccess();
      }
    } catch (err) {
      console.error("Payment error:", err);
      setErrorMessage("An unexpected error occurred. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Details Header */}
      <div>
        <h3 className="text-xl font-bold text-foreground">Payment Details</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your payment information securely
        </p>
      </div>

      {/* Stripe Payment Element */}
      <div className="bg-white rounded-xl p-4 border border-border">
        <PaymentElement
          options={{
            layout: "tabs",
            defaultValues: {
              billingDetails: {
                email: userEmail,
              },
            },
          }}
        />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || !elements || isProcessing}
        className="w-full py-4 px-6 bg-haiti-900 hover:bg-haiti-800 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </>
        ) : (
          `Pay ${plan.price}`
        )}
      </button>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        Your payment is secured with 256-bit SSL encryption
      </div>

      {/* Cancel Link */}
      <div className="text-center">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel and go back
        </button>
      </div>
    </form>
  );
}

interface StripePaymentFormProps {
  planId: PlanId;
  userId: string;
  userEmail: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function StripePaymentForm({
  planId,
  userId,
  userEmail,
  onSuccess,
  onCancel,
}: StripePaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const plan = PLANS[planId];

  useEffect(() => {
    // Create subscription and get client secret
    const createSubscription = async () => {
      try {
        const response = await fetch("/api/stripe/create-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            userId,
            userEmail,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to initialize payment");
        }

        setClientSecret(data.clientSecret);
      } catch (err) {
        console.error("Error creating subscription:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize payment");
      } finally {
        setLoading(false);
      }
    };

    createSubscription();
  }, [planId, userId, userEmail]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-10 w-10 text-primary" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">{error}</div>
        <button onClick={onCancel} className="btn">
          Go Back
        </button>
      </div>
    );
  }

  if (!clientSecret) {
    return null;
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Plan Summary - Left Side */}
      <div className="card p-0 overflow-hidden">
        {/* Plan Header */}
        <div className="bg-gradient-to-r from-primary via-primary-600 to-primary-700 p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <p className="text-white/80 text-sm mt-1">{plan.description}</p>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-bold">{plan.price}</span>
            <span className="text-white/80">{plan.period}</span>
          </div>
        </div>

        {/* Features List */}
        <div className="p-6">
          <p className="font-semibold text-foreground mb-4">What&apos;s included:</p>
          <ul className="space-y-3">
            {plan.features.map((feature, idx) => (
              <li key={idx} className="flex items-center gap-3">
                <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Payment Form - Right Side */}
      <div className="card">
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#66bfcc",
                colorBackground: "#ffffff",
                colorText: "#0f172a",
                colorDanger: "#ef4444",
                fontFamily: "system-ui, sans-serif",
                borderRadius: "12px",
                spacingUnit: "4px",
              },
              rules: {
                ".Input": {
                  border: "1px solid #cbd5e1",
                  boxShadow: "none",
                  padding: "12px",
                },
                ".Input:focus": {
                  border: "2px solid #66bfcc",
                  boxShadow: "none",
                },
                ".Label": {
                  fontWeight: "500",
                  fontSize: "14px",
                  marginBottom: "8px",
                },
                ".Tab": {
                  border: "1px solid #cbd5e1",
                  borderRadius: "12px",
                },
                ".Tab--selected": {
                  borderColor: "#66bfcc",
                  backgroundColor: "rgba(102, 191, 204, 0.1)",
                },
              },
            },
          }}
        >
          <CheckoutForm
            plan={plan}
            userId={userId}
            userEmail={userEmail}
            onSuccess={onSuccess}
            onCancel={onCancel}
          />
        </Elements>
      </div>
    </div>
  );
}
