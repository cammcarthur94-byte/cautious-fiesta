'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ShopifyProductItem, AuditResult, FAQPair } from '@/lib/scoring/types';
import { ScoreGauge } from '@/components/dashboard/ScoreGauge';
import { ScoreBreakdown } from '@/components/audit/ScoreBreakdown';
import { BeforeAfterDiffView } from '@/components/audit/BeforeAfterDiffView';
import { SchemaViewer } from '@/components/audit/SchemaViewer';
import { FaqEditor } from '@/components/audit/FaqEditor';
import { RollbackDrawer } from '@/components/audit/RollbackDrawer';
import {
  ArrowLeft,
  Sparkles,
  UploadCloud,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  HelpCircle,
  Code2,
  Layers,
  Check,
} from 'lucide-react';
import Link from 'next/link';

export default function ProductOptimizationPage() {
  const params = useParams();
  const router = useRouter();
  const productId = decodeURIComponent(params.id as string);

  const [product, setProduct] = useState<ShopifyProductItem | null>(null);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<'diff' | 'diagnostic' | 'faqs' | 'schema'>('diff');
  const [isRollbackOpen, setIsRollbackOpen] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Editable generated state
  const [optimizedDescription, setOptimizedDescription] = useState('');
  const [faqs, setFaqs] = useState<FAQPair[]>([]);
  const [jsonLdSchema, setJsonLdSchema] = useState<Record<string, any>>({});
  const [hasGenerated, setHasGenerated] = useState(false);
  const [predictedScores, setPredictedScores] = useState({ geo: 0, aeo: 0, aio: 0, overall: 0 });

  useEffect(() => {
    async function loadProduct() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/audit?productId=${encodeURIComponent(productId)}`);
        const data = await res.json();
        if (data.success && data.product) {
          setProduct(data.product);
          setAudit(data.audit);
          // Initial trigger of fix generation
          handleGenerateOptimization(data.product, data.audit);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleGenerateOptimization = async (prod?: ShopifyProductItem, aud?: AuditResult) => {
    const targetProduct = prod || product;
    if (!targetProduct) return;

    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: targetProduct, shopDomain: 'demo-store.myshopify.com' }),
      });
      const data = await res.json();
      if (data.success && data.optimization) {
        setOptimizedDescription(data.optimization.optimizedDescription);
        setFaqs(data.optimization.faqs);
        setJsonLdSchema(data.optimization.jsonLdSchema);
        setHasGenerated(true);
        if (data.optimization.predictedScores) {
          setPredictedScores(data.optimization.predictedScores);
        }
      } else if (data.code === 'USAGE_LIMIT_EXCEEDED') {
        setErrorToast('Monthly optimization limit reached! Please upgrade your plan in Pricing & Plans.');
        setTimeout(() => setErrorToast(null), 7000);
      } else {
        setErrorToast(data.error || 'Failed to generate AI optimization.');
        setTimeout(() => setErrorToast(null), 5000);
      }
    } catch (e: any) {
      console.error(e);
      setErrorToast('Failed to generate AI optimization. Please try again.');
      setTimeout(() => setErrorToast(null), 5000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!product) return;
    setIsPublishing(true);
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          shopDomain: 'demo-store.myshopify.com',
          newDescription: optimizedDescription,
          previousDescription: product.body_html,
          faqs,
          jsonLdSchema,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPublishSuccess(true);
        setTimeout(() => setPublishSuccess(false), 4000);
      }
    } catch (e: any) {
      console.error(e);
      setErrorToast('Failed to publish changes to Shopify. Please try again.');
      setTimeout(() => setErrorToast(null), 5000);
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading || !product) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Sparkles className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
          <p className="text-sm font-medium text-gray-600">Loading Product Diagnostic & AI Studio...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-[#f7f7f8] text-[#202223] pb-20">
      {/* Top Breadcrumb & Action Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-900 truncate max-w-md">{product.title}</h2>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                  {product.product_type}
                </span>
              </div>
              <span className="text-xs text-gray-500">ID: {product.id} • Vendor: {product.vendor}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRollbackOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Rollback
            </button>

            <button
              onClick={() => handleGenerateOptimization()}
              disabled={isGenerating}
              className="px-3.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition-colors border border-emerald-300"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Regenerating AI Fix...' : 'Re-Run Gemini Fix'}
            </button>

            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <UploadCloud className="w-4 h-4" />
              {isPublishing ? 'Publishing to Shopify...' : 'One-Click Publish'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Success Alert */}
        {/* Error Toast */}
        {errorToast && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl flex items-center gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold">Operation Failed</p>
              <p className="text-xs text-red-700 mt-0.5">{errorToast}</p>
            </div>
          </div>
        )}

        {publishSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-3 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold">Successfully Published & Backup Created!</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Product description updated in Shopify Admin and JSON-LD/FAQ metafields synced to Theme App Extension.
              </p>
            </div>
          </div>
        )}

        {/* Product Score Card Header */}
        <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">NO IMG</div>
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{product.title}</h1>
              <p className="text-xs text-gray-500 mt-1">
                Optimizing for Answer Engine extraction, Google AI Overviews, and Generative Citations.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  GEO Score: {audit?.geoBreakdown.score || 0}/100
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  AEO Score: {audit?.aeoBreakdown.score || 0}/100
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                  AIO Score: {audit?.aioBreakdown.score || 0}/100
                </span>
              </div>
            </div>
          </div>

          {/* Current vs Predicted Score Progression */}
          <div className="flex items-center gap-6 bg-gray-50/80 p-4 rounded-xl border border-gray-200/60">
            <div className="text-center">
              <ScoreGauge score={audit?.overallScore || 0} size="md" label="Current Score" />
            </div>
            <div className="text-gray-300 font-bold text-xl">→</div>
            <div className="text-center">
              <ScoreGauge score={predictedScores.overall || (hasGenerated ? 96 : 0)} size="md" label="AI Predicted" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('diff')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'diff'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <FileText className="w-4 h-4" /> Before & After Diff Studio
          </button>
          <button
            onClick={() => setActiveTab('diagnostic')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'diagnostic'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Layers className="w-4 h-4" /> Pillar Diagnostics ({audit?.issues.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('faqs')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'faqs'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <HelpCircle className="w-4 h-4" /> Conversational FAQs ({faqs.length})
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'schema'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Code2 className="w-4 h-4" /> JSON-LD Microdata
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'diff' && (
          <BeforeAfterDiffView
            originalHtml={product.body_html}
            optimizedHtml={optimizedDescription}
            onOptimizedChange={setOptimizedDescription}
          />
        )}

        {activeTab === 'diagnostic' && audit && (
          <ScoreBreakdown audit={audit} />
        )}

        {activeTab === 'faqs' && (
          <FaqEditor faqs={faqs} onChange={setFaqs} />
        )}

        {activeTab === 'schema' && (
          <SchemaViewer schema={jsonLdSchema} />
        )}
      </div>

      {/* Rollback Drawer */}
      <RollbackDrawer
        isOpen={isRollbackOpen}
        onClose={() => setIsRollbackOpen(false)}
        productId={product.id}
        onRollbackSuccess={() => {
          router.refresh();
        }}
      />
    </div>
    </ErrorBoundary>
  );
}
