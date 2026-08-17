export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f7f7f8] text-[#202223]">
      {/* Header Skeleton */}
      <header className="bg-white border-b border-gray-200/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-200 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-56 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-40 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="w-9 h-9 rounded-lg bg-gray-100 animate-pulse" />
              </div>
              <div className="h-7 w-20 bg-gray-200 rounded animate-pulse mt-2" />
              <div className="h-3 w-32 bg-gray-100 rounded animate-pulse mt-2" />
            </div>
          ))}
        </div>

        {/* Filter Bar Skeleton */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-9 flex-1 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-9 w-56 bg-gray-100 rounded-lg animate-pulse" />
          </div>
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-7 w-20 bg-gray-100 rounded-full animate-pulse" />
            ))}
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50/80 border-b border-gray-200/80">
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="divide-y divide-gray-200/60">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="w-12 h-12 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-8 w-8 rounded-full bg-gray-100 animate-pulse" />
                <div className="h-6 w-10 bg-gray-100 rounded animate-pulse" />
                <div className="h-6 w-10 bg-gray-100 rounded animate-pulse" />
                <div className="h-6 w-10 bg-gray-100 rounded animate-pulse" />
                <div className="h-7 w-20 bg-gray-100 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
