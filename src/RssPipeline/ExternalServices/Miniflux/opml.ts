import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InhouseCategory, InhouseFeedConfig } from './inhouse';

function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=]+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr))) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function mapCategory(label: string | undefined): InhouseCategory | undefined {
  if (!label) return undefined;
  const s = label.toLowerCase();
  if (s.includes('product update')) return 'product_updates';
  if (s.includes('research')) return 'industry_research';
  if (s.includes('perspective')) return 'perspectives';
  return undefined;
}

export function parseOpmlToInhouseFeeds(opmlXml: string): InhouseFeedConfig[] {
  const feeds: InhouseFeedConfig[] = [];
  const stack: Array<{ title?: string; isFolder: boolean }>
    = [];

  const TAG_RE = /<outline\b([^>]*?)\/>|<outline\b([^>]*?)>|<\/outline>/gi;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(opmlXml))) {
    const token = m[0];

    if (token.startsWith('</')) {
      // Close last folder if present
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.isFolder) stack.pop();
      }
      continue;
    }

    const selfClosing = token.endsWith('/>');
    const attrStr = (selfClosing ? m[1] : m[2]) || '';
    const attrs = parseAttributes(attrStr);

    const xmlUrl = attrs['xmlUrl'];
    const title = attrs['title'] || attrs['text'];

    if (selfClosing) {
      // Likely a feed outline
      if (xmlUrl) {
        // Determine nearest folder category if any
        let cat: InhouseCategory | undefined;
        for (let i = stack.length - 1; i >= 0 && !cat; i--) {
          const mapped = mapCategory(stack[i].title);
          if (mapped) cat = mapped;
        }
        feeds.push({ url: xmlUrl, title, category: cat });
      }
      continue;
    }

    // Opening non-self-closing outline: treat as folder
    const isFolder = !xmlUrl;
    stack.push({ title, isFolder });
  }

  return feeds;
}

export function parseOpmlFileToInhouseFeeds(filePath: string, forcedCategory?: InhouseCategory): InhouseFeedConfig[] {
  const absolute = resolve(filePath);
  const xml = readFileSync(absolute, 'utf8');
  const feeds = parseOpmlToInhouseFeeds(xml);
  if (!forcedCategory) return feeds;
  return feeds.map((f) => ({ ...f, category: forcedCategory }));
}
