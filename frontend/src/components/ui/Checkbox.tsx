'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

interface CheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export function Checkbox({
  id,
  checked,
  onChange,
  label,
  description,
  icon,
  disabled,
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-card border bg-background-surface p-4 transition-colors duration-150 ${
        checked
          ? 'border-accent-gold'
          : 'border-border hover:border-accent-gold/60'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only"
      />
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 ${
          checked
            ? 'border-accent-gold bg-accent-gold'
            : 'border-border bg-background-elevated'
        }`}
      >
        {checked && <Check size={14} className="text-background" />}
      </span>

      <span className="flex flex-1 items-start gap-3">
        {icon && (
          <span className="mt-0.5 text-accent-gold" aria-hidden>
            {icon}
          </span>
        )}
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-text-primary">
            {label}
          </span>
          {description && (
            <span className="text-xs text-text-tertiary">{description}</span>
          )}
        </span>
      </span>
    </label>
  );
}
