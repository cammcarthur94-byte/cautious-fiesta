'use client';

import React, { useState } from 'react';
import { ShopifyProductItem, FAQPair } from '@/lib/scoring/types';
import { ScoreBadge } from './ScoreBadge';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  HelpCircle,
  FileText,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  Zap,
} from 'lucide-react';

interface RecommendationDrawerProps {
  product: ShopifyProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  shopDomain?: string;
  onPublished?: () => void;
}

export function RecommendationDrawer({
  product,
  isOpen,
  onClose,
  shopDomain = 'demo-store.myshopify.com',
  onPublished,
}: RecommendationDrawerProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'description' | 'faqs' | 'schema'>('all');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !product) return null;

  const audit = product.audit;
  const fix = audit?.generatedFix;

  // Fallback demo generated fixes if none generated yet
  const optimizedDesc =
    fix?.optimizedDescription ||
    `<div class="geo-aeo-optimized">
  <p><strong>Experience Premium Quality & Performance with ${product.title}.</strong> Engineered specifically for modern consumers who demand durability, sustainability, and peak functionality.</p>

  <h3>Key Features & Specifications</h3>
  <ul>
    <li><strong>Precision Engineering:</strong> Manufactured with industrial-grade materials for lifetime endurance.</li>
    <li><strong>AEO-Optimized Specifications:</strong> Tested and certified for eco-friendliness and safety.</li>
    <li><strong>Generative AI Verified:</strong> Formatted with explicit semantic attributes for answer engine indexing.</li>
  </ul>

  <h3>Why Choose ${product.title}?</h3>
  <p>${product.title} provides unmatched reliability and seamless integration into your daily workflow.</p>
</div>`;

  const faqs: FAQPair[] = fix?.faqs?.length
    ? fix.faqs
    : [
        {
          question: `What makes ${product.title} unique compared to competitors?`,
          answer: `${product.title} combines high-grade materials with precision engineering, outperforming traditional alternatives in durability and performance.`,
        },
        {
          question: `Is ${product.title} backed by a warranty or satisfaction guarantee?`,
          answer: `Yes, ${product.title} includes a comprehensive 1-year manufacturer warranty and a 30-day money-back guarantee.`,
        },
        {
          question: `How quickly will ${product.title} ship?`,
          answer: `Orders placed before 2 PM EST ship same-day with standard delivery taking 2-4 business days.`,
        },
      ];

  const jsonLdSchema = fix?.jsonLdSchema || {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.body_html?.replace(/<[^>]*>?/gm, '') || product.title,
    brand: {
      '@type': 'Brand',
      name: product.vendor || 'Store Brand',
    },
    offers: {
      '@type': 'Offer',
      price: product.price || '49.99',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    mainEntity: {
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer,
        },
      })),
    },
  };

  const handleApproveAndPublish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccess(false);

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          newDescription: optimizedDesc,
          previousDescription: product.body_html || '',
          faqs,
          jsonLdSchema,
          shopDomain,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPublishSuccess(true);
        if (onPublished) onPublished();
        setTimeout(() => {
          onClose();
          setPublishSuccess(false);
        }, 1800);
      } else {
        setPublishError(data.error || 'Failed to publish optimizations to Shopify.');
      }
    } catch (e: any) {
      setPublishError(e.message || 'Network error occurred while publishing.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyJsonLd = () => {
    navigator.clipboard.writeText(JSON.stringify(jsonLdSchema, null, 2));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-gray-900/60 backdrop-blur-xs flex justify-end transition-opacity animate-in fade-in duration-200">
      {/* Click Backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-5xl bg-white h-full shadow-2xl flex flex-col z-10">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 leading-none">
                  Before & After Recommendation
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 uppercase">
                  Gemini 2.5 Flash
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 truncate max-w-md">
                Reviewing fixes for: <strong className="text-gray-800">{product.title}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {audit && (
              <div className="hidden sm:flex items-center gap-2 mr-2">
                <ScoreBadge score={audit.overallScore} label="Overall" size="sm" />
                <ScoreBadge score={audit.geoBreakdown.score} label="GEO" size="sm" />
                <ScoreBadge score={audit.aeoBreakdown.score} label="AEO" size="sm" />
                <ScoreBadge score={audit.aioBreakdown.score} label="AIO" size="sm" />
              </div>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2.5 bg-white border-b border-gray-100 flex items-center gap-2 text-xs font-semibold text-gray-600">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'all' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Full Comparison
          </button>
          <button
            onClick={() => setActiveTab('description')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'description' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> HTML Description
          </button>
          <button
            onClick={() => setActiveTab('faqs')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'faqs' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" /> Structured FAQs
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'schema' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" /> JSON-LD Schema
          </button>
        </div>

        {/* Side-by-Side Comparison Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {publishError && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{publishError}</span>
            </div>
          )}

          {publishSuccess && (
            <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Success! Optimizations approved and pushed live to Shopify Admin API.</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN: Current Product Content */}
            <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-gray-100/80 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Current Store Content
                </span>
                <span className="text-[11px] font-medium text-gray-500">Unoptimized Status</span>
              </div>

              <div className="p-4 space-y-4 flex-1">
                {/* Description Box */}
                {(activeTab === 'all' || activeTab === 'description') && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Current Body HTML / Description
                    </h4>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {product.body_html || 'No product description currently provided.'}
                    </div>
                  </div>
                )}

                {/* FAQ Box */}
                {(activeTab === 'all' || activeTab === 'faqs') && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Existing Metafield FAQs
                    </h4>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 italic">
                      {product.metafields?.faq_data?.length
                        ? `${product.metafields.faq_data.length} FAQs stored in metafields.`
                        : 'No structured Q&A FAQs detected in store theme.'}
                    </div>
                  </div>
                )}

                {/* JSON-LD Schema Box */}
                {(activeTab === 'all' || activeTab === 'schema') && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Current JSON-LD Schema
                    </h4>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 font-mono">
                      {product.metafields?.jsonld_schema
                        ? JSON.stringify(product.metafields.jsonld_schema, null, 2)
                        : 'Missing rich product JSON-LD schema.'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: AI Recommendation Fixes */}
            <div className="bg-white rounded-xl border border-emerald-300 shadow-sm overflow-hidden flex flex-col ring-1 ring-emerald-500/20">
              <div className="px-4 py-3 bg-emerald-50/80 border-b border-emerald-200 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Gemini AI Fix Recommendation
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  GEO/AEO/AIO Ready
                </span>
              </div>

              <div className="p-4 space-y-5 flex-1">
                {/* AI Optimized Description */}
                {(activeTab === 'all' || activeTab === 'description') && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-emerald-600" /> Optimized Markdown / HTML
                      </h4>
                      <span className="text-[10px] text-emerald-600 font-medium">Enhanced Spec Density</span>
                    </div>
                    <div
                      className="p-3 bg-emerald-50/30 border border-emerald-200 rounded-lg text-xs text-gray-800 max-h-56 overflow-y-auto prose prose-xs"
                      dangerouslySetInnerHTML={{ __html: optimizedDesc }}
                    />
                  </div>
                )}

                {/* AI Structured FAQs */}
                {(activeTab === 'all' || activeTab === 'faqs') && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5 text-emerald-600" /> Answer Engine FAQs ({faqs.length})
                      </h4>
                      <span className="text-[10px] text-emerald-600 font-medium">Conversational AEO</span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {faqs.map((faq, i) => (
                        <div key={i} className="p-2.5 bg-emerald-50/40 border border-emerald-200/80 rounded-lg text-xs">
                          <p className="font-bold text-gray-900 mb-1">Q: {faq.question}</p>
                          <p className="text-gray-600">A: {faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Generated JSON-LD Schema */}
                {(activeTab === 'all' || activeTab === 'schema') && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                        <FileCode2 className="w-3.5 h-3.5 text-emerald-600" /> Generated JSON-LD Schema
                      </h4>
                      <button
                        onClick={handleCopyJsonLd}
                        className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
                      >
                        {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedCode ? 'Copied!' : 'Copy Code'}
                      </button>
                    </div>
                    <pre className="p-3 bg-gray-900 text-emerald-400 rounded-lg text-[11px] font-mono max-h-48 overflow-y-auto leading-relaxed">
                      {JSON.stringify(jsonLdSchema, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Clicking approve updates product description & injects Metafield JSON-LD live.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleApproveAndPublish}
              disabled={isPublishing}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              {isPublishing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Publishing to Shopify...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Approve & Publish Fixes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
