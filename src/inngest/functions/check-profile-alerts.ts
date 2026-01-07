import { inngest } from '@/lib/inngest';
import { prisma } from '@/lib/prisma';
import { resend } from '@/lib/resend';
import { scoreAndSortContracts } from '@/services/match-scoring';
import { ContractLead, CompanyProfile } from '@/types';

/**
 * Check all profile-based alerts for new matching contracts
 * Triggered after contract sync
 */
export const checkProfileAlerts = inngest.createFunction(
  {
    id: 'check-profile-alerts',
    name: 'Check Profile Alerts',
    retries: 2,
  },
  { event: 'profile-alerts/check' },
  async ({ step, logger }) => {
    // Get all profiles with alerts enabled
    const profiles = await step.run('get-profiles-with-alerts', async () => {
      return prisma.companyProfile.findMany({
        where: { alertsEnabled: true },
        include: {
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

    logger.info(`Found ${profiles.length} profiles with alerts enabled`);

    const results = [];

    for (const profile of profiles) {
      const result = await step.run(`check-profile-${profile.id}`, async () => {
        // Check if user has alerts based on subscription
        if (profile.user.subscriptionTier === 'FREE') {
          return { profileId: profile.id, skipped: true, reason: 'Free tier' };
        }

        // Check frequency
        const now = new Date();
        if (profile.lastAlertSentAt) {
          const hoursSinceLastSent =
            (now.getTime() - new Date(profile.lastAlertSentAt).getTime()) / (1000 * 60 * 60);

          const minHours =
            profile.alertFrequency === 'REALTIME'
              ? 1
              : profile.alertFrequency === 'DAILY'
              ? 24
              : 168; // WEEKLY

          if (hoursSinceLastSent < minHours) {
            return {
              profileId: profile.id,
              skipped: true,
              reason: `Too soon (${hoursSinceLastSent.toFixed(1)}h < ${minHours}h)`,
            };
          }
        }

        // Get contracts posted since last alert (or last 7 days if first time)
        const sinceDate = profile.lastAlertSentAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const recentContracts = await prisma.contractLead.findMany({
          where: {
            postedDate: { gte: sinceDate },
            OR: [
              { responseDeadline: null },
              { responseDeadline: { gte: now } },
            ],
          },
          orderBy: { postedDate: 'desc' },
          take: 100,
        });

        if (recentContracts.length === 0) {
          return { profileId: profile.id, matches: 0 };
        }

        // Convert for scoring
        const profileForScoring: CompanyProfile = {
          id: profile.id,
          userId: profile.userId,
          companyName: profile.companyName,
          naicsCodes: profile.naicsCodes,
          certifications: profile.certifications,
          preferredStates: profile.preferredStates,
          minContractValue: profile.minContractValue ? Number(profile.minContractValue) : null,
          maxContractValue: profile.maxContractValue ? Number(profile.maxContractValue) : null,
          createdAt: new Date(profile.createdAt),
          updatedAt: new Date(profile.updatedAt),
        };

        const contractsTyped: ContractLead[] = recentContracts.map((c) => ({
          ...c,
          estimatedValue: c.estimatedValue ? Number(c.estimatedValue) : null,
          awardAmount: c.awardAmount ? Number(c.awardAmount) : null,
        }));

        // Score and filter by minimum score
        const matches = scoreAndSortContracts(
          contractsTyped,
          profileForScoring,
          profile.minMatchScore
        );

        if (matches.length === 0) {
          return { profileId: profile.id, matches: 0 };
        }

        // Send email alert
        await sendProfileAlert(profile, matches.slice(0, 10), logger);

        // Update profile tracking
        await prisma.companyProfile.update({
          where: { id: profile.id },
          data: {
            lastAlertSentAt: now,
            lastAlertMatches: matches.length,
          },
        });

        return { profileId: profile.id, matches: matches.length };
      });

      results.push(result);
    }

    return { processed: results.length, results };
  }
);

async function sendProfileAlert(
  profile: {
    id: string;
    companyName: string;
    minMatchScore: number;
    user: { email: string | null; name: string | null };
  },
  matches: Array<{ contract: ContractLead; matchScore: number; matchReasons: string[] }>,
  logger: { info: (msg: string, data?: unknown) => void; error: (msg: string, data?: unknown) => void }
) {
  if (!profile.user.email) {
    logger.info('User has no email', { profileId: profile.id });
    return;
  }

  const contractRows = matches
    .map(({ contract, matchScore, matchReasons }) => {
      const deadline = contract.responseDeadline
        ? new Date(contract.responseDeadline).toLocaleDateString()
        : 'No deadline';
      const value = contract.estimatedValue
        ? `$${Number(contract.estimatedValue).toLocaleString()}`
        : 'TBD';

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">
            <strong>${contract.title}</strong><br/>
            <span style="color: #666;">${contract.agency}</span><br/>
            <span style="font-size: 12px; color: #888;">${matchReasons.join(' • ')}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
            <span style="font-size: 20px; font-weight: bold; color: #0070f3;">${matchScore}</span>
            <span style="font-size: 11px; color: #888;">/100</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${deadline}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${value}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">
            ${contract.sourceUrl ? `<a href="${contract.sourceUrl}" style="color: #0070f3;">View</a>` : '-'}
          </td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <div style="font-family: sans-serif; max-width: 700px; margin: 0 auto;">
      <h2 style="color: #333;">New Contracts Match Your Profile</h2>
      <p>Hi ${profile.user.name || 'there'},</p>
      <p>We found <strong>${matches.length} new contract${matches.length === 1 ? '' : 's'}</strong> that match your company profile for <strong>${profile.companyName}</strong>.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 12px; text-align: left;">Contract</th>
            <th style="padding: 12px; text-align: center; width: 80px;">Match</th>
            <th style="padding: 12px; text-align: left;">Deadline</th>
            <th style="padding: 12px; text-align: left;">Est. Value</th>
            <th style="padding: 12px; text-align: left;">Link</th>
          </tr>
        </thead>
        <tbody>
          ${contractRows}
        </tbody>
      </table>

      <p style="margin-top: 20px;">
        <a href="https://quests.aurafarmer.co/dashboard" style="background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View All Matches
        </a>
      </p>

      <p style="color: #999; font-size: 12px; margin-top: 30px;">
        You're receiving this because you have profile alerts enabled for "${profile.companyName}".<br/>
        <a href="https://quests.aurafarmer.co/profile">Manage your alert settings</a>
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'Quest Finder <alerts@quests.aurafarmer.co>',
      to: profile.user.email,
      subject: `${matches.length} new contract${matches.length === 1 ? '' : 's'} match your profile`,
      html,
    });
    logger.info('Profile alert sent', { to: profile.user.email, matchCount: matches.length });
  } catch (error) {
    logger.error('Failed to send profile alert', { error, to: profile.user.email });
    throw error;
  }
}
