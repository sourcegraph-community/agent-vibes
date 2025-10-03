#!/usr/bin/env tsx

import { config } from 'dotenv';
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Load .env.local (if needed for any env-based config)
config({ path: '.env.local' });

const SOURCE_DIR = 'src/ApifyPipeline/ExternalServices/Gemini/EdgeFunctions/sentimentProcessor';
const TARGET_DIR = 'supabase/functions/sentiment-processor';

function copyDirectory(source: string, target: string): void {
  if (!existsSync(target)) {
    mkdirSync(target, { recursive: true });
  }

  const entries = readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      copyFileSync(sourcePath, targetPath);
      console.log(`Copied: ${sourcePath} → ${targetPath}`);
    }
  }
}

console.log('Building Supabase Edge Functions...');
console.log(`Source: ${SOURCE_DIR}`);
console.log(`Target: ${TARGET_DIR}`);

if (existsSync(TARGET_DIR)) {
  console.log('Cleaning target directory...');
  rmSync(TARGET_DIR, { recursive: true, force: true });
}

copyDirectory(SOURCE_DIR, TARGET_DIR);

console.log('✓ Edge functions built successfully');
