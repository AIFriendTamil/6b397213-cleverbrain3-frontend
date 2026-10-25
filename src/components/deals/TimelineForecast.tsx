'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DealForecastResponse,
  MilestoneForecastEstimate,
  ForecastRequestPayload,
  Milestone,
  getForecast,
} from '../../services/api_client';

export interface TimelineForecastProps {
  /** External forecast data response object */
  forecast?: DealForecastResponse | null;
  /** Deal identifier associated with the forecast */
  dealId?: string;
  /** Optional list of deal milestones to cross-reference target dates */
  milestones?: Milestone[] | null;
  /** Callback fired to refresh or recalculate the timeline forecast */
  onRefreshForecast?: (includeMilestones?: boolean) => Promise<void> | void;
  /** Callback fired when a milestone estimate card or row is selected */
  onMilestoneSelect?: (milestoneId: string) => void;
  /** Alias callback fired when a milestone estimate is clicked */
  onMilestoneClick?: (estimate: MilestoneForecastEstimate) => void;
  /** Indicates whether the forecast calculation is in progress */
  isLoading?: boolean;
  /** Error message to render if prediction generation failed */
  error?: string | null;
  /** Custom CSS class name override */
  className?: string;
  /** Test identifier attribute override */
  'data-testid'?: string;
}

export interface ConfidenceStyle {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  barColor: string;
  icon: string;
}

/**
 * Helper to format ISO date strings into localized, human-readable format.
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Format confidence score into percentage string (e.g. 85.0%).
 * Supports both 0.0-1.0 decimal scale and 0-100 percentage scale.
 */
export function formatConfidenceScore(score: number | undefined | null): string {
  if (score === undefined || score === null || isNaN(score)) {
    return '0%';
  }
  const pct = score <= 1.0 && score >= 0 ? score * 100 : score;
  return `${pct.toFixed(1)}%`;
}

/**
 * Determine visual styling parameters for a confidence score.
 */
export function getConfidenceStyle(score: number | undefined | null): ConfidenceStyle {
  if (score === undefined || score === null || isNaN(score)) {
    return {
      label: 'Unknown',
      badgeBg: '#f0eee9',
      badgeText: '#4e453d',
      badgeBorder: '#d1c4b9',
      barColor: '#80756b',
      icon: '?',
    };
  }

  const normalized = score <= 1.0 && score >= 0 ? score : score / 100;

  if (normalized >= 0.8) {
    return {
      label: 'High Confidence',
      badgeBg: '#e8f5e9',
      badgeText: '#1b4332',
      badgeBorder: '#a3cfbb',
      barColor: '#2e7d32',
      icon: '✓',
    };
  }

  if (normalized >= 0.5) {
    return {
      label: 'Medium Confidence',
      badgeBg: '#e7f1ff',
      badgeText: '#071d30',
      badgeBorder: '#b4c8e2',
      barColor: '#374a5f',
      icon: 'ℹ',
    };
  }

  return {
    label: 'Low Confidence',
    badgeBg: '#fdf0ed',
    badgeText: '#842417',
    badgeBorder: '#f5c2c7',
    barColor: '#a43b2c',
    icon: '⚠',
  };
}

/**
 * Calculate date variance in days between original target date and estimated completion date.
 * Returns positive number if delayed, negative if ahead of schedule, or null if invalid.
 */
