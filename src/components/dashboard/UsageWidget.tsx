'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Zap, AlertTriangle, ArrowUpRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { UsageCheckResult } from '@/lib/billing/plans';

interface UsageWidgetProps {
  shopDomain?: string;
  onPlanChange?: () => void;
  className?: string;
}

export function UsageWidget({ shopDomain = 'demo-store.myshopify.com', className = '' }: UsageWidgetProps) {
  const [usage, setUsage] = useState<UsageCheckResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/billing/status?shop=${encodeURIComponent(shopDomain)}`);
      const data = await res.json();
      if (data.success && data.usage) {
        setUsage(data.usage);
      }
    } catch (e) {
      console.error('Failed to load usage status:', e);
    } finally {
      setLoading(false);
    }
  }, [shopDomain]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (loading) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200/80 p-5 shadow-xs animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div className="h-2.5 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (!usage) return null;

  const { used, limit, percent, activePlan, planName, billingCycleEnd } = usage;
  const isNearLimit = percent >= 80 && percent < 100;
  const isExceeded = percent >= 100;

  // Format cycle end date
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(billingCycleEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  // Determine styling based on usage thresholds
  let barColor = 'bg-emerald-500';
  let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (isExceeded) {
    barColor = 'bg-rose-500';
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (isNearLimit) {
    barColor = 'bg-amber-500';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return (
    <div
      className={`bg-white rounded-xl border ${
        isExceeded
          ? 'border-rose-300 ring-2 ring-rose-50 shadow-sm'
          : isNearLimit
          ? 'border-amber-300 shadow-sm'
          : 'border-gray-200/80 shadow-xs'
      } p-5 transition-all duration-200 ${className}`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isExceeded
                ? 'bg-rose-100 text-rose-600'
                : isNearLimit
                ? 'bg-amber-100 text-amber-600'
                : 'bg-emerald-100 text-emerald-600'
            }`}
          >
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Monthly Usage</span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                {planName}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Cycle renews in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
            </p>
          </div>
        </div>

        <Link
          href={`/pricing?shop=${encodeURIComponent(shopDomain)}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1.5 rounded-lg border border-emerald-200 transition-colors"
        >
          {activePlan === 'PRO' ? 'Manage Plan' : 'Upgrade Plan'}
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Progress Bar Container */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-baseline text-xs">
          <span className="font-semibold text-gray-800">
            {used.toLocaleString()}{' '}
            <span className="text-gray-400 font-normal">/ {limit.toLocaleString()} Optimizations</span>
          </span>
          <span
            className={`font-semibold ${
              isExceeded ? 'text-rose-600' : isNearLimit ? 'text-amber-600' : 'text-gray-600'
            }`}
          >
            {percent}%
          </span>
        </div>

        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-500 rounded-full`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      </div>

      {/* Threshold Warning or Upsell Alert */}
      {isExceeded && (
        <div className="mt-3.5 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in duration-300">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-900">Optimization limit reached</p>
            <p className="text-rose-700 text-[11px] mt-0.5">
              Upgrade to Basic (1,000/mo) or Pro (10,000/mo) to continue generating one-click AI enhancements.
            </p>
            <Link
              href={`/pricing?shop=${encodeURIComponent(shopDomain)}`}
              className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-rose-700 hover:text-rose-900 underline underline-offset-2"
            >
              Unlock More Optimizations &rarr;
            </Link>
          </div>
        </div>
      )}

      {isNearLimit && !isExceeded && (
        <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>You have used {percent}% of your monthly quota.</span>
          </div>
          <Link
            href={`/pricing?shop=${encodeURIComponent(shopDomain)}`}
            className="font-bold text-amber-800 hover:text-amber-950 underline underline-offset-2 shrink-0 ml-2"
          >
            Upgrade
          </Link>
        </div>
      )}
    </div>
  );
}
