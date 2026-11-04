import React, { useState } from 'react';
import { Job } from '../../types';
import { formatBytes } from '../../services/api';
import { VisualDiffInspector } from './VisualDiffInspector';
import {
  CheckCircle2,
  Download,
  RotateCcw,
  Trash2,
  FileArchive,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Zap,
} from 'lucide-react';

interface ResultPanelProps {
  job: Job;
  files?: File[];
  onReset: () => void;
  onDelete: () => void;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({ job, files, onReset, onDelete }) => {

  const [purged, setPurged] = useState(false);

  const handlePurge = () => {
    onDelete();
    setPurged(true);
  };

  if (job.status === 'failed') {
    return (
      <div className="p-6 bg-[#fff5f5] border border-[#fed7d7] rounded-2xl space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#ef4444] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#991b1b]">Processing Encountered an Error</h4>
            <p className="text-xs text-[#b91c1c] leading-relaxed">
              {job.error || 'The document could not be processed. It may be corrupt, password-locked, or incompatible.'}
            </p>
          </div>
        </div>

        <div className="pt-2 flex gap-3">
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 bg-[#12151c] text-[#c9f227] text-xs font-semibold rounded-xl hover:bg-[#1e2433] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  const isCompressed = job.tool_id === 'compress-pdf' && job.metadata.saved_bytes !== undefined;
  const isRedacted = job.tool_id === 'redact-pdf';

  return (
    <div className="p-6 md:p-8 bg-white border border-[#e3e3dc] rounded-2xl shadow-sm space-y-6">
      {/* Success Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#ecfdf5] text-[#10b981] flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#12151c]">Your document is ready!</h3>
            <p className="text-xs text-[#64748b]">Processing finished successfully.</p>
          </div>
        </div>

        <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#f1f1ec] text-[#64748b]">
          Auto-wipes in 5 min
        </span>
      </div>

      {/* Special Metrics Banner (Compression / Redaction / AI) */}
      {isCompressed && (
        <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <TrendingDown className="w-5 h-5 text-[#10b981]" />
            <div>
              <span className="font-bold text-[#12151c]">
                {job.metadata.reduction_percentage > 0
                  ? `Reduced by ${job.metadata.reduction_percentage}%`
                  : 'Already optimally compressed'}
              </span>
              <p className="text-[11px] text-[#64748b]">
                {formatBytes(job.metadata.original_size)} → {formatBytes(job.metadata.compressed_size)}
              </p>
            </div>
          </div>
          {job.metadata.saved_bytes > 0 && (
            <span className="px-2.5 py-1 rounded-full font-bold text-[#10b981] bg-[#ecfdf5] text-[11px]">
              {formatBytes(job.metadata.saved_bytes)} Saved
            </span>
          )}
        </div>
      )}

      {isRedacted && (
        <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl flex items-center gap-2.5 text-xs text-[#12151c]">
          <ShieldCheck className="w-5 h-5 text-[#10b981] shrink-0" />
          <span>
            <strong>Verified Byte-Scrubbed:</strong> Sensitive text was permanently eradicated from the file stream.
          </span>
        </div>
      )}

      {/* Client-Side Processing Badge */}
      {job.metadata?.client_processed && (
        <div className="p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <Zap className="w-5 h-5 text-[#16a34a]" />
            <div>
              <span className="font-bold text-[#14532d]">Instant Client-Side Execution</span>
              <p className="text-[11px] text-[#166534]">
                Processed 100% locally in your browser memory — 0 MB server footprint, total privacy.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full font-bold text-[#16a34a] bg-white border border-[#bbf7d0] text-[11px]">
            ⚡ 0ms Network Upload
          </span>
        </div>
      )}

      {/* Visual PDF Compare & Diff Inspector */}
      {job.tool_id === 'compare-pdfs' && (
        <VisualDiffInspector
          files={files}
          pageDiffs={job.metadata?.page_diffs}
          diffLines={job.metadata?.diff_lines}
          additions={job.metadata?.additions}
          deletions={job.metadata?.deletions}
          pageCount1={job.metadata?.page_count_file1}
          pageCount2={job.metadata?.page_count_file2}
          identical={job.metadata?.identical}
        />
      )}

      {/* AI Tools Rich Result Display */}

      {job.tool_id === 'ask-pdf' && job.metadata.answer && (
        <div className="p-5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Semantic Answer</span>
              {job.metadata.confidence !== undefined && (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  job.metadata.confidence >= 0.7
                    ? 'bg-[#ecfdf5] text-[#10b981]'
                    : job.metadata.confidence >= 0.4
                    ? 'bg-[#fffbeb] text-[#f59e0b]'
                    : 'bg-[#fef2f2] text-[#ef4444]'
                }`}>
                  {Math.round(job.metadata.confidence * 100)}% {job.metadata.confidence_label || 'Confidence'}
                </span>
              )}
            </div>
            {job.metadata.citations && job.metadata.citations.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#2563eb]">
                <span className="font-semibold">Citations:</span>
                {job.metadata.citations.map((c: string, idx: number) => (
                  <span key={idx} className="px-2 py-0.5 bg-[#eff6ff] rounded font-mono text-[10px] font-bold">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-white border border-[#e2e8f0] rounded-xl text-xs text-[#1e293b] leading-relaxed whitespace-pre-line shadow-xs">
            {job.metadata.answer}
          </div>

          {job.metadata.suggested_questions && job.metadata.suggested_questions.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-[#64748b]">Suggested Follow-Up Questions:</span>
              <div className="flex flex-wrap gap-1.5">
                {job.metadata.suggested_questions.map((sq: string, idx: number) => (
                  <span key={idx} className="text-[10px] px-2.5 py-1 bg-white border border-[#e2e8f0] rounded-lg text-[#334155] shadow-xs">
                    {sq}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {['pdf-summarizer', 'summarize-pdf'].includes(job.tool_id) && job.metadata.summary && (
        <div className="p-5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
                {job.metadata.mode ? `${job.metadata.mode.replace('_', ' ').toUpperCase()} SUMMARY` : 'DOCUMENT SUMMARY'}
              </span>
              {job.metadata.reading_time_saved_min > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#10b981]">
                  ⚡ {job.metadata.reading_time_saved_min} min saved
                </span>
              )}
            </div>
            {job.metadata.word_count && (
              <span className="text-[11px] text-[#64748b]">
                {job.metadata.word_count} words analyzed → {job.metadata.summary_word_count || 'concise'} words
              </span>
            )}
          </div>

          <div className="p-4 bg-white border border-[#e2e8f0] rounded-xl text-xs text-[#1e293b] leading-relaxed whitespace-pre-line max-h-72 overflow-y-auto shadow-xs">
            {job.metadata.summary}
          </div>

          {job.metadata.key_takeaways && job.metadata.key_takeaways.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-[#12151c]">Core Takeaways:</span>
              <ul className="space-y-1 text-[11px] text-[#334155]">
                {job.metadata.key_takeaways.map((tk: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-[#2563eb] font-bold">•</span>
                    <span>{tk.replace(/^[\s•\-\*]+/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {job.tool_id === 'extract-structured-data' && (
        <div className="p-5 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
              SCHEMA: {(job.metadata.schema || 'general').toUpperCase()}
            </span>
            <div className="flex items-center gap-1.5 text-[10px]">
              {job.metadata.entities?.email_addresses?.length > 0 && (
                <span className="px-2 py-0.5 bg-white border border-[#e2e8f0] rounded font-semibold text-[#1e293b]">
                  {job.metadata.entities.email_addresses.length} Email(s)
                </span>
              )}
              {job.metadata.entities?.currency_amounts?.length > 0 && (
                <span className="px-2 py-0.5 bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0] rounded font-semibold">
                  {job.metadata.entities.currency_amounts.length} Amount(s)
                </span>
              )}
              {job.metadata.entities?.dates_found?.length > 0 && (
                <span className="px-2 py-0.5 bg-white border border-[#e2e8f0] rounded font-semibold text-[#1e293b]">
                  {job.metadata.entities.dates_found.length} Date(s)
                </span>
              )}
            </div>
          </div>

          {job.metadata.schema_data && Object.keys(job.metadata.schema_data).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {Object.entries(job.metadata.schema_data).map(([k, v], idx) => (
                <div key={idx} className="p-2.5 bg-white border border-[#e2e8f0] rounded-xl shadow-xs">
                  <span className="text-[10px] font-mono uppercase text-[#64748b] block">{k.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-[#12151c] text-[11px] truncate block">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Output Files Download Section */}
      <div className="space-y-3">
        {job.output_files.map((outF, idx) => {
          const isZip = outF.filename.endsWith('.zip');
          return (
            <div
              key={idx}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#fbfbfa] border border-[#e3e3dc] rounded-xl gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#12151c] text-[#c9f227] flex items-center justify-center shrink-0">
                  {isZip ? <FileArchive className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#12151c] truncate">{outF.filename}</p>
                  <p className="text-[11px] text-[#64748b]">{formatBytes(outF.size_bytes)}</p>
                </div>
              </div>

              <a
                href={outF.download_url}
                download={outF.filename}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#12151c] text-[#c9f227] hover:bg-[#1e2433] text-xs font-bold transition-all shadow-sm shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Download {isZip ? 'Archive (ZIP)' : 'File'}</span>
              </a>
            </div>
          );
        })}
      </div>

      {/* Actions footer */}
      <div className="pt-4 border-t border-[#f1f1ec] flex flex-wrap items-center justify-between gap-3 text-xs">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-[#64748b] hover:text-[#12151c] font-medium transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Process another file</span>
        </button>

        {!purged ? (
          <button
            onClick={handlePurge}
            className="flex items-center gap-1.5 text-[#64748b] hover:text-[#ef4444] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete temporary files now</span>
          </button>
        ) : (
          <span className="text-[#10b981] text-[11px]">Temporary files purged from container.</span>
        )}
      </div>
    </div>
  );
};