export function calculateDateVarianceDays(
  targetDate?: string | null,
  estimatedDate?: string | null
): number | null {
  if (!targetDate || !estimatedDate) return null;
  try {
    const t = new Date(targetDate).getTime();
    const e = new Date(estimatedDate).getTime();
    if (isNaN(t) || isNaN(e)) return null;
    const diffMs = e - t;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * Filter and sort milestone forecast estimates.
 */
export function filterAndSortEstimates(
  estimates: MilestoneForecastEstimate[],
  searchTerm: string = '',
  minConfidence: number = 0,
  sortBy: 'date' | 'confidence' | 'title' = 'date',
  sortOrder: 'asc' | 'desc' = 'asc'
): MilestoneForecastEstimate[] {
  if (!estimates || !Array.isArray(estimates)) return [];

  const filtered = estimates.filter((item) => {
    const term = searchTerm.toLowerCase().trim();
    const titleMatch =
      !term || (item.milestone_title && item.milestone_title.toLowerCase().includes(term));

    const normConfidence =
      item.confidence_score <= 1.0 && item.confidence_score >= 0
        ? item.confidence_score * 100
        : item.confidence_score;

    const confidenceMatch = normConfidence >= minConfidence;

    return titleMatch && confidenceMatch;
  });

  return filtered.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'date') {
      const dateA = new Date(a.estimated_completion_date).getTime() || 0;
      const dateB = new Date(b.estimated_completion_date).getTime() || 0;
      comparison = dateA - dateB;
    } else if (sortBy === 'confidence') {
      comparison = a.confidence_score - b.confidence_score;
    } else if (sortBy === 'title') {
      const titleA = (a.milestone_title || '').toLowerCase();
      const titleB = (b.milestone_title || '').toLowerCase();
      comparison = titleA.localeCompare(titleB);
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });
}

/**
 * Interactive timeline forecast component showing AI predicted deal close date,
 * confidence breakdown, fallback velocity notifications, and milestone estimates.
 */
