'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Check,
  Zap,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  HelpCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Flame,
  Lock,
  Rocket,
  BarChart3,
  RefreshCw,
  X,
} from 'lucide-react';
import { PLAN_TIERS, type PlanTierKey, type UsageCheckResult } from '@/lib/billing/plans';

function PricingPageInner() {
  const searchParams = useSearchParams();
  const shopDomain = searchParams.get('shop') || 'demo-store.myshopify.com';
  const billingStatusParam = searchParams.get('billing');
  const errorParam = searchParams.get('error');

  const [activePlan, setActivePlan] = useState<PlanTierKey>('FREE');
  const [usage, setUsage] = useState<UsageCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscribingTier, setSubscribingTier] = useState<PlanTierKey | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/billing/status?shop=${encodeURIComponent(shopDomain)}`);
      const data = await res.json();
      if (data.success && data.subscription) {
        setActivePlan(data.subscription.active_plan as PlanTierKey);
        setUsage(data.usage);
      }
    } catch (e) {
      console.error('Error fetching billing status:', e);
    } finally {
      setIsLoading(false);
    }
  }, [shopDomain]);

  useEffect(() => {
    fetchStatus();

    if (billingStatusParam === 'success') {
      setNotification({
        type: 'success',
        message: '🎉 Your Growth Pilot subscription is now active! You can now sync up to 500 products with weekly automated audits.',
      });
    } else if (billingStatusParam === 'downgraded') {
      setNotification({ type: 'success', message: 'You have switched back to the Free Plan.' });
    } else if (errorParam) {
      setNotification({ type: 'error', message: decodeURIComponent(errorParam) });
    }
  }, [fetchStatus, billingStatusParam, errorParam]);

  const handleSelectPlan = async (planKey: PlanTierKey) => {
    if (planKey === activePlan) return;
    setSubscribingTier(planKey);
    setNotification(null);

    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName: planKey, shopDomain }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.confirmationUrl) {
          window.location.href = data.confirmationUrl;
        } else if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          setActivePlan(planKey);
          await fetchStatus();
          setNotification({
            type: 'success',
            message: `Successfully switched to ${PLAN_TIERS[planKey].name}!`,
          });
        }
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to initiate subscription change.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Network error while initiating subscription.' });
    } finally {
      setSubscribingTier(null);
    }
  };

  const freePlan = PLAN_TIERS.FREE;
  const growthPlan = PLAN_TIERS.GROWTH_PILOT;

  const syncedProducts = usage?.syncedProducts ?? 0;
  const productLimit = usage?.productLimit ?? 10;
  const productPercent = Math.min(100, Math.round((syncedProducts / productLimit) * 100));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm sticky top-0 z-30 bg-slate-950/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/?shop=${encodeURIComponent(shopDomain)}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors border border-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <div className="h-5 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <h1 className="text-base font-bold">Plans & Pricing</h1>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-white">{shopDomain}</p>
            <p className="text-[11px] text-slate-400">
              Current Plan:{' '}
              <span className="font-bold text-violet-400">
                {activePlan === 'GROWTH_PILOT' ? 'Growth Pilot' : 'Free'}
              </span>
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-24">
        {/* Notification Banner */}
        {notification && (
          <div
            className={`mb-8 p-4 rounded-xl border flex items-start justify-between gap-4 text-sm animate-in fade-in duration-300 ${
              notification.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-start gap-3">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              )}
              <p className="font-medium">{notification.message}</p>
            </div>
            <button onClick={() => setNotification(null)} className="shrink-0 mt-0.5 opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-semibold uppercase tracking-wider mb-5">
            <Flame className="w-3.5 h-3.5" />
            Shopify Native Billing
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-transparent">
            Start free. Scale when ready.
          </h2>
          <p className="mt-4 text-base text-slate-400 leading-relaxed">
            Optimize your product catalog for ChatGPT, Perplexity, and Google Gemini. Billed directly through Shopify — no extra accounts needed.
          </p>
        </div>

        {/* Usage Summary (when on Free plan) */}
        {!isLoading && usage && activePlan === 'FREE' && (
          <div className="max-w-xl mx-auto mb-10 bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Your Free Plan Usage
            </p>
            <div className="space-y-3">
              {/* Products synced */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Products Synced</span>
                  <span className={`font-bold ${productPercent >= 100 ? 'text-rose-400' : 'text-slate-300'}`}>
                    {syncedProducts} / {productLimit}
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${productPercent >= 100 ? 'bg-rose-500' : 'bg-violet-500'}`}
                    style={{ width: `${productPercent}%` }}
                  />
                </div>
              </div>
              {/* AI evaluations */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">AI Evaluations This Month</span>
                  <span className={`font-bold ${usage.percent >= 100 ? 'text-rose-400' : 'text-slate-300'}`}>
                    {usage.used} / {usage.limit}
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${usage.percent >= 100 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, usage.percent)}%` }}
                  />
                </div>
              </div>
            </div>
            {(productPercent >= 100 || usage.percent >= 100) && (
              <p className="mt-4 text-xs text-amber-400 font-medium">
                ⚡ You&apos;ve hit a Free plan limit. Upgrade to Growth Pilot to unlock more capacity instantly.
              </p>
            )}
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">

          {/* FREE CARD */}
          <div className={`relative rounded-2xl border flex flex-col transition-all duration-200 ${
            activePlan === 'FREE'
              ? 'border-violet-500/40 bg-white/5 ring-2 ring-violet-500/20'
              : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
          }`}>
            {activePlan === 'FREE' && (
              <div className="absolute -top-3.5 left-6">
                <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-violet-600 text-white shadow">
                  Current Plan
                </span>
              </div>
            )}

            <div className="p-7 flex-1">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{freePlan.name}</h3>
                  <p className="text-xs text-slate-500">No credit card needed</p>
                </div>
              </div>

              <div className="mb-6">
                <span className="text-5xl font-extrabold text-white">$0</span>
                <span className="text-sm text-slate-500 ml-1.5">/ month</span>
              </div>

              <p className="text-sm text-slate-400 mb-6 leading-relaxed">{freePlan.description}</p>

              {/* Limits callout */}
              <div className="bg-slate-800/60 border border-white/5 rounded-xl p-4 mb-6 space-y-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-slate-300 font-medium">Up to <strong className="text-white">10 products</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-slate-300 font-medium"><strong className="text-white">1 AI evaluation</strong> per month</span>
                </div>
              </div>

              <ul className="space-y-2.5">
                {freePlan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-400">
                    <Check className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-7 pt-0">
              {activePlan === 'FREE' ? (
                <div className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-center bg-white/5 text-slate-500 border border-white/10 cursor-default">
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={() => handleSelectPlan('FREE')}
                  disabled={!!subscribingTier || isLoading}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center justify-center gap-2"
                >
                  {subscribingTier === 'FREE' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Downgrading...</>
                  ) : 'Downgrade to Free'}
                </button>
              )}
            </div>
          </div>

          {/* GROWTH PILOT CARD */}
          <div className={`relative rounded-2xl flex flex-col transition-all duration-200 ${
            activePlan === 'GROWTH_PILOT'
              ? 'border-2 border-violet-500 bg-gradient-to-b from-violet-950/60 to-slate-900/80 ring-4 ring-violet-500/20'
              : 'border-2 border-violet-500/50 bg-gradient-to-b from-violet-950/40 to-slate-900/60 hover:border-violet-500 hover:shadow-violet-500/20 hover:shadow-2xl'
          }`}>
            {/* Popular badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-gradient-to-r from-violet-500 to-violet-700 text-white shadow-lg shadow-violet-500/30">
                {activePlan === 'GROWTH_PILOT' ? 'Current Plan' : growthPlan.badge}
              </span>
            </div>

            <div className="p-7 flex-1">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{growthPlan.name}</h3>
                  <p className="text-xs text-violet-400">Billed via Shopify</p>
                </div>
              </div>

              <div className="mb-6">
                <span className="text-5xl font-extrabold text-white">$29</span>
                <span className="text-sm text-slate-400 ml-1.5">/ month</span>
              </div>

              <p className="text-sm text-slate-300 mb-6 leading-relaxed">{growthPlan.description}</p>

              {/* Highlights callout */}
              <div className="bg-violet-900/30 border border-violet-500/20 rounded-xl p-4 mb-6 space-y-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <Rocket className="w-4 h-4 text-violet-400 shrink-0" />
                  <span className="text-slate-200 font-medium">Up to <strong className="text-white">500 products</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-violet-400 shrink-0" />
                  <span className="text-slate-200 font-medium"><strong className="text-white">50 AI evaluations</strong> / month</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <RefreshCw className="w-4 h-4 text-violet-400 shrink-0" />
                  <span className="text-slate-200 font-medium"><strong className="text-white">Weekly automated</strong> catalog re-audits</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <BarChart3 className="w-4 h-4 text-violet-400 shrink-0" />
                  <span className="text-slate-200 font-medium"><strong className="text-white">Multi-engine</strong> AI search tracking</span>
                </div>
              </div>

              <ul className="space-y-2.5">
                {growthPlan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-7 pt-0">
              {activePlan === 'GROWTH_PILOT' ? (
                <div className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-center bg-violet-600/20 text-violet-300 border border-violet-500/30 cursor-default">
                  <ShieldCheck className="inline w-4 h-4 mr-1.5 -mt-0.5" />
                  Active Subscription
                </div>
              ) : (
                <button
                  onClick={() => handleSelectPlan('GROWTH_PILOT')}
                  disabled={!!subscribingTier || isLoading}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all duration-200 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {subscribingTier === 'GROWTH_PILOT' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Connecting to Shopify...</>
                  ) : (
                    <><Rocket className="w-4 h-4" /> Upgrade to Growth Pilot — $29/mo</>
                  )}
                </button>
              )}
              <p className="text-center text-[11px] text-slate-600 mt-3">
                Cancel anytime · Prorated on upgrade · Billed via Shopify
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <section className="mt-20 max-w-3xl mx-auto border-t border-white/10 pt-14">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-white">Frequently Asked Questions</h3>
            <p className="text-sm text-slate-500 mt-1">Everything you need to know about billing and quotas</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                q: 'How are charges billed?',
                a: 'All subscriptions are billed directly on your monthly Shopify invoice using the official Shopify Recurring Billing API. No separate credit card required.',
              },
              {
                q: 'What counts as an AI evaluation?',
                a: 'An evaluation is counted when Gemini AI generates an enhanced description, FAQ schemas, or JSON-LD structured data for a product. Deterministic scoring audits are always free.',
              },
              {
                q: 'What happens when I hit the 10-product limit?',
                a: 'On the Free plan, syncing a new product batch will be blocked once you\'ve synced 10 products. Upgrade to Growth Pilot to unlock up to 500 products instantly.',
              },
              {
                q: 'What are weekly automated audits?',
                a: 'Growth Pilot subscribers get their entire product catalog automatically re-audited every week — keeping GEO, AEO & AIO scores fresh as your content changes.',
              },
              {
                q: 'Can I upgrade or downgrade anytime?',
                a: 'Yes. Shopify prorates upgrades automatically. When you upgrade, your new product and evaluation quota is unlocked immediately.',
              },
              {
                q: 'What is multi-engine AI tracking?',
                a: 'Growth Pilot tracks your product visibility and sentiment across ChatGPT, Perplexity AI, and Google Gemini separately — giving you per-engine readiness scores.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="bg-white/[0.03] border border-white/10 p-5 rounded-xl">
                <h4 className="text-sm font-bold text-white mb-2 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  {q}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    }>
      <PricingPageInner />
    </Suspense>
  );
}
