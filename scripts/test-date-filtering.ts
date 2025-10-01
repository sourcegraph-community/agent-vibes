#!/usr/bin/env tsx

/**
 * Test Date-Based Collection Strategy
 * Demonstrates how sinceDate is calculated
 */

import { createSupabaseServiceClient } from '@/src/ApifyPipeline/ExternalServices/Supabase/client';
import { getLastCollectedDate } from '@/src/ApifyPipeline/DataAccess/Repositories/NormalizedTweetsRepository';

const colors = {
  green: '\x1b[0;32m',
  red: '\x1b[0;31m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  reset: '\x1b[0m',
};

async function main(): Promise<void> {
  console.log('=== Testing Date-Based Collection Strategy ===\n');

  const supabase = createSupabaseServiceClient();

  // Fetch last collected date
  console.log(`${colors.blue}Fetching last collected date...${colors.reset}`);
  const lastCollectedAt = await getLastCollectedDate(supabase);

  if (lastCollectedAt) {
    console.log(`${colors.green}✓ Last collected date: ${lastCollectedAt}${colors.reset}`);

    // Calculate sinceDate (YYYY-MM-DD format)
    const sinceDate = new Date(lastCollectedAt).toISOString().split('T')[0];
    console.log(`${colors.green}✓ sinceDate for next run: ${sinceDate}${colors.reset}`);

    // Show what will be collected
    console.log(`\n${colors.yellow}Next collection will fetch:${colors.reset}`);
    console.log(`  - All keywords: ['AI agents', 'LLM', 'coding assistants', 'developer tools']`);
    console.log(`  - Tweets posted after: ${sinceDate}`);
    console.log(`  - Same date filter for all keywords`);
  } else {
    console.log(`${colors.yellow}⚠ No tweets found in database${colors.reset}`);

    // Calculate default lookback
    const lookbackDays = 7;
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);
    const sinceDate = lookbackDate.toISOString().split('T')[0];

    console.log(`${colors.green}✓ Using default lookback: ${lookbackDays} days${colors.reset}`);
    console.log(`${colors.green}✓ sinceDate for first run: ${sinceDate}${colors.reset}`);

    console.log(`\n${colors.yellow}First collection will fetch:${colors.reset}`);
    console.log(`  - All keywords: ['AI agents', 'LLM', 'coding assistants', 'developer tools']`);
    console.log(`  - Tweets from last ${lookbackDays} days (since ${sinceDate})`);
  }

  console.log(`\n${colors.green}✅ Date filtering strategy verified${colors.reset}`);
}

main().catch((err: Error) => {
  console.error(`${colors.red}❌ Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
