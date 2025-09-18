import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'product' | 'research' | 'perspective' | 'social' | 'academic'
  className?: string
}

const badgeVariants = {
  default: 'bg-secondary text-secondary-foreground',
  product: 'bg-indigo-700/20 text-indigo-300 border-indigo-700/30',
  research: 'bg-emerald-700/20 text-emerald-300 border-emerald-700/30',
  perspective: 'bg-amber-700/20 text-amber-300 border-amber-700/30',
  social: 'bg-violet-700/20 text-violet-300 border-violet-700/30',
  academic: 'bg-blue-700/20 text-blue-300 border-blue-700/30',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium
        border border-transparent transition-colors
        ${badgeVariants[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
