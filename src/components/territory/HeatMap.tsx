'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TerritoryDensityMetrics,
  TerritoryFilterParams,
  getTerritoryHeatmap,
  getUnmappedTerritory,
} from '../../services/api_client';

export interface TerritoryHeatMapFilterParams extends TerritoryFilterParams {
  start_date?: string;
  end_date?: string;
  campaign_id?: string;
}

export interface HeatMapProps {
  /** Array of territory density metrics. If omitted/null, component fetches via API */
  data?: TerritoryDensityMetrics[] | null;
  /** Unmapped region metric. If omitted/null, component fetches via API */
  unmappedData?: TerritoryDensityMetrics | null;
  /** Currently selected region name for detail focus */
  selectedRegion?: string | null;
  /** Initial filter parameter values */
  initialFilters?: TerritoryHeatMapFilterParams;
  /** Callback fired whenever user applies filter changes */
  onFilterChange?: (filters: TerritoryHeatMapFilterParams) => void;
  /** Callback fired when a region is selected or deselected */
  onRegionSelect?: (regionName: string | null) => void;
  /** Callback fired when a region node or card is clicked */
  onRegionClick?: (metric: TerritoryDensityMetrics) => void;
  /** Loading state indicator override for territory heatmap */
  isLoading?: boolean;
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
  /** Flag to toggle visibility of the unmapped region section */
  showUnmappedCard?: boolean;
}

/**
 * Format numerical density or percentage values into string (e.g. 24.5%).
 */
export function formatPercentage(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) {
    return '0.0%';
  }
  return `${val.toFixed(1)}%`;
}

/**
 * Format currency values into USD formatted string ($12,500).
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
 * Format integer or decimal numbers with thousand separators.
 */
export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Density tier color mapping and badge generator based on density score percentage.
 */
export function getDensityTier(densityScore: number): {
  label: string;
  color: string;
  badgeBg: string;
  borderColor: string;
  tier: 'high' | 'medium' | 'low' | 'unmapped';
} {
  if (densityScore >= 25.0) {
    return {
      label: 'High Density',
      color: 'var(--color-secondary, #a43b2c)',
      badgeBg: '#fdf0ed',
      borderColor: '#f5c6cb',
      tier: 'high',
    };
  }
  if (densityScore >= 10.0) {
    return {
      label: 'Medium Density',
      color: 'var(--color-primary, #59452b)',
      badgeBg: '#f5d6b4',
      borderColor: '#e8c29b',
      tier: 'medium',
    };
  }
  if (densityScore > 0.0) {
    return {
      label: 'Low Density',
      color: '#374a5f',
      badgeBg: '#caddf8',
      borderColor: '#b4c8e2',
      tier: 'low',
    };
  }
  return {
    label: 'Unmapped / Zero',
    color: '#80756b',
    badgeBg: '#e4e2dd',
    borderColor: '#d1c4b9',
    tier: 'unmapped',
  };
}

/**
 * Quality score tier helper.
 */
export function getQualityTier(score: number): {
  label: string;
  color: string;
  bg: string;
} {
  if (score >= 70) {
    return {
      label: 'High Quality',
      color: 'var(--color-trend-up, #2e6b38)',
      bg: 'var(--color-trend-up-bg, #e8f5e9)',
    };
  }
  if (score >= 40) {
    return {
      label: 'Moderate',
      color: '#735c41',
      bg: '#f5f3ee',
    };
  }
  return {
    label: 'Low Quality',
    color: 'var(--color-trend-down, #a43b2c)',
    bg: 'var(--color-trend-down-bg, #fdf0ed)',
  };
}

/**
 * Normalize longitude (-180 to 180) to SVG canvas X coordinate (0 to 100%).
 */
export function projectLongitudeToX(lng: number): number {
  // World bounds roughly -170 to 180 -> map to 5% to 95%
  const clamped = Math.max(-170, Math.min(180, lng));
  return 5 + ((clamped + 170) / 350) * 90;
}

/**
 * Normalize latitude (-90 to 90) to SVG canvas Y coordinate (0 to 100%).
 * Note: Map SVG Y increases downwards.
 */
export function projectLatitudeToY(lat: number): number {
  // World bounds roughly -60 to 85 -> map to 90% to 10%
  const clamped = Math.max(-60, Math.min(85, lat));
  return 90 - ((clamped + 60) / 145) * 80;
}

