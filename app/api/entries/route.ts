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
}

interface EntriesData {
  entries: Entry[]
}

async function loadEntriesFromCache(): Promise<Entry[]> {
  try {
    const cacheDir = path.join(process.cwd(), '.next/cache');
    const files = await fs.readdir(cacheDir);
    const rssFiles = files.filter(f => f.startsWith('rss-') && f.endsWith('.json'));

    let allEntries: Entry[] = [];

    for (const file of rssFiles) {
      try {
        const filePath = path.join(cacheDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as EntriesData;
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

async function loadEntriesFromFallback(): Promise<Entry[]> {
  try {
    const fallbackPath = path.join(process.cwd(), 'public/data/sample-entries.json');
    const content = await fs.readFile(fallbackPath, 'utf-8');
    const data = JSON.parse(content) as EntriesData;
    return data.entries || [];
  } catch (error) {
    console.error('Error loading fallback data:', error);
    return [];
  }
}

function filterEntries(entries: Entry[], searchParams: URLSearchParams): Entry[] {
  let filtered = [...entries];

  const category = searchParams.get('category');
  if (category) {
    filtered = filtered.filter(entry => entry.category === category);
  }

  const since = searchParams.get('since');
  if (since) {
    const sinceDate = new Date(since);
    filtered = filtered.filter(entry => new Date(entry.publishedAt) >= sinceDate);
  }

  const tags = searchParams.get('tags');
  if (tags) {
    const tagList = tags.split(',').map(tag => tag.trim().toLowerCase());
    filtered = filtered.filter(entry =>
      entry.tags && entry.tags.some(tag => tagList.includes(tag.toLowerCase())),
    );
  }

  // Sort by publishedAt desc
  filtered.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  return filtered.slice(offset, offset + limit);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Try loading from cache first
    let entries = await loadEntriesFromCache();

    // Fallback to sample data if cache is empty
    if (entries.length === 0) {
      entries = await loadEntriesFromFallback();
    }

    const filteredEntries = filterEntries(entries, searchParams);

    return NextResponse.json({
      entries: filteredEntries,
      total: filteredEntries.length,
      source: entries.length > 0 && entries[0]?.source !== 'sample' ? 'cache' : 'fallback',
    });
  } catch (error) {
    console.error('Error in entries API:', error);
    return NextResponse.json(
      { error: 'Failed to load entries' },
      { status: 500 },
    );
  }
}
