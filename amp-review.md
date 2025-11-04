## High-level summary
This diff tightens and broadens category detection throughout the pipeline.

1. `categoryResolution.ts`
   • Introduces a normalization table and helper that accept many folder/slug aliases.  
   • Adds a **perspective-host allow-list**, re-orders category resolution steps, and improves fallback logic.  
   • Leaves the old `MINIFLUX_CATEGORY_TO_RSS` table in place but effectively unused.

2. `ExternalServices/Miniflux`
   • `inhouse.ts` derives a default category from each OPML filename and passes it downstream.  
   • `opml.ts` accepts that forced category and overrides every feed extracted from the file.

These changes aim to reduce “uncategorized” items caused by unexpected folder names or OPML file locations.

## Tour of changes
Start with `src/RssPipeline/Core/Transformations/categoryResolution.ts`.  
This is the heart of the change: it defines the new normalization table, introduces the perspective host list, and changes the resolution order. Understanding it makes the other two files (which merely supply better category hints) self-explanatory.

## File-level review

### `src/RssPipeline/Core/Transformations/categoryResolution.ts`

What changed
• Added `CATEGORY_NORMALIZATION` table and `normalizeLabelToRssCategory()` helper.  
• New `PERSPECTIVE_HOSTS` allow-list.  
• Resolution order: (1) normalized folder; (2) perspective host; (3) research host; (4) feed-title hint; (5) heuristic; (6) legacy fallback.  
• Left the old `MINIFLUX_CATEGORY_TO_RSS` constant untouched.

Review
✔️  Correctness  
   – Normalization handles case, whitespace, dashes, underscores and no-space slugs.  
   – Host matching uses `host === d || host.endsWith('.' + d)`, covering sub-domains.  
   – Re-ordering places “perspective host” before “research host”, preventing an article from `dev.to` (in both lists) being mis-labelled.

⚠️  Redundant code  
   – `MINIFLUX_CATEGORY_TO_RSS` is no longer referenced anywhere inside the module. It should either be removed or referenced within `normalizeLabelToRssCategory` to avoid confusion and dead code flags.

⚠️  Performance / memory  
   – `CATEGORY_NORMALIZATION` duplicates some keys that differ only by underscore vs hyphen vs space. This is fine for size but could be generated algorithmically to avoid maintenance drift.

⚠️  Edge cases  
   – `normalizeLabelToRssCategory` collapses repeated separators to a single space **before** looking up.  
     ‣ Key “industry_research” becomes “industry research”, and lookup succeeds.  
     ‣ However “industry–research” (en-dash) or other exotic punctuation are still misses; consider `\p{Pd}`.  
   – If both `RESEARCH_HOSTS` and `PERSPECTIVE_HOSTS` contain the same base domain, only the first tested will win (currently perspective). Document this to avoid silent behaviour changes later.

Security / stability  
   – URL parsing is wrapped in try/catch: good.  
   – No new security surface.

### `src/RssPipeline/ExternalServices/Miniflux/inhouse.ts`

What changed
• Added `basename` import.  
• `deriveCategoryFromFilename()` inspects the filename (“product-updates.opml”, etc.) and returns a canonical `InhouseCategory`.  
• Passes this `forcedCategory` to `parseOpmlFileToInhouseFeeds`.

Review
✔️  Correctness  
   – Uses `.includes()` on a lowercase basename – simple and robust.  
   – Pattern “research” will also match e.g. “my-researcher‐notes.opml”. If that is a concern, anchor the word boundaries.

⚠️  Behavioural note  
   – This **overrides** the category for every feed inside the OPML file. If mixed-category files are ever introduced, information will be lost. At minimum the function docstring should state the override semantics.

### `src/RssPipeline/ExternalServices/Miniflux/opml.ts`

What changed
• `parseOpmlFileToInhouseFeeds()` now takes an optional `forcedCategory`.  
• When provided, every extracted feed is copied with `category` overwritten.

Review  
✔️ Straight-forward; spread operator copies the feed to keep immutability.  
⚠️ If an individual outline already had its own `category` field, it will be silently replaced; consider logging when an overwrite occurs for easier debugging.

## Recommendations

1. Remove or integrate the now-unused `MINIFLUX_CATEGORY_TO_RSS` constant.  
2. Add unit tests for `normalizeLabelToRssCategory`, especially for multi-separator edge cases.  
3. Document or log category overrides in OPML parsing to avoid accidental data loss.  
4. (Optional) Generate `CATEGORY_NORMALIZATION` programmatically from a minimal base list to reduce duplication.