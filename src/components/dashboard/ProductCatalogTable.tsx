'use client';

import React from 'react';
import { ScoreGauge } from './ScoreGauge';
import { ShopifyProductItem } from '@/lib/scoring/types';
import { Sparkles, ArrowRight, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface ProductCatalogTableProps {
  products: ShopifyProductItem[];
  onSelectProduct: (product: ShopifyProductItem) => void;
  onOptimizeProduct: (product: ShopifyProductItem) => void;
}

export function ProductCatalogTable({
  products,
  onSelectProduct,
  onOptimizeProduct,
}: ProductCatalogTableProps) {
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">No products match your filters</h3>
        <p className="text-sm text-gray-500 mt-1">Try broadening your score range or search keyword.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200/80 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="py-3.5 px-4 w-72">Product</th>
              <th className="py-3.5 px-4 text-center w-28">Overall Score</th>
              <th className="py-3.5 px-4 text-center w-24">GEO Score</th>
              <th className="py-3.5 px-4 text-center w-24">AEO Score</th>
              <th className="py-3.5 px-4 text-center w-24">AIO Score</th>
              <th className="py-3.5 px-4 w-48">Audit Status</th>
              <th className="py-3.5 px-4 text-right w-36">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200/60 text-sm">
            {products.map((product) => {
              const audit = product.audit;
              const overall = audit?.overallScore || 0;
              const geo = audit?.geoBreakdown.score || 0;
              const aeo = audit?.aeoBreakdown.score || 0;
              const aio = audit?.aioBreakdown.score || 0;
              const criticalIssuesCount = audit?.issues.filter(i => i.severity === 'critical').length || 0;

              return (
                <tr
                  key={product.id}
                  className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                  onClick={() => onSelectProduct(product)}
                >
                  {/* Product Title & Vendor */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 relative">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image_url}
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 font-bold">
                            NO IMG
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                          {product.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                          <span>{product.vendor || 'Unknown Brand'}</span>
                          <span>•</span>
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-medium">
                            {product.product_type || 'General'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Overall Score */}
                  <td className="py-4 px-4 text-center">
                    <div className="flex justify-center">
                      <ScoreGauge score={overall} size="sm" showLabel={false} />
                    </div>
                  </td>

                  {/* GEO Score */}
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${
                      geo >= 80 ? 'bg-emerald-50 text-emerald-700' : geo >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {geo}
                    </span>
                  </td>

                  {/* AEO Score */}
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${
                      aeo >= 80 ? 'bg-blue-50 text-blue-700' : aeo >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {aeo}
                    </span>
                  </td>

                  {/* AIO Score */}
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${
                      aio >= 80 ? 'bg-purple-50 text-purple-700' : aio >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {aio}
                    </span>
                  </td>

                  {/* Audit Diagnostic Status */}
                  <td className="py-4 px-4">
                    {overall >= 80 ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>AI Ready & Indexed</span>
                      </div>
                    ) : criticalIssuesCount > 0 ? (
                      <div className="flex items-center gap-1.5 text-xs text-red-700 font-medium">
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span>{criticalIssuesCount} critical issue{criticalIssuesCount > 1 ? 's' : ''}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                        <ShieldCheck className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span>Needs optimization</span>
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/products/${encodeURIComponent(product.id)}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Optimize
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
