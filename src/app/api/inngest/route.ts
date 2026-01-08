import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import {
  syncContracts,
  manualSyncContracts,
  syncCommbuys,
  manualSyncCommbuys,
  checkAlerts,
  sendAlert,
  scheduledAlertCheck,
  checkProfileAlerts,
  archiveContracts,
  manualArchiveContracts,
} from '@/inngest/functions';

// Create the Inngest serve handler
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncContracts,
    manualSyncContracts,
    syncCommbuys,
    manualSyncCommbuys,
    checkAlerts,
    sendAlert,
    scheduledAlertCheck,
    checkProfileAlerts,
    archiveContracts,
    manualArchiveContracts,
  ],
});
