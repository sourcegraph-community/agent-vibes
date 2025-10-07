# RSS Feed Discovery & Curation Guide

## Overview

This guide helps you discover, evaluate, and curate RSS feeds across three strategic categories for AI coding insights:

1. **Product Updates** — Latest features, releases, and roadmap changes from AI coding tools
2. **Research Papers** — Academic research on LLMs, code generation, and AI systems
3. **Perspective Pieces** — Industry analysis, developer experience insights, and thought leadership

---

## Feed Recommendations

### Product Updates

**AI Coding Tools:**
- **Cursor**: `https://changelog.cursor.sh/rss.xml` (changelog)
- **GitHub Copilot**: `https://github.blog/changelog/label/copilot/feed/` (changelog)
- **Cody (Sourcegraph)**: `https://sourcegraph.com/blog/rss.xml` (filter for Cody posts)
- **Amp**: `https://ampcode.com/blog/rss.xml` (if available, check site footer)
- **Continue.dev**: `https://blog.continue.dev/rss.xml`
- **Windsurf (Codeium)**: `https://codeium.com/blog/rss.xml`
- **Replit**: `https://blog.replit.com/feed.xml`
- **Tabnine**: `https://www.tabnine.com/blog/feed/`
- **Amazon CodeWhisperer**: `https://aws.amazon.com/blogs/devops/tag/amazon-codewhisperer/feed/`

**AI Platforms & APIs:**
- **OpenAI**: `https://openai.com/blog/rss.xml`
- **Anthropic**: `https://www.anthropic.com/news/rss.xml`
- **Google AI/DeepMind**: `https://blog.google/technology/ai/rss/`
- **Hugging Face**: `https://huggingface.co/blog/feed.xml`
- **LangChain**: `https://blog.langchain.dev/rss/`

**Developer Tools:**
- **Vercel**: `https://vercel.com/blog/rss.xml`
- **Supabase**: `https://supabase.com/blog/rss.xml`
- **Linear**: `https://linear.app/changelog/rss`

### Research Papers

**arXiv Categories:**
- **cs.AI (Artificial Intelligence)**: `https://export.arxiv.org/rss/cs.AI`
- **cs.CL (Computation & Language/NLP)**: `https://export.arxiv.org/rss/cs.CL`
- **cs.LG (Machine Learning)**: `https://export.arxiv.org/rss/cs.LG`
- **cs.SE (Software Engineering)**: `https://export.arxiv.org/rss/cs.SE`
- **cs.PL (Programming Languages)**: `https://export.arxiv.org/rss/cs.PL`

**Research Aggregators:**
- **Papers with Code**: `https://paperswithcode.com/feeds/latest/` (latest papers)
- **Hugging Face Papers**: `https://huggingface.co/papers` (check for RSS endpoint)
- **ACL Anthology**: `https://aclanthology.org/feed.xml` (NLP/CL research)
- **JMLR (Journal of Machine Learning Research)**: `https://www.jmlr.org/jmlr.xml`
- **Distill.pub**: `https://distill.pub/rss.xml` (ML research explanations)

**Research Labs:**
- **OpenAI Research**: `https://openai.com/research/rss.xml`
- **DeepMind Research**: `https://deepmind.google/discover/blog/rss.xml`
- **Meta AI Research**: `https://ai.meta.com/blog/rss/`
- **Microsoft Research**: `https://www.microsoft.com/en-us/research/feed/`

### Perspective Pieces

**VC & Industry Analysis:**
- **a16z**: `https://a16z.com/feed/` (general), `https://a16z.com/category/ai-ml/feed/` (AI-focused)
- **Stratechery by Ben Thompson**: `https://stratechery.com/feed/` (daily updates, premium)
- **Benedict Evans**: `https://www.ben-evans.com/benedictevans?format=rss`
- **Sequoia Capital**: `https://www.sequoiacap.com/feed/`

**Developer Advocates & Thought Leaders:**
- **Simon Willison**: `https://simonwillison.net/atom/everything/` (LLMs, AI tools)
- **Swyx (Shawn Wang)**: `https://www.swyx.io/rss.xml` (AI engineering)
- **Andrej Karpathy**: `https://karpathy.github.io/feed.xml` (AI/ML insights)
- **Eugene Yan**: `https://eugeneyan.com/feed.xml` (ML systems, applied AI)
- **Chip Huyen**: `https://huyenchip.com/feed.xml` (ML engineering)
- **Lilian Weng (OpenAI)**: `https://lilianweng.github.io/index.xml` (research summaries)

