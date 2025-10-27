import { getApifyEnv } from '@/src/ApifyPipeline/Infrastructure/Config/env';

const APIFY_API_BASE_URL = 'https://api.apify.com/v2';

export interface StartApifyRunInput {
  triggerSource: string;
  requestedBy?: string;
  ingestion: {
    tweetLanguage?: string | null;
    sort?: 'Top' | 'Latest';
    maxItemsPerKeyword?: number;
    keywordBatchSize?: number;
    cooldownSeconds?: number;
    useDateFiltering?: boolean;
    defaultLookbackDays?: number;
    minimumEngagement?: {
      retweets?: number;
      favorites?: number;
      replies?: number;
    };
  };
  metadata?: Record<string, unknown>;
}

export interface StartApifyRunOptions {
  dryRun?: boolean;
}

export interface StartApifyRunResult {
  runId: string;
  actorId: string;
  actorBuild?: string;
  status: string;
  url: string;
  startedAt: string;
}

interface ApifyRunResponse {
  data: {
    id: string;
    actId: string;
    buildId?: string;
    status: string;
    startedAt: string;
    details?: {
      startedAt?: string;
    };
    urls?: {
      webUrl?: string;
    };
  };
}

// Starts an Apify Actor run with RAW input (no wrapper). Useful when caller already
// provides the exact input expected by the target actor (e.g., tweet-scraper).
export const startApifyActorRunRaw = async (
  rawInput: Record<string, unknown>,
  options: StartApifyRunOptions = {},
): Promise<StartApifyRunResult> => {
  if (options.dryRun) {
    const now = new Date().toISOString();
    return {
      runId: `dryrun_${now}`,
      actorId: 'dryrun-actor',
      status: 'DRY_RUN',
      startedAt: now,
      url: 'https://console.apify.com/',
    } satisfies StartApifyRunResult;
  }

  const env = getApifyEnv();
  const actorPath = env.actorId.replace(/\//g, '~');
  const requestUrl = new URL(`${APIFY_API_BASE_URL}/acts/${actorPath}/runs`);
  requestUrl.searchParams.set('token', env.token);
  if (env.actorBuild) requestUrl.searchParams.set('build', env.actorBuild);

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rawInput),
  });

  if (!response.ok) {
    const errorPayload = await safeReadJson(response);
    throw new Error(
      `Apify run failed with status ${response.status}: ${JSON.stringify(errorPayload)}`,
    );
  }

  const payload = (await response.json()) as ApifyRunResponse;
  const data = payload.data;

  return {
    runId: data.id,
    actorId: data.actId,
    actorBuild: env.actorBuild,
    status: data.status,
    startedAt: data.details?.startedAt ?? data.startedAt,
    url: data.urls?.webUrl ?? `${APIFY_API_BASE_URL}/acts/${data.actId}/runs/${data.id}`,
  } satisfies StartApifyRunResult;
};

// Starts an Apify Actor run with our internal command shape. The payload is sent as raw
// JSON (no "input" wrapper) because Actors expect the input object at the root.
export const startApifyActorRun = async (
  input: StartApifyRunInput,
  options: StartApifyRunOptions = {},
): Promise<StartApifyRunResult> => {
  return startApifyActorRunRaw(input as unknown as Record<string, unknown>, options);
};

const safeReadJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch (error) {
    return { error: 'Failed to parse response JSON', details: String(error) };
  }
};
