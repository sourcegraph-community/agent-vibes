import { createSupabaseServiceClient } from '@/src/Shared/Infrastructure/Storage/Supabase/serviceClient';
import { commandSchema, type GenerateSummariesCommandInput } from './GenerateSummariesCommand';
import { OllamaSummarizer } from '@/src/RssPipeline/ExternalServices/Summarizer/OllamaSummarizer';
import { RssRepository } from '@/src/RssPipeline/DataAccess/Repositories/RssRepository';

interface GenerateSummariesResult {
  success: boolean;
  summariesGenerated: number;
  summariesFailed: number;
  entriesReset: number;
  queueDepth: number;
  errors: string[];
}

export const generateSummariesCommandHandler = async (
  input: GenerateSummariesCommandInput,
): Promise<GenerateSummariesResult> => {
  const command = commandSchema.parse(input);

  const supabase = createSupabaseServiceClient();
  const summarizer = new OllamaSummarizer({
    baseUrl: process.env.OLLAMA_URL,
    model: process.env.OLLAMA_MODEL,
    maxRetries: command.options.maxRetries,
    timeoutMs: 30000,
  });
  const repository = new RssRepository(supabase);

  const errors: string[] = [];
  let summariesGenerated = 0;
  let summariesFailed = 0;
  let entriesReset = 0;

  try {
    if (command.options.resetStuckEntries) {
      entriesReset = await repository.resetStuckEntries();
      if (entriesReset > 0) {
        console.log(`[GenerateSummaries] Reset ${entriesReset} stuck entries`);
      }
    }

    const claimedEntries = await repository.claimPendingEntries(
      command.options.batchSize,
      command.options.maxRetries,
    );

    if (command.dryRun) {
      return {
        success: true,
        summariesGenerated: 0,
        summariesFailed: 0,
        entriesReset,
        queueDepth: claimedEntries.length,
        errors: [`Dry run: ${claimedEntries.length} entries claimed for summarization`],
      };
    }

    console.log(`[GenerateSummaries] Processing ${claimedEntries.length} entries`);

    for (const entry of claimedEntries) {
      const startTime = Date.now();
      try {
        const content = entry.content ?? entry.summary ?? entry.title;

        const result = await summarizer.generateSummary({
          entryId: entry.id,
          title: entry.title,
          content,
          author: entry.author,
        });

        if (!result.success || !result.summary) {
          throw new Error(result.error?.message ?? 'Summary generation failed');
        }

        await repository.insertSummary({
          entryId: entry.id,
          modelVersion: result.summary.model,
          summaryText: result.summary.summary,
          keyPoints: [],
          sentiment: null,
          topics: [],
          processedAt: new Date().toISOString(),
          latencyMs: result.summary.latencyMs,
        });

        await repository.updateStatus(entry.id, 'summarized');

        summariesGenerated++;
        console.log(`[GenerateSummaries] Entry ${entry.id} summarized in ${Date.now() - startTime}ms`);
      }
      catch (error) {
        summariesFailed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        await repository.updateStatus(entry.id, 'failed');

        errors.push(`Entry ${entry.id}: ${errorMessage}`);
        console.error(`[GenerateSummaries] Entry ${entry.id} failed: ${errorMessage}`);
      }
    }

    const remainingEntries = await repository.getPendingEntries(1);
    const queueDepth = remainingEntries.length;

    console.log(`[GenerateSummaries] Complete: ${summariesGenerated} succeeded, ${summariesFailed} failed, queue depth: ${queueDepth}`);

    return {
      success: true,
      summariesGenerated,
      summariesFailed,
      entriesReset,
      queueDepth,
      errors,
    };
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[GenerateSummaries] Fatal error: ${errorMessage}`);

    return {
      success: false,
      summariesGenerated,
      summariesFailed,
      entriesReset,
      queueDepth: 0,
      errors: [errorMessage],
    };
  }
};
