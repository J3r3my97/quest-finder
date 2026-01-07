import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { inngest } from '@/lib/inngest';

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // In production, add admin role check here
    // For now, just require authentication

    // Trigger the manual sync
    await inngest.send({
      name: 'contracts/sync',
      data: { force: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Contract sync triggered',
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    return NextResponse.json(
      { error: 'Failed to trigger sync' },
      { status: 500 }
    );
  }
}
