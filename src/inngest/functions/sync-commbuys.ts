import { inngest } from '@/lib/inngest';
import { prisma } from '@/lib/prisma';

// TODO: Will be implemented by Workstream 1
async function fetchCommbuysOpportunities(limit: number) {
  // Stub - returns empty array until service is ready
  const { fetchCommbuysOpportunities } = await import('@/services/commbuys');
  return fetchCommbuysOpportunities(limit);
}

/**
 * Sync contracts from COMMBUYS (Massachusetts state procurement)
 * Runs daily to fetch new and updated contract opportunities
 */
export const syncCommbuys = inngest.createFunction(
  {
    id: 'sync-commbuys',
    name: 'Sync Contracts from COMMBUYS',
    retries: 3,
  },
  { cron: '0 7 * * *' }, // Run daily at 7 AM UTC (staggered from SAM.gov at 6 AM)
  async ({ step, logger }) => {
    // Step 1: Fetch recent opportunities from COMMBUYS
    const opportunities = await step.run('fetch-opportunities', async () => {
      logger.info('Fetching opportunities from COMMBUYS');

      const results = await fetchCommbuysOpportunities(25);

      logger.info(`Fetched ${results.length} opportunities from COMMBUYS`);
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
 * Manual trigger for COMMBUYS sync
 * Can be triggered via API or admin panel
 */
export const manualSyncCommbuys = inngest.createFunction(
  {
    id: 'manual-sync-commbuys',
    name: 'Manual COMMBUYS Sync',
    retries: 2,
  },
  { event: 'commbuys/sync' },
  async ({ event, step, logger }) => {
    logger.info('Manual COMMBUYS sync triggered', { force: event.data.force });

    // Reuse the same logic as the scheduled sync
    const opportunities = await step.run('fetch-opportunities', async () => {
      return fetchCommbuysOpportunities(25);
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
