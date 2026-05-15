import axios, { AxiosError } from 'axios';
import {
  AnalyzeRequest,
  AnalyzeResponse,
  AuthResponse,
  Candidate,
  CandidateEnrichmentPayload,
  CandidateEnrichmentResponse,
  CandidatePreviewPayload,
  CandidatePreviewResponse,
  CandidateSkillSuggestionPayload,
  CandidateSkillSuggestionResponse,
  GmailFetchResponse,
  GoogleLoginPayload,
  ResumeUploadResponse,
  User,
} from '@/types/resume';
import { clearStoredAuth, getStoredToken } from '@/lib/storage';

type CandidateFilters = {
  roleId?: string;
  shortlisted?: boolean;
};

export type ResumeProcessingStatus = 'uploaded' | 'processing' | 'analyzed' | 'failed';

export type ResumeStatusResponse = {
  resume_id: string;
  status: ResumeProcessingStatus;
  stage?: string | null;
  error_message?: string | null;
  processing_started_at?: string | null;
  processing_completed_at?: string | null;
};

export type ResumeResultResponse = {
  resume_id: string;
  status: ResumeProcessingStatus;
  stage?: string | null;
  candidate_score?: number | null;
  parsed_data?: Record<string, unknown>;
  error_message?: string | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const getApiClient = () => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 600000, // 10 minutes for AI processing
  });

  client.interceptors.request.use((config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401 && typeof window !== 'undefined') {
        const hasTempDashboardAccess = window.localStorage.getItem('temp_dashboard_access') === '1';

        if (!hasTempDashboardAccess) {
          clearStoredAuth();
          const next = encodeURIComponent(window.location.pathname || '/');
          if (!window.location.pathname.startsWith('/login')) {
            window.location.href = `/login?next=${next}`;
          }
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
};

const getErrorMessage = (error: unknown): string => {
  const fallback = 'Something went wrong. Please try again.';

  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const axiosError = error as AxiosError<any>;
  
  // Handle FastAPI validation errors (422 responses)
  if (axiosError.response?.data?.detail) {
    // If detail is an array (validation errors), format it
    if (Array.isArray(axiosError.response.data.detail)) {
      const errors = axiosError.response.data.detail
        .map((err: any) => {
          if (typeof err === 'string') return err;
          if (err.msg) return `${err.loc?.join('.') || 'Field'}: ${err.msg}`;
          return JSON.stringify(err);
        })
        .join('; ');
      return errors || fallback;
    }
    // If detail is a string, return it directly
    if (typeof axiosError.response.data.detail === 'string') {
      return axiosError.response.data.detail;
    }
  }
  
  return axiosError.message || fallback;
};

export const googleLogin = async (payload: GoogleLoginPayload): Promise<AuthResponse> => {
  try {
    const api = getApiClient();
    const response = await api.post<AuthResponse>('/api/auth/google/login', payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

const uploadSingleResume = async (file: File): Promise<ResumeUploadResponse> => {
  const api = getApiClient();
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<Record<string, unknown>>('/api/resumes/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const payload = response.data || {};

  return {
    id: String(payload.id ?? `${file.name}-${Date.now()}`),
    name: String(payload.name ?? payload.file_name ?? file.name),
    filename: String(payload.filename ?? payload.file_name ?? file.name),
    drive_id: String(payload.drive_id ?? ''),
  };
};

export const uploadResumes = async (
  files: File[],
  options?: { 
    onProgress?: (completed: number, total: number) => void;
    onFileStart?: (filename: string, index: number) => void;
  }
): Promise<ResumeUploadResponse[]> => {
  try {
    const results: ResumeUploadResponse[] = [];
    const total = files.length;

    // Process all files in parallel for maximum speed
    const uploadPromises = files.map(async (file, i) => {
      options?.onFileStart?.(file.name, i);
      const item = await uploadSingleResume(file);
      results.push(item);
      options?.onProgress?.(results.length, total);
      return item;
    });

    return await Promise.all(uploadPromises);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getResumeStatus = async (resumeId: string): Promise<ResumeStatusResponse> => {
  const api = getApiClient();
  const response = await api.get<ResumeStatusResponse>(`/api/resumes/status/${resumeId}`);
  return response.data;
};

export const getResumeResult = async (resumeId: string): Promise<ResumeResultResponse> => {
  const api = getApiClient();
  const response = await api.get<ResumeResultResponse>(`/api/resumes/result/${resumeId}`);
  return response.data;
};

export const waitForResumeProcessing = async (
  resumeIds: string[],
  options?: {
    pollIntervalMs?: number;
    timeoutMs?: number;
    onUpdate?: (statuses: ResumeStatusResponse[]) => void;
  }
): Promise<{ analyzedIds: string[]; failedIds: string[]; statuses: ResumeStatusResponse[] }> => {
  const ids = Array.from(new Set(resumeIds.filter((id) => id && id.trim().length > 0)));
  if (ids.length === 0) {
    return { analyzedIds: [], failedIds: [], statuses: [] };
  }

  const pollIntervalMs = Math.max(1000, options?.pollIntervalMs ?? 2500);
  const timeoutMs = Math.max(30000, options?.timeoutMs ?? 10 * 60 * 1000);
  const startedAt = Date.now();

  let lastStatuses: ResumeStatusResponse[] = [];
  while (Date.now() - startedAt < timeoutMs) {
    const statuses = await Promise.all(ids.map((id) => getResumeStatus(id)));
    lastStatuses = statuses;
    options?.onUpdate?.(statuses);

    const pending = statuses.filter((item) => item.status === 'uploaded' || item.status === 'processing');
    if (pending.length === 0) {
      const analyzedIds = statuses.filter((item) => item.status === 'analyzed').map((item) => item.resume_id);
      const failedIds = statuses.filter((item) => item.status === 'failed').map((item) => item.resume_id);
      return { analyzedIds, failedIds, statuses };
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const analyzedIds = lastStatuses.filter((item) => item.status === 'analyzed').map((item) => item.resume_id);
  const failedIds = lastStatuses
    .filter((item) => item.status !== 'analyzed')
    .map((item) => item.resume_id);
  return { analyzedIds, failedIds, statuses: lastStatuses };
};

export const analyzeJobDescription = async (payload: AnalyzeRequest): Promise<AnalyzeResponse> => {
  try {
    const api = getApiClient();
    const response = await api.post<AnalyzeResponse>('/api/analyze', payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getCandidates = async (filters?: CandidateFilters): Promise<Candidate[]> => {
  const params: Record<string, string> = {};
  if (filters?.roleId) {
    params.role_id = filters.roleId;
  }
  if (typeof filters?.shortlisted === 'boolean') {
    params.shortlisted = String(filters.shortlisted);
  }

  try {
    const api = getApiClient();
    const response = await api.get<Candidate[]>('/api/candidates/', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return response.data;
  } catch (error) {
    if (typeof window !== 'undefined') {
      try {
        const searchParams = new URLSearchParams();
        if (filters?.roleId) {
          searchParams.set('role_id', filters.roleId);
        }
        if (typeof filters?.shortlisted === 'boolean') {
          searchParams.set('shortlisted', String(filters.shortlisted));
        }
        const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
        const response = await fetch(`/api/db/candidates${query}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (response.ok) {
          return (await response.json()) as Candidate[];
        }
      } catch {
        // Ignore and return backend-originated error below.
      }
    }

    throw new Error(getErrorMessage(error));
  }
};

export const getCandidateById = async (candidateId: string): Promise<Candidate> => {
  try {
    const api = getApiClient();
    const response = await api.get<Candidate>(`/api/candidates/${candidateId}`);
    return response.data;
  } catch (error) {
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch(`/api/db/candidates/${candidateId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (response.ok) {
          return (await response.json()) as Candidate;
        }
      } catch {
        // Ignore and return backend-originated error below.
      }
    }

    throw new Error(getErrorMessage(error));
  }
};

export const enrichCandidateProfile = async (
  payload: CandidateEnrichmentPayload
): Promise<CandidateEnrichmentResponse> => {
  try {
    const api = getApiClient();
    const response = await api.post<CandidateEnrichmentResponse>('/api/candidate/enrich', payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const extractCandidatePreview = async (
  payload: CandidatePreviewPayload
): Promise<CandidatePreviewResponse> => {
  try {
    const api = getApiClient();
    const response = await api.post<CandidatePreviewResponse>('/api/candidate/preview/extract', payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const suggestCandidateSkills = async (
  payload: CandidateSkillSuggestionPayload
): Promise<CandidateSkillSuggestionResponse> => {
  try {
    const api = getApiClient();
    const response = await api.post<CandidateSkillSuggestionResponse>('/api/candidate/suggest/skills', payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteCandidate = async (candidateId: string): Promise<{ message: string }> => {
  try {
    const api = getApiClient();
    const response = await api.delete<{ message: string }>(`/api/candidates/${candidateId}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteCandidatesBulk = async (): Promise<{ message: string }> => {
  try {
    const api = getApiClient();
    const response = await api.delete<{ message: string }>('/api/candidates/bulk/delete');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const shortlistCandidate = async (
  candidateId: string,
  payload: { role_id: string; selection_type: 'select' | 'final_select'; send_selection_email?: boolean }
): Promise<any> => {
  try {
    const api = getApiClient();
    const response = await api.post(`/api/candidates/${candidateId}/shortlist`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const unshortlistCandidate = async (candidateId: string, roleId?: string): Promise<any> => {
  try {
    const api = getApiClient();
    const response = await api.delete(`/api/candidates/${candidateId}/shortlist`, {
      params: roleId ? { role_id: roleId } : undefined,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getMe = async (): Promise<User> => {
  const api = getApiClient();
  const response = await api.get('/api/users/me');
  return response.data;
};

export const updateProfile = async (fullName: string): Promise<User> => {
  try {
    const api = getApiClient();
    const response = await api.patch('/api/users/profile', { full_name: fullName });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteAccount = async (): Promise<void> => {
  const api = getApiClient();
  await api.delete('/api/users/account');
};

export const deleteAllCandidates = async (): Promise<{ message: string; deleted_candidates: number }> => {
  const api = getApiClient();
  const response = await api.delete('/api/users/memory/candidates');
  return response.data as { message: string; deleted_candidates: number };
};

export const deleteAllJobs = async (): Promise<{ message: string; deleted_jobs: number }> => {
  const api = getApiClient();
  const response = await api.delete('/api/users/memory/jobs');
  return response.data as { message: string; deleted_jobs: number };
};

// Skills API
export const getSkills = async (): Promise<any[]> => {
  const api = getApiClient();
  const response = await api.get('/api/skills');
  return response.data;
};

export const createSkill = async (skill: { name: string; category?: string; is_global?: boolean }): Promise<any> => {
  const api = getApiClient();
  const response = await api.post('/api/skills', skill);
  return response.data;
};

export const createSkillsBulk = async (payload: {
  skills: string[];
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'not_required';
  global: boolean;
}): Promise<any[]> => {
  const api = getApiClient();
  const response = await api.post('/api/skills/bulk', payload);
  return response.data;
};

export const deleteSkill = async (skillId: string): Promise<void> => {
  const api = getApiClient();
  await api.delete(`/api/skills/${skillId}`);
};

// Jobs API
export const getJobs = async (): Promise<any[]> => {
  try {
    const api = getApiClient();
    const response = await api.get('/api/jobs/');
    return response.data;
  } catch (error) {
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch('/api/db/jobs', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (response.ok) {
          return (await response.json()) as any[];
        }
      } catch {
        // Ignore and return backend-originated error below.
      }
    }

    throw new Error(getErrorMessage(error));
  }
};

export const getJobById = async (id: string): Promise<any> => {
  try {
    const api = getApiClient();
    const response = await api.get(`/api/jobs/${id}`);
    return response.data;
  } catch (error) {
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch(`/api/db/jobs/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (response.ok) {
          return (await response.json()) as any;
        }
      } catch {
        // Ignore and return backend-originated error below.
      }
    }

    throw new Error(getErrorMessage(error));
  }
};

export const createJob = async (job: {
  title: string;
  description?: string;
  auto_select_enabled?: boolean;
  auto_select_threshold?: number;
  require_hr_confirmation?: boolean;
  skills: any[];
}): Promise<any> => {
  if (typeof window !== 'undefined') {
    try {
      const proxyResponse = await fetch('/api/db/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(job),
      });

      if (proxyResponse.ok) {
        return (await proxyResponse.json()) as any;
      }

      const proxyPayload = (await proxyResponse.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(proxyPayload?.detail || 'Failed to create job role');
    } catch (proxyError) {
      // If proxy fetch itself fails (not an HTTP error), try direct backend as fallback.
      if (proxyError instanceof TypeError) {
        try {
          const api = getApiClient();
          const response = await api.post('/api/jobs', job);
          return response.data;
        } catch (error) {
          throw new Error(getErrorMessage(error));
        }
      }

      if (proxyError instanceof Error) {
        throw proxyError;
      }

      throw new Error('Failed to create job role');
    }
  }

  try {
    const api = getApiClient();
    const response = await api.post('/api/jobs', job);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateJob = async (
  id: string,
  job: {
    title?: string;
    description?: string;
    auto_select_enabled?: boolean;
    auto_select_threshold?: number;
    require_hr_confirmation?: boolean;
    skills: any[];
  }
): Promise<any> => {
  if (typeof window !== 'undefined') {
    try {
      const proxyResponse = await fetch(`/api/db/jobs/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(job),
      });

      if (proxyResponse.ok) {
        return (await proxyResponse.json()) as any;
      }

      const proxyPayload = (await proxyResponse.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(proxyPayload?.detail || 'Failed to update job role');
    } catch (proxyError) {
      if (proxyError instanceof TypeError) {
        try {
          const api = getApiClient();
          const response = await api.patch(`/api/jobs/${id}`, job);
          return response.data;
        } catch (error) {
          throw new Error(getErrorMessage(error));
        }
      }

      if (proxyError instanceof Error) {
        throw proxyError;
      }

      throw new Error('Failed to update job role');
    }
  }

  try {
    const api = getApiClient();
    const response = await api.patch(`/api/jobs/${id}`, job);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteJob = async (id: string): Promise<void> => {
  if (typeof window !== 'undefined') {
    try {
      const proxyResponse = await fetch(`/api/db/jobs/${id}`, {
        method: 'DELETE',
      });

      if (proxyResponse.ok) {
        return;
      }

      const proxyPayload = (await proxyResponse.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(proxyPayload?.detail || 'Failed to delete job role');
    } catch (proxyError) {
      if (proxyError instanceof TypeError) {
        try {
          const api = getApiClient();
          await api.delete(`/api/jobs/${id}`);
          return;
        } catch (error) {
          throw new Error(getErrorMessage(error));
        }
      }

      if (proxyError instanceof Error) {
        throw proxyError;
      }

      throw new Error('Failed to delete job role');
    }
  }

  try {
    const api = getApiClient();
    await api.delete(`/api/jobs/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const suggestSkillsForRole = async (roleTitle: string, roleDescription: string = ''): Promise<string[]> => {
  try {
    const api = getApiClient();
    const response = await api.post<string[]>('/api/jobs/suggest-skills', {
      role_title: roleTitle,
      role_description: roleDescription,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// Resumes API
export const getResumes = async (): Promise<any[]> => {
  const api = getApiClient();
  const response = await api.get('/api/resumes/');
  return response.data;
};

// Analysis API
export const getRecentAnalyses = async (): Promise<any[]> => {
  const api = getApiClient();
  const response = await api.get('/api/analysis/');
  return response.data;
};

export const runAnalysis = async (jobId: string): Promise<any> => {
  const api = getApiClient();
  const response = await api.post('/api/analysis/', { job_id: jobId, resume_ids: [] });
  return response.data;
};

export const runAnalysisForResumes = async (jobId: string, resumeIds: string[]): Promise<any[]> => {
  const api = getApiClient();
  const response = await api.post('/api/analysis/', { job_id: jobId, resume_ids: resumeIds });
  return response.data;
};

// AI analysis management (controls Ollama runtime)
export const getOllamaStatus = async (): Promise<{ running: boolean; managed: boolean }> => {
  const api = getApiClient();
  const response = await api.get('/api/ollama/status');
  return response.data;
};

export const startOllama = async (): Promise<{ started: boolean }> => {
  const api = getApiClient();
  const response = await api.post('/api/ollama/start');
  return response.data;
};

export const stopOllama = async (): Promise<{ stopped: boolean }> => {
  const api = getApiClient();
  const response = await api.post('/api/ollama/stop');
  return response.data;
};

export const getAnalysisForJob = async (jobId: string): Promise<any[]> => {
  const api = getApiClient();
  const response = await api.get('/api/analysis/', { params: { job_id: jobId } });
  return response.data;
};

export const getAnalysisResults = async (jobId?: string): Promise<any[]> => {
  const api = getApiClient();
  const response = await api.get('/api/analysis/results', {
    params: jobId ? { job_id: jobId } : undefined,
  });
  return response.data;
};

export const confirmAutoSelection = async (payload: { job_id: string; resume_ids?: string[] }): Promise<any> => {
  const api = getApiClient();
  const response = await api.post('/api/analysis/confirm-selection', payload);
  return response.data;
};

export const sendInterviewEmail = async (payload: {
  candidate_emails: string[];
  job_role: string;
  template: string;
  interview_datetime: string;
}): Promise<any> => {
  const api = getApiClient();
  const response = await api.post('/send-email', payload);
  return response.data;
};

export const getResumeById = async (id: string): Promise<any> => {
  const api = getApiClient();
  const response = await api.get(`/api/resumes/${id}`);
  return response.data;
};

export const fetchGmailResumes = async (): Promise<any> => {
  const api = getApiClient();
  const response = await api.post('/api/gmail/fetch');
  return response.data;
};

// Chat API
export const getChatHistory = async (): Promise<any> => {
  const api = getApiClient();
  const response = await api.get('/api/chat/history');
  return response.data;
};

export const createChat = async (title: string): Promise<any> => {
  const api = getApiClient();
  const response = await api.post('/api/chat/new', null, { params: { title } });
  return response.data;
};

export const deleteChat = async (id: string): Promise<void> => {
  const api = getApiClient();
  await api.delete(`/api/chat/${id}`);
};
