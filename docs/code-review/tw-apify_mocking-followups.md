# tw/apify_mocking Branch Follow-ups

## Outstanding Issues

- **Mock data accuracy**: Align Apify output fixture statistics (item counts) with the truncated sample data.
- **Tweet metric fallback**: Update `formatSampleStat` in `app/mocks/apify-tweet-scraper/page.tsx` to show em dashes instead of zero when counts are unavailable.
- **Analytics interactivity**: Implement client-side behavior for overview filters (timeframe buttons, agent/source checkboxes) beyond the primary chart.
- **CDN resilience** *(optional)*: Add fallbacks or version monitoring for pinned Chart.js and Lucide assets.

## Verification Checklist

- [ ] `npm run dev` boots analytics and Apify mocks without console errors.
- [ ] Analytics dashboard filters toggle metrics, highlights, and feeds as described in the README.
- [ ] Apify mock statistics tiles reflect updated fixture counts.
- [ ] Documentation clean-up confirmed and links still resolve.
- [ ] Optional CDN fallbacks or monitoring decisions documented.
