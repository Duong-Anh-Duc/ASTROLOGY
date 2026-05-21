'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, icon, error, hint, id, className = '', ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="flex items-center gap-2 text-sm font-medium text-text-secondary"
        >
          {icon}
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={`h-11 w-full rounded-card border border-border bg-background-surface px-3.5 text-sm text-text-primary placeholder:text-text-tertiary transition-colors duration-150 focus:border-accent-gold focus:outline-none ${
            error ? 'border-semantic-error' : ''
          } ${className}`}
          {...rest}
        />
      </div>
      {hint && !error && (
        <p className="text-xs text-text-tertiary">{hint}</p>
      )}
      {error && <p className="text-xs text-semantic-error">{error}</p>}
    </div>
  );
});
