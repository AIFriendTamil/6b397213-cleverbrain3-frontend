'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FunnelStageMetrics,
  FunnelFilterParams,
  StageLeadDetail,
  StageLeadDrillDownResponse,
  getFunnelStages,
  getFunnelStageLeads,
} from '../../services/api_client';

export interface ConversionFunnelFilterParams extends FunnelFilterParams {
  region_name?: string;
  campaign_id?: string;
}

export interface FunnelChartProps {
  /** Array of funnel stage metrics. If omitted/null, component fetches via API */
  stages?: FunnelStageMetrics[] | null;
  /** Currently selected stage ID for lead drill-down */
  selectedStageId?: string | null;
  /** Pre-loaded drill-down leads data. If omitted, component fetches via API */
  selectedStageLeads?: StageLeadDrillDownResponse | null;
  /** Initial filter parameter values */
  initialFilters?: ConversionFunnelFilterParams;
  /** Callback fired whenever user applies filter changes */
  onFilterChange?: (filters: ConversionFunnelFilterParams) => void;
  /** Callback fired when a stage is selected or toggled */
  onStageSelect?: (stageId: string | null) => void;
  /** Callback fired when a stage item is clicked */
  onStageClick?: (stage: FunnelStageMetrics) => void;
  /** Callback fired when an individual lead row is clicked */
  onLeadClick?: (leadId: string) => void;
  /** Loading state indicator override for funnel stages */
  isLoading?: boolean;
  /** Loading state indicator override for drill-down lead details */
  isDrillDownLoading?: boolean;
  /** Error message string override */
  error?: string | null;
  /** Callback fired to trigger a manual data refresh */
  onRefresh?: () => void;
  /** Custom CSS class name wrapper */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
  /** List of available lead sources for filter selector */
  availableSources?: Array<{ source_id: string; source_name: string }>;
  /** List of available campaigns for filter selector */
  availableCampaigns?: Array<{ campaign_id: string; campaign_name: string }>;
  /** List of available regions for filter selector */
  availableRegions?: string[];
}

/**
 * Format numerical rate value into percentage string (e.g. 45.5%).
 */
export function formatPercentage(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) {
    return '0.0%';
  }
  return `${val.toFixed(1)}%`;
}

/**
 * Format currency value into USD formatted string ($12,500).
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
 * Format days count into human readable string (e.g. 4.2 days).
 */
export function formatDays(days: number | undefined | null): string {
  if (days === undefined || days === null || isNaN(days)) {
    return '0 days';
  }
  return `${days.toFixed(1)} days`;
}

/**
 * Get quality score badge styling tier (High, Medium, Low).
 */
export function getQualityBadge(score: number): {
  label: string;
  color: string;
  badgeBg: string;
} {
  if (score >= 70) {
    return {
      label: 'High Quality',
      color: 'var(--color-trend-up, #2e6b38)',
      badgeBg: 'var(--color-trend-up-bg, #e8f5e9)',
    };
  }
  if (score >= 40) {
    return {
      label: 'Medium',
      color: 'var(--color-primary, #59452b)',
      badgeBg: 'var(--color-surface-container-high, #eae8e3)',
    };
  }
  return {
    label: 'Low Quality',
    color: 'var(--color-secondary, #a43b2c)',
    badgeBg: 'var(--color-trend-down-bg, #fdf0ed)',
  };
}

/**
 * Helper to determine bottleneck status and drop-off gap for a stage.
 */
export function getBottleneckDetails(stage: FunnelStageMetrics): {
  isBottleneck: boolean;
  conversionRate: number;
  targetRate: number;
  gap: number;
  badgeText: string;
} {
  const conversionRate = stage.conversion_rate_percentage ?? 0;
  const targetRate = stage.target_conversion_rate ?? 0;
  const gap = targetRate - conversionRate;
  const isBottleneck = stage.is_bottleneck || gap > 0;

  const badgeText = isBottleneck
    ? `Operational Bottleneck (Below Target by ${gap.toFixed(1)}%)`
    : `On Target (${conversionRate.toFixed(1)}% vs ${targetRate.toFixed(1)}% target)`;

  return {
    isBottleneck,
    conversionRate,
    targetRate,
    gap: Math.max(0, gap),
    badgeText,
  };
}

