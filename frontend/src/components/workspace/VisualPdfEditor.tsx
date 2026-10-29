import React, { useState, useEffect, useRef } from 'react';
import { fetchPreview } from '../../services/api';
import { PreviewResponse, TextSpan, VisualEditItem, VisualEditType } from '../../types';
import { SignatureModal } from './SignatureModal';
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
  Redo2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  Download,
  Highlighter,
  ArrowRight,
  Stamp,
  Copy,
  Bold,
  Italic,
  FileSignature
} from 'lucide-react';

interface VisualPdfEditorProps {
  file: File;
  onApplyEdits: (edits: VisualEditItem[]) => void;
  isProcessing?: boolean;
}

type ActiveTool =
  | 'select'
  | 'edit-text'
  | 'add-text'
  | 'image'
  | 'draw'
  | 'whiteout'
  | 'highlight'
  | 'line'
  | 'arrow'
  | 'shape-rect'
  | 'shape-circle';

const COLOR_PRESETS = [
  '#111827', // Pitch Black
  '#0f172a', // Deep Navy
  '#1d4ed8', // Classic Blue
  '#2563eb', // Royal Blue
  '#dc2626', // Red
  '#059669', // Emerald Green
  '#d97706', // Amber / Gold
  '#7c3aed', // Purple
  '#facc15', // Highlight Yellow
  '#ffffff', // Pure White
];

