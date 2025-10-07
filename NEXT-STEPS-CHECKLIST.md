# Next Steps Checklist

## ✅ Completed
- [x] Convert HTML/CSS/JS dashboard to Next.js
- [x] Connect social sentiment to Apify pipeline
- [x] Create Chart.js visualizations
- [x] Set up dual dashboard architecture
- [x] Document Miniflux integration
- [x] Update AGENTS.md with new architecture

## 📋 Ready to Implement (Priority Order)

### 1. Miniflux Setup (1-2 hours)
- [ ] Deploy Miniflux instance
  ```bash
  docker run -d --name miniflux \
    -p 8080:8080 \
    -e DATABASE_URL="postgres://..." \
    miniflux/miniflux:latest
  ```
- [ ] Access Miniflux at http://localhost:8080
- [ ] Create account and log in
- [ ] Generate API key (Settings → API Keys)
- [ ] Add to `.env.local`:
  ```env
  MINIFLUX_URL=http://localhost:8080
  MINIFLUX_API_KEY=your_key_here
  ```

### 2. Add RSS Feeds (30 minutes)
Create categories and add feeds:

**Product Updates Category:**
- [ ] Cursor changelog
- [ ] GitHub Copilot updates  
- [ ] Amp release notes
- [ ] Windsurf announcements

**Research Papers Category:**
- [ ] arXiv AI/ML feed
- [ ] Papers with Code
- [ ] HuggingFace papers

**Perspective Pieces Category:**
- [ ] a16z blog
- [ ] Developer advocate blogs
- [ ] Industry thought leaders

### 3. Implement Product Updates Component (2-3 hours)
- [ ] Create `app/dashboard-v2/components/ProductUpdates.tsx`
- [ ] Fetch from `/api/rss/entries?category=product`
- [ ] Map to highlight cards
- [ ] Replace placeholder in dashboard
- [ ] Test with real RSS data

**Code template:**
```typescript
// app/dashboard-v2/components/ProductUpdates.tsx
'use client';
import { useEffect, useState } from 'react';

export default function ProductUpdates() {
  const [entries, setEntries] = useState([]);
  
  useEffect(() => {
    fetch('/api/rss/entries?category=product&limit=10')
      .then(r => r.json())
      .then(data => setEntries(data.entries));
  }, []);
  
  return (
    <section id="updates">
      <h2>Product Updates</h2>
      <div className="highlights-grid">
        {entries.map(entry => (
          <div key={entry.id} className="highlight-card product">
            <div className="highlight-header">
              <div className="highlight-badge product">Product Update</div>
              <span>{new Date(entry.publishedAt).toLocaleDateString()}</span>
            </div>
            <h3>{entry.title}</h3>
            <p>{entry.summary}</p>
            <a href={entry.url} target="_blank">Read more →</a>
          </div>
        ))}
      </div>
    </section>
  );
}
```

### 4. Implement Research Papers Component (2-3 hours)
- [ ] Create `app/dashboard-v2/components/ResearchPapers.tsx`
- [ ] Similar to ProductUpdates but category=research
- [ ] Add research-specific styling
- [ ] Replace placeholder

### 5. Implement Perspectives Component (2-3 hours)
- [ ] Create `app/dashboard-v2/components/Perspectives.tsx`
- [ ] Category filter: perspective
- [ ] Add perspective badge styling
- [ ] Replace placeholder

### 6. Test End-to-End (30 minutes)
- [ ] Verify all RSS feeds working
- [ ] Check all sections rendering
- [ ] Test timeframe filters
- [ ] Verify search functionality
- [ ] Test mobile responsiveness

### 7. Optional: AI Summaries (4-6 hours)
**Only if you want AI-generated TL;DRs:**

- [ ] Install Ollama:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```
- [ ] Download model:
  ```bash
  ollama pull llama3.1:8b
  ```
- [ ] Clone summary agent:
  ```bash
  git clone https://github.com/trly/miniflux-summary-agent.git
  cd miniflux-summary-agent
  ```
- [ ] Configure `.env`:
  ```env
  MINIFLUX_URL=http://localhost:8080
  MINIFLUX_API_KEY=your_key
  ARTICLE_HOURS_BACK=24
  ```
- [ ] Run manually:
  ```bash
  python main.py
  ```
- [ ] Set up cron job for daily summaries
- [ ] Store summaries in Supabase
- [ ] Update components to show AI summaries

### 8. Deploy to Vercel (1 hour)
- [ ] Push to GitHub
- [ ] Connect Vercel project
- [ ] Add environment variables in Vercel
- [ ] Deploy
- [ ] Test production deployment
- [ ] Verify both dashboards work

### 9. Future Enhancements
- [ ] Timeline view combining all content
- [ ] Advanced search and filtering
- [ ] Save favorite articles
- [ ] Email digest of highlights
- [ ] Share individual insights

## 📚 Reference Documents

- **Setup Guide**: [docs/dashboard-v2-integration.md](docs/dashboard-v2-integration.md)
- **Miniflux Guide**: [docs/miniflux-integration.md](docs/miniflux-integration.md)
- **Summary**: [INTEGRATION-SUMMARY.md](INTEGRATION-SUMMARY.md)

## 🚀 Quick Start Commands

```bash
# Install dependencies (if needed)
npm install

# Start development server
npm run dev

# In another terminal, start Miniflux (if using Docker)
docker start miniflux

# Visit dashboards
open http://localhost:3000/dashboard-v2

# Test API
curl http://localhost:3000/api/social-sentiment?days=30
```

## ⚠️ Important Notes

1. **Social Sentiment Already Works**: The Apify pipeline integration is complete and live
2. **RSS is Next**: Focus on Miniflux setup and component implementation
3. **AI Summaries are Optional**: Dashboard works fine with basic RSS summaries
4. **Both Dashboards Coexist**: Keep `/dashboard` for quick reference, use `/dashboard-v2` for full analysis

## 🎯 Goal

Get Product Updates, Research Papers, and Perspective Pieces sections populated with real RSS data from Miniflux, matching the quality and design of the existing Social Sentiment section.

---

**Current Status**: ✅ Foundation complete, ready for RSS integration  
**Next Milestone**: Product Updates component with real Miniflux data  
**Timeline**: ~8-12 hours total for full RSS integration
