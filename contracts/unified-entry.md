# Unified Entry Contract Specification

This document defines the data contract for standardizing entries across all data sources in the AgentVibes system.

## Overview

The `UnifiedEntry` interface serves as the canonical data structure that all data sources must map to. This ensures consistency across RSS feeds, GitHub scrapers, ADS API integration, and other data collection mechanisms.

## Interface Definition

```typescript
interface UnifiedEntry {
  id: string                    // Unique identifier
  title: string                // Entry headline
  summary: string              // Brief excerpt (~300 chars)
  url: string                  // Source URL
  publishedAt: string          // ISO-UTC timestamp
  source: SourceType           // Source identifier
  category: CategoryType       // Content category
  sentiment?: number           // Optional sentiment (-1 to 1)
  content?: string            // Optional full content
  tags?: string[]             // Optional keywords
  metadata?: Record<string, any> // Optional source-specific data
}
```

## Source Type Mappings

### RSS Sources → UnifiedEntry

| RSS Field | UnifiedEntry Field | Notes |
|-----------|-------------------|--------|
| `item.link` | `url` | Primary URL |
| `item.title` | `title` | Entry headline |
| `item.contentSnippet` | `summary` | Truncated to 300 chars |
| `item.pubDate` | `publishedAt` | Converted to ISO-UTC |
| `feed.title` | `source` | Mapped to source ID |
| Auto-determined | `category` | Based on source mapping rules |
| `item.content` | `content` | Full content when available |
| `item.categories` | `tags` | RSS categories array |

**Source ID Mapping:**
```typescript
const rssSourceMapping = {
  'cursor-changelog': { category: 'product', source: 'rss' },
  'github-copilot-blog': { category: 'product', source: 'rss' },
  'techcrunch-ai': { category: 'perspective', source: 'rss' },
  'arxiv-ai': { category: 'research', source: 'rss' },
  // ... etc
}
```

### GitHub PR/Issues → UnifiedEntry

| GitHub Field | UnifiedEntry Field | Notes |
|-------------|-------------------|--------|
| `html_url` | `url` | PR/issue URL |
| `title` | `title` | PR/issue title |
| `body` (truncated) | `summary` | First 300 chars of description |
| `created_at` | `publishedAt` | GitHub timestamp |
| `'github_pr'` | `source` | Hardcoded source type |
| `'product'` | `category` | Default for GitHub activity |
| `body` | `content` | Full PR/issue description |
| `labels[].name` | `tags` | GitHub labels |

**Metadata Structure:**
```typescript
interface GitHubMetadata {
  repository: string    // "org/repo"
  author: string       // GitHub username
  prNumber?: number    // For PRs
  issueNumber?: number // For issues
  labels?: string[]    // Label names
}
```

### ADS Research Papers → UnifiedEntry

| ADS Field | UnifiedEntry Field | Notes |
|-----------|-------------------|--------|
| `bibcode` | `id` | ADS unique identifier |
| `title[0]` | `title` | Paper title |
| `abstract` (truncated) | `summary` | First 300 chars |
| `links_data[0].url` | `url` | arXiv PDF URL |
| `pubdate` | `publishedAt` | Publication date |
| `'ads_build'` | `source` | Hardcoded source type |
| `'research'` | `category` | Always research |
| `abstract[0]` | `content` | Full abstract |
| `arxiv_class` | `tags` | arXiv classification |

**Metadata Structure:**
```typescript
interface ADSMetadata {
  arxivClass: string   // e.g., "cs.AI"
  authors: string      // Formatted author list
  citations: number    // Citation count
  arxivId?: string    // arXiv identifier
}
```

### Hacker News → UnifiedEntry

| HN Field | UnifiedEntry Field | Notes |
|----------|-------------------|--------|
| `objectID` | `id` | HN story ID |
| `title` | `title` | Story title |
| `story_text` (truncated) | `summary` | First 300 chars |
| `url` or HN URL | `url` | External URL or HN discussion |
| `created_at` | `publishedAt` | Unix timestamp converted |
| `'hackernews'` | `source` | Hardcoded source type |
| `'social'` | `category` | Default for HN |
| `story_text` | `content` | Full story text |
| Auto-generated | `tags` | Based on points/comments |

## Category Mapping Rules

### Source → Category Logic

```typescript
const categoryMappingRules = {
  // Product announcements, releases, features
  product: [
    'cursor-changelog',
    'github-copilot-blog',
    'github-changelog',
    'openai-blog',
    'anthropic-news'
  ],
  
  // Academic papers, research findings  
  research: [
    'ads_build',        // All ADS papers
    'arxiv-*',         // arXiv feeds
    'research-*'       // Research-focused sources
  ],
  
  // Blog posts, opinions, analysis
  perspective: [
    'techcrunch-ai',
    'verge-ai', 
    'dev-to-ai',
    'medium-*',
    'blog-*'
  ],
  
  // Community discussions, social media
  social: [
    'hackernews',
    'reddit-*',
    'twitter-*',
    'discord-*'
  ]
};
```

### Dynamic Category Assignment

For sources not in the mapping table:

1. **Keyword Analysis**: Check title/content for category indicators
2. **Domain Heuristics**: Use URL domain to infer category
3. **Default Fallback**: Assign to 'perspective' category

