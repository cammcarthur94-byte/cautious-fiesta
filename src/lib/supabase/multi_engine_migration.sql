-- Migration: Add engine_breakdown column for ChatGPT, Perplexity, and Gemini tracking
ALTER TABLE product_scores 
ADD COLUMN IF NOT EXISTS engine_breakdown JSONB DEFAULT '{
  "chatgpt": { "score": 80, "sentiment": "positive", "citation_context": "High spec density and clear benefit statements enable direct ChatGPT citations." },
  "perplexity": { "score": 75, "sentiment": "neutral", "citation_context": "Requires structured FAQ additions for optimal Perplexity answer engine extraction." },
  "gemini": { "score": 85, "sentiment": "positive", "citation_context": "Rich JSON-LD graph enables Google AI Overview indexing." }
}'::jsonb;

ALTER TABLE product_audits 
ADD COLUMN IF NOT EXISTS engine_breakdown JSONB DEFAULT '{
  "chatgpt": { "score": 80, "sentiment": "positive", "citation_context": "High spec density and clear benefit statements enable direct ChatGPT citations." },
  "perplexity": { "score": 75, "sentiment": "neutral", "citation_context": "Requires structured FAQ additions for optimal Perplexity answer engine extraction." },
  "gemini": { "score": 85, "sentiment": "positive", "citation_context": "Rich JSON-LD graph enables Google AI Overview indexing." }
}'::jsonb;

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS score_drop_alerts INTEGER DEFAULT 0;
