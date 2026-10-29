import React from 'react';
import { Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';

interface ToolOptionsFormProps {
  toolId: string;
  options: Record<string, any>;
  onChange: (options: Record<string, any>) => void;
}

export const ToolOptionsForm: React.FC<ToolOptionsFormProps> = ({
  toolId,
  options,
  onChange,
}) => {
  const updateOption = (key: string, value: any) => {
    onChange({ ...options, [key]: value });
  };

  // 1. Split PDF
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

  // 2. Compress PDF
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

  // 3. Rotate PDF
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

  // 4. Add Page Numbers
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

  // 5. Add Watermark
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

  // 6. Protect PDF
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

  // 7. Unlock PDF
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

  // 8. Redact PDF
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

  // 9. OCR PDF
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
        <p className="text-[11px] text-[#64748b]">
          Detects scanned image pages and generates a transparent searchable text layer while preserving original layout.
        </p>
      </div>
    );
  }

  // 10. Image to PDF
  if (['jpg-to-pdf', 'png-to-pdf', 'webp-to-pdf', 'images-to-pdf'].includes(toolId)) {
    const orient = options.orientation || 'auto';
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#12151c] mb-2">Page Orientation</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'auto', label: 'Auto Detect' },
              { id: 'portrait', label: 'Portrait' },
              { id: 'landscape', label: 'Landscape' },
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => updateOption('orientation', o.id)}
                className={`py-2 px-3 text-xs font-medium rounded-xl border transition-all ${
                  orient === o.id
                    ? 'border-[#12151c] bg-[#12151c] text-[#c9f227]'
                    : 'border-[#e3e3dc] bg-white text-[#475569] hover:bg-[#f1f1ec]'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 11. PDF to Images (DPI setting)
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

  // 12. Ask PDF
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

  // 13. Add Stamp
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

  // Default: no special configuration needed
  return (
    <div className="p-3 bg-[#f1f1ec] rounded-xl text-xs text-[#64748b]">
      Default optimal processing settings will be applied automatically.
    </div>
  );
};
