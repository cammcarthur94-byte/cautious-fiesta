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
} from '@shopify/polaris';
import { ProductTable } from '@/components/ProductTable';
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

  // Tabs filter state (0: All, 1: Needs Audit, 2: Pending Review, 3: Optimized)
  const [selectedTab, setSelectedTab] = useState(0);

  // Modals state
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedProductForFixes, setSelectedProductForFixes] = useState<ShopifyProductItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch product catalog from Supabase / API
  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
      } else {
        setFetchError(data.error || 'Failed to load product catalog');
      }
    } catch (e: any) {
      console.error(e);
      setFetchError(e.message || 'Network error — unable to reach the server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Sync Catalog handler with client-coordinated cursor pagination
  const handleSyncCatalog = async () => {
    setIsSyncing(true);
    try {
      let hasNextPage = true;
      let cursor: string | null = null;

      while (hasNextPage) {
        const syncResponse: Response = await fetch('/api/sync-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopDomain,
            cursor,
            limit: 50,
          }),
        });

        const syncData: any = await syncResponse.json();
        if (!syncData.success) {
          console.error('Catalog Sync Error:', syncData.error);
          break;
        }

        hasNextPage = syncData.hasNextPage ?? false;
        cursor = syncData.endCursor ?? null;
      }

      await fetchCatalog();
    } catch (err) {
      console.error('Error during catalog sync:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Calculate Metrics
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

  // Tabbed Filtering
  const filteredProducts = useMemo(() => {
    if (selectedTab === 1) {
      // Needs Audit (<50)
      return products.filter((p) => (p.audit?.overallScore || 0) < 50);
    }
    if (selectedTab === 2) {
      // Pending Review (50-79)
      return products.filter(
        (p) => (p.audit?.overallScore || 0) >= 50 && (p.audit?.overallScore || 0) < 80
      );
    }
    if (selectedTab === 3) {
      // Optimized (80+)
      return products.filter((p) => (p.audit?.overallScore || 0) >= 80);
    }
    return products;
  }, [products, selectedTab]);

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
              title="Free Plan Optimization Usage"
              tone="info"
              action={{
                content: 'Upgrade Plan',
                url: `/pricing?shop=${encodeURIComponent(shopDomain)}`,
              }}
            >
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  You have used <strong>2 of 5</strong> monthly product optimizations included in your plan.
                </Text>
                <ProgressBar progress={40} size="small" />
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

          {/* Filter Tabs */}
          <Layout.Section>
            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
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

        {/* Batch Audit Modal */}
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
