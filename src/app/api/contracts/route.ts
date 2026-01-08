import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ContractSearchFilters, PaginatedResponse } from '@/types';
import { Prisma, ContractLead } from '@/generated/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const sortBy = searchParams.get('sortBy') || 'postedDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Parse filter parameters
    const filters: ContractSearchFilters = {
      keyword: searchParams.get('keyword') || undefined,
      naicsCodes: searchParams.get('naicsCodes')?.split(',').filter(Boolean) || undefined,
      agency: searchParams.get('agency') || undefined,
      setAsideType: searchParams.get('setAsideType') || undefined,
      noticeType: searchParams.get('noticeType') || undefined,
      postedDateFrom: searchParams.get('postedDateFrom') || undefined,
      postedDateTo: searchParams.get('postedDateTo') || undefined,
      responseDeadlineFrom: searchParams.get('responseDeadlineFrom') || undefined,
      responseDeadlineTo: searchParams.get('responseDeadlineTo') || undefined,
      estimatedValueMin: searchParams.get('estimatedValueMin')
        ? parseFloat(searchParams.get('estimatedValueMin')!)
        : undefined,
      estimatedValueMax: searchParams.get('estimatedValueMax')
        ? parseFloat(searchParams.get('estimatedValueMax')!)
        : undefined,
      placeOfPerformance: searchParams.get('placeOfPerformance') || undefined,
    };

    // Build where clause - always exclude archived contracts
    const where: Prisma.ContractLeadWhereInput = {
      isArchived: false,
    };

    if (filters.keyword) {
      where.OR = [
        { title: { contains: filters.keyword, mode: 'insensitive' } },
        { description: { contains: filters.keyword, mode: 'insensitive' } },
      ];
    }

    if (filters.naicsCodes && filters.naicsCodes.length > 0) {
      where.naicsCodes = { hasSome: filters.naicsCodes };
    }

    if (filters.agency) {
      where.agency = { contains: filters.agency, mode: 'insensitive' };
    }

    if (filters.setAsideType) {
      where.setAsideType = filters.setAsideType;
    }

    if (filters.noticeType) {
      where.noticeType = filters.noticeType;
    }

    if (filters.postedDateFrom || filters.postedDateTo) {
      where.postedDate = {};
      if (filters.postedDateFrom) {
        where.postedDate.gte = new Date(filters.postedDateFrom);
      }
      if (filters.postedDateTo) {
        where.postedDate.lte = new Date(filters.postedDateTo);
      }
    }

    if (filters.responseDeadlineFrom || filters.responseDeadlineTo) {
      where.responseDeadline = {};
      if (filters.responseDeadlineFrom) {
        where.responseDeadline.gte = new Date(filters.responseDeadlineFrom);
      }
      if (filters.responseDeadlineTo) {
        where.responseDeadline.lte = new Date(filters.responseDeadlineTo);
      }
    }

    if (filters.estimatedValueMin !== undefined || filters.estimatedValueMax !== undefined) {
      where.estimatedValue = {};
      if (filters.estimatedValueMin !== undefined) {
        where.estimatedValue.gte = filters.estimatedValueMin;
      }
      if (filters.estimatedValueMax !== undefined) {
        where.estimatedValue.lte = filters.estimatedValueMax;
      }
    }

    if (filters.placeOfPerformance) {
      where.placeOfPerformance = { contains: filters.placeOfPerformance, mode: 'insensitive' };
    }

    // Build order by
    const orderBy: Prisma.ContractLeadOrderByWithRelationInput = {};
    const validSortFields = ['postedDate', 'responseDeadline', 'estimatedValue', 'title'] as const;
    if (validSortFields.includes(sortBy as (typeof validSortFields)[number])) {
      orderBy[sortBy as keyof Prisma.ContractLeadOrderByWithRelationInput] =
        sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
      orderBy.postedDate = 'desc';
    }

    // Execute queries
    const [contracts, total] = await Promise.all([
      prisma.contractLead.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contractLead.count({ where }),
    ]);

    const response: PaginatedResponse<ContractLead> = {
      data: contracts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contracts' },
      { status: 500 }
    );
  }
}
