import React from 'react';
import { Sparkles, AlertCircle, Trash2, FileOutput, Edit3, Type, Crop, Highlighter, Underline, Globe, Table } from 'lucide-react';

interface ToolOptionsFormProps {
  toolId: string;
  options: Record<string, any>;
  onChange: (options: Record<string, any>) => void;
  pageCount?: number;
}

const parsePagesString = (str: string): Set<number> => {
  const result = new Set<number>();
  if (!str) return result;
  const parts = str.split(',').map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map((s) => parseInt(s.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          result.add(i);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num)) result.add(num);
    }
  }
  return result;
};

const formatPagesSet = (pages: Set<number>): string => {
  const sorted = Array.from(pages).sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(', ');
};

export const ToolOptionsForm: React.FC<ToolOptionsFormProps> = ({
  toolId,
  options,
  onChange,
  pageCount,
}) => {
  const updateOption = (key: string, value: any) => {
    onChange({ ...options, [key]: value });
  };

  // 1. Remove Pages
  if (toolId === 'remove-pages') {
    const pagesVal = options.pages_to_remove || '';
    const selectedPages = parsePagesString(pagesVal);

    const togglePage = (p: number) => {
      const next = new Set(selectedPages);
      if (next.has(p)) {
        next.delete(p);
      } else {
        next.add(p);
      }
      updateOption('pages_to_remove', formatPagesSet(next));
    };

    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-[#12151c] flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5 text-[#ef4444]" />
              <span>Select Pages to Remove</span>
            </label>
            {pageCount ? (
              <span className="text-[11px] font-mono text-[#64748b] bg-[#f1f1ec] px-2 py-0.5 rounded-md">
                Total Document Pages: <strong>{pageCount}</strong>
              </span>
            ) : null}
          </div>

          <input
            type="text"
            value={pagesVal}
            onChange={(e) => updateOption('pages_to_remove', e.target.value)}
            placeholder="e.g. 1, 3, 5-8"
            className="w-full px-3.5 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c] focus:ring-1 focus:ring-[#12151c]"
          />
          <p className="text-[11px] text-[#64748b] mt-1">
            Enter page numbers and ranges separated by commas (e.g. <code className="bg-[#f1f1ec] px-1 rounded">2, 4-6</code>), or click page numbers below.
          </p>
        </div>

        {/* Visual Clickable Page Selector */}
        {pageCount && pageCount > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-[#64748b]">
                Click pages to toggle removal:
              </label>
              <span className="text-[10px] text-[#ef4444] font-medium">
                {selectedPages.size} of {pageCount} marked for removal
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border border-[#e3e3dc] rounded-xl bg-[#fafaf8]">
              {Array.from({ length: Math.min(pageCount, 100) }, (_, i) => i + 1).map((num) => {
                const isSelected = selectedPages.has(num);
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => togglePage(num)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#ef4444] text-white shadow-xs scale-105 ring-2 ring-[#ef4444]/30'
                        : 'bg-white border border-[#e3e3dc] text-[#12151c] hover:bg-[#fee2e2] hover:border-[#fca5a5]'
                    }`}
                    title={isSelected ? `Page ${num} (will be removed)` : `Click to remove page ${num}`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick helper preset buttons */}
        <div>
          <label className="block text-[11px] font-semibold text-[#64748b] mb-1.5">Quick Presets</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => updateOption('pages_to_remove', '1')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-[#e3e3dc] bg-white hover:bg-[#f1f1ec] text-[#475569] transition-colors cursor-pointer"
            >
              First Page
            </button>
            {pageCount && (
              <button
                type="button"
                onClick={() => updateOption('pages_to_remove', String(pageCount))}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-[#e3e3dc] bg-white hover:bg-[#f1f1ec] text-[#475569] transition-colors cursor-pointer"
              >
                Last Page ({pageCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const max = pageCount || 20;
                const odds = Array.from({ length: max }, (_, i) => i + 1).filter(p => p % 2 !== 0).join(', ');
                updateOption('pages_to_remove', odds);
              }}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-[#e3e3dc] bg-white hover:bg-[#f1f1ec] text-[#475569] transition-colors cursor-pointer"
            >
              Odd Pages
            </button>
            <button
              type="button"
              onClick={() => {
                const max = pageCount || 20;
                const evens = Array.from({ length: max }, (_, i) => i + 1).filter(p => p % 2 === 0).join(', ');
                updateOption('pages_to_remove', evens);
              }}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-[#e3e3dc] bg-white hover:bg-[#f1f1ec] text-[#475569] transition-colors cursor-pointer"
            >
              Even Pages
            </button>
            <button
              type="button"
              onClick={() => updateOption('pages_to_remove', '')}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-[#e3e3dc] bg-white hover:bg-[#f1f1ec] text-[#64748b] transition-colors cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs text-[#991b1b] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            The selected pages will be deleted and the remaining document will be generated as a new download.
          </span>
        </div>
      </div>
    );
  }

  // 2. Extract Pages
  if (toolId === 'extract-pages') {
    const pagesVal = options.pages || '1';
    const asSingle = options.as_single_file !== false;
    const selectedPages = parsePagesString(pagesVal);

    const toggleExtractPage = (p: number) => {
      const next = new Set(selectedPages);
      if (next.has(p)) {
        next.delete(p);
      } else {
        next.add(p);
      }
      updateOption('pages', formatPagesSet(next));
    };

    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-[#12151c] flex items-center gap-1.5">
              <FileOutput className="w-3.5 h-3.5 text-[#2563eb]" />
              <span>Pages to Extract</span>
            </label>
            {pageCount ? (
              <span className="text-[11px] font-mono text-[#64748b] bg-[#f1f1ec] px-2 py-0.5 rounded-md">
                Total Pages: <strong>{pageCount}</strong>
              </span>
            ) : null}
          </div>
          <input
            type="text"
            value={pagesVal}
            onChange={(e) => updateOption('pages', e.target.value)}
            placeholder="e.g. 1-3, 5"
            className="w-full px-3.5 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
          />
          <p className="text-[11px] text-[#64748b] mt-1">
            Specify page numbers and ranges to keep (e.g. <code className="bg-[#f1f1ec] px-1 rounded">1-5, 8, 11-12</code>), or click page numbers below.
          </p>
        </div>

        {/* Visual Clickable Page Selector */}
        {pageCount && pageCount > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-[#64748b]">
                Click pages to toggle extraction:
              </label>
              <span className="text-[10px] text-[#2563eb] font-medium">
                {selectedPages.size} of {pageCount} selected for extraction
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border border-[#e3e3dc] rounded-xl bg-[#fafaf8]">
              {Array.from({ length: Math.min(pageCount, 100) }, (_, i) => i + 1).map((num) => {
                const isSelected = selectedPages.has(num);
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => toggleExtractPage(num)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#2563eb] text-white shadow-xs scale-105 ring-2 ring-[#2563eb]/30'
                        : 'bg-white border border-[#e3e3dc] text-[#12151c] hover:bg-[#eff6ff] hover:border-[#93c5fd]'
                    }`}
                    title={isSelected ? `Page ${num} (selected)` : `Click to extract page ${num}`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#12151c] mb-2">Extraction Output Mode</label>
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => updateOption('as_single_file', true)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                asSingle
                  ? 'border-[#12151c] bg-[#12151c] text-white shadow-xs'
                  : 'border-[#e3e3dc] bg-white text-[#12151c] hover:bg-[#f8fafc]'
              }`}
            >
              <div className="text-xs font-bold mb-0.5">One Merged PDF</div>
              <div className={`text-[11px] ${asSingle ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
                Combines extracted pages into a single PDF document.
              </div>
            </div>

            <div
              onClick={() => updateOption('as_single_file', false)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                !asSingle
                  ? 'border-[#12151c] bg-[#12151c] text-white shadow-xs'
                  : 'border-[#e3e3dc] bg-white text-[#12151c] hover:bg-[#f8fafc]'
              }`}
            >
              <div className="text-xs font-bold mb-0.5">Separate Files (ZIP)</div>
              <div className={`text-[11px] ${!asSingle ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
                Exports each selected page as an individual PDF in a ZIP bundle.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Edit Text in PDF (Find & Replace in-place)
  if (toolId === 'edit-text' || toolId === 'edit-pdf') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-[#12151c] mb-1">
              Find Text in Document
            </label>
            <input
              type="text"
              value={options.find_text || ''}
              onChange={(e) => updateOption('find_text', e.target.value)}
              placeholder="e.g. 2023 or Old Company Name"
              className="w-full px-3.5 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#12151c] mb-1">
              Replace With New Text
            </label>
            <input
              type="text"
              value={options.replace_text || ''}
              onChange={(e) => updateOption('replace_text', e.target.value)}
              placeholder="e.g. 2026 or Foldora Technologies"
              className="w-full px-3.5 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">
              Pages to Target (optional, leave blank for all pages)
            </label>
            <input
              type="text"
              value={options.pages || ''}
              onChange={(e) => updateOption('pages', e.target.value)}
              placeholder="e.g. 1, 3 or leave blank for all"
              className="w-full px-3.5 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={options.color || '#111827'}
                onChange={(e) => updateOption('color', e.target.value)}
                className="w-9 h-9 rounded-lg border border-[#e3e3dc] cursor-pointer"
              />
              <span className="text-xs font-mono text-[#64748b]">{options.color || '#111827'}</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-[#64748b]">
          Searches all matching occurrences in the document and performs byte-level in-place replacement while preserving page layouts.
        </p>
      </div>
    );
  }

  // 4. Add Text to PDF
  if (toolId === 'add-text') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#12151c] mb-1">Text to Add</label>
          <input
            type="text"
            value={options.text || 'Sample Text'}
            onChange={(e) => updateOption('text', e.target.value)}
            placeholder="Type your text here..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">Target Page</label>
            <input
              type="number"
              min="1"
              max={pageCount || 999}
              value={options.page || 1}
              onChange={(e) => updateOption('page', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">Font Size (pt)</label>
            <input
              type="number"
              min="6"
              max="72"
              value={options.font_size || 14}
              onChange={(e) => updateOption('font_size', parseFloat(e.target.value) || 14)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">X Position (pt)</label>
            <input
              type="number"
              value={options.x || 72}
              onChange={(e) => updateOption('x', parseFloat(e.target.value) || 72)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">Y Position (pt)</label>
            <input
              type="number"
              value={options.y || 100}
              onChange={(e) => updateOption('y', parseFloat(e.target.value) || 100)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            />
          </div>
        </div>
      </div>
    );
  }

  // 5. Split PDF
  if (toolId === 'split-pdf') {
    const mode = options.mode || 'ranges';
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#12151c] mb-2">Split Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'ranges', label: 'Custom Ranges' },
              { id: 'each_page', label: 'Every Page' },
              { id: 'fixed_count', label: 'By Page Count' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => updateOption('mode', m.id)}
                className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all ${
                  mode === m.id
                    ? 'border-[#12151c] bg-[#12151c] text-[#c9f227]'
                    : 'border-[#e3e3dc] bg-white text-[#475569] hover:bg-[#f1f1ec]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {mode === 'ranges' && (
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">
              Page Ranges (e.g. 1-3, 5, 8-10)
            </label>
            <input
              type="text"
              value={options.ranges || '1'}
              onChange={(e) => updateOption('ranges', e.target.value)}
              placeholder="e.g. 1-3, 5"
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
            />
            <p className="text-[11px] text-[#64748b] mt-1">Separate multiple independent output ranges with a semicolon (;)</p>
          </div>
        )}

        {mode === 'fixed_count' && (
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">
              Pages Per Document
            </label>
            <input
              type="number"
              min="1"
              value={options.pages_per_doc || 2}
              onChange={(e) => updateOption('pages_per_doc', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
            />
          </div>
        )}
      </div>
    );
  }

  // 6. Compress PDF
  if (toolId === 'compress-pdf') {
    const preset = options.preset || 'recommended';
    return (
      <div className="space-y-4">
        <label className="block text-xs font-semibold text-[#12151c]">Compression Preset</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              id: 'low',
              title: 'Light Compression',
              sub: 'Best visual fidelity, light size reduction (~20%)',
            },
            {
              id: 'recommended',
              title: 'Recommended',
              sub: 'Ideal balance of sharp quality and strong reduction (~50%)',
            },
            {
              id: 'high',
              title: 'Maximum Compression',
              sub: 'Aggressive compression, smaller file for emails (~70%)',
            },
          ].map((item) => (
            <div
              key={item.id}
              onClick={() => updateOption('preset', item.id)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                preset === item.id
                  ? 'border-[#12151c] bg-[#12151c] text-white shadow-xs'
                  : 'border-[#e3e3dc] bg-white text-[#12151c] hover:bg-[#f8fafc]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">{item.title}</span>
                {item.id === 'recommended' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    preset === item.id ? 'bg-[#222733] text-[#c9f227]' : 'bg-[#c9f227]/30 text-[#12151c]'
                  }`}>
                    RECOMMENDED
                  </span>
                )}
              </div>
              <p className={`text-[11px] leading-relaxed ${preset === item.id ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
                {item.sub}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 7. Rotate PDF
  if (toolId === 'rotate-pdf') {
    const angle = options.angle !== undefined ? options.angle : 90;
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#12151c] mb-2">Rotation Angle</label>
          <div className="grid grid-cols-3 gap-2">
            {[90, 180, 270].map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => updateOption('angle', deg)}
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                  angle === deg
                    ? 'border-[#12151c] bg-[#12151c] text-[#c9f227]'
                    : 'border-[#e3e3dc] bg-white text-[#475569] hover:bg-[#f1f1ec]'
                }`}
              >
                {deg}° Clockwise
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#12151c] mb-1">
            Target Pages (optional, leave blank for all pages)
          </label>
          <input
            type="text"
            value={options.pages || ''}
            onChange={(e) => updateOption('pages', e.target.value)}
            placeholder="e.g. 1, 3, 5-7 or leave blank"
            className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
          />
        </div>
      </div>
    );
  }

  // 8. Crop PDF & Crop Margins
  if (toolId === 'crop-pdf' || toolId === 'crop-margins') {
    return (
      <div className="space-y-4">
        <label className="block text-xs font-bold text-[#12151c]">Margin Crop Insets (pt)</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#64748b] mb-1">Top Margin</label>
            <input
              type="number"
              min="0"
              value={options.top || 0}
              onChange={(e) => updateOption('top', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#64748b] mb-1">Bottom Margin</label>
            <input
              type="number"
              min="0"
              value={options.bottom || 0}
              onChange={(e) => updateOption('bottom', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#64748b] mb-1">Left Margin</label>
            <input
              type="number"
              min="0"
              value={options.left || 0}
              onChange={(e) => updateOption('left', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#64748b] mb-1">Right Margin</label>
            <input
              type="number"
              min="0"
              value={options.right || 0}
              onChange={(e) => updateOption('right', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            />
          </div>
        </div>
      </div>
    );
  }

  // 9. Add Page Numbers
  if (toolId === 'add-page-numbers') {
    const pos = options.position || 'bottom_center';
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#12151c] mb-2">Position On Page</label>
          <div className="grid grid-cols-3 gap-2 max-w-sm">
            {[
              { id: 'top_left', label: 'Top Left' },
              { id: 'top_center', label: 'Top Center' },
              { id: 'top_right', label: 'Top Right' },
              { id: 'bottom_left', label: 'Bottom Left' },
              { id: 'bottom_center', label: 'Bottom Center' },
              { id: 'bottom_right', label: 'Bottom Right' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => updateOption('position', p.id)}
                className={`py-2 px-2 text-[11px] font-medium rounded-lg border text-center ${
                  pos === p.id
                    ? 'border-[#12151c] bg-[#12151c] text-[#c9f227]'
                    : 'border-[#e3e3dc] bg-white text-[#475569] hover:bg-[#f1f1ec]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">Format Pattern</label>
            <input
              type="text"
              value={options.format || 'Page {n} of {total}'}
              onChange={(e) => updateOption('format', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">Starting Number</label>
            <input
              type="number"
              min="1"
              value={options.start_num || 1}
              onChange={(e) => updateOption('start_num', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
            />
          </div>
        </div>
      </div>
    );
  }

  // 10. Add Watermark
  if (toolId === 'add-watermark') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#12151c] mb-1">Watermark Text</label>
          <input
            type="text"
            value={options.text !== undefined ? options.text : 'CONFIDENTIAL'}
            onChange={(e) => updateOption('text', e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">
              Rotation: {options.rotation !== undefined ? options.rotation : 45}°
            </label>
            <input
              type="range"
              min="0"
              max="90"
              step="15"
              value={options.rotation !== undefined ? options.rotation : 45}
              onChange={(e) => updateOption('rotation', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">
              Opacity: {Math.round((options.opacity !== undefined ? options.opacity : 0.3) * 100)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.1"
              value={options.opacity !== undefined ? options.opacity : 0.3}
              onChange={(e) => updateOption('opacity', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>
    );
  }

  // 11. Protect PDF
  if (toolId === 'protect-pdf') {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#12151c] mb-1">Document Password</label>
          <input
            type="password"
            value={options.password || ''}
            onChange={(e) => updateOption('password', e.target.value)}
            placeholder="Enter strong encryption password"
            className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
          />
        </div>
        <p className="text-[11px] text-[#64748b]">
          Secures the document with AES-256 standard encryption. Store your password carefully; Foldora cannot recover lost passwords.
        </p>
      </div>
    );
  }

  // 12. Unlock PDF
  if (toolId === 'unlock-pdf') {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#12151c] mb-1">Document Password</label>
          <input
            type="password"
            value={options.password || ''}
            onChange={(e) => updateOption('password', e.target.value)}
            placeholder="Enter opening password"
            className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
          />
        </div>
        <p className="text-[11px] text-[#64748b]">
          Removes encryption permanently using your legitimate password. We do not support brute-force attacks.
        </p>
      </div>
    );
  }

  // 13. Redact PDF
  if (toolId === 'redact-pdf') {
    const rawKw = Array.isArray(options.keywords) ? options.keywords.join(', ') : (options.keywords || '');
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#12151c] mb-1">
            Keywords to Scrub Permanently (comma-separated)
          </label>
          <input
            type="text"
            value={rawKw}
            onChange={(e) => updateOption('keywords', e.target.value.split(',').map((s: string) => s.trim()))}
            placeholder="e.g. John Doe, 123-45-6789, Confidential"
            className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
          />
        </div>
        <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs text-[#991b1b] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Permanent byte scrub: Content under matched words will be completely eradicated from the PDF stream and cannot be retrieved through text selection or extraction.
          </span>
        </div>
      </div>
    );
  }

  // 14. OCR PDF
  if (toolId === 'ocr-pdf') {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#12151c] mb-1">OCR Language</label>
          <select
            value={options.language || 'eng'}
            onChange={(e) => updateOption('language', e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
          >
            <option value="eng">English (eng)</option>
            <option value="spa">Spanish (spa)</option>
            <option value="fra">French (fra)</option>
            <option value="deu">German (deu)</option>
            <option value="ita">Italian (ita)</option>
            <option value="por">Portuguese (por)</option>
          </select>
        </div>
      </div>
    );
  }

  // 15. Highlight Text
  if (toolId === 'highlight-text') {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-[#12151c] mb-1">Search Phrase to Highlight</label>
          <input
            type="text"
            value={options.query || ''}
            onChange={(e) => updateOption('query', e.target.value)}
            placeholder="e.g. Important, Deadline, Payment"
            className="w-full px-3.5 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#12151c] mb-1">Highlight Color</label>
          <div className="flex gap-2">
            {[
              { color: '#fde047', label: 'Yellow' },
              { color: '#86efac', label: 'Green' },
              { color: '#f472b6', label: 'Pink' },
              { color: '#67e8f9', label: 'Cyan' },
            ].map((c) => (
              <button
                key={c.color}
                type="button"
                onClick={() => updateOption('color', c.color)}
                className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                  (options.color || '#fde047') === c.color
                    ? 'ring-2 ring-[#12151c]'
                    : ''
                }`}
                style={{ backgroundColor: c.color }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 16. Underline & Strikethrough
  if (toolId === 'underline-strikethrough') {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-[#12151c] mb-1">Text Phrase to Mark</label>
          <input
            type="text"
            value={options.query || ''}
            onChange={(e) => updateOption('query', e.target.value)}
            placeholder="e.g. obsolete text or terms"
            className="w-full px-3.5 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">Markup Action</label>
            <select
              value={options.action || 'underline'}
              onChange={(e) => updateOption('action', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            >
              <option value="underline">Underline</option>
              <option value="strikeout">Strikethrough</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1">Color</label>
            <input
              type="color"
              value={options.color || '#ef4444'}
              onChange={(e) => updateOption('color', e.target.value)}
              className="w-9 h-9 rounded-lg border border-[#e3e3dc] cursor-pointer"
            />
          </div>
        </div>
      </div>
    );
  }

  // 17. Add Header & Footer
  if (toolId === 'add-header-footer') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#12151c] mb-1">Header Text</label>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Left Header"
              value={options.header_left || ''}
              onChange={(e) => updateOption('header_left', e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-[#e3e3dc] rounded-lg"
            />
            <input
              type="text"
              placeholder="Center Header"
              value={options.header_center || ''}
              onChange={(e) => updateOption('header_center', e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-[#e3e3dc] rounded-lg"
            />
            <input
              type="text"
              placeholder="Right Header"
              value={options.header_right || ''}
              onChange={(e) => updateOption('header_right', e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-[#e3e3dc] rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#12151c] mb-1">Footer Text</label>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Left Footer"
              value={options.footer_left || ''}
              onChange={(e) => updateOption('footer_left', e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-[#e3e3dc] rounded-lg"
            />
            <input
              type="text"
              placeholder="Center Footer"
              value={options.footer_center || ''}
              onChange={(e) => updateOption('footer_center', e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-[#e3e3dc] rounded-lg"
            />
            <input
              type="text"
              placeholder="Right Footer"
              value={options.footer_right || ''}
              onChange={(e) => updateOption('footer_right', e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-[#e3e3dc] rounded-lg"
            />
          </div>
        </div>
      </div>
    );
  }

  // 18. Translate PDF
  if (toolId === 'translate-pdf') {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-[#12151c] mb-1">Target Language</label>
          <select
            value={options.language || 'es'}
            onChange={(e) => updateOption('language', e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
          >
            <option value="es">Spanish (Español)</option>
            <option value="fr">French (Français)</option>
            <option value="de">German (Deutsch)</option>
            <option value="it">Italian (Italiano)</option>
            <option value="pt">Portuguese (Português)</option>
          </select>
        </div>
        <p className="text-[11px] text-[#64748b]">
          Extracts document text while preserving page number references and outputs translated text format.
        </p>
      </div>
    );
  }

  // 19. Extract Tables
  if (toolId === 'extract-tables') {
    const fmt = options.format || 'csv';
    return (
      <div className="space-y-3">
        <label className="block text-xs font-bold text-[#12151c]">Export Spreadsheet Format</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'csv', title: 'CSV Files', desc: 'Standard comma-delimited text per table' },
            { id: 'xlsx', title: 'Excel Workbook (.xlsx)', desc: 'Multi-sheet workbook with styled cells' },
          ].map((item) => (
            <div
              key={item.id}
              onClick={() => updateOption('format', item.id)}
              className={`p-3 rounded-xl border cursor-pointer ${
                fmt === item.id
                  ? 'border-[#12151c] bg-[#12151c] text-white'
                  : 'border-[#e3e3dc] bg-white text-[#12151c] hover:bg-[#f8fafc]'
              }`}
            >
              <div className="text-xs font-bold mb-0.5">{item.title}</div>
              <div className={`text-[11px] ${fmt === item.id ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 20. Ask PDF
  if (toolId === 'ask-pdf') {
    return (
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-[#12151c]">Your Question About the PDF</label>
        <textarea
          rows={3}
          value={options.question || ''}
          onChange={(e) => updateOption('question', e.target.value)}
          placeholder="e.g. What were the key quarterly revenue figures mentioned on page 2?"
          className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
        />
        <div className="flex items-center gap-1.5 text-[11px] text-[#64748b]">
          <Sparkles className="w-3.5 h-3.5 text-[#2563eb]" />
          <span>Answers are strictly grounded in document text with exact citations.</span>
        </div>
      </div>
    );
  }

  // 21. Add Stamp
  if (toolId === 'add-stamp') {
    const stampText = options.stamp_text || 'APPROVED';
    return (
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-[#12151c]">Select Stamp Text</label>
        <div className="flex flex-wrap gap-2">
          {['APPROVED', 'CONFIDENTIAL', 'DRAFT', 'COMPLETED', 'VOID', 'REVISED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => updateOption('stamp_text', st)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                stampText === st
                  ? 'border-[#12151c] bg-[#12151c] text-[#c9f227]'
                  : 'border-[#e3e3dc] bg-white text-[#475569] hover:bg-[#f1f1ec]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 22. PDF to Images (DPI setting)
  if (['pdf-to-jpg', 'pdf-to-png'].includes(toolId)) {
    const dpi = options.dpi || 150;
    return (
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-[#12151c]">Resolution Quality</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { dpi: 150, title: '150 DPI Standard', desc: 'Fast rendering, great for screen display' },
            { dpi: 300, title: '300 DPI High-Res', desc: 'Crystal clear for print and presentations' },
          ].map((item) => (
            <div
              key={item.dpi}
              onClick={() => updateOption('dpi', item.dpi)}
              className={`p-3 rounded-xl border cursor-pointer ${
                dpi === item.dpi
                  ? 'border-[#12151c] bg-[#12151c] text-white'
                  : 'border-[#e3e3dc] bg-white text-[#12151c] hover:bg-[#f8fafc]'
              }`}
            >
              <div className="text-xs font-bold mb-0.5">{item.title}</div>
              <div className={`text-[11px] ${dpi === item.dpi ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default for tools requiring no options (like Word to PDF, PDF to TXT, Repair, Flatten)
  return (
    <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs text-[#64748b] flex items-center gap-2">
      <Sparkles className="w-4 h-4 text-[#12151c] shrink-0" />
      <span>Automatic optimal processing is configured for this tool. Click the button below to execute.</span>
    </div>
  );
};