**Developer Communities:**
- **Hacker News**: `https://hnrss.org/frontpage` (frontpage), `https://hnrss.org/newest?q=AI+coding` (filtered)
- **Dev.to AI**: `https://dev.to/feed/tag/ai`
- **The Pragmatic Engineer**: `https://newsletter.pragmaticengineer.com/feed`
- **InfoQ AI/ML**: `https://feed.infoq.com/ai-ml-data-eng/`

**Publications:**
- **The New Stack**: `https://thenewstack.io/feed/`
- **The Overflow (Stack Overflow)**: `https://stackoverflow.blog/feed/`
- **ACM Queue**: `https://queue.acm.org/rss/feeds/queuecontent.xml`

---

## Feed Discovery Techniques

### Finding RSS Feeds on Websites

**Standard Locations:**
1. **Footer links** — Look for RSS, Feed, or Subscribe icons
2. **Blog/News sections** — Check `/blog`, `/news`, `/changelog` pages
3. **Browser auto-discovery** — Look for RSS icon in address bar (Firefox, some extensions)
4. **Page source** — Search for `<link rel="alternate" type="application/rss+xml"`

**Common URL Patterns:**
```
/rss.xml
/feed.xml
/feed/
/atom.xml
/blog/rss.xml
/blog/feed/
/changelog/rss
/index.xml (Hugo sites)
```

**Try appending to domain:**
- `https://example.com/rss.xml`
- `https://example.com/feed/`
- `https://blog.example.com/rss.xml`

### Tools & Browser Extensions

**Browser Extensions:**
- **RSS Feed Reader** (Chrome/Edge) — Auto-detects feeds on pages
- **Awesome RSS** (Firefox/Chrome) — Shows RSS icon when feeds are available
- **RSS Preview** (Firefox) — Renders RSS feeds in browser

**Online Tools:**
- **RSS.app** (`https://rss.app`) — Generates feeds from social media, websites
- **Feed43** (`https://feed43.com`) — Create RSS from any website
- **FetchRSS** (`https://fetchrss.com`) — Extract RSS from dynamic sites

**Command Line:**
```bash
# Check for RSS in HTML
curl -s https://example.com | grep -i "rss\|feed\|atom"

# Test if RSS URL works
curl -s https://example.com/feed.xml | head -20
```

### GitHub Release Feeds

For GitHub projects without RSS:
```
https://github.com/{org}/{repo}/releases.atom
https://github.com/{org}/{repo}/commits.atom
```

Example: `https://github.com/continuedev/continue/releases.atom`

---

## Feed Quality Criteria

### Product Updates

**Good indicators:**
- ✅ Structured changelog format (version, date, changes)
- ✅ Update frequency: Weekly to monthly
- ✅ Clear signal: Features, fixes, releases (not just marketing)
- ✅ Technical depth appropriate for developers
- ✅ Direct from source (not third-party aggregators)

**Red flags:**
- ❌ Infrequent updates (< 1 per quarter)
- ❌ Mixed with unrelated blog content
- ❌ Marketing-heavy, low technical detail
- ❌ Duplicate content from other feeds

### Research Papers

**Good indicators:**
- ✅ Focused category (cs.AI, cs.CL, not all of cs.*)
- ✅ Consistent publication rate
- ✅ Quality filtering (journal vs. raw preprints)
- ✅ Relevant abstracts/summaries included
- ✅ Links to code/datasets when available

**Red flags:**
- ❌ Too broad (100+ papers/day)
- ❌ Poor metadata (missing authors, dates)
- ❌ Broken links or paywalls without abstracts
- ❌ Low signal-to-noise ratio

### Perspective Pieces

**Good indicators:**
- ✅ Original analysis, not just news aggregation
- ✅ Technical depth or unique insights
- ✅ Author credibility (track record, credentials)
- ✅ Reasonable frequency (daily to monthly)
- ✅ Focused topic area aligned with AI coding

**Red flags:**
- ❌ Clickbait titles without substance
- ❌ Purely promotional content
- ❌ Rehashed news from other sources
- ❌ Irregular or abandoned (last post > 6 months ago)

---

## Adding Feeds to Miniflux

### Step-by-Step

1. **Log in to Miniflux** instance
   - Access your self-hosted or cloud instance
   - Navigate to Feeds section

