'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Plus, Search, Trash2, Sparkles } from 'lucide-react';
import { SKILLS, SkillLevel, SkillLevels } from '@/data/skills';
import { createSkillsBulk, deleteSkill, getSkills } from '@/lib/api';
import { useSuggestSkillsForRole } from '@/lib/hooks';
import { ConfirmModal } from '@/components/chat/confirm-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SkillLevelCard } from '@/components/job-roles/skill-level-card';
import { SkillAddModal } from '@/components/job-roles/skill-add-modal';
import { useTopToast } from '@/components/ui/top-toast';

export interface JobRoleSkill {
  name: string;
  level: number;
}

export interface JobRole {
  id: string;
  title: string;
  description: string;
  auto_select_enabled: boolean;
  auto_select_threshold: number;
  require_hr_confirmation: boolean;
  skills: JobRoleSkill[];
}

interface JobRoleFormProps {
  onCreateRole: (role: Omit<JobRole, 'id'>) => Promise<void> | void;
  isSubmitting?: boolean;
}

type SkillOption = {
  id: string;
  name: string;
};

type SuggestedSkill = {
  raw: string;
  label: string;
  canonical: string;
  category: string;
  confidence: number;
};

const CATEGORY_ORDER = ['Core Skills', 'Frameworks & Tools', 'Soft Skills', 'Optional Skills'] as const;

const SUGGESTED_LABEL_OVERRIDES: Array<[RegExp, string]> = [
  [/machine learning/i, 'Machine Learning'],
  [/deep learning/i, 'Deep Learning'],
  [/feature engineering/i, 'Feature Engineering'],
  [/data visualization/i, 'Data Visualization'],
  [/project management/i, 'Project Management'],
  [/technical writing/i, 'Technical Writing'],
  [/problem solving/i, 'Problem Solving'],
  [/soft skills/i, 'Soft Skills'],
  [/communication/i, 'Communication'],
  [/leadership/i, 'Leadership'],
  [/tensorflow/i, 'TensorFlow'],
  [/pytorch/i, 'PyTorch'],
  [/react/i, 'React'],
  [/aws/i, 'AWS'],
  [/kubernetes/i, 'Kubernetes'],
  [/docker/i, 'Docker'],
  [/sql/i, 'SQL'],
  [/excel/i, 'Excel'],
  [/presentation/i, 'Presentation'],
  [/stakeholder/i, 'Stakeholder Management'],
];

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/(machine learning|data analysis|statistics|project management|problem solving|communication|leadership|teamwork|collaboration|research)/i, 'Core Skills'],
  [/(tensorflow|pytorch|react|aws|azure|gcp|docker|kubernetes|sql|excel|figma|notion|jira|git|github)/i, 'Frameworks & Tools'],
  [/(leadership|communication|teamwork|collaboration|adaptability|presentation|empathy|time management|critical thinking|decision making)/i, 'Soft Skills'],
  [/(cloud|analytics|automation|agile|stakeholder|optional|certification|compliance|governance|strategy|business)/i, 'Optional Skills'],
];

