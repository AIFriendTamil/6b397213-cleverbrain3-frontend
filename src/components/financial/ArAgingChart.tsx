'use client';

import React, { useState } from 'react';
import { ArAgingResponse, ArAgingBucketSummary } from '../../services/financialApi';

/**
 * Valid key identifiers for AR aging buckets.
 */
export type AgingBucketKey = 'current' | 'bucket_30' | 'bucket_60' | 'bucket_90_plus';

export interface ArAgingChartProps {
  /** AR aging bucket summary data from API */
  data?: ArAgingResponse | ArAgingBucketSummary | null;
  /** Optional account ID filter label */
  accountId?: string;
  /** Currently selected/highlighted bucket key */
  selectedBucket?: AgingBucketKey | null;
  /** Callback fired when a bucket is selected or toggled */
  onBucketSelect?: (bucketKey: AgingBucketKey | null) => void;
  /** Callback fired when a bucket card or segment is clicked */
  onBucketClick?: (bucketKey: AgingBucketKey) => void;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Error message to display if fetch failed */
  error?: string | null;
  /** Callback fired to trigger a manual data refresh */
  onRefresh?: () => void;
  /** Whether to render the value format ($ vs %) toggle control */
  showPercentageToggle?: boolean;
  /** Custom CSS class name override */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Visual and risk configuration for an AR aging bucket.
 */
export interface BucketConfig {
  key: AgingBucketKey;
  label: string;
  shortLabel: string;
  dayRange: string;
  description: string;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  badgeColor: string;
  recommendation: string;
}

/**
 * Configuration metadata for each AR aging bucket adhering to the Linen & Logic design system.
 */
export const BUCKET_CONFIGS: Record<AgingBucketKey, BucketConfig> = {
  current: {
    key: 'current',
    label: 'Current (0–30 Days)',
    shortLabel: 'Current',
    dayRange: '0–30 Days',
    description: 'Not yet overdue / invoices within standard payment terms',
    riskLevel: 'Low',
    color: 'var(--color-primary, #59452b)',
    bgColor: 'var(--color-surface-container-low, #f5f3ee)',
    borderColor: 'var(--color-outline-variant, #d1c4b9)',
    badgeBg: 'var(--color-trend-up-bg, #e8f5e9)',
    badgeColor: 'var(--color-trend-up, #2e6b38)',
    recommendation: 'Standard invoicing workflow. Send polite upcoming due statement.',
  },
  bucket_30: {
    key: 'bucket_30',
    label: '1–30 Days Overdue',
    shortLabel: '1–30 Days',
    dayRange: '31–60 Days Issue / 1–30 Past Due',
    description: 'Slightly overdue / standard grace period elapsed',
    riskLevel: 'Moderate',
    color: 'var(--color-tertiary, #374a5f)',
    bgColor: 'var(--color-surface-container, #f0eee9)',
    borderColor: 'var(--color-tertiary-container, #4f6278)',
    badgeBg: 'var(--color-tertiary-container, #4f6278)',
    badgeColor: 'var(--color-on-tertiary-container, #caddf8)',
    recommendation: 'Dispatch automated first overdue email reminder.',
  },
  bucket_60: {
    key: 'bucket_60',
    label: '31–60 Days Overdue',
    shortLabel: '31–60 Days',
    dayRange: '61–90 Days Issue / 31–60 Past Due',
    description: 'Moderately overdue / elevated collection risk',
    riskLevel: 'High',
    color: 'var(--color-secondary, #a43b2c)',
    bgColor: 'var(--color-trend-down-bg, #fdf0ed)',
    borderColor: 'var(--color-secondary-container, #fd7d69)',
    badgeBg: 'var(--color-secondary-fixed, #ffdad4)',
    badgeColor: 'var(--color-on-secondary-fixed-variant, #842417)',
    recommendation: 'Direct phone follow-up and hold new credit approvals.',
  },
  bucket_90_plus: {
    key: 'bucket_90_plus',
    label: '90+ Days Overdue',
    shortLabel: '90+ Days',
    dayRange: '90+ Days Past Due',
    description: 'Severely overdue / critical default & write-off risk',
    riskLevel: 'Critical',
    color: 'var(--color-error, #ba1a1a)',
    bgColor: 'var(--color-error-container, #ffdad6)',
    borderColor: 'var(--color-error, #ba1a1a)',
    badgeBg: 'var(--color-error-container, #ffdad6)',
    badgeColor: 'var(--color-on-error-container, #93000a)',
    recommendation: 'Escalate to finance management / formal legal collection warning.',
  },
};

/**
 * Format raw monetary amount into currency string ($1,250,000).
 */
export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '$0';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format float percentage into clean string (e.g. 42.5%).
 */
export function formatPercentage(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) {
    return '0.0%';
  }
  return `${val.toFixed(1)}%`;
}

