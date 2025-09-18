'use client';

import {
  LightBulbIcon,
  ChartBarIcon,
  ClockIcon,
  ArrowTrendingUpIcon as TrendingUpIcon,
} from '@heroicons/react/24/outline';

interface SmartSuggestionsProps {
  currentView?: string
  onSelect: (suggestion: string) => void
}

const baseSuggestions = [
  {
    icon: TrendingUpIcon,
    text: "What are the latest trends in AI coding assistants?",
    category: "trends",
  },
  {
    icon: ChartBarIcon,
    text: "Summarize sentiment across all sources",
    category: "analysis",
  },
  {
    icon: ClockIcon,
    text: "What happened in the last 24 hours?",
    category: "recent",
  },
  {
    icon: LightBulbIcon,
    text: "Show me the most important insights this week",
    category: "insights",
  },
];

const viewSpecificSuggestions: Record<string, typeof baseSuggestions> = {
  overview: [
    { icon: ChartBarIcon, text: "Analyze the performance metrics shown", category: "current" },
    { icon: TrendingUpIcon, text: "What's driving the current trends?", category: "trends" },
  ],
  research: [
    { icon: LightBulbIcon, text: "Summarize recent research developments", category: "research" },
    { icon: ChartBarIcon, text: "Compare research sentiment vs product sentiment", category: "analysis" },
  ],
  builds: [
    { icon: ClockIcon, text: "Why are builds failing more recently?", category: "builds" },
    { icon: TrendingUpIcon, text: "Show build performance trends", category: "analysis" },
  ],
};

export function SmartSuggestions({ currentView, onSelect }: SmartSuggestionsProps) {
  const suggestions = currentView && viewSpecificSuggestions[currentView]
    ? [...viewSpecificSuggestions[currentView], ...baseSuggestions.slice(0, 2)]
    : baseSuggestions;

  return (
    <div className="
      bg-white dark:bg-gray-900
      border border-gray-200 dark:border-gray-700
      rounded-lg shadow-lg p-2
      max-h-64 overflow-y-auto
    ">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">
        Suggested queries
      </div>

      <div className="space-y-1">
        {suggestions.map((suggestion, index) => {
          const IconComponent = suggestion.icon;
          return (
            <button
              key={index}
              onClick={() => onSelect(suggestion.text)}
              className="
                w-full flex items-center gap-3 px-2 py-2
                text-left text-sm text-gray-700 dark:text-gray-300
                hover:bg-gray-50 dark:hover:bg-gray-800
                rounded-md transition-colors duration-150
              "
            >
              <IconComponent className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="flex-1">{suggestion.text}</span>
              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                {suggestion.category}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
