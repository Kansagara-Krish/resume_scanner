import type { ReactNode } from 'react';
import { Bot } from 'lucide-react';

type AuthCardProps = {
  children: ReactNode;
};

export function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="w-full max-w-[400px] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-[0_24px_60px_-24px_rgba(2,6,23,0.45)] backdrop-blur-sm">
      <div className="mb-7 flex flex-col items-center text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] shadow-sm">
          <Bot className="h-6 w-6 text-[var(--app-text)]" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--app-text)]">Welcome to AI HR Copilot</h1>
        <p className="mt-2 text-sm text-[var(--app-muted)]">Sign in or create an account to continue</p>
      </div>
      {children}
    </div>
  );
}