export const TimelineForecast: React.FC<TimelineForecastProps> = ({
  forecast: externalForecast,
  dealId,
  milestones = [],
  onRefreshForecast,
  onMilestoneSelect,
  onMilestoneClick,
  isLoading: externalIsLoading = false,
  error: externalError = null,
  className = '',
  'data-testid': testId = 'timeline-forecast',
}) => {
  const [internalForecast, setInternalForecast] = useState<DealForecastResponse | null>(
    externalForecast || null
  );
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [minConfidenceFilter, setMinConfidenceFilter] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'date' | 'confidence' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'timeline' | 'cards' | 'table'>('timeline');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);

  // Sync internal forecast state with external prop changes
  useEffect(() => {
    if (externalForecast !== undefined) {
      setInternalForecast(externalForecast);
    }
  }, [externalForecast]);

  // Fetch forecast if dealId is provided and external forecast is null
  const fetchForecastData = useCallback(async () => {
    if (!dealId) return;
    setInternalLoading(true);
    setInternalError(null);
    try {
      const payload: ForecastRequestPayload = {
        deal_id: dealId,
        include_milestones: true,
      };
      const res = await getForecast(dealId, payload);
      setInternalForecast(res);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to generate timeline forecast for this deal.';
      setInternalError(msg);
    } finally {
      setInternalLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (!externalForecast && dealId && !externalIsLoading) {
      fetchForecastData();
    }
  }, [externalForecast, dealId, externalIsLoading, fetchForecastData]);

  const activeForecast = externalForecast !== undefined ? externalForecast : internalForecast;
  const isLoading = externalIsLoading || internalLoading;
  const activeError = externalError || internalError;

  const handleRefresh = async () => {
    if (onRefreshForecast) {
      await onRefreshForecast(true);
    } else {
      await fetchForecastData();
    }
  };

  const milestoneMap = useMemo(() => {
    const map = new Map<string, Milestone>();
    if (milestones && Array.isArray(milestones)) {
      milestones.forEach((m) => {
        if (m.id) map.set(m.id, m);
      });
    }
    return map;
  }, [milestones]);

  const filteredEstimates = useMemo(() => {
    if (!activeForecast || !activeForecast.milestone_estimates) return [];
    return filterAndSortEstimates(
      activeForecast.milestone_estimates,
      searchTerm,
      minConfidenceFilter,
      sortBy,
      sortOrder
    );
  }, [activeForecast, searchTerm, minConfidenceFilter, sortBy, sortOrder]);

  const handleMilestoneClick = (item: MilestoneForecastEstimate) => {
    setSelectedMilestoneId(item.milestone_id);
    if (onMilestoneSelect) {
      onMilestoneSelect(item.milestone_id);
    }
    if (onMilestoneClick) {
      onMilestoneClick(item);
    }
  };

  const overallConfidenceStyle = useMemo(() => {
    return getConfidenceStyle(activeForecast?.confidence_score);
  }, [activeForecast?.confidence_score]);

  if (isLoading) {
    return (
      <div
        className={`timeline-forecast-container ${className}`}
        data-testid={testId}
        style={{
          padding: '24px',
          backgroundColor: '#fbf9f4',
          borderRadius: '8px',
          border: '1px solid #d1c4b9',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '3px solid #735c41',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span style={{ fontSize: '16px', fontWeight: 500, color: '#59452b' }}>
            Calculating AI timeline predictions and milestone estimates...
          </span>
        </div>
        <div
          style={{
            height: '120px',
            backgroundColor: '#f5f3ee',
            borderRadius: '6px',
            opacity: 0.6,
          }}
        />
      </div>
    );
  }

  if (activeError) {
    return (
      <div
        className={`timeline-forecast-container ${className}`}
        data-testid={testId}
        style={{
          padding: '24px',
          backgroundColor: '#fdf0ed',
          borderRadius: '8px',
          border: '1px solid #f5c2c7',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#ba1a1a', fontSize: '18px', fontWeight: 'bold' }}>⚠</span>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#842417', fontFamily: 'Libre Caslon Text, serif' }}>
              Forecast Generation Failed
            </h3>
          </div>
          <button
            onClick={handleRefresh}
            style={{
              padding: '6px 14px',
              backgroundColor: '#a43b2c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Retry Forecast
          </button>
        </div>
        <p style={{ margin: '12px 0 0 0', color: '#842417', fontSize: '14px' }}>{activeError}</p>
      </div>
    );
  }

  if (!activeForecast) {
    return (
      <div
        className={`timeline-forecast-container ${className}`}
        data-testid={testId}
        style={{
          padding: '32px',
          backgroundColor: '#fbf9f4',
          borderRadius: '8px',
          border: '1px dashed #d1c4b9',
          textAlign: 'center',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '20px',
            color: '#1b1c19',
            fontFamily: 'Libre Caslon Text, serif',
          }}
        >
          No Timeline Forecast Available
        </h3>
        <p style={{ margin: '0 0 16px 0', color: '#4e453d', fontSize: '14px' }}>
          Predictive timeline analytics have not been generated for this deal yet.
        </p>
        <button
          onClick={handleRefresh}
          style={{
            padding: '8px 18px',
            backgroundColor: '#59452b',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Generate AI Timeline Forecast
        </button>
      </div>
    );
  }

  return (
    <div
      className={`timeline-forecast-container ${className}`}
      data-testid={testId}
      style={{
        padding: '24px',
        backgroundColor: '#fbf9f4',
        borderRadius: '8px',
        border: '1px solid #d1c4b9',
        fontFamily: 'DM Sans, sans-serif',
        color: '#1b1c19',
      }}
    >
      {/* Header Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#80756b',
            }}
          >
            Predictive Deal Analytics
          </span>
          <h2
            style={{
              margin: '4px 0 0 0',
              fontSize: '28px',
              fontWeight: 400,
              color: '#1b1c19',
              fontFamily: 'Libre Caslon Text, serif',
            }}
          >
            Timeline & Close Date Forecast
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {activeForecast.details && Object.keys(activeForecast.details).length > 0 && (
            <button
              onClick={() => setShowDetailsModal(!showDetailsModal)}
              data-testid="toggle-details-btn"
              style={{
                padding: '8px 14px',
                backgroundColor: '#f0eee9',
                color: '#4e453d',
                border: '1px solid #d1c4b9',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {showDetailsModal ? 'Hide Model Details' : 'View Model Details'}
            </button>
          )}

          <button
            onClick={handleRefresh}
            data-testid="recalculate-forecast-btn"
            style={{
              padding: '8px 16px',
              backgroundColor: '#59452b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>↻</span>
            <span>Recalculate AI Model</span>
          </button>
        </div>
      </div>

      {/* Fallback Warning Notice (NFR-4) */}
      {activeForecast.is_fallback && (
        <div
          data-testid="fallback-notice-banner"
          style={{
            marginBottom: '20px',
            padding: '14px 18px',
            backgroundColor: '#fff8f0',
            border: '1px solid #f5d6b4',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '18px', color: '#735c41' }}>⚡</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#59452b', marginBottom: '2px' }}>
              Historical Velocity Fallback Model Active
            </div>
            <div style={{ fontSize: '13px', color: '#4e453d', lineHeight: '1.4' }}>
              Primary AI forecasting engine was offline or unconfigured. Prediction generated using
              historical stage velocity analysis fallback.
            </div>
          </div>
        </div>
      )}

      {/* Overview Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Card 1: Predicted Close Date */}
        <div
          style={{
            padding: '18px',
            backgroundColor: '#ffffff',
            borderRadius: '6px',
            border: '1px solid #e4e2dd',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#80756b', textTransform: 'uppercase' }}>
            Predicted Close Date
          </span>
          <div
            data-testid="predicted-close-date"
            style={{
              fontSize: '22px',
              fontWeight: 400,
              fontFamily: 'Libre Caslon Text, serif',
              color: '#1b1c19',
              margin: '6px 0 2px 0',
            }}
          >
            {formatDate(activeForecast.predicted_close_date)}
          </div>
          <span style={{ fontSize: '12px', color: '#4e453d' }}>Estimated Target Completion</span>
        </div>

        {/* Card 2: Overall Confidence Score */}
        <div
          style={{
            padding: '18px',
            backgroundColor: '#ffffff',
            borderRadius: '6px',
            border: '1px solid #e4e2dd',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#80756b', textTransform: 'uppercase' }}>
              Model Confidence
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: overallConfidenceStyle.badgeBg,
                color: overallConfidenceStyle.badgeText,
                border: `1px solid ${overallConfidenceStyle.badgeBorder}`,
                fontWeight: 600,
              }}
            >
              {overallConfidenceStyle.label}
            </span>
          </div>

          <div
            data-testid="overall-confidence-score"
            style={{
              fontSize: '22px',
              fontWeight: 400,
              fontFamily: 'Libre Caslon Text, serif',
              color: '#1b1c19',
              margin: '6px 0 8px 0',
            }}
          >
            {formatConfidenceScore(activeForecast.confidence_score)}
          </div>

          {/* Progress Bar */}
          <div
            style={{
              height: '6px',
              backgroundColor: '#f0eee9',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(
                  100,
                  Math.max(
                    0,
                    activeForecast.confidence_score <= 1.0
                      ? activeForecast.confidence_score * 100
                      : activeForecast.confidence_score
                  )
                )}%`,
                backgroundColor: overallConfidenceStyle.barColor,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* Card 3: Model Engine Version */}
        <div
          style={{
            padding: '18px',
            backgroundColor: '#ffffff',
            borderRadius: '6px',
            border: '1px solid #e4e2dd',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#80756b', textTransform: 'uppercase' }}>
            Forecasting Engine
          </span>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 500,
              color: '#374a5f',
              margin: '6px 0 2px 0',
              wordBreak: 'break-word',
            }}
          >
            {activeForecast.model_version || (activeForecast.is_fallback ? 'Velocity-Fallback-v1' : 'AI-Predictor-v1')}
          </div>
          <span style={{ fontSize: '12px', color: '#4e453d' }}>
            {activeForecast.is_fallback ? 'Heuristic Analysis' : 'Trained AI Model'}
          </span>
        </div>

        {/* Card 4: Total Milestone Estimates Count */}
        <div
          style={{
            padding: '18px',
            backgroundColor: '#ffffff',
            borderRadius: '6px',
            border: '1px solid #e4e2dd',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#80756b', textTransform: 'uppercase' }}>
            Milestones Analyzed
          </span>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 400,
              fontFamily: 'Libre Caslon Text, serif',
              color: '#1b1c19',
              margin: '6px 0 2px 0',
            }}
          >
            {activeForecast.milestone_estimates ? activeForecast.milestone_estimates.length : 0}
          </div>
          <span style={{ fontSize: '12px', color: '#4e453d' }}>Milestone Timeline Predictions</span>
        </div>
      </div>

      {/* Model Details Modal / Accordion Panel */}
      {showDetailsModal && activeForecast.details && (
        <div
          data-testid="model-details-panel"
          style={{
            marginBottom: '24px',
            padding: '16px 20px',
            backgroundColor: '#f5f3ee',
            borderRadius: '6px',
            border: '1px solid #d1c4b9',
          }}
        >
          <h4
            style={{
              margin: '0 0 10px 0',
              fontSize: '16px',
              color: '#59452b',
              fontFamily: 'Libre Caslon Text, serif',
            }}
          >
            AI Model Calculation Parameters & Metadata
          </h4>
          <pre
            style={{
              margin: 0,
              padding: '12px',
              backgroundColor: '#ffffff',
              borderRadius: '4px',
              border: '1px solid #e4e2dd',
              fontSize: '12px',
              color: '#1b1c19',
              overflowX: 'auto',
              fontFamily: 'monospace',
            }}
          >
            {JSON.stringify(activeForecast.details, null, 2)}
          </pre>
        </div>
      )}

      {/* Filters and View Controls Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          backgroundColor: '#f5f3ee',
          padding: '12px 16px',
          borderRadius: '6px',
          border: '1px solid #e4e2dd',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          {/* Search Box */}
          <input
            type="text"
            placeholder="Search milestone estimates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="search-milestone-input"
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid #d1c4b9',
              fontSize: '13px',
              width: '220px',
              backgroundColor: '#ffffff',
            }}
          />

          {/* Min Confidence Dropdown Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#4e453d', fontWeight: 500 }}>
              Confidence:
            </label>
            <select
              value={minConfidenceFilter}
              onChange={(e) => setMinConfidenceFilter(Number(e.target.value))}
              data-testid="confidence-filter-select"
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: '1px solid #d1c4b9',
                fontSize: '13px',
                backgroundColor: '#ffffff',
              }}
            >
              <option value={0}>All Levels</option>
              <option value={50}>≥ 50% Medium+</option>
              <option value={80}>≥ 80% High Only</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#4e453d', fontWeight: 500 }}>
              Sort:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'confidence' | 'title')}
              data-testid="sort-by-select"
              style={{
                padding: '6px 10px',
                borderRadius: '4px',
                border: '1px solid #d1c4b9',
                fontSize: '13px',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="date">Estimated Date</option>
              <option value="confidence">Confidence Score</option>
              <option value="title">Milestone Title</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              data-testid="toggle-sort-order-btn"
              style={{
                padding: '6px 10px',
                backgroundColor: '#ffffff',
                border: '1px solid #d1c4b9',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
          </div>
        </div>

        {/* View Mode Toggle Buttons */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#e4e2dd', padding: '2px', borderRadius: '4px' }}>
          <button
            onClick={() => setViewMode('timeline')}
            data-testid="view-timeline-btn"
            style={{
              padding: '6px 12px',
              backgroundColor: viewMode === 'timeline' ? '#ffffff' : 'transparent',
              color: viewMode === 'timeline' ? '#59452b' : '#4e453d',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: viewMode === 'timeline' ? 600 : 400,
            }}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode('cards')}
            data-testid="view-cards-btn"
            style={{
              padding: '6px 12px',
              backgroundColor: viewMode === 'cards' ? '#ffffff' : 'transparent',
              color: viewMode === 'cards' ? '#59452b' : '#4e453d',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: viewMode === 'cards' ? 600 : 400,
            }}
          >
            Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            data-testid="view-table-btn"
            style={{
              padding: '6px 12px',
              backgroundColor: viewMode === 'table' ? '#ffffff' : 'transparent',
              color: viewMode === 'table' ? '#59452b' : '#4e453d',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: viewMode === 'table' ? 600 : 400,
            }}
          >
            Table
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredEstimates.length === 0 ? (
        <div
          data-testid="empty-estimates-notice"
          style={{
            padding: '32px',
            backgroundColor: '#ffffff',
            borderRadius: '6px',
            border: '1px dashed #d1c4b9',
            textAlign: 'center',
            color: '#80756b',
            fontSize: '14px',
          }}
        >
          No milestone forecast estimates match the selected filters or search term.
        </div>
      ) : viewMode === 'timeline' ? (
        /* View 1: Chronological Vertical Timeline View */
        <div
          data-testid="timeline-view-container"
          style={{
            position: 'relative',
            paddingLeft: '24px',
            borderLeft: '2px solid #d1c4b9',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            margin: '12px 0 12px 12px',
          }}
        >
          {filteredEstimates.map((item, index) => {
            const style = getConfidenceStyle(item.confidence_score);
            const matchedMilestone = milestoneMap.get(item.milestone_id);
            const title = item.milestone_title || matchedMilestone?.title || `Milestone ${item.milestone_id}`;
            const targetDate = matchedMilestone?.target_date;
            const varianceDays = calculateDateVarianceDays(targetDate, item.estimated_completion_date);
            const isSelected = selectedMilestoneId === item.milestone_id;

            return (
              <div
                key={item.milestone_id || index}
                data-testid={`milestone-forecast-item-${item.milestone_id}`}
                onClick={() => handleMilestoneClick(item)}
                style={{
                  position: 'relative',
                  padding: '16px 20px',
                  backgroundColor: isSelected ? '#fff8f0' : '#ffffff',
                  borderRadius: '6px',
                  border: isSelected ? '2px solid #59452b' : '1px solid #e4e2dd',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 2px 8px rgba(115, 92, 65, 0.12)' : 'none',
                }}
              >
                {/* Timeline Node Bullet */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-31px',
                    top: '20px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: style.barColor,
                    border: '2px solid #ffffff',
                    boxShadow: '0 0 0 2px #d1c4b9',
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: '16px',
                          fontWeight: 500,
                          color: '#1b1c19',
                          fontFamily: 'Libre Caslon Text, serif',
                        }}
                      >
                        {title}
                      </h4>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: style.badgeBg,
                          color: style.badgeText,
                          border: `1px solid ${style.badgeBorder}`,
                          fontWeight: 600,
                        }}
                      >
                        {formatConfidenceScore(item.confidence_score)} Confidence
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        marginTop: '8px',
                        fontSize: '13px',
                        color: '#4e453d',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <strong>Predicted Finish:</strong> {formatDate(item.estimated_completion_date)}
                      </div>

                      {targetDate && (
                        <div>
                          <strong>Target Date:</strong> {formatDate(targetDate)}
                        </div>
                      )}

                      {varianceDays !== null && (
                        <div
                          style={{
                            fontWeight: 600,
                            color:
                              varianceDays > 0
                                ? '#a43b2c'
                                : varianceDays < 0
                                ? '#2e7d32'
                                : '#59452b',
                          }}
                        >
                          {varianceDays > 0
                            ? `+${varianceDays} days delayed`
                            : varianceDays < 0
                            ? `${Math.abs(varianceDays)} days ahead`
                            : 'On Schedule'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Individual Confidence Bar */}
                  <div style={{ width: '120px', textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#80756b', marginBottom: '4px' }}>
                      Estimate Certainty
                    </div>
                    <div
                      style={{
                        height: '6px',
                        backgroundColor: '#f0eee9',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              item.confidence_score <= 1.0
                                ? item.confidence_score * 100
                                : item.confidence_score
                            )
                          )}%`,
                          backgroundColor: style.barColor,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'cards' ? (
        /* View 2: Cards Grid View */
        <div
          data-testid="cards-view-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}
        >
          {filteredEstimates.map((item, index) => {
            const style = getConfidenceStyle(item.confidence_score);
            const matchedMilestone = milestoneMap.get(item.milestone_id);
            const title = item.milestone_title || matchedMilestone?.title || `Milestone ${item.milestone_id}`;
            const targetDate = matchedMilestone?.target_date;
            const varianceDays = calculateDateVarianceDays(targetDate, item.estimated_completion_date);
            const isSelected = selectedMilestoneId === item.milestone_id;

            return (
              <div
                key={item.milestone_id || index}
                data-testid={`milestone-forecast-card-${item.milestone_id}`}
                onClick={() => handleMilestoneClick(item)}
                style={{
                  padding: '16px',
                  backgroundColor: isSelected ? '#fff8f0' : '#ffffff',
                  borderRadius: '6px',
                  border: isSelected ? '2px solid #59452b' : '1px solid #e4e2dd',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: isSelected ? '0 2px 8px rgba(115, 92, 65, 0.12)' : 'none',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '15px',
                        fontWeight: 500,
                        color: '#1b1c19',
                        fontFamily: 'Libre Caslon Text, serif',
                      }}
                    >
                      {title}
                    </h4>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        backgroundColor: style.badgeBg,
                        color: style.badgeText,
                        border: `1px solid ${style.badgeBorder}`,
                        fontWeight: 600,
                      }}
                    >
                      {formatConfidenceScore(item.confidence_score)}
                    </span>
                  </div>

                  <div style={{ marginTop: '12px', fontSize: '13px', color: '#4e453d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Estimated Finish:</span>
                      <strong style={{ color: '#1b1c19' }}>{formatDate(item.estimated_completion_date)}</strong>
                    </div>

                    {targetDate && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>Target Date:</span>
                        <span>{formatDate(targetDate)}</span>
                      </div>
                    )}

                    {varianceDays !== null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                        <span>Schedule Variance:</span>
                        <strong
                          style={{
                            color:
                              varianceDays > 0
                                ? '#a43b2c'
                                : varianceDays < 0
                                ? '#2e7d32'
                                : '#59452b',
                          }}
                        >
                          {varianceDays > 0
                            ? `+${varianceDays}d`
                            : varianceDays < 0
                            ? `${varianceDays}d`
                            : 'On Track'}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    height: '4px',
                    backgroundColor: '#f0eee9',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          item.confidence_score <= 1.0
                            ? item.confidence_score * 100
                            : item.confidence_score
                        )
                      )}%`,
                      backgroundColor: style.barColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* View 3: Table View */
        <div
          data-testid="table-view-container"
          style={{
            overflowX: 'auto',
            backgroundColor: '#ffffff',
            borderRadius: '6px',
            border: '1px solid #e4e2dd',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f5f3ee', borderBottom: '1px solid #e4e2dd' }}>
                <th style={{ padding: '12px 16px', color: '#59452b', fontWeight: 600 }}>Milestone Title</th>
                <th style={{ padding: '12px 16px', color: '#59452b', fontWeight: 600 }}>Predicted Date</th>
                <th style={{ padding: '12px 16px', color: '#59452b', fontWeight: 600 }}>Target Date</th>
                <th style={{ padding: '12px 16px', color: '#59452b', fontWeight: 600 }}>Variance</th>
                <th style={{ padding: '12px 16px', color: '#59452b', fontWeight: 600 }}>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {filteredEstimates.map((item, idx) => {
                const style = getConfidenceStyle(item.confidence_score);
                const matchedMilestone = milestoneMap.get(item.milestone_id);
                const title = item.milestone_title || matchedMilestone?.title || `Milestone ${item.milestone_id}`;
                const targetDate = matchedMilestone?.target_date;
                const varianceDays = calculateDateVarianceDays(targetDate, item.estimated_completion_date);
                const isSelected = selectedMilestoneId === item.milestone_id;

                return (
                  <tr
                    key={item.milestone_id || idx}
                    data-testid={`milestone-forecast-row-${item.milestone_id}`}
                    onClick={() => handleMilestoneClick(item)}
                    style={{
                      borderBottom: '1px solid #f0eee9',
                      backgroundColor: isSelected ? '#fff8f0' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1b1c19' }}>{title}</td>
                    <td style={{ padding: '12px 16px', color: '#1b1c19' }}>
                      {formatDate(item.estimated_completion_date)}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#4e453d' }}>
                      {formatDate(targetDate)}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontWeight: 600,
                        color:
                          varianceDays === null
                            ? '#80756b'
                            : varianceDays > 0
                            ? '#a43b2c'
                            : varianceDays < 0
                            ? '#2e7d32'
                            : '#59452b',
                      }}
                    >
                      {varianceDays === null
                        ? 'N/A'
                        : varianceDays > 0
                        ? `+${varianceDays} days`
                        : varianceDays < 0
                        ? `${varianceDays} days`
                        : 'On Schedule'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: style.badgeBg,
                          color: style.badgeText,
                          border: `1px solid ${style.badgeBorder}`,
                          fontWeight: 600,
                        }}
                      >
                        {formatConfidenceScore(item.confidence_score)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
