import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { Shield, Lock, Trash2, Heart, ExternalLink, Server } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#12151c] text-[#94a3b8] border-t border-[#2a3140] mt-auto">
      {/* Top Banner: Privacy & Security Guarantee */}
      <div className="border-b border-[#222733] py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#1e2433] text-[#c9f227] shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm">Zero Permanent Storage</h4>
              <p className="text-xs text-[#64748b] mt-0.5">
                Files are strictly isolated in temporary job directories and automatically wiped after 5 minutes.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#1e2433] text-[#c9f227] shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm">Container-Isolated Processing</h4>
              <p className="text-xs text-[#64748b] mt-0.5">
                Every operation runs inside a secure, ephemeral Render container with zero database tracking.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#1e2433] text-[#c9f227] shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm">100% Real PDF Engine</h4>
              <p className="text-xs text-[#64748b] mt-0.5">
                Powered by PyMuPDF, Ghostscript, qpdf, and LibreOffice. No fake progress or renamed files.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand info */}
          <div className="col-span-2 space-y-4">
            <BrandLogo />
            <p className="text-xs text-[#64748b] max-w-sm leading-relaxed">
              Foldora PDF is an independent, editorial-grade document utility platform. Built for students,
              researchers, and teams needing fast, privacy-first PDF manipulation without sign-up walls.
            </p>
            <div className="text-xs text-[#475569] flex items-center gap-1.5">
              <span>Production deployment on</span>
              <span className="text-[#c9f227] font-semibold">Render</span>
              <span>via Docker</span>
            </div>
          </div>

          {/* Organize */}
          <div>
            <h5 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Organize</h5>
            <ul className="space-y-2 text-xs">
              <li><Link to="/tool/merge-pdf" className="hover:text-white transition-colors">Merge PDF</Link></li>
              <li><Link to="/tool/split-pdf" className="hover:text-white transition-colors">Split PDF</Link></li>
              <li><Link to="/tool/organize-pdf" className="hover:text-white transition-colors">Organize Pages</Link></li>
              <li><Link to="/tool/remove-pages" className="hover:text-white transition-colors">Remove Pages</Link></li>
              <li><Link to="/tool/rotate-pdf" className="hover:text-white transition-colors">Rotate PDF</Link></li>
              <li><Link to="/tool/crop-pdf" className="hover:text-white transition-colors">Crop PDF</Link></li>
            </ul>
          </div>

          {/* Convert */}
          <div>
            <h5 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Convert</h5>
            <ul className="space-y-2 text-xs">
              <li><Link to="/tool/word-to-pdf" className="hover:text-white transition-colors">Word to PDF</Link></li>
              <li><Link to="/tool/jpg-to-pdf" className="hover:text-white transition-colors">JPG to PDF</Link></li>
              <li><Link to="/tool/pdf-to-word" className="hover:text-white transition-colors">PDF to Word</Link></li>
              <li><Link to="/tool/pdf-to-jpg" className="hover:text-white transition-colors">PDF to JPG</Link></li>
              <li><Link to="/tool/pdf-to-excel" className="hover:text-white transition-colors">PDF to Excel</Link></li>
              <li><Link to="/tool/ocr-pdf" className="hover:text-white transition-colors">OCR Searchable</Link></li>
            </ul>
          </div>

          {/* Security & System */}
          <div>
            <h5 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Security & Legal</h5>
            <ul className="space-y-2 text-xs">
              <li><Link to="/tool/protect-pdf" className="hover:text-white transition-colors">Protect PDF</Link></li>
              <li><Link to="/tool/unlock-pdf" className="hover:text-white transition-colors">Unlock PDF</Link></li>
              <li><Link to="/tool/redact-pdf" className="hover:text-white transition-colors">Redact PII</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/about" className="hover:text-white transition-colors">About Foldora</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-[#222733] flex flex-col sm:flex-row items-center justify-between text-xs text-[#64748b] gap-4">
          <p>© {new Date().getFullYear()} Foldora PDF. Every document. One smoother workflow.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e2433] text-[11px] text-[#c9f227]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c9f227] animate-pulse" />
              Service Status: Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
