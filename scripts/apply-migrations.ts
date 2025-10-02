#!/usr/bin/env tsx

/**
 * Apply Database Migrations Programmatically
 * Executes SQL files directly via PostgreSQL connection
 */

import { config } from 'dotenv';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Load .env.local
config({ path: '.env.local' });

const colors = {
  green: '\x1b[0;32m',
  red: '\x1b[0;31m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  reset: '\x1b[0m',
};

type ExecOutputError = Error & {
  stdout?: Buffer | string;
  stderr?: Buffer | string;
};

function hasExecOutput(error: Error): error is ExecOutputError {
  return 'stdout' in error || 'stderr' in error;
}

function normalizeExecOutput(output?: Buffer | string): string {
  if (typeof output === 'string') {
    return output;
  }

  if (Buffer.isBuffer(output)) {
    return output.toString('utf8');
  }

  return '';
}

function resolveConnectionString(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return databaseUrl;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePassword = process.env.SUPABASE_DB_PASSWORD;

  if (!supabaseUrl || !supabasePassword) {
    throw new Error('Set DATABASE_URL or SUPABASE_URL/SUPABASE_DB_PASSWORD');
  }

  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  if (!projectRef) {
    throw new Error('Could not extract project ref from SUPABASE_URL');
  }

  const host = process.env.SUPABASE_DB_HOST ?? `db.${projectRef}.supabase.co`;
  const port = process.env.SUPABASE_DB_PORT ?? '5432';
  const username = process.env.SUPABASE_DB_USER ?? 'postgres';

  return `postgresql://${username}:${supabasePassword}@${host}:${port}/postgres`;
}

function ensureSslConnectionString(connectionString: string): string {
  return connectionString.includes('?')
    ? `${connectionString}&sslmode=require`
    : `${connectionString}?sslmode=require`;
}

async function executeSqlDirect(sql: string, name: string, connectionString: string): Promise<void> {
  console.log(`${colors.yellow}Executing ${name}...${colors.reset}`);

  const tempFile = join('/tmp', `migration-${Date.now()}.sql`);

  try {
    writeFileSync(tempFile, sql);

    execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-d', ensureSslConnectionString(connectionString), '-f', tempFile], {
      stdio: 'pipe',
    });

    console.log(`${colors.green}✅ Successfully executed ${name}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Failed to execute ${name}${colors.reset}`);
    if (error instanceof Error) {
      if (hasExecOutput(error)) {
        const stderr = normalizeExecOutput(error.stderr).trim();
        const stdout = normalizeExecOutput(error.stdout).trim();
        if (stderr) {
          console.error(stderr);
        }
        if (stdout) {
          console.error(stdout);
        }
      }
    }
    throw error;
  } finally {
    try {
      unlinkSync(tempFile);
    } catch (cleanupError) {
      if (cleanupError instanceof Error) {
        console.warn(`${colors.yellow}Warning: could not remove temp file ${tempFile}: ${cleanupError.message}${colors.reset}`);
      }
    }
  }
}

async function main(): Promise<void> {
  console.log('=== Applying Database Migrations ===\n');

  const connectionString = resolveConnectionString();

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
    {
      name: '20251002_1605_AllowMutableTables.sql',
      path: join(rootDir, 'src/ApifyPipeline/DataAccess/Migrations/20251002_1605_AllowMutableTables.sql'),
    },
  ];

  const seeds = [
    {
      name: '20250929_1230_KeywordsSeed.sql',
      path: join(rootDir, 'src/ApifyPipeline/DataAccess/Seeds/20250929_1230_KeywordsSeed.sql'),
    },
  ];

  try {
    // Apply migrations
    for (const migration of migrations) {
      const sql = readFileSync(migration.path, 'utf8');
      await executeSqlDirect(sql, migration.name, connectionString);
    }

    console.log('');

    // Apply seeds
    for (const seed of seeds) {
      const sql = readFileSync(seed.path, 'utf8');
      await executeSqlDirect(sql, seed.name, connectionString);
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
