import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

const SUPABASE_API_BASE = 'https://api.supabase.com/v1';

class RotationError extends Error {}

type ApiKeyRecord = {
  id: string;
  type: string;
  api_key?: string;
  name?: string;
  description?: string;
  inserted_at?: string;
  updated_at?: string;
};

type ParsedArgs = {
  dryRun: boolean;
  ci: boolean;
  keepOld: boolean;
  envFiles: string[];
  outputFiles: string[];
};

const SECRET_NAME = 'sb_secret_service_role';
const ENV_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

const parseListInput = (value: string | undefined) =>
  (value ?? '')
    .split(/[,\n]+/)
    .map((piece) => piece.trim())
    .filter(Boolean);

const parseArgs = (argv: string[]): ParsedArgs => {
  const envFiles: string[] = [];
  const outputFiles: string[] = [];
  let dryRun = false;
  let ci = false;
  let keepOld = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--ci') {
      ci = true;
      continue;
    }

    if (arg === '--keep-old' || arg === '--keep-old-key') {
      keepOld = true;
      continue;
    }

    if (arg === '--env-file' || arg === '--output') {
      index += 1;
      const next = argv[index];
      if (!next) {
        throw new RotationError(`${arg} requires a value`);
      }
      if (arg === '--env-file') {
        envFiles.push(next);
      } else {
        outputFiles.push(next);
      }
      continue;
    }

    if (arg.startsWith('--env-file=')) {
      envFiles.push(arg.slice('--env-file='.length));
      continue;
    }

    if (arg.startsWith('--output=')) {
      outputFiles.push(arg.slice('--output='.length));
      continue;
    }

    throw new RotationError(`Unknown argument: ${arg}`);
  }

  return { dryRun, ci, keepOld, envFiles, outputFiles };
};

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new RotationError(`${name} must be set`);
  }
  return value;
};

const uniqueResolved = (paths: string[]) => {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const path of paths) {
    const absolute = resolve(path);
    if (seen.has(absolute)) {
      continue;
    }
    seen.add(absolute);
    results.push(absolute);
  }
  return results;
};

const fetchJson = async <T>(input: string, init: RequestInit & { accessToken: string }): Promise<T | undefined> => {
  const { accessToken, ...rest } = init;
  const headers = new Headers(rest.headers ?? {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');

  if (rest.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    ...rest,
    headers,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body.error === 'string') {
        message += `: ${body.error}`;
      } else if (typeof body.message === 'string') {
        message += `: ${body.message}`;
      }
    } catch (error) {
      // ignore body parsing issues to avoid masking the original error
    }
    throw new RotationError(message);
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }

  return JSON.parse(text) as T;
};

const listApiKeys = async (accessToken: string, projectRef: string) =>
  (await fetchJson<ApiKeyRecord[]>(
    `${SUPABASE_API_BASE}/projects/${projectRef}/api-keys?reveal=true`,
    {
      method: 'GET',
      accessToken,
    },
  )) ?? [];

const createServiceRoleKey = async (accessToken: string, projectRef: string) => {
  const created = await fetchJson<ApiKeyRecord>(
    `${SUPABASE_API_BASE}/projects/${projectRef}/api-keys?reveal=true`,
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'service_role',
        name: `service-role-${new Date().toISOString()}`,
      }),
      accessToken,
    },
  );

  if (!created) {
    throw new RotationError('Supabase did not return a response for the newly created service role key.');
  }

  return created;
};

const deleteApiKey = async (accessToken: string, projectRef: string, id: string) => {
  await fetchJson<unknown>(
    `${SUPABASE_API_BASE}/projects/${projectRef}/api-keys/${id}?was_compromised=false`,
    {
      method: 'DELETE',
      accessToken,
    },
  );
};

const upsertSecrets = async (accessToken: string, projectRef: string, secrets: { name: string; value: string }[]) => {
  await fetchJson<unknown>(
    `${SUPABASE_API_BASE}/projects/${projectRef}/secrets`,
    {
      method: 'POST',
      body: JSON.stringify(secrets),
      accessToken,
    },
  );
};

const upsertEnvFile = async (filePath: string, key: string, value: string) => {
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(filePath, `${key}=${value}\n`, { mode: 0o600 });
      return;
    }
    throw error;
  }

  const lines = content.split(/\r?\n/);
  let replaced = false;

  const updated = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      replaced = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!replaced) {
    updated.push(`${key}=${value}`);
  }

  await fs.writeFile(filePath, `${updated.filter(Boolean).join('\n')}\n`, { mode: 0o600 });
};

const appendOutputFile = async (filePath: string, key: string, value: string) => {
  await fs.appendFile(filePath, `${key}=${value}\n`, { mode: 0o600 });
};

const filterServiceRoleKeys = (keys: ApiKeyRecord[]) =>
  keys.filter((key) => key.type === 'service_role' || key.name?.toLowerCase().includes('service'));

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  const accessToken = requireEnv('SUPABASE_ACCESS_TOKEN');
  const projectRef = requireEnv('SUPABASE_PROJECT_REF');

  const envFileEnv = parseListInput(process.env.SUPABASE_ENV_PATHS ?? process.env.SUPABASE_ENV_FILES);
  const outputEnv = parseListInput(process.env.SUPABASE_OUTPUT_PATHS);

  const envFiles = uniqueResolved([
    ...(args.ci ? [] : ['.env.local', '.env']),
    ...envFileEnv,
    ...args.envFiles,
  ]);

  const outputFiles = uniqueResolved([...outputEnv, ...args.outputFiles]);

  const existingKeys = await listApiKeys(accessToken, projectRef);
  const serviceRoleKeys = filterServiceRoleKeys(existingKeys);

  if (args.dryRun) {
    console.log(`Dry run: would rotate service role key for project ${projectRef}.`);
    console.log(`Dry run: identified ${serviceRoleKeys.length} existing service role keys.`);
    if (!args.keepOld) {
      console.log('Dry run: would delete existing service role keys after creating the new key.');
    }
    if (!args.ci) {
      console.log(`Dry run: would update env files: ${envFiles.join(', ') || 'none'}.`);
    }
    if (outputFiles.length > 0) {
      console.log(`Dry run: would append outputs to: ${outputFiles.join(', ')}.`);
    }
    console.log(`Dry run: would upsert ${SECRET_NAME} in Supabase secrets.`);
    return;
  }

  const newKey = await createServiceRoleKey(accessToken, projectRef);
  if (!newKey.api_key) {
    throw new RotationError('Supabase did not return the newly created service role key value.');
  }

  await upsertSecrets(accessToken, projectRef, [{ name: SECRET_NAME, value: newKey.api_key }]);

  const fileTargets: string[] = [];

  for (const envFile of envFiles) {
    await upsertEnvFile(envFile, ENV_KEY, newKey.api_key);
    fileTargets.push(envFile);
  }

  for (const output of outputFiles) {
    await appendOutputFile(output, ENV_KEY, newKey.api_key);
    fileTargets.push(output);
  }

  if (!args.keepOld) {
    const keysToDelete = serviceRoleKeys.filter((key) => key.id !== newKey.id);
    for (const key of keysToDelete) {
      await deleteApiKey(accessToken, projectRef, key.id);
    }
  }

  console.log(
    `Supabase service role key rotated for project ${projectRef}. Updated targets: ${
      fileTargets.length > 0 ? fileTargets.join(', ') : 'none'
    }.`,
  );
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Rotation failed: ${message}`);
  process.exit(1);
});
