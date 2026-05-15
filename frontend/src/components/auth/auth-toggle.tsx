import { cn } from '@/lib/utils';

export type AuthMode = 'login' | 'signup';

type AuthToggleProps = {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
};

export function AuthToggle({ mode, onChange }: AuthToggleProps) {
  return (
    <div className="mb-5 grid grid-cols-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-1">
      <button
        type="button"
        onClick={() => onChange('login')}
        className={cn(
          'rounded-lg px-3 py-2 text-sm font-medium transition-all',
          mode === 'login' ? 'bg-[var(--app-surface-elevated)] text-[var(--app-text)] shadow-sm' : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
        )}
      >
        Log in
      </button>
      <button
        type="button"
        onClick={() => onChange('signup')}
        className={cn(
          'rounded-lg px-3 py-2 text-sm font-medium transition-all',
          mode === 'signup' ? 'bg-[var(--app-surface-elevated)] text-[var(--app-text)] shadow-sm' : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
        )}
      >
        Sign up
      </button>
    </div>
  );
}
