import { inngest } from '@/lib/inngest';
import { prisma } from '@/lib/prisma';
import { fetchAllOpportunities } from '@/services/sam-gov';

/**
 * Sync contracts from SAM.gov
 * Runs daily to fetch new and updated contract opportunities
 */
export const syncContracts = inngest.createFunction(
  {
    id: 'sync-contracts',
    name: 'Sync Contracts from SAM.gov',
    retries: 3,
  },
  { cron: '0 6 * * *' }, // Run daily at 6 AM UTC
  async ({ step, logger }) => {
    // Step 1: Fetch recent opportunities from SAM.gov
    const opportunities = await step.run('fetch-opportunities', async () => {
      logger.info('Fetching opportunities from SAM.gov');

      // Fetch opportunities posted in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const results = await fetchAllOpportunities({
        postedDateFrom: sevenDaysAgo.toISOString().split('T')[0],
      }, 25); // Single page to avoid rate limits

      logger.info(`Fetched ${results.length} opportunities`);
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
          logger.error(`Error upserting opportunity ${opportunity.sourceId}:`, { error });
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

    logger.info('Contract sync completed', stats);
    return {
      success: true,
      ...stats,
      totalProcessed: opportunities.length,
    };
  }
);

/**
 * Manual trigger for contract sync
 * Can be triggered via API or admin panel
 */
export const manualSyncContracts = inngest.createFunction(
  {
    id: 'manual-sync-contracts',
    name: 'Manual Contract Sync',
    retries: 2,
  },
  { event: 'contracts/sync' },
  async ({ event, step, logger }) => {
    logger.info('Manual contract sync triggered', { force: event.data.force });

    // Reuse the same logic as the scheduled sync
    const opportunities = await step.run('fetch-opportunities', async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      return fetchAllOpportunities({
        postedDateFrom: sevenDaysAgo.toISOString().split('T')[0],
      }, 25); // Single page to avoid rate limits
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
