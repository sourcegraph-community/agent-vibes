'use client';

import { useState, useEffect } from 'react';
import { SparklesIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface QueryResultsProps {
  query: string
  isStreaming: boolean
  streamingContent: string
  onClose: () => void
}

export function QueryResults({
  query,
  isStreaming,
  streamingContent,
  onClose,
}: QueryResultsProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (query || streamingContent) {
      setIsVisible(true);
    }
  }, [query, streamingContent]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200); // Allow animation to complete
  };

  if (!isVisible) return null;

  return (
    <div className={`
      transform transition-all duration-200 ease-out
      ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
    `}>
      <div className="
        bg-gradient-to-r from-blue-50 to-purple-50
        dark:from-gray-800 dark:to-gray-800
        border border-blue-200 dark:border-gray-600
        rounded-lg p-4 mt-4
      ">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-blue-500" />
            <span className="font-medium text-gray-900 dark:text-gray-100">
              Amp Analysis
            </span>
            {isStreaming && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <ClockIcon className="h-3 w-3" />
                <span>Analyzing...</span>
              </div>
            )}
          </div>

          <button
            onClick={handleClose}
            className="
              p-1 rounded-md text-gray-400 hover:text-gray-600
              hover:bg-white dark:hover:bg-gray-700
              transition-colors duration-150
            "
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Query display */}
        <div className="mb-3 p-2 bg-white dark:bg-gray-700 rounded border-l-4 border-blue-500">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Your query:
          </div>
          <div className="text-sm text-gray-900 dark:text-gray-100">
            {query}
          </div>
        </div>

        {/* Streaming content */}
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {streamingContent ? (
            <div className="whitespace-pre-wrap">
              {streamingContent}
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
              )}
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 italic">
              Waiting for response...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
