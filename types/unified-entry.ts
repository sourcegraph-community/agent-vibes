export interface UnifiedEntry {
  id: string
  title: string
  summary?: string
  url: string
  publishedAt: string   // ISO-UTC
  source: string        // "rss", "github_pr", "ads_build", "x_posts"
  category: "product" | "research" | "perspective" | "social"
  sentiment?: number    // -5 to +5 range from sentiment analysis
  tool?: string         // "AmpCode", "Cursor", "Copilot", "Cody", "other"
  tags?: string[]
}

export interface QueryResult {
  query: string
  entries: UnifiedEntry[]
  totalCount: number
  searchTime: number
}

export interface ContextualQuery {
  query: string
  context?: string
  maxResults?: number
  category?: UnifiedEntry['category']
  dateRange?: {
    from?: string
    to?: string
  }
}
