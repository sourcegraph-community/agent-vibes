# AgentVibes Dashboard Implementation Plan - MVP Focus

This document outlines a pragmatic approach to implement the AgentVibes dashboard as a Minimum Viable Product, leveraging existing data sources and tools for rapid deployment.

**📝 Status Updates for Parallel Agents**: This document is updated in real-time as work progresses. Check completed sections (✅) to see what's already implemented before starting new work.

## Overview

The AgentVibes dashboard will provide comprehensive insights into AI coding assistants and market sentiment, featuring real data from existing sources rather than waiting for new infrastructure.

## MVP Strategy - Revised Approach

### Core Architecture
- **Framework**: Next.js 15 with App Router (✅ WORKING)
- **Styling**: Tailwind CSS with custom design system (✅ WORKING)
- **Data Sources**: RSS feeds, Python scrapers, ADS API, pre-downloaded JSON
- **Data Management**: File-based with fallbacks (no complex DB setup)
- **Deployment**: Vercel serverless (simple and fast)

### Data Pipeline - Pragmatic Approach
- **Existing RSS**: Node.js feed fetchers already in repo
- **GitHub Data**: Python scrapers from sourcegraph-demo project
- **ADS Integration**: Existing ADS API from PR_dashboard project
- **Fallbacks**: Pre-downloaded JSON files for offline/demo mode
- **Processing**: Simple aggregations, optional sentiment analysis

## Phase Breakdown - Revised

### ✅ Phase 1: Design System & UI (COMPLETED - 3 days)
**Status**: ✅ COMPLETED

#### UI Components & Layout
- [x] CSS variables imported and theme configured
- [x] Reusable UI components (Card, Badge, Select, Metric)
- [x] Sidebar navigation with proper responsive behavior
- [x] Overview cards with trend indicators
- [x] Highlights grid with 2-column responsive layout
- [x] Layout fixes with correct CSS classes
- [x] 4-column metric grid working correctly

### 🚧 Phase 2: Data Source Inventory & Contracts (NEW - 0.5 days)
**Status**: 📋 NEXT UP

#### 2.1: Compile Existing Data Sources
- [ ] Inventory RSS feed fetchers in `/rss/*.ts`
- [ ] Review Python scrapers from `sourcegraph-demo/scripts/`
- [ ] Assess ADS API integration from `pr_dashboard/ads_fetch.py`
- [ ] Document data formats and update frequencies

#### 2.2: Define Unified Data Contract
- [ ] Create `UnifiedEntry` interface matching current Prisma schema
- [ ] Document field mappings for each data source
- [ ] Create `/contracts/unified-entry.md` specification
- [ ] Ensure all sources can map to standard format

```typescript
interface UnifiedEntry {
  id: string
  title: string
  summary: string
  url: string
  publishedAt: string   // ISO-UTC
  source: string        // "rss", "github_pr", "ads_build", "x_posts"
  category: "product" | "research" | "perspective" | "social"
  sentiment?: number    // -5 to +5 range from sentiment analysis
  tool?: string         // "AmpCode", "Cursor", "Copilot", "Cody", "other"
}
```

### 🚧 Phase 3: Data Adapters & ETL (1.5 days)
**Status**: 🚧 IN PROGRESS - ADS Research API ✅ COMPLETED

#### 3.1: RSS Adapter Enhancement
- [ ] Ensure existing RSS fetchers output UnifiedEntry format
- [ ] Add category mapping rules
- [ ] Implement UTC timestamp conversion
- [ ] Output to `.next/cache/rss-YYYY-MM-DD.json`

#### 3.2: GitHub PR Adapter
- [ ] Adapt Python scrapers from sourcegraph-demo
- [ ] Filter to recent PRs, extract title, author, merged_at
- [ ] Map to "product" or "perspective" categories
- [ ] Set up GitHub Actions cron (every 2h) → `/data/github-pr.json`

#### 3.3: ADS Research API Integration  
- [x] Integrate NASA ADS API for academic research papers
- [x] Implement custom query for coding agent research
- [x] Add time-based filtering (3m, 1m, 1w, 3d, 1d, all)
- [x] Sort by relevance score instead of date
- [x] Output to research API endpoint `/api/research`

#### 3.4: Fallback Data System
- [ ] Build-time script to copy latest JSONs to `/public/data/`
- [ ] Create sample data sets for each source type
- [ ] Ensure UI gracefully handles missing data

## ✅ ADS Research Integration - COMPLETED

### Implementation Details
**Completed**: ADS API integration for coding agent research papers
**Location**: Research page of dashboard UI
**Files Modified**:
- `lib/ads.ts` - Core ADS API integration with NASA ADS
- `types/research.ts` - TypeScript interfaces and types  
- `app/api/research/route.ts` - API endpoint with caching
- `app/components/ResearchTimeFilter.tsx` - Time filtering UI
- `app/components/ResearchFeed.tsx` - Updated with time filter integration

