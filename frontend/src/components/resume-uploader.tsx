'use client';

import { useState } from 'react';
import { uploadResumes } from '@/lib/api';

interface ResumeUploaderProps {
  onUploadComplete: (resumes: any[]) => void;
}

export default function ResumeUploader({ onUploadComplete }: ResumeUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    setError(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setLoading(true);
    try {
      const results = await uploadResumes(files);
      onUploadComplete(results);
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt"
          onChange={handleFileChange}
          className="hidden"
          id="file-input"
        />
        <label htmlFor="file-input" className="cursor-pointer block">
          <p className="text-gray-600 mb-2">Drag and drop files here or click to browse</p>
          <p className="text-sm text-gray-500">Supported: PDF, DOC, DOCX, TXT</p>
        </label>
      </div>

      {files.length > 0 && (
        <div className="bg-blue-50 p-4 rounded">
          <p className="font-medium mb-2">Selected Files ({files.length}):</p>
          <ul className="list-disc pl-5 space-y-1">
            {files.map((file, idx) => (
              <li key={idx} className="text-sm text-gray-700">
                {file.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
          {error}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={loading || files.length === 0}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg"
      >
        {loading ? 'Uploading...' : 'Upload and Analyze'}
      </button>
    </div>
  );
}
