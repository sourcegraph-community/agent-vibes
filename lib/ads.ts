import type { RawAdsDoc, AdsApiResponse, Paper, AdsSearchOptions, TimeWindow } from '@/types/research';

const ADS_BASE = 'https://api.adsabs.harvard.edu/v1';

/**
 * Get date filter string for ADS query based on time window
 */
function getDateFilter(window: TimeWindow): string {
  if (window === 'all') return '';

  const now = new Date();
  const filters: Record<Exclude<TimeWindow, 'all'>, number> = {
    '3m': 90,
    '1m': 30,
    '1w': 7,
    '3d': 3,
    '1d': 1,
  };

  const daysAgo = filters[window as Exclude<TimeWindow, 'all'>];
  const filterDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  // Format date as YYYY-MM-DD for ADS API
  const dateStr = filterDate.toISOString().split('T')[0];
  return ` AND pubdate:[${dateStr} TO *]`;
}

/**
 * Search ADS for CS arXiv papers related to coding agents
 */
export async function searchAdsCodingAgents(
  optionsOrRows: AdsSearchOptions | number = {},
): Promise<Paper[]> {
  // Handle backwards compatibility with old (rows: number) signature
  const options: AdsSearchOptions = typeof optionsOrRows === 'number'
    ? { rows: optionsOrRows, window: '3m' }
    : optionsOrRows;
  const { rows = 25, window = '3m' } = options;

  if (!process.env.ADS_API_TOKEN) {
    throw new Error('ADS_API_TOKEN environment variable is required');
  }

  const baseQuery = 'bibstem:arxiv AND keyword:computer AND (abs:"coding agent" OR abs:"agentic" OR abs:"code generation" OR abs:"agentic code" OR abs:"agent-based" OR abs:"multi-agent" OR abs:"multi agent" OR abs:"agent" OR abs:"SWE-bench" OR abs:"HumanEval" OR abs:"code generation benchmark" OR abs:"agent evaluation" OR "large language models code" OR abs:"code completion")';
  const dateFilter = getDateFilter(window);
  const query = baseQuery + dateFilter;

  const params = new URLSearchParams({
    q: query,
    rows: rows.toString(),
    sort: 'score desc',
    fl: 'bibcode,title,author,pubdate,arxiv_class,abstract,citation_count,links_data,score',
  });

  const url = `${ADS_BASE}/search/query?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.ADS_API_TOKEN}`,
        'Accept': 'application/json',
        'User-Agent': 'Agent-Vibes/1.0',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`ADS API error: ${response.status} ${response.statusText}`);
    }

    const data: AdsApiResponse = await response.json();

    if (!data.response?.docs) {
      throw new Error('Invalid response format from ADS API');
    }

    return data.response.docs.map(mapAdsDocToPaper);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to search ADS: ${error.message}`);
    }
    throw new Error('Failed to search ADS: Unknown error');
  }
}

/**
 * Map raw ADS document to our Paper interface
 */
function mapAdsDocToPaper(doc: RawAdsDoc): Paper {
  // Find arXiv PDF link
  const arxivLink = doc.links_data?.find(link =>
    link.title?.toLowerCase().includes('arxiv') ||
    link.url?.includes('arxiv.org'),
  );

  // Extract arXiv ID from bibcode or links for PDF construction
  let pdfUrl = arxivLink?.url || '';
  if (!pdfUrl && doc.bibcode) {
    // Try to construct arXiv URL from bibcode if available
    const arxivMatch = doc.bibcode.match(/(\d{4}\.\d{4,5})/);
    if (arxivMatch) {
      pdfUrl = `https://arxiv.org/pdf/${arxivMatch[1]}.pdf`;
    }
  }

  // Format authors list
  const authors = doc.author || [];
  const authorString = authors.length > 4
    ? `${authors.slice(0, 4).join(', ')} et al.`
    : authors.join(', ');

  // Parse publication date - ADS bibcodes start with year (e.g., 2025arXiv...)
  let publishedDate: Date;

  // First try to extract year/month from bibcode (more reliable than pubdate)
  const bibcodeMatch = doc.bibcode.match(/^(\d{4})arXiv(\d{4})(\d{2})/);
  if (bibcodeMatch) {
    const year = parseInt(bibcodeMatch[1]);
    const month = parseInt(bibcodeMatch[3]) - 1; // JS months are 0-indexed
    const day = parseInt(bibcodeMatch[2].slice(2)); // Extract day from arxiv date
    publishedDate = new Date(year, month, day);
  } else {
    // Fallback to pubdate field if available
    try {
      if (doc.pubdate && doc.pubdate !== 'null' && doc.pubdate.trim() !== '') {
        publishedDate = new Date(doc.pubdate);
        // Check if the date is invalid (like Dec 31, 1969)
        if (isNaN(publishedDate.getTime()) || publishedDate.getFullYear() < 1990) {
          // Extract just year from bibcode as final fallback
          const yearMatch = doc.bibcode.match(/^(\d{4})/);
          publishedDate = yearMatch
            ? new Date(parseInt(yearMatch[1]), 0, 1) // Jan 1 of that year
            : new Date(); // fallback to current date
        }
      } else {
        // Extract just year from bibcode as fallback
        const yearMatch = doc.bibcode.match(/^(\d{4})/);
        publishedDate = yearMatch
          ? new Date(parseInt(yearMatch[1]), 0, 1) // Jan 1 of that year
          : new Date(); // fallback to current date
      }
    } catch {
      // Extract just year from bibcode as final fallback
      const yearMatch = doc.bibcode.match(/^(\d{4})/);
      publishedDate = yearMatch
        ? new Date(parseInt(yearMatch[1]), 0, 1) // Jan 1 of that year
        : new Date(); // fallback to current date
    }
  }

  // Handle abstract - if it's too short or meaningless, use a fallback
  const rawAbstract = doc.abstract?.[0] || '';
  let processedAbstract = 'Abstract not available';

  if (rawAbstract && rawAbstract.length > 10) {
    processedAbstract = truncateAbstract(rawAbstract);
  } else if (rawAbstract && rawAbstract.length <= 10) {
    // If we have a very short abstract (like single letters), skip showing it
    processedAbstract = 'Abstract not available';
  }

  return {
    id: doc.bibcode,
    title: doc.title?.[0] || 'Untitled',
    authors: authorString || 'Unknown authors',
    published: publishedDate,
    arxivClass: doc.arxiv_class?.[0] || 'cs.unknown',
    abstract: processedAbstract,
    citations: doc.citation_count || 0,
    pdf: pdfUrl,
    score: doc.score,
    createdAt: new Date(),
  };
}

