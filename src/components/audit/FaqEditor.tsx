'use client';

import React from 'react';
import { FAQPair } from '@/lib/scoring/types';
import { HelpCircle, Plus, Trash2 } from 'lucide-react';

interface FaqEditorProps {
  faqs: FAQPair[];
  onChange: (faqs: FAQPair[]) => void;
}

export function FaqEditor({ faqs, onChange }: FaqEditorProps) {
  const handleUpdate = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...faqs];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleAdd = () => {
    onChange([
      ...faqs,
      {
        question: 'What are the main use cases for this product?',
        answer: 'This product is designed for high-performance everyday applications with verified durability.',
      },
    ]);
  };

  const handleRemove = (index: number) => {
    onChange(faqs.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <div className="p-3.5 bg-gray-50/80 border-b border-gray-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Conversational AEO FAQ Pairs ({faqs.length})
          </span>
        </div>
        <button
          onClick={handleAdd}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-blue-700 flex items-center gap-1 transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Add Question
        </button>
      </div>

      <div className="p-4 space-y-3">
        {faqs.map((faq, index) => (
          <div key={index} className="p-3.5 rounded-lg border border-gray-200/80 bg-gray-50/50 space-y-2 relative group">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700">Question {index + 1}</label>
              <button
                onClick={() => handleRemove(index)}
                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                title="Remove question"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={faq.question}
              onChange={(e) => handleUpdate(index, 'question', e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
              placeholder="e.g. How does this compare to standard alternatives?"
            />
            <textarea
              rows={2}
              value={faq.answer}
              onChange={(e) => handleUpdate(index, 'answer', e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 leading-relaxed"
              placeholder="Crisp, direct answer formatted for conversational search assistants..."
            />
          </div>
        ))}
      </div>
    </div>
  );
}
