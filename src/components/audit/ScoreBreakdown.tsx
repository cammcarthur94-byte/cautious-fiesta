'use client';

import React from 'react';
import { AuditResult, AuditIssue } from '@/lib/scoring/types';
import { ScoreGauge } from '../dashboard/ScoreGauge';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, ChevronRight, Zap } from 'lucide-react';

interface ScoreBreakdownProps {
  audit: AuditResult;
  onApplyFix?: (issue: AuditIssue) => void;
}

export function ScoreBreakdown({ audit, onApplyFix }: ScoreBreakdownProps) {
  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200"><AlertCircle className="w-3 h-3" /> Critical</span>;
      case 'warning':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><AlertTriangle className="w-3 h-3" /> Warning</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"><Info className="w-3 h-3" /> Info</span>;
    }
  };

  const getPillarPill = (pillar: string) => {
    switch (pillar) {
      case 'GEO':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">GEO</span>;
      case 'AEO':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">AEO</span>;
      case 'AIO':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800">AIO</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 3 Pillar Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* GEO Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                GEO Pillar (40%)
              </span>
              <h4 className="text-sm font-bold text-gray-900 mt-1">Generative Engine</h4>
            </div>
            <ScoreGauge score={audit.geoBreakdown.score} size="sm" showLabel={false} />
          </div>
          <div className="space-y-2 mt-4 text-xs">
            {Object.entries(audit.geoBreakdown.subScores).map(([k, item]) => (
              <div key={k} className="border-t border-gray-100 pt-2">
                <div className="flex justify-between font-medium text-gray-700">
                  <span>{item.name}</span>
                  <span>{item.score}/{item.maxScore}</span>
                </div>
                <p className="text-gray-500 text-[11px] mt-0.5">{item.notes}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AEO Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                AEO Pillar (35%)
              </span>
              <h4 className="text-sm font-bold text-gray-900 mt-1">Answer Engine</h4>
            </div>
            <ScoreGauge score={audit.aeoBreakdown.score} size="sm" showLabel={false} />
          </div>
          <div className="space-y-2 mt-4 text-xs">
            {Object.entries(audit.aeoBreakdown.subScores).map(([k, item]) => (
              <div key={k} className="border-t border-gray-100 pt-2">
                <div className="flex justify-between font-medium text-gray-700">
                  <span>{item.name}</span>
                  <span>{item.score}/{item.maxScore}</span>
                </div>
                <p className="text-gray-500 text-[11px] mt-0.5">{item.notes}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AIO Card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                AIO Pillar (25%)
              </span>
              <h4 className="text-sm font-bold text-gray-900 mt-1">AI Overview & Schema</h4>
            </div>
            <ScoreGauge score={audit.aioBreakdown.score} size="sm" showLabel={false} />
          </div>
          <div className="space-y-2 mt-4 text-xs">
            {Object.entries(audit.aioBreakdown.subScores).map(([k, item]) => (
              <div key={k} className="border-t border-gray-100 pt-2">
                <div className="flex justify-between font-medium text-gray-700">
                  <span>{item.name}</span>
                  <span>{item.score}/{item.maxScore}</span>
                </div>
                <p className="text-gray-500 text-[11px] mt-0.5">{item.notes}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detected Issues List */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50/70 border-b border-gray-200/80 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span>Detected Optimization Gaps</span>
            <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full font-medium">
              {audit.issues.length}
            </span>
          </h3>
          <span className="text-xs text-gray-500">Auto-resolved by Gemini AI Fix Generator</span>
        </div>

        {audit.issues.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-gray-900">Zero Critical Issues Found!</h4>
            <p className="text-xs text-gray-500 mt-1">This product meets all current GEO, AEO, and Schema best practices.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {audit.issues.map((issue) => (
              <div key={issue.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getPillarPill(issue.pillar)}
                      {getSeverityBadge(issue.severity)}
                      <h4 className="text-sm font-semibold text-gray-900">{issue.title}</h4>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed pl-1">{issue.description}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-xs font-semibold text-red-600">
                      -{issue.scoreDeduction} pts
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
