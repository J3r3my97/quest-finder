import { inngest } from '@/lib/inngest';
import { prisma } from '@/lib/prisma';

// Lazy import to avoid build-time issues
async function getGmailService() {
  const { fetchUnreadCommbuysEmails, markEmailAsRead, GmailApiError } = await import(
    '@/services/gmail'
  );
  return { fetchUnreadCommbuysEmails, markEmailAsRead, GmailApiError };
}

async function getEmailParser() {
  const { parseCommbuysEmail, normalizeCommbuysEmailOpportunity } = await import(
    '@/services/commbuys-email-parser'
  );
  return { parseCommbuysEmail, normalizeCommbuysEmailOpportunity };
}

/**
 * Sync contracts from COMMBUYS email alerts
 * Runs every 15 minutes to check for new bid notification emails
 */
export const syncCommbuysEmail = inngest.createFunction(
  {
    id: 'sync-commbuys-email',
    name: 'Sync COMMBUYS Email Alerts',
    retries: 3,
  },
  { cron: '*/15 * * * *' }, // Every 15 minutes
  async ({ step, logger }) => {
    // Check if Gmail is configured
    if (!process.env.GMAIL_REFRESH_TOKEN) {
      logger.warn('GMAIL_REFRESH_TOKEN not configured, skipping email sync');
      return { success: false, reason: 'Gmail not configured' };
    }

    const { fetchUnreadCommbuysEmails, markEmailAsRead } = await getGmailService();
    const { parseCommbuysEmail, normalizeCommbuysEmailOpportunity } = await getEmailParser();

    // Step 1: Fetch unread emails from Gmail
    const emails = await step.run('fetch-emails', async () => {
      logger.info('Fetching unread COMMBUYS emails from Gmail');

      try {
        const messages = await fetchUnreadCommbuysEmails(50);
        logger.info(`Found ${messages.length} unread COMMBUYS emails`);
        return messages;
      } catch (error) {
        logger.error('Failed to fetch emails:', { error });
        throw error;
      }
    });

    if (emails.length === 0) {
      logger.info('No new COMMBUYS emails to process');
      return { success: true, processed: 0 };
    }

    // Step 2: Parse and upsert each email
    const stats = await step.run('process-emails', async () => {
      let created = 0;
      let updated = 0;
      let errors = 0;
      let skipped = 0;
      const processedMessageIds: string[] = [];

      for (const email of emails) {
        try {
          // Parse the email
          const parsed = parseCommbuysEmail(email.body, email.subject);

          if (!parsed) {
            logger.warn('Could not parse COMMBUYS email', {
              subject: email.subject,
              id: email.id,
            });
            skipped++;
            // Still mark as read to avoid reprocessing
            await markEmailAsRead(email.id);
            processedMessageIds.push(email.id);
            continue;
          }

          // Normalize to ContractLead format
          const opportunity = normalizeCommbuysEmailOpportunity(parsed);

          // Upsert to database
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
            logger.info(`Updated contract: ${opportunity.sourceId}`);
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
            logger.info(`Created contract: ${opportunity.sourceId}`);
          }

          // Mark email as read
          await markEmailAsRead(email.id);
          processedMessageIds.push(email.id);
        } catch (error) {
          logger.error(`Error processing email ${email.id}:`, { error });
          errors++;
        }
      }

      return { created, updated, errors, skipped, processedMessageIds };
    });

    // Step 3: Update sync state
    await step.run('update-sync-state', async () => {
      await prisma.syncState.upsert({
        where: { syncType: 'COMMBUYS_EMAIL' },
        update: {
          lastSyncedAt: new Date(),
          lastMessageId: stats.processedMessageIds[0] || null,
          metadata: {
            lastRun: new Date().toISOString(),
            created: stats.created,
            updated: stats.updated,
            errors: stats.errors,
            skipped: stats.skipped,
          },
        },
        create: {
          syncType: 'COMMBUYS_EMAIL',
          lastSyncedAt: new Date(),
          lastMessageId: stats.processedMessageIds[0] || null,
          metadata: {
            lastRun: new Date().toISOString(),
            created: stats.created,
            updated: stats.updated,
            errors: stats.errors,
            skipped: stats.skipped,
          },
        },
      });
    });

    // Step 4: Trigger alert checks for new contracts
    if (stats.created > 0) {
      await step.sendEvent('trigger-alert-check', {
        name: 'alerts/check',
        data: {},
      });

      await step.sendEvent('trigger-profile-alert-check', {
        name: 'profile-alerts/check',
        data: {},
      });
    }

    logger.info('COMMBUYS email sync completed', stats);
    return {
      success: true,
      ...stats,
      totalProcessed: emails.length,
    };
  }
);

/**
 * Manual trigger for COMMBUYS email sync
 * Can be triggered via API or admin panel
 */
export const manualSyncCommbuysEmail = inngest.createFunction(
  {
    id: 'manual-sync-commbuys-email',
    name: 'Manual COMMBUYS Email Sync',
    retries: 2,
  },
  { event: 'commbuys-email/sync' },
  async ({ event, step, logger }) => {
    logger.info('Manual COMMBUYS email sync triggered', { force: event.data.force });

    // Check if Gmail is configured
    if (!process.env.GMAIL_REFRESH_TOKEN) {
      return { success: false, reason: 'Gmail not configured' };
    }

    const { fetchUnreadCommbuysEmails, markEmailAsRead } = await getGmailService();
    const { parseCommbuysEmail, normalizeCommbuysEmailOpportunity } = await getEmailParser();

    // Fetch emails
    const emails = await step.run('fetch-emails', async () => {
      return fetchUnreadCommbuysEmails(100); // Higher limit for manual sync
    });

    if (emails.length === 0) {
      return { success: true, processed: 0, message: 'No unread COMMBUYS emails' };
    }

    // Process emails
    const stats = await step.run('process-emails', async () => {
      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const email of emails) {
        try {
          const parsed = parseCommbuysEmail(email.body, email.subject);
          if (!parsed) continue;

          const opportunity = normalizeCommbuysEmailOpportunity(parsed);

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

          await markEmailAsRead(email.id);
        } catch (error) {
          logger.error(`Error processing email:`, { error, emailId: email.id });
          errors++;
        }
      }

      return { created, updated, errors };
    });

    // Update sync state
    await step.run('update-sync-state', async () => {
      await prisma.syncState.upsert({
        where: { syncType: 'COMMBUYS_EMAIL' },
        update: {
          lastSyncedAt: new Date(),
          metadata: { manualSync: true, ...stats },
        },
        create: {
          syncType: 'COMMBUYS_EMAIL',
          lastSyncedAt: new Date(),
          metadata: { manualSync: true, ...stats },
        },
      });
    });

    return { success: true, ...stats };
  }
);
