import React from 'react';
import { FileText, Trash2, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { formatBytes } from '../../services/api';

interface FileListProps {
  files: File[];
  onRemove: (index: number) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  onPreview?: (file: File) => void;
  allowReorder?: boolean;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  onRemove,
  onMoveUp,
  onMoveDown,
  onPreview,
  allowReorder = false,
}) => {
  if (!files.length) return null;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-[#64748b] px-1">
        <span>Selected Files ({files.length})</span>
        {allowReorder && files.length > 1 && (
          <span className="text-[11px] text-[#94a3b8]">Use arrows to reorder document sequence</span>
        )}
      </div>

      <div className="space-y-2">
        {files.map((file, idx) => (
          <div
            key={`${file.name}-${idx}`}
            className="flex items-center justify-between p-3 bg-[#ffffff] border border-[#e3e3dc] rounded-xl shadow-xs transition-all hover:border-[#cbd5e1]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#f1f1ec] text-[#12151c] flex items-center justify-center shrink-0 font-bold text-xs">
                {idx + 1}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#12151c] truncate">{file.name}</p>
                <p className="text-[11px] text-[#64748b]">{formatBytes(file.size)}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onPreview && file.name.toLowerCase().endsWith('.pdf') && (
                <button
                  type="button"
                  onClick={() => onPreview(file)}
                  className="p-1.5 text-[#64748b] hover:text-[#12151c] hover:bg-[#f1f1ec] rounded-lg transition-colors cursor-pointer"
                  title="Preview document"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}

              {allowReorder && onMoveUp && idx > 0 && (
                <button
                  type="button"
                  onClick={() => onMoveUp(idx)}
                  className="p-1.5 text-[#64748b] hover:text-[#12151c] hover:bg-[#f1f1ec] rounded-lg transition-colors cursor-pointer"
                  title="Move up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              )}

              {allowReorder && onMoveDown && idx < files.length - 1 && (
                <button
                  type="button"
                  onClick={() => onMoveDown(idx)}
                  className="p-1.5 text-[#64748b] hover:text-[#12151c] hover:bg-[#f1f1ec] rounded-lg transition-colors cursor-pointer"
                  title="Move down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="p-1.5 text-[#64748b] hover:text-[#ef4444] hover:bg-[#fef2f2] rounded-lg transition-colors cursor-pointer"
                title="Remove file"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
