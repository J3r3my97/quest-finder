import { inngest } from '@/lib/inngest';
import { prisma } from '@/lib/prisma';
import { resend } from '@/lib/resend';
import { ContractSearchFilters } from '@/types';
import { Prisma } from '@/generated/prisma';

/**
 * Check all active alerts for new matching contracts
 * Runs after contract sync or on schedule
 */
export const checkAlerts = inngest.createFunction(
  {
    id: 'check-alerts',
    name: 'Check Alerts for New Matches',
    retries: 2,
  },
  { event: 'alerts/check' },
  async ({ event, step, logger }) => {
    // Get all active alerts
    const alerts = await step.run('get-active-alerts', async () => {
      return prisma.alert.findMany({
        where: { isActive: true },
        include: {
          savedSearch: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              subscriptionTier: true,
            },
          },
        },
      });
    });

    logger.info(`Found ${alerts.length} active alerts to check`);

    // Process specific alert if provided, otherwise process all
    const alertsToProcess = event.data.savedSearchId
      ? alerts.filter((a) => a.savedSearchId === event.data.savedSearchId)
      : alerts;

    const results = [];

    for (const alert of alertsToProcess) {
      const result = await step.run(`check-alert-${alert.id}`, async () => {
        // Check if user has alerts enabled based on subscription
        if (alert.user.subscriptionTier === 'FREE') {
          return { alertId: alert.id, skipped: true, reason: 'Free tier' };
        }

        // Check frequency
        const now = new Date();
        if (alert.lastSentAt) {
          const hoursSinceLastSent =
            (now.getTime() - new Date(alert.lastSentAt).getTime()) / (1000 * 60 * 60);

          const minHours =
            alert.frequency === 'REALTIME'
              ? 1
              : alert.frequency === 'DAILY'
              ? 24
              : 168; // WEEKLY

          if (hoursSinceLastSent < minHours) {
            return {
              alertId: alert.id,
              skipped: true,
              reason: `Too soon (${hoursSinceLastSent.toFixed(1)}h < ${minHours}h)`,
            };
          }
        }

        // Parse saved search filters
        const filters = alert.savedSearch.filters as unknown as ContractSearchFilters;

        // Build Prisma where clause from filters
        const sinceDate = alert.lastSentAt ? new Date(alert.lastSentAt) : null;
        const where = buildWhereClause(filters, sinceDate);

        // Find matching contracts
        const matches = await prisma.contractLead.findMany({
          where,
          orderBy: { postedDate: 'desc' },
          take: 50,
        });

        if (matches.length === 0) {
          return { alertId: alert.id, matches: 0 };
        }

        // Send notification event
        await inngest.send({
          name: 'alerts/send',
          data: {
            alertId: alert.id,
            userId: alert.userId,
            matches: matches.map((m) => m.id),
          },
        });

        // Update alert tracking
        await prisma.alert.update({
          where: { id: alert.id },
          data: {
            lastSentAt: now,
            lastMatchCount: matches.length,
          },
        });

        return { alertId: alert.id, matches: matches.length };
      });

      results.push(result);
    }

    return { processed: results.length, results };
  }
);

/**
 * Send alert notification to user
 */
