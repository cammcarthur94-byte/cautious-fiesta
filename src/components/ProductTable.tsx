'use client';

import React from 'react';
import {
  IndexTable,
  Card,
  Thumbnail,
  Badge,
  Button,
  Text,
  useIndexResourceState,
} from '@shopify/polaris';
import { ScoreBadge } from './ScoreBadge';
import { ShopifyProductItem } from '@/lib/scoring/types';

interface ProductTableProps {
  products: ShopifyProductItem[];
  onReviewFixes: (product: ShopifyProductItem) => void;
}

export function ProductTable({ products, onReviewFixes }: ProductTableProps) {
  const resourceName = {
    singular: 'product',
    plural: 'products',
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(products as any);

  const rowMarkup = products.map((product, index) => {
    const audit = product.audit;
    const overall = audit?.overallScore || 0;
    const geo = audit?.geoBreakdown.score || 0;
    const aeo = audit?.aeoBreakdown.score || 0;
    const aio = audit?.aioBreakdown.score || 0;

    let statusTone: 'success' | 'attention' | 'critical' = 'attention';
    let statusLabel = 'Needs Audit';
    if (overall >= 80) {
      statusTone = 'success';
      statusLabel = 'Optimized';
    } else if (overall >= 50) {
      statusTone = 'attention';
      statusLabel = 'Pending Review';
    } else {
      statusTone = 'critical';
      statusLabel = 'Needs Audit';
    }

    return (
      <IndexTable.Row
        id={product.id}
        key={product.id}
        selected={selectedResources.includes(product.id)}
        position={index}
      >
        <IndexTable.Cell>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Thumbnail
              source={product.image_url || 'https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png'}
              alt={product.title}
              size="small"
            />
            <div>
              <Text as="span" variant="bodyMd" fontWeight="bold">
                {product.title}
              </Text>
              <div style={{ fontSize: '12px', color: '#616161', marginTop: '2px' }}>
                {product.vendor || 'Store Brand'} • {product.product_type || 'General'}
              </div>
            </div>
          </div>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <ScoreBadge score={geo} />
        </IndexTable.Cell>

        <IndexTable.Cell>
          <ScoreBadge score={aeo} />
        </IndexTable.Cell>

        <IndexTable.Cell>
          <ScoreBadge score={aio} />
        </IndexTable.Cell>

        <IndexTable.Cell>
          <ScoreBadge score={overall} label="Overall" />
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Button size="slim" onClick={() => onReviewFixes(product)}>
            Review Fixes
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Card padding="0">
      <IndexTable
        resourceName={resourceName}
        itemCount={products.length}
        selectedItemsCount={
          allResourcesSelected ? 'All' : selectedResources.length
        }
        onSelectionChange={handleSelectionChange}
        headings={[
          { title: 'Product Catalog' },
          { title: 'Status' },
          { title: 'GEO Score' },
          { title: 'AEO Score' },
          { title: 'AIO Score' },
          { title: 'Overall Score' },
          { title: 'Action' },
        ]}
        selectable={false}
      >
        {rowMarkup}
      </IndexTable>
    </Card>
  );
}
