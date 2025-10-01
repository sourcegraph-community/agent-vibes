#!/usr/bin/env tsx

/**
 * Apply Database Migrations via Supabase Client
 * Works around network/port blocking issues
 */

import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
config({ path: '.env.local' });

const colors = {
  green: '\x1b[0;32m',
  red: '\x1b[0;31m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  reset: '\x1b[0m',
};

async function executeSql(sql: string, name: string): Promise<void> {
  console.log(`${colors.yellow}Executing ${name}...${colors.reset}`);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const pooler = process.env.SUPABASE_DB_POOLER;
  const targetClient = pooler
    ? createClient(pooler, supabaseKey, {
        auth: { persistSession: false },
      })
    : supabase;

  // Execute raw SQL using Supabase's postgrest
  const { error } = await (targetClient as any).rpc('exec', { sql });

  if (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    console.log(`\n${colors.yellow}Note: This requires creating a 'exec' function in your database.${colors.reset}`);
    console.log(`${colors.yellow}Since this failed, please copy these SQL files to Supabase Studio:${colors.reset}\n`);
    console.log(`1. ${colors.blue}src/ApifyPipeline/DataAccess/Migrations/20250929_1200_InitApifyPipeline.sql${colors.reset}`);
    console.log(`2. ${colors.blue}src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql${colors.reset}`);
    console.log(`\nGo to: https://supabase.com/dashboard/project/ybxfkmqrrbnqbgezsvyt/sql/new`);
    throw error;
  }

  console.log(`${colors.green}✓ ${name} completed${colors.reset}`);
}

async function main(): Promise<void> {
  console.log(`${colors.blue}=== Applying Migrations via Supabase Client ===${colors.reset}\n`);

  const migrationsDir = join(process.cwd(), 'src/ApifyPipeline/DataAccess/Migrations');
  const seedsDir = join(process.cwd(), 'src/ApifyPipeline/DataAccess/Seeds');

  try {
    // Apply main migration
    const migrationSql = readFileSync(join(migrationsDir, '20250929_1200_InitApifyPipeline.sql'), 'utf-8');
    await executeSql(migrationSql, '20250929_1200_InitApifyPipeline.sql');

    // Apply seed data
    const seedSql = readFileSync(join(seedsDir, '20250929_1230_KeywordsSeed.sql'), 'utf-8');
    await executeSql(seedSql, '20250929_1230_KeywordsSeed.sql');

    console.log(`\n${colors.green}✅ All migrations applied successfully!${colors.reset}`);
  } catch (err) {
    console.error(`\n${colors.red}❌ Migration failed${colors.reset}`);
    process.exit(1);
  }
}

main();
