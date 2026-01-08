import * as cheerio from 'cheerio';

/**
 * Parsed COMMBUYS email data
 */
export interface ParsedCommbuysEmail {
  bidId: string;
  title: string;
  description: string | null;
  agency: string;
  dueDate: string | null;
  postedDate: string | null;
  url: string | null;
  category: string | null;
  rawSubject: string;
}

/**
 * Normalized opportunity format (matches commbuys.ts NormalizedOpportunity)
 */
export interface NormalizedOpportunity {
  title: string;
  description: string | null;
  agency: string;
  subAgency: string | null;
  solicitationNumber: string | null;
  noticeType: string | null;
  naicsCodes: string[];
  pscCode: string | null;
  placeOfPerformance: string | null;
  postedDate: Date | null;
  responseDeadline: Date | null;
  archiveDate: Date | null;
  sourceUrl: string | null;
  sourceId: string;
  source: string;
  awardAmount: number | null;
}

/**
 * Parse COMMBUYS email HTML to extract bid information.
 *
 * COMMBUYS email subject patterns (from Mass.gov docs):
 * - "Bid Notification AND {Bid Short Description}"
 * - "Bid Amended AND {Bid Short Description}"
 * - "Bid Awarded AND {Bid Short Description}"
 *
 * The email body typically contains:
 * - Bid number (BD-XX-XXXX-XXXXX format)
 * - Title/Description
 * - Organization/Agency name
 * - Due date
 * - Link to COMMBUYS bid details
 */
export function parseCommbuysEmail(
  html: string,
  subject: string
): ParsedCommbuysEmail | null {
  const $ = cheerio.load(html);

  // Try to extract bid ID from various patterns
  // COMMBUYS bid IDs typically look like: BD-24-1234-ABC12-12345
  const bidIdPatterns = [
    /BD-\d{2,4}-\d{4,6}-[A-Z0-9]+-\d+/gi,
    /BD-\d{2,4}-\d{4,6}-[A-Z0-9]+/gi,
    /BD-[\w-]+/gi,
  ];

  let bidId: string | null = null;

  // Search in text content
  const textContent = $.text();
  for (const pattern of bidIdPatterns) {
    const match = textContent.match(pattern);
    if (match && match[0]) {
      bidId = match[0].toUpperCase();
      break;
    }
  }

  // Also check subject line
  if (!bidId) {
    for (const pattern of bidIdPatterns) {
      const match = subject.match(pattern);
      if (match && match[0]) {
        bidId = match[0].toUpperCase();
        break;
      }
    }
  }

  if (!bidId) {
    // Can't parse without a bid ID
    console.warn('Could not extract bid ID from COMMBUYS email:', subject);
    return null;
  }

  // Extract title from subject (remove notification prefix)
  let title = subject
    .replace(/^Bid\s+(Notification|Amended|Awarded|Cancelled)\s+AND\s+/i, '')
    .trim();

  // If title is empty, try to find it in the email body
  if (!title || title === bidId) {
    // Look for common title patterns in HTML
    const titleElement =
      $('h1, h2, .title, [class*="title"], [class*="subject"]').first().text().trim() ||
      $('strong, b').first().text().trim();
    if (titleElement && titleElement.length > 10) {
      title = titleElement;
    } else {
      title = bidId; // Fallback to bid ID
    }
  }

  // Extract organization/agency
  let agency = 'Commonwealth of Massachusetts';
  const orgPatterns = [
    /(?:Organization|Agency|Department|Issuing\s+Agency):\s*([^\n<]+)/i,
    /(?:From|Issued\s+by):\s*([^\n<]+)/i,
  ];

  for (const pattern of orgPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      agency = match[1].trim();
      break;
    }
  }

  // Also check for organization in structured elements
  const orgElement = $('[class*="org"], [class*="agency"], [class*="department"]')
    .first()
    .text()
    .trim();
  if (orgElement && orgElement.length > 3) {
    agency = orgElement;
  }

  // Extract due date
  let dueDate: string | null = null;
  const dueDatePatterns = [
    /(?:Due|Deadline|Close[sd]?\s*Date|Response\s+Due|Submission\s+Due):\s*([^\n<]+)/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:at\s+\d{1,2}:\d{2})?/i,
  ];

  for (const pattern of dueDatePatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      dueDate = match[1].trim();
      break;
    }
  }

  // Extract posted date
  let postedDate: string | null = null;
  const postedPatterns = [
    /(?:Posted|Published|Open\s+Date):\s*([^\n<]+)/i,
  ];

  for (const pattern of postedPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      postedDate = match[1].trim();
      break;
    }
  }

  // Extract COMMBUYS URL
  let url: string | null = null;
  $('a[href*="commbuys.com"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('bidDetail')) {
      url = href;
      return false; // Break loop
    }
  });

  // Fallback: look for any COMMBUYS link
  if (!url) {
    $('a[href*="commbuys.com"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        url = href;
        return false;
      }
    });
  }

  // Extract category if available
  let category: string | null = null;
  const categoryPatterns = [
    /(?:Category|Type|Classification):\s*([^\n<]+)/i,
  ];

  for (const pattern of categoryPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      category = match[1].trim();
      break;
    }
  }

  // Extract description (look for longer text blocks)
  let description: string | null = null;
  const descPatterns = [
    /(?:Description|Summary|Overview):\s*([^\n]+(?:\n(?![A-Z][a-z]+:)[^\n]+)*)/i,
  ];

  for (const pattern of descPatterns) {
    const match = textContent.match(pattern);
    if (match && match[1]) {
      description = match[1].trim().substring(0, 500);
      break;
    }
  }

  return {
    bidId,
    title,
    description,
    agency,
    dueDate,
    postedDate,
    url,
    category,
    rawSubject: subject,
  };
}

