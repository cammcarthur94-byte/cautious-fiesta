'use client';

import React from 'react';

interface ScoreGaugeProps {
  score: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ScoreGauge({
  score,
  label,
  size = 'md',
  showLabel = true,
}: ScoreGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score || 0));

  // Determine size dimensions
  const dimensions = {
    sm: { radius: 20, stroke: 4, width: 48, fontSize: 'text-xs' },
    md: { radius: 32, stroke: 6, width: 76, fontSize: 'text-sm font-bold' },
    lg: { radius: 46, stroke: 8, width: 110, fontSize: 'text-2xl font-bold' },
  }[size];

  const circumference = 2 * Math.PI * dimensions.radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  // Determine color scheme based on score thresholds
  let strokeColor = '#108043'; // polaris success (>=80)
  let bgColor = '#e3f1df';
  let textColor = 'text-emerald-700';

  if (clampedScore < 50) {
    strokeColor = '#d72c0d'; // polaris critical
    bgColor = '#fde8e4';
    textColor = 'text-red-700';
  } else if (clampedScore < 80) {
    strokeColor = '#b95000'; // polaris warning
    bgColor = '#fff4e5';
    textColor = 'text-amber-700';
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center" style={{ width: dimensions.width, height: dimensions.width }}>
        <svg className="w-full h-full" viewBox={`0 0 ${dimensions.width} ${dimensions.width}`}>
          {/* Background circle */}
          <circle
            cx={dimensions.width / 2}
            cy={dimensions.width / 2}
            r={dimensions.radius}
            stroke={bgColor}
            strokeWidth={dimensions.stroke}
            fill="transparent"
          />
          {/* Animated score circle */}
          <circle
            className="score-circle"
            cx={dimensions.width / 2}
            cy={dimensions.width / 2}
            r={dimensions.radius}
            stroke={strokeColor}
            strokeWidth={dimensions.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <span className={`absolute ${dimensions.fontSize} ${textColor}`}>
          {clampedScore}
        </span>
      </div>
      {showLabel && label && (
        <span className="mt-1 text-xs font-medium text-gray-600 text-center">
          {label}
        </span>
      )}
    </div>
  );
}
