#!/usr/bin/env tsx

/**
 * Apply Database Migrations Programmatically
 * Executes SQL files directly via PostgreSQL connection
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const colors = {
  green: '\x1b[0;32m',
  red: '\x1b[0;31m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  reset: '\x1b[0m',
};

function validateEnvironment(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`${colors.red}❌ Missing required environment variables${colors.reset}`);
    console.error(`Required: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function executeSqlDirect(sql: string, name: string): Promise<void> {
  console.log(`${colors.yellow}Executing ${name}...${colors.reset}`);

  // Extract project ref from Supabase URL
  const supabaseUrl = process.env.SUPABASE_URL!;
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  if (!projectRef) {
    throw new Error('Could not extract project ref from SUPABASE_URL');
  }

  // Build PostgreSQL connection string
  const connectionString = `postgresql://postgres.${projectRef}:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

  // Use psql if available
  const { execSync } = await import('node:child_process');

  try {
    const tempFile = join('/tmp', `migration-${Date.now()}.sql`);
    const { writeFileSync, unlinkSync } = await import('node:fs');

    writeFileSync(tempFile, sql);

    execSync(`psql "${connectionString}" -f "${tempFile}"`, {
      stdio: 'pipe',
    });

    unlinkSync(tempFile);

    console.log(`${colors.green}✅ Successfully executed ${name}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Failed to execute ${name}${colors.reset}`);
    throw error;
  }
}

async function main(): Promise<void> {
  console.log('=== Applying Database Migrations ===\n');

  validateEnvironment();

  const rootDir = join(__dirname, '..');

  const migrations = [
    {
      name: '20250929_1200_InitApifyPipeline.sql',
      path: join(rootDir, 'src/ApifyPipeline/DataAccess/Migrations/20250929_1200_InitApifyPipeline.sql'),
    },
    {
      name: '20250930_1500_AddBackfillBatches.sql',
      path: join(rootDir, 'src/ApifyPipeline/DataAccess/Migrations/20250930_1500_AddBackfillBatches.sql'),
    },
    {
      name: '20251001_1630_AddCollectedAtIndex.sql',
      path: join(rootDir, 'src/ApifyPipeline/DataAccess/Migrations/20251001_1630_AddCollectedAtIndex.sql'),
    },
  ];

  const seeds = [
    {
      name: '20250929_1230_KeywordsSeed.sql',
      path: join(rootDir, 'src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql'),
    },
  ];

  console.log(`${colors.blue}Note: This requires 'psql' to be installed on your system${colors.reset}`);
  console.log(`${colors.blue}If you don't have psql, copy the SQL files to Supabase SQL Editor instead${colors.reset}\n`);

  try {
    // Check if psql is available
    const { execSync } = await import('node:child_process');
    execSync('which psql', { stdio: 'ignore' });
  } catch {
    console.error(`${colors.red}❌ 'psql' command not found${colors.reset}`);
    console.log(`\n${colors.yellow}Alternative: Manual SQL execution${colors.reset}`);
    console.log('1. Open Supabase SQL Editor in your project');
    console.log('2. Execute these files in order:');
    migrations.concat(seeds).forEach(file => {
      console.log(`   - ${file.path}`);
    });
    process.exit(1);
  }

  try {
    // Apply migrations
    for (const migration of migrations) {
      const sql = readFileSync(migration.path, 'utf8');
      await executeSqlDirect(sql, migration.name);
    }

    console.log('');

    // Apply seeds
    for (const seed of seeds) {
      const sql = readFileSync(seed.path, 'utf8');
      await executeSqlDirect(sql, seed.name);
    }

    console.log(`\n${colors.green}✅ All migrations applied successfully!${colors.reset}`);
    console.log(`\nNext step: Run ${colors.blue}npm run health-check${colors.reset} to verify`);
    process.exit(0);
  } catch (err) {
    console.error(`\n${colors.red}❌ Migration failed: ${(err as Error).message}${colors.reset}`);
    process.exit(1);
  }
}

main().catch((err: Error) => {
  console.error(`${colors.red}❌ Unexpected error: ${err.message}${colors.reset}`);
  process.exit(1);
});
