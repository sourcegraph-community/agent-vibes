#!/usr/bin/env tsx

/**
 * Apply RSS Pipeline Database Migrations Programmatically
 * Executes SQL files via Supabase Data API
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

function parseSqlStatements(sql: string): string[] {
  // Remove comments and normalize whitespace
  const cleaned = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  // Split by semicolons, but preserve statements like functions with embedded semicolons
  const statements: string[] = [];
  let current = '';
  let dollarQuoteDepth = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const next = cleaned[i + 1];

    // Track $$ blocks (PL/pgSQL functions)
    if (char === '$' && next === '$') {
      dollarQuoteDepth = dollarQuoteDepth === 0 ? 1 : 0;
      current += char;
      continue;
    }

    current += char;

    // Only split on semicolons outside of $$ blocks
    if (char === ';' && dollarQuoteDepth === 0) {
      const statement = current.trim();
      if (statement && !statement.match(/^(begin|commit);?$/i)) {
        statements.push(statement);
      }
      current = '';
    }
  }

  return statements.filter(s => s.length > 0);
}

async function executeSqlViaSupabase(sql: string, name: string): Promise<void> {
  console.log(`${colors.yellow}Executing ${name}...${colors.reset}`);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  const statements = parseSqlStatements(sql);
  console.log(`  ${colors.blue}Found ${statements.length} SQL statement(s)${colors.reset}`);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'public' },
    auth: { persistSession: false }
  });
  
  // Check if exec function exists
  const { error: checkError } = await supabase.rpc('exec', { sql: 'SELECT 1' }) as any;
  if (checkError && checkError.message?.includes('Could not find the function')) {
    console.error(`${colors.red}❌ Missing exec() function${colors.reset}\n`);
    console.error(`${colors.yellow}Please run this SQL in Supabase SQL Editor first:${colors.reset}\n`);
    console.error(`${colors.blue}${readFileSync(join(__dirname, 'bootstrap-exec-function.sql'), 'utf8')}${colors.reset}\n`);
    throw new Error('exec() function not found - see instructions above');
  }

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 60).replace(/\s+/g, ' ') + (statement.length > 60 ? '...' : '');
    
    console.log(`  ${colors.blue}[${i + 1}/${statements.length}] ${preview}${colors.reset}`);

    try {
      // Execute via RPC using raw SQL
      const { error } = await supabase.rpc('exec', { sql: statement }) as any;
      
      if (error) {
        throw new Error(error.message || error.toString());
      }

      console.log(`    ${colors.green}✓ Success${colors.reset}`);
    } catch (error) {
      console.error(`    ${colors.red}✗ Failed${colors.reset}`);
      if (error instanceof Error) {
        console.error(`    ${colors.red}${error.message}${colors.reset}`);
      }
      throw error;
    }
  }

  console.log(`${colors.green}✅ Successfully executed ${name}${colors.reset}`);
}

async function main(): Promise<void> {
  console.log('=== Applying RSS Pipeline Database Migrations ===\n');

  const rootDir = join(__dirname, '..');

  const migrations = [
    {
      name: '20251007_1000_InitRssPipeline.sql',
      path: join(rootDir, 'src/RssPipeline/DataAccess/Migrations/20251007_1000_InitRssPipeline.sql'),
    },
    {
      name: '20251007_1400_AddCollectedAt.sql',
      path: join(rootDir, 'src/RssPipeline/DataAccess/Migrations/20251007_1400_AddCollectedAt.sql'),
    },
    {
      name: '20251007_1500_FixSchema.sql',
      path: join(rootDir, 'src/RssPipeline/DataAccess/Migrations/20251007_1500_FixSchema.sql'),
    },
    {
      name: '20251007_1600_MakeMinifluxIdNullable.sql',
      path: join(rootDir, 'src/RssPipeline/DataAccess/Migrations/20251007_1600_MakeMinifluxIdNullable.sql'),
    },
    {
      name: '20251007_1700_AddStatusColumn.sql',
      path: join(rootDir, 'src/RssPipeline/DataAccess/Migrations/20251007_1700_AddStatusColumn.sql'),
    },
  ];

  try {
    // Apply migrations
    for (const migration of migrations) {
      const sql = readFileSync(migration.path, 'utf8');
      await executeSqlViaSupabase(sql, migration.name);
    }

    console.log(`\n${colors.green}✅ All RSS pipeline migrations applied successfully!${colors.reset}`);
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
