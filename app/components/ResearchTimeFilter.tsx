"use client";

import type { TimeWindow } from "@/types/research";

interface ResearchTimeFilterProps {
  value: TimeWindow;
  onChange: (window: TimeWindow) => void;
  className?: string;
}

interface TimeFilterOption {
  value: TimeWindow;
  label: string;
}

const timeFilterOptions: TimeFilterOption[] = [
  { value: "all", label: "All time" },
  { value: "3m", label: "Last 3 months" },
  { value: "1m", label: "Last month" },
  { value: "1w", label: "Last week" },
  { value: "3d", label: "Last 3 days" },
  { value: "1d", label: "Last day" },
];

export default function ResearchTimeFilter({
  value,
  onChange,
  className = "",
}: ResearchTimeFilterProps) {
  return (
    <div className={`research-time-filter ${className}`}>
      <label htmlFor="time-filter" className="research-filter-label">
        Time range:
      </label>
      <select
        id="time-filter"
        value={value}
        onChange={(e) => onChange(e.target.value as TimeWindow)}
        className="select"
      >
        {timeFilterOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
