'use client';

import type { ReactNode } from 'react';

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface RadioGroupProps<T extends string> {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: RadioOption<T>[];
  label?: string;
  icon?: ReactNode;
}

export function RadioGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  label,
  icon,
}: RadioGroupProps<T>) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <span className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          {icon}
          {label}
        </span>
      )}
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-card border bg-background-surface px-4 py-3 text-sm transition-colors duration-150 ${
                selected
                  ? 'border-accent-gold text-accent-gold'
                  : 'border-border text-text-primary hover:border-accent-gold/60'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={selected}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.icon}
              <span className="font-medium">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
