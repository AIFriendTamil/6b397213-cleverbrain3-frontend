'use client';

import React, { useState } from 'react';
import { ArrTrendDataPoint } from '../../services/financialApi';

export interface ArrTrendChartProps {
  /** Array of ARR trend data points from API */
  data?: ArrTrendDataPoint[] | null;
  /** Optional account ID filter label */
  accountId?: string;
  /** Currently selected/highlighted metric period string */
  selectedPeriod?: string | null;
  /** Callback fired when a period bar or row is selected or toggled */
  onPeriodSelect?: (period: string | null) => void;
  /** Alias callback fired when a period is clicked */
  onPeriodClick?: (period: string) => void;
  /** Indicates loading state */
  isLoading?: boolean;
  /** Error message to display if fetch failed */
  error?: string | null;
  /** Callback to trigger manual data refresh */
  onRefresh?: () => void;
  /** Selected period range filter option (e.g. '1Y', '2Y', 'ALL') */
  periodRange?: string;
  /** Callback when user changes period range filter option */
  onPeriodRangeChange?: (range: string) => void;
  /** Target currency code for display (defaults to 'USD') */
  targetCurrency?: string;
  /** Whether to show the growth metrics breakdown table */
  showGrowthMetrics?: boolean;
  /** Custom CSS class name override */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Derived ARR metrics calculations for KPI summaries and trend analysis.
 */
export interface DerivedArrMetrics {
  /** Latest recorded ARR value */
  currentArr: number;
  /** Highest historic ARR value in the data set */
  peakArr: number;
  /** Lowest recorded ARR value in the data set */
  lowestArr: number;
  /** Average ARR value across all data points */
  averageArr: number;
  /** Identifier of the latest recorded period */
  latestPeriod: string | null;
  /** Total ARR growth from first recorded point to latest point */
  totalGrowthAmount: number;
  /** Total ARR growth percentage from first recorded point to latest point */
  totalGrowthPercentage: number;
  /** ARR value of the immediately preceding period */
  priorPeriodArr: number | null;
  /** Period-over-period growth amount (current - prior) */
  periodGrowthAmount: number;
  /** Period-over-period growth rate percentage */
  periodGrowthPercentage: number;
  /** Indicates whether the latest period-over-period growth is non-negative */
  isGrowthPositive: boolean;
  /** Count of historic periods (excluding current/latest) */
  historicCount: number;
  /** Total data points count */
  dataPointsCount: number;
}

/**
 * Format raw monetary amount into currency string (e.g., $1,250,000).
 */
export function formatCurrency(
  amount: number | undefined | null,
  currencyCode: string = 'USD'
): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '$0';
  }
  const symbol = currencyCode === 'EUR' ? '€' : currencyCode === 'GBP' ? '£' : '$';
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(absVal);

  return isNegative ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

/**
 * Format float percentage into clean string (e.g. +12.5%, -3.2%, 0.0%).
 */
