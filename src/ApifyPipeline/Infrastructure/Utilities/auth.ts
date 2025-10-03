export function authenticateRequest(request: Request): string | null {
  const cronHeader = request.headers.get('x-vercel-cron');
  if (cronHeader) {
    return null;
  }

  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (expectedKey && apiKey === expectedKey) {
    return null;
  }

  return 'Unauthorized';
}
