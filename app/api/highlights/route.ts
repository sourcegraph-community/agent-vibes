import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import * as path from 'path';

interface Entry {
  id: string
  title: string
  summary: string
  url: string
  content?: string
  publishedAt: string
  category: string
  source: string
  tags: string[]
  metadata?: Record<string, any>
  featured?: boolean
}

interface HighlightData {
  highlights: Entry[]
}

// Score entries for highlighting based on various factors
function calculateHighlightScore(entry: Entry): number {
  let score = 0;

  // Recency boost (newer content scores higher)
  const age = Date.now() - new Date(entry.publishedAt).getTime();
  const ageDays = age / (1000 * 60 * 60 * 24);
  if (ageDays < 1) score += 50;
  else if (ageDays < 7) score += 20;
  else if (ageDays < 30) score += 5;

  // Category priority
  if (entry.category === 'research') score += 15;
  if (entry.category === 'product') score += 10;
  if (entry.category === 'perspective') score += 8;

  // Tag-based scoring
  const highValueTags = ['ai', 'research', 'innovation', 'breakthrough', 'featured'];
  const tagScore = entry.tags?.filter(tag =>
    highValueTags.includes(tag.toLowerCase()),
  ).length * 5;
  score += tagScore;

  // Content quality indicators (longer summary = more detailed)
  if (entry.summary && entry.summary.length > 200) score += 10;
  if (entry.content && entry.content.length > 5000) score += 15;

  // Boost for already featured content
  if (entry.featured) score += 100;

  return score;
}

async function loadHighlightsFromCache(): Promise<Entry[]> {
  try {
    const cacheDir = path.join(process.cwd(), '.next/cache');
    const files = await fs.readdir(cacheDir);
    const rssFiles = files.filter(f => f.startsWith('rss-') && f.endsWith('.json'));

    let allEntries: Entry[] = [];

    for (const file of rssFiles) {
      try {
        const filePath = path.join(cacheDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        if (data.entries && Array.isArray(data.entries)) {
          allEntries = allEntries.concat(data.entries);
        }
      } catch (error) {
        console.error(`Error reading cache file ${file}:`, error);
      }
    }

    return allEntries;
  } catch (error) {
    console.error('Error loading from cache:', error);
    return [];
  }
}

async function loadHighlightsFromFallback(): Promise<Entry[]> {
  try {
    const fallbackPath = path.join(process.cwd(), 'public/data/sample-highlights.json');
    const content = await fs.readFile(fallbackPath, 'utf-8');
    const data = JSON.parse(content) as HighlightData;
    return data.highlights || [];
  } catch (error) {
    console.error('Error loading fallback highlights:', error);
    // If no highlights fallback, try regular entries
    try {
      const entriesPath = path.join(process.cwd(), 'public/data/sample-entries.json');
      const entriesContent = await fs.readFile(entriesPath, 'utf-8');
      const entriesData = JSON.parse(entriesContent);
      return entriesData.entries || [];
    } catch {
      return [];
    }
  }
}

function selectHighlights(entries: Entry[], limit: number = 10): Entry[] {
  // Calculate scores and sort by highlight score
  const scoredEntries = entries.map(entry => ({
    ...entry,
    highlightScore: calculateHighlightScore(entry),
  }));

  scoredEntries.sort((a, b) => b.highlightScore - a.highlightScore);

  // Ensure diversity by category
  const highlights: Entry[] = [];
  const categoryCount: Record<string, number> = {};
  const maxPerCategory = Math.ceil(limit / 3); // Allow max 1/3 from same category

  for (const entry of scoredEntries) {
    if (highlights.length >= limit) break;

    const catCount = categoryCount[entry.category] || 0;
    if (catCount < maxPerCategory) {
      highlights.push(entry);
      categoryCount[entry.category] = catCount + 1;
    }
  }

  // Fill remaining slots if we haven't hit the limit
  for (const entry of scoredEntries) {
    if (highlights.length >= limit) break;
    if (!highlights.find(h => h.id === entry.id)) {
      highlights.push(entry);
    }
  }

  return highlights.slice(0, limit);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const category = searchParams.get('category');
    const since = searchParams.get('since');

    // Try loading from cache first
    let entries = await loadHighlightsFromCache();

    // Fallback to sample data if cache is empty
    if (entries.length === 0) {
      entries = await loadHighlightsFromFallback();
    }

    // Apply filters
    if (category) {
      entries = entries.filter(entry => entry.category === category);
    }

    if (since) {
      const sinceDate = new Date(since);
      entries = entries.filter(entry => new Date(entry.publishedAt) >= sinceDate);
    }

    const highlights = selectHighlights(entries, limit);

    return NextResponse.json({
      highlights,
      total: highlights.length,
      criteria: {
        scoreFactors: ['recency', 'category', 'tags', 'content_quality', 'featured_status'],
        diversityEnsured: true,
        maxPerCategory: Math.ceil(limit / 3),
      },
      source: entries.length > 0 && entries[0]?.source !== 'sample' ? 'cache' : 'fallback',
    });
  } catch (error) {
    console.error('Error in highlights API:', error);
    return NextResponse.json(
      { error: 'Failed to load highlights' },
      { status: 500 },
    );
  }
}
