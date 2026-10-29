import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, AlertCircle } from 'lucide-react';
import { formatBytes } from '../../services/api';

interface FileDropzoneProps {
  accepts: string[];
  maxFiles: number;
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  accepts,
  maxFiles,
  onFilesSelected,
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndAddFiles = (fileList: FileList | File[]) => {
    setErrorMessage(null);
    const files = Array.from(fileList);
    if (!files.length) return;

    if (files.length > maxFiles) {
      setErrorMessage(`This tool accepts a maximum of ${maxFiles} file(s) at once.`);
      return;
    }

    // Check size limit: 50 MB
    const maxSizeBytes = 50 * 1024 * 1024;
    for (const file of files) {
      if (file.size > maxSizeBytes) {
        setErrorMessage(`"${file.name}" exceeds the maximum 50 MB upload limit.`);
        return;
      }
    }

    onFilesSelected(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const acceptString = accepts.join(',');

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 md:p-12 text-center transition-all duration-200 select-none ${
          isDragOver
            ? 'border-[#12151c] bg-[#c9f227]/10 scale-[1.005]'
            : 'border-[#cbd5e1] hover:border-[#12151c] bg-[#ffffff]'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={acceptString}
          onChange={(e) => e.target.files && validateAndAddFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-200 ${
              isDragOver ? 'scale-110 bg-[#12151c] text-[#c9f227]' : 'bg-[#f1f1ec] text-[#12151c]'
            }`}
          >
            <UploadCloud className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#12151c]">
              Drop your {maxFiles > 1 ? 'files' : 'document'} here, or{' '}
              <span className="text-[#12151c] underline decoration-[#c9f227] decoration-2 underline-offset-4">
                browse
              </span>
            </h3>
            <p className="text-xs text-[#64748b]">
              Supports {accepts.map((a) => a.replace('.', '').toUpperCase()).join(', ')} up to 50 MB
              {maxFiles > 1 ? ` · Up to ${maxFiles} files` : ''}
            </p>
          </div>

          <div className="pt-2 flex items-center gap-2 text-[11px] text-[#94a3b8]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10b981]" />
            <span>Encrypted in transit · Auto-wiped after 5 min</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-3 flex items-center gap-2 p-3 text-xs text-[#ef4444] bg-[#fef2f2] border border-[#fecaca] rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