/**
 * Format ISO string into user-friendly localized date string.
 */
export function formatAsOfDate(timestamp: string | undefined | null): string {
  if (!timestamp) {
    return 'As of current date';
  }
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) {
      return timestamp;
    }
    return `As of ${d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    return timestamp;
  }
}

/**
 * Derived metrics object containing total outstanding, bucket amounts, and percentages.
 */
export interface DerivedAgingMetrics {
  totalOutstanding: number;
  totalOverdue: number;
  overduePercentage: number;
  buckets: Record<
    AgingBucketKey,
    {
      amount: number;
      percentage: number;
    }
  >;
}

/**
 * Compute derived aging metrics (totals and relative percentages) from AR aging response data.
 */
export function calculateBucketMetrics(
  data: ArAgingResponse | ArAgingBucketSummary | null | undefined
): DerivedAgingMetrics {
  const current = data?.current_balance ?? 0;
  const b30 = data?.bucket_30_balance ?? 0;
  const b60 = data?.bucket_60_balance ?? 0;
  const b90 = data?.bucket_90_plus_balance ?? 0;

  const sumBuckets = current + b30 + b60 + b90;
  const totalOutstanding = data?.total_outstanding && data.total_outstanding > 0 ? data.total_outstanding : sumBuckets;
  const totalOverdue = b30 + b60 + b90;
  const overduePercentage = totalOutstanding > 0 ? (totalOverdue / totalOutstanding) * 100 : 0;

  const calcPct = (amt: number) => (totalOutstanding > 0 ? (amt / totalOutstanding) * 100 : 0);

  return {
    totalOutstanding,
    totalOverdue,
    overduePercentage,
    buckets: {
      current: { amount: current, percentage: calcPct(current) },
      bucket_30: { amount: b30, percentage: calcPct(b30) },
      bucket_60: { amount: b60, percentage: calcPct(b60) },
      bucket_90_plus: { amount: b90, percentage: calcPct(b90) },
    },
  };
}

/**
 * Interactive AR Aging Buckets Visualization Chart Component.
 * Displays accounts receivable breakdown across Current, 30, 60, and 90+ days overdue buckets.
 * Adheres strictly to the Linen & Logic design system tokens and NFR-1 sub-2s rendering requirements.
 */
export const ArAgingChart: React.FC<ArAgingChartProps> = ({
  data,
  accountId,
  selectedBucket: externalSelectedBucket,
  onBucketSelect,
  onBucketClick,
  isLoading = false,
  error = null,
  onRefresh,
  showPercentageToggle = true,
  className = '',
  'data-testid': testId = 'ar-aging-chart',
}) => {
  const [internalSelectedBucket, setInternalSelectedBucket] = useState<AgingBucketKey | null>(null);
  const [viewMode, setViewMode] = useState<'amount' | 'percentage'>('amount');

  // Unified selected bucket state (external prop override or internal state)
  const activeSelectedBucket = externalSelectedBucket !== undefined ? externalSelectedBucket : internalSelectedBucket;

  const metrics = calculateBucketMetrics(data);

  const handleBucketClick = (bucketKey: AgingBucketKey) => {
    const nextSelected = activeSelectedBucket === bucketKey ? null : bucketKey;
    if (externalSelectedBucket === undefined) {
      setInternalSelectedBucket(nextSelected);
    }
    if (onBucketSelect) {
      onBucketSelect(nextSelected);
    }
    if (onBucketClick) {
      onBucketClick(bucketKey);
    }
  };

  const handleClearSelection = () => {
    if (externalSelectedBucket === undefined) {
      setInternalSelectedBucket(null);
    }
    if (onBucketSelect) {
      onBucketSelect(null);
    }
  };

  // Loading skeleton rendering
  if (isLoading) {
    return (
      <div
        className={`ar-aging-chart-container ar-aging-loading ${className}`}
        data-testid={`${testId}-loading`}
        style={{
          backgroundColor: 'var(--color-surface, #fbf9f4)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
          borderRadius: 'var(--radius-lg, 0.5rem)',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div
              style={{
                width: '220px',
                height: '24px',
                backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                borderRadius: '4px',
                marginBottom: '8px',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <div
              style={{
                width: '140px',
                height: '16px',
                backgroundColor: 'var(--color-surface-container, #f0eee9)',
                borderRadius: '4px',
                animation: 'pulse 1.5s infinite',
              }}
            />
          </div>
          <div
            style={{
              width: '120px',
              height: '36px',
              backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
              borderRadius: '4px',
              animation: 'pulse 1.5s infinite',
            }}
          />
        </div>

        {/* Skeleton cards grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginTop: '20px',
          }}
        >
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              style={{
                height: '120px',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                padding: '16px',
                animation: 'pulse 1.5s infinite',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state rendering
  if (error) {
    return (
      <div
        className={`ar-aging-chart-container ar-aging-error ${className}`}
        data-testid={`${testId}-error`}
        style={{
          backgroundColor: 'var(--color-error-container, #ffdad6)',
          border: '1px solid var(--color-error, #ba1a1a)',
          borderRadius: 'var(--radius-lg, 0.5rem)',
          padding: '24px',
          color: 'var(--color-on-error-container, #93000a)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px', fontWeight: 'bold' }}>⚠️</span>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
              fontSize: '18px',
            }}
          >
            Failed to Load AR Aging Data
          </h3>
        </div>
        <p style={{ margin: '8px 0 16px 0', fontSize: '14px' }}>{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            type="button"
            data-testid={`${testId}-retry-btn`}
            style={{
              backgroundColor: 'var(--color-primary, #59452b)',
              color: 'var(--color-on-primary, #ffffff)',
              border: 'none',
              borderRadius: 'var(--radius-default, 0.25rem)',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Retry Loading
          </button>
        )}
      </div>
    );
  }

  const bucketKeys: AgingBucketKey[] = ['current', 'bucket_30', 'bucket_60', 'bucket_90_plus'];
  const hasZeroBalance = metrics.totalOutstanding === 0;

  return (
    <div
      className={`ar-aging-chart-container ${className}`}
      data-testid={testId}
      style={{
        backgroundColor: 'var(--color-surface, #fbf9f4)',
        border: '1px solid var(--color-outline-variant, #d1c4b9)',
        borderRadius: 'var(--radius-lg, 0.5rem)',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(115, 92, 65, 0.05)',
      }}
    >
      {/* Header section: Title, timestamp, metrics summary & controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
                fontSize: '22px',
                fontWeight: 400,
                color: 'var(--color-on-surface, #1b1c19)',
              }}
            >
              AR Aging Buckets
            </h2>
            {accountId && (
              <span
                style={{
                  fontSize: '12px',
                  backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                  fontFamily: 'var(--font-sans, DM Sans, sans-serif)',
                }}
              >
                Account: {accountId}
              </span>
            )}
          </div>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '13px',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            {formatAsOfDate(data?.as_of_timestamp)}
          </p>
        </div>

        {/* Right header controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {showPercentageToggle && (
            <div
              style={{
                display: 'inline-flex',
                backgroundColor: 'var(--color-surface-container, #f0eee9)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                padding: '2px',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('amount')}
                data-testid={`${testId}-view-amount-btn`}
                style={{
                  border: 'none',
                  backgroundColor:
                    viewMode === 'amount' ? 'var(--color-surface-container-lowest, #ffffff)' : 'transparent',
                  color: viewMode === 'amount' ? 'var(--color-primary, #59452b)' : 'var(--color-on-surface-variant, #4e453d)',
                  fontWeight: viewMode === 'amount' ? 600 : 400,
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'amount' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                Val ($)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('percentage')}
                data-testid={`${testId}-view-pct-btn`}
                style={{
                  border: 'none',
                  backgroundColor:
                    viewMode === 'percentage' ? 'var(--color-surface-container-lowest, #ffffff)' : 'transparent',
                  color: viewMode === 'percentage' ? 'var(--color-primary, #59452b)' : 'var(--color-on-surface-variant, #4e453d)',
                  fontWeight: viewMode === 'percentage' ? 600 : 400,
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'percentage' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                Share (%)
              </button>
            </div>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              data-testid={`${testId}-refresh-btn`}
              aria-label="Refresh AR aging data"
              title="Refresh AR aging data"
              style={{
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                color: 'var(--color-on-surface, #1b1c19)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                padding: '6px 12px',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>↻</span> Refresh
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Strip: Total Outstanding, Overdue Balance & Overdue Ratio */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          margin: '20px 0',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            padding: '16px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            borderLeft: '4px solid var(--color-primary, #59452b)',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Total Outstanding
          </span>
          <div
            data-testid={`${testId}-total-outstanding`}
            style={{
              fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
              fontSize: '24px',
              fontWeight: 500,
              color: 'var(--color-on-surface, #1b1c19)',
              marginTop: '4px',
            }}
          >
            {formatCurrency(metrics.totalOutstanding)}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            padding: '16px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            borderLeft: '4px solid var(--color-secondary, #a43b2c)',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Total Overdue (30+ Days)
          </span>
          <div
            data-testid={`${testId}-total-overdue`}
            style={{
              fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
              fontSize: '24px',
              fontWeight: 500,
              color: metrics.totalOverdue > 0 ? 'var(--color-secondary, #a43b2c)' : 'var(--color-on-surface, #1b1c19)',
              marginTop: '4px',
            }}
          >
            {formatCurrency(metrics.totalOverdue)}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            padding: '16px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            borderLeft: '4px solid var(--color-tertiary, #374a5f)',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Overdue Balance Share
          </span>
          <div
            data-testid={`${testId}-overdue-ratio`}
            style={{
              fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
              fontSize: '24px',
              fontWeight: 500,
              color: 'var(--color-on-surface, #1b1c19)',
              marginTop: '4px',
            }}
          >
            {formatPercentage(metrics.overduePercentage)}
          </div>
        </div>
      </div>

      {/* Visual Stacked Proportion Bar */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--color-on-surface-variant, #4e453d)',
            marginBottom: '6px',
            fontWeight: 500,
          }}
        >
          <span>Aging Composition Breakdown</span>
          {activeSelectedBucket && (
            <button
              onClick={handleClearSelection}
              type="button"
              data-testid={`${testId}-clear-selection-btn`}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-secondary, #a43b2c)',
                cursor: 'pointer',
                padding: 0,
                fontSize: '12px',
                textDecoration: 'underline',
              }}
            >
              Clear filter ({BUCKET_CONFIGS[activeSelectedBucket].shortLabel})
            </button>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            height: '24px',
            width: '100%',
            backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
          }}
          data-testid={`${testId}-stacked-bar`}
        >
          {hasZeroBalance ? (
            <div
              style={{
                width: '100%',
                backgroundColor: 'var(--color-surface-container, #f0eee9)',
                color: 'var(--color-on-surface-variant, #4e453d)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
              }}
            >
              $0.00 Outstanding Balance
            </div>
          ) : (
            bucketKeys.map((key) => {
              const cfg = BUCKET_CONFIGS[key];
              const pct = metrics.buckets[key].percentage;
              const isSelected = activeSelectedBucket === key;
              const isOtherSelected = activeSelectedBucket !== null && !isSelected;

              if (pct <= 0) return null;

              return (
                <div
                  key={key}
                  onClick={() => handleBucketClick(key)}
                  data-testid={`${testId}-stacked-segment-${key}`}
                  title={`${cfg.label}: ${formatCurrency(metrics.buckets[key].amount)} (${formatPercentage(pct)})`}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: cfg.color,
                    opacity: isOtherSelected ? 0.35 : 1,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    borderRight: '1px solid rgba(255,255,255,0.3)',
                    transform: isSelected ? 'scaleY(1.15)' : 'scaleY(1)',
                    zIndex: isSelected ? 2 : 1,
                  }}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Interactive Bucket Cards Grid (4 buckets) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
        data-testid={`${testId}-grid`}
      >
        {bucketKeys.map((key) => {
          const cfg = BUCKET_CONFIGS[key];
          const bData = metrics.buckets[key];
          const isSelected = activeSelectedBucket === key;

          return (
            <div
              key={key}
              onClick={() => handleBucketClick(key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleBucketClick(key);
                }
              }}
              role="button"
              tabIndex={0}
              data-testid={`${testId}-card-${key}`}
              aria-label={`${cfg.label}: ${formatCurrency(bData.amount)}`}
              style={{
                backgroundColor: isSelected ? cfg.bgColor : 'var(--color-surface-container-lowest, #ffffff)',
                border: isSelected
                  ? `2px solid ${cfg.color}`
                  : '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                boxShadow: isSelected ? '0 4px 12px rgba(115, 92, 65, 0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                transform: isSelected ? 'translateY(-2px)' : 'none',
              }}
            >
              {/* Card top row: Label & Risk Badge */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '10px',
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--color-on-surface, #1b1c19)',
                      fontFamily: 'var(--font-sans, DM Sans, sans-serif)',
                    }}
                  >
                    {cfg.shortLabel}
                  </h3>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                    }}
                  >
                    {cfg.dayRange}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: cfg.badgeBg,
                    color: cfg.badgeColor,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full, 9999px)',
                  }}
                >
                  {cfg.riskLevel}
                </span>
              </div>

              {/* Main value display ($ or %) */}
              <div
                data-testid={`${testId}-card-value-${key}`}
                style={{
                  fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
                  fontSize: '22px',
                  fontWeight: 500,
                  color: bData.amount > 0 ? cfg.color : 'var(--color-on-surface-variant, #4e453d)',
                  margin: '8px 0 4px 0',
                }}
              >
                {viewMode === 'amount' ? formatCurrency(bData.amount) : formatPercentage(bData.percentage)}
              </div>

              {/* Secondary view mode label */}
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginBottom: '12px',
                }}
              >
                {viewMode === 'amount'
                  ? `${formatPercentage(bData.percentage)} of total`
                  : `${formatCurrency(bData.amount)} balance`}
              </div>

              {/* Relative fill bar indicator */}
              <div
                style={{
                  height: '4px',
                  width: '100%',
                  backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(bData.percentage, 100)}%`,
                    backgroundColor: cfg.color,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Bucket Details Panel when a bucket is selected */}
      {activeSelectedBucket && (
        <div
          data-testid={`${testId}-bucket-detail-panel`}
          style={{
            marginTop: '20px',
            padding: '16px 20px',
            backgroundColor: BUCKET_CONFIGS[activeSelectedBucket].bgColor,
            border: `1px solid ${BUCKET_CONFIGS[activeSelectedBucket].borderColor}`,
            borderRadius: 'var(--radius-md, 0.375rem)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 600,
                color: BUCKET_CONFIGS[activeSelectedBucket].color,
                fontFamily: 'var(--font-sans, DM Sans, sans-serif)',
              }}
            >
              Bucket Overview: {BUCKET_CONFIGS[activeSelectedBucket].label}
            </h4>
            <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
              Risk Level: <strong>{BUCKET_CONFIGS[activeSelectedBucket].riskLevel}</strong>
            </span>
          </div>

          <p style={{ margin: '8px 0 12px 0', fontSize: '13px', color: 'var(--color-on-surface, #1b1c19)' }}>
            {BUCKET_CONFIGS[activeSelectedBucket].description}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', fontSize: '13px', marginBottom: '12px' }}>
            <div>
              <span style={{ color: 'var(--color-on-surface-variant, #4e453d)' }}>Balance: </span>
              <strong>{formatCurrency(metrics.buckets[activeSelectedBucket].amount)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-on-surface-variant, #4e453d)' }}>Share of Total AR: </span>
              <strong>{formatPercentage(metrics.buckets[activeSelectedBucket].percentage)}</strong>
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              fontSize: '12px',
              borderLeft: `3px solid ${BUCKET_CONFIGS[activeSelectedBucket].color}`,
            }}
          >
            <strong>Recommended Collection Action:</strong> {BUCKET_CONFIGS[activeSelectedBucket].recommendation}
          </div>
        </div>
      )}

      {/* Empty State warning if total AR balance is $0 */}
      {hasZeroBalance && (
        <div
          data-testid={`${testId}-empty-state`}
          style={{
            marginTop: '20px',
            textAlign: 'center',
            padding: '24px',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px dashed var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            No outstanding accounts receivable balances currently exist.
          </p>
        </div>
      )}
    </div>
  );
};

export default ArAgingChart;