2. **Add New Feed**
   - Click "Add subscription" or "New Feed"
   - Paste RSS URL (e.g., `https://simonwillison.net/atom/everything/`)
   - Miniflux will auto-detect feed title and metadata

3. **Assign Category**
   - Choose or create category:
     - `Product Updates`
     - `Research Papers`
     - `Perspective Pieces`
   - Set category before saving

4. **Configure Feed Settings** (optional)
   - **Scraper rules** — Enable full content fetching if needed
   - **Rewrite rules** — Clean up content or remove tracking
   - **Refresh interval** — Default is usually sufficient
   - **User agent** — Leave default unless blocked

5. **Set Feed-Level Filters** (advanced)
   - Filter by keywords (e.g., only "AI" or "LLM" posts)
   - Block rules (exclude certain terms)
   - Available in feed settings

6. **Verify Feed**
   - Check that entries are loading
   - Review first few entries for quality
   - Adjust settings if needed

### Bulk Import

Create OPML file with your feeds:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Product Updates">
      <outline type="rss" text="Cursor Changelog" xmlUrl="https://changelog.cursor.sh/rss.xml"/>
      <outline type="rss" text="Continue.dev Blog" xmlUrl="https://blog.continue.dev/rss.xml"/>
    </outline>
    <outline text="Research Papers">
      <outline type="rss" text="arXiv cs.AI" xmlUrl="https://export.arxiv.org/rss/cs.AI"/>
    </outline>
    <outline text="Perspective Pieces">
      <outline type="rss" text="Simon Willison" xmlUrl="https://simonwillison.net/atom/everything/"/>
    </outline>
  </body>
</opml>
```

Import via: Settings → Import → Choose OPML file

---

## Ongoing Curation Best Practices

### Weekly Review

1. **Check feed health** — Are feeds still updating?
2. **Assess signal quality** — Still relevant? Too noisy?
3. **Prune low-value feeds** — Remove feeds you consistently skip
4. **Add new discoveries** — 1-2 new feeds per week maximum

### Monthly Audit

- **Archive old entries** — Keep last 30-90 days depending on volume
- **Review category distribution** — Balanced across three categories?
- **Identify gaps** — Missing perspective on emerging topics?
- **Consolidate duplicates** — Multiple feeds covering same content?

### Feed Organization Tips

**Use Categories Effectively:**
- Keep main three categories clean
- Add subcategories if needed (e.g., `Research Papers/NLP`, `Product Updates/Open Source`)
- Use tags for cross-cutting themes

**Prioritize by Value:**
- Star/favorite high-signal feeds
- Set notifications for critical feeds (breaking changes, major releases)
- Consider separate view for "must-read" vs. "skim when time permits"

**Avoid Feed Fatigue:**
- Don't subscribe to everything — be selective
- Start with 10-15 core feeds, expand slowly
- Mark as read aggressively — it's okay to miss some entries
- Use "read later" tools (Pocket, Instapaper) for deep dives

### Quality Over Quantity

**Ideal feed count by category:**
- Product Updates: 8-12 feeds (key tools you actually use)
- Research Papers: 3-5 feeds (focused on relevant areas)
- Perspective Pieces: 10-15 feeds (diverse viewpoints)

**Total: 20-30 high-quality feeds is sustainable**

---

## Troubleshooting

### Feed Not Loading

1. Test URL directly in browser
2. Check if site requires authentication
3. Try alternative feed URL (RSS vs. Atom)
4. Use feed validator: `https://validator.w3.org/feed/`

### Too Much Noise

1. Use Miniflux entry filters (keywords)
2. Adjust refresh frequency (reduce for high-volume feeds)
3. Consider switching to digest/summary versions
4. Replace with more focused alternative

### Feed Went Dead

1. Check if site redesigned (new feed URL)
2. Look for RSS in new site footer
3. Search for official announcement
4. Use Wayback Machine to find last working URL
5. Replace with alternative source if abandoned

---

## Resources

- **Miniflux Documentation**: `https://miniflux.app/docs/`
- **RSS Specification**: `https://www.rssboard.org/rss-specification`
- **Atom Specification**: `https://datatracker.ietf.org/doc/html/rfc4287`
- **OPML Format**: `http://opml.org/spec2.opml`

---

**Last Updated**: 2025-10-07  
**Maintainer**: Review and update quarterly
