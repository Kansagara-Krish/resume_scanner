import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function InputField({ label, className, id, ...props }: InputFieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--app-text)]">{label}</span>
      <input
        id={id}
        className={cn(
          'h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 text-sm text-[var(--app-text)] placeholder:text-[var(--app-subtle)]',
          'outline-none ring-0 transition focus:border-[var(--app-brand)] focus:shadow-[0_0_0_4px_rgba(96,165,250,0.15)]',
          className
        )}
        {...props}
      />
    </label>
  );
}
