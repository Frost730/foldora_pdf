import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, PenTool, Type, Upload, Trash2, Check, Sparkles, SlidersHorizontal, RefreshCw } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdopt: (signatureDataUrl: string) => void;
}

const INK_COLORS = [
  { label: 'Black', hex: '#111827' },
  { label: 'Navy', hex: '#0f172a' },
  { label: 'Classic Blue', hex: '#1d4ed8' },
  { label: 'Royal Blue', hex: '#2563eb' },
  { label: 'Crimson', hex: '#dc2626' },
  { label: 'Emerald', hex: '#047857' },
];

const SIGNATURE_STYLES = [
  { id: 'style1', font: 'italic 38px "Brush Script MT", "Caveat", "Segoe Script", cursive', name: 'Formal Script' },
  { id: 'style2', font: 'italic 36px "Segoe Script", "Dancing Script", cursive', name: 'Artistic Flow' },
  { id: 'style3', font: 'italic 32px "Lucida Handwriting", "Great Vibes", cursive', name: 'Modern Executive' },
  { id: 'style4', font: 'italic 34px "Comic Sans MS", "Caveat", cursive', name: 'Casual Hand' },
];

type InkColorMode = 'original' | 'crisp_dark' | 'executive_blue' | 'black';

export const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onAdopt }) => {
  const [tab, setTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [selectedColor, setSelectedColor] = useState<string>('#111827');
  const [penWidth, setPenWidth] = useState<number>(2.5);

  // Draw Tab Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);

  // Type Tab State
  const [typedName, setTypedName] = useState<string>('Your Name');
  const [selectedStyleId, setSelectedStyleId] = useState<string>('style1');

  // Upload Tab State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState<boolean>(true);
  const [sensitivity, setSensitivity] = useState<number>(68); // 20% to 95%
  const [inkColorMode, setInkColorMode] = useState<InkColorMode>('crisp_dark');
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Reset or initialize drawing canvas when opened or tab changed
  useEffect(() => {
    if (isOpen && tab === 'draw') {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      }
    }
  }, [isOpen, tab]);

  // Adaptive background removal engine with smooth edge feathering
  const processImage = useCallback(
    (src: string, isRemoveBg: boolean, sens: number, colorMode: InkColorMode) => {
      if (!isRemoveBg) {
        setProcessedPreview(src);
        return;
      }

      setIsProcessing(true);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setProcessedPreview(src);
          setIsProcessing(false);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const w = canvas.width;
        const h = canvas.height;

        // Sample perimeter pixels to detect paper background luminance
        let bgLuminanceSum = 0;
        let bgCount = 0;
        const stepX = Math.max(1, Math.floor(w / 35));
        const stepY = Math.max(1, Math.floor(h / 35));

        for (let x = 0; x < w; x += stepX) {
          const topIdx = (0 * w + x) * 4;
          bgLuminanceSum += 0.299 * data[topIdx] + 0.587 * data[topIdx + 1] + 0.114 * data[topIdx + 2];
          const botIdx = ((h - 1) * w + x) * 4;
          bgLuminanceSum += 0.299 * data[botIdx] + 0.587 * data[botIdx + 1] + 0.114 * data[botIdx + 2];
          bgCount += 2;
        }
        for (let y = 0; y < h; y += stepY) {
          const leftIdx = (y * w + 0) * 4;
          bgLuminanceSum += 0.299 * data[leftIdx] + 0.587 * data[leftIdx + 1] + 0.114 * data[leftIdx + 2];
          const rightIdx = (y * w + (w - 1)) * 4;
          bgLuminanceSum += 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
          bgCount += 2;
        }

        const avgPaperLum = bgCount > 0 ? bgLuminanceSum / bgCount : 220;
        const normalizedSensitivity = sens / 100;
        // Dynamic threshold calculated from paper baseline and user sensitivity
        const threshold = Math.min(253, Math.max(70, avgPaperLum * 0.45 + 255 * (normalizedSensitivity * 0.55)));
        const feather = 35;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          if (lum >= threshold) {
            // Paper pixel: completely transparent
            data[i + 3] = 0;
          } else {
            let alpha = 255;
            if (lum > threshold - feather) {
              // Smooth anti-aliased edge transition
              alpha = Math.round(255 * ((threshold - lum) / feather));
            }
            data[i + 3] = Math.max(0, Math.min(255, alpha));

            // Optional ink enhancement
            if (colorMode === 'crisp_dark') {
              data[i] = Math.round(r * 0.5);
              data[i + 1] = Math.round(g * 0.5);
              data[i + 2] = Math.round(b * 0.5);
            } else if (colorMode === 'black') {
              data[i] = 17;
              data[i + 1] = 24;
              data[i + 2] = 39;
            } else if (colorMode === 'executive_blue') {
              data[i] = 29;
              data[i + 1] = 78;
              data[i + 2] = 216;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        setProcessedPreview(canvas.toDataURL('image/png'));
        setIsProcessing(false);
      };
      img.onerror = () => {
        setProcessedPreview(src);
        setIsProcessing(false);
      };
      img.src = src;
    },
    []
  );

  // Automatically update live preview whenever uploaded image or options change
  useEffect(() => {
    if (uploadedImage) {
      processImage(uploadedImage, removeBg, sensitivity, inkColorMode);
    } else {
      setProcessedPreview(null);
    }
  }, [uploadedImage, removeBg, sensitivity, inkColorMode, processImage]);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // DRAW TAB HANDLERS
  // -------------------------------------------------------------
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = penWidth;
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  // -------------------------------------------------------------
  // UPLOAD TAB HANDLERS
  // -------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // -------------------------------------------------------------
  // ADOPT SIGNATURE HANDLER
  // -------------------------------------------------------------
  const handleAdopt = () => {
    if (tab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      onAdopt(canvas.toDataURL('image/png'));
      onClose();
    } else if (tab === 'type') {
      if (!typedName.trim()) return;
      // Render typed text to temporary high-res canvas
      const offscreen = document.createElement('canvas');
      offscreen.width = 450;
      offscreen.height = 160;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, offscreen.width, offscreen.height);
        const style = SIGNATURE_STYLES.find((s) => s.id === selectedStyleId) || SIGNATURE_STYLES[0];
        ctx.font = style.font;
        ctx.fillStyle = selectedColor;
        ctx.textBaseline = 'middle';
        ctx.fillText(typedName, 20, 80);

        // Optional decorative flourish line
        ctx.beginPath();
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = 1.5;
        ctx.moveTo(15, 115);
        ctx.bezierCurveTo(90, 110, 220, 125, 340, 112);
        ctx.stroke();

        onAdopt(offscreen.toDataURL('image/png'));
        onClose();
      }
    } else if (tab === 'upload') {
      if (!uploadedImage) return;
      const finalSig = processedPreview || uploadedImage;
      onAdopt(finalSig);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-[#181d27] border border-[#2b303c] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl text-white space-y-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2 border-b border-[#2b303c] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#c9f227] text-[#12151c] flex items-center justify-center font-bold">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Signature Studio</h3>
              <p className="text-[11px] text-[#94a3b8]">Create, customize, and place your signature directly onto the PDF</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#94a3b8] hover:text-white hover:bg-[#232936] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-[#12151c] border border-[#2b303c] rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTab('draw')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                tab === 'draw' ? 'bg-[#c9f227] text-[#12151c]' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Draw</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('type')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                tab === 'type' ? 'bg-[#c9f227] text-[#12151c]' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Type</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all cursor-pointer ${
                tab === 'upload' ? 'bg-[#c9f227] text-[#12151c]' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Photo / Scan</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-6 space-y-4 overflow-y-auto flex-1 pb-2">
          {/* TAB 1: DRAW */}
          {tab === 'draw' && (
            <div className="space-y-3">
              <div className="relative border-2 border-dashed border-[#333c4d] rounded-xl bg-[#0f1218] overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={180}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  className="w-full h-44 cursor-crosshair touch-none"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-xs text-[#64748b] gap-1">
                    <span>Draw your signature with mouse or touch</span>
                    <span className="text-[10px] text-[#475569]">Sign above the line</span>
                  </div>
                )}
                {/* Subtle baseline */}
                <div className="absolute bottom-8 left-8 right-8 border-b border-[#2b303c] pointer-events-none" />
              </div>

              {/* Draw Options Bar */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#94a3b8]">Ink Color:</span>
                  <div className="flex items-center gap-1.5">
                    {INK_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setSelectedColor(c.hex)}
                        title={c.label}
                        className={`w-5 h-5 rounded-full border border-[#475569] transition-transform ${
                          selectedColor === c.hex ? 'scale-125 ring-2 ring-[#c9f227]' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-[#12151c] p-0.5 rounded-lg border border-[#2b303c]">
                    {[1.5, 2.5, 4.0].map((w, idx) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setPenWidth(w)}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                          penWidth === w ? 'bg-[#232936] text-[#c9f227]' : 'text-[#64748b]'
                        }`}
                      >
                        {idx === 0 ? 'Fine' : idx === 1 ? 'Med' : 'Thick'}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="flex items-center gap-1 px-2.5 py-1 text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-colors cursor-pointer text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TYPE */}
          {tab === 'type' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#94a3b8] block mb-1">Enter Name or Initials</label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-[#12151c] border border-[#2b303c] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#c9f227]"
                />
              </div>

              {/* Ink Color Picker */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[11px] text-[#94a3b8]">Ink Color:</span>
                <div className="flex items-center gap-1.5">
                  {INK_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setSelectedColor(c.hex)}
                      title={c.label}
                      className={`w-5 h-5 rounded-full border border-[#475569] transition-transform ${
                        selectedColor === c.hex ? 'scale-125 ring-2 ring-[#c9f227]' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Style Presets Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {SIGNATURE_STYLES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStyleId(st.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedStyleId === st.id
                        ? 'border-[#c9f227] bg-[#c9f227]/10'
                        : 'border-[#2b303c] bg-[#12151c] hover:border-[#475569]'
                    }`}
                  >
                    <span className="text-[10px] text-[#64748b] block mb-1 font-mono uppercase">{st.name}</span>
                    <p
                      className="text-xl truncate"
                      style={{
                        fontFamily: st.name === 'Formal Script' ? 'cursive' : 'sans-serif',
                        fontStyle: 'italic',
                        color: selectedColor,
                      }}
                    >
                      {typedName || 'Your Signature'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: UPLOAD WITH LIVE ADAPTIVE TRANSPARENCY PREVIEW */}
          {tab === 'upload' && (
            <div className="space-y-3.5">
              {!uploadedImage ? (
                <label className="border-2 border-dashed border-[#333c4d] hover:border-[#c9f227] rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[#0f1218]">
                  <Upload className="w-8 h-8 text-[#64748b] mb-2" />
                  <span className="text-xs font-semibold text-white">Click or drop signature photo / scan</span>
                  <span className="text-[11px] text-[#64748b] mt-0.5">Supports PNG, JPG, JPEG, WEBP taken with phone or scanner</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              ) : (
                <div className="space-y-3">
                  {/* Live Checkerboard Transparency Preview */}
                  <div className="relative border border-[#2b303c] rounded-xl overflow-hidden shadow-inner bg-[#12151c]">
                    <div
                      className="w-full h-36 flex items-center justify-center p-4"
                      style={{
                        backgroundImage: `repeating-conic-gradient(#252c3b 0% 25%, #181d27 0% 50%)`,
                        backgroundPosition: '0 0',
                        backgroundSize: '16px 16px',
                      }}
                    >
                      {processedPreview && (
                        <img
                          src={processedPreview}
                          alt="Processed Signature"
                          className="max-h-28 max-w-full object-contain filter drop-shadow-sm"
                        />
                      )}
                    </div>

                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-[#12151c]/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-[#2b303c] text-[10px]">
                      {removeBg ? (
                        <>
                          <Sparkles className="w-3 h-3 text-[#c9f227]" />
                          <span className="text-[#c9f227] font-semibold">Transparent Background Active</span>
                        </>
                      ) : (
                        <span className="text-[#94a3b8]">Original Background</span>
                      )}
                    </div>

                    <label className="absolute top-2 right-2 flex items-center gap-1 bg-[#12151c]/90 hover:bg-[#1e2433] px-2 py-1 rounded-lg border border-[#2b303c] text-[10px] text-[#94a3b8] hover:text-white cursor-pointer transition-colors">
                      <RefreshCw className="w-3 h-3" />
                      <span>Change Image</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>

                  {/* Transparency & Sensitivity Controls */}
                  <div className="p-3.5 bg-[#12151c] border border-[#2b303c] rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-semibold text-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={removeBg}
                          onChange={(e) => setRemoveBg(e.target.checked)}
                          className="w-4 h-4 rounded accent-[#c9f227] cursor-pointer"
                        />
                        <span>Make background transparent</span>
                      </label>
                      <span className="text-[10px] text-[#64748b]">Smooth anti-aliased strokes</span>
                    </div>

                    {removeBg && (
                      <>
                        <div className="space-y-1.5 pt-1 border-t border-[#232936]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] text-[#94a3b8] flex items-center gap-1">
                              <SlidersHorizontal className="w-3 h-3" />
                              Shadow / Paper Sensitivity:
                            </span>
                            <span className="text-[11px] font-mono text-[#c9f227] font-bold">{sensitivity}%</span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max="95"
                            value={sensitivity}
                            onChange={(e) => setSensitivity(Number(e.target.value))}
                            className="w-full accent-[#c9f227] h-1.5 bg-[#232936] rounded-lg cursor-pointer"
                          />
                          <div className="flex items-center justify-between text-[10px] text-[#64748b]">
                            <span>Preserve light ink</span>
                            <span>Remove darker shadows</span>
                          </div>
                        </div>

                        {/* Ink Enhancement Mode */}
                        <div className="space-y-1 pt-1 border-t border-[#232936]">
                          <span className="text-[11px] text-[#94a3b8] block">Ink Tone:</span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { id: 'original', label: 'Original' },
                              { id: 'crisp_dark', label: 'Crisp Dark' },
                              { id: 'executive_blue', label: 'Exec Blue' },
                              { id: 'black', label: 'Pure Black' },
                            ].map((mode) => (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() => setInkColorMode(mode.id as InkColorMode)}
                                className={`py-1.5 px-2 text-[10px] font-semibold rounded-lg border transition-all cursor-pointer truncate ${
                                  inkColorMode === mode.id
                                    ? 'bg-[#c9f227]/20 border-[#c9f227] text-[#c9f227]'
                                    : 'bg-[#181d27] border-[#2b303c] text-[#94a3b8] hover:text-white'
                                }`}
                              >
                                {mode.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#2b303c] bg-[#12151c] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleAdopt}
            disabled={(tab === 'draw' && !hasDrawn) || (tab === 'upload' && !uploadedImage) || isProcessing}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              (tab === 'draw' && !hasDrawn) || (tab === 'upload' && !uploadedImage) || isProcessing
                ? 'bg-[#2b303c] text-[#64748b] cursor-not-allowed'
                : 'bg-[#c9f227] text-[#12151c] hover:bg-[#b5dc1f] shadow-md'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Adopt & Place on PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
