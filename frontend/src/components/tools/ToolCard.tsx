import React from 'react';
import { Link } from 'react-router-dom';
import { ToolDefinition } from '../../types';
import { ToolIcon } from '../common/ToolIcon';
import { ArrowUpRight, Sparkles, Star } from 'lucide-react';

interface ToolCardProps {
  tool: ToolDefinition;
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool }) => {
  return (
    <Link
      to={`/tool/${tool.id}`}
      className="group relative flex flex-col justify-between p-5 bg-[#ffffff] rounded-xl border border-[#e3e3dc] hover:border-[#12151c] hover:shadow-md transition-all duration-200 text-left overflow-hidden"
    >
      {/* Top Accent Strip on Hover */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#c9f227] opacity-0 group-hover:opacity-100 transition-opacity" />

      <div>
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#f1f1ec] group-hover:bg-[#12151c] text-[#12151c] group-hover:text-[#c9f227] flex items-center justify-center transition-colors duration-200 shadow-xs">
            <ToolIcon name={tool.icon} className="w-5 h-5" />
          </div>

          <div className="flex items-center gap-1.5">
            {tool.popular && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f1f1ec] text-[#475569] border border-[#e3e3dc]">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                Popular
              </span>
            )}
            {tool.requires_ai_key && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]">
                <Sparkles className="w-2.5 h-2.5" />
                AI
              </span>
            )}
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[#94a3b8] group-hover:text-[#12151c] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        <h3 className="text-base font-bold text-[#12151c] group-hover:text-black tracking-tight mb-1">
          {tool.name}
        </h3>
        <p className="text-xs text-[#5e6b7d] line-clamp-2 leading-relaxed">
          {tool.tagline}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-[#f1f1ec] flex items-center justify-between text-[11px] text-[#94a3b8]">
        <span className="uppercase font-mono tracking-wider text-[10px] text-[#64748b]">
          {tool.accepts.map((a) => a.replace('.', '')).join(' · ')}
        </span>
        <span className="text-[11px] font-medium text-[#12151c] group-hover:underline">
          Launch tool →
        </span>
      </div>
    </Link>
  );
};
