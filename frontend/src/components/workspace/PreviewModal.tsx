import React, { useState, useEffect } from 'react';
import { fetchPreview } from '../../services/api';
import { PreviewResponse } from '../../types';
import { X, ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from 'lucide-react';

interface PreviewModalProps {
  file: File | null;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ file, onClose }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    loadPage(0);
  }, [file]);

  const loadPage = async (pageIdx: number) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPreview(file, pageIdx, 700);
      setPreviewData(data);
      setCurrentPage(pageIdx);
    } catch (err: any) {
      setError(err.message || 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e3e3dc] bg-[#fbfbfa]">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#12151c] truncate">{file.name}</h3>
            {previewData && (
              <p className="text-[11px] text-[#64748b]">
                Page {previewData.current_page} of {previewData.total_pages}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#64748b] hover:text-[#12151c] hover:bg-[#f1f1ec] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Canvas */}
        <div className="flex-1 overflow-auto p-6 bg-[#f1f1ec] flex items-center justify-center min-h-[350px]">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-xs text-[#64748b]">
              <Loader2 className="w-6 h-6 animate-spin text-[#12151c]" />
              <span>Rendering page thumbnail...</span>
            </div>
          ) : error ? (
            <div className="text-xs text-[#ef4444] bg-[#fef2f2] p-4 rounded-xl border border-[#fecaca]">
              {error}
            </div>
          ) : previewData ? (
            <div className="relative shadow-lg border border-[#cbd5e1] rounded-sm bg-white overflow-hidden">
              <img
                src={previewData.image_base64}
                alt={`Page ${previewData.current_page}`}
                className="max-h-[60vh] object-contain"
              />
            </div>
          ) : null}
        </div>

        {/* Footer Navigation */}
        <div className="px-5 py-3 bg-[#ffffff] border-t border-[#e3e3dc] flex items-center justify-between text-xs text-[#64748b]">
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 0 || loading}
              onClick={() => loadPage(currentPage - 1)}
              className="p-1.5 rounded-lg border border-[#e3e3dc] hover:bg-[#f1f1ec] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-[11px]">
              {previewData ? `${currentPage + 1} / ${previewData.total_pages}` : '1 / 1'}
            </span>
            <button
              disabled={!previewData || currentPage >= previewData.total_pages - 1 || loading}
              onClick={() => loadPage(currentPage + 1)}
              className="p-1.5 rounded-lg border border-[#e3e3dc] hover:bg-[#f1f1ec] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#12151c] text-[#c9f227] hover:bg-[#1e2433]"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