### Key Features Delivered
- **Custom Query**: `bibstem:arxiv AND keyword:computer AND (abs:"coding agent" OR abs:"agentic" OR abs:"code generation" OR abs:"agentic code" OR abs:"agent-based" OR abs:"multi-agent" OR abs:"multi agent" OR abs:"agent" OR abs:"SWE-bench" OR abs:"HumanEval" OR abs:"code generation benchmark" OR abs:"agent evaluation" OR "large language models code" OR abs:"code completion")`
- **Time Filtering**: 3m (default), 1m, 1w, 3d, 1d, all
- **Relevance Sorting**: Results sorted by `score desc` instead of date
- **12-Hour Caching**: Efficient API usage with cache management
- **Error Handling**: Comprehensive error handling with fallbacks
- **Backwards Compatible**: Maintains existing API signature

### API Usage
```bash
GET /api/research                    # Default: 3 months, 25 results
GET /api/research?window=1w          # Last week papers
GET /api/research?window=all&limit=50 # All papers, 50 results  
GET /api/research?crawl=true         # Force fresh data
```

### UI Components
- **ResearchTimeFilter**: Dropdown with time range options ✅
- **ResearchFeed**: Updated to use time filtering ✅
- **Dashboard Integration**: Embedded into main dashboard with research section ✅
- **Standalone Page**: `/research` page with full functionality ✅
- **Navigation**: Accessible from dashboard sidebar and direct link ✅

---

## ⭐ X Posts Sentiment Analysis - NEW FEATURE

### Implementation Overview
**Data Source**: `/data/2025-09-17-apify-x-posts-100.json` - Real X posts mentioning @AmpCode
**Approach**: MVP-first with local sentiment analysis library, upgradeable to external APIs
**Timeline**: 1.5 days (0.5 backend + 1 day frontend)

### Technical Architecture

#### Sentiment Processing Pipeline
```typescript
// scripts/analyze-sentiment.ts
interface ProcessedTweet {
  ...originalTweet,
  sentiment: number,      // -5 to +5 from AFINN-165 algorithm
  tool: string,          // "AmpCode" | "Cursor" | "Copilot" | "Cody" | "other"
  cleanText: string      // processed text without @mentions, URLs
}
```

#### API Endpoints
- `GET /api/metrics/sentiment` - Aggregated sentiment metrics
- `GET /api/metrics/sentiment?tool=AmpCode&window=7d` - Tool-specific analysis
- `GET /api/tweets/sentiment` - Individual tweets with sentiment scores

#### UI Components for `/sentiment` Page
- **SentimentSummary**: Overall sentiment index + positive/negative ratio cards
- **SentimentTrendChart**: Time-series chart showing sentiment over time
- **ToolSentimentBar**: Horizontal comparison bars (AmpCode vs competitors)
- **TweetFeedWithSentiment**: Scrollable feed with sentiment color indicators
- **FilterToolbar**: Tool selector + time range picker (24h, 7d, 30d, all)

#### Key Metrics Delivered
1. **Sentiment Index**: Average sentiment score with trend direction
2. **Tool Leaderboard**: Which AI coding tool has most positive sentiment
3. **Momentum Tracking**: Change vs previous period (↑ ↓ arrows)
4. **Share of Voice**: Volume vs sentiment bubble chart
5. **Spike Detection**: Days with significant sentiment changes

---

### 🚧 Phase 4: Backend API Routes & X Posts Sentiment (1.5 days)
**Status**: 📋 PLANNED - Research API ✅ COMPLETED, Sentiment API ⏳ NEXT

#### 4.1: Entry API Implementation
- [ ] `GET /api/entries` - Read from latest adapter JSON files
- [ ] Query string filters (category, q, since)
- [ ] Fallback to `/public/data/*.json` if latest missing
- [ ] Pagination support

#### 4.2: X Posts Sentiment Pipeline ⭐ NEW
- [ ] Install `sentiment` and `slugify` npm packages
- [ ] Create `scripts/analyze-sentiment.ts` for processing X posts data
- [ ] Extend `UnifiedEntry` interface to include `sentiment?: number` and `tool?: string`
- [ ] Generate `cache/x-posts-sentiment.json` with enriched tweet data
- [ ] Add `npm run sentiment` to postbuild step in package.json

#### 4.3: Metrics API with Real Sentiment Data
- [x] `GET /api/metrics/sentiment` - X posts sentiment aggregates with filtering
- [ ] Support query params: `?tool=AmpCode&window=7d`
- [ ] Tool-based sentiment comparison (AmpCode vs Cursor vs Copilot)
- [ ] Time-based trend analysis (24h, 7d, 30d windows)
- [ ] `GET /api/metrics/voice` - Count by agent/source
- [ ] Simple calculations over JSON data (no complex DB queries)

