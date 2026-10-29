import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToolDefinition } from '../../types';
import { ToolIcon } from './ToolIcon';
import { Search, X, ArrowRight, CornerDownLeft } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tools: ToolDefinition[];
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, tools }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation & Shortcuts (Escape, Arrows, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent or toggle
        }
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        navigate(`/tool/${filtered[selectedIndex].id}`);
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, query, tools]);

  const filtered = tools.filter((t) => {
    if (!query.trim()) return t.popular;
    const q = query.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.tagline.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  }).slice(0, 8);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-[#ffffff] rounded-2xl shadow-2xl border border-[#cbd5e1] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#e3e3dc] gap-3">
          <Search className="w-5 h-5 text-[#94a3b8] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search across all 60+ PDF tools..."
            className="w-full text-sm bg-transparent focus:outline-none text-[#12151c] placeholder-[#94a3b8]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[#94a3b8] hover:text-[#12151c]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2 py-1 text-[11px] font-medium text-[#64748b] bg-[#f1f1ec] rounded border border-[#e2e8f0]"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-[#f8fafc]">
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            {query.trim() ? 'Matching Tools' : 'Popular Tools'}
          </div>

          {filtered.length > 0 ? (
            filtered.map((tool, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={tool.id}
                  onClick={() => {
                    navigate(`/tool/${tool.id}`);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#12151c] text-white' : 'hover:bg-[#f8fafc] text-[#12151c]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-[#222733] text-[#c9f227]' : 'bg-[#f1f1ec] text-[#12151c]'
                      }`}
                    >
                      <ToolIcon name={tool.icon} className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold tracking-tight">{tool.name}</div>
                      <div
                        className={`text-xs line-clamp-1 ${
                          isSelected ? 'text-[#94a3b8]' : 'text-[#64748b]'
                        }`}
                      >
                        {tool.tagline}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
                        isSelected ? 'bg-[#222733] text-[#94a3b8]' : 'bg-[#f1f1ec] text-[#64748b]'
                      }`}
                    >
                      {tool.category.replace('_', ' ')}
                    </span>
                    <CornerDownLeft
                      className={`w-3.5 h-3.5 ${
                        isSelected ? 'text-[#c9f227]' : 'opacity-0'
                      }`}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-[#64748b]">
              No tools found matching "{query}"
            </div>
          )}
        </div>

        {/* Footer shortcuts info */}
        <div className="px-4 py-2.5 bg-[#f8fafc] border-t border-[#e3e3dc] flex items-center justify-between text-[11px] text-[#64748b]">
          <div className="flex items-center gap-2">
            <span>Navigate: <kbd className="px-1.5 py-0.5 bg-[#fff] border border-[#cbd5e1] rounded">↑</kbd> <kbd className="px-1.5 py-0.5 bg-[#fff] border border-[#cbd5e1] rounded">↓</kbd></span>
            <span>Select: <kbd className="px-1.5 py-0.5 bg-[#fff] border border-[#cbd5e1] rounded">↵</kbd></span>
          </div>
          <span>Total 64 tools available</span>
        </div>
      </div>
    </div>
  );
};
