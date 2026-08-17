'use client';

import React, { useState } from 'react';
import { Check, Copy, Code2, ExternalLink, ShieldCheck } from 'lucide-react';

interface SchemaViewerProps {
  schema: Record<string, any>;
}

export function SchemaViewer({ schema }: SchemaViewerProps) {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(schema, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <div className="p-3.5 bg-gray-50/80 border-b border-gray-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-purple-600" />
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            JSON-LD Schema.org Microdata
          </span>
          <span className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded border border-purple-200 font-medium flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Rich Snippet Validated
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://search.google.com/test/rich-results"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-700 hover:text-purple-900 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-50 transition-colors"
          >
            Google Rich Results Tool <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 flex items-center gap-1.5 transition-colors shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
            {copied ? 'Copied!' : 'Copy Schema'}
          </button>
        </div>
      </div>

      <div className="p-4 bg-gray-950">
        <pre className="font-mono text-xs text-purple-300 overflow-x-auto max-h-[350px] leading-relaxed">
          {jsonString}
        </pre>
      </div>

      <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <span>Injected via Theme App Extension: <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-800 font-mono">jsonld-embed.liquid</code></span>
        <span>Target: <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-800 font-mono">product.metafields.geo_aeo.jsonld_schema</code></span>
      </div>
    </div>
  );
}
