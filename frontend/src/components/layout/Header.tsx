import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { Search, Menu, X, Shield, Sparkles, Layers, ArrowRight } from 'lucide-react';

interface HeaderProps {
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-[#f9f9f6]/90 backdrop-blur-md border-b border-[#e3e3dc] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <BrandLogo />

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-[#475569]">
          <Link
            to="/tools"
            className="px-3 py-1.5 rounded-lg hover:text-[#12151c] hover:bg-[#f1f1ec] transition-colors"
          >
            All Tools
          </Link>
          <Link
            to="/tools?category=organize"
            className="px-3 py-1.5 rounded-lg hover:text-[#12151c] hover:bg-[#f1f1ec] transition-colors"
          >
            Organize
          </Link>
          <Link
            to="/tools?category=convert_to"
            className="px-3 py-1.5 rounded-lg hover:text-[#12151c] hover:bg-[#f1f1ec] transition-colors"
          >
            Convert
          </Link>
          <Link
            to="/tools?category=edit"
            className="px-3 py-1.5 rounded-lg hover:text-[#12151c] hover:bg-[#f1f1ec] transition-colors"
          >
            Edit & Sign
          </Link>
          <Link
            to="/tools?category=security"
            className="px-3 py-1.5 rounded-lg hover:text-[#12151c] hover:bg-[#f1f1ec] transition-colors"
          >
            Security
          </Link>
          <Link
            to="/about"
            className="px-3 py-1.5 rounded-lg hover:text-[#12151c] hover:bg-[#f1f1ec] transition-colors"
          >
            About
          </Link>
        </nav>

        {/* Right Action Area */}
        <div className="flex items-center gap-2.5">
          {/* Quick Search Button */}
          <button
            onClick={() => onOpenSearch ? onOpenSearch() : navigate('/tools')}
            className="flex items-center gap-2 text-xs text-[#64748b] bg-[#ffffff] border border-[#e3e3dc] hover:border-[#94a3b8] px-3 py-1.5 rounded-full shadow-sm hover:shadow transition-all group cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-[#64748b] group-hover:text-[#12151c]" />
            <span className="hidden sm:inline">Search 60+ tools...</span>
            <span className="sm:hidden">Search</span>
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono text-[#94a3b8] bg-[#f1f1ec] rounded border border-[#e2e8f0]">
              ⌘K
            </kbd>
          </button>

          {/* Quick CTA to Popular Tool */}
          <Link
            to="/tool/merge-pdf"
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#12151c] text-[#c9f227] hover:bg-[#1e2433] transition-colors shadow-sm"
          >
            <span>Merge PDF</span>
            <ArrowRight className="w-3 h-3" />
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-[#475569] hover:bg-[#f1f1ec] transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#ffffff] border-b border-[#e3e3dc] px-4 pt-2 pb-6 space-y-2 shadow-lg animate-in fade-in slide-in-from-top-2">
          <Link
            to="/tools"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-[#12151c] hover:bg-[#f1f1ec]"
          >
            All Tools Catalogue (64)
          </Link>
          <Link
            to="/tools?category=organize"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-[#475569] hover:bg-[#f1f1ec]"
          >
            Organize PDF
          </Link>
          <Link
            to="/tools?category=convert_to"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-[#475569] hover:bg-[#f1f1ec]"
          >
            Convert to PDF
          </Link>
          <Link
            to="/tools?category=convert_from"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-[#475569] hover:bg-[#f1f1ec]"
          >
            Convert from PDF
          </Link>
          <Link
            to="/tools?category=edit"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-[#475569] hover:bg-[#f1f1ec]"
          >
            Edit & Annotate
          </Link>
          <Link
            to="/tools?category=security"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-[#475569] hover:bg-[#f1f1ec]"
          >
            Security & Redaction
          </Link>
          <Link
            to="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-[#475569] hover:bg-[#f1f1ec]"
          >
            About & Architecture
          </Link>
          <div className="pt-2 border-t border-[#e3e3dc] flex gap-2">
            <Link
              to="/tool/merge-pdf"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 text-center py-2 rounded-lg bg-[#12151c] text-[#c9f227] text-sm font-semibold"
            >
              Merge PDF
            </Link>
            <Link
              to="/tool/compress-pdf"
              onClick={() => setMobileMenuOpen(false)}
              className="flex-1 text-center py-2 rounded-lg bg-[#f1f1ec] text-[#12151c] text-sm font-semibold border border-[#e3e3dc]"
            >
              Compress PDF
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
