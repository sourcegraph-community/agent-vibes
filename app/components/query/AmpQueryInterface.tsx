'use client';

import { AmpQueryBar } from './AmpQueryBar';
import { QueryResults } from './QueryResults';
import { useAmpQuery } from '../../hooks/useAmpQuery';

interface AmpQueryInterfaceProps {
  currentView?: string
  className?: string
}

export function AmpQueryInterface({ currentView, className = '' }: AmpQueryInterfaceProps) {
  const {
    currentQuery,
    isResultsVisible,
    isLoading,
    error,
    latestResponse,
    executeQuery,
    clearResults,
  } = useAmpQuery();

  return (
    <div className={`query-interface-container space-y-6 ${className}`}>
      <div className="max-w-4xl mx-auto">
        <AmpQueryBar
          onQuery={executeQuery}
          isLoading={isLoading}
          currentView={currentView}
          placeholder="Ask Amp about your dashboard data..."
        />
      </div>

      {error && (
        <div className="max-w-4xl mx-auto">
          <div className="
            bg-red-50 dark:bg-red-900/20
            border border-red-200 dark:border-red-800
            rounded-lg p-4
          ">
            <div className="text-red-800 dark:text-red-200 text-sm font-medium">
              Query Error
            </div>
            <div className="text-red-600 dark:text-red-300 text-sm mt-1">
              {error.message || 'Something went wrong. Please try again.'}
            </div>
          </div>
        </div>
      )}

      {isResultsVisible && (
        <div className="max-w-4xl mx-auto">
          <QueryResults
            query={currentQuery}
            isStreaming={isLoading}
            streamingContent={latestResponse}
            onClose={clearResults}
          />
        </div>
      )}
    </div>
  );
}
