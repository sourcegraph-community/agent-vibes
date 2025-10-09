import type { RssCategory } from '../Models/RssEntry';

const CATEGORY_KEYWORDS: Record<RssCategory, string[]> = {
  product_updates: [
    'release', 'launch', 'feature', 'update', 'announcement',
    'version', 'changelog', 'roadmap', 'beta', 'preview',
  ],
  industry_research: [
    'research', 'study', 'analysis', 'report', 'data',
    'trend', 'survey', 'findings', 'insight', 'statistics',
  ],
  perspectives: [
    'opinion', 'perspective', 'thought', 'commentary', 'view',
    'editorial', 'essay', 'reflection', 'think', 'believe',
  ],
  uncategorized: [],
};

export const inferCategory = (
  title: string,
  content: string | null,
  feedTitle: string | null,
): RssCategory => {
  const text = `${title} ${content ?? ''} ${feedTitle ?? ''}`.toLowerCase();

  const scores = new Map<RssCategory, number>();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'uncategorized') {
      continue;
    }

    const score = keywords.reduce((acc, keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      return acc + (matches?.length ?? 0);
    }, 0);

    scores.set(category as RssCategory, score);
  }

  let maxScore = 0;
  let bestCategory: RssCategory = 'uncategorized';

  for (const [category, score] of scores.entries()) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
};
