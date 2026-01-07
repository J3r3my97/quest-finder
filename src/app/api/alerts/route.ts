import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AlertFrequency } from '@/generated/prisma';
import { auth } from '@/lib/auth';

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alerts = await prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        savedSearch: {
          select: {
            id: true,
            name: true,
            filters: true,
          },
        },
      },
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

interface CreateAlertBody {
  savedSearchId: string;
  frequency?: AlertFrequency;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateAlertBody = await request.json();

    if (!body.savedSearchId) {
      return NextResponse.json(
        { error: 'savedSearchId is required' },
        { status: 400 }
      );
    }

    // Verify the saved search belongs to the user
    const savedSearch = await prisma.savedSearch.findFirst({
      where: {
        id: body.savedSearchId,
        userId,
      },
    });

    if (!savedSearch) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    // Check if alert already exists
    const existingAlert = await prisma.alert.findUnique({
      where: {
        userId_savedSearchId: {
          userId,
          savedSearchId: body.savedSearchId,
        },
      },
    });

    if (existingAlert) {
      return NextResponse.json(
        { error: 'Alert already exists for this saved search' },
        { status: 409 }
      );
    }

    const alert = await prisma.alert.create({
      data: {
        userId,
        savedSearchId: body.savedSearchId,
        frequency: body.frequency || 'DAILY',
      },
      include: {
        savedSearch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}
