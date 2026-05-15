'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { ConfirmModal } from '@/components/chat/confirm-modal';
import { useTopToast } from '@/components/ui/top-toast';
import { deleteAccount, deleteAllCandidates, deleteAllJobs, updateProfile } from '@/lib/api';
import {
  clearStoredAuth,
  clearStoredChats,
  setProfileSetupRequired,
  getStoredUser,
  setStoredUser,
} from '@/lib/storage';

type ProfileTab = 'account' | 'memory';

type ProfileTabsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ProfileTabsModal({ isOpen, onClose }: ProfileTabsModalProps) {
  const router = useRouter();
  const { showToast } = useTopToast();
  const [activeTab, setActiveTab] = useState<ProfileTab>('account');
  const [isDeleteAccountConfirmOpen, setIsDeleteAccountConfirmOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [memoryAction, setMemoryAction] = useState<null | 'delete-candidates' | 'delete-jobs'>(null);
  const [isDeletingMemoryData, setIsDeletingMemoryData] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const user = getStoredUser();
  const email = user?.email || 'Email unavailable';

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(user?.full_name || '');
    setStatus(null);
  }, [isOpen, user?.full_name]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab('account');
      setIsDeleteAccountConfirmOpen(false);
      setMemoryAction(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSaveName = async () => {
    const nextName = name.trim();

    if (!nextName) {
      setStatus('Name is required.');
      return;
    }

    if (!user) {
      setStatus('Unable to update profile right now.');
      return;
    }

    try {
      setStatus(null);
      const isFirstTimeProfileSetup = !user.full_name || user.full_name.trim().length === 0;
      
      // Call API to save name to database
      const updatedUser = await updateProfile(nextName);
      
      // Update localStorage with the database response
      setStoredUser(updatedUser);
      setProfileSetupRequired(false);

      if (isFirstTimeProfileSetup) {
        showToast({
          message: `Welcome ${nextName} to HR Copilot`,
          tone: 'welcome',
          durationMs: 3600,
        });
        onClose();
        return;
      }

      setStatus('Name updated successfully.');
      showToast({
        message: `Profile updated for ${nextName}`,
        tone: 'success',
        durationMs: 2200,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to update profile.');
    }
  };

  const confirmDeleteAccount = async () => {
    if (isDeletingAccount) {
      return;
    }

    setIsDeletingAccount(true);
    setStatus(null);

    try {
      await deleteAccount();
      clearStoredChats();
      clearStoredAuth();
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('temp_dashboard_access');
      }

      setIsDeleteAccountConfirmOpen(false);
      onClose();
      router.replace('/login');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to delete account. Please try again.');
      setIsDeleteAccountConfirmOpen(false);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const confirmMemoryAction = async () => {
    if (!memoryAction || isDeletingMemoryData) {
      return;
    }

    setIsDeletingMemoryData(true);
    setStatus(null);

    try {
      if (memoryAction === 'delete-candidates') {
        const result = await deleteAllCandidates();
        setStatus(`Deleted ${result.deleted_candidates} candidates.`);
        showToast({
          message: `Deleted ${result.deleted_candidates} candidates`,
          tone: 'success',
          durationMs: 2200,
        });
      } else {
        const result = await deleteAllJobs();
        setStatus(`Deleted ${result.deleted_jobs} jobs.`);
        showToast({
          message: `Deleted ${result.deleted_jobs} jobs`,
          tone: 'success',
          durationMs: 2200,
        });
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to delete data.');
    } finally {
      setIsDeletingMemoryData(false);
      setMemoryAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-[700px] h-[500px] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] text-[var(--app-text)] shadow-xl flex overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--app-muted)] hover:text-[var(--app-text)]"
          aria-label="Close profile"
        >
          <X className="h-6 w-6" />
        </button>

        <aside className="w-48 bg-[var(--app-surface)] border-r border-[var(--app-border)] shadow-inner p-4 pt-6">
          <h2 className="text-[var(--app-text)] font-semibold mb-4 px-2">Profile</h2>
          <div className="flex flex-col gap-2 mt-4">
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className={`w-full text-left cursor-pointer ${
                activeTab === 'account'
                  ? 'bg-[var(--app-brand)] text-white shadow-sm rounded-lg px-4 py-2'
                  : 'text-[var(--app-muted)] hover:bg-[var(--app-surface-soft)] transition rounded-lg px-4 py-2'
              }`}
            >
              Account
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('memory')}
              className={`w-full text-left cursor-pointer ${
                activeTab === 'memory'
                  ? 'bg-[var(--app-brand)] text-white shadow-sm rounded-lg px-4 py-2'
                  : 'text-[var(--app-muted)] hover:bg-[var(--app-surface-soft)] transition rounded-lg px-4 py-2'
              }`}
            >
              Memory
            </button>
          </div>
        </aside>

        <section className="flex-1 p-6 bg-[var(--app-surface)] pt-16">
          <div className="relative h-full">
            <div
              className={`absolute inset-0 overflow-y-auto transition-opacity duration-200 ${
                activeTab === 'account' ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <div className="flex flex-col gap-6 text-left">
                <h3 className="text-xl font-semibold text-[var(--app-text)]">Account</h3>

                <div className="flex flex-col gap-2">
                  <label htmlFor="profile-name" className="text-sm text-[var(--app-muted)]">
                    Name
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="profile-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 py-2 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--app-focus)]"
                      placeholder="Firstname lastname like vice"
                    />
                    <button
                      type="button"
                      onClick={handleSaveName}
                      className="rounded-lg bg-[var(--app-brand)] px-4 py-2 text-white transition hover:opacity-95"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-[var(--app-muted)]">Email</label>
                  <p className="text-[var(--app-text)]">{email}</p>
                </div>

                {status ? <p className="text-sm text-[var(--app-muted)]">{status}</p> : null}

                <div className="mt-4 border-t pt-6">
                  <h3 className="text-sm font-semibold text-[var(--app-text)]">Delete account</h3>
                  <p className="mt-1 text-sm text-red-400">
                    Permanently remove your account and all data.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsDeleteAccountConfirmOpen(true)}
                    className="mt-3 rounded-lg border border-red-400/40 px-4 py-2 text-red-300 transition hover:bg-red-400/10"
                  >
                    Delete account
                  </button>
                </div>
              </div>
            </div>

            <div
              className={`absolute inset-0 overflow-y-auto transition-opacity duration-200 ${
                activeTab === 'memory' ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-[var(--app-text)]">Memory</h3>

                <div className="rounded-xl border border-red-400/20 bg-[var(--app-surface-elevated)] p-4">
                  <p className="text-base font-medium text-[var(--app-text)]">Delete Candidates</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Delete all candidates and their analysis data.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMemoryAction('delete-candidates')}
                    className="mt-3 rounded-lg border border-red-400/40 bg-[var(--app-surface)] px-4 py-2 text-red-300 hover:bg-red-400/10"
                  >
                    Delete all candidates
                  </button>
                </div>

                <div className="rounded-xl border border-red-400/20 bg-[var(--app-surface-elevated)] p-4">
                  <p className="text-base font-medium text-[var(--app-text)]">Delete Jobs</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Delete all jobs and related ranking data.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMemoryAction('delete-jobs')}
                    className="mt-3 rounded-lg border border-red-400/40 bg-[var(--app-surface)] px-4 py-2 text-red-300 hover:bg-red-400/10"
                  >
                    Delete all jobs
                  </button>
                </div>

                {status ? <p className="text-sm text-[var(--app-muted)]">{status}</p> : null}
              </div>
            </div>
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={isDeleteAccountConfirmOpen}
        onClose={() => setIsDeleteAccountConfirmOpen(false)}
        onConfirm={confirmDeleteAccount}
        title="Delete account?"
        message="Delete account and all local data? This action cannot be undone."
        confirmLabel="Delete account"
        confirmIcon={<Trash2 className="h-4 w-4" />}
      />

      <ConfirmModal
        isOpen={memoryAction !== null}
        onClose={() => {
          if (!isDeletingMemoryData) {
            setMemoryAction(null);
          }
        }}
        onConfirm={confirmMemoryAction}
        title={memoryAction === 'delete-jobs' ? 'Delete all jobs?' : 'Delete all candidates?'}
        message={
          memoryAction === 'delete-jobs'
            ? 'This will permanently remove all jobs and related analysis data.'
            : 'This will permanently remove all candidates and related analysis data.'
        }
        confirmLabel={isDeletingMemoryData ? 'Deleting...' : 'Delete now'}
        confirmIcon={<Trash2 className="h-4 w-4" />}
      />
    </div>
  );
}
