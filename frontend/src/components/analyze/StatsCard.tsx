import { ReactNode } from 'react';

type StatsCardProps = {
  title: string;
  value: string;
  subtitle: string;
  subtitleTone?: 'default' | 'success';
  icon?: ReactNode;
};

export function StatsCard({ title, value, subtitle, subtitleTone = 'default', icon }: StatsCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--app-muted)]">{title}</p>
        {icon ? (
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-2 text-xs font-semibold text-[var(--app-muted)]">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-4xl font-semibold tracking-tight text-[var(--app-text)]">{value}</p>
      <p className={`mt-2 text-sm ${subtitleTone === 'success' ? 'font-medium text-emerald-400' : 'text-[var(--app-muted)]'}`}>
        {subtitle}
      </p>
    </article>
  );
}
