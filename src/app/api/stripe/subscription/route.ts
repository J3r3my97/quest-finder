import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TIER_FEATURES } from '@/lib/stripe';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        subscriptionTier: true,
        stripeSubscriptionId: true,
        stripePriceId: true,
        stripeCurrentPeriodEnd: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const tier = user.subscriptionTier || 'FREE';
    const features = TIER_FEATURES[tier];

    return NextResponse.json({
      tier,
      features,
      subscriptionId: user.stripeSubscriptionId,
      currentPeriodEnd: user.stripeCurrentPeriodEnd,
      isActive: !!user.stripeSubscriptionId,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}
