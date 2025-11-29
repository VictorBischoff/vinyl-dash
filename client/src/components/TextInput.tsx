import { type InputHTMLAttributes, type ReactNode } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function TextInput({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}: TextInputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const hasError = !!error;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-body font-medium text-textPrimary mb-xs"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        type="text"
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
          error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
        }
        {...props}
      />
      {error && (
        <p
          id={`${inputId}-error`}
          className="mt-xs text-caption text-textError"
          role="alert"
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="mt-xs text-caption text-textMuted">
          {helperText}
        </p>
      )}
    </div>
  );
}

