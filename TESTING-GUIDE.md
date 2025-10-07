# Testing Dashboard V2 Connection

## Step 1: Check Environment Variables

First, verify you have the required environment variables:

```bash
cd agent-vibes
cat .env.local | grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY"
```

**Expected output:**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### If Missing:
Create `.env.local` file:
```bash
cp .env.example .env.local
# Then edit .env.local with your credentials
```

Get credentials from:
1. Supabase Dashboard → Project Settings → API
2. Or ask your team for the credentials

---

## Step 2: Verify Database Has Data

Run the health check to confirm connection:

```bash
npm run health-check
```

**Expected output:**
```
✅ Environment variables OK
✅ Supabase connection successful
✅ Keywords table: 4 enabled keywords found
✅ Database schema healthy
```

If you see errors, the database might not have data yet. Run:

```bash
# Apply database migrations
npm run apply-migrations

# Queue some test data (optional)
npm run enqueue:backfill
```

---

## Step 3: Test the API Endpoint Directly

Once environment is configured, test the API:

```bash
# Test with curl
curl 'http://localhost:3000/api/social-sentiment?days=7'
```

**Expected response:**
```json
{
  "data": [
    {
      "sentimentDay": "2025-10-01",
      "language": "en",
      "positiveCount": 45,
      "neutralCount": 20,
      "negativeCount": 5,
      "totalCount": 70,
      "avgSentimentScore": 0.654
    }
    // ... more days
  ],
  "summary": {
    "periodDays": 7,
    "totalTweets": 547,
    "positiveCount": 402,
    "neutralCount": 120,
    "negativeCount": 25,
    "avgSentimentScore": 0.654,
    "positivePercentage": 73.5,
    "neutralPercentage": 21.9,
    "negativePercentage": 4.6
  },
  "generatedAt": "2025-10-07T13:54:53.000Z"
}
```

**If you get an error:**
```json
{
  "error": "Failed to fetch social sentiment data"
}
```

This means either:
- Environment variables not configured
- Database doesn't have data
- Supabase connection issue

---

## Step 4: Start Development Server

```bash
npm run dev
```

You should see:
```
   ▲ Next.js 15.5.2 (Turbopack)
   - Local:        http://localhost:3000
 ✓ Ready in 550ms
```

---

## Step 5: Visit the Dashboard

Open in your browser:
```
http://localhost:3000/dashboard-v2
```

### What to Check:

#### ✅ If Connected Properly:
1. **Social Sentiment Section** shows:
   - Real numbers in summary cards (not zeros)
   - Chart with data points (not empty)
   - Recent activity feed with actual dates
   - No loading spinner stuck forever

2. **Summary Cards Show Real Data:**
   - "Total Posts": Actual number (e.g., 8,547)
   - "Positive": Percentage with count (e.g., 74.2% - 6,234 posts)
   - Chart displays line with data

#### ❌ If NOT Connected:
1. You'll see:
   - "Loading social sentiment data..." (stuck)
   - "Failed to load social sentiment data" (error)
   - All zeros in the cards
   - Empty chart
   - Browser console shows errors

---

## Step 6: Check Browser Console

Open Developer Tools (F12 or Cmd+Option+I):

### Console Tab

**✅ Good (connected):**
```
No errors
Possibly some Chart.js logs
```

**❌ Bad (not connected):**
```
Failed to fetch social sentiment: ...
Error: 500 Internal Server Error
```

### Network Tab

1. Filter by "Fetch/XHR"
2. Look for request to `social-sentiment?days=30`
3. Click on it to see:
   - **Status**: Should be `200 OK`
   - **Preview**: Should show JSON with data
   - **Response**: Full JSON response

**If Status is 500:**
- Check server console for errors
- Verify environment variables
- Check Supabase connection

---

## Step 7: Test Different Timeframes

In the dashboard header, change the timeframe dropdown:
- Last 7 days
- Last 30 days
- Last 90 days

Each change should:
1. Trigger a new API call (check Network tab)
2. Update the chart with new data
3. Update summary cards

---

