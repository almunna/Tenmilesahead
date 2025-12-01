import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Initialize Firebase Admin if not already initialized
function getFirebaseAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
  return admin.firestore();
}

async function updateUserSubscription(
  firebaseUserId: string,
  subscriptionData: {
    status: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    plan?: string;
    currentPeriodEnd?: number;
    cancelAtPeriodEnd?: boolean;
  }
) {
  try {
    const db = getFirebaseAdmin();
    const userRef = db.collection('users').doc(firebaseUserId);
    await userRef.update({
      subscription: subscriptionData,
      updatedAt: Date.now(),
    });
    console.log(`Updated subscription for user ${firebaseUserId}:`, subscriptionData);
  } catch (error) {
    console.error(`Error updating subscription for user ${firebaseUserId}:`, error);
    throw error;
  }
}

// Helper to extract subscription data from response
async function getSubscriptionData(subscriptionId: string) {
  const response = await stripe.subscriptions.retrieve(subscriptionId);
  // Cast to any to access properties that may differ between SDK versions
  const sub = response as any;
  return {
    id: sub.id,
    status: sub.status,
    metadata: sub.metadata,
    current_period_end: sub.current_period_end,
    cancel_at_period_end: sub.cancel_at_period_end,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  try {
    // Use 'any' to handle Stripe SDK type variations
    const eventData = event.data.object as any;

    switch (event.type) {
      case 'checkout.session.completed': {
        const firebaseUserId = eventData.metadata?.firebaseUserId;

        if (firebaseUserId && eventData.subscription) {
          const subscription = await getSubscriptionData(eventData.subscription as string);

          await updateUserSubscription(firebaseUserId, {
            status: subscription.status,
            stripeCustomerId: eventData.customer as string,
            stripeSubscriptionId: subscription.id,
            plan: eventData.metadata?.plan || 'monthly',
            currentPeriodEnd: subscription.current_period_end * 1000,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const firebaseUserId = eventData.metadata?.firebaseUserId;

        if (firebaseUserId) {
          await updateUserSubscription(firebaseUserId, {
            status: eventData.status,
            stripeSubscriptionId: eventData.id,
            currentPeriodEnd: eventData.current_period_end * 1000,
            cancelAtPeriodEnd: eventData.cancel_at_period_end,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const firebaseUserId = eventData.metadata?.firebaseUserId;

        if (firebaseUserId) {
          await updateUserSubscription(firebaseUserId, {
            status: 'canceled',
            currentPeriodEnd: eventData.current_period_end * 1000,
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const subscriptionId = eventData.subscription;
        if (subscriptionId) {
          const subscription = await getSubscriptionData(subscriptionId as string);
          const firebaseUserId = subscription.metadata?.firebaseUserId;

          if (firebaseUserId) {
            await updateUserSubscription(firebaseUserId, {
              status: 'active',
              currentPeriodEnd: subscription.current_period_end * 1000,
            });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const subscriptionId = eventData.subscription;
        if (subscriptionId) {
          const subscription = await getSubscriptionData(subscriptionId as string);
          const firebaseUserId = subscription.metadata?.firebaseUserId;

          if (firebaseUserId) {
            await updateUserSubscription(firebaseUserId, {
              status: 'past_due',
            });
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
