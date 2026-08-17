'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    type: 'positive' | 'warning' | 'critical' | 'neutral';
  };
  accentColor?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  accentColor = 'text-gray-700',
}: MetricCardProps) {
  const badgeStyles = {
    positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    critical: 'bg-red-50 text-red-700 border-red-200',
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
  }[badge?.type || 'neutral'];

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg bg-gray-50 ${accentColor}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {badge && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeStyles}`}>
            {badge.text}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}
