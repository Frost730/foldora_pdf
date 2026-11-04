import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Sliders,
  RotateCw,
  Sun,
  Eye,
  Check,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface OcrPreprocessorProps {
  file?: File;
  onApplyPreprocessing?: (preprocessedFile: File, options: Record<string, any>) => void;
  options: Record<string, any>;
  onOptionsChange: (newOptions: Record<string, any>) => void;
}

export const OcrPreprocessor: React.FC<OcrPreprocessorProps> = ({
  file,
  onApplyPreprocessing,
  options,
  onOptionsChange,
}) => {
  const [contrastBoost, setContrastBoost] = useState<number>(30); // 0 to 100%
  const [binarize, setBinarize] = useState<boolean>(true);
  const [threshold, setThreshold] = useState<number>(140); // 0 to 255
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [sharpen, setSharpen] = useState<boolean>(true);
  const [previewLoaded, setPreviewLoaded] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load image if file is an image
  useEffect(() => {
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setPreviewLoaded(true);
        renderFilteredCanvas();
      };
      img.src = url;
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewLoaded(false);
    }
  }, [file]);

  const renderFilteredCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dimension calculation with rotation
    const isRotated = rotationAngle === 90 || rotationAngle === 270;
    const w = isRotated ? img.naturalHeight : img.naturalWidth;
    const h = isRotated ? img.naturalWidth : img.naturalHeight;

    // Limit preview canvas size for responsive performance
    const maxDim = 800;
    const scale = Math.min(1.0, maxDim / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotationAngle * Math.PI) / 180);
    ctx.drawImage(
      img,
      -(canvas.width / 2),
      -(canvas.height / 2),
      canvas.width,
      canvas.height
    );
    ctx.restore();

    // Pixel processing: Contrast + Grayscale / Binarize
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      const factor = (259 * (contrastBoost + 255)) / (255 * (259 - contrastBoost));

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Contrast adjustment
        r = Math.min(255, Math.max(0, factor * (r - 128) + 128));
        g = Math.min(255, Math.max(0, factor * (g - 128) + 128));
        b = Math.min(255, Math.max(0, factor * (b - 128) + 128));

        // Grayscale conversion
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        if (binarize) {
          // Binarize text vs background
          const val = gray < threshold ? 0 : 255;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        } else {
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
      }

      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Cross-origin fallback
    }
  };

  useEffect(() => {
    if (previewLoaded) {
      renderFilteredCanvas();
    }
  }, [contrastBoost, binarize, threshold, rotationAngle, sharpen, previewLoaded]);

  const handleApplyToOptions = () => {
    onOptionsChange({
      ...options,
      clean_scans: true,
      deskew: rotationAngle !== 0 || Boolean(options.deskew),
      contrast_boost: contrastBoost > 0,
      binarized: binarize,
    });

    if (canvasRef.current && file && file.type.startsWith('image/') && onApplyPreprocessing) {
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          const preprocessed = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '_preprocessed.png', {
            type: 'image/png',
          });
          onApplyPreprocessing(preprocessed, options);
        }
      }, 'image/png');
    }
  };

  return (
    <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2563eb] text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#12151c]">Client-Side OCR Preprocessing & Cleanup</h4>
            <p className="text-[11px] text-[#64748b]">Binarize and boost contrast to optimize text recognition accuracy.</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eff6ff] text-[#2563eb]">
          ⚡ Browser Accelerated
        </span>
      </div>

      {/* Preprocessing Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Contrast Boost */}
        <div className="p-3 bg-white border border-[#e2e8f0] rounded-xl space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-[#1e293b] flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-[#f59e0b]" /> Contrast Boost
            </span>
            <span className="font-mono text-[11px] font-bold text-[#2563eb]">+{contrastBoost}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="80"
            value={contrastBoost}
            onChange={(e) => setContrastBoost(Number(e.target.value))}
            className="w-full accent-[#2563eb] cursor-pointer"
          />
        </div>

        {/* Binarization / Threshold */}
        <div className="p-3 bg-white border border-[#e2e8f0] rounded-xl space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="font-semibold text-[#1e293b] flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={binarize}
                onChange={(e) => setBinarize(e.target.checked)}
                className="rounded text-[#2563eb]"
              />
              <span>Grayscale Binarization</span>
            </label>
            {binarize && <span className="font-mono text-[11px] text-[#64748b]">{threshold}</span>}
          </div>
          {binarize && (
            <input
              type="range"
              min="80"
              max="200"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-[#2563eb] cursor-pointer"
            />
          )}
        </div>
      </div>

      {/* Orientation / Deskew */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[#64748b] text-[11px]">Rotation / Deskew:</span>
          <button
            type="button"
            onClick={() => setRotationAngle((a) => (a + 90) % 360)}
            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#e2e8f0] rounded-lg hover:bg-[#f1f5f9] transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5 text-[#64748b]" />
            <span>{rotationAngle}°</span>
          </button>
          <label className="flex items-center gap-1.5 cursor-pointer text-[#334155] ml-2">
            <input
              type="checkbox"
              checked={Boolean(options.clean_scans ?? true)}
              onChange={(e) => onOptionsChange({ ...options, clean_scans: e.target.checked })}
              className="rounded text-[#2563eb]"
            />
            <span>Auto-clean artifacts</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-[#334155] ml-2">
            <input
              type="checkbox"
              checked={Boolean(options.deskew ?? true)}
              onChange={(e) => onOptionsChange({ ...options, deskew: e.target.checked })}
              className="rounded text-[#2563eb]"
            />
            <span>Auto-deskew</span>
          </label>
        </div>

        <button
          type="button"
          onClick={handleApplyToOptions}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#12151c] text-[#c9f227] rounded-xl font-bold text-xs hover:bg-[#1e2433] transition-colors shadow-xs"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Apply OCR Enhancements</span>
        </button>
      </div>

      {/* Live Canvas Preview if image loaded */}
      {previewLoaded && (
        <div className="pt-2 border-t border-[#e2e8f0] space-y-2">
          <span className="text-[10px] font-mono uppercase text-[#64748b] block">Live Enhanced Text Preview:</span>
          <div className="max-h-52 overflow-auto bg-white border border-[#cbd5e1] rounded-xl flex items-center justify-center p-2 shadow-inner">
            <canvas ref={canvasRef} className="max-w-full h-auto object-contain rounded" />
          </div>
        </div>
      )}
    </div>
  );
};
