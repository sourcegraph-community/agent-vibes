export interface RetryOptions {
  retries: number;
  factor?: number;
  minTimeoutMs?: number;
}

export const retry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> => {
  const { retries, factor = 2, minTimeoutMs = 500 } = options;

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

      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });

      delay *= factor;
    }
  }

  throw new Error('Retry attempts exceeded the configured limit.');
};
