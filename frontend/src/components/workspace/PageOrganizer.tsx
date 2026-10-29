import React, { useState, useEffect } from 'react';
import { fetchPreview } from '../../services/api';
import { RotateCw, Trash2, Copy, RotateCcw, Loader2 } from 'lucide-react';

interface PageItem {
  id: string;
  sourceIndex: number;
  rotation: number;
  thumbnailUrl?: string;
}

interface PageOrganizerProps {
  file: File;
  onChange: (pageOrder: { source_page: number; rotation: number }[]) => void;
}

export const PageOrganizer: React.FC<PageOrganizerProps> = ({ file, onChange }) => {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    loadThumbnails();
  }, [file]);

  const loadThumbnails = async () => {
    setLoading(true);
    try {
      // First fetch page 0 to get total page count
      const firstPage = await fetchPreview(file, 0, 300);
      const total = firstPage.total_pages;

      const initialPages: PageItem[] = Array.from({ length: total }, (_, i) => ({
        id: `page_${i}_${Date.now()}`,
        sourceIndex: i,
        rotation: 0,
        thumbnailUrl: i === 0 ? firstPage.image_base64 : undefined,
      }));

      setPages(initialPages);
      emitChange(initialPages);

      // Fetch thumbnails throttled with a cap to preserve memory
      const maxToLoad = Math.min(total, 12);
      for (let i = 1; i < maxToLoad; i++) {
        await new Promise((r) => setTimeout(r, 200));
        try {
          const p = await fetchPreview(file, i, 200);
          setPages((prev) =>
            prev.map((item) =>
              item.sourceIndex === i ? { ...item, thumbnailUrl: p.image_base64 } : item
            )
          );
        } catch {
          // Ignore thumbnail error
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const emitChange = (items: PageItem[]) => {
    onChange(
      items.map((it) => ({
        source_page: it.sourceIndex,
        rotation: it.rotation,
      }))
    );
  };

  const rotatePage = (idx: number) => {
    const updated = [...pages];
    updated[idx].rotation = (updated[idx].rotation + 90) % 360;
    setPages(updated);
    emitChange(updated);
  };

  const deletePage = (idx: number) => {
    if (pages.length <= 1) return;
    const updated = pages.filter((_, i) => i !== idx);
    setPages(updated);
    emitChange(updated);
  };

  const duplicatePage = (idx: number) => {
    const target = pages[idx];
    const clone: PageItem = {
      ...target,
      id: `clone_${target.sourceIndex}_${Date.now()}`,
    };
    const updated = [...pages];
    updated.splice(idx + 1, 0, clone);
    setPages(updated);
    emitChange(updated);
  };

  const resetAll = () => {
    loadThumbnails();
  };

  const handleDragStart = (idx: number) => {
    setDraggedIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent, overIdx: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === overIdx) return;
    const reordered = [...pages];
    const item = reordered.splice(draggedIndex, 1)[0];
    reordered.splice(overIdx, 0, item);
    setDraggedIndex(overIdx);
    setPages(reordered);
    emitChange(reordered);
  };

  if (loading) {
    return (
      <div className="p-8 text-center bg-white border border-[#e3e3dc] rounded-2xl flex flex-col items-center gap-2 text-xs text-[#64748b]">
        <Loader2 className="w-6 h-6 animate-spin text-[#12151c]" />
        <span>Loading document page thumbnails...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-[#64748b]">
        <span>
          <strong>{pages.length}</strong> pages (drag to reorder)
        </span>
        <button
          type="button"
          onClick={resetAll}
          className="flex items-center gap-1 text-[#12151c] hover:underline cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Order</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl max-h-[450px] overflow-y-auto">
        {pages.map((page, idx) => (
          <div
            key={page.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            className="group relative bg-white border border-[#cbd5e1] hover:border-[#12151c] rounded-xl p-2.5 flex flex-col items-center shadow-xs transition-all cursor-grab active:cursor-grabbing select-none"
          >
            {/* Page number badge */}
            <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-[#12151c] text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
              {idx + 1}
            </div>

            {/* Thumbnail Canvas */}
            <div className="w-full aspect-3/4 bg-[#f1f1ec] rounded-lg overflow-hidden flex items-center justify-center my-1 relative">
              {page.thumbnailUrl ? (
                <img
                  src={page.thumbnailUrl}
                  alt={`Page ${idx + 1}`}
                  style={{ transform: `rotate(${page.rotation}deg)` }}
                  className="max-h-full object-contain transition-transform duration-200"
                />
              ) : (
                <span className="text-[11px] text-[#94a3b8]">Page {page.sourceIndex + 1}</span>
              )}
            </div>

            {/* Quick Page Actions */}
            <div className="flex items-center justify-center gap-1.5 w-full pt-1.5 border-t border-[#f1f1ec]">
              <button
                type="button"
                onClick={() => rotatePage(idx)}
                className="p-1 text-[#64748b] hover:text-[#12151c] hover:bg-[#f1f1ec] rounded-md transition-colors"
                title="Rotate 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => duplicatePage(idx)}
                className="p-1 text-[#64748b] hover:text-[#12151c] hover:bg-[#f1f1ec] rounded-md transition-colors"
                title="Duplicate page"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                disabled={pages.length <= 1}
                onClick={() => deletePage(idx)}
                className="p-1 text-[#64748b] hover:text-[#ef4444] hover:bg-[#fef2f2] rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Delete page"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
