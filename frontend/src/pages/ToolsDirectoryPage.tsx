import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ToolDefinition } from '../types';
import { fetchTools } from '../services/api';
import { ToolGrid } from '../components/tools/ToolGrid';

export const ToolsDirectoryPage: React.FC = () => {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const categoryParam = searchParams.get('category') || 'all';

  useEffect(() => {
    fetchTools().then((data) => {
      setTools(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="space-y-2 border-b border-[#e3e3dc] pb-6">
        <h1 className="text-3xl font-black text-[#12151c] tracking-tight">Tools Directory</h1>
        <p className="text-xs sm:text-sm text-[#64748b]">
          Discover all 64 utility modules for organizing, converting, editing, securing, and analyzing PDF documents.
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-[#64748b]">
          Loading tools catalogue...
        </div>
      ) : (
        <ToolGrid tools={tools} initialCategory={categoryParam} />
      )}
    </div>
  );
};
