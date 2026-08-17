'use client';

import React from 'react';
import { Search, Filter, Sparkles, AlertCircle, CheckCircle, Flame } from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedScoreRange: string;
  onScoreRangeChange: (range: string) => void;
  selectedPillar: string;
  onPillarChange: (pillar: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  categories: string[];
  totalResults: number;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  selectedScoreRange,
  onScoreRangeChange,
  selectedPillar,
  onPillarChange,
  selectedCategory,
  onCategoryChange,
  categories,
  totalResults,
}: FilterBarProps) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm mb-6 space-y-4">
      {/* Top Search & Category Row */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products by title, vendor, or SKU..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-gray-400"
          />
        </div>

        {/* Category Dropdown */}
        <div className="w-full md:w-56">
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-gray-700"
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

      {/* Filter Tabs & Quick Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
        {/* Score Range Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Score:
          </span>
          <button
            onClick={() => onScoreRangeChange('all')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              selectedScoreRange === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Products
          </button>
          <button
            onClick={() => onScoreRangeChange('critical')}
            className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 transition-colors ${
              selectedScoreRange === 'critical'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60'
            }`}
          >
            <AlertCircle className="w-3 h-3" /> Critical (&lt;50)
          </button>
          <button
            onClick={() => onScoreRangeChange('warning')}
            className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 transition-colors ${
              selectedScoreRange === 'warning'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            <Flame className="w-3 h-3" /> Needs Work (50-79)
          </button>
          <button
            onClick={() => onScoreRangeChange('healthy')}
            className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 transition-colors ${
              selectedScoreRange === 'healthy'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            <CheckCircle className="w-3 h-3" /> Optimized (80+)
          </button>
        </div>

        {/* Pillar Failure Highlights */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500 mr-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Focus:
          </span>
          <button
            onClick={() => onPillarChange(selectedPillar === 'geo_fail' ? 'all' : 'geo_fail')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
              selectedPillar === 'geo_fail'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-400 font-semibold'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            Low GEO
          </button>
          <button
            onClick={() => onPillarChange(selectedPillar === 'aeo_fail' ? 'all' : 'aeo_fail')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
              selectedPillar === 'aeo_fail'
                ? 'bg-blue-100 text-blue-800 border-blue-400 font-semibold'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            Low AEO
          </button>
          <button
            onClick={() => onPillarChange(selectedPillar === 'aio_fail' ? 'all' : 'aio_fail')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
              selectedPillar === 'aio_fail'
                ? 'bg-purple-100 text-purple-800 border-purple-400 font-semibold'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            Low AIO
          </button>
        </div>

        <span className="text-xs text-gray-400 font-medium">
          Showing {totalResults} products
        </span>
      </div>
    </div>
  );
}
