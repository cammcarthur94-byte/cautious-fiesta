'use client';

import React from 'react';
import { Badge } from '@shopify/polaris';

interface ScoreBadgeProps {
  score: number;
  label?: string;
  size?: 'small' | 'medium' | 'sm' | 'md' | 'lg';
  pillar?: string;
  showIcon?: boolean;
}

export function ScoreBadge({ score, label }: ScoreBadgeProps) {
  let tone: 'success' | 'attention' | 'critical' = 'success';
  if (score < 50) {
    tone = 'critical';
  } else if (score < 80) {
    tone = 'attention';
  }

  return (
    <Badge tone={tone}>
      {label ? `${label}: ${score}` : String(score)}
    </Badge>
  );
}
