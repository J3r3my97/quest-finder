import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe, PRICE_TO_TIER } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

// Disable body parsing for webhook
export const dynamic = 'force-dynamic';

async function updateUserSubscription(
  subscriptionId: string,
  customerId: string,
  priceId: string,
  currentPeriodEnd: Date,
  status: string
) {
  const tier = PRICE_TO_TIER[priceId] || 'FREE';

  // Find user by Stripe customer ID
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error('User not found for customer:', customerId);
    return;
  }

  // Update subscription based on status
  if (status === 'active' || status === 'trialing') {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: tier,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: currentPeriodEnd,
      },
    });
  } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
    // Downgrade to free tier
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: 'FREE',
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
      },
    });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', message);
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          const priceId = subscription.items.data[0]?.price.id;
          const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;
          if (priceId && session.customer) {
            await updateUserSubscription(
              subscription.id,
              session.customer as string,
              priceId,
              new Date(periodEnd * 1000),
              subscription.status
            );
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price.id;
        const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;

        if (priceId && subscription.customer) {
          await updateUserSubscription(
            subscription.id,
            subscription.customer as string,
            priceId,
            new Date(periodEnd * 1000),
            subscription.status
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        // Downgrade user to free tier
        const user = await prisma.user.findUnique({
          where: { stripeCustomerId: subscription.customer as string },
        });

        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionTier: 'FREE',
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
            },
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;

        if (invoice.subscription && invoice.customer) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );

          const priceId = subscription.items.data[0]?.price.id;
          const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;
          if (priceId) {
            await updateUserSubscription(
              subscription.id,
              invoice.customer as string,
              priceId,
              new Date(periodEnd * 1000),
              subscription.status
            );
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.error('Payment failed for invoice:', invoice.id);
        // Could send email notification here
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
