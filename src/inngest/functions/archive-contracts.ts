import { inngest } from '@/lib/inngest';
import { prisma } from '@/lib/prisma';

/**
 * Archive expired contracts
 * Runs daily to clean up contracts that are past their deadline
 */
export const archiveContracts = inngest.createFunction(
  {
    id: 'archive-contracts',
    name: 'Archive Expired Contracts',
    retries: 2,
  },
  { cron: '0 8 * * *' }, // Run daily at 8 AM UTC (after syncs at 6-7 AM)
  async ({ logger }) => {
    const now = new Date();

    // Find contracts to archive:
    // 1. Response deadline has passed
    // 2. OR archive date has passed (SAM.gov field)
    // 3. AND not already archived
    const expiredContracts = await prisma.contractLead.findMany({
      where: {
        isArchived: false,
        OR: [
          { responseDeadline: { lt: now } },
          { archiveDate: { lt: now } },
        ],
      },
      select: { id: true, title: true, responseDeadline: true },
    });

    logger.info(`Found ${expiredContracts.length} contracts to archive`);

    if (expiredContracts.length === 0) {
      return { archived: 0 };
    }

    // Archive in batch
    const result = await prisma.contractLead.updateMany({
      where: {
        id: { in: expiredContracts.map((c) => c.id) },
      },
      data: {
        isArchived: true,
        archivedAt: now,
      },
    });

    logger.info(`Archived ${result.count} contracts`);

    return {
      archived: result.count,
      contracts: expiredContracts.slice(0, 10).map((c) => ({
        id: c.id,
        title: c.title,
        deadline: c.responseDeadline,
      })),
    };
  }
);

/**
 * Manual trigger for archiving contracts
 * Can be triggered via API or admin panel
 */
export const manualArchiveContracts = inngest.createFunction(
  {
    id: 'manual-archive-contracts',
    name: 'Manual Archive Contracts',
    retries: 1,
  },
  { event: 'contracts/archive' },
  async ({ logger }) => {
    const now = new Date();

    const expiredContracts = await prisma.contractLead.findMany({
      where: {
        isArchived: false,
        OR: [
          { responseDeadline: { lt: now } },
          { archiveDate: { lt: now } },
        ],
      },
      select: { id: true },
    });

    if (expiredContracts.length === 0) {
      logger.info('No contracts to archive');
      return { archived: 0 };
    }

    const result = await prisma.contractLead.updateMany({
      where: {
        id: { in: expiredContracts.map((c) => c.id) },
      },
      data: {
        isArchived: true,
        archivedAt: now,
      },
    });

    logger.info(`Manually archived ${result.count} contracts`);
    return { archived: result.count };
  }
);
