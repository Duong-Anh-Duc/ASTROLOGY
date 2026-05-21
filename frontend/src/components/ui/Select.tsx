'use client';

import {
  forwardRef,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  icon?: ReactNode;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      icon,
      options,
      error,
      placeholder,
      id,
      className = '',
      ...rest
    },
    ref,
  ) {
    const selectId = id ?? rest.name;
    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="flex items-center gap-2 text-sm font-medium text-text-secondary"
          >
            {icon}
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`h-11 w-full appearance-none rounded-card border border-border bg-background-surface px-3.5 text-sm text-text-primary transition-colors duration-150 focus:border-accent-gold focus:outline-none ${
            error ? 'border-semantic-error' : ''
          } ${className}`}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-semantic-error">{error}</p>}
      </div>
    );
  },
);
