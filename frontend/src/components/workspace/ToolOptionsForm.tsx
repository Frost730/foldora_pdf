import React from 'react';
import { fetchSuggestedQuestions } from '../../services/api';
import { Sparkles, AlertCircle, Trash2, FileOutput, Edit3, Type, Crop, Highlighter, Underline, Globe, Table, PenTool, Shield, CheckSquare, Layers, FileCheck, Search, Image as ImageIcon, Wrench, FileSpreadsheet, FileCode, CheckCircle2, Stamp, Calendar, Check, Info, Eye, EyeOff, Lock, Unlock, Copy, RefreshCw } from 'lucide-react';

interface ToolOptionsFormProps {
  toolId: string;
  options: Record<string, any>;
  onChange: (options: Record<string, any>) => void;
  pageCount?: number;
  file?: File;
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
  file,
}) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const [copiedPassword, setCopiedPassword] = React.useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = React.useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(false);

  React.useEffect(() => {
    if (toolId === 'ask-pdf' && file && file.name.toLowerCase().endsWith('.pdf')) {
      setLoadingSuggestions(true);
      fetchSuggestedQuestions(file)
        .then((questions) => {
          if (questions && questions.length > 0) {
            setSuggestedQuestions(questions);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingSuggestions(false));
    }
  }, [toolId, file]);

  const updateOption = (key: string, value: any) => {
    onChange({ ...options, [key]: value });
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_+';
    let pwd = '';
    const array = new Uint32Array(16);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < 16; i++) {
      pwd += chars[array[i] % chars.length];
    }
    updateOption('password', pwd);
    setShowPassword(true);
  };

  const handleCopyPassword = (pwd: string) => {
    if (!pwd) return;
    navigator.clipboard.writeText(pwd);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const getPasswordStrength = (pwd: string): { label: string; color: string; percent: number } => {
    if (!pwd) return { label: 'Empty', color: '#cbd5e1', percent: 0 };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { label: 'Weak', color: '#ef4444', percent: 33 };
    if (score <= 4) return { label: 'Moderate', color: '#f59e0b', percent: 66 };
    return { label: 'Strong', color: '#10b981', percent: 100 };
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
    const pwd = options.password || '';
    const strength = getPasswordStrength(pwd);

    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-[#12151c] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#2563eb]" />
              <span>Document Encryption Password</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] text-[#2563eb] hover:text-[#1d4ed8] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                title="Generate secure random password"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Generate</span>
              </button>
              {pwd && (
                <button
                  type="button"
                  onClick={() => handleCopyPassword(pwd)}
                  className="text-[11px] text-[#64748b] hover:text-[#12151c] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                  title="Copy password to clipboard"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedPassword ? 'Copied!' : 'Copy'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="relative flex items-center">
            <input
              type={showPassword ? 'text' : 'password'}
              value={pwd}
              onChange={(e) => updateOption('password', e.target.value)}
              placeholder="Enter strong encryption password"
              className="w-full pl-3.5 pr-10 py-2.5 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c] focus:ring-1 focus:ring-[#12151c] font-mono tracking-wide"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 p-1 text-[#64748b] hover:text-[#12151c] rounded-lg transition-colors cursor-pointer"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Password Strength Indicator */}
          {pwd.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#64748b]">Password Strength:</span>
                <span className="font-bold" style={{ color: strength.color }}>{strength.label}</span>
              </div>
              <div className="w-full h-1.5 bg-[#f1f1ec] rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300 rounded-full"
                  style={{ width: `${strength.percent}%`, backgroundColor: strength.color }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs space-y-1">
          <div className="font-semibold text-[#12151c] flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Military-Grade AES-256 Bit Encryption</span>
          </div>
          <p className="text-[11px] text-[#64748b] leading-relaxed">
            Your document will require this password to be opened in any standard viewer (Adobe Acrobat, Preview, Chrome, Edge). Foldora operates with zero retention and cannot recover forgotten passwords.
          </p>
        </div>
      </div>
    );
  }

  // 12. Unlock PDF
  if (toolId === 'unlock-pdf') {
    const pwd = options.password || '';

    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-[#12151c] flex items-center gap-1.5">
              <Unlock className="w-3.5 h-3.5 text-[#10b981]" />
              <span>Document Opening Password</span>
            </label>
            {pwd && (
              <button
                type="button"
                onClick={() => handleCopyPassword(pwd)}
                className="text-[11px] text-[#64748b] hover:text-[#12151c] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                title="Copy password to clipboard"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedPassword ? 'Copied!' : 'Copy'}</span>
              </button>
            )}
          </div>

          <div className="relative flex items-center">
            <input
              type={showPassword ? 'text' : 'password'}
              value={pwd}
              onChange={(e) => updateOption('password', e.target.value)}
              placeholder="Enter opening password to decrypt"
              className="w-full pl-3.5 pr-10 py-2.5 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c] focus:ring-1 focus:ring-[#12151c] font-mono tracking-wide"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 p-1 text-[#64748b] hover:text-[#12151c] rounded-lg transition-colors cursor-pointer"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-[#64748b] leading-relaxed">
          Permanently strips document password protection using your authorized password. Produces a standard, unrestricted PDF that can be opened without credentials.
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
            className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
          >
            <option value="es">Spanish (Español)</option>
            <option value="fr">French (Français)</option>
            <option value="de">German (Deutsch)</option>
            <option value="it">Italian (Italiano)</option>
            <option value="pt">Portuguese (Português)</option>
            <option value="ja">Japanese (日本語)</option>
            <option value="zh">Chinese (中文)</option>
            <option value="ru">Russian (Русский)</option>
            <option value="ar">Arabic (العربية)</option>
            <option value="hi">Hindi (हिन्दी)</option>
          </select>
        </div>
        <p className="text-[11px] text-[#64748b]">
          Extracts document text while preserving page markers and structural layout. Supports offline and external AI translation.
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
    const defaultQuestions = [
      'What is the executive summary and main objective of this document?',
      'What are the critical dates, deadlines, or milestones mentioned?',
      'What are the total financial amounts, invoices, or budget details?',
      'What are the key action items and obligations?',
      'What are the primary conclusions and findings?'
    ];
    const displayQuestions = suggestedQuestions.length > 0 ? suggestedQuestions : defaultQuestions;
    const hasDynamicQuestions = suggestedQuestions.length > 0;

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#12151c]">Your Question About the PDF</label>
          <textarea
            rows={3}
            value={options.question || ''}
            onChange={(e) => updateOption('question', e.target.value)}
            placeholder="e.g. What were the key quarterly revenue figures mentioned on page 2?"
            className="w-full px-3 py-2.5 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c] transition-colors"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#12151c]">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#2563eb]" />
              <span>Suggested Questions (click to apply)</span>
            </div>
            {loadingSuggestions && (
              <span className="text-[10px] text-[#2563eb] animate-pulse">Analyzing document headings...</span>
            )}
            {!loadingSuggestions && hasDynamicQuestions && (
              <span className="text-[10px] text-[#10b981] font-medium bg-[#ecfdf5] px-2 py-0.5 rounded-full border border-[#a7f3d0]">
                Tailored to document
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {displayQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => updateOption('question', q)}
                className="text-left text-[11px] px-2.5 py-1.5 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#e2e8f0] rounded-lg text-[#1e293b] transition-all cursor-pointer hover:border-[#cbd5e1]"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 bg-[#f1f5f9] rounded-xl border border-[#e2e8f0] flex items-center justify-between text-[11px] text-[#475569]">
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Exact page-level citations & answer confidence scoring enabled</span>
          </span>
          <span className="font-mono text-[10px] text-[#64748b]">Offline + Cloud AI</span>
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


  // 23. Sign PDF, Create Signature, Fill and Sign
  if (['sign-pdf', 'create-signature', 'fill-and-sign'].includes(toolId)) {
    const signer = options.signer_name || '';
    const style = options.signature_style || 'cursive';
    const position = options.position || 'bottom_right';
    const targetPage = options.page || 1;
    const inkColor = options.color || '#1e3a8a';

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#12151c] mb-1.5 flex items-center gap-1.5">
            <PenTool className="w-3.5 h-3.5 text-[#2563eb]" />
            <span>Signer Full Name</span>
          </label>
          <input
            type="text"
            value={signer}
            onChange={(e) => updateOption('signer_name', e.target.value)}
            placeholder="e.g. Aravind P."
            className="w-full px-3.5 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none focus:border-[#12151c]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1.5">Signature Typography Style</label>
            <div className="space-y-1.5">
              {[
                { id: 'cursive', title: 'Cursive Signature', desc: 'Handwritten italic signature' },
                { id: 'formal', title: 'Formal Script', desc: 'Elegant traditional legal script' },
                { id: 'modern', title: 'Modern Serif', desc: 'Clean corporate executive style' },
              ].map((st) => (
                <div
                  key={st.id}
                  onClick={() => updateOption('signature_style', st.id)}
                  className={`p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${
                    style === st.id
                      ? 'border-[#12151c] bg-[#12151c] text-white shadow-xs'
                      : 'border-[#e3e3dc] bg-white text-[#12151c] hover:bg-[#f8fafc]'
                  }`}
                >
                  <div className="font-bold">{st.title}</div>
                  <div className={`text-[10px] ${style === st.id ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>{st.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#12151c] mb-1.5">Placement Position</label>
              <select
                value={position}
                onChange={(e) => {
                  const pos = e.target.value;
                  updateOption('position', pos);
                  if (pos === 'bottom_right') {
                    updateOption('x', 380);
                    updateOption('y', 680);
                  } else if (pos === 'bottom_left') {
                    updateOption('x', 72);
                    updateOption('y', 680);
                  } else if (pos === 'top_right') {
                    updateOption('x', 380);
                    updateOption('y', 72);
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl focus:outline-none"
              >
                <option value="bottom_right">Bottom Right Corner (Standard)</option>
                <option value="bottom_left">Bottom Left Corner</option>
                <option value="top_right">Top Right Header</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#12151c] mb-1.5">Target Page</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={pageCount || 100}
                  value={targetPage}
                  onChange={(e) => updateOption('page', Math.max(1, Number(e.target.value)))}
                  className="w-20 px-3 py-1.5 text-xs bg-white border border-[#e3e3dc] rounded-xl"
                />
                {pageCount && (
                  <button
                    type="button"
                    onClick={() => updateOption('page', pageCount)}
                    className="px-2.5 py-1 text-xs border border-[#e3e3dc] bg-white rounded-lg text-[#64748b] hover:bg-[#f1f1ec]"
                  >
                    Last Page ({pageCount})
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#12151c] mb-1.5">Ink Color</label>
              <div className="flex items-center gap-2">
                {[
                  { c: '#1e3a8a', label: 'Navy Blue' },
                  { c: '#111827', label: 'Dark Black' },
                  { c: '#831843', label: 'Burgundy' },
                ].map((col) => (
                  <button
                    key={col.c}
                    type="button"
                    onClick={() => updateOption('color', col.c)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all ${
                      inkColor === col.c ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white text-[#475569]'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.c }} />
                    <span>{col.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-[#e3e3dc]">
          <input
            type="checkbox"
            id="include_date"
            checked={options.include_date !== false}
            onChange={(e) => updateOption('include_date', e.target.checked)}
            className="rounded border-[#e3e3dc] cursor-pointer"
          />
          <label htmlFor="include_date" className="text-xs text-[#475569] cursor-pointer">
            Include automated signing date timestamp (<span className="font-mono">{new Date().toISOString().split('T')[0]}</span>)
          </label>
        </div>
      </div>
    );
  }

  // 24. Merge PDF
  if (toolId === 'merge-pdf') {
    return (
      <div className="space-y-3">
        <label className="block text-xs font-bold text-[#12151c]">Merge Order & Options</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            onClick={() => updateOption('order', 'sequence')}
            className={`p-3 rounded-xl border cursor-pointer ${
              options.order !== 'alpha' ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white'
            }`}
          >
            <div className="text-xs font-bold">List Order (As Uploaded)</div>
            <div className="text-[11px] opacity-75">Merges files in the exact order shown above. Drag files to reorder.</div>
          </div>
          <div
            onClick={() => updateOption('order', 'alpha')}
            className={`p-3 rounded-xl border cursor-pointer ${
              options.order === 'alpha' ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white'
            }`}
          >
            <div className="text-xs font-bold">Alphabetical by Name</div>
            <div className="text-[11px] opacity-75">Automatically sorts uploaded documents by filename (A to Z).</div>
          </div>
        </div>
      </div>
    );
  }

  // 25. Repair PDF
  if (toolId === 'repair-pdf') {
    const level = options.repair_mode || 'standard';
    return (
      <div className="space-y-3">
        <label className="block text-xs font-bold text-[#12151c] flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span>Repair Recovery Strategy</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { id: 'standard', title: 'Standard Fix', desc: 'Rebuilds broken xref cross-reference tables & trailer' },
            { id: 'deep', title: 'Deep Recovery', desc: 'Salvages readable object streams and purges invalid blocks' },
            { id: 'linearize', title: 'Linearize & Clean', desc: 'Optimizes document layout for fast web streaming' },
          ].map((item) => (
            <div
              key={item.id}
              onClick={() => updateOption('repair_mode', item.id)}
              className={`p-3 rounded-xl border cursor-pointer text-xs ${
                level === item.id ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white text-[#12151c] hover:bg-[#f8fafc]'
              }`}
            >
              <div className="font-bold mb-0.5">{item.title}</div>
              <div className={`text-[10px] ${level === item.id ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 26. Flatten PDF / Flatten Form
  if (['flatten-pdf', 'flatten-form'].includes(toolId)) {
    return (
      <div className="space-y-3">
        <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs text-[#991b1b] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Flattening converts fillable form inputs, digital stamps, and annotations into permanent visual page graphics.
          </span>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-[#12151c] cursor-pointer">
            <input
              type="checkbox"
              checked={options.flatten_forms !== false}
              onChange={(e) => updateOption('flatten_forms', e.target.checked)}
              className="rounded"
            />
            <span>Bake all text fields, checkboxes, and radio buttons</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-[#12151c] cursor-pointer">
            <input
              type="checkbox"
              checked={options.flatten_annotations !== false}
              onChange={(e) => updateOption('flatten_annotations', e.target.checked)}
              className="rounded"
            />
            <span>Bake all markup highlights, notes, and digital stamps</span>
          </label>
        </div>
      </div>
    );
  }

  // 27. PDF to PDF/A (Archival Standard)
  if (toolId === 'pdf-to-pdfa') {
    const profile = options.profile || 'pdfa-2b';
    return (
      <div className="space-y-3">
        <label className="block text-xs font-bold text-[#12151c]">ISO PDF/A Archival Profile</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { id: 'pdfa-2b', title: 'PDF/A-2b (Recommended)', desc: 'Standard archival profile supporting vector transparency and JPEG2000' },
            { id: 'pdfa-1b', title: 'PDF/A-1b (Basic)', desc: 'Strict visual conformance according to initial ISO 19005-1 standard' },
            { id: 'pdfa-3b', title: 'PDF/A-3b (Modern)', desc: 'Advanced archival profile allowing embedded XML and raw audit files' },
          ].map((item) => (
            <div
              key={item.id}
              onClick={() => updateOption('profile', item.id)}
              className={`p-3 rounded-xl border cursor-pointer text-xs ${
                profile === item.id ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white text-[#12151c] hover:bg-[#f8fafc]'
              }`}
            >
              <div className="font-bold mb-0.5">{item.title}</div>
              <div className={`text-[10px] ${profile === item.id ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 28. Images to PDF (JPG, PNG, WebP, TIFF, Multiple Images, Scan)
  if (['jpg-to-pdf', 'png-to-pdf', 'webp-to-pdf', 'tiff-to-pdf', 'images-to-pdf', 'scan-to-pdf'].includes(toolId)) {
    const orient = options.orientation || 'auto';
    const margin = options.margin !== undefined ? String(options.margin) : '18';
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1.5">Page Orientation</label>
            <select
              value={orient}
              onChange={(e) => updateOption('orientation', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            >
              <option value="auto">Auto (Match Image Proportions)</option>
              <option value="portrait">Force Portrait</option>
              <option value="landscape">Force Landscape</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#12151c] mb-1.5">Page Margins</label>
            <select
              value={margin}
              onChange={(e) => updateOption('margin', Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            >
              <option value="0">No Margins (Edge-to-Edge)</option>
              <option value="18">Small Margins (18 pt)</option>
              <option value="36">Standard Margins (36 pt)</option>
            </select>
          </div>
        </div>

        {toolId === 'scan-to-pdf' && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#e3e3dc]">
            <input
              type="checkbox"
              id="enhance"
              checked={options.enhance_contrast !== false}
              onChange={(e) => updateOption('enhance_contrast', e.target.checked)}
              className="rounded"
            />
            <label htmlFor="enhance" className="text-xs text-[#475569] cursor-pointer">
              Auto-enhance contrast and sharpen scanned paper text
            </label>
          </div>
        )}
      </div>
    );
  }

  // 29. Office to PDF (Word, Excel, PowerPoint)
  if (['word-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf'].includes(toolId)) {
    return (
      <div className="space-y-3">
        <label className="block text-xs font-bold text-[#12151c]">Conversion Settings</label>
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => updateOption('quality', 'high')}
            className={`p-3 rounded-xl border cursor-pointer text-xs ${
              options.quality !== 'compact' ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white'
            }`}
          >
            <div className="font-bold">High Fidelity Vector (Default)</div>
            <div className="text-[10px] opacity-75">Preserves exact fonts, charts, vector shapes, and document hyperlinks.</div>
          </div>
          <div
            onClick={() => updateOption('quality', 'compact')}
            className={`p-3 rounded-xl border cursor-pointer text-xs ${
              options.quality === 'compact' ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white'
            }`}
          >
            <div className="font-bold">Optimized File Size</div>
            <div className="text-[10px] opacity-75">Compresses embedded media for email and fast downloading.</div>
          </div>
        </div>
      </div>
    );
  }

  // 30. PDF to Office (Word DOCX, Excel XLSX, PowerPoint PPTX)
  if (['pdf-to-word', 'pdf-to-excel', 'pdf-to-powerpoint'].includes(toolId)) {
    return (
      <div className="space-y-3">
        <label className="block text-xs font-bold text-[#12151c]">Document Conversion Mode</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            onClick={() => updateOption('layout_mode', 'flow')}
            className={`p-3 rounded-xl border cursor-pointer text-xs ${
              options.layout_mode !== 'exact' ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white'
            }`}
          >
            <div className="font-bold mb-0.5">Editable Flowing Content</div>
            <div className="text-[10px] opacity-75">Reconstructs paragraphs, tables, and lists for natural document editing.</div>
          </div>
          <div
            onClick={() => updateOption('layout_mode', 'exact')}
            className={`p-3 rounded-xl border cursor-pointer text-xs ${
              options.layout_mode === 'exact' ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white'
            }`}
          >
            <div className="font-bold mb-0.5">Strict Visual Geometry</div>
            <div className="text-[10px] opacity-75">Positions content in exact geometric text frames matching page coordinates.</div>
          </div>
        </div>
      </div>
    );
  }

  // 31. Text & Code Conversions (txt-to-pdf, markdown-to-pdf, html-to-pdf, pdf-to-txt, pdf-to-html, pdf-to-markdown)
  if (['txt-to-pdf', 'markdown-to-pdf', 'html-to-pdf', 'pdf-to-txt', 'pdf-to-html', 'pdf-to-markdown'].includes(toolId)) {
    return (
      <div className="space-y-3">
        <label className="block text-xs font-bold text-[#12151c]">Typography & Formatting</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-[#64748b] mb-1">Font Family</label>
            <select
              value={options.font || 'sans'}
              onChange={(e) => updateOption('font', e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            >
              <option value="sans">Clean Sans-Serif (Helvetica)</option>
              <option value="mono">Monospace (Courier / Code)</option>
              <option value="serif">Editorial Serif (Times)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-[#64748b] mb-1">Font Size</label>
            <select
              value={options.font_size || 11}
              onChange={(e) => updateOption('font_size', Number(e.target.value))}
              className="w-full px-3 py-1.5 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            >
              <option value={10}>Compact (10 pt)</option>
              <option value={11}>Standard (11 pt)</option>
              <option value={13}>Comfortable (13 pt)</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  // 32. Extract Text & Extract Images
  if (['extract-text', 'extract-images'].includes(toolId)) {
    if (toolId === 'extract-text') {
      return (
        <div className="space-y-3">
          <label className="block text-xs font-bold text-[#12151c]">Text Extraction Settings</label>
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => updateOption('format', 'txt')}
              className={`p-3 rounded-xl border cursor-pointer text-xs ${
                options.format !== 'md' ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white'
              }`}
            >
              <div className="font-bold">Plain Text (.txt)</div>
              <div className="text-[10px] opacity-75">Clean unformatted text stream</div>
            </div>
            <div
              onClick={() => updateOption('format', 'md')}
              className={`p-3 rounded-xl border cursor-pointer text-xs ${
                options.format === 'md' ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white'
              }`}
            >
              <div className="font-bold">Markdown (.md)</div>
              <div className="text-[10px] opacity-75">Preserves headings, bold text, and layout spacing</div>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="space-y-3">
          <label className="block text-xs font-bold text-[#12151c]">Image Extraction Filter</label>
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => updateOption('filter_small', true)}
              className={`p-3 rounded-xl border cursor-pointer text-xs ${
                options.filter_small !== false ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white'
              }`}
            >
              <div className="font-bold">Photos & Graphics Only</div>
              <div className="text-[10px] opacity-75">Filters out tiny decorative icons and 1px lines (recommended)</div>
            </div>
            <div
              onClick={() => updateOption('filter_small', false)}
              className={`p-3 rounded-xl border cursor-pointer text-xs ${
                options.filter_small === false ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white'
              }`}
            >
              <div className="font-bold">All Embedded Assets</div>
              <div className="text-[10px] opacity-75">Extracts every bitmap asset found in PDF byte streams</div>
            </div>
          </div>
        </div>
      );
    }
  }

  // 33. Security Utilities (Remove Metadata, Compare PDFs, PDF Info, Check Integrity)
  if (['remove-metadata', 'compare-pdfs', 'pdf-info', 'check-integrity'].includes(toolId)) {
    if (toolId === 'remove-metadata') {
      return (
        <div className="space-y-3">
          <label className="block text-xs font-bold text-[#12151c] flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#059669]" />
            <span>Privacy Scrubbing Scope</span>
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {['Author & Signer identity', 'Software / PDF Producer metadata', 'Creation & Revision Timestamps', 'Document UUID & XMP metadata'].map((item) => (
              <div key={item} className="flex items-center gap-2 p-2 bg-[#f8fafc] border border-[#e3e3dc] rounded-lg">
                <Check className="w-3.5 h-3.5 text-[#059669]" />
                <span className="text-[11px] text-[#475569]">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#64748b]">
            All hidden author fingerprints and tracking headers will be permanently scrubbed.
          </p>
        </div>
      );
    } else if (toolId === 'compare-pdfs') {
      return (
        <div className="space-y-3">
          <label className="block text-xs font-bold text-[#12151c]">Comparison Inspection Method</label>
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => updateOption('mode', 'diff')}
              className={`p-3 rounded-xl border cursor-pointer text-xs ${
                options.mode !== 'visual' ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white'
              }`}
            >
              <div className="font-bold">Text & Structural Word Diff</div>
              <div className="text-[10px] opacity-75">Detailed change report noting additions, deletions, and moved clauses.</div>
            </div>
            <div
              onClick={() => updateOption('mode', 'visual')}
              className={`p-3 rounded-xl border cursor-pointer text-xs ${
                options.mode === 'visual' ? 'border-[#12151c] bg-[#12151c] text-white' : 'border-[#e3e3dc] bg-white'
              }`}
            >
              <div className="font-bold">Visual Pixel Overlay</div>
              <div className="text-[10px] opacity-75">Highlights changes directly on page images in bright magenta.</div>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="space-y-3">
          <label className="block text-xs font-bold text-[#12151c] flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#2563eb]" />
            <span>Inspection Diagnostic Mode</span>
          </label>
          <div className="p-3 bg-[#f8fafc] border border-[#e3e3dc] rounded-xl text-xs space-y-1">
            <div className="font-bold text-[#12151c]">Comprehensive Document Audit</div>
            <p className="text-[#64748b] text-[11px]">
              Inspects cross-reference integrity, embedded font descriptors, color spaces, compression filters, and encryption structures.
            </p>
          </div>
        </div>
      );
    }
  }

  // 34. AI Document Tools (PDF Summarizer, Extract Structured Data)
  if (['pdf-summarizer', 'summarize-pdf'].includes(toolId)) {
    const summaryMode = options.mode || 'executive';
    const summaryLength = options.length || 'standard';

    const modes = [
      { id: 'executive', title: 'Executive Summary', desc: 'High-level synthesis of objectives & core findings' },
      { id: 'key_takeaways', title: 'Key Takeaways', desc: 'Prioritized bullet points with vital data' },
      { id: 'action_items', title: 'Action Items & Deadlines', desc: 'Deliverables, milestones, tasks checklist' },
      { id: 'study_guide', title: 'Study Guide', desc: 'Section breakdown, key concepts & review questions' },
      { id: 'faq', title: 'FAQ Generation', desc: 'Curated Q&A pairs directly synthesized from text' },
    ];

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#12151c]">Summarization Mode</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {modes.map((item) => (
              <div
                key={item.id}
                onClick={() => updateOption('mode', item.id)}
                className={`p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                  summaryMode === item.id
                    ? 'border-[#12151c] bg-[#12151c] text-white shadow-xs'
                    : 'border-[#e3e3dc] bg-white text-[#12151c] hover:bg-[#f8fafc]'
                }`}
              >
                <div className="font-bold mb-0.5">{item.title}</div>
                <div className={`text-[10px] ${summaryMode === item.id ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#12151c]">Summary Detail Level</label>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'brief', title: 'Brief Snapshot', desc: 'Concise 1-page overview' },
              { id: 'standard', title: 'Standard (Recommended)', desc: 'Balanced depth & coverage' },
              { id: 'detailed', title: 'Detailed Analysis', desc: 'Comprehensive section breakdown' },
            ].map((item) => (
              <div
                key={item.id}
                onClick={() => updateOption('length', item.id)}
                className={`p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${
                  summaryLength === item.id
                    ? 'border-[#12151c] bg-[#12151c] text-white shadow-xs'
                    : 'border-[#e3e3dc] bg-white text-[#12151c] hover:bg-[#f8fafc]'
                }`}
              >
                <div className="font-bold text-[11px] mb-0.5">{item.title}</div>
                <div className={`text-[10px] ${summaryLength === item.id ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl flex items-center justify-between text-xs text-[#64748b]">
          <span className="flex items-center gap-1.5 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-[#2563eb]" />
            <span>Includes reading time saved, word counts & page index tracking</span>
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-white border border-[#e2e8f0] rounded">512MB RAM Safe</span>
        </div>
      </div>
    );
  }

  if (toolId === 'extract-structured-data') {
    const activeSchema = options.schema || 'general';
    const activeFormat = options.format || 'json';

    const schemas = [
      { id: 'general', title: 'General Entities', desc: 'Emails, phones, dates, currencies, URLs, key-values' },
      { id: 'invoices', title: 'Invoices & Receipts', desc: 'Invoice #, vendor, bill-to, line items, taxes, totals' },
      { id: 'legal', title: 'Legal & Contracts', desc: 'Parties, effective/expiry dates, governing law, confidentiality' },
      { id: 'research', title: 'Research Papers', desc: 'Title, abstract, methodology, metrics, conclusions' },
    ];

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#12151c]">Pre-Tuned Extraction Schema</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {schemas.map((item) => (
              <div
                key={item.id}
                onClick={() => updateOption('schema', item.id)}
                className={`p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                  activeSchema === item.id
                    ? 'border-[#12151c] bg-[#12151c] text-white shadow-xs'
                    : 'border-[#e3e3dc] bg-white text-[#12151c] hover:bg-[#f8fafc]'
                }`}
              >
                <div className="font-bold mb-0.5">{item.title}</div>
                <div className={`text-[10px] ${activeSchema === item.id ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#12151c]">Output Format Preference</label>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'json', title: 'JSON Object', desc: 'Machine-readable payload' },
              { id: 'markdown', title: 'Markdown Table', desc: 'Formatted human audit report' },
              { id: 'csv', title: 'Spreadsheet CSV', desc: 'Line items & table rows' },
            ].map((fmt) => (
              <div
                key={fmt.id}
                onClick={() => updateOption('format', fmt.id)}
                className={`p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${
                  activeFormat === fmt.id
                    ? 'border-[#12151c] bg-[#12151c] text-white shadow-xs'
                    : 'border-[#e3e3dc] bg-white text-[#12151c] hover:bg-[#f8fafc]'
                }`}
              >
                <div className="font-bold text-[11px] mb-0.5">{fmt.title}</div>
                <div className={`text-[10px] ${activeFormat === fmt.id ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
                  {fmt.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs space-y-1">
          <div className="font-bold text-[#12151c] flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Multi-Format Output Delivery</span>
          </div>
          <p className="text-[#64748b] text-[11px]">
            The tool automatically generates both structured JSON and companion Markdown/CSV tables for direct download.
          </p>
        </div>
      </div>
    );
  }

  // 35. Edit Tools (add-image, draw-freehand, add-shapes, add-comments, annotate-pdf, fill-form)
  if (['add-image', 'draw-freehand', 'add-shapes', 'add-comments', 'annotate-pdf', 'fill-form'].includes(toolId)) {
    return (
      <div className="space-y-3">
        <label className="block text-xs font-bold text-[#12151c]">Editing Preferences</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-[#64748b] mb-1">Target Page</label>
            <input
              type="number"
              min={1}
              max={pageCount || 100}
              value={options.page || 1}
              onChange={(e) => updateOption('page', Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-1.5 text-xs bg-white border border-[#e3e3dc] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#64748b] mb-1">Theme Accent Color</label>
            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="color"
                value={options.color || '#2563eb'}
                onChange={(e) => updateOption('color', e.target.value)}
                className="w-8 h-8 rounded-lg border border-[#e3e3dc] cursor-pointer"
              />
              <span className="text-xs font-mono text-[#64748b]">{options.color || '#2563eb'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 36. Organize PDF
  if (toolId === 'organize-pdf') {
    return (
      <div className="space-y-3">
        <label className="block text-xs font-bold text-[#12151c] flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#2563eb]" />
          <span>Visual Page Organizer Controls</span>
        </label>
        <p className="text-xs text-[#64748b] leading-relaxed">
          Drag and drop page thumbnail cards to reorder pages. Use the rotate button on any thumbnail to rotate individual pages in 90° increments.
        </p>
        <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs space-y-1">
          <div className="font-semibold text-[#12151c] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Interactive Thumbnail Canvas Enabled</span>
          </div>
          <p className="text-[11px] text-[#64748b]">
            All page rearrangements, orientation angles, and deletions configured in the organizer above are automatically synchronized directly into the PDF engine upon execution.
          </p>
        </div>
      </div>
    );
  }

  // Default fallback
  return (
    <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs text-[#64748b] flex items-center gap-2">
      <Sparkles className="w-4 h-4 text-[#12151c] shrink-0" />
      <span>Optimized configuration is active for this tool. Click the button below to process.</span>
    </div>
  );
};
