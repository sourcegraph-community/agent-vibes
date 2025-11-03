import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Discover all .opml files from a list of paths.
 * - If a path is a directory, collects all files with .opml extension within it (non-recursive).
 * - If a path is a file that ends with .opml, includes it directly.
 * - Silently skips missing/inaccessible paths.
 */
export function discoverOpmlFiles(paths: string[], ext: string = '.opml'): string[] {
  const results: string[] = [];
  const wanted = ext.toLowerCase();

  for (const p of paths) {
    try {
      if (!existsSync(p)) continue;
      const st = statSync(p);
      if (st.isDirectory()) {
        for (const name of readdirSync(p)) {
          if (name.toLowerCase().endsWith(wanted)) {
            results.push(join(p, name));
          }
        }
      } else if (p.toLowerCase().endsWith(wanted)) {
        results.push(p);
      }
    } catch {
      // ignore and continue
    }
  }

  return results;
}
