import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const uploadResumes = async (files: File[]) => {
  const formData = new FormData();
  
  files.forEach((file) => {
    formData.append('files', file);
  });

  try {
    const response = await axios.post(`${API_BASE_URL}/api/resumes/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const analyzeResumes = async (resumeIds: string[], jobDescription: string) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/analyze`, {
      resume_ids: resumeIds,
      job_description: jobDescription,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getCandidates = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/candidates`);
    return response.data;
  } catch (error) {
    throw error;
  }
};
