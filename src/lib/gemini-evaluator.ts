import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export interface GeminiEvaluationInput {
  title: string;
  handle: string;
  body_html: string;
  vendor?: string;
  product_type?: string;
  price?: string;
  current_json_ld?: Record<string, any> | null;
}

export interface TonalDescriptions {
  professional: string;
  engaging: string;
  concise: string;
}

export interface EngineMetrics {
  score: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  citation_context: string;
}

export interface EngineBreakdown {
  chatgpt: EngineMetrics;
  perplexity: EngineMetrics;
  gemini: EngineMetrics;
}

export interface GeminiEvaluationOutput {
  scores: {
    geo: number; // Integer 0-100
    aeo: number; // Integer 0-100
    aio: number; // Integer 0-100
    overall: number; // Integer 0-100
  };
  engine_breakdown?: EngineBreakdown;
  breakdown: {
    geo_issues: string[];
    aeo_issues: string[];
    aio_issues: string[];
  };
  recommendations: {
    optimized_description: TonalDescriptions | string;
    structured_faqs: Array<{
      question: string;
      answer: string;
    }>;
    generated_json_ld: Record<string, any>;
  };
}

/**
 * Custom Error for JSON Schema or Parsing Violations
 */
export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaError';
  }
}

/**
 * Custom Error for Transient Gemini API Failures (429, 5xx)
 */
export class TransientGeminiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'TransientGeminiError';
    this.statusCode = statusCode;
  }
}

