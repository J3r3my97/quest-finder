import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

    const profile = await prisma.companyProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return NextResponse.json(null);
    }

    // Convert Decimal to number for JSON serialization
    return NextResponse.json({
      ...profile,
      minContractValue: profile.minContractValue
        ? Number(profile.minContractValue)
        : null,
      maxContractValue: profile.maxContractValue
        ? Number(profile.maxContractValue)
        : null,
    });
  } catch (error) {
    console.error('Error fetching company profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company profile' },
      { status: 500 }
    );
  }
}

interface CompanyProfileBody {
  companyName: string;
  naicsCodes: string[];
  certifications: string[];
  preferredStates: string[];
  minContractValue?: number | null;
  maxContractValue?: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CompanyProfileBody = await request.json();

    if (!body.companyName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    // Upsert - create or update the profile
    const profile = await prisma.companyProfile.upsert({
      where: { userId },
      update: {
        companyName: body.companyName,
        naicsCodes: body.naicsCodes || [],
        certifications: body.certifications || [],
        preferredStates: body.preferredStates || [],
        minContractValue: body.minContractValue ?? null,
        maxContractValue: body.maxContractValue ?? null,
      },
      create: {
        userId,
        companyName: body.companyName,
        naicsCodes: body.naicsCodes || [],
        certifications: body.certifications || [],
        preferredStates: body.preferredStates || [],
        minContractValue: body.minContractValue ?? null,
        maxContractValue: body.maxContractValue ?? null,
      },
    });

    return NextResponse.json({
      ...profile,
      minContractValue: profile.minContractValue
        ? Number(profile.minContractValue)
        : null,
      maxContractValue: profile.maxContractValue
        ? Number(profile.maxContractValue)
        : null,
    });
  } catch (error) {
    console.error('Error saving company profile:', error);
    return NextResponse.json(
      { error: 'Failed to save company profile' },
      { status: 500 }
    );
  }
}
