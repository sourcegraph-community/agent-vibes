import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode
  className?: string
  hoverable?: boolean
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

interface CardContentProps {
  children: ReactNode
  className?: string
}

interface CardTitleProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '', hoverable = false }: CardProps) {
  return (
    <div
      className={`
        card
        ${hoverable ? 'transition-all duration-200 hover:border-ring hover:shadow-md' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`card-header ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={`card-content ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <div className={`card-title ${className}`}>
      {children}
    </div>
  );
}
