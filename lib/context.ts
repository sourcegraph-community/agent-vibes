import fs from 'fs/promises';
import path from 'path';
import type { UnifiedEntry, ContextualQuery, QueryResult } from '@/types/unified-entry';

// In-memory cache for loaded data
let dataCache: UnifiedEntry[] | null = null;
let lastCacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Source category mapping
const sourceCategoryMap: Record<string, UnifiedEntry['category']> = {
  // RSS feeds
  'cursor-changelog': 'product',
  'copilot-blog': 'product',
  'arxiv-ai': 'research',
  'medium-ai': 'perspective',
  'rss': 'product',

  // GitHub data
  'github_pr': 'product',
  'github-issues': 'social',

  // ADS builds
  'ads_build': 'product',
  'ads-deployments': 'product',

  // Social data
  'social': 'social',
  'x-posts': 'social',
  'twitter': 'social',

  // Default
  'unknown': 'perspective',
};

export async function loadAllData(): Promise<UnifiedEntry[]> {
  const now = Date.now();

  // Return cached data if still valid
  if (dataCache && (now - lastCacheTime) < CACHE_TTL) {
    return dataCache;
  }

  const entries: UnifiedEntry[] = [];

  try {
    // Load from various data sources
    const dataDir = path.join(process.cwd(), 'data');

    // Try to read from different possible locations
    const possibleSources = [
      'sample-entries.json', // Our test data
      '2025-09-17-apify-x-posts-100.json', // Your X posts data
      'rss-entries.json',
      'github-pr.json',
      'ads-builds.json',
      'entries.json', // fallback
    ];

    for (const source of possibleSources) {
      try {
        const filePath = path.join(dataDir, source);
        const rawData = await fs.readFile(filePath, 'utf-8');
        const sourceEntries = JSON.parse(rawData);

        // Convert to UnifiedEntry format
        const unified = Array.isArray(sourceEntries)
          ? sourceEntries.map(entry => normalizeEntry(entry, source))
          : [];

        entries.push(...unified);
        console.log(`Loaded ${unified.length} entries from ${source}`);
      } catch (error) {
        console.warn(`Could not load ${source}:`, (error as Error).message);
      }
    }

    // If no entries found, create some default ones
    if (entries.length === 0) {
      console.warn('No data files found, creating default entries');
      entries.push(
        {
          id: 'default-1',
          title: 'Sample AgentVibes Entry',
          summary: 'This is a sample entry created when no data sources are available.',
          url: '#',
          publishedAt: new Date().toISOString(),
          source: 'default',
          category: 'product',
          sentiment: 0.5,
          tags: ['sample', 'default'],
        },
      );
    }

    // Sort by most recent first
    entries.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Update cache
    dataCache = entries;
    lastCacheTime = now;

    console.log(`Successfully loaded ${entries.length} total entries`);
    return entries;
  } catch (error) {
    console.error('Failed to load data:', error);
    // Return default entry if everything fails
    return [{
      id: 'error-fallback',
      title: 'Data Loading Error',
      summary: 'Unable to load dashboard data. Please check the data sources.',
      url: '#',
      publishedAt: new Date().toISOString(),
      source: 'error',
      category: 'product',
      sentiment: 0,
      tags: ['error'],
    }];
  }
}

