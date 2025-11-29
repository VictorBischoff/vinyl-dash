import { type ReactNode } from 'react';

interface Heading3Props {
  children: ReactNode;
  className?: string;
}

export function Heading3({ children, className = '' }: Heading3Props) {
  return (
    <h3 className={`text-heading3 font-semibold text-textPrimary ${className}`}>
      {children}
    </h3>
  );
}

