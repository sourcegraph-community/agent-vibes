// Mock RSS data for testing the components
// This data follows the format from docs/miniflux-integration.md

export interface RssEntry {
  id: number;
  title: string;
  url: string;
  summary: string;
  author?: string;
  publishedAt: string;
  source: string;
  category: 'product' | 'research' | 'perspective';
  starred?: boolean;
  readingTime?: number;
}

export const mockProductUpdates: RssEntry[] = [
  {
    id: 1,
    title: 'Cursor Composer: Multi-File Editing Revolution',
    url: 'https://cursor.sh/blog/composer',
    summary: 'Cursor\'s new Composer feature enables seamless multi-file code generation and refactoring with improved context awareness across your entire codebase.',
    author: 'Cursor Team',
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    source: 'Cursor Blog',
    category: 'product',
    starred: true,
    readingTime: 5,
  },
  {
    id: 2,
    title: 'GitHub Copilot Workspace GA',
    url: 'https://github.blog/copilot-workspace',
    summary: 'GitHub Copilot Workspace is now generally available, bringing AI-powered planning and implementation to GitHub Issues.',
    author: 'GitHub',
    publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    source: 'GitHub Blog',
    category: 'product',
    readingTime: 8,
  },
  {
    id: 3,
    title: 'Amp 2.0 Release: Enhanced Context Engine',
    url: 'https://ampcode.com/blog/2.0-release',
    summary: 'Amp 2.0 introduces a completely redesigned context engine with 10x faster code understanding and improved multi-repository support.',
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    source: 'Amp Blog',
    category: 'product',
    readingTime: 6,
  },
];

export const mockResearchPapers: RssEntry[] = [
  {
    id: 101,
    title: 'CodeT5+: Open Code Large Language Models for Code Understanding and Generation',
    url: 'https://arxiv.org/abs/2305.07922',
    summary: 'We present CodeT5+, a family of encoder-decoder LLMs for code understanding and generation. CodeT5+ achieves state-of-the-art performance on code completion and generation benchmarks.',
    author: 'Wang et al.',
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    source: 'arXiv',
    category: 'research',
    starred: true,
    readingTime: 12,
  },
  {
    id: 102,
    title: 'AI-Assisted Code Review Effectiveness Study',
    url: 'https://arxiv.org/abs/2024.example',
    summary: 'Study finds AI code assistants reduce review time by 40% while maintaining code quality standards in large enterprise codebases.',
    author: 'Chen et al.',
    publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    source: 'arXiv',
    category: 'research',
    readingTime: 15,
  },
  {
    id: 103,
    title: 'Evaluating Large Language Models on Code Refactoring Tasks',
    url: 'https://papers.withcode.com/paper/refactor-llm',
    summary: 'Comprehensive evaluation of LLMs on automated refactoring, revealing strengths in simple transformations but limitations in architectural changes.',
    author: 'Liu et al.',
    publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    source: 'Papers with Code',
    category: 'research',
    readingTime: 20,
  },
];

export const mockPerspectivePieces: RssEntry[] = [
  {
    id: 201,
    title: 'The Future of Pair Programming: Human + AI',
    url: 'https://a16z.com/future-pair-programming',
    summary: 'Industry leaders discuss how AI coding assistants are reshaping developer workflows and team collaboration patterns.',
    author: 'Andreessen Horowitz',
    publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    source: 'a16z Blog',
    category: 'perspective',
    starred: true,
    readingTime: 7,
  },
  {
    id: 202,
    title: 'Why Every Developer Should Use AI Assistants',
    url: 'https://techcrunch.com/ai-assistants-developer',
    summary: 'TechCrunch explores the productivity gains and learning opportunities that AI coding assistants provide to developers at all skill levels.',
    author: 'Sarah Chen',
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    source: 'TechCrunch',
    category: 'perspective',
    readingTime: 5,
  },
  {
    id: 203,
    title: 'The AI Coding Assistant Landscape in 2025',
    url: 'https://blog.kellblog.com/ai-coding-2025',
    summary: 'Analysis of market trends, differentiation strategies, and where the AI coding assistant market is headed in the next few years.',
    author: 'Dave Kellogg',
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    source: 'kellblog',
    category: 'perspective',
    readingTime: 10,
  },
];

export const getAllMockEntries = (): RssEntry[] => [
  ...mockProductUpdates,
  ...mockResearchPapers,
  ...mockPerspectivePieces,
];

export const getMockEntriesByCategory = (category: 'product' | 'research' | 'perspective'): RssEntry[] => {
  switch (category) {
    case 'product':
      return mockProductUpdates;
    case 'research':
      return mockResearchPapers;
    case 'perspective':
      return mockPerspectivePieces;
    default:
      return [];
  }
};