function normalizeEntry(entry: any, sourceFile: string): UnifiedEntry {
  // Detect source type from filename
  const sourceType = sourceFile.includes('github') ? 'github_pr' :
    sourceFile.includes('ads') ? 'ads_build' :
      sourceFile.includes('rss') ? 'rss' :
        sourceFile.includes('apify') || sourceFile.includes('x-posts') ? 'social' :
          'unknown';

  // Handle different data formats
  const title = entry.title || entry.text || entry.content?.substring(0, 100) || 'Untitled';
  const summary = entry.summary || entry.text || entry.content || entry.description || '';
  const url = entry.url || entry.link || entry.href || '#';
  const publishedAt = entry.publishedAt || entry.createdAt || entry.created_at || entry.timestamp || new Date().toISOString();

  // Ensure publishedAt is in ISO format
  let isoDate: string;
  try {
    isoDate = new Date(publishedAt).toISOString();
  } catch {
    isoDate = new Date().toISOString();
  }

  return {
    id: entry.id || entry._id || entry.uuid || url || `${sourceType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: title.substring(0, 200), // Limit title length
    summary: summary.substring(0, 500), // Limit summary length
    url,
    publishedAt: isoDate,
    source: sourceType,
    category: sourceCategoryMap[sourceType] || 'social',
    sentiment: typeof entry.sentiment === 'number' ? entry.sentiment : 0,
    tags: Array.isArray(entry.tags) ? entry.tags :
      typeof entry.tags === 'string' ?
        (entry.tags.startsWith('[') ? JSON.parse(entry.tags) : entry.tags.split(',')) :
        [],
  };
}

export async function searchEntries(query: ContextualQuery): Promise<QueryResult> {
  const startTime = Date.now();
  const entries = await loadAllData();

  if (!query.query.trim()) {
    return {
      query: query.query,
      entries: entries.slice(0, query.maxResults || 20),
      totalCount: entries.length,
      searchTime: Date.now() - startTime,
    };
  }

  const searchTerms = query.query.toLowerCase().split(' ').filter(term => term.length > 2);

  // Score entries based on relevance
  const scoredEntries = entries.map(entry => {
    let score = 0;
    const searchText = `${entry.title} ${entry.summary || ''} ${entry.tags?.join(' ') || ''}`.toLowerCase();

    // Keyword matching
    for (const term of searchTerms) {
      if (entry.title.toLowerCase().includes(term)) score += 10;
      if (entry.summary?.toLowerCase().includes(term)) score += 5;
      if (entry.tags?.some(tag => tag.toLowerCase().includes(term))) score += 3;
      if (searchText.includes(term)) score += 1;
    }

    // Recency boost (more recent = higher score)
    const daysSincePublished = (Date.now() - new Date(entry.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 30 - daysSincePublished) / 10;

    // Category filter
    if (query.category && entry.category !== query.category) score *= 0.5;

    // Sentiment boost for positive content
    if (entry.sentiment && entry.sentiment > 0) score += entry.sentiment * 2;

    return { entry, score };
  });

  // Filter and sort by score
  const relevantEntries = scoredEntries
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, query.maxResults || 20)
    .map(item => item.entry);

  return {
    query: query.query,
    entries: relevantEntries,
    totalCount: entries.length,
    searchTime: Date.now() - startTime,
  };
}

export async function getRelevantContext(userQuery: string, maxTokens: number = 3000): Promise<string> {
  try {
    console.log('[CONTEXT] Getting context for query:', userQuery);
    
    const searchResult = await searchEntries({
      query: userQuery,
      maxResults: 20,
    });

    console.log('[CONTEXT] Search completed, entries found:', searchResult.entries.length);

    if (searchResult.entries.length === 0) {
      return "No relevant data found in the current dataset.";
    }

  let context = `Context from AgentVibes Dashboard Data (${searchResult.entries.length} relevant items):\n\n`;
  let tokenCount = context.length;

  for (const entry of searchResult.entries) {
    const entryText = `• [${entry.category}] ${entry.publishedAt.split('T')[0]} - ${entry.title}: ${entry.summary || 'No summary'} (${entry.source}) ${entry.url}\n`;

    if (tokenCount + entryText.length > maxTokens) break;

    context += entryText;
    tokenCount += entryText.length;
  }

  context += `\nTotal entries available: ${searchResult.totalCount} | Search took: ${searchResult.searchTime}ms`;

  console.log('[CONTEXT] Context generated, length:', context.length);
  return context;
  
  } catch (error) {
    console.error('[CONTEXT] Error generating context:', error);
    return `Error loading dashboard data: ${error instanceof Error ? error.message : 'Unknown error'}. Using fallback context.`;
  }
}

// Utility to refresh cache manually
export function invalidateCache(): void {
  dataCache = null;
  lastCacheTime = 0;
}
