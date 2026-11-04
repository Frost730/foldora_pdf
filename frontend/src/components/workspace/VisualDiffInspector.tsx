import React, { useState, useEffect } from 'react';
import { fetchPreview } from '../../services/api';
import { PreviewResponse } from '../../types';
import {
  GitCompare,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Sliders,
  Columns,
  ListFilter,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface PageDiffInfo {
  page: number;
  has_changes: boolean;
  additions: number;
  deletions: number;
  diff_lines?: string[];
}

interface VisualDiffInspectorProps {
  files?: File[];
  pageDiffs?: PageDiffInfo[];
  diffLines?: string[];
  additions?: number;
  deletions?: number;
  pageCount1?: number;
  pageCount2?: number;
  identical?: boolean;
}

type ViewMode = 'side-by-side' | 'slider' | 'diff-lines';

export const VisualDiffInspector: React.FC<VisualDiffInspectorProps> = ({
  files,
  pageDiffs = [],
  diffLines = [],
  additions = 0,
  deletions = 0,
  pageCount1 = 1,
  pageCount2 = 1,
  identical = false,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [sliderPos, setSliderPos] = useState<number>(50); // 0 to 100%
  const [zoom, setZoom] = useState<number>(100);

  // Previews for file 1 & file 2
  const [preview1, setPreview1] = useState<PreviewResponse | null>(null);
  const [preview2, setPreview2] = useState<PreviewResponse | null>(null);
  const [loading1, setLoading1] = useState<boolean>(false);
  const [loading2, setLoading2] = useState<boolean>(false);

  const maxPages = Math.max(pageCount1, pageCount2, pageDiffs.length || 1);

  // Fetch preview for current page if files are available
  useEffect(() => {
    if (files && files.length >= 2) {
      if (currentPage <= pageCount1) {
        setLoading1(true);
        fetchPreview(files[0], currentPage - 1, 900)
          .then((res) => {
            setPreview1(res);
            setLoading1(false);
          })
          .catch(() => setLoading1(false));
      } else {
        setPreview1(null);
      }

      if (currentPage <= pageCount2) {
        setLoading2(true);
        fetchPreview(files[1], currentPage - 1, 900)
          .then((res) => {
            setPreview2(res);
            setLoading2(false);
          })
          .catch(() => setLoading2(false));
      } else {
        setPreview2(null);
      }
    }
  }, [files, currentPage, pageCount1, pageCount2]);

  const currentPageDiff = pageDiffs.find((p) => p.page === currentPage);

  const jumpToNextChange = () => {
    const nextChanged = pageDiffs.find((p) => p.page > currentPage && p.has_changes);
    if (nextChanged) {
      setCurrentPage(nextChanged.page);
    } else {
      const firstChanged = pageDiffs.find((p) => p.has_changes);
      if (firstChanged) setCurrentPage(firstChanged.page);
    }
  };

  return (
    <div className="bg-[#12151c] text-white rounded-2xl border border-[#2b303c] overflow-hidden shadow-xl space-y-0">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-[#181d27] border-b border-[#2b303c] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#c9f227] text-[#12151c] flex items-center justify-center font-bold">
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">Visual PDF Diff & Compare Inspector</h4>
              {identical ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#10b981] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Identical
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fff1f2] text-[#f43f5e] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Differences Detected
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#94a3b8]">
              Comparing {files && files[0] ? files[0].name : 'Original'} vs{' '}
              {files && files[1] ? files[1].name : 'Modified'}
            </p>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-[#12151c] p-1 rounded-xl border border-[#2b303c] text-xs">
          <button
            type="button"
            onClick={() => setViewMode('side-by-side')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              viewMode === 'side-by-side' ? 'bg-[#c9f227] text-[#12151c] font-bold' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Side-by-Side</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('slider')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              viewMode === 'slider' ? 'bg-[#c9f227] text-[#12151c] font-bold' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Overlay Slider</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('diff-lines')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              viewMode === 'diff-lines' ? 'bg-[#c9f227] text-[#12151c] font-bold' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Line Diff</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-[#151922] border-b border-[#2b303c] text-xs">
        <div className="px-3 py-2 bg-[#1b2230] rounded-xl">
          <span className="text-[10px] text-[#94a3b8] uppercase font-mono block">Additions (+)</span>
          <span className="text-sm font-bold text-[#10b981]">+{additions} lines</span>
        </div>
        <div className="px-3 py-2 bg-[#1b2230] rounded-xl">
          <span className="text-[10px] text-[#94a3b8] uppercase font-mono block">Deletions (-)</span>
          <span className="text-sm font-bold text-[#ef4444]">-{deletions} lines</span>
        </div>
        <div className="px-3 py-2 bg-[#1b2230] rounded-xl">
          <span className="text-[10px] text-[#94a3b8] uppercase font-mono block">Pages Delta</span>
          <span className="text-sm font-bold text-[#c9f227]">
            {pageCount1} → {pageCount2} ({pageCount2 - pageCount1 >= 0 ? `+${pageCount2 - pageCount1}` : pageCount2 - pageCount1})
          </span>
        </div>
        <div className="px-3 py-2 bg-[#1b2230] rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#94a3b8] uppercase font-mono block">Active Page</span>
            <span className="text-xs font-semibold text-white">
              Page {currentPage} of {maxPages}
            </span>
          </div>
          {pageDiffs.some((p) => p.has_changes) && (
            <button
              type="button"
              onClick={jumpToNextChange}
              className="text-[10px] bg-[#2563eb] text-white px-2 py-1 rounded-lg hover:bg-[#1d4ed8] transition-colors"
            >
              Next Diff &rarr;
            </button>
          )}
        </div>
      </div>

      {/* Navigation Toolbar */}
      <div className="flex items-center justify-between p-3 bg-[#181d27] border-b border-[#2b303c] flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg bg-[#12151c] text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-[#252c3d] cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono px-2 text-[#94a3b8]">
            Page {currentPage} of {maxPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(maxPages, p + 1))}
            disabled={currentPage >= maxPages}
            className="p-1.5 rounded-lg bg-[#12151c] text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-[#252c3d] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {currentPageDiff && currentPageDiff.has_changes && (
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-[#fef2f2] text-[#ef4444]">
              Page Diff: +{currentPageDiff.additions} / -{currentPageDiff.deletions}
            </span>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            className="p-1.5 rounded-lg bg-[#12151c] text-white hover:bg-[#252c3d] cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono w-10 text-center text-[#94a3b8]">{zoom}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
            className="p-1.5 rounded-lg bg-[#12151c] text-white hover:bg-[#252c3d] cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(100)}
            className="p-1.5 rounded-lg bg-[#12151c] text-white hover:bg-[#252c3d] cursor-pointer"
            title="Reset zoom"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Comparison Canvas */}
      <div className="p-6 bg-[#0f1219] min-h-[460px] flex items-center justify-center overflow-auto">
        {viewMode === 'side-by-side' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
            {/* File 1: Original */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-[#94a3b8] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] inline-block" />
                  Original (Doc A)
                </span>
                <span className="text-[10px] font-mono text-[#64748b]">
                  {currentPage <= pageCount1 ? `Page ${currentPage}` : 'Page Not Present'}
                </span>
              </div>
              <div
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                className="bg-white rounded-xl shadow-lg border border-[#384152] min-h-[380px] flex items-center justify-center overflow-hidden transition-transform"
              >
                {loading1 ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#94a3b8]" />
                ) : preview1 ? (
                  <img
                    src={`data:image/png;base64,${preview1.image_base64}`}
                    alt="Original Document Page"
                    className="w-full h-auto object-contain"
                  />
                ) : (
                  <div className="p-8 text-center text-xs text-[#64748b]">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <span>No page rendered</span>
                  </div>
                )}
              </div>
            </div>

            {/* File 2: Modified */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-[#94a3b8] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] inline-block" />
                  Modified (Doc B)
                </span>
                <span className="text-[10px] font-mono text-[#64748b]">
                  {currentPage <= pageCount2 ? `Page ${currentPage}` : 'Page Not Present'}
                </span>
              </div>
              <div
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                className="bg-white rounded-xl shadow-lg border border-[#384152] min-h-[380px] flex items-center justify-center overflow-hidden transition-transform"
              >
                {loading2 ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#94a3b8]" />
                ) : preview2 ? (
                  <img
                    src={`data:image/png;base64,${preview2.image_base64}`}
                    alt="Modified Document Page"
                    className="w-full h-auto object-contain"
                  />
                ) : (
                  <div className="p-8 text-center text-xs text-[#64748b]">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <span>No page rendered</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'slider' && (
          <div className="flex flex-col items-center space-y-4 w-full max-w-2xl">
            {/* Slider bar */}
            <div className="w-full flex items-center justify-between text-xs px-2 text-[#94a3b8]">
              <span className="font-mono text-[#ef4444]">Original (0%)</span>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPos}
                onChange={(e) => setSliderPos(Number(e.target.value))}
                className="w-1/2 accent-[#c9f227] cursor-pointer"
              />
              <span className="font-mono text-[#10b981]">Modified (100%)</span>
            </div>

            {/* Split overlay viewport */}
            <div
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
              }}
              className="relative bg-white rounded-xl shadow-2xl border border-[#384152] overflow-hidden w-full max-w-md min-h-[400px] select-none"
            >
              {/* Underlying Doc A */}
              {preview1 && (
                <img
                  src={`data:image/png;base64,${preview1.image_base64}`}
                  alt="Original Overlay"
                  className="w-full h-auto object-contain block"
                />
              )}

              {/* Overlaid Doc B with clip path */}
              {preview2 && (
                <div
                  style={{
                    clipPath: `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)`,
                  }}
                  className="absolute inset-0 w-full h-full"
                >
                  <img
                    src={`data:image/png;base64,${preview2.image_base64}`}
                    alt="Modified Overlay"
                    className="w-full h-auto object-contain block"
                  />
                </div>
              )}

              {/* Visual divider line */}
              <div
                style={{ left: `${sliderPos}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-[#c9f227] shadow-md pointer-events-none"
              >
                <div className="absolute top-1/2 -translate-y-1/2 -left-3 w-6 h-6 rounded-full bg-[#c9f227] text-[#12151c] flex items-center justify-center shadow-lg text-[10px] font-bold">
                  &#x2194;
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'diff-lines' && (
          <div className="w-full max-w-4xl bg-[#181d27] border border-[#2b303c] rounded-xl p-4 text-xs font-mono space-y-1 max-h-[500px] overflow-y-auto">
            <div className="pb-2 border-b border-[#2b303c] text-[11px] text-[#94a3b8] flex justify-between">
              <span>UNIFIED LINE-BY-LINE DIFF</span>
              <span>{diffLines.length} difference items</span>
            </div>
            {diffLines.length === 0 ? (
              <p className="text-emerald-400 py-4 text-center">No textual differences found across compared files.</p>
            ) : (
              diffLines.map((line, idx) => {
                const isAdd = line.startsWith('+') && !line.startsWith('+++');
                const isDel = line.startsWith('-') && !line.startsWith('---');
                return (
                  <div
                    key={idx}
                    className={`px-2 py-0.5 rounded leading-relaxed break-all ${
                      isAdd
                        ? 'bg-[#10b981]/20 text-[#34d399]'
                        : isDel
                        ? 'bg-[#ef4444]/20 text-[#f87171]'
                        : 'text-[#94a3b8]'
                    }`}
                  >
                    {line}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
