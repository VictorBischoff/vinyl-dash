import { type SelectHTMLAttributes, type ReactNode } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  children: ReactNode;
}

export function Select({
  label,
  error,
  helperText,
  children,
  className = '',
  id,
  ...props
}: SelectProps) {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  const hasError = !!error;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-body font-medium text-textPrimary mb-xs"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          w-full min-h-11 px-md py-sm
          text-body font-normal
          bg-surfaceDefault text-textPrimary
          border rounded-md
          focus:outline-none focus:ring-2 focus:ring-focusRing focus:ring-offset-2
          transition-colors duration-fast
          ${hasError ? 'border-destructive' : 'border-borderSubtle'}
          ${hasError ? 'focus:ring-destructive' : ''}
          ${className}
        `}
        aria-invalid={hasError}
        aria-describedby={
          error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined
        }
        {...props}
      >
        {children}
      </select>
      {error && (
        <p
          id={`${selectId}-error`}
          className="mt-xs text-caption text-textError"
          role="alert"
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${selectId}-helper`} className="mt-xs text-caption text-textMuted">
          {helperText}
        </p>
      )}
    </div>
  );
}

