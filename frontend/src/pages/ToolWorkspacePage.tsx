import React, { useState, useEffect } from 'react';

import { useParams, Link, useNavigate } from 'react-router-dom';

import { ToolDefinition, Job } from '../types';

import { fetchTool, createJob, pollJob, cancelJob, deleteJob, fetchPreview, fetchPdfInfo } from '../services/api';

import { ToolIcon } from '../components/common/ToolIcon';

import { FileDropzone } from '../components/workspace/FileDropzone';

import { FileList } from '../components/workspace/FileList';

import { ToolOptionsForm } from '../components/workspace/ToolOptionsForm';

import { VisualPdfEditor } from '../components/workspace/VisualPdfEditor';

import { VisualEditItem } from '../types';

import { PageOrganizer } from '../components/workspace/PageOrganizer';

import { JobProgress } from '../components/workspace/JobProgress';

import { ResultPanel } from '../components/workspace/ResultPanel';
import { PreviewModal } from '../components/workspace/PreviewModal';
import { canRunClientSide, executeClientSidePdf } from '../services/clientPdf';
import { ArrowLeft, Play, ShieldAlert, Sparkles, AlertCircle, Zap } from 'lucide-react';




export const ToolWorkspacePage: React.FC = () => {

  const { toolId } = useParams<{ toolId: string }>();

  const navigate = useNavigate();



  const [tool, setTool] = useState<ToolDefinition | null>(null);

  const [loadingTool, setLoadingTool] = useState(true);

  const [errorTool, setErrorTool] = useState<string | null>(null);



  // Workspace state

  const [files, setFiles] = useState<File[]>([]);

  const [pageCount, setPageCount] = useState<number | undefined>(undefined);

  const [options, setOptions] = useState<Record<string, any>>({});

  const [job, setJob] = useState<Job | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  const [editorMode, setEditorMode] = useState<'visual' | 'form'>('visual');
  const [preferClientProcessing, setPreferClientProcessing] = useState<boolean>(true);



  const handleApplyVisualEdits = async (visualEdits: VisualEditItem[]) => {

    if (!tool || !files.length) return;

    setIsProcessing(true);

    setActionError(null);



    try {

      const opts = { ...options, visual_edits: visualEdits };

      const { job_id } = await createJob(tool.id, files, opts);

      const completedJob = await pollJob(job_id, (updated) => {

        setJob(updated);

      });

      setJob(completedJob);

    } catch (err: any) {

      setActionError(err.message || 'Operation failed');

    } finally {

      setIsProcessing(false);

    }

  };



  useEffect(() => {

    if (!toolId) return;

    setLoadingTool(true);

    setErrorTool(null);

    setFiles([]);

    setJob(null);

    setIsProcessing(false);

    setActionError(null);



    fetchTool(toolId)

      .then((data) => {

        setTool(data);

        // Default options per tool

        if (toolId === 'compress-pdf') setOptions({ preset: 'recommended' });

        else if (toolId === 'rotate-pdf') setOptions({ angle: 90 });

        else if (toolId === 'split-pdf') setOptions({ mode: 'ranges', ranges: '1' });

        else if (toolId === 'add-page-numbers') setOptions({ position: 'bottom_center', format: 'Page {n} of {total}', start_num: 1 });

        else if (toolId === 'add-watermark') setOptions({ text: 'CONFIDENTIAL', opacity: 0.3, rotation: 45 });

        else if (toolId === 'ocr-pdf') setOptions({ language: 'eng' });

        else if (toolId === 'images-to-pdf') setOptions({ orientation: 'auto' });

        else if (toolId === 'pdf-to-jpg' || toolId === 'pdf-to-png') setOptions({ dpi: 150 });

        else if (toolId === 'add-stamp') setOptions({ stamp_text: 'APPROVED' });

        else if (toolId === 'remove-pages') setOptions({ pages_to_remove: '' });

        else if (toolId === 'edit-text') setOptions({ find_text: '', replace_text: '', color: '#111827' });

        else if (toolId === 'pdf-summarizer' || toolId === 'summarize-pdf') setOptions({ mode: 'executive', length: 'standard' });

        else if (toolId === 'ask-pdf') setOptions({ question: '' });

        else if (toolId === 'extract-structured-data') setOptions({ schema: 'general', format: 'json' });

        else if (toolId === 'translate-pdf') setOptions({ language: 'es' });

        else setOptions({});

        setLoadingTool(false);

      })

      .catch((err) => {

        setErrorTool(err.message || 'Tool not found');

        setLoadingTool(false);

      });

  }, [toolId]);



  useEffect(() => {

    if (files.length > 0 && files[0].name.toLowerCase().endsWith('.pdf')) {

      fetchPdfInfo(files[0])

        .then((res) => {

          if (res?.total_pages) {

            setPageCount(res.total_pages);

          }

        })

        .catch(() => {

          setPageCount(undefined);

        });

    } else {

      setPageCount(undefined);

    }

  }, [files]);



  const handleFilesSelected = (newFiles: File[]) => {

    if (!tool) return;

    if (tool.max_files === 1) {

      setFiles([newFiles[0]]);

    } else {

      setFiles((prev) => [...prev, ...newFiles].slice(0, tool.max_files));

    }

  };



  const handleRemoveFile = (idx: number) => {

    setFiles((prev) => prev.filter((_, i) => i !== idx));

  };



  const handleMoveUp = (idx: number) => {

    if (idx <= 0) return;

    setFiles((prev) => {

      const copy = [...prev];

      const temp = copy[idx - 1];

      copy[idx - 1] = copy[idx];

      copy[idx] = temp;

      return copy;

    });

  };



  const handleMoveDown = (idx: number) => {

    setFiles((prev) => {

      if (idx >= prev.length - 1) return prev;

      const copy = [...prev];

      const temp = copy[idx + 1];

      copy[idx + 1] = copy[idx];

      copy[idx] = temp;

      return copy;

    });

  };



  const handleExecute = async () => {
    if (!tool || !files.length) return;
    setIsProcessing(true);
    setActionError(null);

    // Hybrid Client-Side Browser Execution (0 MB Server RAM, instantaneous)
    if (tool && canRunClientSide(tool.id) && preferClientProcessing) {
      try {
        const clientJob = await executeClientSidePdf(tool.id, files, options);
        setJob(clientJob);
        setIsProcessing(false);
        return;
      } catch (clientErr: any) {
        console.warn('Client-side processing fallback to server:', clientErr);
        // Seamless fallback to server below
      }
    }

    try {
      const { job_id } = await createJob(tool.id, files, options);
      // Poll until done
      const completedJob = await pollJob(job_id, (updated) => {
        setJob(updated);
      });
      setJob(completedJob);
    } catch (err: any) {
      setActionError(err.message || 'Operation failed');
    } finally {
      setIsProcessing(false);
    }
  };




  const handleCancel = async () => {

    if (job?.id) {

      await cancelJob(job.id);

      setIsProcessing(false);

      setJob((prev) => prev ? { ...prev, status: 'cancelled', message: 'Job cancelled' } : null);

    }

  };



  const handleReset = () => {

    if (job?.id) {

      deleteJob(job.id).catch(() => {});

    }

    setFiles([]);

    setPageCount(undefined);

    setJob(null);

    setIsProcessing(false);

    setActionError(null);

  };



  const handleDeleteStorage = async () => {

    if (job?.id) {

      await deleteJob(job.id);

    }

  };



  if (loadingTool) {

    return (

      <div className="py-24 text-center text-xs text-[#64748b]">

        Loading workspace...

      </div>

    );

  }



  if (errorTool || !tool) {

    return (

      <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-4">

        <h2 className="text-xl font-bold text-[#12151c]">Tool Not Found</h2>

        <p className="text-xs text-[#64748b]">The requested utility module does not exist.</p>

        <Link

          to="/tools"

          className="inline-flex items-center gap-2 px-4 py-2 bg-[#12151c] text-[#c9f227] text-xs font-semibold rounded-xl"

        >

          <ArrowLeft className="w-4 h-4" />

          <span>Back to Tools Directory</span>

        </Link>

      </div>

    );

  }



  const isOrganizePageTool = tool.id === 'organize-pdf';

  const isVisualEditorTool = ['edit-pdf', 'edit-text', 'add-text', 'draw-freehand', 'fill-and-sign', 'sign-pdf', 'create-signature', 'add-image', 'add-shapes', 'add-comments', 'annotate-pdf'].includes(tool.id);



  return (

    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">

      {/* Breadcrumb & Navigation */}

      <div className="flex items-center justify-between">

        <Link

          to="/tools"

          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748b] hover:text-[#12151c] transition-colors"

        >

          <ArrowLeft className="w-3.5 h-3.5" />

          <span>All Tools</span>

        </Link>



        <span className="text-[11px] font-mono uppercase tracking-wider text-[#94a3b8] px-2.5 py-1 bg-[#f1f1ec] rounded-full">

          {tool.category.replace('_', ' ')}

        </span>

      </div>



      {/* Tool Header */}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-[#e3e3dc] pb-6">

        <div className="w-14 h-14 rounded-2xl bg-[#12151c] text-[#c9f227] flex items-center justify-center shrink-0 shadow-sm">

          <ToolIcon name={tool.icon} className="w-7 h-7" />

        </div>

        <div className="space-y-1">

          <h1 className="text-2xl sm:text-3xl font-black text-[#12151c] tracking-tight">{tool.name}</h1>

          <p className="text-xs sm:text-sm text-[#5e6b7d] max-w-2xl">{tool.tagline}</p>

        </div>

      </div>



      {/* Main Workspace Body */}

      {job && (job.status === 'completed' || job.status === 'failed') ? (
        <ResultPanel job={job} files={files} onReset={handleReset} onDelete={handleDeleteStorage} />
      ) : isProcessing ? (


        <JobProgress

          progress={job?.progress || 15}

          message={job?.message || 'Processing document...'}

          onCancel={handleCancel}

        />

      ) : (

        <div className="space-y-6">

          {/* File Upload Dropzone (if not yet at max files) */}

          {files.length < tool.max_files && (

            <FileDropzone

              accepts={tool.accepts}

              maxFiles={tool.max_files}

              onFilesSelected={handleFilesSelected}

            />

          )}



          {/* Interactive Page Organizer for organize-pdf */}

          {isOrganizePageTool && files.length > 0 && (

            <PageOrganizer

              file={files[0]}

              onChange={(order) => setOptions({ ...options, page_order: order })}

            />

          )}



          {/* Visual Editor vs Form View for Interactive Editing Tools */}

          {files.length > 0 && !isOrganizePageTool && isVisualEditorTool && (

            <div className="space-y-4">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-1.5 p-1 bg-[#f1f1ec] border border-[#e3e3dc] rounded-xl">

                  <button

                    type="button"

                    onClick={() => setEditorMode('visual')}

                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${

                      editorMode === 'visual'

                        ? 'bg-[#12151c] text-[#c9f227] shadow-xs'

                        : 'text-[#64748b] hover:text-[#12151c]'

                    }`}

                  >

                    Visual Canvas Editor

                  </button>

                  <button

                    type="button"

                    onClick={() => setEditorMode('form')}

                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${

                      editorMode === 'form'

                        ? 'bg-[#12151c] text-[#c9f227] shadow-xs'

                        : 'text-[#64748b] hover:text-[#12151c]'

                    }`}

                  >

                    Quick Options Form

                  </button>

                </div>



                <button

                  type="button"

                  onClick={() => setFiles([])}

                  className="text-xs text-[#ef4444] hover:underline cursor-pointer"

                >

                  Change Document

                </button>

              </div>



              {editorMode === 'visual' ? (

                <VisualPdfEditor

                  file={files[0]}

                  onApplyEdits={handleApplyVisualEdits}

                  isProcessing={isProcessing}

                />

              ) : (

                <>

                  <FileList

                    files={files}

                    onRemove={handleRemoveFile}

                    onMoveUp={handleMoveUp}

                    onMoveDown={handleMoveDown}

                    onPreview={(f) => setPreviewFile(f)}

                    allowReorder={tool.max_files > 1}

                  />

                  <div className="p-6 bg-white border border-[#e3e3dc] rounded-2xl shadow-xs space-y-4">

                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#94a3b8]">

                      Tool Options & Preferences

                    </h3>

                    <ToolOptionsForm toolId={tool.id} options={options} onChange={setOptions} pageCount={pageCount} file={files[0]} />

                  </div>

                </>

              )}

            </div>

          )}



          {/* Standard File List and Options Form for Non-Visual Tools */}

          {files.length > 0 && !isOrganizePageTool && !isVisualEditorTool && (

            <>

              <FileList

                files={files}

                onRemove={handleRemoveFile}

                onMoveUp={handleMoveUp}

                onMoveDown={handleMoveDown}

                onPreview={(f) => setPreviewFile(f)}

                allowReorder={tool.max_files > 1}

              />

              <div className="p-6 bg-white border border-[#e3e3dc] rounded-2xl shadow-xs space-y-4">

                <h3 className="text-xs font-bold uppercase tracking-wider text-[#94a3b8]">

                  Tool Options & Preferences

                </h3>

                <ToolOptionsForm toolId={tool.id} options={options} onChange={setOptions} pageCount={pageCount} file={files[0]} />

              </div>

            </>

          )}



          {/* Error Notice */}

          {actionError && (

            <div className="flex items-center gap-2 p-4 text-xs text-[#ef4444] bg-[#fef2f2] border border-[#fecaca] rounded-xl">

              <AlertCircle className="w-4 h-4 shrink-0" />

              <span>{actionError}</span>

            </div>

          )}



          {/* Execute Primary CTA Button */}
          {files.length > 0 && (!isVisualEditorTool || editorMode === 'form') && (
            <div className="space-y-4 pt-4 border-t border-[#e3e3dc]">
              {tool && canRunClientSide(tool.id) && (
                <div className="flex items-center justify-between p-3.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl text-xs">
                  <div className="flex items-center gap-2.5">
                    <Zap className="w-4 h-4 text-[#16a34a] shrink-0" />
                    <div>
                      <span className="font-bold text-[#14532d]">Instant Client-Side Processing</span>
                      <p className="text-[11px] text-[#166534]">
                        Runs 100% in your browser. 0 MB server RAM footprint, ultra-private & instant.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={preferClientProcessing}
                      onChange={(e) => setPreferClientProcessing(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#cbd5e1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#16a34a]"></div>
                  </label>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-[#64748b]">
                  {files.length} document{files.length > 1 ? 's' : ''} staged for {tool.name}
                </span>




              <button

                type="button"

                onClick={handleExecute}

                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3.5 bg-[#12151c] text-[#c9f227] hover:bg-[#1e2433] text-sm font-bold rounded-2xl shadow-md transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"

              >

                <Play className="w-4 h-4 fill-[#c9f227]" />
                <span>Execute {tool.name}</span>
              </button>
            </div>
          </div>
        )}


        </div>

      )}



      {/* Document Description Section */}

      <div className="pt-8 border-t border-[#e3e3dc] space-y-3">

        <h4 className="text-xs font-bold uppercase tracking-wider text-[#94a3b8]">About This Utility</h4>

        <p className="text-xs text-[#64748b] leading-relaxed max-w-3xl">{tool.description}</p>

      </div>



      {/* Preview Modal */}

      {previewFile && (

        <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      )}

    </div>

  );

};

