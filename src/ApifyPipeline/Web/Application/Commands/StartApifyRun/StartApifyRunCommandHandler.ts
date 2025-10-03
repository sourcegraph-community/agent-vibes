import {
  startApifyActorRun,
  type StartApifyRunInput,
  type StartApifyRunResult,
} from '@/src/ApifyPipeline/ExternalServices/Apify/client';
import {
  commandSchema,
  type StartApifyRunCommandInput,
} from './StartApifyRunCommand';

export type StartApifyRunCommandResult = StartApifyRunResult;

export const startApifyRunCommandHandler = async (
  input: StartApifyRunCommandInput,
): Promise<StartApifyRunCommandResult> => {
  const parsed = commandSchema.parse(input);

  const payload: StartApifyRunInput = {
    triggerSource: parsed.triggerSource,
    requestedBy: parsed.requestedBy,
    ingestion: parsed.ingestion,
    metadata: parsed.metadata,
  };

  const result = await startApifyActorRun(payload, { dryRun: parsed.dryRun });

  return result satisfies StartApifyRunCommandResult;
};
