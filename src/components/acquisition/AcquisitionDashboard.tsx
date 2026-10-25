'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AcquisitionSummary,
  SourceROIMetrics,
  AcquisitionFilterParams,
  getAcquisitionSources,
  getAcquisitionSummary,
} from '../../services/api_client';

export interface AcquisitionDashboardProps {
  /** Summary metrics across all sources. If omitted, calculated or fetched from API. */
  summary?: AcquisitionSummary | null;
  /** List of individual lead source ROI metrics. If omitted, fetched from API. */
  sources?: SourceROIMetrics[] | null;
  /** Initial filter parameter overrides */
  initialFilters?: AcquisitionFilterParams;
  /** Callback fired whenever user changes or applies filter parameters */
  onFilterChange?: (filters: AcquisitionFilterParams) => void;
  /** Callback fired when a source row is selected */
  onSourceSelect?: (source: SourceROIMetrics) => void;
  /** Callback fired when a source ID is clicked */
  onSourceClick?: (sourceId: string) => void;
  /** Loading state indicator override */
  isLoading?: boolean;
  /** Error message string override */
  error?: string | null;
  /** Callback fired to trigger a manual data refresh */
  onRefresh?: () => void;
  /** Custom CSS class name */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Format raw monetary amount into currency string ($12,500).
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
 * Format ROI percentage value into string (+125.5% or -12.0%).
 */
export function formatPercentage(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) {
    return '0.0%';
  }
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}%`;
}

/**
 * Get quality score rating tier and style configuration (0 to 100 scale).
 */
export function getQualityScoreBadge(score: number): {
  label: string;
  badgeBg: string;
  color: string;
} {
  if (score >= 70) {
    return {
      label: 'High Quality',
      badgeBg: 'var(--color-trend-up-bg, #e8f5e9)',
      color: 'var(--color-trend-up, #2e6b38)',
    };
  } else if (score >= 40) {
    return {
      label: 'Medium Quality',
      badgeBg: 'var(--color-surface-container-high, #eae8e3)',
      color: 'var(--color-primary, #59452b)',
    };
  }
  return {
    label: 'Low Quality',
    badgeBg: 'var(--color-trend-down-bg, #fdf0ed)',
    color: 'var(--color-secondary, #a43b2c)',
  };
}

/**
 * Get ROI indicator style configuration (Positive, Neutral, Negative).
 */
export function getROIBadge(roi: number): {
  badgeBg: string;
  color: string;
  label: string;
} {
  if (roi > 0) {
    return {
      badgeBg: 'var(--color-trend-up-bg, #e8f5e9)',
      color: 'var(--color-trend-up, #2e6b38)',
      label: 'Profitable',
    };
  } else if (roi < 0) {
    return {
      badgeBg: 'var(--color-trend-down-bg, #fdf0ed)',
      color: 'var(--color-secondary, #a43b2c)',
      label: 'Loss',
    };
  }
  return {
    badgeBg: 'var(--color-surface-container, #f0eee9)',
    color: 'var(--color-on-surface-variant, #4e453d)',
    label: 'Breakeven',
  };
}

export type SortField =
  | 'source_name'
  | 'total_leads'
  | 'average_quality_score'
  | 'total_spend'
  | 'attributed_revenue'
  | 'calculated_roi_percentage';

export type SortDirection = 'asc' | 'desc';

/**
 * Lead Acquisition Dashboard Component
 *
 * Displays source lead counts, quality scores, spend, attributed revenue, and ROI calculations
 * with interactive filtering across date range, lead source, region, and campaign (FR-1, FR-2, FR-11).
 */
export const AcquisitionDashboard: React.FC<AcquisitionDashboardProps> = ({
  summary: propSummary,
  sources: propSources,
  initialFilters = {},
  onFilterChange,
  onSourceSelect,
  onSourceClick,
  isLoading: propIsLoading,
  error: propError,
  onRefresh,
  className = '',
  'data-testid': testId = 'acquisition-dashboard',
}) => {
  // Filter parameters state
  const [filters, setFilters] = useState<AcquisitionFilterParams>({
    start_timestamp: initialFilters.start_timestamp || '',
    end_timestamp: initialFilters.end_timestamp || '',
    source_id: initialFilters.source_id || '',
    region_name: initialFilters.region_name || '',
    campaign_id: initialFilters.campaign_id || '',
  });

  // Local data fetching state if props are not provided
  const [fetchedSources, setFetchedSources] = useState<SourceROIMetrics[]>([]);
  const [fetchedSummary, setFetchedSummary] = useState<AcquisitionSummary | null>(null);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Table search & sort state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('calculated_roi_percentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const isControlled = propSources !== undefined && propSources !== null;
  const isLoading = propIsLoading !== undefined ? propIsLoading : internalLoading;
  const error = propError !== undefined ? propError : internalError;

  // Fetch metrics when controlled props are not supplied
  const fetchData = useCallback(async () => {
    if (isControlled) return;

    setInternalLoading(true);
    setInternalError(null);

    try {
      const activeParams: AcquisitionFilterParams = {};
      if (filters.start_timestamp) activeParams.start_timestamp = filters.start_timestamp;
      if (filters.end_timestamp) activeParams.end_timestamp = filters.end_timestamp;
      if (filters.source_id) activeParams.source_id = filters.source_id;
      if (filters.region_name) activeParams.region_name = filters.region_name;
      if (filters.campaign_id) activeParams.campaign_id = filters.campaign_id;

      const [sourcesRes, summaryRes] = await Promise.all([
        getAcquisitionSources(activeParams),
        getAcquisitionSummary(),
      ]);

      setFetchedSources(sourcesRes);
      setFetchedSummary(summaryRes);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : 'Failed to fetch acquisition metrics data.';
      setInternalError(errMsg);
    } finally {
      setInternalLoading(false);
    }
  }, [isControlled, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeSources = isControlled ? propSources || [] : fetchedSources;

  // Computed summary metrics fallback
  const summary: AcquisitionSummary = useMemo(() => {
    if (propSummary) return propSummary;
    if (fetchedSummary && !isControlled) return fetchedSummary;

    const totalSources = activeSources.length;
    const totalLeads = activeSources.reduce((acc, s) => acc + (s.total_leads || 0), 0);
    const totalSpend = activeSources.reduce((acc, s) => acc + (s.total_spend || 0), 0);
    const totalRevenue = activeSources.reduce((acc, s) => acc + (s.attributed_revenue || 0), 0);

    let overallQuality = 0;
    if (totalLeads > 0) {
      const weightedQuality = activeSources.reduce(
        (acc, s) => acc + (s.average_quality_score || 0) * (s.total_leads || 0),
        0
      );
      overallQuality = weightedQuality / totalLeads;
    } else if (totalSources > 0) {
      overallQuality =
        activeSources.reduce((acc, s) => acc + (s.average_quality_score || 0), 0) / totalSources;
    }

    const overallRoi =
      totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

    return {
      total_sources: totalSources,
      total_leads: totalLeads,
      overall_average_quality_score: Math.round(overallQuality * 10) / 10,
      total_spend: totalSpend,
      total_attributed_revenue: totalRevenue,
      overall_roi_percentage: Math.round(overallRoi * 10) / 10,
      sources: activeSources,
    };
  }, [propSummary, fetchedSummary, isControlled, activeSources]);

  // Handle filter changes
  const handleFilterInputChange = (
    field: keyof AcquisitionFilterParams,
    value: string
  ) => {
    const updated = { ...filters, [field]: value };
    setFilters(updated);
    if (onFilterChange) {
      onFilterChange(updated);
    }
  };

  const handleResetFilters = () => {
    const reset = {
      start_timestamp: '',
      end_timestamp: '',
      source_id: '',
      region_name: '',
      campaign_id: '',
    };
    setFilters(reset);
    setSearchQuery('');
    if (onFilterChange) {
      onFilterChange(reset);
    }
  };

  const handleRefreshClick = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      fetchData();
    }
  };

  // Filter and sort active sources for the table
  const filteredAndSortedSources = useMemo(() => {
    return activeSources
      .filter((s) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          s.source_name.toLowerCase().includes(q) ||
          s.source_id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string') {
          valA = (valA as string).toLowerCase();
          valB = (valB as string).toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [activeSources, searchQuery, sortField, sortDirection]);

  // Table sort click handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleRowClick = (source: SourceROIMetrics) => {
    setSelectedSourceId(source.source_id);
    if (onSourceSelect) {
      onSourceSelect(source);
    }
    if (onSourceClick) {
      onSourceClick(source.source_id);
    }
  };

  const hasActiveFilters = Boolean(
    filters.start_timestamp ||
      filters.end_timestamp ||
      filters.source_id ||
      filters.region_name ||
      filters.campaign_id ||
      searchQuery
  );

  return (
    <div
      className={`acquisition-dashboard-container ${className}`}
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '24px',
        backgroundColor: 'var(--color-surface, #fbf9f4)',
        color: 'var(--color-on-surface, #1b1c19)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
          paddingBottom: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
              fontSize: '28px',
              fontWeight: '400',
              margin: '0 0 4px 0',
              color: 'var(--color-primary, #59452b)',
            }}
          >
            Lead Acquisition & ROI Analytics
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Track channel performance, lead quality ratings, marketing spend, and overall return on investment.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={isLoading}
            data-testid="refresh-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: 'var(--color-surface-container, #f0eee9)',
              color: 'var(--color-primary, #59452b)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-default, 0.25rem)',
              fontSize: '13px',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'background-color 0.2s ease',
            }}
          >
            {isLoading ? 'Updating...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Error state banner */}
      {error && (
        <div
          role="alert"
          data-testid="error-banner"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-error-container, #ffdad6)',
            color: 'var(--color-on-error-container, #93000a)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px solid var(--color-error, #ba1a1a)',
            fontSize: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            <strong>Error:</strong> {error}
          </span>
          <button
            type="button"
            onClick={fetchData}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-on-error-container, #93000a)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary KPI Cards Grid */}
      <div
        data-testid="summary-kpis"
        className="metric-grid metric-grid-responsive"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Total Sources */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-on-surface-variant, #4e453d)',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Active Sources
          </span>
          <div
            style={{
              fontSize: '26px',
              fontWeight: '600',
              color: 'var(--color-primary, #59452b)',
              fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
            }}
          >
            {summary.total_sources}
          </div>
        </div>

        {/* Total Leads */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-on-surface-variant, #4e453d)',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Total Leads Acquired
          </span>
          <div
            style={{
              fontSize: '26px',
              fontWeight: '600',
              color: 'var(--color-primary, #59452b)',
              fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
            }}
          >
            {summary.total_leads.toLocaleString()}
          </div>
        </div>

        {/* Average Quality Score */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-on-surface-variant, #4e453d)',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Avg Quality Score
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
            }}
          >
            <span
              style={{
                fontSize: '26px',
                fontWeight: '600',
                color: 'var(--color-primary, #59452b)',
                fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
              }}
            >
              {summary.overall_average_quality_score.toFixed(1)}
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: getQualityScoreBadge(
                  summary.overall_average_quality_score
                ).badgeBg,
                color: getQualityScoreBadge(summary.overall_average_quality_score)
                  .color,
                fontWeight: '600',
              }}
            >
              / 100
            </span>
          </div>
        </div>

        {/* Total Spend */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-on-surface-variant, #4e453d)',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Total Spend
          </span>
          <div
            style={{
              fontSize: '26px',
              fontWeight: '600',
              color: 'var(--color-primary, #59452b)',
              fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
            }}
          >
            {formatCurrency(summary.total_spend)}
          </div>
        </div>

        {/* Attributed Revenue */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-on-surface-variant, #4e453d)',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Attributed Revenue
          </span>
          <div
            style={{
              fontSize: '26px',
              fontWeight: '600',
              color: 'var(--color-primary, #59452b)',
              fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
            }}
          >
            {formatCurrency(summary.total_attributed_revenue)}
          </div>
        </div>

        {/* Overall ROI */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: '600',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-on-surface-variant, #4e453d)',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Overall ROI
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                fontSize: '26px',
                fontWeight: '600',
                color: getROIBadge(summary.overall_roi_percentage).color,
                fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
              }}
            >
              {formatPercentage(summary.overall_roi_percentage)}
            </span>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: getROIBadge(summary.overall_roi_percentage).badgeBg,
                color: getROIBadge(summary.overall_roi_percentage).color,
                fontWeight: '600',
                textTransform: 'uppercase',
              }}
            >
              {getROIBadge(summary.overall_roi_percentage).label}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar (FR-11) */}
      <div
        data-testid="filter-controls"
        style={{
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              fontWeight: '600',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--color-primary, #59452b)',
            }}
          >
            Report Filter Controls (FR-11)
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              data-testid="reset-filters-btn"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-secondary, #a43b2c)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '2px 6px',
                textDecoration: 'underline',
              }}
            >
              Reset All Filters
            </button>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          {/* Start Date */}
          <div>
            <label
              htmlFor="filter-start-timestamp"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: '600',
                marginBottom: '4px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Start Date
            </label>
            <input
              id="filter-start-timestamp"
              type="date"
              value={filters.start_timestamp ? filters.start_timestamp.slice(0, 10) : ''}
              onChange={(e) =>
                handleFilterInputChange('start_timestamp', e.target.value)
              }
              data-testid="filter-start-date"
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '13px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px solid var(--color-outline, #80756b)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                color: 'var(--color-on-surface, #1b1c19)',
              }}
            />
          </div>

          {/* End Date */}
          <div>
            <label
              htmlFor="filter-end-timestamp"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: '600',
                marginBottom: '4px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              End Date
            </label>
            <input
              id="filter-end-timestamp"
              type="date"
              value={filters.end_timestamp ? filters.end_timestamp.slice(0, 10) : ''}
              onChange={(e) =>
                handleFilterInputChange('end_timestamp', e.target.value)
              }
              data-testid="filter-end-date"
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '13px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px solid var(--color-outline, #80756b)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                color: 'var(--color-on-surface, #1b1c19)',
              }}
            />
          </div>

          {/* Lead Source ID / Filter */}
          <div>
            <label
              htmlFor="filter-source-id"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: '600',
                marginBottom: '4px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Lead Source ID / Name
            </label>
            <input
              id="filter-source-id"
              type="text"
              placeholder="e.g. src-google-paid"
              value={filters.source_id || ''}
              onChange={(e) => handleFilterInputChange('source_id', e.target.value)}
              data-testid="filter-source-id"
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '13px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px solid var(--color-outline, #80756b)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                color: 'var(--color-on-surface, #1b1c19)',
              }}
            />
          </div>

          {/* Region */}
          <div>
            <label
              htmlFor="filter-region-name"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: '600',
                marginBottom: '4px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Region
            </label>
            <input
              id="filter-region-name"
              type="text"
              placeholder="e.g. North America"
              value={filters.region_name || ''}
              onChange={(e) =>
                handleFilterInputChange('region_name', e.target.value)
              }
              data-testid="filter-region"
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '13px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px solid var(--color-outline, #80756b)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                color: 'var(--color-on-surface, #1b1c19)',
              }}
            />
          </div>

          {/* Campaign */}
          <div>
            <label
              htmlFor="filter-campaign-id"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: '600',
                marginBottom: '4px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Campaign ID
            </label>
            <input
              id="filter-campaign-id"
              type="text"
              placeholder="e.g. cmp-q4-growth"
              value={filters.campaign_id || ''}
              onChange={(e) =>
                handleFilterInputChange('campaign_id', e.target.value)
              }
              data-testid="filter-campaign"
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '13px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px solid var(--color-outline, #80756b)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                color: 'var(--color-on-surface, #1b1c19)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Source Performance & ROI Table Section (FR-1, FR-2) */}
      <div
        style={{
          backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          overflow: 'hidden',
          boxShadow: '0 2px 6px rgba(115, 92, 65, 0.04)',
        }}
      >
        {/* Table header bar with search */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: '500',
                margin: 0,
                fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                color: 'var(--color-primary, #59452b)',
              }}
            >
              Acquisition Sources & ROI Table
            </h2>
            <p
              style={{
                fontSize: '12px',
                margin: '2px 0 0 0',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Showing {filteredAndSortedSources.length} of {activeSources.length} acquisition channels
            </p>
          </div>

          <div style={{ minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search source by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="search-input"
              style={{
                width: '100%',
                padding: '6px 12px',
                fontSize: '13px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px solid var(--color-outline, #80756b)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              }}
            />
          </div>
        </div>

        {/* Table view */}
        <div style={{ overflowX: 'auto' }}>
          <table
            data-testid="sources-table"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--color-surface-container, #f0eee9)',
                  borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
                  color: 'var(--color-primary, #59452b)',
                  fontWeight: '600',
                }}
              >
                <th
                  onClick={() => handleSort('source_name')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  title="Sort by Source Name"
                >
                  Acquisition Source{' '}
                  {sortField === 'source_name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('total_leads')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    textAlign: 'right',
                  }}
                  title="Sort by Total Leads"
                >
                  Total Leads{' '}
                  {sortField === 'total_leads' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('average_quality_score')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    textAlign: 'center',
                  }}
                  title="Sort by Quality Score"
                >
                  Quality Rating (0-100){' '}
                  {sortField === 'average_quality_score'
                    ? sortDirection === 'asc'
                      ? '▲'
                      : '▼'
                    : ''}
                </th>
                <th
                  onClick={() => handleSort('total_spend')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    textAlign: 'right',
                  }}
                  title="Sort by Marketing Spend"
                >
                  Total Spend{' '}
                  {sortField === 'total_spend' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('attributed_revenue')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    textAlign: 'right',
                  }}
                  title="Sort by Attributed Revenue"
                >
                  Attributed Revenue{' '}
                  {sortField === 'attributed_revenue'
                    ? sortDirection === 'asc'
                      ? '▲'
                      : '▼'
                    : ''}
                </th>
                <th
                  onClick={() => handleSort('calculated_roi_percentage')}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    textAlign: 'right',
                  }}
                  title="Sort by Calculated ROI %"
                >
                  Calculated ROI (%){' '}
                  {sortField === 'calculated_roi_percentage'
                    ? sortDirection === 'asc'
                      ? '▲'
                      : '▼'
                    : ''}
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                    }}
                  >
                    <div style={{ display: 'inline-block', animation: 'pulse 1.5s infinite' }}>
                      Loading lead acquisition source metrics...
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedSources.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                    }}
                  >
                    <p style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '500' }}>
                      No acquisition sources found.
                    </p>
                    <p style={{ margin: 0, fontSize: '13px' }}>
                      Try adjusting search terms or clearing active report filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedSources.map((source) => {
                  const isSelected = selectedSourceId === source.source_id;
                  const qualityBadge = getQualityScoreBadge(
                    source.average_quality_score
                  );
                  const roiBadge = getROIBadge(source.calculated_roi_percentage);

                  return (
                    <tr
                      key={source.source_id}
                      data-testid={`source-row-${source.source_id}`}
                      onClick={() => handleRowClick(source)}
                      style={{
                        borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
                        backgroundColor: isSelected
                          ? 'var(--color-surface-container, #f0eee9)'
                          : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor =
                            'var(--color-surface-container-low, #f5f3ee)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {/* Source name & ID */}
                      <td style={{ padding: '12px 16px' }}>
                        <div
                          style={{
                            fontWeight: '600',
                            color: 'var(--color-primary, #59452b)',
                          }}
                        >
                          {source.source_name}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-outline, #80756b)',
                            fontFamily: 'monospace',
                          }}
                        >
                          {source.source_id}
                        </div>
                      </td>

                      {/* Total Leads */}
                      <td
                        style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontWeight: '600',
                        }}
                      >
                        {source.total_leads.toLocaleString()}
                      </td>

                      {/* Quality Score */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: '600',
                              color: 'var(--color-on-surface, #1b1c19)',
                            }}
                          >
                            {source.average_quality_score.toFixed(1)}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-full, 9999px)',
                              backgroundColor: qualityBadge.badgeBg,
                              color: qualityBadge.color,
                              fontWeight: '600',
                            }}
                          >
                            {qualityBadge.label}
                          </span>
                        </div>
                      </td>

                      {/* Spend */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {formatCurrency(source.total_spend)}
                      </td>

                      {/* Attributed Revenue */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {formatCurrency(source.attributed_revenue)}
                      </td>

                      {/* Calculated ROI % */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-sm, 0.125rem)',
                            backgroundColor: roiBadge.badgeBg,
                            color: roiBadge.color,
                            fontWeight: '700',
                            fontSize: '13px',
                          }}
                        >
                          {formatPercentage(source.calculated_roi_percentage)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AcquisitionDashboard;