/**
 * Truncate abstract to reasonable length for display
 */
function truncateAbstract(abstract: string, maxLength = 500): string {
  if (abstract.length <= maxLength) {
    return abstract;
  }

  // Find last complete sentence within limit
  const truncated = abstract.substring(0, maxLength);
  const lastSentence = truncated.lastIndexOf('.');

  if (lastSentence > maxLength * 0.7) {
    return truncated.substring(0, lastSentence + 1);
  }

  // Fallback to word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0
    ? `${truncated.substring(0, lastSpace)}...`
    : `${truncated}...`;
}

/**
 * Get detailed paper information by bibcode
 */
export async function getAdsDocument(bibcode: string): Promise<Paper | null> {
  if (!process.env.ADS_API_TOKEN) {
    throw new Error('ADS_API_TOKEN environment variable is required');
  }

  const params = new URLSearchParams({
    q: `bibcode:"${bibcode}"`,
    fl: 'bibcode,title,author,pubdate,arxiv_class,abstract,citation_count,links_data,score',
  });

  const url = `${ADS_BASE}/search/query?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.ADS_API_TOKEN}`,
        'Accept': 'application/json',
        'User-Agent': 'Agent-Vibes/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`ADS API error: ${response.status}`);
    }

    const data: AdsApiResponse = await response.json();
    const doc = data.response?.docs?.[0];

    return doc ? mapAdsDocToPaper(doc) : null;
  } catch (error) {
    console.error(`Failed to get ADS document ${bibcode}:`, error);
    return null;
  }
}
