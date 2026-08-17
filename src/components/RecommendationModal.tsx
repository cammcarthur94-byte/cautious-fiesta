'use client';

import React, { useState, useEffect } from 'react';
import {
  Modal,
  BlockStack,
  InlineStack,
  InlineGrid,
  Card,
  Text,
  Badge,
  Box,
  Banner,
  Divider,
  TextField,
  Button,
  Select,
  Collapsible,
} from '@shopify/polaris';
import { ShopifyProductItem, FAQPair } from '@/lib/scoring/types';
import { TonalDescriptions } from '@/lib/gemini-evaluator';
import { ScoreBadge } from './ScoreBadge';

interface RecommendationModalProps {
  product: ShopifyProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  shopDomain?: string;
  onPublished?: () => void;
}

export type ToneKey = 'professional' | 'engaging' | 'concise';

export function RecommendationModal({
  product,
  isOpen,
  onClose,
  shopDomain = 'demo-store.myshopify.com',
  onPublished,
}: RecommendationModalProps) {
  const [selectedTone, setSelectedTone] = useState<ToneKey>('professional');
  const [tonalDescriptions, setTonalDescriptions] = useState<TonalDescriptions>({
    professional: '',
    engaging: '',
    concise: '',
  });

  const [editableDescription, setEditableDescription] = useState('');
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);

  // Editable FAQs & JSON-LD
  const [editedFaqs, setEditedFaqs] = useState<FAQPair[]>([]);
  const [editedJsonLdText, setEditedJsonLdText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Helper to convert HTML string to clean readable text for non-technical users
  const htmlToPlainText = (html: string) => {
    return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  };

  // Initialize state when product opens or changes
  useEffect(() => {
    if (!product) return;

    const audit = product.audit;
    const fix = audit?.generatedFix;

    // Resolve tonal descriptions object
    let tonals: TonalDescriptions = {
      professional: `<p><strong>Experience Premium Quality & Performance with ${product.title}.</strong> Engineered specifically for modern consumers who demand durability, sustainability, and peak functionality.</p>
<h3>Key Features & Specifications</h3>
<ul>
  <li><strong>Precision Engineering:</strong> Manufactured with industrial-grade materials for lifetime endurance.</li>
  <li><strong>Tested & Certified:</strong> Formatted for eco-friendliness, safety, and certified reliability.</li>
</ul>`,
      engaging: `<h2>Transform Your Everyday Experience with ${product.title}</h2>
<p>Discover the perfect blend of innovation and craftsmanship. <strong>${product.title}</strong> by ${product.vendor || 'Store Brand'} is designed to elevate your routine with effortless performance, stunning aesthetics, and unmatched reliability. Experience true quality today.</p>
<h3>Why You'll Love It</h3>
<ul>
  <li><strong>Exceptional Comfort:</strong> Designed around your everyday needs.</li>
  <li><strong>Built to Last:</strong> Premium materials ensure peak performance day after day.</li>
</ul>`,
      concise: `<p><strong>${product.title}</strong> by ${product.vendor || 'Store Brand'} — High-performance design built for durability and everyday reliability.</p>
<ul>
  <li><strong>Build:</strong> Industrial-grade materials</li>
  <li><strong>Performance:</strong> High operational output</li>
  <li><strong>Guarantee:</strong> Backed by manufacturer warranty</li>
</ul>`,
    };

    if (fix?.optimizedDescription) {
      const opt = fix.optimizedDescription as any;
      if (opt && typeof opt === 'object') {
        tonals = {
          professional: opt.professional || tonals.professional,
          engaging: opt.engaging || tonals.engaging,
          concise: opt.concise || tonals.concise,
        };
      } else if (typeof fix.optimizedDescription === 'string') {
        tonals.professional = fix.optimizedDescription;
      }
    }

    const initialFaqs: FAQPair[] = fix?.faqs?.length
      ? fix.faqs
      : [
          {
            question: `What makes ${product.title} unique?`,
            answer: `${product.title} combines high-grade materials with precision engineering, outperforming traditional market alternatives.`,
          },
          {
            question: `Is ${product.title} covered by a warranty?`,
            answer: `Yes, ${product.title} includes a full manufacturer warranty and a 30-day money-back guarantee.`,
          },
        ];

    const initialJsonLd = fix?.jsonLdSchema || {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      description: htmlToPlainText(product.body_html || product.title),
      brand: {
        '@type': 'Brand',
        name: product.vendor || 'Store Brand',
      },
      offers: {
        '@type': 'Offer',
        price: product.price || '49.99',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    };

    setTonalDescriptions(tonals);
    setSelectedTone('professional');
    setEditableDescription(tonals.professional);
    setIsManuallyEdited(false);
    setEditedFaqs(initialFaqs);
    setEditedJsonLdText(JSON.stringify(initialJsonLd, null, 2));
    setJsonError(null);
    setIsEditMode(false);
    setShowAdvancedJson(false);
  }, [product, isOpen]);

  // Sync description when tone selection changes (if not manually edited)
  useEffect(() => {
    if (!isManuallyEdited && tonalDescriptions[selectedTone]) {
      setEditableDescription(tonalDescriptions[selectedTone]);
    }
  }, [selectedTone, tonalDescriptions, isManuallyEdited]);

  if (!product) return null;

  const audit = product.audit;

  // Tone Options for Polaris Select
  const toneOptions = [
    { label: 'Professional (Direct, feature-focused, objective)', value: 'professional' },
    { label: 'Engaging (Story-driven, enthusiastic, sales-focused)', value: 'engaging' },
    { label: 'Concise (Minimalist, bulleted, punchy)', value: 'concise' },
  ];

  const handleToneChange = (value: string) => {
    const newTone = value as ToneKey;
    setSelectedTone(newTone);
    setEditableDescription(tonalDescriptions[newTone] || '');
    setIsManuallyEdited(false);
  };

  // FAQ Handlers
  const handleFaqChange = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...editedFaqs];
    updated[index] = { ...updated[index], [field]: value };
    setEditedFaqs(updated);
  };

  const handleAddFaq = () => {
    setEditedFaqs([...editedFaqs, { question: '', answer: '' }]);
  };

  const handleRemoveFaq = (index: number) => {
    setEditedFaqs(editedFaqs.filter((_, i) => i !== index));
  };

  // Reset to AI Defaults
  const handleResetToAiDefaults = () => {
    const defaultText = tonalDescriptions[selectedTone] || '';
    setEditableDescription(defaultText);
    setIsManuallyEdited(false);
  };

  const handleApproveAndPublish = async () => {
    let finalJsonLdObj = {};
    try {
      finalJsonLdObj = JSON.parse(editedJsonLdText);
      setJsonError(null);
    } catch (e: any) {
      setJsonError('Invalid format in developer settings. Please check JSON syntax.');
      return;
    }

    setIsPublishing(true);
    setPublishError(null);
    setPublishSuccess(false);

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          newDescription: editableDescription,
          previousDescription: product.body_html || '',
          faqs: editedFaqs,
          jsonLdSchema: finalJsonLdObj,
          shopDomain,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPublishSuccess(true);
        if (onPublished) onPublished();
        setTimeout(() => {
          onClose();
          setPublishSuccess(false);
        }, 1500);
      } else {
        setPublishError(data.error || 'Failed to publish changes.');
      }
    } catch (e: any) {
      setPublishError(e.message || 'Network error occurred while publishing.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Product AI Optimization & Tone Selector"
      primaryAction={{
        content: isPublishing ? 'Publishing...' : 'Approve & Publish to Store',
        onAction: handleApproveAndPublish,
        loading: isPublishing,
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: onClose,
        },
      ]}
      size="large"
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Header Product Info & Mode Switch */}
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                {product.title}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Brand: {product.vendor || 'Store Brand'} • Category: {product.product_type || 'General'}
              </Text>
            </BlockStack>

            <InlineStack gap="200" blockAlign="center">
              {audit && (
                <InlineStack gap="100">
                  <ScoreBadge score={audit.overallScore} label="Overall" />
                  <ScoreBadge score={audit.geoBreakdown.score} label="AI Search" />
                  <ScoreBadge score={audit.aeoBreakdown.score} label="FAQs" />
                  <ScoreBadge score={audit.aioBreakdown.score} label="Google Data" />
                </InlineStack>
              )}

              <Button
                variant={isEditMode ? 'primary' : 'secondary'}
                onClick={() => setIsEditMode(!isEditMode)}
              >
                {isEditMode ? 'View Customer Preview' : 'Edit Text'}
              </Button>

              {isManuallyEdited && (
                <Button variant="plain" onClick={handleResetToAiDefaults}>
                  Reset to {selectedTone} AI
                </Button>
              )}
            </InlineStack>
          </InlineStack>

          <Divider />

          {/* Friendly Guidance Banner */}
          <Banner tone="info">
            <Text as="p" variant="bodySm">
              <strong>Multi-Tone Selection:</strong> Select a voice tone below to customize how your product sounds to shoppers and AI search assistants like <strong>ChatGPT</strong> and <strong>Google AI Overviews</strong>.
            </Text>
          </Banner>

          {/* Banners */}
          {publishError && <Banner tone="critical">{publishError}</Banner>}
          {jsonError && <Banner tone="critical">{jsonError}</Banner>}
          {publishSuccess && (
            <Banner tone="success">
              Great news! Your customized product description has been published to your store page.
            </Banner>
          )}

          {/* 2-Column Comparison Layout */}
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {/* Left Column: Current Product Content */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingSm">
                    Current Page Copy
                  </Text>
                  <Badge tone="attention">Original</Badge>
                </InlineStack>

                <Divider />

                <Text as="h4" variant="bodySm" fontWeight="bold">
                  Product Description
                </Text>
                <Box
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <Text as="p" variant="bodySm" breakWord>
                    {htmlToPlainText(product.body_html || '') || 'No product description currently provided.'}
                  </Text>
                </Box>

                <Text as="h4" variant="bodySm" fontWeight="bold">
                  Google Search Readiness
                </Text>
                <Box
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <Text as="p" variant="bodySm" tone="subdued">
                    {product.metafields?.jsonld_schema
                      ? 'Structured data is active'
                      : 'Missing structured data (Will be added automatically)'}
                  </Text>
                </Box>
              </BlockStack>
            </Card>

            {/* Right Column: AI Tonal Selector & Custom Editor */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingSm">
                    AI Recommendation & Tone
                  </Text>
                  <Badge tone={isManuallyEdited ? 'attention' : 'success'}>
                    {isManuallyEdited ? 'Custom Edited' : `${selectedTone.toUpperCase()} Tone`}
                  </Badge>
                </InlineStack>

                <Divider />

                {/* Polaris Tone Selector Dropdown */}
                <Select
                  label="Select Writing Tone"
                  options={toneOptions}
                  value={selectedTone}
                  onChange={handleToneChange}
                  helpText="Switching tones automatically updates the recommended description text."
                />

                {isEditMode ? (
                  /* EDIT MODE */
                  <BlockStack gap="400">
                    <TextField
                      label="Product Page Description"
                      value={editableDescription}
                      onChange={(val) => {
                        setEditableDescription(val);
                        setIsManuallyEdited(true);
                      }}
                      multiline={10}
                      autoComplete="off"
                      helpText="Feel free to edit the text directly. Any changes will be published to your store."
                    />

                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="050">
                          <Text as="h4" variant="bodySm" fontWeight="bold">
                            Shopper Questions & Answers ({editedFaqs.length})
                          </Text>
                        </BlockStack>

                        <Button size="slim" onClick={handleAddFaq}>
                          + Add Question
                        </Button>
                      </InlineStack>

                      {editedFaqs.map((faq, i) => (
                        <Card key={i}>
                          <BlockStack gap="200">
                            <InlineStack align="space-between">
                              <Text as="span" variant="bodySm" fontWeight="bold">
                                Question #{i + 1}
                              </Text>
                              <Button
                                size="slim"
                                tone="critical"
                                variant="plain"
                                onClick={() => handleRemoveFaq(i)}
                              >
                                Remove
                              </Button>
                            </InlineStack>

                            <TextField
                              label="Question"
                              value={faq.question}
                              onChange={(val) => handleFaqChange(i, 'question', val)}
                              autoComplete="off"
                            />
                            <TextField
                              label="Answer"
                              value={faq.answer}
                              onChange={(val) => handleFaqChange(i, 'answer', val)}
                              multiline={2}
                              autoComplete="off"
                            />
                          </BlockStack>
                        </Card>
                      ))}
                    </BlockStack>

                    <Box paddingBlockStart="200">
                      <Button
                        variant="plain"
                        onClick={() => setShowAdvancedJson(!showAdvancedJson)}
                      >
                        {showAdvancedJson ? 'Hide Technical Code' : 'Show Advanced Developer Settings'}
                      </Button>
                      <Collapsible
                        open={showAdvancedJson}
                        id="advanced-json-collapsible"
                        transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
                      >
                        <Box paddingBlockStart="300">
                          <TextField
                            label="Technical JSON-LD Schema (Optional)"
                            value={editedJsonLdText}
                            onChange={(val) => {
                              setEditedJsonLdText(val);
                              setJsonError(null);
                            }}
                            multiline={5}
                            autoComplete="off"
                            helpText="Raw Schema.org microdata JSON."
                          />
                        </Box>
                      </Collapsible>
                    </Box>
                  </BlockStack>
                ) : (
                  /* PREVIEW MODE */
                  <BlockStack gap="300">
                    <Text as="h4" variant="bodySm" fontWeight="bold">
                      Recommended Product Description ({selectedTone})
                    </Text>
                    <Box
                      padding="300"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <div
                        style={{ fontSize: '13px', lineHeight: '1.5' }}
                        dangerouslySetInnerHTML={{ __html: editableDescription }}
                      />
                    </Box>

                    <Text as="h4" variant="bodySm" fontWeight="bold">
                      Customer FAQs ({editedFaqs.length})
                    </Text>
                    <BlockStack gap="200">
                      {editedFaqs.map((faq, i) => (
                        <Box
                          key={i}
                          padding="200"
                          background="bg-surface-secondary"
                          borderRadius="200"
                        >
                          <Text as="p" variant="bodySm" fontWeight="bold">
                            Q: {faq.question}
                          </Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            A: {faq.answer}
                          </Text>
                        </Box>
                      ))}
                    </BlockStack>

                    <Box padding="200" background="bg-surface-success" borderRadius="200">
                      <Text as="p" variant="bodySm">
                        ✓ Google Search & AI Overviews structured data will be automatically attached on publish.
                      </Text>
                    </Box>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
            </InlineGrid>
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  }