## Quick Troubleshooting

### Problem: "Failed to load social sentiment data"

**Solution:**
```bash
# 1. Check environment variables
cat .env.local | grep SUPABASE

# 2. Test database connection
npm run health-check

# 3. Check server logs
# Look at terminal where npm run dev is running
# You should see the actual error message
```

### Problem: No data in database

**Solution:**
```bash
# 1. Apply migrations
npm run apply-migrations

# 2. Trigger a manual collection
curl -X POST http://localhost:3000/api/start-apify-run \
  -H "Content-Type: application/json" \
  -d '{"triggerSource": "manual-test", "ingestion": {"maxItemsPerKeyword": 10}}'

# 3. Wait a few minutes for data to collect

# 4. Check if data exists
# In Supabase dashboard, run query:
# SELECT COUNT(*) FROM normalized_tweets;
```

### Problem: Environment variables not loading

**Solution:**
```bash
# 1. Verify .env.local exists
ls -la .env.local

# 2. Restart dev server
# Ctrl+C to stop
npm run dev
```

### Problem: Chart shows but no data points

This means API returned data but it's empty:

```bash
# Check what API returns
curl 'http://localhost:3000/api/social-sentiment?days=7' | jq '.data | length'

# If returns 0, no data in database for that timeframe
# Try longer timeframe or collect more data
```

---

## Expected Visual Indicators

### ✅ **Connected Successfully:**

```
┌─────────────────────────────────┐
│ Social Sentiment                │
├─────────────────────────────────┤
│ ┌────────┬────────┬────────┐   │
│ │  8,547 │ 74.2% │ 21.5% │   │ ← Real numbers
│ │  Total │  Pos  │  Neg   │   │
│ └────────┴────────┴────────┘   │
│                                 │
│     Chart with data lines       │ ← Visible line graph
│         /\  /\                  │
│        /  \/  \                 │
│       /        \_               │
│                                 │
│ Recent Activity:                │
│ • Oct 7: 👍 45 😐 20 👎 5      │ ← Actual dates/numbers
│ • Oct 6: 👍 52 😐 18 👎 3      │
└─────────────────────────────────┘
```

### ❌ **NOT Connected:**

```
┌─────────────────────────────────┐
│ Social Sentiment                │
├─────────────────────────────────┤
│  ⏳ Loading...                  │ ← Stuck loading
│                                 │
│    OR                           │
│                                 │
│  ❌ Failed to load data         │ ← Error message
└─────────────────────────────────┘
```

---

## Complete Test Sequence

Run these commands in order:

```bash
# 1. Check environment
cat .env.local | grep SUPABASE_URL

# 2. Health check
npm run health-check

# 3. Start dev server
npm run dev

# 4. In another terminal, test API
curl 'http://localhost:3000/api/social-sentiment?days=7' | jq '.summary.totalTweets'

# 5. Open browser
open http://localhost:3000/dashboard-v2

# 6. Check browser console (F12)
# Look for any errors

# 7. Watch network tab
# Should see successful call to /api/social-sentiment
```

---

## Success Criteria

You know it's working when:
- ✅ API returns JSON with `summary.totalTweets > 0`
- ✅ Chart displays with visible line(s)
- ✅ Summary cards show real numbers (not 0)
- ✅ Recent activity shows actual dates and counts
- ✅ No errors in browser console
- ✅ Network tab shows 200 OK for API calls

---

## Still Having Issues?

1. **Check Server Logs:**
   - Look at terminal where `npm run dev` is running
   - Errors will show there

2. **Check Database:**
   - Log into Supabase Dashboard
   - SQL Editor: `SELECT COUNT(*) FROM tweet_sentiments;`
   - If 0, you need to collect data first

3. **Check API Route:**
   - Open: `app/api/social-sentiment/route.ts`
   - Add console.log at the top to debug

4. **Simplest Test:**
   ```bash
   # This should return data if everything is working
   npm run health-check
   ```

If health check passes but dashboard doesn't show data, the issue is in the frontend. If health check fails, the issue is with Supabase connection.
