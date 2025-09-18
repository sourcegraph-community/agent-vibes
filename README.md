This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Mock Dashboards

Two data-driven mock dashboards are bundled for rapid prototyping:

- **Apify Tweet Scraper:** Visit [http://localhost:3000/mocks/apify-tweet-scraper](http://localhost:3000/mocks/apify-tweet-scraper) while running `npm run dev`. The page hydrates from JSON fixtures in `mocks/apify-tweet-scraper/data/` and reuses the shared CSS skin.
- **Agent Intelligence Dashboard:** Visit [http://localhost:3000/mocks/analytics-dashboard](http://localhost:3000/mocks/analytics-dashboard). Metrics, highlights, and sentiment series are sourced from `mocks/analytics-dashboard/data/dashboard.json` and rendered with Chart.js + Lucide icons.

Update the JSON files to adjust copy, stats, or chart data—the routes re-read fixtures on every request.

## Checks & Formatting

Install dependencies (including dev tools):

```bash
npm i
```

Run local checks:

```bash
# TypeScript + ESLint (no fixes)
npm run check

# TypeScript + ESLint with fixes and formatting
npm run check:fix

# Individually
npm run typecheck
npm run lint
npm run lint:fix
```

Notes:
- ESLint v9 flat config is used; see `eslint.config.mjs`.
- Formatting is handled via ESLint Stylistic (no Prettier). Use `npm run check:fix` to format.
- The ESLint rule for triple-slash references is disabled for `next-env.d.ts` (Next.js typed routes auto-add a reference).
- The ESLint cache file (`.eslintcache`) is ignored via `.gitignore`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
