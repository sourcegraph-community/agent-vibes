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
  pdf: string;          // first arXiv link
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
