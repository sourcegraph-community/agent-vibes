/**
 * Time window for filtering papers
 */
export type TimeWindow = '3m' | '1m' | '1w' | '3d' | '1d' | 'all';

/**
 * ADS API search options
 */
export interface AdsSearchOptions {
  rows?: number;
  window?: TimeWindow;
}

/**
 * ADS API Response Types
 */
export interface RawAdsDoc {
  bibcode: string;
  title?: string[];
  author?: string[];
  pubdate: string;
  arxiv_class?: string[];
  abstract?: string[];
  citation_count?: number;
  score?: number;
  links_data?: {
    url: string;
    title: string;
  }[];
}

export interface AdsApiResponse {
  response: {
    docs: RawAdsDoc[];
    numFound: number;
    start: number;
  };
}

/**
 * Application Paper Types
 */
export interface Paper {
  id: string;           // bibcode
  title: string;
  authors: string;      // "A. Smith, B. Jones"
  published: Date;
  arxivClass: string;
  abstract: string;
  citations: number;
  pdf: string;          // PDF link
  abstractUrl?: string; // arXiv abstract page link
  score?: number;       // relevance score from ADS API
  createdAt?: Date;     // when added to our system
}

export interface PapersResponse {
  papers: Paper[];
  total: number;
  lastUpdated: string;
}

/**
 * Research API Request/Response Types
 */
export interface ResearchApiParams {
  crawl?: boolean;
  limit?: number;
  offset?: number;
}

export interface ResearchApiError {
  error: string;
  code?: string;
  details?: string;
}
