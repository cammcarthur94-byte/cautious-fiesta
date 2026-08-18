'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
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
  ExternalLink,
  Flame,
} from 'lucide-react';
import { PLAN_TIERS, type PlanTierKey, type PlanConfig, type UsageCheckResult } from '@/lib/billing/plans';

export default function PricingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shopDomain = searchParams.get('shop') || 'demo-store.myshopify.com';
  const billingStatusParam = searchParams.get('billing');

  const [activePlan, setActivePlan] = useState<PlanTierKey>('FREE');
  const [usage, setUsage] = useState<UsageCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscribingTier, setSubscribingTier] = useState<PlanTierKey | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch current subscription status
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
        message: 'Your subscription has been successfully updated! Enjoy your new optimization limits.',
      });
    } else if (billingStatusParam === 'downgraded') {
      setNotification({
        type: 'success',
        message: 'You have switched to the Free Tier.',
      });
    }
  }, [fetchStatus, billingStatusParam]);

  const handleSelectPlan = async (planKey: PlanTierKey) => {
    if (planKey === activePlan) return;

    setSubscribingTier(planKey);
    setNotification(null);

    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName: planKey,
          shopDomain,
        }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.confirmationUrl) {
          // If Shopify GraphQL returned confirmationUrl or demo redirectUrl
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
        setNotification({
          type: 'error',
          message: data.error || 'Failed to initiate subscription change.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Network error while initiating subscription.',
      });
    } finally {
      setSubscribingTier(null);
    }
  };

  const tiersList: PlanConfig[] = [PLAN_TIERS.FREE, PLAN_TIERS.BASIC, PLAN_TIERS.PRO];

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-[#202223] pb-24">
      {/* Top Header Navigation */}
      <header className="bg-white border-b border-gray-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/?shop=${encodeURIComponent(shopDomain)}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200/80 px-3 py-1.5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
            <div className="h-5 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <h1 className="text-base font-bold text-gray-900">Subscription & Usage Plans</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-right hidden sm:block">
              <p className="font-semibold text-gray-800">{shopDomain}</p>
              <p className="text-gray-400">Current Plan: <span className="font-bold text-emerald-600">{activePlan}</span></p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        {/* Banner Alert if any */}
        {notification && (
          <div
            className={`mb-8 p-4 rounded-xl border flex items-center justify-between text-sm shadow-xs animate-in fade-in duration-200 ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <p className="font-medium">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-4">
            <Flame className="w-3.5 h-3.5 text-emerald-600" />
            Shopify Billing Integration
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Scale Your AI Search Engine Dominance
          </h2>
          <p className="mt-3 text-base sm:text-lg text-gray-600">
            Optimize your product catalog for ChatGPT, Perplexity, and Google Gemini. Upgrade or downgrade anytime
            with 100% native Shopify billing.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {tiersList.map((tier) => {
            const isCurrent = activePlan === tier.id;
            const isSubscribing = subscribingTier === tier.id;
            const isPopular = tier.badge === 'Most Popular';
            const isPro = tier.id === 'PRO';

            return (
              <div
                key={tier.id}
                className={`relative rounded-2xl bg-white transition-all duration-200 flex flex-col justify-between ${
                  isPopular
                    ? 'border-2 border-emerald-600 shadow-xl ring-4 ring-emerald-50 scale-102 z-10'
                    : 'border border-gray-200/90 shadow-sm hover:shadow-md'
                }`}
              >
                {/* Badge if Popular or Pro */}
                {tier.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span
                      className={`px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm text-white ${
                        isPopular ? 'bg-emerald-600' : 'bg-gray-900'
                      }`}
                    >
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="p-6 sm:p-8">
                  {/* Tier Title and Description */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{tier.name}</h3>
                    {isCurrent && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                        Current Plan
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 min-h-[32px]">{tier.description}</p>

                  {/* Price */}
                  <div className="mt-6 mb-6 pb-6 border-b border-gray-100 flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-extrabold text-gray-900">
                      ${tier.price.toFixed(0)}
                    </span>
                    <span className="text-sm font-medium text-gray-500">
                      / month
                    </span>
                  </div>

                  {/* Monthly Limit Highlight */}
                  <div className="mb-6 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                      <Zap className="w-4 h-4 text-emerald-600" />
                      <span>{tier.limit.toLocaleString()} Optimizations / mo</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 pl-6">
                      Billed every 30 days directly via Shopify
                    </p>
                  </div>

                  {/* Feature List */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Included Features</p>
                    <ul className="space-y-2.5 text-xs text-gray-600">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="leading-snug">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Plan Action CTA */}
                <div className="p-6 sm:p-8 pt-0">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed text-center"
                    >
                      Active Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(tier.id)}
                      disabled={isSubscribing || isLoading}
                      className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                        isPopular
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow'
                          : isPro
                          ? 'bg-gray-900 hover:bg-black text-white shadow-sm'
                          : 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-300'
                      }`}
                    >
                      {isSubscribing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing with Shopify...
                        </>
                      ) : (
                        <>
                          {tier.price === 0
                            ? 'Downgrade to Free'
                            : activePlan === 'FREE'
                            ? `Upgrade to ${tier.name}`
                            : `Switch to ${tier.name}`}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ & Billing Guarantee Section */}
        <section className="mt-20 max-w-4xl mx-auto border-t border-gray-200/80 pt-14">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-gray-900">Frequently Asked Questions</h3>
            <p className="text-sm text-gray-500 mt-1">Everything you need to know about billing and quotas</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
              <h4 className="text-sm font-bold text-gray-900 mb-1.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                How are charges billed?
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                All subscriptions are billed directly on your monthly Shopify invoice using the official Shopify
                Recurring Billing API (EVERY_30_DAYS). No separate credit card entry required.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
              <h4 className="text-sm font-bold text-gray-900 mb-1.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                What counts as an optimization?
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                An optimization is counted when the Gemini AI engine generates an enhanced description, FAQ schemas,
                or JSON-LD structured data for a product. Basic deterministic audits are always free.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
              <h4 className="text-sm font-bold text-gray-900 mb-1.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                What happens when I reach my limit?
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                When you hit 100% of your tier limit, Gemini AI generation will pause until your next monthly billing
                cycle starts, or until you upgrade to a higher tier with more quota.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
              <h4 className="text-sm font-bold text-gray-900 mb-1.5 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                Can I upgrade or downgrade anytime?
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Yes! Shopify automatically prorates recurring subscription changes. When you upgrade, your new
                optimization quota is unlocked immediately.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
