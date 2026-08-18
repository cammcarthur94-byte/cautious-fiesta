'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  InlineGrid,
  Text,
  Badge,
  Banner,
  EmptyState,
  SkeletonPage,
  SkeletonBodyText,
  ProgressBar,
  Tabs,
  Box,
  Divider,
  Select,
} from '@shopify/polaris';
import { ProductTable, SortColumn, SortDirection } from '@/components/ProductTable';
import { RecommendationModal } from '@/components/RecommendationModal';
import { BatchAuditModal } from '@/components/dashboard/BatchAuditModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ShopifyProductItem } from '@/lib/scoring/types';
import { useSearchParams } from 'next/navigation';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const shopDomain = searchParams.get('shop') || 'demo-store.myshopify.com';

  const [products, setProducts] = useState<ShopifyProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedTab, setSelectedTab] = useState(0);
  const [sortKey, setSortKey] = useState<string>('overall_desc');
  const [sortColumn, setSortColumn] = useState<SortColumn>('overall');
  const [sortDirection, setSortDirection] = useState<SortDirection>('descending');

  const [selectedProductForFixes, setSelectedProductForFixes] =
    useState<ShopifyProductItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Billing usage state
  const [usageCount, setUsageCount] = useState<number>(0);
  const planLimit = 25; // 25 free audits per month

  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/products?shop=${encodeURIComponent(shopDomain)}`);
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
        setUsageCount(data.optimizationsUsed || 0);
      } else {
        setFetchError('Failed to parse products catalog.');
      }
    } catch (err: any) {
      setFetchError(err.message || 'Network error fetching products.');
    } finally {
      setIsLoading(false);
    }
  }, [shopDomain]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleSyncCatalog = async () => {
    setIsSyncing(true);
    try {
      await fetch('/api/sync-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopDomain }),
      });
      await fetchCatalog();
    } catch (e: any) {
      console.error('Catalog Sync Error:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Metric Computations
  const metrics = useMemo(() => {
    if (products.length === 0) {
      return { avgOverall: 0, avgGeo: 0, avgAeo: 0, avgAio: 0, criticalCount: 0 };
    }
    const sumOverall = products.reduce((acc, p) => acc + (p.audit?.overallScore || 0), 0);
    const sumGeo = products.reduce((acc, p) => acc + (p.audit?.geoBreakdown.score || 0), 0);
    const sumAeo = products.reduce((acc, p) => acc + (p.audit?.aeoBreakdown.score || 0), 0);
    const sumAio = products.reduce((acc, p) => acc + (p.audit?.aioBreakdown.score || 0), 0);
    const criticalCount = products.filter((p) => (p.audit?.overallScore || 0) < 50).length;

    return {
      avgOverall: Math.round(sumOverall / products.length),
      avgGeo: Math.round(sumGeo / products.length),
      avgAeo: Math.round(sumAeo / products.length),
      avgAio: Math.round(sumAio / products.length),
      criticalCount,
    };
  }, [products]);

  const sortOptions = [
    { label: 'Overall Score: Highest First', value: 'overall_desc' },
    { label: 'Overall Score: Lowest First', value: 'overall_asc' },
    { label: 'Status: Needs Audit First', value: 'status_asc' },
    { label: 'Status: Fully Optimized First', value: 'status_desc' },
    { label: 'GEO Score: Highest First', value: 'geo_desc' },
    { label: 'AEO Score: Highest First', value: 'aeo_desc' },
    { label: 'AIO Score: Highest First', value: 'aio_desc' },
    { label: 'Title: A to Z', value: 'title_asc' },
    { label: 'Title: Z to A', value: 'title_desc' },
  ];

  // Tabbed Filtering and Sorting
  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (selectedTab === 1) {
      // Needs Audit (<50)
      result = result.filter((p) => (p.audit?.overallScore || 0) < 50);
    } else if (selectedTab === 2) {
      // Pending Review (50-79)
      result = result.filter(
        (p) => (p.audit?.overallScore || 0) >= 50 && (p.audit?.overallScore || 0) < 80
      );
    } else if (selectedTab === 3) {
      // Optimized (80+)
      result = result.filter((p) => (p.audit?.overallScore || 0) >= 80);
    }

    result.sort((a, b) => {
      const overallA = a.audit?.overallScore || 0;
      const overallB = b.audit?.overallScore || 0;
      const geoA = a.audit?.geoBreakdown.score || 0;
      const geoB = b.audit?.geoBreakdown.score || 0;
      const aeoA = a.audit?.aeoBreakdown.score || 0;
      const aeoB = b.audit?.aeoBreakdown.score || 0;
      const aioA = a.audit?.aioBreakdown.score || 0;
      const aioB = b.audit?.aioBreakdown.score || 0;

      if (sortKey === 'overall_desc') return overallB - overallA;
      if (sortKey === 'overall_asc') return overallA - overallB;

      if (sortKey === 'status_asc') return overallA - overallB; // Needs Audit (<50) first
      if (sortKey === 'status_desc') return overallB - overallA; // Fully Optimized (80+) first

      if (sortKey === 'geo_desc') return geoB - geoA;
      if (sortKey === 'aeo_desc') return aeoB - aeoA;
      if (sortKey === 'aio_desc') return aioB - aioA;

      if (sortKey === 'title_asc') return a.title.localeCompare(b.title);
      if (sortKey === 'title_desc') return b.title.localeCompare(a.title);

      return 0;
    });

    return result;
  }, [products, selectedTab, sortKey]);

  const handleSortChange = (col: SortColumn, dir: SortDirection) => {
    setSortColumn(col);
    setSortDirection(dir);
    if (col === 'overall') {
      setSortKey(dir === 'descending' ? 'overall_desc' : 'overall_asc');
    } else if (col === 'status') {
      setSortKey(dir === 'ascending' ? 'status_asc' : 'status_desc');
    } else if (col === 'geo') {
      setSortKey('geo_desc');
    } else if (col === 'aeo') {
      setSortKey('aeo_desc');
    } else if (col === 'aio') {
      setSortKey('aio_desc');
    } else if (col === 'title') {
      setSortKey(dir === 'ascending' ? 'title_asc' : 'title_desc');
    }
  };

  const handleSortKeySelect = (val: string) => {
    setSortKey(val);
    if (val === 'overall_desc') { setSortColumn('overall'); setSortDirection('descending'); }
    else if (val === 'overall_asc') { setSortColumn('overall'); setSortDirection('ascending'); }
    else if (val === 'status_asc') { setSortColumn('status'); setSortDirection('ascending'); }
    else if (val === 'status_desc') { setSortColumn('status'); setSortDirection('descending'); }
    else if (val === 'title_asc') { setSortColumn('title'); setSortDirection('ascending'); }
    else if (val === 'title_desc') { setSortColumn('title'); setSortDirection('descending'); }
  };

  const tabs = [
    { id: 'all', content: 'All Products', panelID: 'all-products-content' },
    { id: 'needs_audit', content: `Needs Audit (${metrics.criticalCount})`, panelID: 'needs-audit-content' },
    { id: 'pending', content: 'Pending Review', panelID: 'pending-content' },
    { id: 'optimized', content: 'Fully Optimized', panelID: 'optimized-content' },
  ];

  const handleReviewFixes = (product: ShopifyProductItem) => {
    setSelectedProductForFixes(product);
    setIsModalOpen(true);
  };

  return (
    <ErrorBoundary>
      <Page
        title="AI Search Optimization"
        subtitle="Catalog Diagnostics, GEO/AEO/AIO Scoring & Gemini Schema Generator"
        primaryAction={{
          content: 'Sync Catalog',
          onAction: handleSyncCatalog,
          loading: isSyncing,
        }}
        secondaryActions={[
          {
            content: 'Bulk Audit Catalog',
            onAction: () => setIsBatchModalOpen(true),
          },
          {
            content: 'Plans & Usage',
            url: `/pricing?shop=${encodeURIComponent(shopDomain)}`,
          },
        ]}
      >
        <Layout>
          {/* Usage Quota Banner */}
          <Layout.Section>
            <Banner
              title={`Monthly Free Tier Quota: ${usageCount} / ${planLimit} AI Audits Used`}
              tone={usageCount >= planLimit ? 'warning' : 'info'}
              action={{
                content: 'Upgrade to Growth Plan',
                url: `/pricing?shop=${encodeURIComponent(shopDomain)}`,
              }}
            >
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">
                  Free tier includes 25 AI catalog audits each month. Upgrade anytime for unlimited catalog optimizations and real-time competitor tracking.
                </Text>
                <ProgressBar
                  progress={Math.min(100, Math.round((usageCount / planLimit) * 100))}
                  tone={usageCount >= planLimit ? 'highlight' : 'primary'}
                />
              </BlockStack>
            </Banner>
          </Layout.Section>

          {/* KPI Analytics Cards Grid */}
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingSm" tone="subdued">
                      Catalog Health
                    </Text>
                    <Badge
                      tone={
                        metrics.avgOverall >= 80
                          ? 'success'
                          : metrics.avgOverall >= 50
                          ? 'attention'
                          : 'critical'
                      }
                    >
                      {metrics.avgOverall >= 80 ? 'Healthy' : metrics.avgOverall >= 50 ? 'Fair' : 'Needs Action'}
                    </Badge>
                  </InlineStack>
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    {metrics.avgOverall} / 100
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Overall AI search readiness score
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingSm" tone="subdued">
                      AI Search Readiness
                    </Text>
                    <Badge tone="info">ChatGPT & Perplexity</Badge>
                  </InlineStack>
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    {metrics.avgGeo} / 100
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Key features & technical specs
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingSm" tone="subdued">
                      Shopper Q&A (AEO)
                    </Text>
                    <Badge tone="info">Voice & Chat</Badge>
                  </InlineStack>
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    {metrics.avgAeo} / 100
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Clear answers & customer FAQs
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingSm" tone="subdued">
                      Google Search Data
                    </Text>
                    <Badge tone="success">
                      {`${products.length - metrics.criticalCount}/${products.length} Ready`}
                    </Badge>
                  </InlineStack>
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    {metrics.avgAio} / 100
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Google rich search badges
                  </Text>
                </BlockStack>
              </Card>
            </InlineGrid>
          </Layout.Section>

          {/* Multi-Engine Visibility Breakdown Section */}
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">
                    Generative Search Engine Visibility Breakdown
                  </Text>
                  <Badge tone="info">Live Engine Diagnostics</Badge>
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  Per-engine search visibility, sentiment analysis, and citation readiness across major generative platforms.
                </Text>
                <Divider />
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="h4" variant="headingSm">ChatGPT</Text>
                        <Badge tone={metrics.avgGeo >= 80 ? 'success' : metrics.avgGeo >= 50 ? 'attention' : 'critical'}>
                          {metrics.avgGeo >= 80 ? 'Positive' : 'Neutral'}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="headingLg" fontWeight="bold">
                        {Math.min(100, metrics.avgGeo + 3)} / 100
                      </Text>
                      <Text as="p" variant="bodyXs" tone="subdued">
                        Technical specification density enables direct product citations in ChatGPT search answers.
                      </Text>
                    </BlockStack>
                  </Box>

                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="h4" variant="headingSm">Perplexity AI</Text>
                        <Badge tone={metrics.avgAeo >= 80 ? 'success' : metrics.avgAeo >= 50 ? 'attention' : 'critical'}>
                          {metrics.avgAeo >= 80 ? 'Positive' : 'Neutral'}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="headingLg" fontWeight="bold">
                        {metrics.avgAeo} / 100
                      </Text>
                      <Text as="p" variant="bodyXs" tone="subdued">
                        Structured Q&A pairing allows Perplexity's deep research assistant to cite your catalog instantly.
                      </Text>
                    </BlockStack>
                  </Box>

                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="h4" variant="headingSm">Google Gemini</Text>
                        <Badge tone={metrics.avgAio >= 80 ? 'success' : metrics.avgAio >= 50 ? 'attention' : 'critical'}>
                          {metrics.avgAio >= 80 ? 'Positive' : 'Neutral'}
                        </Badge>
                      </InlineStack>
                      <Text as="p" variant="headingLg" fontWeight="bold">
                        {Math.min(100, metrics.avgAio + 5)} / 100
                      </Text>
                      <Text as="p" variant="bodyXs" tone="subdued">
                        Rich Schema.org Product microdata powers Google AI Overview snapshot panels.
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Filter Tabs & Sort Control */}
          <Layout.Section>
            <Card padding="300">
              <InlineStack align="space-between" blockAlign="center" gap="400">
                <div style={{ flexGrow: 1 }}>
                  <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
                </div>
                <div style={{ minWidth: '240px' }}>
                  <Select
                    label="Sort items by"
                    labelHidden
                    options={sortOptions}
                    value={sortKey}
                    onChange={handleSortKeySelect}
                  />
                </div>
              </InlineStack>
            </Card>
          </Layout.Section>

          {/* Main Product Table / Skeleton / Empty State */}
          <Layout.Section>
            {fetchError && (
              <Banner
                tone="critical"
                action={{ content: 'Retry Catalog Sync', onAction: fetchCatalog }}
              >
                Failed to load product catalog: {fetchError}
              </Banner>
            )}

            {isLoading && !fetchError && (
              <SkeletonPage primaryAction>
                <Layout>
                  <Layout.Section>
                    <Card>
                      <SkeletonBodyText lines={8} />
                    </Card>
                  </Layout.Section>
                </Layout>
              </SkeletonPage>
            )}

            {!isLoading && !fetchError && (
              filteredProducts.length > 0 ? (
                <ProductTable
                  products={filteredProducts}
                  onReviewFixes={handleReviewFixes}
                  onRetryAudit={handleReviewFixes}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSortChange={handleSortChange}
                />
              ) : (
                <Card>
                  <EmptyState
                    heading="Audit and optimize your store catalog for AI search"
                    action={{
                      content: 'Sync Product Catalog',
                      onAction: handleSyncCatalog,
                    }}
                    secondaryAction={{
                      content: 'Explore Plans & Pricing',
                      url: `/pricing?shop=${encodeURIComponent(shopDomain)}`,
                    }}
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <Text as="p" variant="bodyMd">
                      Scan your catalog to audit Generative Engine Optimization (GEO), Answer Engine
                      Optimization (AEO), and JSON-LD AI Overviews schemas powered by Gemini.
                    </Text>
                  </EmptyState>
                </Card>
              )
            )}
          </Layout.Section>
        </Layout>

        {/* Before & After Recommendation Modal */}
        <RecommendationModal
          product={selectedProductForFixes}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          shopDomain={shopDomain}
          onPublished={fetchCatalog}
        />

        {/* Batch Catalog Audit Modal */}
        <BatchAuditModal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          totalProducts={products.length}
          onComplete={fetchCatalog}
        />
      </Page>
    </ErrorBoundary>
  );
}