#### 4.4: Highlights API
- [ ] `GET /api/highlights` - Top 10 entries by publishedAt DESC
- [ ] Accept `?category=` filter for highlights grid
- [ ] Merge data from all sources

### 📋 Phase 5: Amp Query Interface Integration (1 day)
**Status**: 📋 NEW - HIGH PRIORITY

#### 5.1: Amp Streaming API Setup
- [ ] Create `/api/amp/route.ts` with JSON streaming capabilities
- [ ] Implement context retrieval from aggregated JSON data (`/lib/context.ts`)
- [ ] Add lightweight RAG over UnifiedEntry data (keyword/fuzzy matching)
- [ ] Set up streaming response using `vercel/ai` package
- [ ] Test edge runtime compatibility and token limits

#### 5.2: Query Interface Enhancement
- [ ] `<AmpQueryBar>` - Enhanced search bar with Amp intelligence
- [ ] `<QueryResults>` - Streaming responses integrated into dashboard layout
- [ ] `<SmartSuggestions>` - Contextual query suggestions based on current view
- [ ] `<InsightCards>` - AI-generated insights displayed as dashboard cards
- [ ] `useAmpQuery()` hook for intelligent search and analysis

#### 5.3: Context Management
- [ ] Dynamic context building from current dashboard state
- [ ] Version-aware data freshness detection 
- [ ] Conversation history management (20 messages max)
- [ ] Smart context truncation to stay under token limits

### 📋 Phase 6: Sentiment Page UI & Client Integration (1 day)
**Status**: 📋 PLANNED

#### 6.1: Sentiment Page Implementation ⭐ NEW
- [ ] Create `/app/sentiment/page.tsx` route
- [ ] `<SentimentSummary>` - Overall sentiment index and positive/negative ratio
- [ ] `<SentimentTrendChart>` - Time-series visualization using lightweight chart lib
- [ ] `<ToolSentimentBar>` - Horizontal bars comparing AmpCode vs competitors
- [ ] `<TweetFeedWithSentiment>` - Scrollable list of tweets with sentiment scores
- [ ] `<FilterToolbar>` - Tool and time range selectors
- [ ] Add "Sentiment" link to sidebar navigation

#### 6.2: Replace Mock Data
- [ ] Update SWR configurations to use real API endpoints
- [ ] Replace hardcoded data in components
- [ ] Add loading states and error handling

#### 6.3: Demo Mode Toggle
- [ ] Add "Live / Demo" toggle in header
- [ ] Switch between `/api` and `/public/data` sources
- [ ] Copy processed sentiment data to `/public/data/x-posts-sentiment.json`
- [ ] Useful for offline demos and development

#### 6.4: Empty State Handling
- [ ] Update ContentFeed for empty arrays
- [ ] Add "no data" states with helpful messages
- [ ] Ensure UI never breaks with missing data

## Updated Technical Architecture

### File-Based Data Flow with Amp Integration
```
Sources → Adapters → JSON Files → API Routes → React Components
   ↓         ↓          ↓            ↓            ↓
RSS      rss-adapter   /cache/    /api/entries   Dashboard
GitHub   gh-adapter    /data/     /api/metrics   ContentFeed  
ADS      ads-research  /api/research /api/highlights ResearchPage ✅
X Posts  sentiment-etl /cache/x-posts-sentiment.json /api/metrics/sentiment SentimentPage ⭐
                         ↓            ↓            ↓
                   Context Retrieval → /api/amp → ChatDrawer
```

### Amp Query Interface Architecture
```
User Query → AmpQueryBar → /api/amp/route.ts → Context Retrieval
    ↑                             ↓                    ↓
Dashboard UI ← QueryResults ← JSON Stream ← Enriched Prompt + Data
```

### Deployment Strategy
- **Serverless**: Vercel/Netlify compatible (file-based, no DB)
- **Build Time**: Run adapters, copy fallback data
- **Runtime**: Serve JSON from filesystem
- **CI/CD**: GitHub Actions for data updates

## Success Criteria for MVP

1. ✅ Dashboard loads with pixel-perfect mock design match
2. ✅ Real data from RSS + GitHub PRs + ADS research papers displays
3. 🎯 No runtime errors when data sources are offline
4. 🎯 **X Posts Sentiment Page**: Working sentiment analysis from real X posts data
5. 🎯 **Sentiment Metrics**: Tool comparison (AmpCode vs competitors) with trend charts
6. 🎯 Content feed shows 20+ real items across categories
7. 🎯 Build & deploy works without private API secrets
8. 🎯 **NEW**: Amp query interface provides intelligent search within dashboard
9. 🎯 **NEW**: Query results dynamically include relevant UnifiedEntry items  
10. 🎯 **NEW**: Streaming responses integrate seamlessly into dashboard layout

