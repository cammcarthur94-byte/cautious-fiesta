export type PillarType = 'GEO' | 'AEO' | 'AIO';

export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface AuditIssue {
  id: string;
  pillar: PillarType;
  title: string;
  description: string;
  severity: IssueSeverity;
  scoreDeduction: number;
  fixType: 'description' | 'faq' | 'schema' | 'heading';
}

export interface PillarScoreBreakdown {
  score: number; // 0 - 100
  weight: number; // e.g. 0.40
  subScores: {
    [key: string]: {
      name: string;
      score: number;
      maxScore: number;
      notes: string;
    };
  };
}

export interface FAQPair {
  question: string;
  answer: string;
}

export interface AuditResult {
  productId: string;
  overallScore: number;
  geoBreakdown: PillarScoreBreakdown;
  aeoBreakdown: PillarScoreBreakdown;
  aioBreakdown: PillarScoreBreakdown;
  issues: AuditIssue[];
  recommendations: {
    quickWins: string[];
    deepFixes: string[];
    geminiSummary?: string;
  };
  generatedFix?: {
    optimizedDescription: any;
    metaDescription?: string;
    imageAltTags?: Array<{ image_index: number; suggested_alt: string }>;
    faqs: FAQPair[];
    jsonLdSchema: Record<string, any>;
    generatedAt: string;
  };
  auditedAt: string;
  isPublished?: boolean;
}

export interface ShopifyProductItem {
  id: string;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  status: 'active' | 'draft' | 'archived';
  image_url?: string;
  price?: string;
  metafields?: {
    jsonld_schema?: any;
    faq_data?: FAQPair[];
    revision_history?: any[];
  };
  audit?: AuditResult;
}

export interface AuditJob {
  id: string;
  shopDomain: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalProducts: number;
  processedProducts: number;
  failedProducts: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
