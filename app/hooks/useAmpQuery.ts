'use client';

import { useState } from 'react';

export function useAmpQuery() {
  const [currentQuery, setCurrentQuery] = useState('');
  const [isResultsVisible, setIsResultsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [latestResponse, setLatestResponse] = useState('');

  const executeQuery = async (query: string) => {
    setCurrentQuery(query);
    setIsResultsVisible(true);
    setIsLoading(true);
    setError(null);
    setLatestResponse('');

    try {
      const response = await fetch('/api/amp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: query }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let fullResponse = '';

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk
        const chunk = new TextDecoder().decode(value);
        fullResponse += chunk;
        setLatestResponse(fullResponse);
      }

    } catch (err) {
      console.error('Amp query error:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setIsResultsVisible(false);
    setCurrentQuery('');
    setLatestResponse('');
    setError(null);
  };

  return {
    // State
    currentQuery,
    isResultsVisible,
    isLoading,
    error,
    latestResponse,

    // Actions
    executeQuery,
    clearResults,
  };
}

export type AmpQueryHook = ReturnType<typeof useAmpQuery>;
