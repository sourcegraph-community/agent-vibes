import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricProps {
  title: string
  value: string | number
  description?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  icon?: ReactNode
  className?: string
}

const trendIcons = {
  up: <TrendingUp className="h-4 w-4 text-slate-400" />,
  down: <TrendingDown className="h-4 w-4 text-slate-500" />,
  neutral: <Minus className="h-4 w-4 text-muted-foreground" />,
};

const trendColors = {
  up: 'text-slate-400',
  down: 'text-slate-500',
  neutral: 'text-muted-foreground',
};

export function Metric({
  title,
  value,
  description,
  trend,
  trendValue,
  icon,
  className = '',
}: MetricProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {trend && (
          <div className="flex items-center gap-1">
            {trendIcons[trend]}
            {trendValue && (
              <span className={`text-xs ${trendColors[trend]}`}>
                {trendValue}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <div className="text-3xl font-bold leading-none">
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
