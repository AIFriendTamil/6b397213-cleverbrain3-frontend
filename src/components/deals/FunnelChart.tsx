'use client';

import React from 'react';
import { PipelineFunnelSummary, StageFunnelMetrics } from '../../services/api_client';

export interface FunnelChartProps {
  /** Aggregated pipeline summary metrics */
  summary?: PipelineFunnelSummary | null;
  /** Currently selected stage ID for filtering or highlighting */
  selectedStageId?: string | null;
  /** Callback when a stage row/bar is selected or toggled */
  onStageSelect?: (stageId: string | null) => void;
  /** Alias callback for stage click */
  onStageClick?: (stageId: string) => void;
  /** Indicates whether the funnel data is loading */
  isLoading?: boolean;
  /** Error message to display if fetch failed */
  error?: string | null;
  /** Optional custom CSS class name */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

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
 * Format probability or rate value into percentage string (e.g. 65.0%).
 * Handles both 0-1 scale and 0-100 scale gracefully.
 */
export function formatPercentage(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) {
    return '0%';
  }
  const percentage = val <= 1 && val > 0 ? val * 100 : val;
  return `${percentage.toFixed(1)}%`;
}

/**
 * Format days value into human readable string (e.g. 14.2 days).
 */
export function formatDays(days: number | undefined | null): string {
  if (days === undefined || days === null || isNaN(days)) {
    return '0 days';
  }
  return `${days.toFixed(1)} days`;
}

/**
 * Stage accent color palette following Linen & Logic design system tokens.
 */
const STAGE_ACCENT_COLORS = [
  '#59452b', // Primary Tobacco
  '#735c41', // Primary Container
  '#374a5f', // Tertiary Wool Blue
  '#4f6278', // Tertiary Container
  '#a43b2c', // Secondary Sun-faded Red
  '#80756b', // Outline
];

/**
 * Visual pipeline funnel chart component displaying stage progression,
 * deal count, age, win probability, monetary values, and conversion rates.
 */