```typescript
function inferCategory(entry: Partial<UnifiedEntry>): CategoryType {
  const text = `${entry.title} ${entry.summary}`.toLowerCase();
  
  // Product indicators
  if (/\b(release|update|feature|changelog|v\d+\.\d+)\b/.test(text)) {
    return 'product';
  }
  
  // Research indicators  
  if (/\b(paper|study|research|arxiv|doi)\b/.test(text)) {
    return 'research';
  }
  
  // Social indicators
  if (entry.source?.includes('reddit') || entry.source?.includes('hackernews')) {
    return 'social';
  }
  
  return 'perspective'; // Default
}
```

## Update Cadence by Source

| Source Type | Update Frequency | Rationale |
|------------|------------------|-----------|
| RSS Feeds | Every 2 hours | Balanced freshness vs. API limits |
| GitHub API | Every 2 hours | GitHub rate limits |
| ADS API | Daily | Research papers published less frequently |
| Hacker News | Every hour | High-velocity discussion platform |
| Reddit API | Every 2 hours | Rate limits and content velocity |
| Web Scraping | Every 6 hours | Respectful crawling, avoid blocks |

## Data Validation Rules

### Required Fields
- All fields except `sentiment`, `content`, `tags`, and `metadata` are required
- `publishedAt` must be valid ISO-8601 format
- `url` must be valid HTTP/HTTPS URL
- `source` must match one of the defined SourceType values
- `category` must match one of the defined CategoryType values

### Field Constraints
- `title`: 1-500 characters
- `summary`: 1-300 characters  
- `url`: Valid URL format
- `sentiment`: -1.0 to 1.0 (if provided)
- `tags`: Maximum 10 tags, each 1-50 characters

### Validation Function
```typescript
function validateUnifiedEntry(entry: UnifiedEntry): string[] {
  const errors: string[] = [];
  
  if (!entry.id?.trim()) errors.push('ID is required');
  if (!entry.title?.trim()) errors.push('Title is required');
  if (!entry.summary?.trim()) errors.push('Summary is required');
  if (!isValidUrl(entry.url)) errors.push('Valid URL is required');
  if (!isValidISODate(entry.publishedAt)) errors.push('Valid publishedAt date required');
  
  if (entry.sentiment !== undefined && (entry.sentiment < -1 || entry.sentiment > 1)) {
    errors.push('Sentiment must be between -1 and 1');
  }
  
  return errors;
}
```

## Sample Data Outputs

### RSS Entry Example
```json
{
  "id": "https://cursor.com/blog/cursor-0-42-release",
  "title": "Cursor 0.42: Enhanced AI Code Completion",
  "summary": "Introducing improved AI suggestions, better context awareness, and new collaborative features for developers...",
  "url": "https://cursor.com/blog/cursor-0-42-release",
  "publishedAt": "2024-01-15T10:30:00Z",
  "source": "rss",
  "category": "product",
  "content": "<full blog post content>",
  "tags": ["cursor", "ai", "code-completion", "release"],
  "metadata": {
    "feedTitle": "Cursor Changelog",
    "author": "Cursor Team"
  }
}
```

### GitHub PR Example  
```json
{
  "id": "https://github.com/microsoft/vscode/pull/123456",
  "title": "Add support for AI-powered code suggestions",
  "summary": "This PR introduces AI-powered code completion using OpenAI's Codex API. Includes new settings for customization...",
  "url": "https://github.com/microsoft/vscode/pull/123456", 
  "publishedAt": "2024-01-15T14:22:00Z",
  "source": "github_pr",
  "category": "product",
  "tags": ["ai", "codex", "completion"],
  "metadata": {
    "repository": "microsoft/vscode",
    "author": "developer123", 
    "prNumber": 123456,
    "labels": ["feature", "ai"]
  }
}
```

### ADS Research Example
```json
{
  "id": "2024arXiv240101234S",
  "title": "Large Language Models for Code Generation: A Comprehensive Survey", 
  "summary": "We present a comprehensive survey of large language models (LLMs) applied to automated code generation...",
  "url": "https://arxiv.org/pdf/2401.01234.pdf",
  "publishedAt": "2024-01-15T00:00:00Z",
  "source": "ads_build",
  "category": "research",
  "content": "<full abstract>",
  "tags": ["cs.AI", "cs.SE"],
  "metadata": {
    "arxivClass": "cs.AI", 
    "authors": "Smith, J. et al.",
    "citations": 42,
    "arxivId": "2401.01234"
  }
}
```

## Implementation Checklist

### Phase 2 (Current)
- [x] Define UnifiedEntry interface
- [x] Document source mapping rules
- [x] Create validation functions
- [x] Provide sample outputs
- [x] Document category assignment logic

### Phase 3 (Next)
- [ ] Implement RSS → UnifiedEntry adapter
- [ ] Implement GitHub → UnifiedEntry adapter  
- [ ] Implement ADS → UnifiedEntry adapter
- [ ] Add validation to all adapters
- [ ] Create fallback data generation

### Phase 4 (API Integration)
- [ ] Create `/api/entries` endpoint using UnifiedEntry
- [ ] Implement filtering by category/source
- [ ] Add pagination support
- [ ] Handle missing data gracefully

This contract ensures all data sources can be unified into a consistent format for the AgentVibes dashboard while preserving source-specific metadata when needed.
