import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';
import sanitizeHtmlLib from 'sanitize-html';

export const runtime = 'nodejs';

const RSS_URL = 'https://buildcrew.fast-researcher.com/digest.rss';

// Sanitizer wrapper using sanitize-html with a strict allow-list and protocol restrictions
function sanitizeHtml(input: string): string {
  return sanitizeHtmlLib(input, {
    allowedTags: ['p', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 'h3', 'br', 'a', 'code'],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }, true),
    },
  });
}

function extractSections(html: string) {
  const sections: Record<string, string> = {};
  if (!html) return { sections };

  // Normalize line breaks
  const str = html.replace(/\r\n?/g, '\n');

  // Find <h2> headings and slice content between them
  const h2Regex = /<h2[^>]*>([^<]+)<\/h2>/gi;
  const blocks: Array<{ name: string; contentStart: number; headingStart: number } > = [];
  let match: RegExpExecArray | null;
  while ((match = h2Regex.exec(str)) !== null) {
    const headingStart = match.index;
    const contentStart = match.index + match[0].length;
    const name = match[1].trim();
    blocks.push({ name, contentStart, headingStart });
  }

  const pick = (label: string) => {
    const idx = blocks.findIndex(b => b.name.toLowerCase().includes(label));
    if (idx === -1) return '';
    const start = blocks[idx].contentStart;
    const end = (idx + 1 < blocks.length) ? blocks[idx + 1].headingStart : str.length;
    const raw = str.slice(start, end);
    return sanitizeHtml(raw);
  };

  const executiveSummary = pick('executive summary');
  const channelHighlights = pick('channel highlights');
  const communityInsights = pick('community insights');

  return {
    sections: { executiveSummary, channelHighlights, communityInsights },
  };
}

function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const rawParam = searchParams.get('days') ?? searchParams.get('limit');
    const raw = rawParam !== null ? Number(rawParam) : NaN;
    const days = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 31) : 7;

    const parser = new Parser();
    const feed = await parser.parseURL(RSS_URL);

    type BCFeedItem = {
      title?: string;
      link?: string;
      pubDate?: string;
      isoDate?: string;
      content?: string;
      description?: string;
      [key: string]: unknown;
    };

    const mapped = (feed.items as BCFeedItem[] || [])
      .map((it) => {
        const iso = it.isoDate || it.pubDate || null;
        const date = iso ? new Date(iso) : null;
        const day = date ? toDayKey(date) : null;
        type WithContentEncoded = { ['content:encoded']?: string };
        const html = (it as WithContentEncoded)['content:encoded'] ?? it.content ?? it.description ?? '';
        const { sections } = extractSections(String(html));
        return {
          title: it.title || '',
          link: it.link || null,
          pubDate: iso || null,
          day,
          sections,
        };
      })
      .filter((x) => !!x.day)
      .sort((a, b) => (a.pubDate && b.pubDate ? (new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()) : 0));

    const deduped: typeof mapped = [];
    const seen = new Set<string>();
    for (const it of mapped) {
      if (it.day && !seen.has(it.day)) {
        seen.add(it.day);
        deduped.push(it);
      }
      if (deduped.length >= days) break;
    }

    const response = NextResponse.json({
      data: deduped,
      source: { url: RSS_URL },
      generatedAt: new Date().toISOString(),
    });

    // Cache for 30 minutes at the proxy level
    response.headers.set('Cache-Control', 's-maxage=1800, stale-while-revalidate=300');
    return response;
  } catch (err) {
    console.error('Build Crew digest error:', err);
    return NextResponse.json({ error: 'Failed to load Build Crew digest' }, { status: 502 });
  }
}
