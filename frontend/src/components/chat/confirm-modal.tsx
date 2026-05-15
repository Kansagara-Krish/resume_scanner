'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { Trash2, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmIcon?: ReactNode;
  children?: ReactNode;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  confirmTone?: 'danger' | 'success' | 'info';
};

const ANIMATION_MS = 200;

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  confirmIcon,
  children,
  confirmDisabled = false,
  cancelDisabled = false,
  confirmTone = 'danger',
}: ConfirmModalProps) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
      return;
    }

    if (isRendered) {
      setIsClosing(true);
      const timer = window.setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, ANIMATION_MS);

      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [isOpen, isRendered]);

  useEffect(() => {
    if (!isRendered) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusables = getFocusableElements(dialogRef.current);
      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [isRendered, onClose]);

  const dialogStateClasses = (() => {
    const base = 'rounded-xl shadow-lg border border-[var(--app-border)] bg-[var(--app-surface-elevated)]';
    if (isOpen && !isClosing) {
      return `${base} opacity-100 scale-100`;
    }

    return `${base} opacity-0 scale-95`;
  })();

  if (!isRendered) {
    return null;
  }

  const resolvedConfirmIcon = confirmIcon === undefined ? <Trash2 className="h-4 w-4" /> : confirmIcon;

  const toneConfig = (() => {
    switch (confirmTone) {
      case 'success':
        return {
          ring: 'ring-emerald-300',
          border: 'border-emerald-400/30',
          bg: 'bg-emerald-400/10',
          text: 'text-emerald-300',
          icon: <Check className="h-5 w-5" />,
        };
      case 'info':
        return {
          ring: 'ring-sky-300',
          border: 'border-sky-400/30',
          bg: 'bg-sky-400/10',
          text: 'text-sky-300',
          icon: <MailIconFallback />,
        };
      case 'danger':
      default:
        return {
          ring: 'ring-red-300',
          border: 'border-red-400/30',
          bg: 'bg-red-400/10',
          text: 'text-red-300',
          icon: <AlertTriangle className="h-5 w-5" />,
        };
    }
  })();

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md px-4 transition-opacity duration-200 ease-out ${
        isOpen && !isClosing ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        className={`w-full max-w-[380px] ${dialogStateClasses} transform p-5 transition-all duration-200 ease-out`}
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneConfig.border} ${toneConfig.bg} ${toneConfig.text}`}>
              {toneConfig.icon}
            </div>
          <div className="min-w-0">
            <h2 id="confirm-modal-title" className="text-base font-semibold text-[var(--app-text)]">
              {title}
            </h2>
            <p id="confirm-modal-message" className="mt-1 text-sm text-[var(--app-muted)]">
              {message}
            </p>
          </div>
        </div>

        {children ? <div>{children}</div> : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button ref={cancelButtonRef} type="button" variant="secondary" onClick={onClose} className="rounded-xl" disabled={cancelDisabled}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl border ${toneConfig.border} bg-[var(--app-surface)] ${toneConfig.text} hover:${toneConfig.bg} focus-visible:${toneConfig.ring}`}
            disabled={confirmDisabled}
          >
            {resolvedConfirmIcon}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MailIconFallback() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}