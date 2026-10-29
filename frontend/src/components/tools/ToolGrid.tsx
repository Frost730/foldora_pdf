import React, { useState, useMemo, useEffect } from 'react';
import { ToolDefinition, ToolCategory } from '../../types';
import { ToolCard } from './ToolCard';
import { Search, Sparkles, X, Check } from 'lucide-react';

interface ToolGridProps {
  tools: ToolDefinition[];
  initialCategory?: string;
}

const CATEGORIES: { id: string; label: string; category?: ToolCategory; isAi?: boolean }[] = [
  { id: 'all', label: 'All Tools' },
  { id: 'organize', label: 'Organize', category: 'organize' as ToolCategory },
  { id: 'optimize', label: 'Optimize & Repair', category: 'optimize' as ToolCategory },
  { id: 'convert_to', label: 'Convert to PDF', category: 'convert_to' as ToolCategory },
  { id: 'convert_from', label: 'Convert from PDF', category: 'convert_from' as ToolCategory },
  { id: 'edit', label: 'Edit & Annotate', category: 'edit' as ToolCategory },
  { id: 'sign', label: 'Sign PDF', category: 'sign' as ToolCategory },
  { id: 'security', label: 'Security & Privacy', category: 'security' as ToolCategory },
  { id: 'ai_advanced', label: 'AI & Insights', category: 'ai_advanced' as ToolCategory, isAi: true },
];

export const ToolGrid: React.FC<ToolGridProps> = ({ tools, initialCategory = 'all' }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync state if initialCategory changes from URL parameters (e.g. clicking header links)
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  // Compute tool counts per category for helpful badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tools.length };
    tools.forEach((t) => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return counts;
  }, [tools]);

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      const matchesCategory =
        selectedCategory === 'all' || tool.category === selectedCategory;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tool.name.toLowerCase().includes(q) ||
        tool.tagline.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.accepts.some((acc) => acc.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [tools, selectedCategory, searchQuery]);

  return (
    <div className="w-full space-y-6">
      {/* Category Pills & Search Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#e3e3dc]">
        {/* Category Tabs: Flex-wrap ensures ALL buttons fit and NONE are clipped */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            const count = categoryCounts[cat.id] ?? 0;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none shadow-xs ${
                  isActive
                    ? 'bg-[#12151c] text-[#c9f227] ring-1 ring-[#12151c]'
                    : 'bg-[#ffffff] text-[#475569] hover:bg-[#f1f1ec] hover:text-[#12151c] border border-[#e3e3dc]'
                } ${cat.isAi ? 'border-blue-200' : ''}`}
              >
                {cat.isAi && (
                  <Sparkles
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? 'text-[#c9f227]' : 'text-blue-600'
                    }`}
                  />
                )}
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? 'bg-[#222733] text-[#c9f227]'
                      : 'bg-[#f1f1ec] text-[#64748b]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live Filter Search Input */}
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by tool name, format..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-[#ffffff] border border-[#e3e3dc] rounded-full focus:outline-none focus:border-[#12151c] focus:ring-1 focus:ring-[#12151c] shadow-xs transition-all placeholder-[#94a3b8]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#12151c] p-0.5 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results Header Status */}
      <div className="flex items-center justify-between text-xs text-[#64748b] px-1">
        <span>
          Showing <strong className="text-[#12151c] font-bold">{filteredTools.length}</strong> tool{filteredTools.length !== 1 ? 's' : ''}
          {selectedCategory !== 'all' ? (
            <>
              {' '}in <strong className="text-[#12151c]">{CATEGORIES.find((c) => c.id === selectedCategory)?.label}</strong>
            </>
          ) : ''}
        </span>
        {(searchQuery || selectedCategory !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="text-xs font-semibold text-[#ef4444] hover:underline cursor-pointer"
          >
            Reset to all tools
          </button>
        )}
      </div>

      {/* Cards Grid */}
      {filteredTools.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center bg-[#ffffff] rounded-2xl border border-dashed border-[#cbd5e1] p-8 space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#f1f1ec] text-[#64748b] flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-[#12151c]">No matching tools found</h4>
          <p className="text-xs text-[#64748b] max-w-sm mx-auto">
            We couldn't find any tools matching "{searchQuery}" in this category.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#12151c] text-[#c9f227] hover:bg-[#1e2433] transition-colors cursor-pointer shadow-sm"
          >
            Show All Tools
          </button>
        </div>
      )}
    </div>
  );
};
