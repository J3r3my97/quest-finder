import { google, gmail_v1 } from 'googleapis';

// Lazy initialization to avoid errors during build
let gmailInstance: gmail_v1.Gmail | null = null;

export class GmailApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'GmailApiError';
  }
}

/**
 * Get authenticated Gmail client using Service Account with domain-wide delegation.
 *
 * Required env vars:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL: The service account email
 * - GOOGLE_SERVICE_ACCOUNT_KEY: The private key (base64 encoded or raw with \n)
 * - GMAIL_USER_EMAIL: The Gmail user to impersonate (e.g., Rui@aurafarmer.co)
 */
function getAuthClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const userEmail = process.env.GMAIL_USER_EMAIL;

  if (!serviceAccountEmail || !privateKey || !userEmail) {
    throw new GmailApiError(
      'Missing Gmail service account configuration. Required: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY, GMAIL_USER_EMAIL'
    );
  }

  // Handle private key - may be base64 encoded or have escaped newlines
  let formattedKey = privateKey;

  // If it looks like base64 (no newlines or BEGIN), decode it
  if (!privateKey.includes('-----BEGIN')) {
    formattedKey = Buffer.from(privateKey, 'base64').toString('utf-8');
  }

  // Replace escaped newlines with actual newlines
  formattedKey = formattedKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: formattedKey,
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    subject: userEmail, // Impersonate this user
  });

  return auth;
}

export function getGmailClient(): gmail_v1.Gmail {
  if (!gmailInstance) {
    gmailInstance = google.gmail({ version: 'v1', auth: getAuthClient() });
  }
  return gmailInstance;
}

// Proxy for backwards compatibility (follows stripe.ts pattern)
export const gmail = new Proxy({} as gmail_v1.Gmail, {
  get(_, prop) {
    return Reflect.get(getGmailClient(), prop);
  },
});

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: Date;
  body: string;
  snippet: string;
}

/**
 * Fetch unread emails from COMMBUYS
 * Query: from:notifications@commbuys.com is:unread
 */
export async function fetchUnreadCommbuysEmails(
  maxResults: number = 50
): Promise<GmailMessage[]> {
  const client = getGmailClient();

  try {
    // List unread emails from COMMBUYS
    const listResponse = await client.users.messages.list({
      userId: 'me',
      q: 'from:notifications@commbuys.com is:unread',
      maxResults,
    });

    const messageIds = listResponse.data.messages || [];
    if (messageIds.length === 0) {
      return [];
    }

    // Fetch full message content for each
    const messages: GmailMessage[] = [];

    for (const { id } of messageIds) {
      if (!id) continue;

      const message = await client.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });

      const parsed = parseGmailMessage(message.data);
      if (parsed) {
        messages.push(parsed);
      }
    }

    return messages;
  } catch (error) {
    if (error instanceof GmailApiError) throw error;
    throw new GmailApiError(
      `Failed to fetch emails: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error
    );
  }
}

/**
 * Mark an email as read by removing UNREAD label
 */
export async function markEmailAsRead(messageId: string): Promise<void> {
  const client = getGmailClient();

  try {
    await client.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  } catch (error) {
    throw new GmailApiError(
      `Failed to mark email as read: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error
    );
  }
}

/**
 * Parse Gmail API message into our format
 */
function parseGmailMessage(message: gmail_v1.Schema$Message): GmailMessage | null {
  if (!message.id || !message.threadId) return null;

  const headers = message.payload?.headers || [];

  // Extract headers
  const getHeader = (name: string): string => {
    const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
    return header?.value || '';
  };

  const subject = getHeader('Subject');
  const from = getHeader('From');
  const dateStr = getHeader('Date');

  // Parse date
  let date = new Date();
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      date = parsed;
    }
  }

  // Extract body (prefer HTML, fallback to plain text)
  const body = extractMessageBody(message.payload);

  return {
    id: message.id,
    threadId: message.threadId,
    subject,
    from,
    date,
    body,
    snippet: message.snippet || '',
  };
}

/**
 * Extract message body from Gmail payload
 * Handles multipart messages and base64 encoding
 */
function extractMessageBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';

  // Check for direct body data
  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  // Handle multipart messages
  if (payload.parts) {
    // Prefer HTML content
    const htmlPart = payload.parts.find(
      (p) => p.mimeType === 'text/html' || p.mimeType?.includes('html')
    );
    if (htmlPart?.body?.data) {
      return decodeBase64(htmlPart.body.data);
    }

    // Fallback to plain text
    const textPart = payload.parts.find((p) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      return decodeBase64(textPart.body.data);
    }

    // Recursively check nested parts (for multipart/alternative inside multipart/mixed)
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractMessageBody(part);
        if (nested) return nested;
      }
    }
  }

  return '';
}

/**
 * Decode base64url encoded content from Gmail API
 */
function decodeBase64(data: string): string {
  // Gmail uses URL-safe base64
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}
