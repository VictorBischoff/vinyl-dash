import { type ReactNode } from 'react';

interface CaptionProps {
  children: ReactNode;
  className?: string;
}

export function Caption({ children, className = '' }: CaptionProps) {
  return (
    <span className={`text-caption font-normal text-textSecondary ${className}`}>
      {children}
    </span>
  );
}

