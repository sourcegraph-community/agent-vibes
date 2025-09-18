#!/usr/bin/env node

/**
 * Data Source Inventory Scanner
 * 
 * Scans for existing data sources and analyzes their structure.
 * Part of Phase 2: Data Source Inventory & Contracts
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Directories to scan for data sources
const SCAN_DIRECTORIES = [
  'lib/sources',
  'lib',
  'scripts'
];

// File extensions to analyze
const VALID_EXTENSIONS = ['.ts', '.js', '.py', '.mjs'];

/**
 * Analyze TypeScript source files for data source implementations
 */
async function analyzeSourceFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const relativePath = filePath.replace(rootDir + '/', '');
    
    // Extract class names, interfaces, and key patterns
    const classMatches = content.match(/class\s+(\w+)/g) || [];
    const interfaceMatches = content.match(/interface\s+(\w+)/g) || [];
    const exportMatches = content.match(/export\s+(async\s+)?function\s+(\w+)/g) || [];
    const endpointMatches = content.match(/endpoint:\s*['"`]([^'"`]+)['"`]/g) || [];
    const urlMatches = content.match(/https?:\/\/[^\s'"`,]+/g) || [];
    
    // Determine source type
    let sourceType = 'unknown';
    if (content.includes('RSS') || content.includes('rss-parser')) sourceType = 'rss';
    if (content.includes('API') || content.includes('fetch(')) sourceType = 'api';
    if (content.includes('scrape') || content.includes('cheerio')) sourceType = 'scrape';
    if (content.includes('ADS') || content.includes('adsabs')) sourceType = 'ads';
    if (content.includes('GitHub') || content.includes('github')) sourceType = 'github';
    
    // Extract update cadence hints
    let updateCadence = 'unknown';
    if (content.includes('cron') || content.includes('schedule')) updateCadence = 'scheduled';
    if (content.includes('realtime') || content.includes('websocket')) updateCadence = 'realtime';
    if (content.includes('hourly')) updateCadence = 'hourly';
    if (content.includes('daily')) updateCadence = 'daily';
    
    return {
      file: relativePath,
      sourceType,
      updateCadence,
      classes: classMatches.map(m => m.replace(/class\s+/, '')),
      interfaces: interfaceMatches.map(m => m.replace(/interface\s+/, '')),
      functions: exportMatches.map(m => m.replace(/export\s+(async\s+)?function\s+/, '')),
      endpoints: endpointMatches.map(m => m.replace(/endpoint:\s*['"`]/, '').replace(/['"`]/, '')),
      urls: [...new Set(urlMatches)],
      hasKeywords: content.includes('keywords'),
      hasHealthCheck: content.includes('healthCheck'),
      lastModified: new Date().toISOString()
    };
  } catch (error) {
    return {
      file: filePath.replace(rootDir + '/', ''),
      error: error.message
    };
  }
}

/**
 * Scan configuration files for source definitions
 */
async function scanConfigSources() {
  try {
    const configPath = join(rootDir, 'lib/sources/config.ts');
    const content = await readFile(configPath, 'utf-8');
    
    // Extract SOURCE_CONFIGS array
    const configMatch = content.match(/SOURCE_CONFIGS:\s*SourceConfig\[\]\s*=\s*\[([\s\S]*?)\];/);
    if (!configMatch) return [];
    
    // Parse individual source configurations (simplified parsing)
    const sources = [];
    const sourceBlocks = configMatch[1].split(/^\s*{/m).slice(1);
    
    for (const block of sourceBlocks) {
      const nameMatch = block.match(/name:\s*['"`]([^'"`]+)['"`]/);
      const typeMatch = block.match(/type:\s*['"`]([^'"`]+)['"`]/);
      const endpointMatch = block.match(/endpoint:\s*['"`]([^'"`]+)['"`]/);
      const isActiveMatch = block.match(/isActive:\s*(true|false)/);
      const keywordsMatch = block.match(/keywords:\s*\[([\s\S]*?)\]/);
      
      if (nameMatch && typeMatch && endpointMatch) {
        // Determine update cadence based on source type and name
        let updateCadence = 'daily'; // default
        if (typeMatch[1] === 'RSS') updateCadence = 'hourly';
        if (typeMatch[1] === 'API') updateCadence = '2hours';
        if (nameMatch[1].includes('Changelog')) updateCadence = 'weekly';
        
        sources.push({
          sourceId: nameMatch[1].toLowerCase().replace(/\s+/g, '-'),
          name: nameMatch[1],
          type: typeMatch[1],
          endpoint: endpointMatch[1],
          isActive: isActiveMatch ? isActiveMatch[1] === 'true' : true,
          updateCadence,
          keywords: keywordsMatch ? keywordsMatch[1].split(',').map(k => k.trim().replace(/['"`]/g, '')) : [],
          category: determineCategoryFromName(nameMatch[1])
        });
      }
    }
    
    return sources;
  } catch (error) {
    console.error('Failed to scan config sources:', error);
    return [];
  }
}

/**
 * Determine category from source name
 */
function determineCategoryFromName(name) {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('blog') || nameLower.includes('news') || nameLower.includes('techcrunch')) {
    return 'perspective';
  }
  if (nameLower.includes('arxiv') || nameLower.includes('research') || nameLower.includes('ml')) {
    return 'research';
  }
  if (nameLower.includes('changelog') || nameLower.includes('copilot') || nameLower.includes('cursor')) {
    return 'product';
  }
  if (nameLower.includes('reddit') || nameLower.includes('hacker news') || nameLower.includes('social')) {
    return 'social';
  }
  return 'perspective'; // default fallback
}

