import * as inhouse from './inhouse';

export interface MinifluxConfig {
  baseUrl: string;
  apiKey: string;
  maxRetries?: number;
  timeoutMs?: number;
}

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

export class MinifluxClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;

  constructor(config: MinifluxConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.maxRetries = config.maxRetries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  async getEntries(params?: GetEntriesParams): Promise<MinifluxResult<MinifluxEntriesResponse>> {
    const mode = process.env.MINIFLUX_MODE ?? 'external';
    if (mode === 'inhouse') {
      try {
        const data = await inhouse.getEntries(params);
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

    const queryParams = new URLSearchParams();

    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.status) queryParams.set('status', params.status);
    if (params?.starred !== undefined) queryParams.set('starred', params.starred.toString());
    if (params?.before) queryParams.set('before', params.before.toString());
    if (params?.after) queryParams.set('after', params.after.toString());
    if (params?.published_after) queryParams.set('published_after', params.published_after);
    if (params?.order) queryParams.set('order', params.order);
    if (params?.direction) queryParams.set('direction', params.direction);
    if (params?.category_id) queryParams.set('category_id', params.category_id.toString());

    const url = `${this.baseUrl}/v1/entries?${queryParams.toString()}`;

    let attempt = 0;
    let delayMs = 1000;

    while (true) {
      const result = await this.makeRequest<MinifluxEntriesResponse>(url, {
        method: 'GET',
      });

      if (result.success || !result.error?.retryable || attempt >= this.maxRetries) {
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
      attempt += 1;
    }
  }

  async markEntryAsRead(entryId: number): Promise<MinifluxResult<void>> {
    const mode = process.env.MINIFLUX_MODE ?? 'external';
    if (mode === 'inhouse') {
      return { success: true };
    }

    const url = `${this.baseUrl}/v1/entries`;

    return this.makeRequest<void>(url, {
      method: 'PUT',
      body: JSON.stringify({
        entry_ids: [entryId],
        status: 'read',
      }),
    });
  }

  private async makeRequest<T>(url: string, options: RequestInit): Promise<MinifluxResult<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'X-Auth-Token': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        const isRateLimitError = response.status === 429;
        const isServerError = response.status >= 500;
        const isAuthError = response.status === 401 || response.status === 403;

        console.error('[MinifluxClient] HTTP error', {
          status: response.status,
          isRateLimitError,
          isServerError,
          isAuthError,
          snippet: errorText?.slice(0, 400),
        });

        return {
          success: false,
          error: {
            code: isAuthError ? 'AUTH_ERROR' : isRateLimitError ? 'RATE_LIMIT' : isServerError ? 'SERVER_ERROR' : 'API_ERROR',
            message: `Miniflux API error (${response.status}): ${errorText}`,
            retryable: isRateLimitError || isServerError,
          },
        };
      }

      if (options.method === 'PUT' || options.method === 'DELETE') {
        return { success: true };
      }

      try {
        const data = await response.json();
        return { success: true, data };
      }
      catch (parseError) {
        console.error('[MinifluxClient] Failed to parse response', parseError);
        return {
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: 'Failed to parse JSON response from Miniflux',
            retryable: false,
          },
        };
      }
    }
    catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: `Request timed out after ${this.timeoutMs}ms`,
            retryable: true,
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          retryable: false,
        },
      };
    }
  }
}

export const createMinifluxClient = (): MinifluxClient => {
  const mode = process.env.MINIFLUX_MODE ?? 'external';
  if (mode === 'inhouse') {
    return new MinifluxClient({ baseUrl: 'inhouse://', apiKey: 'inhouse' });
  }

  const baseUrl = process.env.MINIFLUX_URL;
  const apiKey = process.env.MINIFLUX_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error('MINIFLUX_URL and MINIFLUX_API_KEY must be set');
  }

  return new MinifluxClient({ baseUrl, apiKey });
};