/**
 * Interactive Lead Acquisition Conversion Funnel Chart component.
 * Displays sequential stage progression, conversion rates, bottleneck alerts,
 * drill-down lead details, and comprehensive filter controls.
 */
export const FunnelChart: React.FC<FunnelChartProps> = ({
  stages: stagesProp,
  selectedStageId: selectedStageIdProp,
  selectedStageLeads: selectedStageLeadsProp,
  initialFilters = {},
  onFilterChange,
  onStageSelect,
  onStageClick,
  onLeadClick,
  isLoading: isLoadingProp = false,
  isDrillDownLoading: isDrillDownLoadingProp = false,
  error: errorProp = null,
  onRefresh,
  className = '',
  'data-testid': testId = 'funnel-chart',
  availableSources = [],
  availableCampaigns = [],
  availableRegions = [],
}) => {
  // --- Local State ---
  const [internalStages, setInternalStages] = useState<FunnelStageMetrics[] | null>(stagesProp ?? null);
  const [internalSelectedStageId, setInternalSelectedStageId] = useState<string | null>(selectedStageIdProp ?? null);
  const [internalStageLeads, setInternalStageLeads] = useState<StageLeadDrillDownResponse | null>(selectedStageLeadsProp ?? null);

  const [filters, setFilters] = useState<ConversionFunnelFilterParams>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<ConversionFunnelFilterParams>(initialFilters);

  const [internalIsLoading, setInternalIsLoading] = useState<boolean>(false);
  const [internalIsDrillDownLoading, setInternalIsDrillDownLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const [drillDownPage, setDrillDownPage] = useState<number>(1);
  const [drillDownLimit] = useState<number>(5);

  // Sync state with props when controlled externally
  useEffect(() => {
    if (stagesProp !== undefined) {
      setInternalStages(stagesProp);
    }
  }, [stagesProp]);

  useEffect(() => {
    if (selectedStageIdProp !== undefined) {
      setInternalSelectedStageId(selectedStageIdProp);
    }
  }, [selectedStageIdProp]);

  useEffect(() => {
    if (selectedStageLeadsProp !== undefined) {
      setInternalStageLeads(selectedStageLeadsProp);
    }
  }, [selectedStageLeadsProp]);

  // Active stages list
  const stages = stagesProp !== undefined ? stagesProp : internalStages;
  const selectedStageId = selectedStageIdProp !== undefined ? selectedStageIdProp : internalSelectedStageId;
  const stageLeads = selectedStageLeadsProp !== undefined ? selectedStageLeadsProp : internalStageLeads;

  const isLoading = isLoadingProp || internalIsLoading;
  const isDrillDownLoading = isDrillDownLoadingProp || internalIsDrillDownLoading;
  const error = errorProp || internalError;

  // Fetch funnel stages if uncontrolled and stagesProp not provided
  const fetchStages = useCallback(async () => {
    if (stagesProp !== undefined) return;
    setInternalIsLoading(true);
    setInternalError(null);
    try {
      const data = await getFunnelStages(appliedFilters);
      setInternalStages(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch conversion funnel stages';
      setInternalError(msg);
    } finally {
      setInternalIsLoading(false);
    }
  }, [stagesProp, appliedFilters]);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  // Fetch stage drill-down leads if uncontrolled and selectedStageId is active
  const fetchStageLeads = useCallback(async (stageId: string, page: number) => {
    if (selectedStageLeadsProp !== undefined) return;
    setInternalIsDrillDownLoading(true);
    try {
      const data = await getFunnelStageLeads(stageId, { page, limit: drillDownLimit });
      setInternalStageLeads(data);
    } catch (err: unknown) {
      console.error('Failed to fetch stage lead details:', err);
    } finally {
      setInternalIsDrillDownLoading(false);
    }
  }, [selectedStageLeadsProp, drillDownLimit]);

  useEffect(() => {
    if (selectedStageId) {
      fetchStageLeads(selectedStageId, drillDownPage);
    } else {
      setInternalStageLeads(null);
    }
  }, [selectedStageId, drillDownPage, fetchStageLeads]);

  // Sorted stages by stage_order
  const sortedStages = useMemo(() => {
    if (!stages) return [];
    return [...stages].sort((a, b) => a.stage_order - b.stage_order);
  }, [stages]);

  // Currently selected stage metric
  const selectedStageMetric = useMemo(() => {
    if (!selectedStageId || !sortedStages) return null;
    return sortedStages.find((s) => s.stage_id === selectedStageId) || null;
  }, [selectedStageId, sortedStages]);

  // KPI Header Calculations
  const totalLeadsEntering = useMemo(() => {
    if (!sortedStages || sortedStages.length === 0) return 0;
    return sortedStages[0].lead_count || 0;
  }, [sortedStages]);

  const totalConvertedLeads = useMemo(() => {
    if (!sortedStages || sortedStages.length === 0) return 0;
    return sortedStages[sortedStages.length - 1].lead_count || 0;
  }, [sortedStages]);

  const overallConversionRate = useMemo(() => {
    if (totalLeadsEntering === 0) return 0;
    return (totalConvertedLeads / totalLeadsEntering) * 100;
  }, [totalLeadsEntering, totalConvertedLeads]);

  const bottleneckCount = useMemo(() => {
    if (!sortedStages) return 0;
    return sortedStages.filter(
      (s) => s.is_bottleneck || s.conversion_rate_percentage < s.target_conversion_rate
    ).length;
  }, [sortedStages]);

  const maxLeadCount = useMemo(() => {
    if (!sortedStages || sortedStages.length === 0) return 1;
    return Math.max(...sortedStages.map((s) => s.lead_count || 0), 1);
  }, [sortedStages]);

  // Handlers
  const handleStageClick = (stage: FunnelStageMetrics) => {
    const newSelectedId = selectedStageId === stage.stage_id ? null : stage.stage_id;
    if (selectedStageIdProp === undefined) {
      setInternalSelectedStageId(newSelectedId);
    }
    setDrillDownPage(1);
    if (onStageSelect) {
      onStageSelect(newSelectedId);
    }
    if (onStageClick) {
      onStageClick(stage);
    }
  };

  const handleClearStageSelection = () => {
    if (selectedStageIdProp === undefined) {
      setInternalSelectedStageId(null);
    }
    setDrillDownPage(1);
    if (onStageSelect) {
      onStageSelect(null);
    }
  };

  const handleFilterInputChange = (field: keyof ConversionFunnelFilterParams, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value ? value : undefined,
    }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    if (onFilterChange) {
      onFilterChange(filters);
    }
  };

  const handleResetFilters = () => {
    const emptyFilters: ConversionFunnelFilterParams = {};
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    if (onFilterChange) {
      onFilterChange(emptyFilters);
    }
  };

  const handleRefreshClick = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      fetchStages();
      if (selectedStageId) {
        fetchStageLeads(selectedStageId, drillDownPage);
      }
    }
  };

  // --- Render States ---

  if (isLoading) {
    return (
      <div
        className={`funnel-chart-container ${className}`}
        style={styles.container}
        data-testid={testId}
      >
        <div data-testid="funnel-loading" style={styles.loadingBox}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading conversion funnel analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`funnel-chart-container ${className}`}
        style={styles.container}
        data-testid={testId}
      >
        <div data-testid="funnel-error" style={styles.errorBox}>
          <h4 style={styles.errorTitle}>Error Loading Funnel Metrics</h4>
          <p style={styles.errorMessage}>{error}</p>
          <button
            onClick={handleRefreshClick}
            style={styles.primaryButton}
            data-testid="retry-btn"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`funnel-chart-container ${className}`}
      style={styles.container}
      data-testid={testId}
    >
      {/* Header & Title */}
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Conversion Funnel Analytics</h2>
          <p style={styles.subtitle}>
            Stage-by-stage lead progression, conversion rates, and operational bottleneck detection.
          </p>
        </div>
        <button
          onClick={handleRefreshClick}
          style={styles.secondaryButton}
          data-testid="refresh-funnel-btn"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filter Bar (FR-11) */}
      <div style={styles.filterBar} data-testid="funnel-filter-bar">
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel} htmlFor="funnel-start-date">
            Start Date
          </label>
          <input
            id="funnel-start-date"
            type="date"
            value={filters.start_timestamp || ''}
            onChange={(e) => handleFilterInputChange('start_timestamp', e.target.value)}
            style={styles.filterInput}
            data-testid="filter-start-date"
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel} htmlFor="funnel-end-date">
            End Date
          </label>
          <input
            id="funnel-end-date"
            type="date"
            value={filters.end_timestamp || ''}
            onChange={(e) => handleFilterInputChange('end_timestamp', e.target.value)}
            style={styles.filterInput}
            data-testid="filter-end-date"
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel} htmlFor="funnel-source-id">
            Lead Source
          </label>
          {availableSources.length > 0 ? (
            <select
              id="funnel-source-id"
              value={filters.source_id || ''}
              onChange={(e) => handleFilterInputChange('source_id', e.target.value)}
              style={styles.filterSelect}
              data-testid="filter-source"
            >
              <option value="">All Lead Sources</option>
              {availableSources.map((src) => (
                <option key={src.source_id} value={src.source_id}>
                  {src.source_name}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="funnel-source-id"
              type="text"
              placeholder="Source ID or Name"
              value={filters.source_id || ''}
              onChange={(e) => handleFilterInputChange('source_id', e.target.value)}
              style={styles.filterInput}
              data-testid="filter-source"
            />
          )}
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel} htmlFor="funnel-region-name">
            Region
          </label>
          {availableRegions.length > 0 ? (
            <select
              id="funnel-region-name"
              value={filters.region_name || ''}
              onChange={(e) => handleFilterInputChange('region_name', e.target.value)}
              style={styles.filterSelect}
              data-testid="filter-region"
            >
              <option value="">All Regions</option>
              {availableRegions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="funnel-region-name"
              type="text"
              placeholder="e.g. North America"
              value={filters.region_name || ''}
              onChange={(e) => handleFilterInputChange('region_name', e.target.value)}
              style={styles.filterInput}
              data-testid="filter-region"
            />
          )}
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel} htmlFor="funnel-campaign-id">
            Campaign
          </label>
          {availableCampaigns.length > 0 ? (
            <select
              id="funnel-campaign-id"
              value={filters.campaign_id || ''}
              onChange={(e) => handleFilterInputChange('campaign_id', e.target.value)}
              style={styles.filterSelect}
              data-testid="filter-campaign"
            >
              <option value="">All Campaigns</option>
              {availableCampaigns.map((camp) => (
                <option key={camp.campaign_id} value={camp.campaign_id}>
                  {camp.campaign_name}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="funnel-campaign-id"
              type="text"
              placeholder="Campaign ID or Name"
              value={filters.campaign_id || ''}
              onChange={(e) => handleFilterInputChange('campaign_id', e.target.value)}
              style={styles.filterInput}
              data-testid="filter-campaign"
            />
          )}
        </div>

        <div style={styles.filterActions}>
          <button
            onClick={handleApplyFilters}
            style={styles.primaryButton}
            data-testid="apply-filters-btn"
          >
            Apply Filters
          </button>
          <button
            onClick={handleResetFilters}
            style={styles.ghostButton}
            data-testid="reset-filters-btn"
          >
            Reset
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div style={styles.kpiGrid} data-testid="funnel-summary-kpis">
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Total Leads Entering</span>
          <span style={styles.kpiValue} data-testid="summary-entering-leads">
            {totalLeadsEntering}
          </span>
          <span style={styles.kpiSubtext}>Initial stage volume</span>
        </div>

        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Converted Leads</span>
          <span style={styles.kpiValue} data-testid="summary-converted-leads">
            {totalConvertedLeads}
          </span>
          <span style={styles.kpiSubtext}>Final stage conversions</span>
        </div>

        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Overall Funnel Conversion</span>
          <span style={styles.kpiValue} data-testid="summary-overall-conversion">
            {formatPercentage(overallConversionRate)}
          </span>
          <span style={styles.kpiSubtext}>Initial to final conversion</span>
        </div>

        <div style={{ ...styles.kpiCard, ...(bottleneckCount > 0 ? styles.kpiWarningCard : {}) }}>
          <span style={styles.kpiLabel}>Detected Bottlenecks</span>
          <span
            style={{
              ...styles.kpiValue,
              color: bottleneckCount > 0 ? 'var(--color-secondary, #a43b2c)' : 'var(--color-primary, #59452b)',
            }}
            data-testid="summary-bottleneck-count"
          >
            {bottleneckCount}
          </span>
          <span style={styles.kpiSubtext}>
            {bottleneckCount > 0 ? 'Stages below target rate' : 'All stages on target'}
          </span>
        </div>
      </div>

      {/* Funnel Stage Visualization List (FR-3 & FR-4) */}
      {!sortedStages || sortedStages.length === 0 ? (
        <div style={styles.emptyBox} data-testid="funnel-empty">
          <h4 style={styles.emptyTitle}>No Funnel Stage Data</h4>
          <p style={styles.emptyText}>
            No conversion funnel stages are configured or matching the selected filters.
          </p>
        </div>
      ) : (
        <div style={styles.funnelListContainer} data-testid="funnel-stages-list">
          {sortedStages.map((stage, idx) => {
            const isSelected = selectedStageId === stage.stage_id;
            const widthPct = Math.max(15, Math.min(100, (stage.lead_count / maxLeadCount) * 100));
            const bottleneckInfo = getBottleneckDetails(stage);

            return (
              <React.Fragment key={stage.stage_id}>
                {/* Inter-stage transition connector */}
                {idx > 0 && (
                  <div style={styles.transitionConnector} data-testid={`transition-${stage.stage_id}`}>
                    <div style={styles.transitionLine}></div>
                    <span style={styles.transitionBadge}>
                      ↓ Stage Conversion: {formatPercentage(stage.conversion_rate_percentage)}
                    </span>
                  </div>
                )}

                {/* Stage Item */}
                <div
                  style={{
                    ...styles.stageCard,
                    ...(bottleneckInfo.isBottleneck ? styles.stageCardBottleneck : {}),
                    ...(isSelected ? styles.stageCardSelected : {}),
                  }}
                  onClick={() => handleStageClick(stage)}
                  data-testid={`funnel-stage-item-${stage.stage_id}`}
                  data-selected={isSelected ? 'true' : 'false'}
                  data-bottleneck={bottleneckInfo.isBottleneck ? 'true' : 'false'}
                >
                  <div style={styles.stageHeader}>
                    <div style={styles.stageTitleGroup}>
                      <span style={styles.stageStepBadge}>Step {stage.stage_order}</span>
                      <h3 style={styles.stageName}>{stage.stage_name}</h3>
                    </div>

                    <div style={styles.stageBadges}>
                      {bottleneckInfo.isBottleneck ? (
                        <span
                          style={styles.bottleneckBadge}
                          data-testid={`bottleneck-badge-${stage.stage_id}`}
                        >
                          ⚠ Bottleneck ({formatPercentage(stage.conversion_rate_percentage)} / Target:{' '}
                          {formatPercentage(stage.target_conversion_rate)})
                        </span>
                      ) : (
                        <span
                          style={styles.healthyBadge}
                          data-testid={`target-badge-${stage.stage_id}`}
                        >
                          ✓ On Target ({formatPercentage(stage.conversion_rate_percentage)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stage Metrics Bar */}
                  <div style={styles.barWrapper}>
                    <div
                      style={{
                        ...styles.barFill,
                        width: `${widthPct}%`,
                        backgroundColor: bottleneckInfo.isBottleneck
                          ? 'var(--color-secondary, #a43b2c)'
                          : 'var(--color-primary, #59452b)',
                      }}
                    >
                      <span style={styles.barLabel}>{stage.lead_count} Leads</span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div style={styles.stageMetricsGrid}>
                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Lead Count</span>
                      <span style={styles.metricValue}>{stage.lead_count}</span>
                    </div>

                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Actual Conversion Rate</span>
                      <span
                        style={{
                          ...styles.metricValue,
                          color: bottleneckInfo.isBottleneck ? '#a43b2c' : '#2e6b38',
                        }}
                      >
                        {formatPercentage(stage.conversion_rate_percentage)}
                      </span>
                    </div>

                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Target Conversion Rate</span>
                      <span style={styles.metricValue}>{formatPercentage(stage.target_conversion_rate)}</span>
                    </div>

                    <div style={styles.metricItem}>
                      <span style={styles.metricLabel}>Performance Gap</span>
                      <span
                        style={{
                          ...styles.metricValue,
                          color: bottleneckInfo.isBottleneck ? '#a43b2c' : '#2e6b38',
                        }}
                      >
                        {bottleneckInfo.gap > 0
                          ? `-${formatPercentage(bottleneckInfo.gap)}`
                          : `+${formatPercentage(Math.abs(bottleneckInfo.gap))}`}
                      </span>
                    </div>
                  </div>

                  <div style={styles.stageFooter}>
                    <span style={styles.clickHint}>
                      {isSelected ? '✓ Currently Selected (Click to Close Drill-down)' : 'Click to drill down into leads →'}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Stage Drill-Down Lead Details Panel (FR-5) */}
      {selectedStageId && (
        <div style={styles.drilldownPanel} data-testid="stage-drilldown-panel">
          <div style={styles.drilldownHeader}>
            <div>
              <h3 style={styles.drilldownTitle}>
                Stage Drill-Down:{' '}
                {selectedStageMetric?.stage_name || selectedStageId}
              </h3>
              <p style={styles.drilldownSubtitle}>
                Showing individual lead records and stage progression history.
              </p>
            </div>
            <button
              onClick={handleClearStageSelection}
              style={styles.ghostButton}
              data-testid="clear-stage-filter"
            >
              ✕ Close Drill-down
            </button>
          </div>

          {isDrillDownLoading ? (
            <div style={styles.loadingBox} data-testid="drilldown-loading">
              <div style={styles.spinner}></div>
              <p style={styles.loadingText}>Fetching stage lead details...</p>
            </div>
          ) : !stageLeads || !stageLeads.leads || stageLeads.leads.length === 0 ? (
            <div style={styles.emptyBox} data-testid="drilldown-empty">
              <p style={styles.emptyText}>No leads currently found in this stage.</p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table} data-testid="drilldown-lead-list">
                <thead>
                  <tr>
                    <th style={styles.th}>Lead ID</th>
                    <th style={styles.th}>Quality Score</th>
                    <th style={styles.th}>Deal Value</th>
                    <th style={styles.th}>Time in Stage</th>
                    <th style={styles.th}>Region / State</th>
                    <th style={styles.th}>Created Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {stageLeads.leads.map((lead: StageLeadDetail) => {
                    const qualityBadge = getQualityBadge(lead.quality_score);
                    return (
                      <tr
                        key={lead.lead_id}
                        onClick={() => onLeadClick && onLeadClick(lead.lead_id)}
                        style={styles.tr}
                        data-testid={`lead-item-${lead.lead_id}`}
                      >
                        <td style={styles.tdBold}>{lead.lead_id}</td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              backgroundColor: qualityBadge.badgeBg,
                              color: qualityBadge.color,
                            }}
                          >
                            {lead.quality_score} ({qualityBadge.label})
                          </span>
                        </td>
                        <td style={styles.td}>{formatCurrency(lead.deal_value)}</td>
                        <td style={styles.td}>{formatDays(lead.time_in_stage_days)}</td>
                        <td style={styles.td}>
                          {lead.region_name || 'Unmapped'}
                          {lead.state_code ? `, ${lead.state_code}` : ''}
                        </td>
                        <td style={styles.td}>
                          {lead.created_timestamp
                            ? new Date(lead.created_timestamp).toLocaleDateString()
                            : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination Bar */}
              <div style={styles.paginationBar}>
                <span style={styles.paginationInfo} data-testid="drilldown-page-info">
                  Showing page {stageLeads.page} of{' '}
                  {Math.ceil(stageLeads.total_leads / stageLeads.limit) || 1} ({stageLeads.total_leads} total leads)
                </span>
                <div style={styles.paginationButtons}>
                  <button
                    disabled={drillDownPage <= 1}
                    onClick={() => setDrillDownPage((p) => Math.max(1, p - 1))}
                    style={{
                      ...styles.secondaryButton,
                      opacity: drillDownPage <= 1 ? 0.5 : 1,
                    }}
                    data-testid="drilldown-prev-page"
                  >
                    ← Previous
                  </button>
                  <button
                    disabled={
                      drillDownPage >= Math.ceil(stageLeads.total_leads / stageLeads.limit)
                    }
                    onClick={() => setDrillDownPage((p) => p + 1)}
                    style={{
                      ...styles.secondaryButton,
                      opacity:
                        drillDownPage >= Math.ceil(stageLeads.total_leads / stageLeads.limit)
                          ? 0.5
                          : 1,
                    }}
                    data-testid="drilldown-next-page"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FunnelChart;

/**
 * Styling constants following "Linen & Logic" design system principles.
 */
const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: 'var(--color-surface, #fbf9f4)',
    color: 'var(--color-on-surface, #1b1c19)',
    borderRadius: '0.375rem',
    border: '1px solid var(--color-outline-variant, #d1c4b9)',
    padding: '1.5rem',
    fontFamily: 'DM Sans, sans-serif',
    boxShadow: '0 4px 20px rgba(115, 92, 65, 0.05)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
  },
  title: {
    fontFamily: 'Libre Caslon Text, serif',
    fontSize: '1.75rem',
    fontWeight: 400,
    color: 'var(--color-primary, #59452b)',
    margin: 0,
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--color-on-surface-variant, #4e453d)',
    margin: '0.25rem 0 0 0',
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    alignItems: 'flex-end',
    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
    padding: '1rem',
    borderRadius: '0.25rem',
    border: '1px solid var(--color-outline-variant, #d1c4b9)',
    marginBottom: '1.5rem',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    flex: '1 1 140px',
    minWidth: '130px',
  },
  filterLabel: {
    fontSize: '0.75rem',
    fontWeight: 500,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--color-on-surface-variant, #4e453d)',
  },
  filterInput: {
    padding: '0.5rem 0.75rem',
    borderRadius: '0.25rem',
    border: '1px solid var(--color-outline, #80756b)',
    backgroundColor: '#ffffff',
    fontSize: '0.875rem',
    color: '#1b1c19',
    outline: 'none',
  },
  filterSelect: {
    padding: '0.5rem 0.75rem',
    borderRadius: '0.25rem',
    border: '1px solid var(--color-outline, #80756b)',
    backgroundColor: '#ffffff',
    fontSize: '0.875rem',
    color: '#1b1c19',
    outline: 'none',
  },
  filterActions: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  primaryButton: {
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--color-primary, #59452b)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.25rem',
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  secondaryButton: {
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
    color: 'var(--color-primary, #59452b)',
    border: '1px solid var(--color-outline-variant, #d1c4b9)',
    borderRadius: '0.25rem',
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  ghostButton: {
    padding: '0.5rem 0.75rem',
    backgroundColor: 'transparent',
    color: 'var(--color-on-surface-variant, #4e453d)',
    border: 'none',
    borderRadius: '0.25rem',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  kpiCard: {
    backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
    border: '1px solid var(--color-outline-variant, #d1c4b9)',
    borderRadius: '0.25rem',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  kpiWarningCard: {
    borderColor: 'var(--color-secondary, #a43b2c)',
    backgroundColor: 'var(--color-trend-down-bg, #fdf0ed)',
  },
  kpiLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-on-surface-variant, #4e453d)',
  },
  kpiValue: {
    fontFamily: 'Libre Caslon Text, serif',
    fontSize: '1.5rem',
    fontWeight: 500,
    color: 'var(--color-primary, #59452b)',
  },
  kpiSubtext: {
    fontSize: '0.75rem',
    color: 'var(--color-on-surface-variant, #80756b)',
  },
  funnelListContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  transitionConnector: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: '0.25rem 0',
  },
  transitionLine: {
    position: 'absolute',
    top: '50%',
    left: '10%',
    right: '10%',
    height: '1px',
    backgroundColor: 'var(--color-outline-variant, #d1c4b9)',
    zIndex: 1,
  },
  transitionBadge: {
    position: 'relative',
    zIndex: 2,
    backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
    color: 'var(--color-on-surface-variant, #4e453d)',
    fontSize: '0.75rem',
    padding: '0.125rem 0.625rem',
    borderRadius: '9999px',
    border: '1px solid var(--color-outline-variant, #d1c4b9)',
  },
  stageCard: {
    backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
    border: '1px solid var(--color-outline-variant, #d1c4b9)',
    borderRadius: '0.375rem',
    padding: '1.25rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
  },
  stageCardBottleneck: {
    borderLeft: '6px solid var(--color-secondary, #a43b2c)',
    backgroundColor: '#fffdfb',
  },
  stageCardSelected: {
    boxShadow: '0 0 0 2px var(--color-primary, #59452b)',
    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
  },
  stageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  stageTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  stageStepBadge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#ffffff',
    backgroundColor: 'var(--color-primary, #59452b)',
    padding: '0.125rem 0.5rem',
    borderRadius: '0.125rem',
  },
  stageName: {
    fontFamily: 'Libre Caslon Text, serif',
    fontSize: '1.125rem',
    fontWeight: 500,
    margin: 0,
    color: 'var(--color-on-surface, #1b1c19)',
  },
  stageBadges: {
    display: 'flex',
    gap: '0.5rem',
  },
  bottleneckBadge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-secondary, #a43b2c)',
    backgroundColor: 'var(--color-trend-down-bg, #fdf0ed)',
    padding: '0.25rem 0.625rem',
    borderRadius: '0.25rem',
    border: '1px solid var(--color-secondary, #a43b2c)',
  },
  healthyBadge: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--color-trend-up, #2e6b38)',
    backgroundColor: 'var(--color-trend-up-bg, #e8f5e9)',
    padding: '0.25rem 0.625rem',
    borderRadius: '0.25rem',
  },
  barWrapper: {
    width: '100%',
    height: '1.75rem',
    backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
    borderRadius: '0.25rem',
    overflow: 'hidden',
    marginBottom: '0.75rem',
  },
  barFill: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '0.75rem',
    color: '#ffffff',
    fontSize: '0.75rem',
    fontWeight: 600,
    transition: 'width 0.4s ease',
  },
  barLabel: {
    whiteSpace: 'nowrap',
  },
  stageMetricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '0.75rem',
    paddingTop: '0.5rem',
    borderTop: '1px solid var(--color-surface-container-high, #eae8e3)',
  },
  metricItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  metricLabel: {
    fontSize: '0.75rem',
    color: 'var(--color-on-surface-variant, #80756b)',
  },
  metricValue: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--color-on-surface, #1b1c19)',
  },
  stageFooter: {
    marginTop: '0.5rem',
    textAlign: 'right',
  },
  clickHint: {
    fontSize: '0.75rem',
    color: 'var(--color-primary, #59452b)',
    fontWeight: 500,
  },
  drilldownPanel: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--color-primary, #59452b)',
    borderRadius: '0.375rem',
    padding: '1.25rem',
    marginTop: '1.5rem',
    boxShadow: '0 4px 12px rgba(89, 69, 43, 0.1)',
  },
  drilldownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem',
  },
  drilldownTitle: {
    fontFamily: 'Libre Caslon Text, serif',
    fontSize: '1.25rem',
    margin: 0,
    color: 'var(--color-primary, #59452b)',
  },
  drilldownSubtitle: {
    fontSize: '0.875rem',
    color: 'var(--color-on-surface-variant, #4e453d)',
    margin: '0.25rem 0 0 0',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.625rem 0.75rem',
    borderBottom: '2px solid var(--color-outline-variant, #d1c4b9)',
    fontWeight: 600,
    color: 'var(--color-on-surface-variant, #4e453d)',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
  },
  tr: {
    borderBottom: '1px solid var(--color-surface-container-high, #eae8e3)',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  td: {
    padding: '0.625rem 0.75rem',
    color: 'var(--color-on-surface, #1b1c19)',
  },
  tdBold: {
    padding: '0.625rem 0.75rem',
    fontWeight: 600,
    color: 'var(--color-primary, #59452b)',
  },
  badge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: '0.125rem',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  paginationBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '1rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid var(--color-surface-container-high, #eae8e3)',
  },
  paginationInfo: {
    fontSize: '0.75rem',
    color: 'var(--color-on-surface-variant, #80756b)',
  },
  paginationButtons: {
    display: 'flex',
    gap: '0.5rem',
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 1rem',
    gap: '0.75rem',
  },
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid var(--color-surface-container-high, #eae8e3)',
    borderTop: '3px solid var(--color-primary, #59452b)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '0.875rem',
    color: 'var(--color-on-surface-variant, #4e453d)',
  },
  errorBox: {
    padding: '2rem',
    textAlign: 'center',
    backgroundColor: 'var(--color-trend-down-bg, #fdf0ed)',
    border: '1px solid var(--color-secondary, #a43b2c)',
    borderRadius: '0.375rem',
  },
  errorTitle: {
    margin: '0 0 0.5rem 0',
    color: 'var(--color-secondary, #a43b2c)',
  },
  errorMessage: {
    fontSize: '0.875rem',
    color: '#1b1c19',
    marginBottom: '1rem',
  },
  emptyBox: {
    padding: '2rem',
    textAlign: 'center',
    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
    borderRadius: '0.25rem',
    border: '1px solid var(--color-outline-variant, #d1c4b9)',
  },
  emptyTitle: {
    margin: '0 0 0.5rem 0',
    color: 'var(--color-primary, #59452b)',
  },
  emptyText: {
    fontSize: '0.875rem',
    color: 'var(--color-on-surface-variant, #4e453d)',
    margin: 0,
  },
};
