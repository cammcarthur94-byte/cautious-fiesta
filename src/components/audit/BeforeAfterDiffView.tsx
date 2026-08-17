'use client';

import React, { useState } from 'react';
import { diffWords } from 'diff';
import { Sparkles, Code, Eye, ArrowRight } from 'lucide-react';

interface BeforeAfterDiffViewProps {
  originalHtml: string;
  optimizedHtml: string;
  onOptimizedChange?: (newHtml: string) => void;
}

export function BeforeAfterDiffView({
  originalHtml,
  optimizedHtml,
  onOptimizedChange,
}: BeforeAfterDiffViewProps) {
  const [viewMode, setViewMode] = useState<'visual' | 'code' | 'diff'>('visual');

  // Compute text diff for diff mode
  const diffs = diffWords(originalHtml, optimizedHtml);

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      {/* Tab Header */}
      <div className="p-3.5 bg-gray-50/80 border-b border-gray-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Description Studio
          </span>
          <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> AI Optimized
          </span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-gray-200/70 p-0.5 rounded-lg text-xs font-medium">
          <button
            onClick={() => setViewMode('visual')}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              viewMode === 'visual' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Visual Preview
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              viewMode === 'code' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Code className="w-3.5 h-3.5" /> HTML Source
          </button>
          <button
            onClick={() => setViewMode('diff')}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              viewMode === 'diff' ? 'bg-white text-gray-900 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Inline Diff
          </button>
        </div>
      </div>

      {/* Visual / Side-by-Side Mode */}
      {viewMode === 'visual' && (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 text-sm">
          {/* Before */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                CURRENT (BEFORE)
              </span>
              <span className="text-xs text-gray-400">Shopify Product Body</span>
            </div>
            <div
              className="prose prose-sm max-w-none text-gray-700 bg-gray-50/50 p-4 rounded-lg border border-gray-100 min-h-[300px]"
              dangerouslySetInnerHTML={{ __html: originalHtml || '<p class="text-gray-400 italic">No description provided</p>' }}
            />
          </div>

          {/* After */}
          <div className="p-5 bg-emerald-50/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI OPTIMIZED (AFTER)
              </span>
              <span className="text-xs text-emerald-600 font-semibold">AEO & GEO Structured</span>
            </div>
            <div
              className="prose prose-sm max-w-none text-gray-800 bg-white p-4 rounded-lg border border-emerald-200/80 shadow-sm min-h-[300px]"
              dangerouslySetInnerHTML={{ __html: optimizedHtml }}
            />
          </div>
        </div>
      )}

      {/* HTML Code Editor Mode */}
      {viewMode === 'code' && (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          <div className="p-4">
            <span className="text-xs font-semibold text-gray-500 block mb-2">Original HTML</span>
            <pre className="p-3 bg-gray-900 text-gray-200 rounded-lg text-xs font-mono overflow-auto h-[320px] whitespace-pre-wrap">
              {originalHtml}
            </pre>
          </div>
          <div className="p-4">
            <span className="text-xs font-semibold text-emerald-700 block mb-2">Optimized HTML (Editable)</span>
            <textarea
              value={optimizedHtml}
              onChange={(e) => onOptimizedChange?.(e.target.value)}
              className="w-full p-3 bg-gray-900 text-emerald-300 rounded-lg text-xs font-mono overflow-auto h-[320px] focus:outline-none focus:ring-2 focus:ring-emerald-500 font-normal"
            />
          </div>
        </div>
      )}

      {/* Diff Mode */}
      {viewMode === 'diff' && (
        <div className="p-5 font-mono text-xs overflow-auto max-h-[400px] leading-relaxed bg-gray-50">
          {diffs.map((part, index) => {
            const color = part.added
              ? 'bg-emerald-100 text-emerald-900 font-semibold px-1 rounded'
              : part.removed
              ? 'bg-red-100 text-red-800 line-through px-1 rounded'
              : 'text-gray-700';
            return (
              <span key={index} className={color}>
                {part.value}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