/**
 * Generate sample data structure for each source type
 */
function generateSampleOutput(sourceType) {
  const baseEntry = {
    id: "sample-id-123",
    title: "Sample Entry Title",
    summary: "Sample summary text...",
    url: "https://example.com/sample",
    publishedAt: "2024-01-15T10:30:00Z",
    source: sourceType,
    category: "product"
  };
  
  switch (sourceType) {
    case 'rss':
      return {
        ...baseEntry,
        content: "Full RSS content here...",
        tags: ["ai", "coding", "assistant"]
      };
    case 'api':
    case 'github':
      return {
        ...baseEntry,
        source: "github_pr",
        category: "product",
        metadata: {
          author: "developer",
          repository: "org/repo",
          prNumber: 123
        }
      };
    case 'ads':
      return {
        ...baseEntry,
        source: "ads_build",
        category: "research",
        metadata: {
          arxivClass: "cs.AI",
          authors: "Author et al.",
          citations: 42
        }
      };
    default:
      return baseEntry;
  }
}

/**
 * Recursively scan directory for relevant files
 */
async function scanDirectory(dirPath) {
  const files = [];
  
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        // Recursively scan subdirectories
        const subFiles = await scanDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && VALID_EXTENSIONS.includes(extname(entry.name))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not scan directory ${dirPath}:`, error.message);
  }
  
  return files;
}

/**
 * Main inventory scanner
 */
async function runInventory() {
  console.log('🔍 Scanning for data sources...\n');
  
  const foundFiles = [];
  const inventory = {
    scanDate: new Date().toISOString(),
    summary: {
      totalFiles: 0,
      sourceTypes: {},
      activeSourcesCount: 0
    },
    sourceFiles: [],
    configuredSources: [],
    sourceMapping: {},
    sampleOutputs: {}
  };
  
  // Scan for implementation files
  for (const scanDir of SCAN_DIRECTORIES) {
    const dirPath = join(rootDir, scanDir);
    try {
      const files = await scanDirectory(dirPath);
      foundFiles.push(...files);
      console.log(`📁 Scanned ${scanDir}: found ${files.length} files`);
    } catch (error) {
      console.warn(`Warning: Could not scan directory ${scanDir}:`, error.message);
    }
  }
  
  console.log(`📁 Total files found: ${foundFiles.length}`);
  
  // Analyze each file
  for (const file of foundFiles) {
    const analysis = await analyzeSourceFile(file);
    inventory.sourceFiles.push(analysis);
    
    if (analysis.sourceType !== 'unknown') {
      inventory.summary.sourceTypes[analysis.sourceType] = 
        (inventory.summary.sourceTypes[analysis.sourceType] || 0) + 1;
    }
  }
  
  // Scan configured sources
  const configuredSources = await scanConfigSources();
  inventory.configuredSources = configuredSources;
  inventory.summary.activeSourcesCount = configuredSources.filter(s => s.isActive).length;
  inventory.summary.totalFiles = foundFiles.length;
  
  // Build source mapping and sample outputs
  for (const source of configuredSources) {
    inventory.sourceMapping[source.sourceId] = {
      category: source.category,
      updateCadence: source.updateCadence,
      type: source.type.toLowerCase()
    };
    
    if (!inventory.sampleOutputs[source.type.toLowerCase()]) {
      inventory.sampleOutputs[source.type.toLowerCase()] = generateSampleOutput(source.type.toLowerCase());
    }
  }
  
  // Write inventory results
  const inventoryPath = join(rootDir, 'data-inventory.json');
  await writeFile(inventoryPath, JSON.stringify(inventory, null, 2));
  
  // Print summary
  console.log('\n📊 Inventory Summary:');
  console.log(`   • Total files analyzed: ${inventory.summary.totalFiles}`);
  console.log(`   • Active configured sources: ${inventory.summary.activeSourcesCount}`);
  console.log(`   • Source types found:`);
  for (const [type, count] of Object.entries(inventory.summary.sourceTypes)) {
    console.log(`     - ${type}: ${count} implementations`);
  }
  
  console.log('\n✅ Inventory complete!');
  console.log(`📄 Results saved to: data-inventory.json`);
  
  return inventory;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runInventory().catch(console.error);
}

export { runInventory };
