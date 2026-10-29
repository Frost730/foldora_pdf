import React from 'react';
import { Loader2, XCircle } from 'lucide-react';

interface JobProgressProps {
  progress: number;
  message: string;
  onCancel?: () => void;
  canCancel?: boolean;
}

export const JobProgress: React.FC<JobProgressProps> = ({
  progress,
  message,
  onCancel,
  canCancel = true,
}) => {
  return (
    <div className="p-6 bg-white border border-[#e3e3dc] rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#12151c] animate-spin" />
          <div>
            <h4 className="text-sm font-bold text-[#12151c]">Processing Document</h4>
            <p className="text-xs text-[#64748b]">{message || 'Applying transformations...'}</p>
          </div>
        </div>

        <span className="text-sm font-black font-mono text-[#12151c]">{progress}%</span>
      </div>

      {/* Progress track */}
      <div className="w-full h-2.5 bg-[#f1f1ec] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#12151c] transition-all duration-300 ease-out rounded-full"
          style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
        />
      </div>

      {canCancel && onCancel && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#ef4444] transition-colors"
          >
            <XCircle className="w-4 h-4" />
            <span>Cancel Job</span>
          </button>
        </div>
      )}
    </div>
  );
};