const SYSTEM_INSTRUCTIONS = `
You are an elite Search Engine, Generative Engine, and Answer Engine Optimization (GEO/AEO/AIO) audit expert.
Your job is to evaluate product catalog content from Shopify stores and generate automated fixes.

Auditing Criteria:
1. Generative Engine Optimization (GEO):
   - Check if product descriptions contain explicit, lab-verified claims, ISO certifications, material specifications, or unique data points.
   - Deduct points if claims are generic marketing puffery without technical specifications.

2. Answer Engine Optimization (AEO):
   - Check if the product's primary value proposition and use case are stated clearly in the FIRST 50 WORDS.
   - Check if the description includes structured, high-intent Question/Answer pairings (FAQs).

3. AI Overview Optimization (AIO):
   - Evaluate semantic HTML structure (H2, H3 headings, bolded technical parameters, structured lists).
   - Check if valid Product & FAQPage JSON-LD schema is present.

Multi-Engine Breakdown Requirement:
In the "engine_breakdown" field, evaluate search visibility and citation context for three generative search engines:
- chatgpt: Score (0-100), sentiment ("positive", "neutral", "negative"), citation_context
- perplexity: Score (0-100), sentiment ("positive", "neutral", "negative"), citation_context
- gemini: Score (0-100), sentiment ("positive", "neutral", "negative"), citation_context

Tonal Variations Requirement:
For the "optimized_description" field, you MUST generate THREE distinct tonal variations:
1. professional: Direct, feature-focused, and objective HTML description.
2. engaging: Story-driven, enthusiastic, and customer-centric HTML description.
3. concise: Minimalist, highly scannable, and punchy HTML description.

You MUST respond strictly with valid JSON conforming to the requested schema.
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Evaluate product data using Gemini 2.5 Pro with Resilient Error Handling & Backoff
 */
export async function evaluateProductWithGemini(
  product: GeminiEvaluationInput,
  maxRetries: number = 3
): Promise<GeminiEvaluationOutput> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key' || apiKey === '') {
    return generateAlgorithmicFallback(product);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    systemInstruction: SYSTEM_INSTRUCTIONS,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          scores: {
            type: SchemaType.OBJECT,
            properties: {
              geo: { type: SchemaType.INTEGER, description: 'Score 0-100 for Generative Engine Indexing' },
              aeo: { type: SchemaType.INTEGER, description: 'Score 0-100 for Conversational Answer Engine' },
              aio: { type: SchemaType.INTEGER, description: 'Score 0-100 for AI Overviews Schema Completeness' },
              overall: { type: SchemaType.INTEGER, description: 'Average score of geo, aeo, and aio' },
            },
            required: ['geo', 'aeo', 'aio', 'overall'],
          },
          engine_breakdown: {
            type: SchemaType.OBJECT,
            properties: {
              chatgpt: {
                type: SchemaType.OBJECT,
                properties: {
                  score: { type: SchemaType.INTEGER },
                  sentiment: { type: SchemaType.STRING },
                  citation_context: { type: SchemaType.STRING },
                },
                required: ['score', 'sentiment', 'citation_context'],
              },
              perplexity: {
                type: SchemaType.OBJECT,
                properties: {
                  score: { type: SchemaType.INTEGER },
                  sentiment: { type: SchemaType.STRING },
                  citation_context: { type: SchemaType.STRING },
                },
                required: ['score', 'sentiment', 'citation_context'],
              },
              gemini: {
                type: SchemaType.OBJECT,
                properties: {
                  score: { type: SchemaType.INTEGER },
                  sentiment: { type: SchemaType.STRING },
                  citation_context: { type: SchemaType.STRING },
                },
                required: ['score', 'sentiment', 'citation_context'],
              },
            },
            required: ['chatgpt', 'perplexity', 'gemini'],
          },
          breakdown: {
            type: SchemaType.OBJECT,
            properties: {
              geo_issues: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              aeo_issues: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              aio_issues: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            },
            required: ['geo_issues', 'aeo_issues', 'aio_issues'],
          },
          recommendations: {
            type: SchemaType.OBJECT,
            properties: {
              optimized_description: {
                type: SchemaType.OBJECT,
                properties: {
                  professional: { type: SchemaType.STRING, description: 'Direct, feature-focused, and objective HTML description' },
                  engaging: { type: SchemaType.STRING, description: 'Story-driven, enthusiastic, and customer-centric HTML description' },
                  concise: { type: SchemaType.STRING, description: 'Minimalist, highly scannable, and punchy HTML description' },
                },
                required: ['professional', 'engaging', 'concise'],
              },
              structured_faqs: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    question: { type: SchemaType.STRING },
                    answer: { type: SchemaType.STRING },
                  },
                  required: ['question', 'answer'],
                },
              },
              generated_json_ld: {
                type: SchemaType.OBJECT,
                properties: {
                  '@context': { type: SchemaType.STRING },
                  '@type': { type: SchemaType.STRING },
                  name: { type: SchemaType.STRING },
                  description: { type: SchemaType.STRING },
                },
              },
            },
            required: ['optimized_description', 'structured_faqs', 'generated_json_ld'],
          },
        },
        required: ['scores', 'engine_breakdown', 'breakdown', 'recommendations'],
      },
    },
  });

  const prompt = `
Evaluate this product for GEO, AEO, AIO search readiness and multi-engine visibility (ChatGPT, Perplexity, Gemini) and return structured JSON:

PRODUCT TITLE: ${product.title}
PRODUCT HANDLE: ${product.handle}
VENDOR/BRAND: ${product.vendor || 'Unknown Brand'}
CATEGORY: ${product.product_type || 'General'}
PRICE: ${product.price || 'N/A'}

CURRENT BODY HTML:
${product.body_html || '(No description provided)'}

