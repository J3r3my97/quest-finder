import { inngest } from '@/lib/inngest';
import { prisma } from '@/lib/prisma';

// Fetch from Boston.gov + real COMMBUYS
async function fetchMassachusettsOpportunities(bostonLimit: number, commbuysLimit: number) {
  const { fetchAllMassachusettsOpportunities } = await import('@/services/commbuys');
  return fetchAllMassachusettsOpportunities(bostonLimit, commbuysLimit);
}

/**
 * Sync contracts from Massachusetts sources (Boston.gov + COMMBUYS)
 * Runs daily to fetch new and updated contract opportunities
 */
export const syncCommbuys = inngest.createFunction(
  {
    id: 'sync-commbuys',
    name: 'Sync Contracts from Massachusetts',
    retries: 3,
  },
  { cron: '0 7 * * *' }, // Run daily at 7 AM UTC (staggered from SAM.gov at 6 AM)
  async ({ step, logger }) => {
    // Step 1: Fetch opportunities from Boston.gov + COMMBUYS
    const opportunities = await step.run('fetch-opportunities', async () => {
      logger.info('Fetching opportunities from Massachusetts sources (Boston.gov + COMMBUYS)');

      const results = await fetchMassachusettsOpportunities(25, 50);

      logger.info(`Fetched ${results.length} opportunities from Massachusetts sources`);
      return results;
    });

    // Step 2: Upsert contracts to database
    const stats = await step.run('upsert-contracts', async () => {
      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const opportunity of opportunities) {
        try {
          const existing = await prisma.contractLead.findUnique({
            where: { sourceId: opportunity.sourceId },
          });

          if (existing) {
            await prisma.contractLead.update({
              where: { id: existing.id },
              data: {
                title: opportunity.title,
                description: opportunity.description,
                agency: opportunity.agency,
                subAgency: opportunity.subAgency,
                solicitationNumber: opportunity.solicitationNumber,
                noticeType: opportunity.noticeType,
                naicsCodes: opportunity.naicsCodes,
                pscCode: opportunity.pscCode,
                placeOfPerformance: opportunity.placeOfPerformance,
                postedDate: opportunity.postedDate,
                responseDeadline: opportunity.responseDeadline,
                archiveDate: opportunity.archiveDate,
                sourceUrl: opportunity.sourceUrl,
                awardAmount: opportunity.awardAmount,
              },
            });
            updated++;
          } else {
            await prisma.contractLead.create({
              data: {
                title: opportunity.title,
                description: opportunity.description,
                agency: opportunity.agency,
                subAgency: opportunity.subAgency,
                solicitationNumber: opportunity.solicitationNumber,
                noticeType: opportunity.noticeType,
                naicsCodes: opportunity.naicsCodes,
                pscCode: opportunity.pscCode,
                placeOfPerformance: opportunity.placeOfPerformance,
                postedDate: opportunity.postedDate,
                responseDeadline: opportunity.responseDeadline,
                archiveDate: opportunity.archiveDate,
                sourceUrl: opportunity.sourceUrl,
                sourceId: opportunity.sourceId,
                source: opportunity.source,
                awardAmount: opportunity.awardAmount,
              },
            });
            created++;
          }
        } catch (error) {
          logger.error(`Error upserting COMMBUYS opportunity ${opportunity.sourceId}:`, { error });
          errors++;
        }
      }

      return { created, updated, errors };
    });

    // Step 3: Trigger alert checks for new contracts
    await step.sendEvent('trigger-alert-check', {
      name: 'alerts/check',
      data: {},
    });

    // Step 4: Trigger profile-based alert checks
    await step.sendEvent('trigger-profile-alert-check', {
      name: 'profile-alerts/check',
      data: {},
    });

    logger.info('COMMBUYS sync completed', stats);
    return {
      success: true,
      ...stats,
      totalProcessed: opportunities.length,
    };
  }
);

/**
 * Manual trigger for Massachusetts sync
 * Can be triggered via API or admin panel
 */
export const manualSyncCommbuys = inngest.createFunction(
  {
    id: 'manual-sync-commbuys',
    name: 'Manual Massachusetts Sync',
    retries: 2,
  },
  { event: 'commbuys/sync' },
  async ({ event, step, logger }) => {
    logger.info('Manual Massachusetts sync triggered', { force: event.data.force });

    // Fetch from both Boston.gov and COMMBUYS
    const opportunities = await step.run('fetch-opportunities', async () => {
      return fetchMassachusettsOpportunities(25, 50);
    });

    const stats = await step.run('upsert-contracts', async () => {
      let created = 0;
      let updated = 0;

      for (const opportunity of opportunities) {
        const existing = await prisma.contractLead.findUnique({
          where: { sourceId: opportunity.sourceId },
        });

        if (existing) {
          await prisma.contractLead.update({
            where: { id: existing.id },
            data: opportunity,
          });
          updated++;
        } else {
          await prisma.contractLead.create({
            data: {
              ...opportunity,
              sourceId: opportunity.sourceId,
              source: opportunity.source,
            },
          });
          created++;
        }
      }

      return { created, updated };
    });

    return { success: true, ...stats };
  }
);