export const FunnelChart: React.FC<FunnelChartProps> = ({
  summary,
  selectedStageId,
  onStageSelect,
  onStageClick,
  isLoading = false,
  error = null,
  className = '',
  'data-testid': testId = 'funnel-chart',
}) => {
  const handleStageClick = (stageId: string) => {
    const newSelected = selectedStageId === stageId ? null : stageId;
    if (onStageSelect) {
      onStageSelect(newSelected);
    }
    if (onStageClick) {
      onStageClick(stageId);
    }
  };

  if (isLoading) {
    return (
      <div
        className={`funnel-chart-container ${className}`}
        data-testid={testId}
        style={{
          backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
          borderRadius: 'var(--radius-lg, 0.5rem)',
          padding: 'var(--spacing-gutter, 24px)',
        }}
      >
        <div
          data-testid="funnel-loading"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--color-outline-variant, #d1c4b9)',
              borderTopColor: 'var(--color-primary, #59452b)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span style={{ color: 'var(--color-on-surface-variant, #4e453d)', fontSize: '14px' }}>
            Loading pipeline funnel metrics...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`funnel-chart-container ${className}`}
        data-testid={testId}
        style={{
          backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
          borderRadius: 'var(--radius-lg, 0.5rem)',
          padding: 'var(--spacing-gutter, 24px)',
        }}
      >
        <div
          data-testid="funnel-error"
          style={{
            padding: '16px',
            backgroundColor: 'var(--color-error-container, #ffdad6)',
            color: 'var(--color-on-error-container, #93000a)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            fontSize: '14px',
          }}
        >
          <strong>Error loading funnel metrics:</strong> {error}
        </div>
      </div>
    );
  }

  const stages = summary?.stages ? [...summary.stages].sort((a, b) => a.display_order - b.display_order) : [];
  const hasData = summary && summary.total_deals > 0 && stages.length > 0;

  if (!hasData) {
    return (
      <div
        className={`funnel-chart-container ${className}`}
        data-testid={testId}
        style={{
          backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
          borderRadius: 'var(--radius-lg, 0.5rem)',
          padding: 'var(--spacing-gutter, 24px)',
        }}
      >
        <div
          data-testid="funnel-empty"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-md, 0.375rem)',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
              color: 'var(--color-on-surface, #1b1c19)',
              marginBottom: '8px',
            }}
          >
            No Pipeline Data Available
          </h3>
          <p style={{ color: 'var(--color-on-surface-variant, #4e453d)', fontSize: '14px', margin: 0 }}>
            There are no active deals matching the selected pipeline criteria.
          </p>
        </div>
      </div>
    );
  }

  // Find max stage value for width scaling calculation
  const maxStageValue = Math.max(...stages.map((s) => s.total_monetary_value), 1);

  return (
    <div
      className={`funnel-chart-container ${className}`}
      data-testid={testId}
      style={{
        backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
        border: '1px solid var(--color-outline-variant, #d1c4b9)',
        borderRadius: 'var(--radius-lg, 0.5rem)',
        padding: 'var(--spacing-gutter, 24px)',
        boxShadow: '0 4px 20px rgba(115, 92, 65, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Summary KPI Cards Header */}
      <div
        data-testid="funnel-summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          padding: '16px',
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          border: '1px solid var(--color-surface-container-high, #eae8e3)',
        }}
      >
        <div data-testid="summary-total-value">
          <span
            style={{
              display: 'block',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginBottom: '4px',
            }}
          >
            Total Pipeline Value
          </span>
          <span
            style={{
              fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--color-primary, #59452b)',
            }}
          >
            {formatCurrency(summary.total_pipeline_value)}
          </span>
        </div>

        <div data-testid="summary-weighted-value">
          <span
            style={{
              display: 'block',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginBottom: '4px',
            }}
          >
            Weighted Value
          </span>
          <span
            style={{
              fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            {formatCurrency(summary.total_weighted_value)}
          </span>
        </div>

        <div data-testid="summary-total-deals">
          <span
            style={{
              display: 'block',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginBottom: '4px',
            }}
          >
            Total Deals
          </span>
          <span
            style={{
              fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            {summary.total_deals}
          </span>
        </div>

        <div data-testid="summary-avg-probability">
          <span
            style={{
              display: 'block',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginBottom: '4px',
            }}
          >
            Overall Win Prob
          </span>
          <span
            style={{
              fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            {formatPercentage(summary.overall_average_win_probability)}
          </span>
        </div>

        <div data-testid="summary-avg-age">
          <span
            style={{
              display: 'block',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginBottom: '4px',
            }}
          >
            Overall Avg Age
          </span>
          <span
            style={{
              fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            {formatDays(summary.overall_average_deal_age_days)}
          </span>
        </div>
      </div>

      {/* Header with Title and Optional Clear Filter Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
              fontSize: '20px',
              margin: 0,
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            Pipeline Stage Funnel
          </h2>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '13px',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Click a stage segment to filter or highlight stage details.
          </p>
        </div>
        {selectedStageId && (
          <button
            type="button"
            data-testid="clear-stage-filter"
            onClick={() => onStageSelect && onStageSelect(null)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontFamily: 'var(--font-sans)',
              backgroundColor: 'var(--color-surface-container, #f0eee9)',
              color: 'var(--color-primary, #59452b)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              cursor: 'pointer',
            }}
          >
            Reset Stage Filter
          </button>
        )}
      </div>

      {/* Funnel Stage Rows */}
      <div
        data-testid="funnel-stages"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {stages.map((stage: StageFunnelMetrics, index: number) => {
          const isSelected = selectedStageId === stage.stage_id;
          const accentColor = STAGE_ACCENT_COLORS[index % STAGE_ACCENT_COLORS.length];

          // Calculate visual width percentage for funnel shape:
          // Combines monetary ratio and funnel depth for a tapering visual effect
          const valueRatio = stage.total_monetary_value / maxStageValue;
          const widthPercentage = Math.max(25, Math.min(100, Math.round(valueRatio * 100)));

          return (
            <div
              key={stage.stage_id}
              data-testid={`funnel-stage-item-${stage.stage_id}`}
              data-stage-id={stage.stage_id}
              data-selected={isSelected}
              onClick={() => handleStageClick(stage.stage_id)}
              style={{
                cursor: 'pointer',
                padding: '16px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                backgroundColor: isSelected
                  ? 'var(--color-surface-container, #f0eee9)'
                  : 'var(--color-surface-container-low, #f5f3ee)',
                border: isSelected
                  ? `2px solid ${accentColor}`
                  : '1px solid var(--color-outline-variant, #d1c4b9)',
                transition: 'all 0.2s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {/* Stage Header Info */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: accentColor,
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {stage.display_order}
                  </span>
                  <span
                    data-testid="stage-name"
                    style={{
                      fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
                      fontSize: '16px',
                      fontWeight: 600,
                      color: 'var(--color-on-surface, #1b1c19)',
                    }}
                  >
                    {stage.stage_name}
                  </span>
                  <span
                    data-testid="stage-deals"
                    style={{
                      fontSize: '12px',
                      padding: '2px 8px',
                      backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                      borderRadius: 'var(--radius-full, 9999px)',
                    }}
                  >
                    {stage.deal_count} {stage.deal_count === 1 ? 'deal' : 'deals'}
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    data-testid="stage-monetary"
                    style={{
                      fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
                      fontSize: '16px',
                      fontWeight: 600,
                      color: 'var(--color-primary, #59452b)',
                    }}
                  >
                    {formatCurrency(stage.total_monetary_value)}
                  </span>
                </div>
              </div>

              {/* Visual Funnel Bar */}
              <div
                style={{
                  width: '100%',
                  height: '14px',
                  backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                  borderRadius: 'var(--radius-full, 9999px)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${widthPercentage}%`,
                    height: '100%',
                    backgroundColor: accentColor,
                    borderRadius: 'var(--radius-full, 9999px)',
                    transition: 'width 0.4s ease-out',
                  }}
                />
              </div>

              {/* Metric Indicators Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '8px',
                  paddingTop: '4px',
                  borderTop: '1px solid var(--color-surface-container-high, #eae8e3)',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--color-on-surface-variant, #4e453d)' }}>Weighted: </span>
                  <strong data-testid="stage-weighted" style={{ color: 'var(--color-on-surface, #1b1c19)' }}>
                    {formatCurrency(stage.weighted_monetary_value)}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--color-on-surface-variant, #4e453d)' }}>Avg Age: </span>
                  <strong data-testid="stage-age" style={{ color: 'var(--color-on-surface, #1b1c19)' }}>
                    {formatDays(stage.average_deal_age_days)}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--color-on-surface-variant, #4e453d)' }}>Win Prob: </span>
                  <strong data-testid="stage-probability" style={{ color: 'var(--color-on-surface, #1b1c19)' }}>
                    {formatPercentage(stage.average_win_probability)}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--color-on-surface-variant, #4e453d)' }}>Conversion: </span>
                  <strong data-testid="stage-conversion" style={{ color: 'var(--color-on-surface, #1b1c19)' }}>
                    {formatPercentage(stage.conversion_rate_from_previous)}
                  </strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FunnelChart;