/**
 * Normalize parsed COMMBUYS email to ContractLead format
 */
export function normalizeCommbuysEmailOpportunity(
  parsed: ParsedCommbuysEmail
): NormalizedOpportunity {
  return {
    title: parsed.title,
    description: parsed.description,
    agency: parsed.agency,
    subAgency: null,
    solicitationNumber: parsed.bidId,
    noticeType: determineNoticeType(parsed.rawSubject),
    naicsCodes: [],
    pscCode: null,
    placeOfPerformance: 'Massachusetts',
    postedDate: parseDate(parsed.postedDate),
    responseDeadline: parseDate(parsed.dueDate),
    archiveDate: null,
    sourceUrl: parsed.url,
    sourceId: `COMMBUYS_EMAIL_${parsed.bidId}`,
    source: 'COMMBUYS_EMAIL',
    awardAmount: null,
  };
}

/**
 * Determine notice type from email subject
 */
function determineNoticeType(subject: string): string {
  const subjectLower = subject.toLowerCase();
  if (subjectLower.includes('awarded')) return 'Award';
  if (subjectLower.includes('amended')) return 'Amendment';
  if (subjectLower.includes('cancelled')) return 'Cancelled';
  if (subjectLower.includes('notification')) return 'Solicitation';
  return 'Open';
}

/**
 * Parse various date formats to Date object
 */
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;

  // Clean up the string
  const cleaned = dateStr.trim();

  // Try MM/DD/YYYY format
  const slashMatch = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    let fullYear = parseInt(year);
    if (fullYear < 100) {
      fullYear += fullYear > 50 ? 1900 : 2000;
    }
    const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
    return isNaN(date.getTime()) ? null : date;
  }

  // Try natural language date (e.g., "January 15, 2026")
  const naturalMatch = cleaned.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (naturalMatch) {
    const monthNames: Record<string, number> = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    };
    const month = monthNames[naturalMatch[1].toLowerCase()];
    if (month !== undefined) {
      const date = new Date(parseInt(naturalMatch[3]), month, parseInt(naturalMatch[2]));
      return isNaN(date.getTime()) ? null : date;
    }
  }

  // Try ISO format or other standard formats
  const date = new Date(cleaned);
  return isNaN(date.getTime()) ? null : date;
}
