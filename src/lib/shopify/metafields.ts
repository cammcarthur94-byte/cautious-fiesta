import { FAQPair } from '../scoring/types';

export const METAFIELD_NAMESPACES = {
  GEO_AEO: 'geo_aeo',
};

export const METAFIELD_KEYS = {
  JSONLD_SCHEMA: 'jsonld_schema',
  FAQ_DATA: 'faq_data',
  REVISION_HISTORY: 'revision_history',
};

export interface MetafieldInput {
  namespace: string;
  key: string;
  value: string;
  type: 'json' | 'single_line_text_field' | 'multi_line_text_field';
}

export function formatMetafieldPayload(
  productId: string,
  jsonLdSchema?: Record<string, any>,
  faqs?: FAQPair[],
  previousDescription?: string
): MetafieldInput[] {
  const metafields: MetafieldInput[] = [];

  if (jsonLdSchema) {
    metafields.push({
      namespace: METAFIELD_NAMESPACES.GEO_AEO,
      key: METAFIELD_KEYS.JSONLD_SCHEMA,
      value: JSON.stringify(jsonLdSchema),
      type: 'json',
    });
  }

  if (faqs && faqs.length > 0) {
    metafields.push({
      namespace: METAFIELD_NAMESPACES.GEO_AEO,
      key: METAFIELD_KEYS.FAQ_DATA,
      value: JSON.stringify(faqs),
      type: 'json',
    });
  }

  if (previousDescription) {
    metafields.push({
      namespace: METAFIELD_NAMESPACES.GEO_AEO,
      key: METAFIELD_KEYS.REVISION_HISTORY,
      value: JSON.stringify({
        backedUpAt: new Date().toISOString(),
        body_html: previousDescription,
      }),
      type: 'json',
    });
  }

  return metafields;
}