export function formatPercentage(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) {
    return '0.0%';
  }
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}%`;
}

/**
 * Format raw metric period string into user-friendly display string.
 * Examples: "2025-Q1" -> "Q1 2025", "2025-01" -> "Jan 2025", "2026" -> "2026".
 */
export function formatPeriodLabel(period: string | undefined | null): string {
  if (!period) {
    return 'N/A';
  }
  // Quarter pattern: "2025-Q1" or "2025Q1"
  const qMatch = period.match(/^(\d{4})[-_]?Q([1-4])$/i);
  if (qMatch) {
    return `Q${qMatch[2]} ${qMatch[1]}`;
  }
  // Month pattern: "2025-01" or "2025-1"
  const mMatch = period.match(/^(\d{4})[-_](0?[1-9]|1[0-2])$/);
  if (mMatch) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const monthIndex = parseInt(mMatch[2], 10) - 1;
    return `${months[monthIndex]} ${mMatch[1]}`;
  }
  return period;
}

/**
 * Helper to parse a metric period into a sortable key.
 */
function parsePeriodSortKey(period: string): string {
  if (!period) return '';
  const qMatch = period.match(/^(\d{4})[-_]?Q([1-4])$/i);
  if (qMatch) {
    return `${qMatch[1]}-Q${qMatch[2]}`;
  }
  const mMatch = period.match(/^(\d{4})[-_](0?[1-9]|1[0-2])$/);
  if (mMatch) {
    const monthPadded = mMatch[2].padStart(2, '0');
    return `${mMatch[1]}-${monthPadded}`;
  }
  return period;
}

/**
 * Sort trend data points chronologically by metric_period or recorded_at.
 */
export function sortTrendDataPoints(
  data: ArrTrendDataPoint[] | null | undefined
): ArrTrendDataPoint[] {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }
  return [...data].sort((a, b) => {
    const keyA = parsePeriodSortKey(a.metric_period || a.recorded_at || '');
    const keyB = parsePeriodSortKey(b.metric_period || b.recorded_at || '');
    if (keyA < keyB) return -1;
    if (keyA > keyB) return 1;
    return 0;
  });
}

/**
 * Calculate derived ARR metrics and growth statistics from trend data.
 */
export function calculateArrMetrics(
  data: ArrTrendDataPoint[] | null | undefined
): DerivedArrMetrics {
  const sorted = sortTrendDataPoints(data);
  const dataPointsCount = sorted.length;

  if (dataPointsCount === 0) {
    return {
      currentArr: 0,
      peakArr: 0,
      lowestArr: 0,
      averageArr: 0,
      latestPeriod: null,
      totalGrowthAmount: 0,
      totalGrowthPercentage: 0,
      priorPeriodArr: null,
      periodGrowthAmount: 0,
      periodGrowthPercentage: 0,
      isGrowthPositive: true,
      historicCount: 0,
      dataPointsCount: 0,
    };
  }

  const latestPoint = sorted[dataPointsCount - 1];
  const currentArr = latestPoint.arr_value ?? 0;
  const latestPeriod = latestPoint.metric_period;

  let peakArr = currentArr;
  let lowestArr = currentArr;
  let sumArr = 0;

  sorted.forEach((pt) => {
    const val = pt.arr_value ?? 0;
    if (val > peakArr) peakArr = val;
    if (val < lowestArr) lowestArr = val;
    sumArr += val;
  });

  const averageArr = dataPointsCount > 0 ? sumArr / dataPointsCount : 0;
  const historicCount = Math.max(0, dataPointsCount - 1);

  const firstPoint = sorted[0];
  const firstArr = firstPoint.arr_value ?? 0;
  const totalGrowthAmount = currentArr - firstArr;
  const totalGrowthPercentage =
    firstArr > 0 ? (totalGrowthAmount / firstArr) * 100 : 0;

  const priorPoint = dataPointsCount > 1 ? sorted[dataPointsCount - 2] : null;
  const priorPeriodArr = priorPoint ? priorPoint.arr_value ?? 0 : null;

  let periodGrowthAmount = 0;
  let periodGrowthPercentage = 0;

  if (priorPeriodArr !== null) {
    periodGrowthAmount = currentArr - priorPeriodArr;
    periodGrowthPercentage =
      priorPeriodArr > 0 ? (periodGrowthAmount / priorPeriodArr) * 100 : 0;
  }

  const isGrowthPositive = periodGrowthAmount >= 0;

  return {
    currentArr,
    peakArr,
    lowestArr,
    averageArr,
    latestPeriod,
    totalGrowthAmount,
    totalGrowthPercentage,
    priorPeriodArr,
    periodGrowthAmount,
    periodGrowthPercentage,
    isGrowthPositive,
    historicCount,
    dataPointsCount,
  };
}

/**
 * Historic and Current Annual Recurring Revenue (ARR) Trends Chart Component.
 * Visualizes current and historic ARR data points with interactive period selection,
 * peak analysis, period-over-period growth callouts, and multi-range filters.
 */
export const ArrTrendChart: React.FC<ArrTrendChartProps> = ({
  data,
  accountId,
  selectedPeriod: externalSelectedPeriod,
  onPeriodSelect,
  onPeriodClick,
  isLoading = false,
  error = null,
  onRefresh,
  periodRange = 'ALL',
  onPeriodRangeChange,
  targetCurrency = 'USD',
  showGrowthMetrics = true,
  className = '',
  'data-testid': testId = 'arr-trend-chart',
}) => {
  const [internalSelectedPeriod, setInternalSelectedPeriod] = useState<string | null>(null);
  const [internalRange, setInternalRange] = useState<string>(periodRange);

  const currentSelectedPeriod =
    externalSelectedPeriod !== undefined ? externalSelectedPeriod : internalSelectedPeriod;
  const activeRange = onPeriodRangeChange ? periodRange : internalRange;

  const handlePeriodClick = (period: string) => {
    const nextSelected = currentSelectedPeriod === period ? null : period;
    if (externalSelectedPeriod === undefined) {
      setInternalSelectedPeriod(nextSelected);
    }
    if (onPeriodSelect) {
      onPeriodSelect(nextSelected);
    }
    if (onPeriodClick) {
      onPeriodClick(period);
    }
  };

  const handleRangeClick = (range: string) => {
    if (onPeriodRangeChange) {
      onPeriodRangeChange(range);
    } else {
      setInternalRange(range);
    }
  };

  // Filter data based on period range if applicable
  const sortedData = sortTrendDataPoints(data);
  let filteredData = sortedData;
  if (activeRange === '1Y' && sortedData.length > 4) {
    filteredData = sortedData.slice(-4);
  } else if (activeRange === '2Y' && sortedData.length > 8) {
    filteredData = sortedData.slice(-8);
  }

  const metrics = calculateArrMetrics(filteredData);
  const maxArr = Math.max(...filteredData.map((d) => d.arr_value ?? 0), 100);

  // Selected period data point
  const selectedPoint = filteredData.find((d) => d.metric_period === currentSelectedPeriod);

  // Loading State
  if (isLoading) {
    return (
      <div
        className={`arr-trend-chart-container loading ${className}`}
        style={{
          padding: '24px',
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
        }}
        data-testid={`${testId}-loading`}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ height: '24px', width: '200px', backgroundColor: 'var(--color-surface-container-high, #eae8e3)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: '32px', width: '120px', backgroundColor: 'var(--color-surface-container-high, #eae8e3)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: '80px',
                backgroundColor: 'var(--color-surface-container, #f0eee9)',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                animation: 'pulse 1.5s infinite',
              }}
            />
          ))}
        </div>
        <div
          style={{
            height: '220px',
            backgroundColor: 'var(--color-surface-container, #f0eee9)',
            borderRadius: 'var(--radius-sm, 0.125rem)',
            animation: 'pulse 1.5s infinite',
          }}
        />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div
        className={`arr-trend-chart-container error ${className}`}
        style={{
          padding: '24px',
          backgroundColor: 'var(--color-error-container, #ffdad6)',
          color: 'var(--color-on-error-container, #93000a)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          border: '1px solid var(--color-error, #ba1a1a)',
        }}
        data-testid={`${testId}-error`}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: '500' }}>
            Unable to Load ARR Trends
          </h3>
          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{
                padding: '6px 14px',
                backgroundColor: 'var(--color-error, #ba1a1a)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
              }}
              data-testid={`${testId}-retry-btn`}
            >
              Retry
            </button>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '14px' }}>{error}</p>
      </div>
    );
  }

  // Empty State
  if (!data || filteredData.length === 0) {
    return (
      <div
        className={`arr-trend-chart-container empty ${className}`}
        style={{
          padding: '32px 24px',
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          border: '1px dashed var(--color-outline-variant, #d1c4b9)',
          textAlign: 'center',
        }}
        data-testid={`${testId}-empty`}
      >
        <h3
          style={{
            margin: '0 0 8px 0',
            fontFamily: 'var(--font-serif)',
            fontSize: '20px',
            color: 'var(--color-primary, #59452b)',
          }}
        >
          No ARR Trend Data Available
        </h3>
        <p style={{ margin: '0 0 16px 0', color: 'var(--color-on-surface-variant, #4e453d)', fontSize: '14px' }}>
          {accountId
            ? `No recorded annual recurring revenue metrics found for Account: ${accountId}.`
            : 'No annual recurring revenue trend metrics recorded for the selected criteria.'}
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--color-primary, #59452b)',
              color: 'var(--color-on-primary, #ffffff)',
              border: 'none',
              borderRadius: 'var(--radius-default, 0.25rem)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
            data-testid={`${testId}-empty-refresh-btn`}
          >
            Refresh Metrics
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`arr-trend-chart-container ${className}`}
      style={{
        padding: '24px',
        backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
        borderRadius: 'var(--radius-md, 0.375rem)',
        border: '1px solid var(--color-outline-variant, #d1c4b9)',
        boxShadow: '0 2px 8px rgba(115, 92, 65, 0.06)',
      }}
      data-testid={testId}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
          paddingBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
                fontSize: '22px',
                color: 'var(--color-primary, #59452b)',
                fontWeight: '400',
              }}
              data-testid={`${testId}-title`}
            >
              ARR Trends & Historic Revenue
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '600',
                textTransform: 'uppercase',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                backgroundColor: 'var(--color-surface-container, #f0eee9)',
                color: 'var(--color-primary, #59452b)',
                letterSpacing: '0.05em',
              }}
              data-testid={`${testId}-currency-tag`}
            >
              {targetCurrency}
            </span>
          </div>
          {accountId && (
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
              data-testid={`${testId}-account-id`}
            >
              Account Context: <strong>{accountId}</strong>
            </p>
          )}
        </div>

        {/* Range Controls & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              padding: '2px',
              borderRadius: 'var(--radius-default, 0.25rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
            data-testid={`${testId}-range-selector`}
          >
            {['1Y', '2Y', 'ALL'].map((r) => (
              <button
                key={r}
                onClick={() => handleRangeClick(r)}
                style={{
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  border: 'none',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                  cursor: 'pointer',
                  backgroundColor:
                    activeRange === r
                      ? 'var(--color-primary, #59452b)'
                      : 'transparent',
                  color:
                    activeRange === r
                      ? 'var(--color-on-primary, #ffffff)'
                      : 'var(--color-on-surface-variant, #4e453d)',
                  transition: 'all 0.15s ease',
                }}
                data-testid={`${testId}-range-${r}`}
              >
                {r === '1Y' ? 'Last 1 Yr' : r === '2Y' ? 'Last 2 Yrs' : 'All Time'}
              </button>
            ))}
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--color-primary, #59452b)',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-default, 0.25rem)',
                cursor: 'pointer',
              }}
              data-testid={`${testId}-refresh-btn`}
              title="Refresh ARR trend metrics"
            >
              ↻ Refresh
            </button>
          )}
        </div>
      </div>

      {/* Metric Summary Cards Grid */}
      <div
        className="metric-grid metric-grid-responsive"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Current ARR */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-default, 0.25rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
          data-testid={`${testId}-kpi-current`}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Current ARR
          </span>
          <div
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
              fontSize: '24px',
              fontWeight: '500',
              color: 'var(--color-primary, #59452b)',
              margin: '4px 0 2px 0',
            }}
            data-testid={`${testId}-current-val`}
          >
            {formatCurrency(metrics.currentArr, targetCurrency)}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            Period: <strong>{formatPeriodLabel(metrics.latestPeriod)}</strong>
          </span>
        </div>

        {/* Peak Historic ARR */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-default, 0.25rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
          data-testid={`${testId}-kpi-peak`}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Historic Peak ARR
          </span>
          <div
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
              fontSize: '24px',
              fontWeight: '500',
              color: 'var(--color-tertiary, #374a5f)',
              margin: '4px 0 2px 0',
            }}
            data-testid={`${testId}-peak-val`}
          >
            {formatCurrency(metrics.peakArr, targetCurrency)}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            Highest recorded ARR
          </span>
        </div>

        {/* Period Growth */}
        <div
          style={{
            padding: '16px',
            backgroundColor: metrics.isGrowthPositive
              ? 'var(--color-trend-up-bg, #e8f5e9)'
              : 'var(--color-trend-down-bg, #fdf0ed)',
            borderRadius: 'var(--radius-default, 0.25rem)',
            border: `1px solid ${
              metrics.isGrowthPositive
                ? 'var(--color-trend-up, #2e6b38)'
                : 'var(--color-trend-down, #a43b2c)'
            }`,
          }}
          data-testid={`${testId}-kpi-growth`}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: metrics.isGrowthPositive
                ? 'var(--color-trend-up, #2e6b38)'
                : 'var(--color-trend-down, #a43b2c)',
            }}
          >
            Latest Period Growth
          </span>
          <div
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
              fontSize: '24px',
              fontWeight: '500',
              color: metrics.isGrowthPositive
                ? 'var(--color-trend-up, #2e6b38)'
                : 'var(--color-trend-down, #a43b2c)',
              margin: '4px 0 2px 0',
            }}
            data-testid={`${testId}-growth-val`}
          >
            {formatCurrency(metrics.periodGrowthAmount, targetCurrency)}
          </div>
          <span
            style={{
              fontSize: '12px',
              fontWeight: '500',
              color: metrics.isGrowthPositive
                ? 'var(--color-trend-up, #2e6b38)'
                : 'var(--color-trend-down, #a43b2c)',
            }}
            data-testid={`${testId}-growth-pct`}
          >
            {metrics.priorPeriodArr !== null
              ? `${formatPercentage(metrics.periodGrowthPercentage)} vs prior period`
              : 'Initial baseline period'}
          </span>
        </div>

        {/* Average ARR */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-default, 0.25rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
          data-testid={`${testId}-kpi-average`}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Average ARR
          </span>
          <div
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
              fontSize: '24px',
              fontWeight: '500',
              color: 'var(--color-primary-container, #735c41)',
              margin: '4px 0 2px 0',
            }}
            data-testid={`${testId}-average-val`}
          >
            {formatCurrency(metrics.averageArr, targetCurrency)}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            Across {metrics.dataPointsCount} recorded period{metrics.dataPointsCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Main Visual Column Chart Section */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          padding: '20px',
          borderRadius: 'var(--radius-default, 0.25rem)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
          marginBottom: '24px',
        }}
        data-testid={`${testId}-visualization`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
              fontSize: '16px',
              color: 'var(--color-primary, #59452b)',
              fontWeight: '500',
            }}
          >
            ARR Trajectory ({filteredData.length} Periods)
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            Click a period column to inspect historic details
          </span>
        </div>

        {/* Visual Columns Area */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '12px',
            height: '200px',
            paddingTop: '28px',
            paddingBottom: '24px',
            borderBottom: '1px solid var(--color-outline, #80756b)',
            overflowX: 'auto',
          }}
          data-testid={`${testId}-columns`}
        >
          {filteredData.map((point, index) => {
            const isCurrent = index === filteredData.length - 1;
            const isSelected = currentSelectedPeriod === point.metric_period;
            const heightPct = maxArr > 0 ? Math.max(10, Math.min(100, ((point.arr_value ?? 0) / maxArr) * 100)) : 10;

            const barColor = isSelected
              ? 'var(--color-secondary, #a43b2c)'
              : isCurrent
              ? 'var(--color-primary, #59452b)'
              : 'var(--color-primary-container, #735c41)';

            return (
              <div
                key={point.id || point.metric_period || index}
                onClick={() => handlePeriodClick(point.metric_period)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePeriodClick(point.metric_period);
                  }
                }}
                aria-label={`${isCurrent ? 'Current' : 'Historic'} period ${formatPeriodLabel(
                  point.metric_period
                )} ARR: ${formatCurrency(point.arr_value, targetCurrency)}`}
                style={{
                  flex: 1,
                  minWidth: '48px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  height: '100%',
                  justifyContent: 'flex-end',
                }}
                data-testid={`${testId}-bar-${point.metric_period}`}
              >
                {/* Value Label above Bar */}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: isSelected
                      ? 'var(--color-secondary, #a43b2c)'
                      : 'var(--color-on-surface, #1b1c19)',
                    marginBottom: '4px',
                    whiteSpace: 'nowrap',
                  }}
                  data-testid={`${testId}-bar-value-${point.metric_period}`}
                >
                  {formatCurrency(point.arr_value, targetCurrency)}
                </span>

                {/* Column Bar Visual */}
                <div
                  style={{
                    width: '100%',
                    maxWidth: '40px',
                    height: `${heightPct}%`,
                    backgroundColor: barColor,
                    borderRadius: 'var(--radius-sm, 0.125rem) var(--radius-sm, 0.125rem) 0 0',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected
                      ? '0 0 0 2px var(--color-secondary, #a43b2c)'
                      : isCurrent
                      ? '0 2px 6px rgba(89, 69, 43, 0.3)'
                      : 'none',
                    position: 'relative',
                  }}
                >
                  {/* Current / Peak Tag */}
                  {isCurrent && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-18px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '9px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        backgroundColor: 'var(--color-primary, #59452b)',
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                      }}
                      data-testid={`${testId}-tag-current`}
                    >
                      Current
                    </span>
                  )}
                </div>

                {/* Period Label under Bar */}
                <span
                  style={{
                    marginTop: '8px',
                    fontSize: '11px',
                    fontWeight: isSelected || isCurrent ? '600' : '400',
                    color: isSelected
                      ? 'var(--color-secondary, #a43b2c)'
                      : isCurrent
                      ? 'var(--color-primary, #59452b)'
                      : 'var(--color-on-surface-variant, #4e453d)',
                    whiteSpace: 'nowrap',
                  }}
                  data-testid={`${testId}-bar-label-${point.metric_period}`}
                >
                  {formatPeriodLabel(point.metric_period)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Period Detail Callout */}
      {selectedPoint && (
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--color-surface-container, #f0eee9)',
            borderRadius: 'var(--radius-default, 0.25rem)',
            borderLeft: '4px solid var(--color-secondary, #a43b2c)',
            marginBottom: '24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
          data-testid={`${testId}-selected-detail`}
        >
          <div>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: '600', color: 'var(--color-secondary, #a43b2c)' }}>
              Selected Period Details
            </span>
            <h4
              style={{
                margin: '2px 0 0 0',
                fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
                fontSize: '18px',
                color: 'var(--color-primary, #59452b)',
              }}
              data-testid={`${testId}-selected-period-name`}
            >
              {formatPeriodLabel(selectedPoint.metric_period)}
            </h4>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>ARR Value</span>
              <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--color-primary, #59452b)' }} data-testid={`${testId}-selected-arr-val`}>
                {formatCurrency(selectedPoint.arr_value, targetCurrency)}
              </div>
            </div>

            {selectedPoint.original_currency && selectedPoint.original_currency !== targetCurrency && (
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>Original Currency</span>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>
                  {selectedPoint.original_currency}
                </div>
              </div>
            )}

            <div>
              <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>Recorded Date</span>
              <div style={{ fontWeight: '500', fontSize: '14px' }}>
                {selectedPoint.recorded_at
                  ? new Date(selectedPoint.recorded_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trend Breakdown Data Table */}
      {showGrowthMetrics && (
        <div style={{ marginTop: '16px' }}>
          <h3
            style={{
              margin: '0 0 12px 0',
              fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
              fontSize: '16px',
              color: 'var(--color-primary, #59452b)',
              fontWeight: '500',
            }}
          >
            Historical ARR Trend Breakdown
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
                textAlign: 'left',
              }}
              data-testid={`${testId}-table`}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                    borderBottom: '2px solid var(--color-outline-variant, #d1c4b9)',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                  }}
                >
                  <th style={{ padding: '10px 12px', fontWeight: '600' }}>Period</th>
                  <th style={{ padding: '10px 12px', fontWeight: '600' }}>ARR Value</th>
                  <th style={{ padding: '10px 12px', fontWeight: '600' }}>PoP Change ($)</th>
                  <th style={{ padding: '10px 12px', fontWeight: '600' }}>PoP Change (%)</th>
                  <th style={{ padding: '10px 12px', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '10px 12px', fontWeight: '600' }}>Recorded At</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((pt, idx) => {
                  const isCurrent = idx === filteredData.length - 1;
                  const isSelected = currentSelectedPeriod === pt.metric_period;
                  const priorPt = idx > 0 ? filteredData[idx - 1] : null;

                  let changeAmt = 0;
                  let changePct = 0;
                  if (priorPt) {
                    changeAmt = (pt.arr_value ?? 0) - (priorPt.arr_value ?? 0);
                    changePct =
                      (priorPt.arr_value ?? 0) > 0
                        ? (changeAmt / (priorPt.arr_value ?? 0)) * 100
                        : 0;
                  }

                  const isPositive = changeAmt >= 0;

                  return (
                    <tr
                      key={pt.id || pt.metric_period || idx}
                      onClick={() => handlePeriodClick(pt.metric_period)}
                      style={{
                        borderBottom: '1px solid var(--color-surface-container-high, #eae8e3)',
                        backgroundColor: isSelected
                          ? 'var(--color-surface-container, #f0eee9)'
                          : 'transparent',
                        cursor: 'pointer',
                      }}
                      data-testid={`${testId}-row-${pt.metric_period}`}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>
                        {formatPeriodLabel(pt.metric_period)}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: 'var(--color-primary, #59452b)' }}>
                        {formatCurrency(pt.arr_value, targetCurrency)}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          color: priorPt
                            ? isPositive
                              ? 'var(--color-trend-up, #2e6b38)'
                              : 'var(--color-trend-down, #a43b2c)'
                            : 'var(--color-on-surface-variant, #4e453d)',
                          fontWeight: '500',
                        }}
                      >
                        {priorPt ? formatCurrency(changeAmt, targetCurrency) : '—'}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          color: priorPt
                            ? isPositive
                              ? 'var(--color-trend-up, #2e6b38)'
                              : 'var(--color-trend-down, #a43b2c)'
                            : 'var(--color-on-surface-variant, #4e453d)',
                          fontWeight: '500',
                        }}
                      >
                        {priorPt ? formatPercentage(changePct) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm, 0.125rem)',
                            fontSize: '11px',
                            fontWeight: '600',
                            backgroundColor: isCurrent
                              ? 'var(--color-primary-fixed, #fdddbb)'
                              : 'var(--color-surface-container-low, #f5f3ee)',
                            color: isCurrent
                              ? 'var(--color-on-primary-fixed, #281804)'
                              : 'var(--color-on-surface-variant, #4e453d)',
                          }}
                        >
                          {isCurrent ? 'Current' : 'Historic'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                        {pt.recorded_at
                          ? new Date(pt.recorded_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
