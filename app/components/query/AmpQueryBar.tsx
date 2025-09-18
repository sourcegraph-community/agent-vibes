'use client';

import { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { SmartSuggestions } from './SmartSuggestions';

interface AmpQueryBarProps {
  onQuery: (query: string) => void
  isLoading?: boolean
  placeholder?: string
  currentView?: string
}

export function AmpQueryBar({
  onQuery,
  isLoading = false,
  placeholder = "Ask Amp about your data...",
  currentView,
}: AmpQueryBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd+K to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onQuery(query.trim());
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion);
    onQuery(suggestion);
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <div className={`
          relative flex items-center bg-white dark:bg-gray-900 
          border border-gray-200 dark:border-gray-700 
          rounded-lg transition-all duration-200
          ${isFocused ? 'ring-2 ring-blue-500 border-transparent' : ''}
          ${isLoading ? 'opacity-75' : ''}
        `}>
          <SparklesIcon className="absolute left-3 h-5 w-5 text-blue-500" />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className="
              w-full pl-11 pr-12 py-3
              bg-transparent border-0 outline-none
              text-gray-900 dark:text-gray-100
              placeholder-gray-500 dark:placeholder-gray-400
            "
            disabled={isLoading}
          />

          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="
              absolute right-2 p-2 rounded-md
              text-gray-400 hover:text-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200
            "
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
          </button>
        </div>
      </form>

      {/* Smart suggestions when focused */}
      {isFocused && (
        <div className="absolute z-50 w-full mt-2">
          <SmartSuggestions
            currentView={currentView}
            onSelect={handleSuggestionSelect}
          />
        </div>
      )}

      {/* Keyboard hint */}
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">⌘K</kbd> to focus
      </div>
    </div>
  );
}