export const HeatMap: React.FC<HeatMapProps> = ({
  data: propsData,
  unmappedData: propsUnmappedData,
  selectedRegion: propsSelectedRegion,
  initialFilters = {},
  onFilterChange,
  onRegionSelect,
  onRegionClick,
  isLoading: propsIsLoading = false,
  error: propsError = null,
  onRefresh,
  className = '',
  'data-testid': testId = 'territory-heatmap',
  availableSources = [],
  availableCampaigns = [],
  availableRegions = [],
  showUnmappedCard = true,
}) => {
  // State management
  const [internalData, setInternalData] = useState<TerritoryDensityMetrics[] | null>(null);
  const [internalUnmapped, setInternalUnmapped] = useState<TerritoryDensityMetrics | null>(null);
  const [internalIsLoading, setInternalIsLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Active view toggle: 'map' | 'cards' | 'table'
  const [activeViewMode, setActiveViewMode] = useState<'map' | 'cards' | 'table'>('map');

  // Selected region
  const [activeSelectedRegion, setActiveSelectedRegion] = useState<string | null>(
    propsSelectedRegion || null
  );

  // Filter form state
  const [filterRegion, setFilterRegion] = useState<string>(initialFilters.region_name || '');
  const [filterMinDealSize, setFilterMinDealSize] = useState<string>(
    initialFilters.min_deal_size !== undefined ? String(initialFilters.min_deal_size) : ''
  );
  const [filterMinQualityScore, setFilterMinQualityScore] = useState<string>(
    initialFilters.min_quality_score !== undefined ? String(initialFilters.min_quality_score) : ''
  );
  const [filterStartDate, setFilterStartDate] = useState<string>(initialFilters.start_date || '');
  const [filterEndDate, setFilterEndDate] = useState<string>(initialFilters.end_date || '');
  const [filterSourceId, setFilterSourceId] = useState<string>(initialFilters.source_id || '');
  const [filterCampaignId, setFilterCampaignId] = useState<string>(initialFilters.campaign_id || '');

  // Hovered hotspot node for map tooltips
  const [hoveredMetric, setHoveredMetric] = useState<TerritoryDensityMetrics | null>(null);

  // Sync prop selected region if changed externally
  useEffect(() => {
    if (propsSelectedRegion !== undefined) {
      setActiveSelectedRegion(propsSelectedRegion);
    }
  }, [propsSelectedRegion]);

  // Fetch territory density metrics from API if data prop not provided
  const fetchHeatmapData = useCallback(async () => {
    if (propsData !== undefined && propsData !== null) {
      return; // Handled by prop
    }
    setInternalIsLoading(true);
    setInternalError(null);
    try {
      const apiParams: TerritoryFilterParams = {};
      if (filterRegion.trim()) apiParams.region_name = filterRegion.trim();
      if (filterMinDealSize && !isNaN(Number(filterMinDealSize))) {
        apiParams.min_deal_size = Number(filterMinDealSize);
      }
      if (filterMinQualityScore && !isNaN(Number(filterMinQualityScore))) {
        apiParams.min_quality_score = Number(filterMinQualityScore);
      }
      if (filterStartDate) {
        apiParams.start_timestamp = new Date(filterStartDate).toISOString();
      }
      if (filterEndDate) {
        apiParams.end_timestamp = new Date(filterEndDate).toISOString();
      }
      if (filterSourceId) {
        apiParams.source_id = filterSourceId;
      }

      const [heatmapResult, unmappedResult] = await Promise.all([
        getTerritoryHeatmap(apiParams),
        getUnmappedTerritory().catch(() => null),
      ]);

      setInternalData(heatmapResult);
      if (unmappedResult) {
        setInternalUnmapped(unmappedResult);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load territory heatmap metrics';
      setInternalError(errorMsg);
    } finally {
      setInternalIsLoading(false);
    }
  }, [
    propsData,
    filterRegion,
    filterMinDealSize,
    filterMinQualityScore,
    filterStartDate,
    filterEndDate,
    filterSourceId,
  ]);

  useEffect(() => {
    fetchHeatmapData();
  }, [fetchHeatmapData]);

  // Resolve active dataset and status
  const effectiveData = propsData !== undefined && propsData !== null ? propsData : internalData;
  const effectiveUnmapped =
    propsUnmappedData !== undefined && propsUnmappedData !== null
      ? propsUnmappedData
      : internalUnmapped;
  const effectiveIsLoading = propsIsLoading || internalIsLoading;
  const effectiveError = propsError || internalError;

  // Filter application handler
  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updatedFilters: TerritoryHeatMapFilterParams = {};
    if (filterRegion.trim()) updatedFilters.region_name = filterRegion.trim();
    if (filterMinDealSize !== '' && !isNaN(Number(filterMinDealSize))) {
      updatedFilters.min_deal_size = Number(filterMinDealSize);
    }
    if (filterMinQualityScore !== '' && !isNaN(Number(filterMinQualityScore))) {
      updatedFilters.min_quality_score = Number(filterMinQualityScore);
    }
    if (filterStartDate) updatedFilters.start_date = filterStartDate;
    if (filterEndDate) updatedFilters.end_date = filterEndDate;
    if (filterSourceId) updatedFilters.source_id = filterSourceId;
    if (filterCampaignId) updatedFilters.campaign_id = filterCampaignId;

    if (onFilterChange) {
      onFilterChange(updatedFilters);
    }
    fetchHeatmapData();
  };

  // Filter reset handler
  const handleResetFilters = () => {
    setFilterRegion('');
    setFilterMinDealSize('');
    setFilterMinQualityScore('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterSourceId('');
    setFilterCampaignId('');

    if (onFilterChange) {
      onFilterChange({});
    }
    if (onRegionSelect) {
      onRegionSelect(null);
    }
    setActiveSelectedRegion(null);
  };

  // Region selection handler
  const handleSelectRegion = (metric: TerritoryDensityMetrics | null) => {
    const regionName = metric ? metric.region_name : null;
    setActiveSelectedRegion(regionName);
    if (onRegionSelect) {
      onRegionSelect(regionName);
    }
    if (metric && onRegionClick) {
      onRegionClick(metric);
    }
  };

  // Aggregate metrics calculation
  const summaryMetrics = useMemo(() => {
    if (!effectiveData || effectiveData.length === 0) {
      return {
        totalOpportunities: effectiveUnmapped?.opportunity_count || 0,
        totalDealValue: effectiveUnmapped?.total_deal_value || 0,
        averageQualityScore: effectiveUnmapped?.average_quality_score || 0,
        mappedRegionCount: 0,
        highestDensityRegion: null as TerritoryDensityMetrics | null,
      };
    }

    let opps = 0;
    let dealValue = 0;
    let qualitySum = 0;
    let highestDensity: TerritoryDensityMetrics | null = null;

    effectiveData.forEach((m) => {
      opps += m.opportunity_count;
      dealValue += m.total_deal_value;
      qualitySum += m.average_quality_score * m.opportunity_count;
      if (!highestDensity || m.density_score > highestDensity.density_score) {
        highestDensity = m;
      }
    });

    const avgQuality = opps > 0 ? qualitySum / opps : 0;

    return {
      totalOpportunities: opps + (effectiveUnmapped?.opportunity_count || 0),
      totalDealValue: dealValue + (effectiveUnmapped?.total_deal_value || 0),
      averageQualityScore: avgQuality,
      mappedRegionCount: effectiveData.length,
      highestDensityRegion: highestDensity,
    };
  }, [effectiveData, effectiveUnmapped]);

  // Selected region detail object
  const activeSelectedMetric = useMemo(() => {
    if (!activeSelectedRegion || !effectiveData) return null;
    if (effectiveUnmapped && effectiveUnmapped.region_name === activeSelectedRegion) {
      return effectiveUnmapped;
    }
    return effectiveData.find((m) => m.region_name === activeSelectedRegion) || null;
  }, [activeSelectedRegion, effectiveData, effectiveUnmapped]);

  return (
    <div
      data-testid={testId}
      className={`territory-heatmap-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-gutter, 24px)',
        width: '100%',
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
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
          paddingBottom: '16px',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '12px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-primary, #59452b)',
            }}
          >
            Geographic Territory Intelligence
          </span>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '28px',
              fontWeight: '400',
              margin: '4px 0 0 0',
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            Regional Opportunity Heat Map
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              margin: '4px 0 0 0',
            }}
          >
            Visualize lead density, deal value concentration, and geographic opportunity distribution across territories.
          </p>
        </div>

        {/* View mode toggle and refresh button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: 'var(--color-surface-container, #f0eee9)',
              borderRadius: 'var(--radius-default, 0.25rem)',
              padding: '2px',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
          >
            <button
              type="button"
              data-testid="heatmap-view-map-btn"
              onClick={() => setActiveViewMode('map')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: '500',
                border: 'none',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                backgroundColor:
                  activeViewMode === 'map' ? 'var(--color-primary, #59452b)' : 'transparent',
                color: activeViewMode === 'map' ? '#ffffff' : 'var(--color-on-surface-variant, #4e453d)',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              Map Canvas
            </button>
            <button
              type="button"
              data-testid="heatmap-view-cards-btn"
              onClick={() => setActiveViewMode('cards')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: '500',
                border: 'none',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                backgroundColor:
                  activeViewMode === 'cards' ? 'var(--color-primary, #59452b)' : 'transparent',
                color: activeViewMode === 'cards' ? '#ffffff' : 'var(--color-on-surface-variant, #4e453d)',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              Region Cards
            </button>
            <button
              type="button"
              data-testid="heatmap-view-table-btn"
              onClick={() => setActiveViewMode('table')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: '500',
                border: 'none',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                backgroundColor:
                  activeViewMode === 'table' ? 'var(--color-primary, #59452b)' : 'transparent',
                color: activeViewMode === 'table' ? '#ffffff' : 'var(--color-on-surface-variant, #4e453d)',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              Data Table
            </button>
          </div>

          {(onRefresh || true) && (
            <button
              type="button"
              data-testid="heatmap-refresh-btn"
              onClick={() => {
                if (onRefresh) onRefresh();
                fetchHeatmapData();
              }}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '500',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                color: 'var(--color-primary, #59452b)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-default, 0.25rem)',
                cursor: 'pointer',
              }}
            >
              Refresh Data
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls Bar (FR-9, FR-11) */}
      <form
        data-testid="heatmap-filter-form"
        onSubmit={handleApplyFilters}
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
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-on-surface-variant, #4e453d)',
          }}
        >
          Territory & Report Filter Controls (FR-9, FR-11)
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          {/* Geographic Region Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="filter-region-name"
              style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}
            >
              Region Name
            </label>
            {availableRegions.length > 0 ? (
              <select
                id="filter-region-name"
                data-testid="filter-region-select"
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                style={{
                  padding: '8px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-default, 0.25rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="">All Regions</option>
                {availableRegions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="filter-region-name"
                data-testid="filter-region-input"
                type="text"
                placeholder="e.g. North America"
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                style={{
                  padding: '8px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-default, 0.25rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: '#ffffff',
                }}
              />
            )}
          </div>

          {/* Min Deal Size Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="filter-min-deal-size"
              style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}
            >
              Min Deal Size ($)
            </label>
            <input
              id="filter-min-deal-size"
              data-testid="filter-min-deal-input"
              type="number"
              min="0"
              step="1000"
              placeholder="e.g. 10000"
              value={filterMinDealSize}
              onChange={(e) => setFilterMinDealSize(e.target.value)}
              style={{
                padding: '8px',
                fontSize: '13px',
                borderRadius: 'var(--radius-default, 0.25rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: '#ffffff',
              }}
            />
          </div>

          {/* Min Quality Score Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="filter-min-quality-score"
              style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}
            >
              Min Quality Score (0-100)
            </label>
            <input
              id="filter-min-quality-score"
              data-testid="filter-min-quality-input"
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 50"
              value={filterMinQualityScore}
              onChange={(e) => setFilterMinQualityScore(e.target.value)}
              style={{
                padding: '8px',
                fontSize: '13px',
                borderRadius: 'var(--radius-default, 0.25rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: '#ffffff',
              }}
            />
          </div>

          {/* Start Date Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="filter-start-date"
              style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}
            >
              Start Date
            </label>
            <input
              id="filter-start-date"
              data-testid="filter-start-date-input"
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              style={{
                padding: '8px',
                fontSize: '13px',
                borderRadius: 'var(--radius-default, 0.25rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: '#ffffff',
              }}
            />
          </div>

          {/* End Date Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="filter-end-date"
              style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}
            >
              End Date
            </label>
            <input
              id="filter-end-date"
              data-testid="filter-end-date-input"
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              style={{
                padding: '8px',
                fontSize: '13px',
                borderRadius: 'var(--radius-default, 0.25rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: '#ffffff',
              }}
            />
          </div>

          {/* Lead Source Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="filter-lead-source"
              style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}
            >
              Lead Source
            </label>
            <select
              id="filter-lead-source"
              data-testid="filter-lead-source-select"
              value={filterSourceId}
              onChange={(e) => setFilterSourceId(e.target.value)}
              style={{
                padding: '8px',
                fontSize: '13px',
                borderRadius: 'var(--radius-default, 0.25rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Sources</option>
              {availableSources.map((s) => (
                <option key={s.source_id} value={s.source_id}>
                  {s.source_name}
                </option>
              ))}
            </select>
          </div>

          {/* Campaign Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="filter-campaign"
              style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}
            >
              Campaign
            </label>
            <select
              id="filter-campaign"
              data-testid="filter-campaign-select"
              value={filterCampaignId}
              onChange={(e) => setFilterCampaignId(e.target.value)}
              style={{
                padding: '8px',
                fontSize: '13px',
                borderRadius: 'var(--radius-default, 0.25rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Campaigns</option>
              {availableCampaigns.map((c) => (
                <option key={c.campaign_id} value={c.campaign_id}>
                  {c.campaign_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="button"
            data-testid="heatmap-reset-filters-btn"
            onClick={handleResetFilters}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              backgroundColor: 'transparent',
              color: 'var(--color-on-surface-variant, #4e453d)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-default, 0.25rem)',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
          <button
            type="submit"
            data-testid="heatmap-apply-filters-btn"
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: 'var(--color-primary, #59452b)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-default, 0.25rem)',
              cursor: 'pointer',
            }}
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Aggregate KPI Summary Bar */}
      <div
        data-testid="heatmap-summary-cards"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            padding: '16px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            Total Opportunities
          </div>
          <div
            style={{
              fontSize: '24px',
              fontFamily: 'var(--font-serif)',
              fontWeight: '600',
              color: 'var(--color-on-surface, #1b1c19)',
              marginTop: '4px',
            }}
          >
            {formatNumber(summaryMetrics.totalOpportunities)}
          </div>
          <div style={{ fontSize: '11px', color: '#80756b', marginTop: '2px' }}>
            Across {summaryMetrics.mappedRegionCount} mapped territories
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            padding: '16px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            Total Pipeline Deal Value
          </div>
          <div
            style={{
              fontSize: '24px',
              fontFamily: 'var(--font-serif)',
              fontWeight: '600',
              color: 'var(--color-primary, #59452b)',
              marginTop: '4px',
            }}
          >
            {formatCurrency(summaryMetrics.totalDealValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#80756b', marginTop: '2px' }}>
            Combined regional opportunity value
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            padding: '16px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            Average Quality Score
          </div>
          <div
            style={{
              fontSize: '24px',
              fontFamily: 'var(--font-serif)',
              fontWeight: '600',
              color: 'var(--color-on-surface, #1b1c19)',
              marginTop: '4px',
            }}
          >
            {summaryMetrics.averageQualityScore.toFixed(1)} / 100
          </div>
          <div style={{ fontSize: '11px', color: '#80756b', marginTop: '2px' }}>
            Lead qualification rating
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            padding: '16px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            Top Density Territory
          </div>
          <div
            style={{
              fontSize: '20px',
              fontFamily: 'var(--font-serif)',
              fontWeight: '600',
              color: 'var(--color-secondary, #a43b2c)',
              marginTop: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {summaryMetrics.highestDensityRegion
              ? summaryMetrics.highestDensityRegion.region_name
              : 'N/A'}
          </div>
          <div style={{ fontSize: '11px', color: '#80756b', marginTop: '2px' }}>
            {summaryMetrics.highestDensityRegion
              ? `${formatPercentage(summaryMetrics.highestDensityRegion.density_score)} opportunity density`
              : 'No territory data available'}
          </div>
        </div>
      </div>

      {/* Loading state indicator */}
      {effectiveIsLoading && (
        <div
          data-testid="heatmap-loading-state"
          style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              width: '32px',
              height: '32px',
              border: '3px solid var(--color-outline-variant, #d1c4b9)',
              borderTopColor: 'var(--color-primary, #59452b)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ marginTop: '12px', color: 'var(--color-on-surface-variant, #4e453d)', fontSize: '14px' }}>
            Loading geographic opportunity heat map metrics...
          </p>
        </div>
      )}

      {/* Error state display */}
      {effectiveError && !effectiveIsLoading && (
        <div
          data-testid="heatmap-error-state"
          style={{
            padding: '20px',
            backgroundColor: 'var(--color-error-container, #ffdad6)',
            color: 'var(--color-on-error-container, #93000a)',
            border: '1px solid var(--color-error, #ba1a1a)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            fontSize: '14px',
          }}
        >
          <strong>Error loading territory heatmap:</strong> {effectiveError}
        </div>
      )}

      {/* Main Heat Map Content Body */}
      {!effectiveIsLoading && !effectiveError && (
        <>
          {(!effectiveData || effectiveData.length === 0) && (!effectiveUnmapped || effectiveUnmapped.opportunity_count === 0) ? (
            <div
              data-testid="heatmap-empty-state"
              style={{
                padding: '48px',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                border: '1px dashed var(--color-outline, #80756b)',
              }}
            >
              <h3 style={{ fontFamily: 'var(--font-serif)', margin: '0 0 8px 0', fontSize: '18px' }}>
                No Regional Opportunity Data Found
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant, #4e453d)', margin: 0 }}>
                No geographic opportunity metrics matched your current filter criteria. Try broadening your region, deal size, or date filter selection.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Active View 1: SVG Map Canvas View */}
              {activeViewMode === 'map' && (
                <div
                  data-testid="heatmap-map-canvas"
                  style={{
                    backgroundColor: '#1b1c19', // Dark background canvas for high contrast heat map points
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    border: '1px solid var(--color-outline, #80756b)',
                    padding: '24px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px',
                      color: '#e4e2dd',
                    }}
                  >
                    <div>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: '16px',
                          fontFamily: 'var(--font-serif)',
                          color: '#ffffff',
                        }}
                      >
                        Interactive Geographic Density Map
                      </h4>
                      <span style={{ fontSize: '12px', color: '#c2b9a7' }}>
                        Nodes sized by opportunity count; color indicates density score tier. Click node to select territory.
                      </span>
                    </div>

                    {/* Density Map Legend */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#a43b2c' }} />
                        <span>High (≥25%)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f5d6b4' }} />
                        <span>Medium (10-24%)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#caddf8' }} />
                        <span>Low (&lt;10%)</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG Map Canvas */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '420px',
                      backgroundColor: '#242622',
                      borderRadius: 'var(--radius-default, 0.25rem)',
                      overflow: 'hidden',
                      border: '1px solid #30312e',
                    }}
                  >
                    <svg
                      viewBox="0 0 1000 500"
                      preserveAspectRatio="xMidYMid meet"
                      style={{ width: '100%', height: '100%' }}
                    >
                      {/* Grid background lines for latitude / longitude */}
                      <g stroke="#30312e" strokeWidth="1" strokeDasharray="4 4">
                        <line x1="0" y1="125" x2="1000" y2="125" />
                        <line x1="0" y1="250" x2="1000" y2="250" />
                        <line x1="0" y1="375" x2="1000" y2="375" />
                        <line x1="250" y1="0" x2="250" y2="500" />
                        <line x1="500" y1="0" x2="500" y2="500" />
                        <line x1="750" y1="0" x2="750" y2="500" />
                      </g>

                      {/* Geographic continent outlines placeholder silhouette */}
                      <path
                        d="M 120 180 Q 200 120 300 200 T 250 350 T 150 280 Z M 520 160 Q 650 140 750 220 T 700 380 T 550 280 Z M 800 300 Q 880 280 920 350 T 820 420 Z"
                        fill="#2a2d28"
                        stroke="#383b35"
                        strokeWidth="1.5"
                      />

                      {/* Regional Hotspot Nodes */}
                      {effectiveData &&
                        effectiveData.map((metric) => {
                          const cx = (projectLongitudeToX(metric.longitude) / 100) * 1000;
                          const cy = (projectLatitudeToY(metric.latitude) / 100) * 500;
                          const tier = getDensityTier(metric.density_score);
                          const isSelected = activeSelectedRegion === metric.region_name;

                          // Radius based on opportunity count clamped between 12px and 36px
                          const radius = Math.min(36, Math.max(12, 10 + Math.sqrt(metric.opportunity_count) * 3));

                          return (
                            <g
                              key={metric.region_name}
                              data-testid={`heatmap-node-${metric.region_name.toLowerCase().replace(/\s+/g, '-')}`}
                              onClick={() => handleSelectRegion(metric)}
                              onMouseEnter={() => setHoveredMetric(metric)}
                              onMouseLeave={() => setHoveredMetric(null)}
                              style={{ cursor: 'pointer' }}
                            >
                              {/* Pulsing ring around selected node */}
                              {isSelected && (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={radius + 8}
                                  fill="none"
                                  stroke={tier.color}
                                  strokeWidth="2"
                                  opacity="0.8"
                                >
                                  <animate
                                    attributeName="r"
                                    values={`${radius + 4};${radius + 12};${radius + 4}`}
                                    dur="2s"
                                    repeatCount="indefinite"
                                  />
                                </circle>
                              )}

                              {/* Outer heat aura circle */}
                              <circle
                                cx={cx}
                                cy={cy}
                                r={radius + 4}
                                fill={tier.color}
                                opacity="0.3"
                              />

                              {/* Core density node */}
                              <circle
                                cx={cx}
                                cy={cy}
                                r={radius}
                                fill={tier.color}
                                stroke="#ffffff"
                                strokeWidth={isSelected ? '3' : '1.5'}
                              />

                              {/* Center count text */}
                              <text
                                x={cx}
                                y={cy + 4}
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize="11"
                                fontWeight="bold"
                                pointerEvents="none"
                              >
                                {metric.opportunity_count}
                              </text>

                              {/* Region label text below */}
                              <text
                                x={cx}
                                y={cy + radius + 14}
                                textAnchor="middle"
                                fill="#e4e2dd"
                                fontSize="11"
                                fontWeight={isSelected ? 'bold' : 'normal'}
                                pointerEvents="none"
                              >
                                {metric.region_name} ({formatPercentage(metric.density_score)})
                              </text>
                            </g>
                          );
                        })}
                    </svg>

                    {/* Map Hover Tooltip Overlay */}
                    {hoveredMetric && (
                      <div
                        data-testid="heatmap-tooltip"
                        style={{
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                          backgroundColor: '#281804',
                          color: '#ffffff',
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-default, 0.25rem)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          zIndex: 10,
                          maxWidth: '260px',
                          fontSize: '13px',
                          border: '1px solid #735c41',
                        }}
                      >
                        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                          {hoveredMetric.region_name}
                        </div>
                        <div>Opportunities: {formatNumber(hoveredMetric.opportunity_count)}</div>
                        <div>Total Value: {formatCurrency(hoveredMetric.total_deal_value)}</div>
                        <div>Avg Quality: {hoveredMetric.average_quality_score.toFixed(1)}/100</div>
                        <div>Density Score: {formatPercentage(hoveredMetric.density_score)}</div>
                        <div style={{ fontSize: '11px', color: '#d1c4b9', marginTop: '4px' }}>
                          Coords: {hoveredMetric.latitude.toFixed(2)}°, {hoveredMetric.longitude.toFixed(2)}°
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Active View 2: Region Cards Grid View */}
              {activeViewMode === 'cards' && (
                <div
                  data-testid="heatmap-cards-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {effectiveData &&
                    effectiveData.map((metric) => {
                      const tier = getDensityTier(metric.density_score);
                      const qualityTier = getQualityTier(metric.average_quality_score);
                      const isSelected = activeSelectedRegion === metric.region_name;

                      return (
                        <div
                          key={metric.region_name}
                          data-testid={`heatmap-card-${metric.region_name.toLowerCase().replace(/\s+/g, '-')}`}
                          onClick={() => handleSelectRegion(metric)}
                          style={{
                            backgroundColor: isSelected
                              ? 'var(--color-surface-container-high, #eae8e3)'
                              : 'var(--color-surface-container-low, #f5f3ee)',
                            border: `2px solid ${isSelected ? 'var(--color-primary, #59452b)' : 'var(--color-outline-variant, #d1c4b9)'}`,
                            borderRadius: 'var(--radius-md, 0.375rem)',
                            padding: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease-in-out',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h4
                              style={{
                                margin: 0,
                                fontFamily: 'var(--font-serif)',
                                fontSize: '18px',
                                color: 'var(--color-on-surface, #1b1c19)',
                              }}
                            >
                              {metric.region_name}
                            </h4>
                            <span
                              style={{
                                padding: '2px 8px',
                                fontSize: '11px',
                                fontWeight: '600',
                                borderRadius: 'var(--radius-full, 9999px)',
                                backgroundColor: tier.badgeBg,
                                color: tier.color,
                                border: `1px solid ${tier.borderColor}`,
                              }}
                            >
                              {tier.label}
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '8px',
                              marginTop: '16px',
                              paddingTop: '12px',
                              borderTop: '1px solid var(--color-outline-variant, #d1c4b9)',
                            }}
                          >
                            <div>
                              <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                                Opportunities
                              </span>
                              <div style={{ fontSize: '16px', fontWeight: '600' }}>
                                {formatNumber(metric.opportunity_count)}
                              </div>
                            </div>

                            <div>
                              <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                                Total Deal Value
                              </span>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-primary, #59452b)' }}>
                                {formatCurrency(metric.total_deal_value)}
                              </div>
                            </div>

                            <div>
                              <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                                Density Score
                              </span>
                              <div style={{ fontSize: '15px', fontWeight: '600' }}>
                                {formatPercentage(metric.density_score)}
                              </div>
                            </div>

                            <div>
                              <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                                Avg Quality
                              </span>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: qualityTier.color }}>
                                {metric.average_quality_score.toFixed(1)} / 100
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: '12px',
                              fontSize: '11px',
                              color: '#80756b',
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>Lat: {metric.latitude.toFixed(2)}°</span>
                            <span>Lng: {metric.longitude.toFixed(2)}°</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Active View 3: Data Table View */}
              {activeViewMode === 'table' && (
                <div
                  data-testid="heatmap-table-container"
                  style={{
                    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    overflow: 'hidden',
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
                      <tr
                        style={{
                          backgroundColor: 'var(--color-surface-container, #f0eee9)',
                          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
                        }}
                      >
                        <th style={{ padding: '12px 16px', fontWeight: '600' }}>Region Name</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600' }}>Opportunities</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600' }}>Total Deal Value</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600' }}>Avg Quality Score</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600' }}>Density Score</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600' }}>Density Tier</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600' }}>Center Coordinates</th>
                      </tr>
                    </thead>
                    <tbody>
                      {effectiveData &&
                        effectiveData.map((metric) => {
                          const tier = getDensityTier(metric.density_score);
                          const isSelected = activeSelectedRegion === metric.region_name;

                          return (
                            <tr
                              key={metric.region_name}
                              data-testid={`heatmap-table-row-${metric.region_name.toLowerCase().replace(/\s+/g, '-')}`}
                              onClick={() => handleSelectRegion(metric)}
                              style={{
                                cursor: 'pointer',
                                backgroundColor: isSelected
                                  ? 'var(--color-surface-container-high, #eae8e3)'
                                  : 'transparent',
                                borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
                              }}
                            >
                              <td style={{ padding: '12px 16px', fontWeight: '600' }}>{metric.region_name}</td>
                              <td style={{ padding: '12px 16px' }}>{formatNumber(metric.opportunity_count)}</td>
                              <td style={{ padding: '12px 16px', color: 'var(--color-primary, #59452b)', fontWeight: '600' }}>
                                {formatCurrency(metric.total_deal_value)}
                              </td>
                              <td style={{ padding: '12px 16px' }}>{metric.average_quality_score.toFixed(1)}</td>
                              <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                                {formatPercentage(metric.density_score)}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    fontSize: '11px',
                                    borderRadius: 'var(--radius-full, 9999px)',
                                    backgroundColor: tier.badgeBg,
                                    color: tier.color,
                                    fontWeight: '600',
                                  }}
                                >
                                  {tier.label}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', color: '#80756b' }}>
                                {metric.latitude.toFixed(2)}°, {metric.longitude.toFixed(2)}°
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Unmapped Region Summary Section (Edge Case Handling) */}
              {showUnmappedCard && effectiveUnmapped && (
                <div
                  data-testid="heatmap-unmapped-region-card"
                  onClick={() => handleSelectRegion(effectiveUnmapped)}
                  style={{
                    backgroundColor:
                      activeSelectedRegion === effectiveUnmapped.region_name
                        ? 'var(--color-surface-container-high, #eae8e3)'
                        : 'var(--color-surface-container-low, #f5f3ee)',
                    border: '1px dashed var(--color-outline, #80756b)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          backgroundColor: '#e4e2dd',
                          color: '#4e453d',
                        }}
                      >
                        Unmapped Category
                      </span>
                      <h4
                        style={{
                          margin: 0,
                          fontFamily: 'var(--font-serif)',
                          fontSize: '16px',
                          color: 'var(--color-on-surface, #1b1c19)',
                        }}
                      >
                        {effectiveUnmapped.region_name}
                      </h4>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)', margin: '4px 0 0 0' }}>
                      Leads and opportunities currently lacking mapped geographic postal codes or state attributes.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                        Unmapped Leads
                      </span>
                      <div style={{ fontSize: '16px', fontWeight: '600' }}>
                        {formatNumber(effectiveUnmapped.opportunity_count)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                        Unmapped Deal Value
                      </span>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-primary, #59452b)' }}>
                        {formatCurrency(effectiveUnmapped.total_deal_value)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                        Avg Quality
                      </span>
                      <div style={{ fontSize: '16px', fontWeight: '600' }}>
                        {effectiveUnmapped.average_quality_score.toFixed(1)} / 100
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Selected Region Focus Detail Card */}
              {activeSelectedMetric && (
                <div
                  data-testid="heatmap-selected-region-detail"
                  style={{
                    backgroundColor: 'var(--color-surface-container, #f0eee9)',
                    border: '1px solid var(--color-primary, #59452b)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          color: 'var(--color-primary, #59452b)',
                        }}
                      >
                        Territory Focus Detail
                      </span>
                      <h3 style={{ fontFamily: 'var(--font-serif)', margin: '2px 0 0 0', fontSize: '20px' }}>
                        {activeSelectedMetric.region_name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      data-testid="heatmap-clear-selection-btn"
                      onClick={() => handleSelectRegion(null)}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--color-outline-variant, #d1c4b9)',
                        borderRadius: 'var(--radius-default, 0.25rem)',
                        cursor: 'pointer',
                      }}
                    >
                      Clear Selection
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '16px',
                      marginTop: '8px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                        Regional Opportunity Count
                      </span>
                      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                        {formatNumber(activeSelectedMetric.opportunity_count)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                        Total Regional Deal Value
                      </span>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-primary, #59452b)' }}>
                        {formatCurrency(activeSelectedMetric.total_deal_value)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                        Density Share Percentage
                      </span>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-secondary, #a43b2c)' }}>
                        {formatPercentage(activeSelectedMetric.density_score)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                        Average Quality Rating
                      </span>
                      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                        {activeSelectedMetric.average_quality_score.toFixed(1)} / 100
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                        Geographic Center
                      </span>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#4e453d', marginTop: '4px' }}>
                        {activeSelectedMetric.latitude.toFixed(4)}° N, {activeSelectedMetric.longitude.toFixed(4)}° W
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HeatMap;
