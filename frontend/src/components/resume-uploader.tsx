'use client';

import { DragEvent, useMemo, useState } from 'react';
import { uploadResumes } from '@/lib/api';
import { ResumeUploadResponse } from '@/types/resume';
import { Paperclip, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ResumeUploaderProps {
  onUploadComplete: (resumes: ResumeUploadResponse[]) => void;
}

const CrazyLoader = () => (
  <div className="flex flex-col items-center justify-center space-y-4 py-8">
    <div className="relative h-16 w-16">
      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[var(--app-brand)] border-r-[var(--app-brand)] animate-spin" />
      <div className="absolute inset-2 rounded-full bg-[var(--app-brand)] opacity-20 animate-pulse" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-2 w-2 rounded-full bg-[var(--app-brand)] animate-pulse" />
      </div>
    </div>
    <div className="text-center">
      <p className="font-medium text-[var(--app-brand)]">Uploading resumes</p>
      <p className="text-sm text-[var(--app-muted)]">AI processing starts in the background after upload completes.</p>
      <p className="text-xs italic text-[var(--app-subtle)]">The page will update as resumes move into parsing and analysis</p>
    </div>
    <div className="flex gap-1">
      <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--app-brand)] animate-bounce-delay-0" />
      <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--app-brand)] animate-bounce-delay-200" />
      <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--app-brand)] animate-bounce-delay-400" />
    </div>
  </div>
);

export default function ResumeUploader({ onUploadComplete }: ResumeUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSizeMb = useMemo(() => {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    return (totalBytes / 1024 / 1024).toFixed(2);
  }, [files]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    setError(null);
  };

  const onDropFiles = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (loading) {
      return;
    }
    setIsDragActive(false);
    const droppedFiles = Array.from(event.dataTransfer.files || []);
    setFiles((prev) => [...prev, ...droppedFiles]);
    setError(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setLoading(true);
    setError(null);
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
      <label
        htmlFor="file-input"
        onDragOver={(event) => {
          event.preventDefault();
          if (!loading) {
            setIsDragActive(true);
          }
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={onDropFiles}
        className={`block rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragActive && !loading
            ? 'border-[var(--app-brand)] bg-[var(--app-brand-soft)]'
            : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-brand)] hover:bg-[var(--app-brand-soft)]'
        } ${loading ? 'pointer-events-none opacity-90' : ''}`}
      >
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt"
          onChange={handleFileChange}
          className="hidden"
          id="file-input"
          disabled={loading}
        />

        {loading ? (
          <CrazyLoader />
        ) : (
          <>
            <UploadCloud className="mx-auto h-8 w-8 text-[var(--app-subtle)]" />
            <p className="mt-2 font-display text-xl font-semibold">Drop resumes here</p>
            <p className="mt-2 text-sm text-[var(--app-muted)]">or click to browse local files</p>
            <p className="mt-1 text-xs text-[var(--app-subtle)]">Supported formats: PDF, DOC, DOCX, TXT</p>
          </>
        )}
      </label>

      {files.length > 0 && !loading && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">Selected files ({files.length})</p>
              <Badge variant="secondary">{totalSizeMb} MB</Badge>
            </div>
            <ul className="space-y-1">
              {files.map((file, idx) => (
                <li
                  key={`${file.name}-${idx}`}
                  className="flex items-center gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-2 text-sm"
                >
                  <Paperclip className="h-3.5 w-3.5 text-[var(--app-subtle)]" />
                  {file.name}{' '}
                  <span className="text-xs text-[var(--app-subtle)]">({(file.size / 1024).toFixed(1)} KB)</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-3 text-sm text-[var(--app-danger-text)]">
          {error}
        </div>
      )}

      <Button onClick={handleUpload} disabled={loading || files.length === 0} className="w-full">
        Upload Resumes 🚀
      </Button>
    </div>
  );
}