CURRENT JSON-LD SCHEMA:
${product.current_json_ld ? JSON.stringify(product.current_json_ld, null, 2) : 'None / Missing'}
`;

  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();

      let parsed: GeminiEvaluationOutput;
      try {
        parsed = JSON.parse(rawText) as GeminiEvaluationOutput;
      } catch (parseErr: any) {
        throw new SchemaError(`MALFORMED_FUNCTION_CALL: Failed to parse Gemini response as JSON: ${parseErr.message}`);
      }

      if (
        !parsed.scores ||
        typeof parsed.scores.geo !== 'number' ||
        typeof parsed.scores.aeo !== 'number' ||
        typeof parsed.scores.aio !== 'number' ||
        !parsed.breakdown ||
        !parsed.recommendations
      ) {
        throw new SchemaError('MALFORMED_FUNCTION_CALL: Gemini output violated required JSON output schema.');
      }

      if (!parsed.scores.overall) {
        parsed.scores.overall = Math.round((parsed.scores.geo + parsed.scores.aeo + parsed.scores.aio) / 3);
      }

      return parsed;
    } catch (error: any) {
      const status = error.status || error.statusCode || error.response?.status;
      if (status === 400 || status === 403 || error instanceof SchemaError) {
        console.error(`[Gemini API Client Error ${status || 'SCHEMA_FAIL'}] Non-retryable error:`, error.message);
        return generateAlgorithmicFallback(product);
      }

      attempt++;
      if (attempt <= maxRetries) {
        const baseMs = Math.pow(2, attempt) * 1000;
        const jitterMs = Math.floor(Math.random() * 1000);
        const backoffMs = Math.min(60000, baseMs + jitterMs);

        console.warn(
          `[Gemini API Transient Error ${status || 500}] Retrying attempt ${attempt}/${maxRetries} after ${backoffMs}ms...`
        );

        await sleep(backoffMs);
        continue;
      }

      console.error(`[Gemini API Max Retries Reached] Falling back to algorithmic generator.`);
      return generateAlgorithmicFallback(product);
    }
  }

  return generateAlgorithmicFallback(product);
}

/**
 * Algorithmic Fallback Generator for Offline / Error Cases
 */
export function generateAlgorithmicFallback(
  product: GeminiEvaluationInput
): GeminiEvaluationOutput {
  const plainText = (product.body_html || '').replace(/<[^>]*>?/gm, '').trim();
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const brand = product.vendor || 'Store Brand';
  const title = product.title;

  const geoIssues: string[] = [];
  const aeoIssues: string[] = [];
  const aioIssues: string[] = [];

  let geoScore = 85;
  let aeoScore = 80;
  let aioScore = 75;

  if (wordCount < 60) {
    geoIssues.push('Short product description (<60 words) limits generative AI citation density.');
    geoScore -= 25;
  }
  if (!plainText.includes('warranty') && !plainText.includes('guarantee') && !plainText.includes('certified')) {
    geoIssues.push('Missing explicit trust signals (e.g. warranty details, ISO certifications, or material testing).');
    geoScore -= 15;
  }

  if (wordCount < 40) {
    aeoIssues.push('Primary value proposition is not clearly established in the opening 50 words.');
    aeoScore -= 30;
  }
  if (!product.body_html?.toLowerCase().includes('faq') && !product.body_html?.includes('?')) {
    aeoIssues.push('No structured Question & Answer (FAQ) sections detected for conversational search queries.');
    aeoScore -= 20;
  }

  if (!/<h[2-4][^>]*>/i.test(product.body_html || '')) {
    aioIssues.push('Missing semantic HTML heading hierarchy (H2/H3 tags) for AI Overview parsing.');
    aioScore -= 20;
  }
  if (!/<ul[^>]*>|<ol[^>]*>/i.test(product.body_html || '')) {
    aioIssues.push('Missing structured bullet points (ul/li) for technical parameter extraction.');
    aioScore -= 15;
  }
  if (!product.current_json_ld) {
    aioIssues.push('Missing rich Schema.org Product & FAQPage JSON-LD markup.');
    aioScore -= 25;
  }

  geoScore = Math.max(20, Math.min(100, geoScore));
  aeoScore = Math.max(20, Math.min(100, aeoScore));
  aioScore = Math.max(20, Math.min(100, aioScore));
  const overallScore = Math.round((geoScore + aeoScore + aioScore) / 3);

  const engine_breakdown: EngineBreakdown = {
    chatgpt: {
      score: Math.min(100, geoScore + 5),
      sentiment: geoScore >= 70 ? 'positive' : 'neutral',
      citation_context: 'Product feature list and quantitative parameters enable direct ChatGPT recommendation rendering.',
    },
    perplexity: {
      score: Math.min(100, aeoScore),
      sentiment: aeoScore >= 70 ? 'positive' : 'neutral',
      citation_context: 'Question & Answer structures support rapid Perplexity deep-research citations.',
    },
    gemini: {
      score: Math.min(100, aioScore + 5),
      sentiment: aioScore >= 70 ? 'positive' : 'neutral',
      citation_context: 'Schema.org Product microdata allows Google AI Overview rich panel inclusion.',
    },
  };

  const faqs = [
    {
      question: `What makes the ${title} unique?`,
      answer: `The ${title} by ${brand} combines precision engineering with lab-tested durability, outperforming standard market alternatives.`,
    },
    {
      question: `Does the ${title} come with a warranty?`,
      answer: `Yes, each ${title} includes a full manufacturer warranty and a 30-day satisfaction guarantee.`,
    },
    {
      question: `How quickly will my order ship?`,
      answer: `Orders placed before 2 PM EST ship same-day with standard delivery arriving in 2-4 business days.`,
    },
  ];

  const professional = `
