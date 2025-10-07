import { createClient } from '@supabase/supabase-js';
import { commandSchema, type SyncEntriesCommandInput } from './SyncEntriesCommand';
import { createMinifluxClient } from '@/src/RssPipeline/ExternalServices/Miniflux/client';
import { RssRepository } from '@/src/RssPipeline/DataAccess/Repositories/RssRepository';
import { inferCategory } from '@/src/RssPipeline/Core/Transformations/categoryMapper';
import { stripHtml } from '@/src/RssPipeline/Core/Transformations/htmlStripper';

interface SyncEntriesResult {
  success: boolean;
  entriesSynced: number;
  entriesSkipped: number;
  errors: string[];
}

export const syncEntriesCommandHandler = async (
  input: SyncEntriesCommandInput,
): Promise<SyncEntriesResult> => {
  const command = commandSchema.parse(input);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const miniflux = createMinifluxClient();
  const repository = new RssRepository(supabase);

  const errors: string[] = [];
  let entriesSynced = 0;
  let entriesSkipped = 0;

  try {
    const result = await miniflux.getEntries({
      limit: command.options.limit,
      status: command.options.status,
      starred: command.options.starred,
      published_after: command.options.publishedAfter,
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        entriesSynced: 0,
        entriesSkipped: 0,
        errors: [result.error?.message ?? 'Failed to fetch entries from Miniflux'],
      };
    }

    const response = result.data;

    if (command.dryRun) {
      return {
        success: true,
        entriesSynced: 0,
        entriesSkipped: response.entries.length,
        errors: [],
      };
    }

    for (const entry of response.entries) {
      try {
        const strippedContent = stripHtml(entry.content);
        const category = inferCategory(entry.title, strippedContent, entry.feed.title);

        await repository.insertEntries([{
          feedId: entry.feed_id.toString(),
          feedTitle: entry.feed.title,
          entryId: entry.id.toString(),
          title: entry.title,
          url: entry.url,
          author: entry.author,
          publishedAt: entry.published_at,
          content: strippedContent,
          summary: null,
          category,
          collectedAt: new Date().toISOString(),
        }]);

        entriesSynced++;
      } catch (error) {
        entriesSkipped++;
        errors.push(`Failed to sync entry ${entry.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: true,
      entriesSynced,
      entriesSkipped,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      entriesSynced,
      entriesSkipped,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};
