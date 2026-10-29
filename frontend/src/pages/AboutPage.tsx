import React from 'react';
import { Shield, Cpu, Lock, Terminal, Sparkles, CheckCircle2 } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Heading */}
      <div className="space-y-3 text-center">
        <span className="text-xs font-mono uppercase tracking-widest text-[#64748b]">Philosophy & Stack</span>
        <h1 className="text-3xl sm:text-4xl font-black text-[#12151c] tracking-tight">
          Built for privacy, crafted for precision.
        </h1>
        <p className="text-sm text-[#5e6b7d] max-w-xl mx-auto leading-relaxed">
          Foldora PDF was designed from the ground up as an editorial document utility suite without dark patterns, paywalls, or permanent user document storage.
        </p>
      </div>

      {/* Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white border border-[#e3e3dc] rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#12151c] text-[#c9f227] flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#12151c]">Zero Permanent Storage</h3>
          <p className="text-xs text-[#64748b] leading-relaxed">
            We operate no document database. Every uploaded file is written to an ephemeral scratch directory and permanently eradicated 5 minutes after completion.
          </p>
        </div>

        <div className="p-6 bg-white border border-[#e3e3dc] rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#12151c] text-[#c9f227] flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#12151c]">100% Native Engines</h3>
          <p className="text-xs text-[#64748b] leading-relaxed">
            Every tool is executed by battle-tested C/Python document engines: PyMuPDF for microsecond manipulations, Ghostscript for stream optimization, and LibreOffice for fidelity.
          </p>
        </div>

        <div className="p-6 bg-white border border-[#e3e3dc] rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#12151c] text-[#c9f227] flex items-center justify-center">
            <Terminal className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#12151c]">Single-Container Render Architecture</h3>
          <p className="text-xs text-[#64748b] leading-relaxed">
            Packaged as an automated multi-stage Docker container deployable directly to Render, binding cleanly to dynamic PORT variables without external cloud dependencies.
          </p>
        </div>
      </div>

      {/* Technology Specifications */}
      <div className="p-8 bg-white border border-[#e3e3dc] rounded-3xl space-y-6">
        <h2 className="text-lg font-bold text-[#12151c]">Technology Specifications</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5 p-4 bg-[#fbfbfa] rounded-xl border border-[#e3e3dc]">
            <span className="font-bold text-[#12151c]">Backend Infrastructure</span>
            <p className="text-[#64748b]">Python 3.11+, FastAPI asynchronous web framework, Uvicorn ASGI server, Pydantic v2 schemas.</p>
          </div>

          <div className="space-y-1.5 p-4 bg-[#fbfbfa] rounded-xl border border-[#e3e3dc]">
            <span className="font-bold text-[#12151c]">Frontend Experience</span>
            <p className="text-[#64748b]">React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, accessible keyboard shortcuts.</p>
          </div>

          <div className="space-y-1.5 p-4 bg-[#fbfbfa] rounded-xl border border-[#e3e3dc]">
            <span className="font-bold text-[#12151c]">Document Processing Pipeline</span>
            <p className="text-[#64748b]">PyMuPDF, pypdf, Pillow, ReportLab, Ghostscript, qpdf, python-docx, openpyxl, python-pptx, OCRmyPDF.</p>
          </div>

          <div className="space-y-1.5 p-4 bg-[#fbfbfa] rounded-xl border border-[#e3e3dc]">
            <span className="font-bold text-[#12151c]">Security Hardening</span>
            <p className="text-[#64748b]">Subprocess sanitization without shell injection, binary magic number inspection, rate bounding, single-use download tokens.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
