'use client';

import { useState } from 'react';
import ResumeUploader from '@/components/resume-uploader';
import { Resume } from '@/types/resume';

export default function Home() {
  const [uploadedResumes, setUploadedResumes] = useState<Resume[]>([]);

  const handleUploadComplete = (resumes: Resume[]) => {
    setUploadedResumes((prev) => [...prev, ...resumes]);
  };

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Upload Resumes</h2>
          <ResumeUploader onUploadComplete={handleUploadComplete} />
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Screening Results</h2>
          {uploadedResumes.length > 0 ? (
            <div className="space-y-2">
              {uploadedResumes.map((resume, idx) => (
                <div key={idx} className="p-3 bg-gray-100 rounded">
                  <p className="font-medium">{resume.name}</p>
                  <p className="text-sm text-gray-600">Score: {resume.score || 'Pending'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No resumes uploaded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
