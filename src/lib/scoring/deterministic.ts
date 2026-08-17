import { AuditIssue, AuditResult, PillarScoreBreakdown, ShopifyProductItem } from './types';

// Helper to strip HTML tags for text analysis
export function stripHtml(html: string = ''): string {
  return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}

// Helper to extract first N words
export function getFirstWords(text: string, count: number = 50): string {
  const words = text.split(/\s+/).filter(Boolean);
  return words.slice(0, count).join(' ');
}

export function runDeterministicAudit(product: ShopifyProductItem): AuditResult {
  const html = product.body_html || '';
  const text = stripHtml(html);
  const issues: AuditIssue[] = [];
  const quickWins: string[] = [];
  const deepFixes: string[] = [];

  // ==========================================
  // 1. AEO EVALUATION (Answer Engine Optimization)
  // ==========================================
  const first50 = getFirstWords(text, 50).toLowerCase();
  let directAnswerScore = 0;
  const directAnswerPatterns = [
    /\b(is a|is an|is the|designed for|engineered to|crafted to|helps you|provides|features|formulated to|built with)\b/i,
    /\b(ideal for|perfect for|solution for|allows you to)\b/i
  ];
  const directMatches = directAnswerPatterns.filter(pattern => pattern.test(first50));
  if (first50.length > 20 && directMatches.length >= 1) {
    directAnswerScore = directMatches.length >= 2 ? 35 : 28;
  } else if (text.length > 50) {
    directAnswerScore = 10;
    issues.push({
      id: 'aeo-no-direct-answer',
      pillar: 'AEO',
      title: 'Missing Direct Answer in First 50 Words',
      description: 'AI answer engines (Perplexity, ChatGPT Search) scan the opening paragraph for immediate product definition and primary value propositions.',
      severity: 'critical',
      scoreDeduction: 20,
      fixType: 'description'
    });
    quickWins.push('Lead with a crisp 1-2 sentence definition of who this product is for and its #1 benefit in the opening 50 words.');
  }

  // Scannability (Lists, Tables, Bold terms)
  let scannabilityScore = 0;
  const hasLists = /<(ul|ol)[^>]*>[\s\S]*?<\/(ul|ol)>/i.test(html);
  const hasTables = /<table[^>]*>[\s\S]*?<\/table>/i.test(html);
  const hasBoldSpans = /<(strong|b)[^>]*>/i.test(html);

  if (hasLists) scannabilityScore += 20;
  if (hasTables) scannabilityScore += 15;
  if (hasBoldSpans) scannabilityScore += 10;

  if (scannabilityScore < 20) {
    issues.push({
      id: 'aeo-poor-scannability',
      pillar: 'AEO',
      title: 'Poor Scannability (No Bullet Points or Tables)',
      description: 'Large walls of text hinder search engine snippet extraction. Structured lists and spec tables allow answer bots to parse attributes easily.',
      severity: 'warning',
      scoreDeduction: 15,
      fixType: 'description'
    });
    quickWins.push('Add an <ul> bulleted list of 4-6 key features or specifications.');
  }

  // FAQ Structure in description or metafield
  let faqScore = 0;
  const hasFaqMetafield = product.metafields?.faq_data && Array.isArray(product.metafields.faq_data) && product.metafields.faq_data.length > 0;
  const hasFaqInHtml = /(faq|frequently asked questions|\?<\/(h2|h3|h4|strong)>|\bQ:|\bA:)/i.test(html);

  if (hasFaqMetafield) {
    faqScore = 30;
  } else if (hasFaqInHtml) {
    faqScore = 20;
  } else {
    faqScore = 0;
    issues.push({
      id: 'aeo-missing-faqs',
      pillar: 'AEO',
      title: 'No Structured Product FAQs Detected',
      description: 'Conversational queries (e.g., "How long does X battery last?") are directly matched against structured FAQ pairs by AI search assistants.',
      severity: 'critical',
      scoreDeduction: 25,
      fixType: 'faq'
    });
    deepFixes.push('Generate 3-5 structured conversational FAQ pairs covering compatibility, usage, and sizing.');
  }

  const aeoTotalScore = Math.min(100, Math.round((directAnswerScore / 35) * 35 + (scannabilityScore / 45) * 35 + (faqScore / 30) * 30));

  const aeoBreakdown: PillarScoreBreakdown = {
    score: aeoTotalScore,
    weight: 0.35,
    subScores: {
      directAnswer: {
        name: 'First 50-Word Direct Answer',
        score: directAnswerScore,
        maxScore: 35,
        notes: directAnswerScore >= 28 ? 'Clear, immediate value proposition identified.' : 'Lacks direct definition in opening copy.'
      },
      scannability: {
        name: 'Visual & Structural Scannability',
        score: Math.min(35, scannabilityScore),
        maxScore: 35,
        notes: hasLists ? 'Contains structured bullet points.' : 'Missing lists/tables.'
      },
      faqPresence: {
        name: 'Conversational Q&A / FAQ Block',
        score: faqScore,
        maxScore: 30,
        notes: hasFaqMetafield ? 'Rich FAQ Metafield active.' : hasFaqInHtml ? 'Inline FAQs detected.' : 'No FAQ structure found.'
      }
    }
  };

  // ==========================================
  // 2. AIO EVALUATION (AI Overview Optimization & Schemas)
  // ==========================================
  let jsonLdScore = 0;
  const schemaObj = product.metafields?.jsonld_schema;
  if (schemaObj && typeof schemaObj === 'object') {
    let schemaPoints = 20; // base for presence
    if (schemaObj['@type'] === 'Product' || schemaObj['@type']?.includes?.('Product')) schemaPoints += 15;
    if (schemaObj.offers) schemaPoints += 10;
    if (schemaObj.aggregateRating || schemaObj.review) schemaPoints += 10;
    if (schemaObj.brand) schemaPoints += 10;
    if (schemaObj.description && schemaObj.description.length > 40) schemaPoints += 10;
    jsonLdScore = Math.min(60, schemaPoints);
  } else {
    issues.push({
      id: 'aio-missing-jsonld',
      pillar: 'AIO',
      title: 'Missing or Incomplete JSON-LD Structured Data',
      description: 'Google AI Overviews rely heavily on Schema.org Product, Organization, and AggregateRating JSON-LD graphs for authoritative inclusion.',
      severity: 'critical',
      scoreDeduction: 30,
      fixType: 'schema'
    });
    quickWins.push('Generate and inject Schema.org JSON-LD Product & FAQPage microdata via Theme App Extension.');
  }

  // Heading Structure Check
  let headingScore = 20;
  const hasH1InBody = /<h1[^>]*>/i.test(html);
  const hasH2 = /<h2[^>]*>/i.test(html);
  const hasH3 = /<h3[^>]*>/i.test(html);
  const hasH4 = /<h4[^>]*>/i.test(html);

  if (hasH1InBody) {
    // In Shopify, the theme typically provides the page H1 from the product title; an H1 in the description causes multiple H1s
    issues.push({
      id: 'aio-multiple-h1',
      pillar: 'AIO',
      title: 'Duplicate H1 Tag in Product Body',
      description: 'Your product description contains an <h1> tag. Shopify themes already output the product title as H1, leading to duplicate top-level headings.',
      severity: 'warning',
      scoreDeduction: 10,
      fixType: 'heading'
    });
    headingScore -= 10;
  }

  if (hasH4 && !hasH3 && !hasH2) {
    issues.push({
      id: 'aio-skipped-heading-hierarchy',
      pillar: 'AIO',
      title: 'Skipped Heading Levels (e.g. H4 without H2/H3)',
      description: 'Semantic hierarchy must follow descending order (H2 -> H3 -> H4) for search scrapers to parse section relationships.',
      severity: 'info',
      scoreDeduction: 5,
      fixType: 'heading'
    });
    headingScore -= 5;
  } else if (hasH2 || hasH3) {
    headingScore += 20;
  }

  const aioTotalScore = Math.min(100, Math.round(jsonLdScore + headingScore));

  const aioBreakdown: PillarScoreBreakdown = {
    score: aioTotalScore,
    weight: 0.25,
    subScores: {
      jsonLdSchema: {
        name: 'JSON-LD Schema Completeness',
        score: jsonLdScore,
        maxScore: 60,
        notes: schemaObj ? 'Schema present with rich attributes.' : 'No JSON-LD schema found in metafields.'
      },
      headingHierarchy: {
        name: 'Semantic Heading Hierarchy',
        score: headingScore,
        maxScore: 40,
        notes: (hasH2 || hasH3) && !hasH1InBody ? 'Clean semantic heading nesting.' : 'Heading structure needs alignment.'
      }
    }
  };

  // ==========================================
  // 3. GEO EVALUATION (Generative Engine Optimization) - Deterministic Heuristics
  // ==========================================
  let specsScore = 0;
  const benchmarkUnits = /\b(\d+(\.\d+)?\s*(mah|w|v|hz|ghz|gb|tb|kg|g|oz|lbs|mm|cm|inch|inches|db|fps|k|hours|hrs|mins|%|rpm|lumens))\b/gi;
  const unitMatches = text.match(benchmarkUnits) || [];
  if (unitMatches.length >= 5) {
    specsScore = 40;
  } else if (unitMatches.length >= 2) {
    specsScore = 25;
  } else {
    specsScore = 10;
    issues.push({
      id: 'geo-low-spec-density',
      pillar: 'GEO',
      title: 'Low Quantitative Specification Density',
      description: 'Generative AI engines favor grounded, verifiable numbers and technical metrics over subjective marketing fluff (e.g., "very fast" vs "3.2 GHz / 65W").',
      severity: 'critical',
      scoreDeduction: 20,
      fixType: 'description'
    });
    deepFixes.push('Replace generic adjectives with concrete technical measurements and verifiable spec parameters.');
  }

  // Brand / Proprietary Claims
  let brandAuthorityScore = 0;
  const brandAuthorityRegex = /\b(patented|proprietary|trademark|certified|iso\s*\d+|fda|ce\s*mark|clinically|tested|oeko-tex|usda|guarantee|warranty)\b/gi;
  const brandMatches = text.match(brandAuthorityRegex) || [];
  if (brandMatches.length >= 2) {
    brandAuthorityScore = 35;
  } else if (brandMatches.length === 1) {
    brandAuthorityScore = 20;
  } else {
    brandAuthorityScore = 5;
    issues.push({
      id: 'geo-low-brand-authority',
      pillar: 'GEO',
      title: 'Missing Authoritative Verification or Certifications',
      description: 'LLMs cross-reference claim authority. Citing specific certifications, materials standards, or testing credentials significantly boosts AI citation probability.',
      severity: 'warning',
      scoreDeduction: 15,
      fixType: 'description'
    });
  }

  // Word count & Information depth
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  let depthScore = 25;
  if (wordCount < 60) {
    depthScore = 5;
    issues.push({
      id: 'geo-thin-content',
      pillar: 'GEO',
      title: 'Thin Product Copy (< 60 words)',
      description: 'Insufficient content depth prevents generative engines from synthesizing complete answers for user prompts.',
      severity: 'critical',
      scoreDeduction: 25,
      fixType: 'description'
    });
    quickWins.push('Expand product description to at least 150-300 words with thorough use-case details.');
  } else if (wordCount < 120) {
    depthScore = 15;
  }

  const geoTotalScore = Math.min(100, Math.round(specsScore + brandAuthorityScore + depthScore));

  const geoBreakdown: PillarScoreBreakdown = {
    score: geoTotalScore,
    weight: 0.40,
    subScores: {
      specDensity: {
        name: 'Technical Benchmark & Spec Density',
        score: specsScore,
        maxScore: 40,
        notes: `${unitMatches.length} verifiable technical measurement(s) detected.`
      },
      brandAuthority: {
        name: 'Authority Claims & Certifications',
        score: brandAuthorityScore,
        maxScore: 35,
        notes: `${brandMatches.length} authority / certification marker(s) found.`
      },
      contentDepth: {
        name: 'Synthesizable Information Depth',
        score: depthScore,
        maxScore: 25,
        notes: `Total words: ${wordCount} words.`
      }
    }
  };

  // ==========================================
  // Overall Weighted Score Computation
  // ==========================================
  const overallScore = Math.round(
    geoTotalScore * geoBreakdown.weight +
    aeoTotalScore * aeoBreakdown.weight +
    aioTotalScore * aioBreakdown.weight
  );

  return {
    productId: product.id,
    overallScore,
    geoBreakdown,
    aeoBreakdown,
    aioBreakdown,
    issues,
    recommendations: {
      quickWins,
      deepFixes,
      geminiSummary: overallScore > 80 
        ? 'Well-optimized for LLM search indexing and conversational retrieval.' 
        : 'Requires structural copy restructuring, FAQ enrichment, and JSON-LD schema injection.'
    },
    auditedAt: new Date().toISOString()
  };
}
