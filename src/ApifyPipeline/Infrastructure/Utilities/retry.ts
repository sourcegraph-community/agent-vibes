export interface RetryOptions {
  retries: number;
  factor?: number;
  minTimeoutMs?: number;
  jitter?: boolean;
}

export const retry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> => {
  const { retries, factor = 2, minTimeoutMs = 500, jitter = true } = options;

  let attempt = 0;
  let delay = minTimeoutMs;

  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;

      if (attempt > retries) {
        throw error;
      }

      // Add jitter to prevent thundering herd problem
      const jitteredDelay = jitter
        ? delay * (1 + Math.random() * 0.1)
        : delay;

      await new Promise((resolve) => {
        setTimeout(resolve, jitteredDelay);
      });

      delay *= factor;
    }
  }

  throw new Error('Retry attempts exceeded the configured limit.');
};
