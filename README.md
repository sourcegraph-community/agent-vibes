# AgentVibes 🚀

**Your pulse on the coding agent landscape**

A comprehensive intelligence platform designed to track market sentiment, competitive landscape, and technological developments in the AI coding agent space with real-time updates and intelligent notifications.

## 🎯 Features

### **Multi-Source Intelligence Gathering**
- **15+ RSS Feeds**: GitHub, TechCrunch, The Verge, InfoQ, StackOverflow, Dev.to, and more
- **Reddit Integration**: r/programming, r/MachineLearning, r/ExperiencedDevs via Apify scrapers
- **Hacker News**: AI-focused content via Algolia API
- **Changelog Tracking**: Windsurf, Cursor, Claude Code, and other tool updates
- **Research Papers**: arXiv CS papers via NASA ADS API

### **Real-Time Dashboard**
- **Live Updates**: Supabase real-time subscriptions
- **Smart Filtering**: Source-based and keyword filtering
- **Analytics Tracking**: User engagement and content popularity
- **Mobile Responsive**: Works across all devices

### **Intelligent Notifications**
- **Multi-Channel**: Web push, email via Knock workflows
- **Smart Categorization**: High-value, urgent, and digest notifications  
- **User Preferences**: Customizable notification settings
- **Breaking News**: Instant alerts for critical updates

### **Production Ready**
- **Scalable Architecture**: PostgreSQL (Supabase) + Prisma ORM
- **Error Handling**: Comprehensive retry logic and monitoring
- **Caching**: Multi-layer caching for performance
- **Security**: Environment-based secrets and API key management

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Next.js 15 (App Router) - Frontend & API Routes           │
├─────────────────────────────────────────────────────────────┤
│ Data Sources: RSS + Apify + APIs + Web Scrapers            │
│ • 10 RSS feeds (GitHub, TechCrunch, etc.)                  │
│ • 3 Reddit communities via Apify                           │
│ • Hacker News via Algolia API                              │
│ • 4 Changelog scrapers (HTML + Markdown)                   │
│ • NASA ADS for research papers                             │
├─────────────────────────────────────────────────────────────┤
│ Ingestion Pipeline: 5min cron → Process → Store → Notify   │
├─────────────────────────────────────────────────────────────┤
│ Database: Supabase PostgreSQL (SQLite for local dev)       │
├─────────────────────────────────────────────────────────────┤
│ Notifications: Knock workflows + Web Push                  │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (production)
- Apify account
- Knock account

### Installation

1. **Clone and install dependencies**
```bash
git clone <your-repo>
cd agent-vibes
npm install
```

2. **Set up environment variables**
```bash
cp env.example .env.local
```

Fill in your credentials:
```bash
# Database (use SQLite for local dev)
DATABASE_URL="file:./dev.db"

# Supabase (production)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key"

# Apify
APIFY_TOKEN="your_apify_token"

# Knock
KNOCK_SECRET_API_KEY="your_knock_secret_key"

# NASA ADS
ADS_API_TOKEN="your_ads_token"
```

3. **Initialize database**
```bash
npx prisma generate
npx prisma db push
```

4. **Start development server**
```bash
npm run dev
```

Visit http://localhost:3000/dashboard for the main interface.

## 📊 Dashboard

- **Homepage**: `/` - Landing page with notification signup
- **Dashboard**: `/dashboard` - Real-time intelligence feed  
- **Research**: `/research` - Academic papers feed
- **API**: `/api/entries` - REST API for entries

## Mock Dashboards

Two data-driven mock dashboards are bundled for rapid prototyping:

- **Apify Tweet Scraper:** Visit [http://localhost:3000/mocks/apify-tweet-scraper](http://localhost:3000/mocks/apify-tweet-scraper) while running `npm run dev`. The page hydrates from JSON fixtures in `mocks/apify-tweet-scraper/data/` and reuses the shared CSS skin.
- **Agent Intelligence Dashboard:** Visit [http://localhost:3000/mocks/analytics-dashboard](http://localhost:3000/mocks/analytics-dashboard). Metrics, highlights, and sentiment series are sourced from `mocks/analytics-dashboard/data/dashboard.json` and rendered with Chart.js + Lucide icons.

Update the JSON files to adjust copy, stats, or chart data—the routes re-read fixtures on every request.

## 🔧 API Endpoints

### Entries
- `GET /api/entries` - Get entries with filtering
- `POST /api/entries` - Manual ingestion trigger

### Notifications  
- `POST /api/notifications/test` - Send test notification
- `POST /api/notifications/subscribe-dashboard` - Subscribe user

### Cron Jobs
- `GET /api/cron/ingest` - 5-minute ingestion job (Vercel)

## 🛠 Development

### Adding New Data Sources

1. **RSS Feed**: Add to `lib/sources/config.ts`
2. **API Integration**: Extend handler in `lib/ingest/utils.ts`
3. **Custom Scraper**: Use Apify or create custom handler

### Testing Ingestion
```bash
curl -X POST http://localhost:3000/api/entries
```

### Testing Notifications
```bash
curl -X POST http://localhost:3000/api/notifications/test
```

## 📦 Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: Prisma + PostgreSQL (Supabase) / SQLite (dev)
- **Real-time**: Supabase subscriptions
- **Styling**: Tailwind CSS v4
- **Data Sources**: RSS Parser, Apify, REST APIs
- **Notifications**: Knock + Web Push
- **Deployment**: Vercel
- **TypeScript**: Strict mode enabled

## Known Issues

- **Stylistic indent regression (Sep 2025):** `@stylistic/indent` currently trips a stack overflow when linting large TSX trees with TypeScript 5.9 (tracked in [eslint-stylistic#915](https://github.com/eslint-stylistic/eslint-stylistic/issues/915)). As a mitigation we ignore `app/mocks/**` and `mocks/**` in [eslint.config.mjs](file:///home/prinova/CodeProjects/agent-vibes/eslint.config.mjs#L10-L79). Remove those ignores once the upstream fix ships and the rule is safe to re-enable.

## 🚀 Deployment

1. **Deploy to Vercel**
```bash
npm run build
vercel --prod
```

2. **Set environment variables** in Vercel dashboard

3. **Configure Supabase** database URL for production

4. **Set up cron jobs** - Vercel handles this automatically via `vercel.json`

## 📈 Monitoring

- **Ingestion logs**: Check Vercel function logs
- **Database**: Supabase dashboard
- **Notifications**: Knock dashboard  
- **Analytics**: Built-in event tracking

## 🔐 Security

- API keys stored in environment variables
- Rate limiting on ingestion
- Input validation and sanitization
- CORS configured for production domains

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)  
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see LICENSE file for details

---

**Built with ❤️ for the coding agent community**
