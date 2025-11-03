import type { RssCategory } from '../Models/RssEntry';
import { inferCategory } from './categoryMapper';

const MIN_SCORE = 2;
const MIN_DELTA = 2;

const RESEARCH_OVER_PERSPECTIVE_RATIO = 1.2;
const RESEARCH_OVER_PERSPECTIVE_DELTA = 2;

const MINIFLUX_CATEGORY_TO_RSS: Record<string, RssCategory> = {
  'product updates': 'product_updates',
  'research papers': 'industry_research',
  'perspective pieces': 'perspectives',
};

const RESEARCH_HOSTS = new Set<string>([
  'arxiv.org',
  'export.arxiv.org',
  'ar5iv.org',
  'arxiv-vanity.com',
  'openreview.net',
  'aclanthology.org',
  'dl.acm.org',
  'ieeexplore.ieee.org',
  'neurips.cc',
  'iclr.cc',
  'eprint.iacr.org',
  'paperswithcode.com',
  'www.artificial-intelligence.blog',
  'xaiguy.substack.com',
]);

const norm = (s: string) => s.trim().toLowerCase().replace(/^www\./, '');

const looksLikeResearchFeed = (t?: string | null) =>
  t ? /\barxiv\b|\bpapers with code\b|\bresearch\b/i.test(t) : false;

const count = (text: string, re: RegExp) => (text.match(re) || []).length;

type Scores = Map<RssCategory, number>;

function scoreText(text: string): Scores {
  const scores: Scores = new Map();
  scores.set('product_updates', count(text, /\b(release|launch|feature|update|changelog|version|roadmap|beta|preview)\b/g));
  scores.set('industry_research', count(text, /\b(arxiv|study|paper|experiment|results|benchmark|dataset|method|analysis|report)\b/g));
  scores.set('perspectives', count(text, /\b(opinion|editorial|perspective|thought|view|think|believe|commentary|essay|reflection)\b/g));
  // uncategorized is not scored
  return scores;
}

function top2(scores: Scores) {
  const arr = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [best, second] = [arr[0] ?? ['uncategorized', 0], arr[1] ?? ['uncategorized', 0]] as [
    [RssCategory, number],
    [RssCategory, number],
  ];
  return { bestCat: best[0], bestScore: best[1], secondScore: second[1] };
}

export function resolveCategory(params: {
  url: string;
  feedCategoryTitle?: string | null;
  title: string;
  content: string | null;
  feedTitle?: string | null;
}): RssCategory {
  // 1) Folder/category mapping from Miniflux
  const fromFolder = params.feedCategoryTitle
    ? MINIFLUX_CATEGORY_TO_RSS[norm(params.feedCategoryTitle)]
    : undefined;
  if (fromFolder) return fromFolder;

  // 2) Domain allowlist for research
  let host: string | null = null;
  try {
    host = norm(new URL(params.url).hostname);
  } catch {
    host = null;
  }
  if (host) {
    for (const dom of RESEARCH_HOSTS) {
      const d = norm(dom);
      if (host === d || host.endsWith('.' + d)) return 'industry_research';
    }
  }

  // 3) Feed title hints
  if (looksLikeResearchFeed(params.feedTitle)) return 'industry_research';

  // 4) Heuristic scoring with ambiguity thresholds
  const text = `${params.title} ${params.content ?? ''} ${params.feedTitle ?? ''}`.toLowerCase();
  const scores = scoreText(text);
  const { bestCat, bestScore, secondScore } = top2(scores);

  // Guard: if heuristic says perspectives but research cues are comparably strong, prefer research only when it clearly dominates
  const perspectiveHits = scores.get('perspectives') ?? 0;
  const researchHits = scores.get('industry_research') ?? 0;
  const dominatesByRatio = perspectiveHits > 0 && researchHits >= perspectiveHits * RESEARCH_OVER_PERSPECTIVE_RATIO;
  const dominatesByDelta = researchHits - perspectiveHits >= RESEARCH_OVER_PERSPECTIVE_DELTA;
  if (bestCat === 'perspectives' && (dominatesByRatio || dominatesByDelta)) {
    return 'industry_research';
  }

  // Ambiguous/low confidence → uncategorized
  if (bestScore < MIN_SCORE || bestScore - secondScore < MIN_DELTA) {
    // As a last resort, try legacy inferCategory; still guard ambiguity
    const legacy = inferCategory(params.title, params.content, params.feedTitle ?? null);
    if (legacy !== 'uncategorized') return legacy;
    return 'uncategorized';
  }

  return bestCat;
}
