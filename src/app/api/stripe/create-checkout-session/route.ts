import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Lazy initialization to avoid build-time errors
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeInstance;
}

// Price IDs for each plan - you'll need to create these in Stripe Dashboard
// For now, using dynamic pricing. Replace with actual Price IDs from Stripe.
const PRICE_CONFIG = {
  trial: {
    name: '7-Day Free Trial',
    amount: 0,
    interval: null,
    trialDays: 7,
  },
  monthly: {
    name: 'Monthly Pro',
    amount: 499, // $4.99 in cents
    interval: 'month' as const,
    trialDays: 0,
  },
  annual: {
    name: 'Annual Pro',
    amount: 3999, // $39.99 in cents
    interval: 'year' as const,
    trialDays: 0,
  },
};

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();
    const body = await request.json();
    const { priceId, userId, userEmail } = body;

    if (!priceId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: priceId and userId' },
        { status: 400 }
      );
    }

    const priceConfig = PRICE_CONFIG[priceId as keyof typeof PRICE_CONFIG];
    if (!priceConfig) {
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400 }
      );
    }

    // Get the origin for success/cancel URLs
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    // For free trial, create a subscription with trial period
    if (priceId === 'trial') {
      // Create or get customer
      let customer: Stripe.Customer;
      const existingCustomers = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: userEmail,
          metadata: { firebaseUserId: userId },
        });
      }

      // Create a checkout session for the trial (with payment method collection for after trial)
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Ten Miles Ahead Pro',
                description: 'Full access to all premium features',
              },
              unit_amount: 499, // Will charge $4.99/month after trial
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_period_days: 7,
          metadata: { firebaseUserId: userId },
        },
        success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/subscribe?canceled=true`,
        metadata: { firebaseUserId: userId, plan: 'trial' },
      });

      return NextResponse.json({ sessionId: session.id, url: session.url });
    }

    // For paid plans (monthly or annual)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: userEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: priceConfig.name,
              description: 'Full access to all premium features',
            },
            unit_amount: priceConfig.amount,
            recurring: { interval: priceConfig.interval! },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: { firebaseUserId: userId },
      },
      success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscribe?canceled=true`,
      metadata: { firebaseUserId: userId, plan: priceId },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
