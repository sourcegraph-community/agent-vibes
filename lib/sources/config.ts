import type { SourceConfig } from '@/types/sources';

export const SOURCE_CONFIGS: SourceConfig[] = [
  // Coding Agent RSS Feeds
  {
    name: 'Cursor Changelog',
    type: 'RSS',
    endpoint: 'https://api.cursor-changelog.com/api/versions/rss',
    keywords: ['cursor', 'ai', 'editor', 'coding'],
    isActive: true,
  },
  {
    name: 'GitHub Copilot Blog',
    type: 'RSS',
    endpoint: 'https://github.blog/tag/copilot/feed/',
    keywords: ['copilot', 'ai', 'coding', 'assistant'],
    isActive: true,
  },
  {
    name: 'GitHub Changelog',
    type: 'RSS',
    endpoint: 'https://github.blog/changelog/feed/',
    keywords: ['api', 'copilot', 'codespace', 'actions'],
    isActive: true,
  },

  // Tech News AI Focus
  {
    name: 'TechCrunch AI',
    type: 'RSS',
    endpoint: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    keywords: ['coding', 'developer', 'programming', 'ai assistant', 'copilot', 'cursor', 'windsurf'],
    isActive: true,
  },
  {
    name: 'The Verge AI',
    type: 'RSS',
    endpoint: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml',
    keywords: ['coding', 'developer', 'programming', 'ai assistant', 'copilot'],
    isActive: true,
  },
  {
    name: 'InfoQ AI/ML',
    type: 'RSS',
    endpoint: 'https://www.infoq.com/ai-ml/rss/',
    keywords: ['coding', 'development', 'programming', 'ai assistant'],
    isActive: true,
  },
  {
    name: 'StackOverflow Blog',
    type: 'RSS',
    endpoint: 'https://stackoverflow.blog/feed/',
    keywords: ['ai', 'copilot', 'coding', 'developer'],
    isActive: true,
  },

  // Developer-focused
  {
    name: 'Dev.to AI',
    type: 'RSS',
    endpoint: 'https://dev.to/feed/tag/ai',
    keywords: ['coding', 'programming', 'assistant', 'copilot'],
    isActive: true,
  },

  // AI Aggregators
  {
    name: 'Latent Space',
    type: 'RSS',
    endpoint: 'https://latentspace.dev/feed.xml',
    keywords: ['coding', 'agent', 'development', 'programming'],
    isActive: true,
  },

  // Company blogs (will be implemented as SCRAPE type)
  {
    name: 'OpenAI Blog',
    type: 'RSS',
    endpoint: 'https://openai.com/blog/rss/',
    keywords: ['codex', 'developer', 'api', 'coding'],
    isActive: true,
  },
  {
    name: 'Anthropic News',
    type: 'RSS',
    endpoint: 'https://www.anthropic.com/news/rss',
    keywords: ['claude', 'coding', 'developer', 'assistant'],
    isActive: true,
  },

  // Apify-powered integrations (disabled by default, enable when APIFY_TOKEN is available)
  {
    name: 'Reddit Programming',
    type: 'API',
    endpoint: 'https://www.reddit.com/r/programming',
    keywords: ['ai', 'copilot', 'cursor', 'windsurf', 'coding assistant', 'chatgpt', 'claude'],
    isActive: false, // Enable when APIFY_TOKEN is set
  },
  {
    name: 'Reddit Machine Learning',
    type: 'API',
    endpoint: 'https://www.reddit.com/r/MachineLearning',
    keywords: ['coding', 'development', 'ai assistant', 'programming', 'llm'],
    isActive: false, // Enable when APIFY_TOKEN is set
  },
  {
    name: 'Reddit Experienced Devs',
    type: 'API',
    endpoint: 'https://www.reddit.com/r/ExperiencedDevs',
    keywords: ['ai tools', 'copilot', 'productivity', 'coding assistant'],
    isActive: false, // Enable when APIFY_TOKEN is set
  },
  {
    name: 'Hacker News AI',
    type: 'API',
    endpoint: 'https://hn.algolia.com/api/v1/search_by_date',
    keywords: ['ai', 'copilot', 'cursor', 'windsurf', 'coding agent', 'claude', 'chatgpt'],
    isActive: true, // Now implemented
  },

  // Changelog scraping (disabled by default for easier testing)
  {
    name: 'Windsurf Changelog',
    type: 'SCRAPE',
    endpoint: 'https://windsurf.com/changelog',
    keywords: ['windsurf', 'ai', 'editor', 'feature', 'update'],
    isActive: false, // Enable after testing RSS sources
  },
  {
    name: 'Claude Code Changelog',
    type: 'SCRAPE',
    endpoint: 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md',
    keywords: ['claude', 'code', 'extension', 'vscode'],
    isActive: false, // Enable after testing RSS sources
  },
  {
    name: 'Cursor Changelog (Web)',
    type: 'SCRAPE',
    endpoint: 'https://cursor.com/changelog',
    keywords: ['cursor', 'ai', 'editor', 'feature', 'update'],
    isActive: false, // Enable after testing RSS sources
  },
];

export function getActiveRSSConfigs(): SourceConfig[] {
  return SOURCE_CONFIGS.filter(config => config.isActive && config.type === 'RSS');
}

export function getActiveAPIConfigs(): SourceConfig[] {
  return SOURCE_CONFIGS.filter(config => config.isActive && config.type === 'API');
}

export function getActiveScrapeConfigs(): SourceConfig[] {
  return SOURCE_CONFIGS.filter(config => config.isActive && config.type === 'SCRAPE');
}
