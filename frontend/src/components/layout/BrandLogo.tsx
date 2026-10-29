import React from 'react';
import { Link } from 'react-router-dom';

export const BrandLogo: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <Link to="/" className={`flex items-center gap-2.5 group select-none ${className}`}>
      {/* Original Foldora Geometric Origami Icon */}
      <div className="relative w-8 h-8 rounded-lg bg-[#12151c] flex items-center justify-center shadow-md overflow-hidden border border-[#2a3140] transition-transform duration-200 group-hover:scale-105">
        {/* Background folded layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e2433] to-[#12151c]" />
        {/* Acid Lime folded corner polygon */}
        <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 4C5 3.44772 5.44772 3 6 3H14L19 8V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V4Z"
            fill="#222733"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Folded paper corner with acid lime fill */}
          <path
            d="M14 3L19 8H15C14.4477 8 14 7.55228 14 7V3Z"
            fill="#c9f227"
          />
          {/* Subtle document line accent */}
          <line x1="8" y1="12" x2="16" y2="12" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="8" y1="16" x2="13" y2="16" stroke="#c9f227" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <div className="flex items-center gap-1.5 font-bold tracking-tight">
        <span className="text-xl text-[#12151c] font-black tracking-tighter">FOLDORA</span>
        <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-[#12151c] text-[#c9f227] shadow-sm">
          PDF
        </span>
      </div>
    </Link>
  );
};