const STAMP_PRESETS = [
  { text: 'APPROVED', color: '#059669' },
  { text: 'CONFIDENTIAL', color: '#dc2626' },
  { text: 'DRAFT', color: '#d97706' },
  { text: 'PAID', color: '#2563eb' },
  { text: 'FINAL', color: '#111827' },
  { text: 'VOID', color: '#dc2626' },
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
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [activeColor, setActiveColor] = useState<string>('#111827');
  const [fontSize, setFontSize] = useState<number>(14);
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [hasBgColor, setHasBgColor] = useState<boolean>(false);

  // Staged Edits & Undo/Redo Stacks
  const [edits, setEdits] = useState<VisualEditItem[]>([]);
  const [undoStack, setUndoStack] = useState<VisualEditItem[][]>([]);
  const [redoStack, setRedoStack] = useState<VisualEditItem[][]>([]);
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);

  // Popups & Modals
  const [showSignatureModal, setShowSignatureModal] = useState<boolean>(false);
  const [showStampMenu, setShowStampMenu] = useState<boolean>(false);

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

  // Resizing state
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });

  // Record edit state with history for Undo/Redo
  const pushEdits = (newEdits: VisualEditItem[]) => {
    setUndoStack((prev) => [...prev, edits]);
    setRedoStack([]);
    setEdits(newEdits);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, edits]);
    setEdits(previous);
    setSelectedEditId(null);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, edits]);
    setEdits(next);
    setSelectedEditId(null);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEditId) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.key === 'Escape') {
        setSelectedEditId(null);
        setEditingSpan(null);
        setShowStampMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [edits, undoStack, redoStack, selectedEditId]);

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
  const selectedItem = edits.find((e) => e.id === selectedEditId);

  // Synchronize color selection with selected element
  const handleColorChange = (newColor: string) => {
    setActiveColor(newColor);
    if (selectedEditId) {
      pushEdits(
        edits.map((item) =>
          item.id === selectedEditId
            ? { ...item, color: newColor, stroke_color: newColor }
            : item
        )
      );
    }
  };

  // 1. In-Place Text Editing (clicked from existing text span)
  const handleSpanClick = (span: TextSpan) => {
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

    const filtered = edits.filter(
      (e) =>
        !(
          e.type === 'replace_text' &&
          e.page === currentPage &&
          e.bbox &&
          Math.abs(e.bbox[0] - span.bbox[0]) < 2 &&
          Math.abs(e.bbox[1] - span.bbox[1]) < 2
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
      pushEdits([...filtered, newEdit]);
    } else {
      pushEdits(filtered);
    }
    setEditingSpan(null);
  };

  // 2. Handle Canvas Click to add Text / Shapes / Whiteout / Highlights / Lines
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editingSpan) return;
    if (activeTool === 'select' || activeTool === 'edit-text' || activeTool === 'draw') return;

    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = (e.clientX - rect.left) / (zoom / 100);
    const clickY = (e.clientY - rect.top) / (zoom / 100);

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
        is_bold: isBold,
        is_italic: isItalic,
        bg_color: hasBgColor ? '#ffffff' : undefined,
      };
      pushEdits([...edits, newText]);
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
      pushEdits([...edits, newWhiteout]);
      setSelectedEditId(newWhiteout.id);
      setActiveTool('select');
    } else if (activeTool === 'highlight') {
      const newHighlight: VisualEditItem = {
        id: `hl_${Date.now()}`,
        type: 'highlight',
        page: currentPage,
        x: ptX,
        y: ptY,
        w: 140,
        h: 22,
        color: activeColor === '#111827' ? '#facc15' : activeColor,
      };
      pushEdits([...edits, newHighlight]);
      setSelectedEditId(newHighlight.id);
      setActiveTool('select');
    } else if (activeTool === 'line') {
      const newLine: VisualEditItem = {
        id: `line_${Date.now()}`,
        type: 'line',
        page: currentPage,
        x: ptX,
        y: ptY,
        w: 140,
        h: 0,
        stroke_color: activeColor,
        color: activeColor,
        stroke_width: strokeWidth,
      };
      pushEdits([...edits, newLine]);
      setSelectedEditId(newLine.id);
      setActiveTool('select');
    } else if (activeTool === 'arrow') {
      const newArrow: VisualEditItem = {
        id: `arrow_${Date.now()}`,
        type: 'line',
        is_arrow: true,
        page: currentPage,
        x: ptX,
        y: ptY,
        w: 140,
        h: 0,
        stroke_color: activeColor,
        color: activeColor,
        stroke_width: strokeWidth,
      };
      pushEdits([...edits, newArrow]);
      setSelectedEditId(newArrow.id);
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
        color: activeColor,
        stroke_width: strokeWidth,
        fill_color: hasBgColor ? '#ffffff' : 'transparent',
      };
      pushEdits([...edits, newShape]);
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
        color: activeColor,
        stroke_width: strokeWidth,
        fill_color: hasBgColor ? '#ffffff' : 'transparent',
      };
      pushEdits([...edits, newShape]);
      setSelectedEditId(newShape.id);
      setActiveTool('select');
    }
  };

  // 3. Freehand Drawing Handlers (Always preserve selected color!)
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
        color: activeColor, // Preserves the exact activeColor in backend and frontend!
        stroke_width: strokeWidth,
      };
      pushEdits([...edits, newDrawing]);
    }
    setCurrentStroke([]);
  };

  // 4. Image Upload & Signature Adoption Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

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
      pushEdits([...edits, newImg]);
      setSelectedEditId(newImg.id);
      setActiveTool('select');
    };
    reader.readAsDataURL(uploadedFile);
    e.target.value = '';
  };

  const handleAdoptSignature = (sigDataUrl: string) => {
    const newSig: VisualEditItem = {
      id: `sig_${Date.now()}`,
      type: 'image',
      page: currentPage,
      image_base64: sigDataUrl,
      x: 120,
      y: 180,
      w: 170,
      h: 65,
    };
    pushEdits([...edits, newSig]);
    setSelectedEditId(newSig.id);
    setActiveTool('select');
  };

  const handleAddStamp = (stampText: string, stampColor: string) => {
    const newStamp: VisualEditItem = {
      id: `stamp_${Date.now()}`,
      type: 'stamp',
      page: currentPage,
      text: stampText,
      color: stampColor,
      stroke_color: stampColor,
      x: 120,
      y: 160,
      w: 140,
      h: 45,
    };
    pushEdits([...edits, newStamp]);
    setSelectedEditId(newStamp.id);
    setShowStampMenu(false);
    setActiveTool('select');
  };

  // 5. Element Dragging & Resizing
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

  const startResize = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEditId(id);
    setResizingId(id);
    const item = edits.find((i) => i.id === id);
    if (item && item.w !== undefined && item.h !== undefined) {
      setResizeStart({ x: e.clientX, y: e.clientY, w: item.w, h: item.h });
    }
  };

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'draw') {
      handleMouseMove(e);
      return;
    }

    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (draggingId) {
      const mouseX = ((e.clientX - rect.left) / (zoom / 100)) * scaleX;
      const mouseY = ((e.clientY - rect.top) / (zoom / 100)) * scaleY;

      const newX = Math.max(0, Math.round(mouseX - dragOffset.x));
      const newY = Math.max(0, Math.round(mouseY - dragOffset.y));

      setEdits((prev) =>
        prev.map((item) => (item.id === draggingId ? { ...item, x: newX, y: newY } : item))
      );
    } else if (resizingId) {
      const deltaX = ((e.clientX - resizeStart.x) / (zoom / 100)) * scaleX;
      const deltaY = ((e.clientY - resizeStart.y) / (zoom / 100)) * scaleY;

      const newW = Math.max(30, Math.round(resizeStart.w + deltaX));
      const newH = Math.max(15, Math.round(resizeStart.h + deltaY));

      setEdits((prev) =>
        prev.map((item) => (item.id === resizingId ? { ...item, w: newW, h: newH } : item))
      );
    }
  };

  const handleContainerMouseUp = () => {
    if (activeTool === 'draw') {
      handleMouseUp();
    }
    if (draggingId || resizingId) {
      // Save state into undo stack
      setUndoStack((prev) => [...prev, edits]);
      setRedoStack([]);
    }
    setDraggingId(null);
    setResizingId(null);
  };

  // 6. Delete & Duplicate Selected Edit
  const deleteSelected = () => {
    if (!selectedEditId) return;
    pushEdits(edits.filter((i) => i.id !== selectedEditId));
    setSelectedEditId(null);
  };

  const duplicateSelected = () => {
    if (!selectedEditId) return;
    const item = edits.find((i) => i.id === selectedEditId);
    if (!item) return;

    const clone: VisualEditItem = {
      ...item,
      id: `${item.type}_${Date.now()}`,
      x: item.x !== undefined ? item.x + 20 : undefined,
      y: item.y !== undefined ? item.y + 20 : undefined,
    };
    pushEdits([...edits, clone]);
    setSelectedEditId(clone.id);
  };

  return (
    <div className="flex flex-col bg-[#12151c] rounded-2xl overflow-hidden border border-[#2b303c] shadow-2xl text-white">
      {/* ========================================================================= */}
      {/* 1. TOP EDITING TOOLBAR                                                    */}
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
            title="Add custom text box"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'add-text'
                ? 'bg-[#c9f227] text-[#12151c] shadow-xs'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#232936]'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Text</span>
          </button>

          {/* Dedicated Sign Button */}
          <button
            type="button"
            onClick={() => setShowSignatureModal(true)}
            title="Sign document (Draw, Type, or Upload Signature)"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-[#232936] text-[#c9f227] hover:bg-[#2d3446]"
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>Sign</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('draw')}
            title="Freehand Pen"
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
            onClick={() => setActiveTool('highlight')}
            title="Highlighter Marker"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'highlight'
                ? 'bg-[#c9f227] text-[#12151c] shadow-xs'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#232936]'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Highlight</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('whiteout')}
            title="Whiteout area"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'whiteout'
                ? 'bg-[#c9f227] text-[#12151c] shadow-xs'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#232936]'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Whiteout</span>
          </button>

          {/* Shapes & Lines */}
          <button
            type="button"
            onClick={() => setActiveTool('shape-rect')}
            title="Rectangle"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              activeTool === 'shape-rect' ? 'bg-[#c9f227] text-[#12151c]' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('shape-circle')}
            title="Circle"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              activeTool === 'shape-circle' ? 'bg-[#c9f227] text-[#12151c]' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Circle className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('arrow')}
            title="Arrow"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              activeTool === 'arrow' ? 'bg-[#c9f227] text-[#12151c]' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Stamp Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowStampMenu(!showStampMenu)}
              title="Rubber Stamps (Approved, Paid, Draft...)"
              className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#232936] rounded-lg transition-colors cursor-pointer"
            >
              <Stamp className="w-3.5 h-3.5" />
            </button>
            {showStampMenu && (
              <div className="absolute top-full mt-2 left-0 z-50 bg-[#1e2433] border border-[#384152] rounded-xl p-2 shadow-2xl space-y-1 min-w-[140px]">
                {STAMP_PRESETS.map((st) => (
                  <button
                    key={st.text}
                    type="button"
                    onClick={() => handleAddStamp(st.text, st.color)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wider hover:bg-[#2a3245] transition-colors flex items-center justify-between"
                    style={{ color: st.color }}
                  >
                    <span>{st.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <label
            title="Add image"
            className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#232936] rounded-lg transition-colors cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>

        {/* Center Formatting & Undo/Redo Controls */}
        <div className="flex items-center gap-3">
          {/* Undo & Redo */}
          <div className="flex items-center gap-0.5 bg-[#12151c] p-1 rounded-xl border border-[#2b303c]">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title="Undo (Ctrl+Z)"
              className="p-1.5 text-[#94a3b8] hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Redo (Ctrl+Y)"
              className="p-1.5 text-[#94a3b8] hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Color palette */}
          <div className="flex items-center gap-1">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleColorChange(c)}
                className={`w-5 h-5 rounded-full border border-[#475569] transition-transform ${
                  activeColor === c ? 'scale-125 ring-2 ring-[#c9f227]' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={activeColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-5 h-5 rounded-full bg-transparent cursor-pointer border-0 ml-1"
              title="Custom Color"
            />
          </div>

          {/* Text Formatting Controls */}
          {(activeTool === 'add-text' || (selectedItem && selectedItem.type === 'add_text')) && (
            <div className="flex items-center gap-1 bg-[#12151c] p-1 rounded-xl border border-[#2b303c]">
              <button
                type="button"
                onClick={() => setIsBold(!isBold)}
                title="Bold Text"
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isBold ? 'bg-[#c9f227] text-[#12151c]' : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsItalic(!isItalic)}
                title="Italic Text"
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  isItalic ? 'bg-[#c9f227] text-[#12151c]' : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setHasBgColor(!hasBgColor)}
                title="White Box Background"
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
                  hasBgColor ? 'bg-[#c9f227] text-[#12151c]' : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                BG
              </button>
            </div>
          )}

          {/* Font Size */}
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

          {/* Stroke Width */}
          {(activeTool === 'draw' || activeTool === 'line' || activeTool === 'arrow' || activeTool === 'shape-rect' || activeTool === 'shape-circle') && (
            <select
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="bg-[#12151c] text-xs text-white border border-[#2b303c] rounded-lg px-2 py-1 focus:outline-none"
            >
              {[1, 2, 3, 5, 8].map((w) => (
                <option key={w} value={w}>
                  {w}px stroke
                </option>
              ))}
            </select>
          )}

          {/* Action buttons on Selected element */}
          {selectedEditId && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={duplicateSelected}
                className="p-1.5 text-[#94a3b8] hover:text-white hover:bg-[#232936] rounded-lg transition-colors cursor-pointer"
                title="Duplicate (Copy)"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                className="p-1.5 text-[#ef4444] hover:bg-[#ef4444]/20 rounded-lg transition-colors cursor-pointer"
                title="Delete selected (Del)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Zoom & View Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(50, z - 15))}
            className="p-1.5 text-[#94a3b8] hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-[#cbd5e1] min-w-[40px] text-center">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(200, z + 15))}
            className="p-1.5 text-[#94a3b8] hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE: THUMBNAILS + CANVAS                                     */}
      {/* ========================================================================= */}
      <div className="flex flex-1 min-h-[600px] max-h-[78vh] overflow-hidden bg-[#0a0d14]">
        {/* Left Page Strip */}
        <div className="w-28 sm:w-36 bg-[#12151c] border-r border-[#2b303c] p-3 overflow-y-auto space-y-3 shrink-0 select-none">
          <span className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase block text-center">
            Pages ({totalPages})
          </span>
          <div className="space-y-2.5">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
              const hasEditsOnPage = edits.some((e) => e.page === pg);
              const isActive = currentPage === pg;
              return (
                <div
                  key={pg}
                  onClick={() => setCurrentPage(pg)}
                  className={`relative p-2 rounded-xl cursor-pointer transition-all border text-center ${
                    isActive
                      ? 'border-[#c9f227] bg-[#1e2433] shadow-md'
                      : 'border-[#2b303c] hover:border-[#475569] bg-[#181d27]'
                  }`}
                >
                  <div className="aspect-[3/4] bg-[#232936] rounded-lg mb-1 flex items-center justify-center text-xs font-mono text-[#94a3b8]">
                    Page {pg}
                  </div>
                  {hasEditsOnPage && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#c9f227]" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Central Document Canvas View */}
        <div
          className="flex-1 overflow-auto p-4 sm:p-8 flex items-start justify-center relative select-none"
          onMouseMove={handleContainerMouseMove}
          onMouseUp={handleContainerMouseUp}
          onClick={() => {
            setSelectedEditId(null);
            setShowStampMenu(false);
          }}
        >
          {loadingPage ? (
            <div className="flex flex-col items-center justify-center h-96 gap-3 text-xs text-[#94a3b8]">
              <Loader2 className="w-8 h-8 animate-spin text-[#c9f227]" />
              <span>Rendering page {currentPage}...</span>
            </div>
          ) : preview ? (
            <div
              ref={canvasContainerRef}
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              style={{
                width: `${imgWidth * (zoom / 100)}px`,
                height: `${imgHeight * (zoom / 100)}px`,
              }}
              className="relative shadow-2xl bg-white rounded-xs overflow-hidden cursor-crosshair transition-size"
            >
              {/* Rendered Background Document Image */}
              <img
                src={preview.image_base64}
                alt={`Page ${currentPage}`}
                className="w-full h-full object-contain pointer-events-none select-none"
                draggable={false}
              />

              {/* ------------------------------------------------------------- */}
              {/* Interactive Text Spans Layer (For In-Place Edit Text mode)     */}
              {/* ------------------------------------------------------------- */}
              {activeTool === 'edit-text' && preview.text_spans && (
                <div className="absolute inset-0 pointer-events-auto">
                  {preview.text_spans.map((span, sIdx) => {
                    const [x0, y0, x1, y1] = span.bbox;
                    const left = (x0 / scaleX) * (zoom / 100);
                    const top = (y0 / scaleY) * (zoom / 100);
                    const width = ((x1 - x0) / scaleX) * (zoom / 100);
                    const height = ((y1 - y0) / scaleY) * (zoom / 100);

                    const hasEditedThis = edits.some(
                      (e) =>
                        e.type === 'replace_text' &&
                        e.page === currentPage &&
                        e.bbox &&
                        Math.abs(e.bbox[0] - span.bbox[0]) < 2 &&
                        Math.abs(e.bbox[1] - span.bbox[1]) < 2
                    );

                    return (
                      <div
                        key={sIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpanClick(span);
                        }}
                        style={{
                          left: `${left}px`,
                          top: `${top}px`,
                          width: `${Math.max(width, 12)}px`,
                          height: `${Math.max(height, 12)}px`,
                        }}
                        title={`Click to edit: "${span.text}"`}
                        className={`absolute border border-dashed rounded-xs cursor-pointer transition-colors ${
                          hasEditedThis
                            ? 'border-[#10b981] bg-[#10b981]/20'
                            : 'border-[#2563eb]/40 bg-[#2563eb]/10 hover:bg-[#2563eb]/30 hover:border-[#2563eb]'
                        }`}
                      />
                    );
                  })}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* Render Staged Interactive Elements on this page               */}
              {/* ------------------------------------------------------------- */}
              {currentPageEdits.map((item) => {
                const isSelected = selectedEditId === item.id;

                if (item.type === 'replace_text' && item.bbox) {
                  const [x0, y0, x1, y1] = item.bbox;
                  const left = (x0 / scaleX) * (zoom / 100);
                  const top = (y0 / scaleY) * (zoom / 100);
                  const width = ((x1 - x0) / scaleX) * (zoom / 100);
                  const height = ((y1 - y0) / scaleY) * (zoom / 100);

                  return (
                    <div
                      key={item.id}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        minWidth: `${width}px`,
                        height: `${height}px`,
                      }}
                      className="absolute bg-white px-1 flex items-center shadow-xs border border-[#10b981] rounded-xs pointer-events-none"
                    >
                      <span
                        style={{
                          fontSize: `${(item.size || 12) * (zoom / 100)}px`,
                          color: item.color || '#111827',
                          lineHeight: 1,
                        }}
                        className="font-medium truncate"
                      >
                        {item.replace_text}
                      </span>
                    </div>
                  );
                }

                if (item.type === 'add_text') {
                  const left = ((item.x || 0) / scaleX) * (zoom / 100);
                  const top = ((item.y || 0) / scaleY) * (zoom / 100);

                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => startDrag(item.id, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEditId(item.id);
                      }}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                      }}
                      className={`absolute px-2 py-0.5 rounded cursor-move select-none ${
                        isSelected ? 'ring-2 ring-[#c9f227] bg-[#c9f227]/10' : ''
                      }`}
                    >
                      <span
                        style={{
                          fontSize: `${(item.size || 14) * (zoom / 100)}px`,
                          color: item.color || '#111827',
                          backgroundColor: item.bg_color || 'transparent',
                          fontWeight: item.is_bold ? 'bold' : 'normal',
                          fontStyle: item.is_italic ? 'italic' : 'normal',
                          lineHeight: 1.2,
                        }}
                        className="inline-block whitespace-nowrap"
                      >
                        {item.text}
                      </span>
                    </div>
                  );
                }

                if (item.type === 'highlight') {
                  const left = ((item.x || 0) / scaleX) * (zoom / 100);
                  const top = ((item.y || 0) / scaleY) * (zoom / 100);
                  const w = ((item.w || 140) / scaleX) * (zoom / 100);
                  const h = ((item.h || 22) / scaleY) * (zoom / 100);

                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => startDrag(item.id, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEditId(item.id);
                      }}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${w}px`,
                        height: `${h}px`,
                        backgroundColor: item.color || '#facc15',
                        opacity: 0.4,
                      }}
                      className={`absolute rounded-xs cursor-move mix-blend-multiply ${
                        isSelected ? 'ring-2 ring-[#c9f227]' : ''
                      }`}
                    >
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResize(item.id, e)}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-[#c9f227] border border-black rounded-full cursor-nwse-resize"
                        />
                      )}
                    </div>
                  );
                }

                if (item.type === 'line') {
                  const left = ((item.x || 0) / scaleX) * (zoom / 100);
                  const top = ((item.y || 0) / scaleY) * (zoom / 100);
                  const w = ((item.w || 140) / scaleX) * (zoom / 100);
                  const strokeCol = item.stroke_color || item.color || '#111827';
                  const strokeW = (item.stroke_width || 2) * (zoom / 100);

                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => startDrag(item.id, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEditId(item.id);
                      }}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${w}px`,
                        height: `${Math.max(20, strokeW + 10)}px`,
                      }}
                      className={`absolute cursor-move flex items-center ${
                        isSelected ? 'ring-1 ring-[#c9f227]' : ''
                      }`}
                    >
                      <svg className="w-full h-full overflow-visible">
                        <line
                          x1="0"
                          y1="10"
                          x2={w}
                          y2="10"
                          stroke={strokeCol}
                          strokeWidth={strokeW}
                        />
                        {item.is_arrow && (
                          <polygon
                            points={`${w},10 ${w - 8},6 ${w - 8},14`}
                            fill={strokeCol}
                          />
                        )}
                      </svg>
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResize(item.id, e)}
                          className="absolute -right-1.5 w-3.5 h-3.5 bg-[#c9f227] border border-black rounded-full cursor-ew-resize"
                        />
                      )}
                    </div>
                  );
                }

                if (item.type === 'whiteout') {
                  const left = ((item.x || 0) / scaleX) * (zoom / 100);
                  const top = ((item.y || 0) / scaleY) * (zoom / 100);
                  const w = ((item.w || 120) / scaleX) * (zoom / 100);
                  const h = ((item.h || 24) / scaleY) * (zoom / 100);

                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => startDrag(item.id, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEditId(item.id);
                      }}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${w}px`,
                        height: `${h}px`,
                      }}
                      className={`absolute bg-white border border-[#e2e8f0] shadow-xs cursor-move ${
                        isSelected ? 'ring-2 ring-[#c9f227]' : ''
                      }`}
                    >
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResize(item.id, e)}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-[#c9f227] border border-black rounded-full cursor-nwse-resize"
                        />
                      )}
                    </div>
                  );
                }

                if (item.type === 'shape') {
                  const left = ((item.x || 0) / scaleX) * (zoom / 100);
                  const top = ((item.y || 0) / scaleY) * (zoom / 100);
                  const w = ((item.w || 100) / scaleX) * (zoom / 100);
                  const h = ((item.h || 50) / scaleY) * (zoom / 100);

                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => startDrag(item.id, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEditId(item.id);
                      }}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${w}px`,
                        height: `${h}px`,
                        borderWidth: `${(item.stroke_width || 2) * (zoom / 100)}px`,
                        borderColor: item.stroke_color || item.color || '#111827',
                        borderStyle: 'solid',
                        backgroundColor: item.fill_color || 'transparent',
                        borderRadius: item.shape_type === 'circle' ? '9999px' : '4px',
                      }}
                      className={`absolute cursor-move ${isSelected ? 'ring-2 ring-[#c9f227]' : ''}`}
                    >
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResize(item.id, e)}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-[#c9f227] border border-black rounded-full cursor-nwse-resize"
                        />
                      )}
                    </div>
                  );
                }

                if (item.type === 'image') {
                  const left = ((item.x || 0) / scaleX) * (zoom / 100);
                  const top = ((item.y || 0) / scaleY) * (zoom / 100);
                  const w = ((item.w || 150) / scaleX) * (zoom / 100);
                  const h = ((item.h || 100) / scaleY) * (zoom / 100);

                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => startDrag(item.id, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEditId(item.id);
                      }}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${w}px`,
                        height: `${h}px`,
                      }}
                      className={`absolute cursor-move select-none ${
                        isSelected ? 'ring-2 ring-[#c9f227] border border-dashed border-[#c9f227]' : ''
                      }`}
                    >
                      <img
                        src={item.image_base64}
                        alt="Staged"
                        className="w-full h-full object-contain pointer-events-none"
                      />
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResize(item.id, e)}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-[#c9f227] border border-black rounded-full cursor-nwse-resize"
                        />
                      )}
                    </div>
                  );
                }

                if (item.type === 'stamp') {
                  const left = ((item.x || 0) / scaleX) * (zoom / 100);
                  const top = ((item.y || 0) / scaleY) * (zoom / 100);
                  const w = ((item.w || 140) / scaleX) * (zoom / 100);
                  const h = ((item.h || 45) / scaleY) * (zoom / 100);
                  const stampCol = item.color || '#dc2626';

                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => startDrag(item.id, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEditId(item.id);
                      }}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${w}px`,
                        height: `${h}px`,
                        borderColor: stampCol,
                        color: stampCol,
                      }}
                      className={`absolute border-2 rounded-lg cursor-move flex items-center justify-center font-black font-mono tracking-widest uppercase select-none -rotate-6 ${
                        isSelected ? 'ring-2 ring-[#c9f227]' : ''
                      }`}
                    >
                      <span style={{ fontSize: `${16 * (zoom / 100)}px` }}>{item.text}</span>
                    </div>
                  );
                }

                return null;
              })}

              {/* SVG Overlay for Freehand Drawing Strokes (Always Uses Exact Color!) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {currentPageEdits
                  .filter((e) => e.type === 'drawing' && e.points)
                  .map((draw) => {
                    const pts = draw.points!
                      .map(([x, y]) => `${(x / scaleX) * (zoom / 100)},${(y / scaleY) * (zoom / 100)}`)
                      .join(' ');
                    const strokeCol = draw.stroke_color || draw.color || '#111827';
                    return (
                      <polyline
                        key={draw.id}
                        points={pts}
                        fill="none"
                        stroke={strokeCol}
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

              {/* In-Place Text Edit Modal Popover */}
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
              onClick={() => pushEdits([])}
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

      {/* Signature Studio Modal */}
      <SignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onAdopt={handleAdoptSignature}
      />
    </div>
  );
};
