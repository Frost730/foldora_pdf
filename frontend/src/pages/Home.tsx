import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ToolDefinition } from '../types';
import { fetchTools } from '../services/api';
import { ToolGrid } from '../components/tools/ToolGrid';
import { FileDropzone } from '../components/workspace/FileDropzone';
import {
  ShieldCheck,
  Zap,
  Lock,
  Layers,
  Sparkles,
  ArrowRight,
  CheckCircle,
  HelpCircle,
  Server,
  FileCheck,
} from 'lucide-react';

export const Home: React.FC = () => {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTools().then((data) => {
      setTools(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleHeroFilesSelected = (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    const ext = file.name.toLowerCase();

    // Smart route to the most appropriate tool
    if (ext.endsWith('.docx') || ext.endsWith('.doc')) {
      navigate('/tool/word-to-pdf');
    } else if (ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || ext.endsWith('.webp')) {
      navigate('/tool/images-to-pdf');
    } else if (files.length > 1) {
      navigate('/tool/merge-pdf');
    } else {
      navigate('/tool/compress-pdf');
    }
  };

  return (
    <div className="space-y-16 pb-20">
      {/* Editorial Hero Section */}
      <section className="relative pt-12 md:pt-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center space-y-6">
        {/* Subtle pill tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#12151c] text-[#c9f227] shadow-sm select-none">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Independent, privacy-first PDF utility suite</span>
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-[#12151c] tracking-tight leading-[1.1] max-w-4xl mx-auto">
          Every document.{' '}
          <span className="underline decoration-[#c9f227] decoration-wavy decoration-2 underline-offset-8">
            One smoother workflow.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-[#5e6b7d] max-w-2xl mx-auto leading-relaxed">
          Stitch, optimize, edit, sign, and convert documents effortlessly. Guest-first usage with zero database retention and automated 15-minute file purging.
        </p>

        {/* Quick Hero Dropzone */}
        <div className="pt-4 max-w-2xl mx-auto">
          <FileDropzone
            accepts={['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.webp']}
            maxFiles={10}
            onFilesSelected={handleHeroFilesSelected}
          />
        </div>

        {/* Quick links to popular tools */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-[#64748b]">Popular fast actions:</span>
          {[
            { id: 'merge-pdf', name: 'Merge PDF' },
            { id: 'compress-pdf', name: 'Compress' },
            { id: 'pdf-to-word', name: 'PDF to Word' },
            { id: 'word-to-pdf', name: 'Word to PDF' },
            { id: 'protect-pdf', name: 'Protect' },
            { id: 'ocr-pdf', name: 'OCR' },
          ].map((item) => (
            <Link
              key={item.id}
              to={`/tool/${item.id}`}
              className="px-3 py-1 rounded-full bg-white border border-[#e3e3dc] text-[#12151c] font-medium hover:border-[#12151c] hover:bg-[#f1f1ec] transition-colors"
            >
              {item.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Main Tools Catalog Section */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-[#12151c] tracking-tight">Complete Tool Suite</h2>
            <p className="text-xs text-[#64748b] mt-1">
              Browse 60+ real processing tools organized by document task.
            </p>
          </div>
          <Link
            to="/tools"
            className="text-xs font-bold text-[#12151c] flex items-center gap-1 hover:underline"
          >
            <span>Explore all categories</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs text-[#64748b]">
            Loading available tools catalogue...
          </div>
        ) : (
          <ToolGrid tools={tools} />
        )}
      </section>

      {/* Workflow Process Steps */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-[#ffffff] border border-[#e3e3dc] rounded-3xl p-8 md:p-12">
          <div className="max-w-2xl mx-auto text-center space-y-2 mb-10">
            <h3 className="text-xl sm:text-2xl font-black text-[#12151c] tracking-tight">
              Designed for speed and security
            </h3>
            <p className="text-xs sm:text-sm text-[#64748b]">
              Four seamless steps without accounts, newsletters, or permanent tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {[
              {
                step: '01',
                title: 'Upload File',
                desc: 'Drag and drop up to 50 MB per document. Validated via binary magic bytes.',
              },
              {
                step: '02',
                title: 'Configure Options',
                desc: 'Tailor page ranges, compression presets, watermarks, or encryption passwords.',
              },
              {
                step: '03',
                title: 'Native Processing',
                desc: 'Processed inside an isolated container with Ghostscript, PyMuPDF, and LibreOffice.',
              },
              {
                step: '04',
                title: 'Download & Purge',
                desc: 'Retrieve your output file or ZIP bundle. Automatically purged after 15 minutes.',
              },
            ].map((st, i) => (
              <div key={i} className="flex flex-col p-5 rounded-2xl bg-[#fbfbfa] border border-[#e3e3dc] space-y-2">
                <span className="font-mono text-xs font-bold text-[#12151c] bg-[#c9f227] px-2 py-0.5 rounded w-max">
                  STEP {st.step}
                </span>
                <h4 className="text-sm font-bold text-[#12151c]">{st.title}</h4>
                <p className="text-xs text-[#64748b] leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Guarantee Banner */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-[#12151c] text-white rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#1e2433] text-[#c9f227]">
              <Lock className="w-3.5 h-3.5" />
              <span>Zero-Storage Guarantee</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
              Your confidential documents never linger.
            </h3>
            <p className="text-xs sm:text-sm text-[#94a3b8] leading-relaxed">
              Unlike generic services, Foldora stores zero permanent copies and requires no database. Files reside in temporary container directories and are completely eradicated after 15 minutes.
            </p>
          </div>

          <div className="space-y-2 text-xs text-[#94a3b8] shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#c9f227]" />
              <span>TLS 1.3 encrypted file transfers</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#c9f227]" />
              <span>No user accounts or password logs</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#c9f227]" />
              <span>Automated background cleanup tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#c9f227]" />
              <span>Render Docker container isolation</span>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-black text-[#12151c] tracking-tight">Frequently Asked Questions</h3>
          <p className="text-xs text-[#64748b]">Clear answers about file privacy, conversions, and limits.</p>
        </div>

        <div className="space-y-3">
          {[
            {
              q: 'Do I need an account or subscription to use Foldora PDF?',
              a: 'No. Foldora is built with a guest-first philosophy. All core PDF operations are 100% free and do not require account registration or credit cards.',
            },
            {
              q: 'How long are my uploaded files stored on the server?',
              a: 'Files are kept only for the duration of the processing job plus a 15-minute grace period to allow you to download your results. An automated cleanup task permanently purges all files from the server.',
            },
            {
              q: 'Are conversions real or simulated?',
              a: 'Every advertised tool runs actual native operations using open-source engines like PyMuPDF, Ghostscript, qpdf, and LibreOffice. No dummy files or renamed files are ever returned.',
            },
            {
              q: 'How does Redact PDF ensure sensitive data is not recoverable?',
              a: 'Our redaction engine scrubs the text glyphs, font objects, and image pixels directly from the underlying PDF binary streams using PyMuPDF. It does not simply paint a black rectangle over the text.',
            },
            {
              q: 'What is the maximum upload limit?',
              a: 'The default limit is 50 MB per upload and up to 20 files per batch, ensuring fast turnaround times within Render resource boundaries.',
            },
          ].map((item, i) => (
            <div key={i} className="p-5 bg-white border border-[#e3e3dc] rounded-2xl space-y-1.5">
              <h4 className="text-sm font-bold text-[#12151c]">{item.q}</h4>
              <p className="text-xs text-[#5e6b7d] leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
