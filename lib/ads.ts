import type { RawAdsDoc, AdsApiResponse, Paper } from '@/types/research';

const ADS_BASE = 'https://api.adsabs.harvard.edu/v1';

/**
 * Search ADS for CS arXiv papers related to coding agents
 */
export async function searchAdsCodingAgents(rows = 25): Promise<Paper[]> {
  if (!process.env.ADS_API_TOKEN) {
    throw new Error('ADS_API_TOKEN environment variable is required');
  }

  const query = [
    'arXiv_class:cs*',
    '(title:"coding agent" OR title:"code generation" OR title:"AI assistant" OR title:"programming assistant"',
    'OR abstract:"coding agent" OR abstract:"code generation" OR abstract:"AI coding" OR abstract:"programming assistant")',
    'property:refereed:no'  // exclude peer-reviewed journals, focus on arXiv
  ].join(' AND ');

  const params = new URLSearchParams({
    q: query,
    rows: rows.toString(),
    sort: 'date desc',
    fl: 'bibcode,title,author,pubdate,arxiv_class,abstract,citation_count,links_data'
  });

  const url = `${ADS_BASE}/search/query?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.ADS_API_TOKEN}`,
        'Accept': 'application/json',
        'User-Agent': 'Agent-Vibes/1.0'
      },
      // Add timeout
      signal: AbortSignal.timeout(10000) // 10 second timeout
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
    link.url?.includes('arxiv.org')
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

  // Parse publication date
  let publishedDate: Date;
  try {
    publishedDate = new Date(doc.pubdate);
  } catch {
    publishedDate = new Date(); // fallback to current date
  }

  return {
    id: doc.bibcode,
    title: doc.title?.[0] || 'Untitled',
    authors: authorString || 'Unknown authors',
    published: publishedDate,
    arxivClass: doc.arxiv_class?.[0] || 'cs.unknown',
    abstract: truncateAbstract(doc.abstract?.[0] || 'No abstract available'),
    citations: doc.citation_count || 0,
    pdf: pdfUrl,
    createdAt: new Date()
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
    fl: 'bibcode,title,author,pubdate,arxiv_class,abstract,citation_count,links_data'
  });

  const url = `${ADS_BASE}/search/query?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.ADS_API_TOKEN}`,
        'Accept': 'application/json',
        'User-Agent': 'Agent-Vibes/1.0'
      }
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
