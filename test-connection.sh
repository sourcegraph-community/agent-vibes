#!/bin/bash

# Quick Connection Test Script
# Run: chmod +x test-connection.sh && ./test-connection.sh

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Dashboard V2 Connection Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check .env.local exists
echo "1️⃣  Checking environment variables..."
if [ -f .env.local ]; then
    echo -e "${GREEN}✓${NC} .env.local file exists"
    
    if grep -q "SUPABASE_URL" .env.local && grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local; then
        echo -e "${GREEN}✓${NC} Supabase credentials configured"
    else
        echo -e "${RED}✗${NC} Missing Supabase credentials in .env.local"
        echo -e "${YELLOW}→${NC} Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local"
        exit 1
    fi
else
    echo -e "${RED}✗${NC} .env.local not found"
    echo -e "${YELLOW}→${NC} Copy .env.example to .env.local and add your credentials"
    exit 1
fi

echo ""

# Test 2: Run health check
echo "2️⃣  Testing database connection..."
npm run health-check 2>&1 | grep -E "✅|❌" | head -5
echo ""

# Test 3: Check if dev server is running
echo "3️⃣  Checking dev server..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Dev server is running on http://localhost:3000"
else
    echo -e "${YELLOW}⚠${NC} Dev server not running"
    echo -e "${YELLOW}→${NC} Start with: npm run dev"
    echo ""
    echo "Skipping API tests..."
    exit 0
fi

echo ""

# Test 4: Test API endpoint
echo "4️⃣  Testing API endpoint..."
RESPONSE=$(curl -s 'http://localhost:3000/api/social-sentiment?days=7')

if echo "$RESPONSE" | grep -q "error"; then
    echo -e "${RED}✗${NC} API returned error:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    echo ""
    echo -e "${YELLOW}→${NC} Check server logs for details"
    echo -e "${YELLOW}→${NC} Verify Supabase credentials are correct"
    echo -e "${YELLOW}→${NC} Run: npm run health-check"
    exit 1
else
    # Check if we got actual data
    TOTAL=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('summary', {}).get('totalTweets', 0))" 2>/dev/null)
    
    if [ "$TOTAL" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} API working! Found $TOTAL tweets"
        echo -e "${GREEN}✓${NC} Data connection successful"
    else
        echo -e "${YELLOW}⚠${NC} API working but no data found"
        echo -e "${YELLOW}→${NC} Database might be empty"
        echo -e "${YELLOW}→${NC} Run data collection: npm run enqueue:backfill"
    fi
fi

echo ""

# Test 5: Dashboard access
echo "5️⃣  Dashboard URLs:"
echo -e "${GREEN}→${NC} Simple Dashboard:  http://localhost:3000/dashboard"
echo -e "${GREEN}→${NC} Full Dashboard:    http://localhost:3000/dashboard-v2"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Test Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3000/dashboard-v2 in your browser"
echo "2. Check the Social Sentiment section for real data"
echo "3. Open browser DevTools (F12) → Console for any errors"
echo ""
echo "For detailed testing guide: cat TESTING-GUIDE.md"