const normalizeSuggestionLabel = (raw: string) => {
  const cleaned = raw
    .replace(/\(.*\)/g, '')
    .replace(/[^\w\s\-&]/g, '')
    .replace(/\b(and|&|,|\s+)+\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  for (const [pattern, label] of SUGGESTED_LABEL_OVERRIDES) {
    if (pattern.test(raw)) {
      return label;
    }
  }

  const words = cleaned.split(' ').filter(Boolean);
  if (words.length <= 3) {
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  const short = words.slice(0, 3).join(' ');
  return short
    .replace(/\b(learning|algorithms|frameworks|tools|systems|methodologies)\b/gi, '')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const inferSuggestionCategory = (label: string) => {
  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(label)) {
      return category;
    }
  }
  return 'Optional Skills';
};

const computeSuggestionConfidence = (label: string) => {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return 70 + (hash % 26);
};

export function JobRoleForm({ onCreateRole, isSubmitting = false }: JobRoleFormProps) {
  const { showToast } = useTopToast();
  const suggestSkillsMutation = useSuggestSkillsForRole();
  const GLOBAL_SKILLS_KEY = 'resume_scanner_global_custom_skills';
  const normalizeSkill = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const applySkillAlias = (value: string) => {
    if (value === 'excel' || value === 'ms excel') {
      return 'microsoft excel';
    }
    return value;
  };
  const canonicalSkill = (value: string) => applySkillAlias(normalizeSkill(value));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [autoSelectEnabled, setAutoSelectEnabled] = useState(false);
  const [autoSelectThreshold, setAutoSelectThreshold] = useState(70);
  const [requireHrConfirmation, setRequireHrConfirmation] = useState(true);
  const [skillLevels, setSkillLevels] = useState<SkillLevels>({});
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [dbSkills, setDbSkills] = useState<SkillOption[]>([]);
  const [hiddenSkills, setHiddenSkills] = useState<string[]>([]);
  const [pendingDeleteSkill, setPendingDeleteSkill] = useState<string | null>(null);
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [showAddedToast, setShowAddedToast] = useState(false);
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
  const [suggestedSkillItems, setSuggestedSkillItems] = useState<SuggestedSkill[]>([]);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);
  const [highlightedSkills, setHighlightedSkills] = useState<string[]>([]);
  const [aiLoadingText, setAiLoadingText] = useState('Analyzing role...');
  const skillsContainerRef = useRef<HTMLDivElement | null>(null);
  const submitting = isSubmitting || isSubmittingLocal;
  const isGeneratingSuggestions = suggestSkillsMutation.isPending;

  // Cycle through AI loading messages
  useEffect(() => {
    if (!isGeneratingSuggestions) {
      setAiLoadingText('Analyzing role...');
      return;
    }

    const messages = [
      'Analyzing role...',
      'Finding relevant skills...',
      'Matching industry trends...',
      'Generating AI suggestions...'
    ];
    let messageIndex = 0;

    const timer = window.setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setAiLoadingText(messages[messageIndex]);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [isGeneratingSuggestions]);

  const allSkills = Array.from(
    new Set([
      ...SKILLS.map((skill) => canonicalSkill(skill)),
      ...dbSkills.map((skill) => canonicalSkill(skill.name)),
      ...customSkills.map((skill) => canonicalSkill(skill)),
    ])
  ).filter((skill) => !hiddenSkills.map((item) => canonicalSkill(item)).includes(skill));

  useEffect(() => {
    const loadSkills = async () => {
      try {
        const skills = await getSkills();
        const items = Array.isArray(skills)
          ? skills
              .map((skill: { id?: string; name?: string }) => {
                const id = String(skill?.id || '').trim();
                const name = canonicalSkill(skill?.name || '');
                if (!id || !name) {
                  return null;
                }
                return { id, name } as SkillOption;
              })
              .filter((skill): skill is SkillOption => Boolean(skill))
          : [];
        const uniqueByName = new Map<string, SkillOption>();
        for (const item of items) {
          if (!uniqueByName.has(item.name)) {
            uniqueByName.set(item.name, item);
          }
        }
        setDbSkills(Array.from(uniqueByName.values()));
      } catch {
        // Keep defaults/local skills if backend list is unavailable.
      }
    };

    void loadSkills();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(GLOBAL_SKILLS_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed)) {
        return;
      }

      setCustomSkills(
        parsed
          .filter((item) => typeof item === 'string')
          .map((item) => canonicalSkill(item))
          .filter(Boolean)
      );
    } catch {
      // Ignore malformed local storage values.
    }
  }, []);

  useEffect(() => {
    if (!showAddedToast) {
      return;
    }

    const timer = window.setTimeout(() => setShowAddedToast(false), 1800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [showAddedToast]);

  const selectedCount = Object.values(skillLevels).filter((level) => level > 0).length;

  const suggestedSkillCategories = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: suggestedSkillItems.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0);
  }, [suggestedSkillItems]);

  const suggestedCount = suggestedSkillItems.length;
  const addAllDisabled = suggestedSkillItems.length === 0 || suggestedSkillItems.every((item) => skillLevels[item.canonical] > 0);

  const filteredSkills = (() => {
    const query = skillSearch.trim().toLowerCase();
    const selectedSet = new Set(
      Object.entries(skillLevels)
        .filter(([, level]) => level > 0)
        .map(([name]) => canonicalSkill(name))
    );

    const base = !query ? allSkills : allSkills.filter((skill) => skill.toLowerCase().includes(query));

    // Put selected skills first so HR sees them at the top
    return [...base].sort((a, b) => {
      const aSel = selectedSet.has(canonicalSkill(a)) ? 0 : 1;
      const bSel = selectedSet.has(canonicalSkill(b)) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      return a.localeCompare(b);
    });
  })();

  const handleSkillLevelChange = (skillName: string, level: SkillLevel) => {
    setSkillLevels((prev) => {
      const nextLevels = { ...prev, [skillName]: level };
      if (level === 0) {
        delete nextLevels[skillName];
      }
      return nextLevels;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    if (!normalizedTitle || !normalizedDescription) {
      return;
    }

    const skills: JobRoleSkill[] = Object.entries(skillLevels)
      .filter(([, level]) => level > 0)
      .map(([name, level]) => ({ name: canonicalSkill(name), level }));

    if (skills.length === 0) {
      showToast({
        message: 'Please select at least one skill.',
        tone: 'error',
      });
      return;
    }

    setIsSubmittingLocal(true);

    Promise.resolve(
      onCreateRole({
        title: normalizedTitle,
        description: normalizedDescription,
        auto_select_enabled: autoSelectEnabled,
        auto_select_threshold: Math.max(0, Math.min(100, Number(autoSelectThreshold) || 70)),
        require_hr_confirmation: requireHrConfirmation,
        skills,
      })
    )
      .then(() => {
        setTitle('');
        setDescription('');
        setSkillSearch('');
        setAutoSelectEnabled(false);
        setAutoSelectThreshold(70);
        setRequireHrConfirmation(true);
        setSkillLevels({});
        setShowAddSkillModal(false);
      })
      .finally(() => {
        setIsSubmittingLocal(false);
      });
  };

  const handleAddSkillFromModal = async ({
    names,
    level,
    makeGlobal,
  }: {
    names: string[];
    level: SkillLevel;
    makeGlobal: boolean;
  }) => {
    const nextNames = names
      .map((skill) => canonicalSkill(skill))
      .filter(Boolean)
      .filter((skill, index, arr) => arr.indexOf(skill) === index);

    if (nextNames.length === 0) {
      return;
    }

    try {
      await createSkillsBulk({
        skills: nextNames,
        level: level === 0 ? 'not_required' : level === 1 ? 'beginner' : level === 2 ? 'intermediate' : level === 3 ? 'advanced' : 'expert',
        global: makeGlobal,
      });

      setDbSkills((prev) => {
        const byName = new Map(prev.map((skill) => [canonicalSkill(skill.name), skill] as const));
        for (const name of nextNames) {
          if (!byName.has(name)) {
            byName.set(name, { id: `custom-${name.replace(/\s+/g, '-')}`, name });
          }
        }
        return Array.from(byName.values());
      });
    } catch {
      // Fall back to local-only behavior if API save fails.
    }

    setCustomSkills((prev) => {
      const next = Array.from(new Set([...prev, ...nextNames]));

      if (makeGlobal && typeof window !== 'undefined') {
        window.localStorage.setItem(GLOBAL_SKILLS_KEY, JSON.stringify(next));
      }

      return next;
    });

    setSkillLevels((prev) => {
      const next = { ...prev };
      for (const name of nextNames) {
        next[name] = level;
      }
      return next;
    });
    setSkillSearch(nextNames[nextNames.length - 1]);
    setShowAddSkillModal(false);
    setShowAddedToast(true);
    showToast({
      message: `${nextNames.length} skill${nextNames.length > 1 ? 's' : ''} added`,
      tone: 'success',
      durationMs: 2000,
    });
  };

  const handleScrollToBottom = () => {
    if (skillsContainerRef.current) {
      skillsContainerRef.current.scrollTo({
        top: skillsContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const handleScrollToTop = () => {
    if (skillsContainerRef.current) {
      skillsContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  const handleDeleteSkill = async () => {
    if (!pendingDeleteSkill) {
      return;
    }

    const deletingSkill = canonicalSkill(pendingDeleteSkill);
    const dbSkill = dbSkills.find((item) => canonicalSkill(item.name) === deletingSkill);

    try {
      if (dbSkill) {
        await deleteSkill(dbSkill.id);
      }
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : 'Failed to delete skill from database',
        tone: 'error',
      });
      setPendingDeleteSkill(null);
      return;
    }

    setHiddenSkills((prev) => Array.from(new Set([...prev, deletingSkill])));
    setCustomSkills((prev) => prev.filter((skill) => canonicalSkill(skill) !== deletingSkill));
    setDbSkills((prev) => prev.filter((item) => canonicalSkill(item.name) !== deletingSkill));
    setSkillLevels((prev) => {
      const next = { ...prev };
      delete next[deletingSkill];
      return next;
    });
    setPendingDeleteSkill(null);
    showToast({ message: 'Skill deleted', tone: 'success' });
  };

  const handleSuggestSkills = async () => {
    if (!title.trim()) {
      showToast({
        message: 'Please enter a role title first',
        tone: 'error',
        durationMs: 2000,
      });
      return;
    }

    try {
      const suggestions = await suggestSkillsMutation.mutateAsync({
        roleTitle: title.trim(),
        roleDescription: description.trim(),
      });

      if (suggestions && suggestions.length > 0) {
        const uniqueSuggestions = new Map<string, SuggestedSkill>();
        suggestions.filter(Boolean).forEach((raw) => {
          const label = normalizeSuggestionLabel(raw);
          const canonical = canonicalSkill(label);
          if (!canonical || uniqueSuggestions.has(canonical)) {
            return;
          }
          uniqueSuggestions.set(canonical, {
            raw,
            label,
            canonical,
            category: inferSuggestionCategory(label),
            confidence: computeSuggestionConfidence(label),
          });
        });
        const uniqueSuggestionItems = Array.from(uniqueSuggestions.values());
        setSuggestedSkillItems(uniqueSuggestionItems);
        setIsAiPanelOpen(true);
        showToast({
          message: `Generated ${uniqueSuggestionItems.length} skill suggestions`,
          tone: 'success',
          durationMs: 2000,
        });
      } else {
        setSuggestedSkillItems([]);
        showToast({
          message: 'No skill suggestions were generated. Please try again.',
          tone: 'error',
          durationMs: 2000,
        });
      }
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : 'Failed to suggest skills',
        tone: 'error',
        durationMs: 2500,
      });
    }
  };

  const handleAddAllSuggestedSkills = () => {
    const toAdd = suggestedSkillItems.filter((item) => !skillLevels[item.canonical]);
    if (toAdd.length === 0) {
      showToast({
        message: 'All suggested skills are already included.',
        tone: 'info',
        durationMs: 1800,
      });
      return;
    }

    setSkillLevels((prev) => {
      const next = { ...prev };
      toAdd.forEach((item) => {
        next[item.canonical] = 2;
      });
      return next;
    });
    setHighlightedSkills(toAdd.map((item) => item.canonical));
    window.setTimeout(() => setHighlightedSkills([]), 1200);
    setSkillSearch('');
    handleScrollToTop();
    showToast({
      message: `Added ${toAdd.length} suggested skill${toAdd.length > 1 ? 's' : ''}`,
      tone: 'success',
      durationMs: 2200,
    });
  };

  const handleAddSuggestedSkill = async (skillItem: SuggestedSkill) => {
    const canonical = skillItem.canonical;

    if (skillLevels[canonical]) {
      return;
    }

    setSkillLevels((prev) => ({
      ...prev,
      [canonical]: 2,
    }));

    if (!customSkills.includes(canonical)) {
      setCustomSkills((prev) => [...prev, canonical]);
    }

    setHighlightedSkills([canonical]);
    window.setTimeout(() => setHighlightedSkills([]), 1200);
    setSkillSearch('');
    handleScrollToTop();
    showToast({
      message: `Added ${skillItem.label} to role skills`,
      tone: 'success',
      durationMs: 2000,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-6 shadow-[var(--app-shadow-sm)]">
      <div className="grid gap-6">
        <div className="space-y-3">
          <label htmlFor="role-title" className="text-sm font-medium text-[var(--app-text)]">
            Role Title
          </label>
          <Input
            id="role-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Senior Backend Engineer"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="role-description" className="text-sm font-medium text-[var(--app-text)]">
            Role Description
          </label>
          <Textarea
            id="role-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Briefly describe the responsibilities of this role..."
            className="min-h-28"
            required
          />
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-[var(--app-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--app-text)]">Suggest role skills with AI</p>
            <p className="text-sm text-slate-500">Run AI after you add the job title and description.</p>
          </div>

          <div className="relative">
            <Button
              type="button"
              size="sm"
              onClick={handleSuggestSkills}
              disabled={!title.trim() || isGeneratingSuggestions || submitting}
              className={`transition-all duration-300 ease-in-out gap-2 h-9 ${
                isGeneratingSuggestions
                  ? 'bg-gradient-to-r from-[var(--app-brand-soft)] to-[rgba(37,99,235,0.08)] border border-[rgba(37,99,235,0.12)] text-[var(--app-brand)] shadow-sm scale-[1.02]'
                  : 'bg-[var(--app-surface-elevated)] border border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]'
              }`}
            >
              {isGeneratingSuggestions ? (
                <Sparkles className="h-4 w-4 star-glow" />
              ) : (
                <Sparkles className="h-4 w-4 text-[var(--app-brand)]" />
              )}
              <span className={isGeneratingSuggestions ? 'text-sm font-semibold text-[var(--app-text)]' : 'text-sm font-medium'}>
                {isGeneratingSuggestions ? aiLoadingText : 'Suggest Skills'}
              </span>
            </Button>

            {isGeneratingSuggestions && (
              <div className="absolute inset-0 rounded-md overflow-hidden pointer-events-none">
                <div
                  className="absolute inset-0 bg-[length:200%_100%] animate-[shimmer_2s_infinite] bg-[linear-gradient(90deg,transparent,rgba(37,99,235,0.08),transparent)]"
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface-elevated)] p-4 transition-shadow duration-200 hover:shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setIsAiPanelOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-[var(--app-surface-soft)] sm:w-auto"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--app-brand)]" />
                    <span className="text-sm font-semibold text-[var(--app-text)]">
                      AI Suggested Skills{suggestedCount > 0 ? ` (${suggestedCount})` : ''}
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--app-text)] transition-transform duration-200 ${isAiPanelOpen ? 'rotate-180' : 'rotate-0'}`}
                  />
                </button>
                <p className="mt-2 max-w-2xl text-sm text-[var(--app-muted)]">
                  AI suggestions are generated from the role title and description. Add them to your skill set with one click.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddAllSuggestedSkills}
                  disabled={addAllDisabled || submitting}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    addAllDisabled
                      ? 'cursor-not-allowed border border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-muted)]'
                      : 'border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-surface-soft)]'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Add All Suggested Skills
                </button>
                <button
                  type="button"
                  onClick={handleSuggestSkills}
                  disabled={!title.trim() || isGeneratingSuggestions || submitting}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-surface-soft)]"
                >
                  Regenerate
                </button>
              </div>
            </div>

            {isAiPanelOpen && (
              <div className="mt-4 space-y-4">
                {isGeneratingSuggestions ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-[var(--app-muted)]">
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--app-brand)]" />
                      <span>{aiLoadingText}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <div key={index} className="h-10 animate-pulse rounded-full bg-[var(--app-surface-soft)]" />
                      ))}
                    </div>
                  </div>
                ) : suggestedSkillItems.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-center">
                    <Sparkles className="mx-auto mb-3 h-8 w-8 text-[var(--app-brand)]" />
                    <p className="text-sm font-semibold text-[var(--app-text)]">✨ AI can suggest role-relevant skills based on job title and description.</p>
                    <p className="mt-2 text-sm text-[var(--app-muted)]">
                      Keep the role basics in place, then generate smart skill recommendations for the hiring process.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5 max-h-[340px] overflow-y-auto pr-2">
                    {suggestedSkillCategories.map((group) => (
                      <div key={group.category} className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--app-text)]">{group.category}</p>
                          <span className="rounded-full bg-[var(--app-surface-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--app-muted)]">
                            {group.items.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.items.map((item) => {
                            const isAdded = Boolean(skillLevels[item.canonical]);
                            return (
                              <button
                                key={item.canonical}
                                type="button"
                                onClick={() => handleAddSuggestedSkill(item)}
                                disabled={isAdded || submitting}
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                                  isAdded
                                    ? 'cursor-default border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-muted)]'
                                    : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[rgba(124,183,255,0.08)]'
                                } ${highlightedSkills.includes(item.canonical) ? 'ring-2 ring-[var(--app-brand)] ring-offset-2 ring-offset-[var(--app-surface-elevated)]' : ''}`}
                              >
                                <span>{item.label}</span>
                                {isAdded ? (
                                  <span className="rounded-full bg-[var(--app-surface-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--app-muted)]">
                                    Added
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--app-muted)]">
                                    <Plus className="h-3 w-3" />
                                    {item.confidence}%
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-display text-lg font-semibold text-[var(--app-text)]">Auto Selection Criteria</h3>

          <div className="mt-3 mb-4 flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-subtle)]" />
              <Input
                value={skillSearch}
                onChange={(event) => setSkillSearch(event.target.value)}
                placeholder="Search skills..."
                disabled={submitting}
                className="h-10 w-full rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] pl-12 pr-4 text-sm shadow-sm transition duration-200 focus-visible:ring-2 focus-visible:ring-[var(--app-brand)]"
              />
            </div>

            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
              <button
                type="button"
                onClick={() => {
                  setShowAddSkillModal(true);
                }}
                disabled={submitting}
                className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 py-1 text-xs font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-surface-soft)]"
              >
                + Add Skill
              </button>
              <span className="whitespace-nowrap rounded-full bg-[var(--app-surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--app-muted)]">
                {selectedCount} selected
              </span>
            </div>
          </div>

          {showAddedToast ? (
            <p className="slide-down-in rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
              Skill added successfully
            </p>
          ) : null}

          <div className="relative">
            <div ref={skillsContainerRef} className="max-h-[600px] overflow-y-auto pr-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              {filteredSkills.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSkills.map((skill) => (
                    <SkillLevelCard
                      key={skill}
                      skillName={skill}
                      value={(skillLevels[skill] || 0) as SkillLevel}
                      onChange={handleSkillLevelChange}
                      onRequestDelete={setPendingDeleteSkill}
                      highlighted={highlightedSkills.includes(canonicalSkill(skill))}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 py-8 text-center text-sm text-[var(--app-subtle)]">
                  No skills match &quot;{skillSearch}&quot;. Try a different search term.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleScrollToBottom}
              disabled={submitting}
              className="absolute bottom-2 right-2 rounded-lg bg-[var(--app-brand)] p-2 text-white shadow-lg transition duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)]"
              title="Scroll to bottom"
              aria-label="Scroll to bottom"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="h-11 w-full text-sm font-semibold disabled:bg-[var(--app-brand)] disabled:text-white disabled:opacity-90"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {submitting ? 'Processing...' : 'Create Job Role'}
        </Button>
      </div>

      <SkillAddModal
        isOpen={showAddSkillModal}
        onClose={() => setShowAddSkillModal(false)}
        onSubmit={handleAddSkillFromModal}
        existingSkills={allSkills}
      />

      <ConfirmModal
        isOpen={Boolean(pendingDeleteSkill)}
        onClose={() => setPendingDeleteSkill(null)}
        onConfirm={handleDeleteSkill}
        title="Delete skill?"
        message={`This will remove ${pendingDeleteSkill || 'this skill'} from the visible list.`}
        confirmLabel="Delete"
        confirmIcon={<Trash2 className="h-4 w-4" />}
      />

    </form>
  );
}
