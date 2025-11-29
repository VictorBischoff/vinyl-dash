import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-surfaceElevated rounded-lg shadow-low p-md ${className}`}
    >
      {children}
    </div>
  );
}

