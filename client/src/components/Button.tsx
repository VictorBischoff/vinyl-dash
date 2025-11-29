import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses =
    'min-h-11 px-md rounded-md font-medium transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-focusRing focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

  const variantClasses = {
    primary:
      'bg-primary text-textOnPrimary hover:opacity-90 active:opacity-80 disabled:hover:opacity-60',
    secondary:
      'bg-surfaceDefault text-textPrimary border border-borderSubtle hover:bg-surfaceSubtle active:bg-surfaceSubtle disabled:hover:bg-surfaceDefault',
    tertiary:
      'bg-transparent text-textPrimary hover:bg-surfaceSubtle active:bg-surfaceSubtle disabled:hover:bg-transparent',
    destructive:
      'bg-destructive text-textOnPrimary hover:opacity-90 active:opacity-80 disabled:hover:opacity-60',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

