import { type ReactNode } from 'react';

interface Heading2Props {
  children: ReactNode;
  className?: string;
}

export function Heading2({ children, className = '' }: Heading2Props) {
  return (
    <h2 className={`text-heading2 font-semibold text-textPrimary ${className}`}>
      {children}
    </h2>
  );
}

