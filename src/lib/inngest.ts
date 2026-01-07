import { Inngest } from 'inngest';

// Create the Inngest client
export const inngest = new Inngest({
  id: 'quest-finder',
  name: 'Quest Finder',
});

// Event types for type safety
export type Events = {
  'contracts/sync': {
    data: {
      force?: boolean;
    };
  };
  'alerts/check': {
    data: {
      savedSearchId?: string;
    };
  };
  'alerts/send': {
    data: {
      alertId: string;
      userId: string;
      matches: string[];
    };
  };
};
