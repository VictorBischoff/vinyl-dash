import { type ReactNode } from 'react';

interface BodyTextProps {
  children: ReactNode;
  className?: string;
}

export function BodyText({ children, className = '' }: BodyTextProps) {
  return (
    <p className={`text-body font-normal text-textPrimary ${className}`}>
      {children}
    </p>
  );
}

