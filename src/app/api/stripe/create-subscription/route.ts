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

// Price configuration
const PRICE_CONFIG = {
  monthly: {
    name: 'Monthly Pro',
    amount: 399, // $3.99 in cents
    interval: 'month' as const,
  },
  annual: {
    name: 'Annual Pro',
    amount: 3999, // $39.99 in cents
    interval: 'year' as const,
  },
};

// Product name for lookup/creation
const PRODUCT_NAME = 'Ten Miles Ahead Pro';

async function getOrCreateProduct(): Promise<Stripe.Product> {
  const stripe = getStripe();
  const products = await stripe.products.list({ limit: 100 });
  const existingProduct = products.data.find(p => p.name === PRODUCT_NAME && p.active);

  if (existingProduct) {
    return existingProduct;
  }

  return await stripe.products.create({
    name: PRODUCT_NAME,
    description: 'Full access to all premium features',
  });
}

async function getOrCreatePrice(productId: string, planId: 'monthly' | 'annual'): Promise<Stripe.Price> {
  const stripe = getStripe();
  const config = PRICE_CONFIG[planId];

  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });

  const existingPrice = prices.data.find(
    p => p.unit_amount === config.amount &&
         p.recurring?.interval === config.interval &&
         p.currency === 'usd'
  );

  if (existingPrice) {
    return existingPrice;
  }

  return await stripe.prices.create({
    product: productId,
    unit_amount: config.amount,
    currency: 'usd',
    recurring: { interval: config.interval },
  });
}

async function cancelIncompleteSubscriptions(customerId: string): Promise<void> {
  const stripe = getStripe();
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'incomplete',
    limit: 100,
  });

  for (const sub of subscriptions.data) {
    try {
      await stripe.subscriptions.cancel(sub.id);
      console.log('Cancelled incomplete subscription:', sub.id);
    } catch (e) {
      console.log('Failed to cancel subscription:', sub.id, e);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();
    const body = await request.json();
    const { planId, userId, userEmail } = body;

    console.log('Creating subscription for:', { planId, userId, userEmail });

    if (!planId || !userId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (planId !== 'monthly' && planId !== 'annual') {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    // Get or create customer
    let customer: Stripe.Customer;
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      if (customer.metadata.firebaseUserId !== userId) {
        customer = await stripe.customers.update(customer.id, {
          metadata: { firebaseUserId: userId },
        });
      }
      // Cancel any incomplete subscriptions
      await cancelIncompleteSubscriptions(customer.id);
    } else {
      customer = await stripe.customers.create({
        email: userEmail,
        metadata: { firebaseUserId: userId },
      });
    }

    console.log('Customer:', customer.id);

    // Get or create product and price
    const product = await getOrCreateProduct();
    console.log('Product:', product.id);

    const price = await getOrCreatePrice(product.id, planId);
    console.log('Price:', price.id, 'Amount:', price.unit_amount);

    // Create subscription with explicit collection method
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      collection_method: 'charge_automatically',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card'],
      },
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      metadata: {
        firebaseUserId: userId,
        plan: planId,
      },
    });

    console.log('Subscription created:', subscription.id);
    console.log('Subscription status:', subscription.status);

    // Get the invoice
    const invoice = subscription.latest_invoice;

    if (!invoice || typeof invoice === 'string') {
      throw new Error('Invoice not expanded properly');
    }

    console.log('Invoice status:', invoice.status);
    console.log('Invoice amount_due:', invoice.amount_due);

    // Check if there's a payment intent on the invoice
    let clientSecret: string | null = null;

    // Cast invoice to access payment_intent (may not be in type definition but exists at runtime)
    const invoicePaymentIntent = (invoice as unknown as { payment_intent?: string | { client_secret: string | null } }).payment_intent;

    if (invoicePaymentIntent) {
      if (typeof invoicePaymentIntent === 'string') {
        // Fetch the payment intent
        const pi = await stripe.paymentIntents.retrieve(invoicePaymentIntent);
        clientSecret = pi.client_secret;
      } else {
        clientSecret = invoicePaymentIntent.client_secret;
      }
    }

    // If no payment intent on invoice, check for pending setup intent
    if (!clientSecret && subscription.pending_setup_intent) {
      if (typeof subscription.pending_setup_intent === 'string') {
        const si = await stripe.setupIntents.retrieve(subscription.pending_setup_intent);
        clientSecret = si.client_secret;
      } else {
        clientSecret = subscription.pending_setup_intent.client_secret;
      }
      console.log('Using setup intent instead of payment intent');
    }

    // If still no client secret, create a payment intent manually
    if (!clientSecret) {
      console.log('No payment intent found, creating one manually...');

      // Pay the invoice which will create a payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: invoice.amount_due,
        currency: 'usd',
        customer: customer.id,
        metadata: {
          subscription_id: subscription.id,
          invoice_id: invoice.id,
          firebaseUserId: userId,
          plan: planId,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      clientSecret = paymentIntent.client_secret;
      console.log('Created manual payment intent:', paymentIntent.id);
    }

    if (!clientSecret) {
      throw new Error('Could not obtain client secret');
    }

    console.log('Client secret obtained successfully');

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: clientSecret,
      customerId: customer.id,
    });
  } catch (error: any) {
    console.error('Stripe subscription error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