## Timeline - MVP Focus (5 days total)

- **Day 1**: Phase 2 (Data inventory) + Start Phase 3 (Adapters)
- **Day 2**: Finish Phase 3 (Adapters) + Start Phase 4 (API Routes + X Posts Sentiment)  
- **Day 3**: Finish Phase 4 (Sentiment Pipeline) + Phase 5 (Amp Query Interface Integration)
- **Day 4**: Phase 6 (Sentiment Page UI + Client integration)
- **Day 5**: Testing, Polish & Deployment

## Deferred Post-MVP

❌ **Cut from MVP** (can be added later):
- Complex Apify crawler integration
- Full Prisma database setup with migrations
- Advanced LLM classification pipeline
- Real-time WebSocket connections
- Advanced caching strategies

✅ **MVP Focus** (ships this week):
- Working dashboard with real data
- Solid fallback mechanisms
- Clean, maintainable code
- Ready for iterative improvements

## Risk Mitigation

### Technical Risks
- **Data Source Failures**: Robust fallback to pre-downloaded JSON
- **Build Complexity**: Keep adapters simple and stateless
- **API Reliability**: File-based approach reduces dependencies

### Timeline Risks
- **Scope Discipline**: Strict MVP feature boundary
- **Integration Issues**: Test each adapter independently
- **Deployment**: Use proven Next.js + Vercel stack

## Data Sources Integration Plan

### Existing Assets to Leverage
1. **RSS Feed Infrastructure** - Already working Node.js fetchers
2. **sourcegraph-demo Project** - Python scripts for GitHub PR data
3. **PR_dashboard Project** - ADS API integration scripts
4. **Current Prisma Schema** - Use as UnifiedEntry interface template

### Data Source Mapping Strategy
```typescript
// Source → Category Mapping Rules
const sourceCategoryMap = {
  // RSS feeds
  'cursor-changelog': 'product',
  'copilot-blog': 'product', 
  'arxiv-ai': 'research',
  'medium-ai': 'perspective',
  
  // GitHub data
  'github-pr': 'product',
  'github-issues': 'social',
  
  // ADS research papers  
  'ads-research': 'research',
  'ads-papers': 'research'
}
```

### Fallback Data Strategy
- **Build Time**: Generate comprehensive sample datasets
- **Runtime**: Graceful degradation with cached data
- **Demo Mode**: Full offline functionality for presentations
- **Error Handling**: Never show empty states, always have fallbacks

## Amp Query Interface Technical Specifications

### Dependencies
```bash
npm install @heroicons/react
```

### Environment Variables
```bash
# .env.local
AMP_API_KEY=your_amp_api_key_here
AMP_API_URL=https://api.ampcode.com  # Optional, defaults to this
```

### File Structure
```
app/
├── api/amp/route.ts           # Streaming query endpoint
components/query/
├── AmpQueryBar.tsx           # Enhanced search/query interface
├── QueryResults.tsx          # Streaming results display
├── SmartSuggestions.tsx      # Contextual query suggestions  
├── InsightCards.tsx          # AI-generated dashboard insights
└── QueryHistory.tsx          # Recent queries (optional)
hooks/
├── useAmpQuery.ts            # Query state management
└── useStreamingResults.ts    # Handle streaming responses
lib/
├── context.ts                # Data retrieval & search
├── amp-client.ts             # Amp API configuration
└── query-utils.ts            # Query processing utilities
```

### Key Implementation Notes

#### Context Retrieval Strategy
- **Lightweight RAG**: Keyword matching + recency weighting
- **Token Budget**: Max 3k tokens for context, 1k for conversation history
- **Data Sources**: All JSON files in `/data/` directory
- **Update Frequency**: Refresh on build, detect version changes

#### Streaming Configuration
```typescript
// app/api/amp/route.ts
export const runtime = "edge"
export async function POST(req: Request) {
  const { messages } = await req.json()
  const context = await getRelevantContext(messages[messages.length - 1].content)
  
  const ampResponse = await fetch(`${ampApiUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.AMP_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: enhancedPrompt }],
      stream: true,
      response_format: { type: 'json_object' }
    })
  })
  
  return new Response(ampResponse.body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
```

#### UI Integration Points
- **Query Bar**: Enhanced search bar at top of dashboard with Amp intelligence
- **Results Panel**: Streaming results integrated into main dashboard layout
- **Suggestions**: Contextual query suggestions based on current dashboard view
- **Insight Cards**: AI-generated insights displayed alongside existing metrics
- **Keyboard**: Cmd+K to focus query bar, Escape to clear, Enter to search

This revised MVP plan focuses on practical implementation using existing tools and data sources, ensuring we can ship a working dashboard quickly while maintaining the quality and design fidelity achieved in Phase 1.