export const sendAlert = inngest.createFunction(
  {
    id: 'send-alert',
    name: 'Send Alert Notification',
    retries: 3,
  },
  { event: 'alerts/send' },
  async ({ event, step, logger }) => {
    const { alertId, userId, matches } = event.data;

    // Get alert and user details
    const alert = await step.run('get-alert', async () => {
      return prisma.alert.findUnique({
        where: { id: alertId },
        include: {
          savedSearch: true,
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });
    });

    if (!alert) {
      logger.error(`Alert ${alertId} not found`);
      return { success: false, error: 'Alert not found' };
    }

    // Get contract details
    const contracts = await step.run('get-contracts', async () => {
      return prisma.contractLead.findMany({
        where: { id: { in: matches } },
        select: {
          id: true,
          title: true,
          agency: true,
          responseDeadline: true,
          estimatedValue: true,
          sourceUrl: true,
        },
      });
    });

    // Send email notification
    await step.run('send-email', async () => {
      if (!alert.user.email) {
        logger.warn('User has no email address', { userId: alert.userId });
        return { sent: false, reason: 'No email address' };
      }

      const contractList = contracts
        .map((c) => {
          const deadline = c.responseDeadline
            ? new Date(c.responseDeadline).toLocaleDateString()
            : 'No deadline';
          const value = c.estimatedValue
            ? `$${Number(c.estimatedValue).toLocaleString()}`
            : 'Not specified';
          return `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">
                <strong>${c.title}</strong><br/>
                <span style="color: #666;">${c.agency}</span>
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">${deadline}</td>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">${value}</td>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">
                ${c.sourceUrl ? `<a href="${c.sourceUrl}">View</a>` : '-'}
              </td>
            </tr>
          `;
        })
        .join('');

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New Contract Matches</h2>
          <p>Your saved search "<strong>${alert.savedSearch.name}</strong>" has ${contracts.length} new matching contract${contracts.length === 1 ? '' : 's'}.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 12px; text-align: left;">Contract</th>
                <th style="padding: 12px; text-align: left;">Deadline</th>
                <th style="padding: 12px; text-align: left;">Est. Value</th>
                <th style="padding: 12px; text-align: left;">Link</th>
              </tr>
            </thead>
            <tbody>
              ${contractList}
            </tbody>
          </table>

          <p style="margin-top: 20px;">
            <a href="https://quests.aurafarmer.co/search" style="background: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View All Contracts
            </a>
          </p>

          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            You received this email because you have alerts enabled for this saved search.
            <a href="https://quests.aurafarmer.co/saved-searches">Manage your alerts</a>
          </p>
        </div>
      `;

      try {
        await resend.emails.send({
          from: 'Quest Finder <alerts@quests.aurafarmer.co>',
          to: alert.user.email,
          subject: `${contracts.length} new contract${contracts.length === 1 ? '' : 's'} match "${alert.savedSearch.name}"`,
          html,
        });
        logger.info('Alert email sent', { to: alert.user.email, matchCount: contracts.length });
        return { sent: true };
      } catch (error) {
        logger.error('Failed to send alert email', { error, to: alert.user.email });
        throw error;
      }
    });

    return {
      success: true,
      alertId,
      userId,
      matchCount: contracts.length,
    };
  }
);

/**
 * Scheduled alert check
 * Runs every hour to check for immediate alerts, daily/weekly are handled separately
 */
export const scheduledAlertCheck = inngest.createFunction(
  {
    id: 'scheduled-alert-check',
    name: 'Scheduled Alert Check',
    retries: 2,
  },
  { cron: '0 * * * *' }, // Run every hour
  async ({ step, logger }) => {
    logger.info('Running scheduled alert check');

    await step.sendEvent('trigger-check', {
      name: 'alerts/check',
      data: {},
    });

    return { triggered: true };
  }
);

/**
 * Build Prisma where clause from search filters
 */
function buildWhereClause(
  filters: ContractSearchFilters,
  sinceDate?: Date | null
): Prisma.ContractLeadWhereInput {
  const where: Prisma.ContractLeadWhereInput = {};

  // Only get contracts posted since last alert
  if (sinceDate) {
    where.postedDate = { gte: sinceDate };
  }

  // Keyword search
  if (filters.keyword) {
    where.OR = [
      { title: { contains: filters.keyword, mode: 'insensitive' } },
      { description: { contains: filters.keyword, mode: 'insensitive' } },
    ];
  }

  // Agency filter
  if (filters.agency) {
    where.agency = { contains: filters.agency, mode: 'insensitive' };
  }

  // NAICS codes
  if (filters.naicsCodes && filters.naicsCodes.length > 0) {
    where.naicsCodes = { hasSome: filters.naicsCodes };
  }

  // Set-aside type
  if (filters.setAsideType) {
    where.setAsideType = filters.setAsideType;
  }

  // Notice type
  if (filters.noticeType) {
    where.noticeType = filters.noticeType;
  }

  // Place of performance
  if (filters.placeOfPerformance) {
    where.placeOfPerformance = {
      contains: filters.placeOfPerformance,
      mode: 'insensitive',
    };
  }

  // Estimated value range
  if (filters.estimatedValueMin !== undefined) {
    where.estimatedValue = {
      ...((where.estimatedValue as Prisma.DecimalNullableFilter) || {}),
      gte: filters.estimatedValueMin,
    };
  }
  if (filters.estimatedValueMax !== undefined) {
    where.estimatedValue = {
      ...((where.estimatedValue as Prisma.DecimalNullableFilter) || {}),
      lte: filters.estimatedValueMax,
    };
  }

  // Response deadline
  if (filters.responseDeadlineFrom) {
    where.responseDeadline = {
      ...((where.responseDeadline as Prisma.DateTimeNullableFilter) || {}),
      gte: new Date(filters.responseDeadlineFrom),
    };
  }
  if (filters.responseDeadlineTo) {
    where.responseDeadline = {
      ...((where.responseDeadline as Prisma.DateTimeNullableFilter) || {}),
      lte: new Date(filters.responseDeadlineTo),
    };
  }

  return where;
}
