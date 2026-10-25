'use client';

import React from 'react';

export interface TrendIndicatorProps {
  /** Direction of the trend: 'up', 'down', or 'flat' */
  direction?: 'up' | 'down' | 'flat' | string;
  /** Percentage change value against baseline */
  percentage?: number;
  /** Alias property for direction matching KPIData structure */
  trend_direction?: 'up' | 'down' | 'flat' | string;
  /** Alias property for percentage matching KPIData structure */
  trend_percentage?: number;
  /** Optional baseline label text, e.g. 'vs prior period' or 'vs baseline' */
  baselineLabel?: string;
  /** Optional unit suffix for percentage (default '%') */
  unit?: string;
  /** Optional custom CSS class name */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * TrendIndicator component for rendering directional arrows and percentage change values vs baseline.
 * Conforms to Linen & Logic design system tokens and accessibility rules.
 */
export function TrendIndicator({
  direction,
  percentage,
  trend_direction,
  trend_percentage,
  baselineLabel = 'vs baseline',
  unit = '%',
  className = '',
  'data-testid': customTestId,
}: TrendIndicatorProps) {
  // Resolve normalized direction ('up', 'down', or 'flat')
  const rawDirection = (direction ?? trend_direction ?? 'flat').toLowerCase();
  const normalizedDirection: 'up' | 'down' | 'flat' =
    rawDirection === 'up' ? 'up' : rawDirection === 'down' ? 'down' : 'flat';

  // Resolve numerical percentage value
  const rawPercentage = percentage ?? trend_percentage ?? 0;
  const numericValue = typeof rawPercentage === 'number' && !isNaN(rawPercentage) ? rawPercentage : 0;

  // Format display text
  const absValue = Math.abs(numericValue);
  const formattedNumber = Number.isInteger(absValue) ? absValue.toString() : absValue.toFixed(1);

  let formattedValue = `${formattedNumber}${unit}`;
  if (normalizedDirection === 'up') {
    formattedValue = `+${formattedValue}`;
  } else if (normalizedDirection === 'down') {
    formattedValue = `-${formattedValue}`;
  }

  // Define visual styling and accessible labels per direction
  let colorStyle = 'var(--color-trend-flat, #4e453d)';
  let bgStyle = 'var(--color-trend-flat-bg, #f0eee9)';
  let ariaLabel = `Flat trend: ${formattedValue} ${baselineLabel}`.trim();

  if (normalizedDirection === 'up') {
    colorStyle = 'var(--color-trend-up, #2e6b38)';
    bgStyle = 'var(--color-trend-up-bg, #e8f5e9)';
    ariaLabel = `Upward trend: ${formattedValue} ${baselineLabel}`.trim();
  } else if (normalizedDirection === 'down') {
    colorStyle = 'var(--color-trend-down, #a43b2c)';
    bgStyle = 'var(--color-trend-down-bg, #fdf0ed)';
    ariaLabel = `Downward trend: ${formattedValue} ${baselineLabel}`.trim();
  }

  const containerTestId = customTestId || 'trend-indicator';

  return (
    <span
      data-testid={containerTestId}
      aria-label={ariaLabel}
      role="status"
      className={`trend-indicator trend-indicator-${normalizedDirection} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.125rem 0.375rem',
        borderRadius: 'var(--radius-sm, 0.125rem)',
        fontSize: '0.8125rem',
        fontWeight: 500,
        color: colorStyle,
        backgroundColor: bgStyle,
        lineHeight: 1.2,
      }}
    >
      <span
        data-testid="trend-arrow"
        data-trend-direction={normalizedDirection}
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
        }}
      >
        {normalizedDirection === 'up' && (
          <svg
            data-testid="trend-arrow-up"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 10V2M2 6l4-4 4 4" />
          </svg>
        )}
        {normalizedDirection === 'down' && (
          <svg
            data-testid="trend-arrow-down"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 2v8M2 6l4 4 4-4" />
          </svg>
        )}
        {normalizedDirection === 'flat' && (
          <svg
            data-testid="trend-arrow-flat"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 6h8M6 2l4 4-4 4" />
          </svg>
        )}
      </span>
      <span data-testid="trend-value" style={{ fontFamily: 'var(--font-sans)' }}>
        {formattedValue}
      </span>
      {baselineLabel && (
        <span
          data-testid="trend-baseline"
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-on-surface-variant, #4e453d)',
            fontWeight: 400,
            marginLeft: '0.125rem',
          }}
        >
          {baselineLabel}
        </span>
      )}
    </span>
  );
}

export default TrendIndicator;