<h2>Engineered for High-Performance Reliability</h2>
<p>The <strong>${title}</strong> by ${brand} delivers industry-leading reliability, precision operation, and seamless daily integration. Designed specifically for demanding users requiring certified durability and verified performance metrics.</p>

<h3>Key Features & Specifications</h3>
<ul>
  <li><strong>Precision Craftsmanship:</strong> Crafted with high-grade industrial composite materials.</li>
  <li><strong>Tested & Certified:</strong> Complies with international safety standards and quality controls.</li>
  <li><strong>High Efficiency:</strong> Optimized for low thermal loss and maximum endurance.</li>
</ul>`.trim();

  const engaging = `
<h2>Transform Your Everyday Experience with ${title}</h2>
<p>Discover the perfect blend of innovation and craftsmanship. The <strong>${title}</strong> by ${brand} is designed to elevate your routine with effortless performance, stunning aesthetics, and unmatched reliability. Whether you are at home or on the move, experience what true quality feels like.</p>

<h3>Why You'll Love It</h3>
<ul>
  <li><strong>Exceptional Comfort & Ease:</strong> Designed around your everyday needs.</li>
  <li><strong>Built to Last:</strong> Quality materials mean you can enjoy peak performance day after day.</li>
  <li><strong>Peace of Mind:</strong> Backed by dedicated customer support and satisfaction guarantee.</li>
</ul>`.trim();

  const concise = `
<p><strong>${title}</strong> by ${brand} — Professional performance in a compact, durable design.</p>
<ul>
  <li><strong>Build:</strong> High-grade durable materials</li>
  <li><strong>Efficiency:</strong> Lab-tested high output</li>
  <li><strong>Guarantee:</strong> Backed by manufacturer warranty</li>
</ul>`.trim();

  const generated_json_ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description: plainText || title,
    brand: {
      '@type': 'Brand',
      name: brand,
    },
    offers: {
      '@type': 'Offer',
      price: product.price ? product.price.replace(/[^0-9.]/g, '') : '49.99',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    mainEntity: {
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer,
        },
      })),
    },
  };

  return {
    scores: {
      geo: geoScore,
      aeo: aeoScore,
      aio: aioScore,
      overall: overallScore,
    },
    engine_breakdown,
    breakdown: {
      geo_issues: geoIssues.length > 0 ? geoIssues : ['No critical GEO failures detected.'],
      aeo_issues: aeoIssues.length > 0 ? aeoIssues : ['No critical AEO failures detected.'],
      aio_issues: aioIssues.length > 0 ? aioIssues : ['No critical AIO failures detected.'],
    },
    recommendations: {
      optimized_description: {
        professional,
        engaging,
        concise,
      },
      structured_faqs: faqs,
      generated_json_ld,
    },
  };
}
