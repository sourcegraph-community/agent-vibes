import * as inhouse from './inhouse';

export interface MinifluxEntry {
  id: number;
  user_id: number;
  feed_id: number;
  title: string;
  url: string;
  author: string;
  content: string;
  hash: string;
  published_at: string;
  created_at: string;
  status: string;
  starred: boolean;
  reading_time: number;
  feed: {
    id: number;
    title: string;
    category?: {
      id: number;
      title: string;
    };
  };
}

export interface MinifluxEntriesResponse {
  total: number;
  entries: MinifluxEntry[];
}

export interface GetEntriesParams {
  limit?: number;
  offset?: number;
  status?: 'unread' | 'read' | 'removed';
  starred?: boolean;
  before?: number;
  after?: number;
  published_after?: string;
  order?: 'id' | 'status' | 'published_at' | 'category_title' | 'category_id';
  direction?: 'asc' | 'desc';
  category_id?: number;
}

export interface MinifluxError {
  code: 'API_ERROR' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'TIMEOUT' | 'PARSE_ERROR' | 'AUTH_ERROR';
  message: string;
  retryable: boolean;
}

export interface MinifluxResult<T> {
  success: boolean;
  data?: T;
  error?: MinifluxError;
}

// Simplified client: in-house only. No external Miniflux HTTP path.
export class MinifluxClient {
  async getEntries(params?: GetEntriesParams): Promise<MinifluxResult<MinifluxEntriesResponse>> {
    try {
      const data = await inhouse.getEntries(params ?? {});
      return { success: true, data };
    } catch (e) {
      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: e instanceof Error ? e.message : String(e),
          retryable: false,
        },
      };
    }
  }
}

export const createMinifluxClient = (): MinifluxClient => new MinifluxClient();
