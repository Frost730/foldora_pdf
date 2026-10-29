import React, { useState, useEffect, useRef } from 'react';
import { fetchPreview } from '../../services/api';
import { PreviewResponse, TextSpan, VisualEditItem } from '../../types';
import {
  MousePointer,
  Edit3,
  Type,
  Image as ImageIcon,
  PenTool,
  Square,
  Circle,
  Eraser,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  Download,
  Maximize2
} from 'lucide-react';

interface VisualPdfEditorProps {
  file: File;
  onApplyEdits: (edits: VisualEditItem[]) => void;
  isProcessing?: boolean;
}

type ActiveTool = 'select' | 'edit-text' | 'add-text' | 'image' | 'draw' | 'whiteout' | 'shape-rect' | 'shape-circle';

const COLOR_PRESETS = [
  '#111827', // Black
  '#2563eb', // Blue
  '#dc2626', // Red
  '#059669', // Green
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#ffffff', // White
];

export const VisualPdfEditor: React.FC<VisualPdfEditorProps> = ({
  file,
  onApplyEdits,
  isProcessing = false,
}) => {
  // Navigation & Document State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadingPage, setLoadingPage] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(100);

  // Active Tool & Styling Options
  const [activeTool, setActiveTool] = useState<ActiveTool>('edit-text');
  const [activeColor, setActiveColor] = useState<string>('#111827');
  const [fontSize, setFontSize] = useState<number>(14);
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [hasBgColor, setHasBgColor] = useState<boolean>(false);

  // Staged Edits across all pages
  const [edits, setEdits] = useState<VisualEditItem[]>([]);
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);

  // Interactive In-Place Text Editing (clicked from existing text span)
  const [editingSpan, setEditingSpan] = useState<{
    span: TextSpan;
    replaceText: string;
  } | null>(null);

  // Canvas / Drawing state
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentStroke, setCurrentStroke] = useState<[number, number][]>([]);

  // Dragging state for movable elements
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load preview whenever file or currentPage changes
  useEffect(() => {
    let isCancelled = false;
    setLoadingPage(true);
    fetchPreview(file, currentPage - 1, 1000)
      .then((res) => {
        if (!isCancelled) {
          setPreview(res);
          setTotalPages(res.total_pages);
          setLoadingPage(false);
        }
      })
      .catch(() => {
        if (!isCancelled) setLoadingPage(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [file, currentPage]);

  // Coordinate conversion factors
  const imgWidth = preview?.width || 600;
  const imgHeight = preview?.height || 800;
  const ptWidth = preview?.page_width_pt || 612;
  const ptHeight = preview?.page_height_pt || 792;
  const scaleX = ptWidth / imgWidth;
  const scaleY = ptHeight / imgHeight;

  // Filter edits for current active page
  const currentPageEdits = edits.filter((e) => e.page === currentPage);

  // 1. Handle clicking on existing PDF text span (In-Place Edit Text)
  const handleSpanClick = (span: TextSpan) => {
    // If there is already an edit for this span's position, find it
    const existing = edits.find(
      (e) =>
        e.type === 'replace_text' &&
        e.page === currentPage &&
        e.bbox &&
        Math.abs(e.bbox[0] - span.bbox[0]) < 2 &&
        Math.abs(e.bbox[1] - span.bbox[1]) < 2
    );

    setEditingSpan({
      span,
      replaceText: existing?.replace_text || span.text,
    });
  };

  const handleSaveSpanEdit = () => {
    if (!editingSpan) return;
    const { span, replaceText } = editingSpan;

    // Remove existing edit for this span if any
    setEdits((prev) =>
      prev.filter(
        (e) =>
          !(
            e.type === 'replace_text' &&
            e.page === currentPage &&
            e.bbox &&
            Math.abs(e.bbox[0] - span.bbox[0]) < 2 &&
            Math.abs(e.bbox[1] - span.bbox[1]) < 2
          )
      )
    );

    if (replaceText.trim() !== '') {
      const newEdit: VisualEditItem = {
        id: `replace_${Date.now()}`,
        type: 'replace_text',
        page: currentPage,
        find_text: span.text,
        replace_text: replaceText,
        bbox: span.bbox,
        size: span.size,
        color: span.color || activeColor,
      };
      setEdits((prev) => [...prev, newEdit]);
    }
    setEditingSpan(null);
  };

  // 2. Handle Canvas Click to add Text / Shapes / Whiteout
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editingSpan) return;
    if (activeTool === 'select' || activeTool === 'edit-text') return;

    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Position in image pixels
    const clickX = (e.clientX - rect.left) / (zoom / 100);
    const clickY = (e.clientY - rect.top) / (zoom / 100);

    // Convert to PDF point coordinates
    const ptX = Math.round(clickX * scaleX);
    const ptY = Math.round(clickY * scaleY);

    if (activeTool === 'add-text') {
      const newText: VisualEditItem = {
        id: `text_${Date.now()}`,
        type: 'add_text',
        page: currentPage,
        text: 'Type text here',
        x: ptX,
        y: ptY,
        size: fontSize,
        color: activeColor,
        bg_color: hasBgColor ? '#ffffff' : undefined,
      };
      setEdits((prev) => [...prev, newText]);
      setSelectedEditId(newText.id);
      setActiveTool('select');
    } else if (activeTool === 'whiteout') {
      const newWhiteout: VisualEditItem = {
        id: `whiteout_${Date.now()}`,
        type: 'whiteout',
        page: currentPage,
        x: ptX,
        y: ptY,
        w: 120,
        h: 24,
      };
      setEdits((prev) => [...prev, newWhiteout]);
      setSelectedEditId(newWhiteout.id);
      setActiveTool('select');
    } else if (activeTool === 'shape-rect') {
      const newShape: VisualEditItem = {
        id: `rect_${Date.now()}`,
        type: 'shape',
        shape_type: 'rect',
        page: currentPage,
        x: ptX,
        y: ptY,
        w: 140,
        h: 80,
        stroke_color: activeColor,
        stroke_width: strokeWidth,
        fill_color: hasBgColor ? '#ffffff' : 'transparent',
      };
      setEdits((prev) => [...prev, newShape]);
      setSelectedEditId(newShape.id);
      setActiveTool('select');
    } else if (activeTool === 'shape-circle') {
      const newShape: VisualEditItem = {
        id: `circle_${Date.now()}`,
        type: 'shape',
        shape_type: 'circle',
        page: currentPage,
        x: ptX,
        y: ptY,
        w: 100,
        h: 100,
        stroke_color: activeColor,
        stroke_width: strokeWidth,
        fill_color: hasBgColor ? '#ffffff' : 'transparent',
      };
      setEdits((prev) => [...prev, newShape]);
      setSelectedEditId(newShape.id);
      setActiveTool('select');
    }
  };

  // 3. Freehand Drawing Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'draw') return;
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / (zoom / 100)) * scaleX;
    const y = ((e.clientY - rect.top) / (zoom / 100)) * scaleY;

    setIsDrawing(true);
    setCurrentStroke([[x, y]]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || activeTool !== 'draw') return;
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / (zoom / 100)) * scaleX;
    const y = ((e.clientY - rect.top) / (zoom / 100)) * scaleY;

    setCurrentStroke((prev) => [...prev, [x, y]]);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length >= 2) {
      const newDrawing: VisualEditItem = {
        id: `draw_${Date.now()}`,
        type: 'drawing',
        page: currentPage,
        points: currentStroke,
        stroke_color: activeColor,
        stroke_width: strokeWidth,
      };
      setEdits((prev) => [...prev, newDrawing]);
    }
    setCurrentStroke([]);
  };

  // 4. Image Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      const newImg: VisualEditItem = {
        id: `img_${Date.now()}`,
        type: 'image',
        page: currentPage,
        image_base64: b64,
        x: 100,
        y: 100,
        w: 150,
        h: 100,
      };
      setEdits((prev) => [...prev, newImg]);
      setSelectedEditId(newImg.id);
      setActiveTool('select');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 5. Element Dragging & Moving
  const startDrag = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEditId(id);
    setDraggingId(id);
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (rect) {
      const item = edits.find((i) => i.id === id);
      if (item && item.x !== undefined && item.y !== undefined) {
        const mouseX = ((e.clientX - rect.left) / (zoom / 100)) * scaleX;
        const mouseY = ((e.clientY - rect.top) / (zoom / 100)) * scaleY;
        setDragOffset({ x: mouseX - item.x, y: mouseY - item.y });
      }
    }
  };

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'draw') {
      handleMouseMove(e);
      return;
    }
    if (!draggingId) return;

    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = ((e.clientX - rect.left) / (zoom / 100)) * scaleX;
    const mouseY = ((e.clientY - rect.top) / (zoom / 100)) * scaleY;

    const newX = Math.max(0, Math.round(mouseX - dragOffset.x));
    const newY = Math.max(0, Math.round(mouseY - dragOffset.y));

    setEdits((prev) =>
      prev.map((item) => (item.id === draggingId ? { ...item, x: newX, y: newY } : item))
    );
  };

  const handleContainerMouseUp = () => {
    if (activeTool === 'draw') {
      handleMouseUp();
    }
    setDraggingId(null);
  };

  // 6. Delete Selected Edit
  const deleteSelected = () => {
    if (!selectedEditId) return;
    setEdits((prev) => prev.filter((i) => i.id !== selectedEditId));
    setSelectedEditId(null);
  };

  return (
    <div className="flex flex-col bg-[#12151c] rounded-2xl overflow-hidden border border-[#2b303c] shadow-2xl text-white">
      {/* ========================================================================= */}
      {/* 1. TOP EDITING TOOLBAR (Detto iLovePDF)                                   */}
      {/* ========================================================================= */}
      <div className="bg-[#181d27] border-b border-[#2b303c] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left tool selection buttons */}
        <div className="flex items-center gap-1 bg-[#12151c] p-1 rounded-xl border border-[#2b303c]">
          <button
            type="button"
            onClick={() => setActiveTool('select')}
            title="Select & Move (V)"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'select'
                ? 'bg-[#c9f227] text-[#12151c] shadow-xs'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#232936]'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Select</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('edit-text')}
            title="Click any text on PDF to edit it directly"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'edit-text'
                ? 'bg-[#c9f227] text-[#12151c] shadow-xs'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#232936]'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Text</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('add-text')}
            title="Add new text box"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'add-text'
                ? 'bg-[#c9f227] text-[#12151c] shadow-xs'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#232936]'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Text</span>
          </button>

          <label
            title="Add image / stamp"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'image'
                ? 'bg-[#c9f227] text-[#12151c] shadow-xs'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#232936]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Image</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => setActiveTool('draw')}
            title="Draw Freehand / Signature"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'draw'
                ? 'bg-[#c9f227] text-[#12151c] shadow-xs'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#232936]'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Draw</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('whiteout')}
            title="Whiteout / Erase area"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'whiteout'
                ? 'bg-[#c9f227] text-[#12151c] shadow-xs'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#232936]'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Whiteout</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('shape-rect')}
            title="Add Rectangle"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTool === 'shape-rect'
                ? 'bg-[#c9f227] text-[#12151c]'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#232936]'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('shape-circle')}
            title="Add Circle"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTool === 'shape-circle'
                ? 'bg-[#c9f227] text-[#12151c]'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#232936]'
            }`}
          >
            <Circle className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center Formatting Controls */}
        <div className="flex items-center gap-3">
          {/* Color palette */}
          <div className="flex items-center gap-1">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveColor(c)}
                className={`w-5 h-5 rounded-full border border-[#475569] transition-transform ${
                  activeColor === c ? 'scale-125 ring-2 ring-[#c9f227]' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={activeColor}
              onChange={(e) => setActiveColor(e.target.value)}
              className="w-5 h-5 rounded-full bg-transparent cursor-pointer border-0 ml-1"
              title="Custom Color"
            />
          </div>

          {/* Font Size (if text tool) */}
          {(activeTool === 'add-text' || activeTool === 'edit-text' || selectedEditId) && (
            <select
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="bg-[#12151c] text-xs text-white border border-[#2b303c] rounded-lg px-2 py-1 focus:outline-none"
            >
              {[10, 12, 14, 16, 18, 20, 24, 32, 48].map((s) => (
                <option key={s} value={s}>
                  {s} pt
                </option>
              ))}
            </select>
          )}

          {/* Stroke Width (if draw or shape) */}
          {(activeTool === 'draw' || activeTool === 'shape-rect' || activeTool === 'shape-circle') && (
            <select
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="bg-[#12151c] text-xs text-white border border-[#2b303c] rounded-lg px-2 py-1 focus:outline-none"
            >
              {[1, 2, 4, 6, 8].map((w) => (
                <option key={w} value={w}>
                  {w}px stroke
                </option>
              ))}
            </select>
          )}

          {/* Delete Element Button */}
          {selectedEditId && (
            <button
              type="button"
              onClick={deleteSelected}
              className="p-1.5 text-[#ef4444] hover:bg-[#ef4444]/20 rounded-lg transition-colors cursor-pointer"
              title="Delete selected item"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right Zoom & View Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(50, z - 15))}
            className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#232936] rounded-lg cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-[#94a3b8] min-w-[42px] text-center">{zoom}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(200, z + 15))}
            className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#232936] rounded-lg cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE BODY: Sidebar Thumbnails + Center Interactive Canvas   */}
      {/* ========================================================================= */}
      <div className="flex flex-1 min-h-[560px] max-h-[760px] overflow-hidden bg-[#0d1017]">
        {/* Left Thumbnails Strip */}
        <div className="w-28 sm:w-36 bg-[#141822] border-r border-[#2b303c] p-2 overflow-y-auto space-y-2 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] px-1 py-1 text-center">
            Pages ({totalPages})
          </div>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
            const hasEditsOnPage = edits.some((e) => e.page === pg);
            return (
              <div
                key={pg}
                onClick={() => setCurrentPage(pg)}
                className={`p-1.5 rounded-xl border text-center cursor-pointer transition-all ${
                  currentPage === pg
                    ? 'border-[#c9f227] bg-[#1e2433] ring-2 ring-[#c9f227]/30'
                    : 'border-[#232936] bg-[#0d1017] hover:border-[#475569]'
                }`}
              >
                <div className="w-full aspect-[3/4] bg-[#222734] rounded-lg flex items-center justify-center text-xs text-[#94a3b8] relative overflow-hidden">
                  <span>Page {pg}</span>
                  {hasEditsOnPage && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-[#c9f227] rounded-full" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Center Interactive Canvas View */}
        <div
          className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center relative select-none"
          onMouseMove={handleContainerMouseMove}
          onMouseUp={handleContainerMouseUp}
        >
          {loadingPage ? (
            <div className="flex flex-col items-center justify-center space-y-2 text-[#94a3b8]">
              <Loader2 className="w-8 h-8 animate-spin text-[#c9f227]" />
              <span className="text-xs">Loading page {currentPage}...</span>
            </div>
          ) : preview ? (
            <div
              ref={canvasContainerRef}
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              style={{
                width: `${imgWidth * (zoom / 100)}px`,
                height: `${imgHeight * (zoom / 100)}px`,
                cursor:
                  activeTool === 'edit-text'
                    ? 'text'
                    : activeTool === 'add-text'
                    ? 'crosshair'
                    : activeTool === 'draw'
                    ? 'crosshair'
                    : activeTool === 'whiteout'
                    ? 'cell'
                    : 'default',
              }}
              className="relative bg-white shadow-2xl transition-all origin-top"
            >
              {/* Underlying rendered PDF page image */}
              <img
                src={preview.image_base64}
                alt={`Page ${currentPage}`}
                className="w-full h-full object-contain pointer-events-none"
              />

              {/* ------------------------------------------------------------- */}
              {/* INTERACTIVE SPANS LAYER: Hoverable & Clickable Existing Text  */}
              {/* ------------------------------------------------------------- */}
              {activeTool === 'edit-text' &&
                preview.text_spans?.map((span, sIdx) => {
                  const left = (span.bbox[0] / scaleX) * (zoom / 100);
                  const top = (span.bbox[1] / scaleY) * (zoom / 100);
                  const width = ((span.bbox[2] - span.bbox[0]) / scaleX) * (zoom / 100);
                  const height = ((span.bbox[3] - span.bbox[1]) / scaleY) * (zoom / 100);

                  return (
                    <div
                      key={sIdx}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpanClick(span);
                      }}
                      title={`Click to edit: "${span.text}"`}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${Math.max(width, 14)}px`,
                        height: `${Math.max(height, 12)}px`,
                      }}
                      className="absolute border border-dashed border-[#2563eb]/40 bg-[#2563eb]/10 hover:bg-[#2563eb]/30 hover:border-[#2563eb] rounded-xs cursor-pointer transition-colors group"
                    />
                  );
                })}

              {/* ------------------------------------------------------------- */}
              {/* STAGED EDITS ON CURRENT PAGE                                  */}
              {/* ------------------------------------------------------------- */}
              {currentPageEdits.map((item) => {
                // If it's a replaced text span
                if (item.type === 'replace_text' && item.bbox) {
                  const left = (item.bbox[0] / scaleX) * (zoom / 100);
                  const top = (item.bbox[1] / scaleY) * (zoom / 100);
                  const width = ((item.bbox[2] - item.bbox[0]) / scaleX) * (zoom / 100);
                  const height = ((item.bbox[3] - item.bbox[1]) / scaleY) * (zoom / 100);

                  return (
                    <div
                      key={item.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEditId(item.id);
                      }}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        minWidth: `${width}px`,
                        height: `${height}px`,
                        color: item.color || '#111827',
                        fontSize: `${(item.size || 12) * (zoom / 100)}px`,
                      }}
                      className="absolute bg-white px-0.5 flex items-center font-sans whitespace-nowrap shadow-xs ring-1 ring-[#c9f227] cursor-pointer"
                    >
                      {item.replace_text}
                    </div>
                  );
                }

                // If it's an added custom text box
                if (item.type === 'add_text' && item.x !== undefined && item.y !== undefined) {
                  const left = (item.x / scaleX) * (zoom / 100);
                  const top = (item.y / scaleY) * (zoom / 100);
                  const isSelected = selectedEditId === item.id;

                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => startDrag(item.id, e)}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        fontSize: `${(item.size || 14) * (zoom / 100)}px`,
                        color: item.color || '#111827',
                        backgroundColor: item.bg_color || 'transparent',
                      }}
                      className={`absolute px-2 py-0.5 rounded cursor-move whitespace-nowrap ${
                        isSelected
                          ? 'ring-2 ring-[#c9f227] bg-[#c9f227]/20 shadow-md'
                          : 'hover:ring-1 hover:ring-[#2563eb]'
                      }`}
                    >
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEdits((prev) =>
                            prev.map((it) => (it.id === item.id ? { ...it, text: val } : it))
                          );
                        }}
                        className="bg-transparent border-0 outline-none font-sans"
                      />
                    </div>
                  );
                }

                // If it's a whiteout eraser block
                if (item.type === 'whiteout' && item.x !== undefined && item.y !== undefined) {
                  const left = (item.x / scaleX) * (zoom / 100);
                  const top = (item.y / scaleY) * (zoom / 100);
                  const w = ((item.w || 120) / scaleX) * (zoom / 100);
                  const h = ((item.h || 24) / scaleY) * (zoom / 100);
                  const isSelected = selectedEditId === item.id;

                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => startDrag(item.id, e)}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${w}px`,
                        height: `${h}px`,
                      }}
                      className={`absolute bg-white shadow-xs cursor-move ${
                        isSelected ? 'border-2 border-[#ef4444]' : 'border border-dashed border-[#cbd5e1]'
                      }`}
                    />
                  );
                }

                // If it's a shape
                if (item.type === 'shape' && item.x !== undefined && item.y !== undefined) {
                  const left = (item.x / scaleX) * (zoom / 100);
                  const top = (item.y / scaleY) * (zoom / 100);
                  const w = ((item.w || 100) / scaleX) * (zoom / 100);
                  const h = ((item.h || 60) / scaleY) * (zoom / 100);
                  const isSelected = selectedEditId === item.id;

                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => startDrag(item.id, e)}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${w}px`,
                        height: `${h}px`,
                        borderColor: item.stroke_color || '#111827',
                        borderWidth: `${item.stroke_width || 2}px`,
                        backgroundColor: item.fill_color || 'transparent',
                        borderRadius: item.shape_type === 'circle' ? '9999px' : '4px',
                      }}
                      className={`absolute cursor-move ${
                        isSelected ? 'ring-2 ring-[#c9f227]' : ''
                      }`}
                    />
                  );
                }

                // If it's an uploaded image / stamp
                if (item.type === 'image' && item.x !== undefined && item.y !== undefined) {
                  const left = (item.x / scaleX) * (zoom / 100);
                  const top = (item.y / scaleY) * (zoom / 100);
                  const w = ((item.w || 150) / scaleX) * (zoom / 100);
                  const h = ((item.h || 100) / scaleY) * (zoom / 100);
                  const isSelected = selectedEditId === item.id;

                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => startDrag(item.id, e)}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${w}px`,
                        height: `${h}px`,
                      }}
                      className={`absolute cursor-move overflow-hidden rounded ${
                        isSelected ? 'ring-2 ring-[#c9f227]' : ''
                      }`}
                    >
                      <img src={item.image_base64} alt="Stamp" className="w-full h-full object-contain pointer-events-none" />
                    </div>
                  );
                }

                return null;
              })}

              {/* SVG Overlay for Freehand Drawing Strokes */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {currentPageEdits
                  .filter((e) => e.type === 'drawing' && e.points)
                  .map((draw) => {
                    const pts = draw.points!
                      .map(([x, y]) => `${(x / scaleX) * (zoom / 100)},${(y / scaleY) * (zoom / 100)}`)
                      .join(' ');
                    return (
                      <polyline
                        key={draw.id}
                        points={pts}
                        fill="none"
                        stroke={draw.stroke_color || '#2563eb'}
                        strokeWidth={(draw.stroke_width || 2) * (zoom / 100)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })}

                {/* Currently active freehand stroke */}
                {isDrawing && currentStroke.length > 1 && (
                  <polyline
                    points={currentStroke
                      .map(([x, y]) => `${(x / scaleX) * (zoom / 100)},${(y / scaleY) * (zoom / 100)}`)
                      .join(' ')}
                    fill="none"
                    stroke={activeColor}
                    strokeWidth={strokeWidth * (zoom / 100)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>

              {/* ------------------------------------------------------------- */}
              {/* MODAL POPOVER: In-Place Text Edit on Click                    */}
              {/* ------------------------------------------------------------- */}
              {editingSpan && (
                <div
                  style={{
                    left: `${(editingSpan.span.bbox[0] / scaleX) * (zoom / 100)}px`,
                    top: `${(editingSpan.span.bbox[3] / scaleY) * (zoom / 100) + 4}px`,
                  }}
                  className="absolute z-50 bg-[#1e2433] border border-[#384152] rounded-xl p-3 shadow-2xl text-white space-y-2 min-w-[280px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-[11px] font-bold text-[#c9f227] flex items-center justify-between">
                    <span>Edit Text In-Place</span>
                    <span className="text-[10px] text-[#94a3b8] font-mono">
                      {editingSpan.span.size}pt
                    </span>
                  </div>

                  <input
                    type="text"
                    autoFocus
                    value={editingSpan.replaceText}
                    onChange={(e) =>
                      setEditingSpan({ ...editingSpan, replaceText: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveSpanEdit();
                      if (e.key === 'Escape') setEditingSpan(null);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#12151c] text-white border border-[#475569] rounded-lg focus:outline-none focus:border-[#c9f227]"
                  />

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingSpan(null)}
                      className="px-2.5 py-1 text-xs text-[#94a3b8] hover:text-white rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSpanEdit}
                      className="px-3 py-1 text-xs font-bold bg-[#c9f227] text-[#12151c] rounded-lg hover:bg-[#b5dc1f] flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Apply</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. BOTTOM BAR: Page Navigation & Primary "Apply & Download" CTA           */}
      {/* ========================================================================= */}
      <div className="bg-[#181d27] border-t border-[#2b303c] px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Page Switcher */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 text-[#94a3b8] hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded-lg border border-[#2b303c] cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono text-[#cbd5e1]">
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 text-[#94a3b8] hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded-lg border border-[#2b303c] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Staged edits count */}
        <div className="text-xs text-[#94a3b8] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#c9f227]" />
          <span>
            <strong>{edits.length}</strong> edit{edits.length === 1 ? '' : 's'} staged
          </span>
          {edits.length > 0 && (
            <button
              type="button"
              onClick={() => setEdits([])}
              className="text-[11px] text-[#ef4444] hover:underline ml-2 cursor-pointer"
            >
              Reset all
            </button>
          )}
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => onApplyEdits(edits)}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#c9f227] hover:bg-[#b5dc1f] text-[#12151c] text-xs font-bold rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Baking PDF...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Apply Edits & Download PDF</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
