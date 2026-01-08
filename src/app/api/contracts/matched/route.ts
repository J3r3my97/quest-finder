import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { scoreAndSortContracts } from '@/services/match-scoring';
import { ContractLead, CompanyProfile } from '@/types';

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

    // Get user's company profile
    const profile = await prisma.companyProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return NextResponse.json({
        contracts: [],
        hasProfile: false,
        message: 'Complete your company profile to see matched contracts',
      });
    }

    // Get recent contracts (posted in last 30 days, not past deadline)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const contracts = await prisma.contractLead.findMany({
      where: {
        isArchived: false,
        postedDate: { gte: thirtyDaysAgo },
        OR: [
          { responseDeadline: null },
          { responseDeadline: { gte: new Date() } },
        ],
      },
      orderBy: { postedDate: 'desc' },
      take: 100, // Limit for performance
    });

    // Convert profile for scoring
    const profileForScoring: CompanyProfile = {
      id: profile.id,
      userId: profile.userId,
      companyName: profile.companyName,
      naicsCodes: profile.naicsCodes,
      certifications: profile.certifications,
      preferredStates: profile.preferredStates,
      minContractValue: profile.minContractValue
        ? Number(profile.minContractValue)
        : null,
      maxContractValue: profile.maxContractValue
        ? Number(profile.maxContractValue)
        : null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };

    // Convert contracts for scoring
    const contractsForScoring: ContractLead[] = contracts.map((c) => ({
      ...c,
      estimatedValue: c.estimatedValue ? Number(c.estimatedValue) : null,
      awardAmount: c.awardAmount ? Number(c.awardAmount) : null,
    }));

    // Score and sort contracts (minimum score of 30 to show)
    const matchedContracts = scoreAndSortContracts(
      contractsForScoring,
      profileForScoring,
      30
    );

    return NextResponse.json({
      contracts: matchedContracts.slice(0, 20), // Return top 20
      hasProfile: true,
      totalMatched: matchedContracts.length,
    });
  } catch (error) {
    console.error('Error fetching matched contracts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matched contracts' },
      { status: 500 }
    );
  }
}
