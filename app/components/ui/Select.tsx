import { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string
  children: React.ReactNode
}

export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        className="
          appearance-none bg-background border border-border rounded-md
          px-3 py-2 pr-8 text-sm text-foreground cursor-pointer
          transition-all duration-200 min-w-[120px]
          hover:bg-accent hover:border-ring
          focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
        "
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2 h-4 w-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}
