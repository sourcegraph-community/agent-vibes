'use client';



interface FilterToolbarProps {
  selectedTool: string;
  selectedWindow: '24h' | '7d' | '30d' | 'all';
  onToolChange: (tool: string) => void;
  onWindowChange: (window: '24h' | '7d' | '30d' | 'all') => void;
}

const toolOptions = [
  { value: 'all', label: 'All Tools' },
  { value: 'AmpCode', label: 'AmpCode' },
  { value: 'Cursor', label: 'Cursor' },
  { value: 'Copilot', label: 'GitHub Copilot' },
  { value: 'Cody', label: 'Sourcegraph Cody' },
  { value: 'Claude', label: 'Claude' },
  { value: 'ChatGPT', label: 'ChatGPT' },
];

const windowOptions = [
  { value: '24h' as const, label: 'Last 24 hours' },
  { value: '7d' as const, label: 'Last 7 days' },
  { value: '30d' as const, label: 'Last 30 days' },
  { value: 'all' as const, label: 'All time' },
];

export function FilterToolbar({
  selectedTool,
  selectedWindow,
  onToolChange,
  onWindowChange,
}: FilterToolbarProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Tool:
          </label>
          <select
            value={selectedTool}
            onChange={(e) => onToolChange(e.target.value)}
            className="min-w-32 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm"
          >
            {toolOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Time Range:
          </label>
          <select
            value={selectedWindow}
            onChange={(e) => onWindowChange(e.target.value as '24h' | '7d' | '30d' | 'all')}
            className="min-w-36 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm"
          >
            {windowOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
