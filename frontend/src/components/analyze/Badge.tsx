import { cn } from '@/lib/utils';

type BadgeTone = 'neutral' | 'success' | 'green';

type AnalysisBadgeProps = {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-muted)]',
  success: 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  green: 'border border-green-400/30 bg-green-400/10 text-green-300',
};

export function AnalysisBadge({ children, tone = 'neutral', className }: AnalysisBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
