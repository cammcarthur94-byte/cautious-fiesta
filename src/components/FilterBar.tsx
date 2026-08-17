'use client';

import React from 'react';
import { Search, Filter, Sparkles, ArrowUpDown, RefreshCw, Layers } from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  categories: string[];
  totalResults: number;
  onSyncCatalog: () => void;
  onBulkAudit: () => void;
  isSyncing?: boolean;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
  selectedCategory,
  onCategoryChange,
  categories,
  totalResults,
  onSyncCatalog,
  onBulkAudit,
  isSyncing = false,
}: FilterBarProps) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs mb-6 space-y-4 sticky top-16 z-20">
      {/* Top Search & Actions Row */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products by title, vendor, or category..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50/60 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-gray-400"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
          <button
            onClick={onBulkAudit}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200/80 text-gray-800 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-gray-200 transition-colors shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bulk Audit</span>
          </button>

          <button
            onClick={onSyncCatalog}
            disabled={isSyncing}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing Catalog...' : 'Sync Catalog'}</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Dropdown Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50/80 border border-gray-200 rounded-lg font-medium text-gray-700 focus:outline-none focus:border-emerald-600"
            >
              <option value="all">All Statuses</option>
              <option value="optimized">Optimized (80+)</option>
              <option value="pending">Pending Review (50-79)</option>
              <option value="needs_audit">Needs Audit (&lt;50)</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-500 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" /> Sort Score:
            </span>
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50/80 border border-gray-200 rounded-lg font-medium text-gray-700 focus:outline-none focus:border-emerald-600"
            >
              <option value="overall">Overall Score (High → Low)</option>
              <option value="geo">GEO Score (High → Low)</option>
              <option value="aeo">AEO Score (High → Low)</option>
              <option value="aio">AIO Score (High → Low)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-500 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Category:
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50/80 border border-gray-200 rounded-lg font-medium text-gray-700 focus:outline-none focus:border-emerald-600"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-gray-400 font-medium">
          Showing <strong className="text-gray-800">{totalResults}</strong> products
        </div>
      </div>
    </div>
  );
}
