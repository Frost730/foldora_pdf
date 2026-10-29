import React, { useState, useMemo } from 'react';
import { ToolDefinition, ToolCategory } from '../../types';
import { ToolCard } from './ToolCard';
import { Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';

interface ToolGridProps {
  tools: ToolDefinition[];
  initialCategory?: string;
}

const CATEGORIES: { id: string; label: string; countKey?: ToolCategory }[] = [
  { id: 'all', label: 'All Tools' },
  { id: 'organize', label: 'Organize', countKey: 'organize' },
  { id: 'optimize', label: 'Optimize & Repair', countKey: 'optimize' },
  { id: 'convert_to', label: 'Convert to PDF', countKey: 'convert_to' },
  { id: 'convert_from', label: 'Convert from PDF', countKey: 'convert_from' },
  { id: 'edit', label: 'Edit & Annotate', countKey: 'edit' },
  { id: 'sign', label: 'Sign PDF', countKey: 'sign' },
  { id: 'security', label: 'Security & Privacy', countKey: 'security' },
  { id: 'ai_advanced', label: 'AI & Insights', countKey: 'ai_advanced' },
];

export const ToolGrid: React.FC<ToolGridProps> = ({ tools, initialCategory = 'all' }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>('');

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#e3e3dc]">
        {/* Scrollable Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#12151c] text-[#c9f227] shadow-sm'
                    : 'bg-[#ffffff] text-[#5e6b7d] hover:bg-[#f1f1ec] hover:text-[#12151c] border border-[#e3e3dc]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Live Filter Search Input */}
        <div className="relative min-w-[240px] md:w-64">
          <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter tools..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#ffffff] border border-[#e3e3dc] rounded-full focus:outline-none focus:border-[#12151c] focus:ring-1 focus:ring-[#12151c] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#12151c]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-[#64748b]">
        <span>
          Showing <strong className="text-[#12151c]">{filteredTools.length}</strong> tool{filteredTools.length !== 1 ? 's' : ''}
          {selectedCategory !== 'all' ? ` in ${CATEGORIES.find((c) => c.id === selectedCategory)?.label}` : ''}
        </span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-[#ef4444] hover:underline"
          >
            Clear filter
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
        <div className="py-16 text-center bg-[#ffffff] rounded-2xl border border-dashed border-[#cbd5e1] p-8">
          <div className="w-12 h-12 rounded-full bg-[#f1f1ec] text-[#64748b] flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-[#12151c]">No matching tools found</h4>
          <p className="text-xs text-[#64748b] mt-1 max-w-sm mx-auto">
            We couldn't find any tools matching "{searchQuery}". Try selecting another category or check your spelling.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-[#12151c] text-[#c9f227] hover:bg-[#1e2433] transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};
