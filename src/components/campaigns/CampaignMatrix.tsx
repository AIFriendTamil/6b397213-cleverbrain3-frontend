'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Campaign,
  CampaignComparisonMatrix,
  CampaignComparisonItem,
  CampaignComparisonSummary,
  CampaignCompareParams,
  compareCampaigns,
  getCampaigns,
} from '../../services/api_client';

export interface CampaignMatrixFilterParams extends CampaignCompareParams {
  lead_source?: string;
  region?: string;
}

export interface CampaignMatrixProps {
  /** Comparative campaign matrix data. If omitted/null, component fetches from API */
  matrix?: CampaignComparisonMatrix | null;
  /** List of all available marketing campaigns for selection/filtering. If omitted, component fetches from API */
  availableCampaigns?: Campaign[] | null;
  /** List of available lead sources for filtering (FR-11) */
  availableSources?: Array<{ source_id: string; source_name: string }>;
  /** List of available regions for filtering (FR-11) */
  availableRegions?: string[];
  /** Initial filter values */
  initialFilters?: CampaignMatrixFilterParams;
  /** Callback fired whenever user applies or changes filters */
  onFilterChange?: (filters: CampaignMatrixFilterParams) => void;
  /** Callback fired when a campaign header or campaign card is selected */
  onCampaignSelect?: (campaignId: string) => void;
  /** Callback fired when a campaign row/cell is clicked */
  onCampaignClick?: (campaign: CampaignComparisonItem) => void;
  /** Loading state indicator override */
  isLoading?: boolean;
  /** Error message override */
  error?: string | null;
  /** Callback fired to trigger a manual data refresh */
  onRefresh?: () => void;
  /** Custom CSS class name wrapper */
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
 * Format raw integer or float number into localized string (1,250).
 */
export function formatNumber(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(val);
}

/**
 * Format ISO timestamp date into short display date string (e.g. Oct 24, 2026).
 */
export function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
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
      label: 'Positive ROI',
    };
  } else if (roi < 0) {
    return {
      badgeBg: 'var(--color-trend-down-bg, #fdf0ed)',
      color: 'var(--color-trend-down, #a43b2c)',
      label: 'Negative ROI',
    };
  }
  return {
    badgeBg: 'var(--color-surface-container-high, #eae8e3)',
    color: 'var(--color-on-surface-variant, #4e453d)',
    label: 'Breakeven',
  };
}

/**
 * Get quality score rating tier and style configuration (0 to 100 scale).
 */
export function getQualityBadge(score: number): {
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
 * Calculate best performer badges for a campaign based on summary highlights.
 */
export function getBestPerformerBadges(
  campaign: CampaignComparisonItem,
  summary?: CampaignComparisonSummary | null
): Array<{ label: string; badgeBg: string; color: string }> {
  if (!summary) return [];
  const badges: Array<{ label: string; badgeBg: string; color: string }> = [];

  if (summary.best_roi_campaign_id && campaign.campaign_id === summary.best_roi_campaign_id) {
    badges.push({
      label: '🏆 Best ROI',
      badgeBg: 'var(--color-trend-up-bg, #e8f5e9)',
      color: 'var(--color-trend-up, #2e6b38)',
    });
  }

  if (summary.best_conversion_campaign_id && campaign.campaign_id === summary.best_conversion_campaign_id) {
    badges.push({
      label: '⚡ Top Conversion',
      badgeBg: '#e0f2fe',
      color: '#0369a1',
    });
  }

  if (summary.highest_lead_volume_campaign_id && campaign.campaign_id === summary.highest_lead_volume_campaign_id) {
    badges.push({
      label: '📈 Highest Volume',
      badgeBg: '#fef3c7',
      color: '#92400e',
    });
  }

  return badges;
}

export const CampaignMatrix: React.FC<CampaignMatrixProps> = ({
  matrix: propMatrix,
  availableCampaigns: propAvailableCampaigns,
  availableSources = [],
  availableRegions = [],
  initialFilters = {},
  onFilterChange,
  onCampaignSelect,
  onCampaignClick,
  isLoading: propIsLoading,
  error: propError,
  onRefresh,
  className = '',
  'data-testid': testId = 'campaign-matrix-component',
}) => {
  // Parsing initial campaign_ids into string array
  const parsedInitialIds = useMemo<string[]>(() => {
    if (!initialFilters.campaign_ids) return [];
    if (Array.isArray(initialFilters.campaign_ids)) return initialFilters.campaign_ids;
    return initialFilters.campaign_ids.split(',').map((s) => s.trim()).filter(Boolean);
  }, [initialFilters.campaign_ids]);

  // Component state
  const [filters, setFilters] = useState<CampaignMatrixFilterParams>({
    campaign_ids: parsedInitialIds,
    start_timestamp: initialFilters.start_timestamp || '',
    end_timestamp: initialFilters.end_timestamp || '',
    lead_source: initialFilters.lead_source || '',
    region: initialFilters.region || '',
  });

  const [campaignSearch, setCampaignSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'matrix' | 'cards'>('matrix');

  const [internalMatrix, setInternalMatrix] = useState<CampaignComparisonMatrix | null>(null);
  const [internalCampaigns, setInternalCampaigns] = useState<Campaign[]>([]);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const effectiveMatrix = propMatrix !== undefined ? propMatrix : internalMatrix;
  const effectiveCampaigns = propAvailableCampaigns !== undefined ? propAvailableCampaigns || [] : internalCampaigns;
  const isLoading = propIsLoading !== undefined ? propIsLoading : internalLoading;
  const error = propError !== undefined ? propError : internalError;

  // Load available campaigns list if not supplied
  useEffect(() => {
    if (propAvailableCampaigns !== undefined) return;

    let isSubscribed = true;
    async function loadCampaignsList() {
      try {
        const list = await getCampaigns();
        if (isSubscribed) {
          setInternalCampaigns(list || []);
        }
      } catch (err) {
        if (isSubscribed) {
          console.error('Failed to load campaigns list:', err);
        }
      }
    }

    loadCampaignsList();
    return () => {
      isSubscribed = false;
    };
  }, [propAvailableCampaigns]);

  // Fetch comparison matrix data if not supplied via props
  const fetchMatrixData = useCallback(async () => {
    if (propMatrix !== undefined) return;

    setInternalLoading(true);
    setInternalError(null);

    try {
      const selectedIds = Array.isArray(filters.campaign_ids)
        ? filters.campaign_ids
        : typeof filters.campaign_ids === 'string' && filters.campaign_ids
        ? filters.campaign_ids.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

      const data = await compareCampaigns({
        campaign_ids: selectedIds && selectedIds.length > 0 ? selectedIds : undefined,
        start_timestamp: filters.start_timestamp || undefined,
        end_timestamp: filters.end_timestamp || undefined,
      });

      setInternalMatrix(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load campaign comparison matrix.';
      setInternalError(msg);
    } finally {
      setInternalLoading(false);
    }
  }, [propMatrix, filters.campaign_ids, filters.start_timestamp, filters.end_timestamp]);

  useEffect(() => {
    fetchMatrixData();
  }, [fetchMatrixData]);

  // Handle manual refresh
  const handleRefreshClick = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      fetchMatrixData();
    }
  };

  // Toggle selection of a campaign for comparison
  const handleToggleCampaignSelection = (campaignId: string) => {
    const currentIds = Array.isArray(filters.campaign_ids) ? [...filters.campaign_ids] : [];
    const index = currentIds.indexOf(campaignId);
    let newIds: string[];

    if (index >= 0) {
      newIds = currentIds.filter((id) => id !== campaignId);
    } else {
      newIds = [...currentIds, campaignId];
    }

    const updatedFilters: CampaignMatrixFilterParams = {
      ...filters,
      campaign_ids: newIds,
    };

    setFilters(updatedFilters);
    if (onFilterChange) {
      onFilterChange(updatedFilters);
    }
  };

  // Select all or clear campaign selections
  const handleSelectAllCampaigns = () => {
    const allIds = effectiveCampaigns.map((c) => c.campaign_id);
    const updated = { ...filters, campaign_ids: allIds };
    setFilters(updated);
    if (onFilterChange) onFilterChange(updated);
  };

  const handleClearCampaignSelection = () => {
    const updated = { ...filters, campaign_ids: [] };
    setFilters(updated);
    if (onFilterChange) onFilterChange(updated);
  };

  // Filter input change handler
  const handleInputChange = (field: keyof CampaignMatrixFilterParams, value: string) => {
    const updated = { ...filters, [field]: value };
    setFilters(updated);
    if (onFilterChange) onFilterChange(updated);
  };

  // Clear all filters
  const handleResetFilters = () => {
    const resetVals: CampaignMatrixFilterParams = {
      campaign_ids: [],
      start_timestamp: '',
      end_timestamp: '',
      lead_source: '',
      region: '',
    };
    setFilters(resetVals);
    setCampaignSearch('');
    if (onFilterChange) onFilterChange(resetVals);
  };

  // Filtered campaign list for picker
  const filteredCampaignsList = useMemo(() => {
    if (!campaignSearch.trim()) return effectiveCampaigns;
    const term = campaignSearch.toLowerCase();
    return effectiveCampaigns.filter((c) => c.campaign_name.toLowerCase().includes(term));
  }, [effectiveCampaigns, campaignSearch]);

  const selectedCampaignCount = useMemo(() => {
    if (Array.isArray(filters.campaign_ids)) {
      return filters.campaign_ids.length;
    }
    return 0;
  }, [filters.campaign_ids]);

  // Derived comparison item metrics calculation for highlighting matrix max/min
  const comparedItems = effectiveMatrix?.campaigns || [];
  const summary = effectiveMatrix?.summary;

  const maxValues = useMemo(() => {
    if (comparedItems.length === 0) return {};
    return {
      maxRoi: Math.max(...comparedItems.map((item) => item.total_roi_percentage)),
      maxConversion: Math.max(...comparedItems.map((item) => item.overall_conversion_rate)),
      maxLeads: Math.max(...comparedItems.map((item) => item.leads_generated)),
      maxRevenue: Math.max(...comparedItems.map((item) => item.attributed_revenue)),
      maxQuality: Math.max(...comparedItems.map((item) => item.average_quality_score)),
      minCpl: Math.min(...comparedItems.map((item) => item.cost_per_lead)),
      minCpa: Math.min(...comparedItems.map((item) => item.cost_per_conversion)),
    };
  }, [comparedItems]);

  return (
    <div
      className={`campaign-matrix-wrapper ${className}`}
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-gutter, 24px)',
        width: '100%',
        backgroundColor: 'var(--color-background, #fbf9f4)',
        color: 'var(--color-on-background, #1b1c19)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* 1. Header & Title Area */}
      <div
        className="campaign-matrix-header"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-serif, Georgia, serif)',
              fontSize: '28px',
              fontWeight: 400,
              margin: '0 0 4px 0',
              color: 'var(--color-primary, #59452b)',
            }}
          >
            Campaign Evaluation Matrix
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Side-by-side performance evaluation, return on investment, and unit economic benchmarking
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* View Mode Toggle */}
          <div
            style={{
              display: 'inline-flex',
              borderRadius: 'var(--radius-md, 0.375rem)',
              backgroundColor: 'var(--color-surface-container, #f0eee9)',
              padding: '3px',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
          >
            <button
              type="button"
              data-testid="view-mode-matrix"
              onClick={() => setViewMode('matrix')}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                backgroundColor: viewMode === 'matrix' ? 'var(--color-surface-container-lowest, #ffffff)' : 'transparent',
                color: viewMode === 'matrix' ? 'var(--color-primary, #59452b)' : 'var(--color-on-surface-variant, #4e453d)',
                fontWeight: viewMode === 'matrix' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: viewMode === 'matrix' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Side-by-Side Table
            </button>
            <button
              type="button"
              data-testid="view-mode-cards"
              onClick={() => setViewMode('cards')}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                backgroundColor: viewMode === 'cards' ? 'var(--color-surface-container-lowest, #ffffff)' : 'transparent',
                color: viewMode === 'cards' ? 'var(--color-primary, #59452b)' : 'var(--color-on-surface-variant, #4e453d)',
                fontWeight: viewMode === 'cards' ? 600 : 400,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: viewMode === 'cards' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Comparison Cards
            </button>
          </div>

          <button
            type="button"
            data-testid="refresh-button"
            onClick={handleRefreshClick}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid var(--color-outline, #80756b)',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              color: 'var(--color-primary, #59452b)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* 2. Filter Controls Area (FR-11) */}
      <div
        className="campaign-matrix-filters-panel"
        style={{
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          borderRadius: 'var(--radius-lg, 0.5rem)',
          padding: '16px 20px',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-primary, #59452b)',
            }}
          >
            Report Filters & Selection (FR-10, FR-11)
          </span>
          <button
            type="button"
            data-testid="reset-filters-btn"
            onClick={handleResetFilters}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-secondary, #a43b2c)',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Reset All Filters
          </button>
        </div>

        {/* Campaign Selection Subpanel */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '12px 16px',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <label
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-on-surface, #1b1c19)',
              }}
            >
              Select Campaigns to Compare ({selectedCampaignCount} selected):
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                data-testid="select-all-campaigns-btn"
                onClick={handleSelectAllCampaigns}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary, #59452b)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Select All
              </button>
              <span style={{ color: 'var(--color-outline, #80756b)', fontSize: '12px' }}>|</span>
              <button
                type="button"
                data-testid="clear-campaign-selection-btn"
                onClick={handleClearCampaignSelection}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-secondary, #a43b2c)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Clear Selection
              </button>
            </div>
          </div>

          {/* Search box for campaign selection */}
          {effectiveCampaigns.length > 5 && (
            <input
              type="text"
              data-testid="campaign-search-input"
              placeholder="Search campaign name..."
              value={campaignSearch}
              onChange={(e) => setCampaignSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 12px',
                marginBottom: '10px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                fontSize: '13px',
              }}
            />
          )}

          {/* Campaign Selection Chips / Checkboxes */}
          <div
            className="campaign-chip-selector"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              maxHeight: '140px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {filteredCampaignsList.length === 0 ? (
              <span style={{ fontSize: '12px', color: 'var(--color-outline, #80756b)' }}>
                No matching campaigns found.
              </span>
            ) : (
              filteredCampaignsList.map((campaign) => {
                const isSelected =
                  Array.isArray(filters.campaign_ids) &&
                  filters.campaign_ids.includes(campaign.campaign_id);

                return (
                  <button
                    key={campaign.campaign_id}
                    type="button"
                    data-testid={`campaign-chip-${campaign.campaign_id}`}
                    onClick={() => handleToggleCampaignSelection(campaign.campaign_id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-full, 9999px)',
                      border: `1px solid ${
                        isSelected ? 'var(--color-primary, #59452b)' : 'var(--color-outline-variant, #d1c4b9)'
                      }`,
                      backgroundColor: isSelected
                        ? 'var(--color-primary-container, #735c41)'
                        : 'var(--color-surface-container-low, #f5f3ee)',
                      color: isSelected
                        ? 'var(--color-on-primary, #ffffff)'
                        : 'var(--color-on-surface, #1b1c19)',
                      fontSize: '12px',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <span>{isSelected ? '✓' : '+'}</span>
                    <span>{campaign.campaign_name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Date Range, Lead Source, and Region Inputs (FR-11) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          {/* Start Timestamp Filter */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '4px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Start Date Window (FR-11)
            </label>
            <input
              type="date"
              data-testid="filter-start-timestamp"
              value={filters.start_timestamp ? filters.start_timestamp.substring(0, 10) : ''}
              onChange={(e) => handleInputChange('start_timestamp', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                fontSize: '13px',
              }}
            />
          </div>

          {/* End Timestamp Filter */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '4px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              End Date Window (FR-11)
            </label>
            <input
              type="date"
              data-testid="filter-end-timestamp"
              value={filters.end_timestamp ? filters.end_timestamp.substring(0, 10) : ''}
              onChange={(e) => handleInputChange('end_timestamp', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Lead Source Filter (FR-11) */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '4px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Lead Source Filter (FR-11)
            </label>
            <select
              data-testid="filter-lead-source"
              value={filters.lead_source || ''}
              onChange={(e) => handleInputChange('lead_source', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                fontSize: '13px',
              }}
            >
              <option value="">All Lead Sources</option>
              {availableSources.map((src) => (
                <option key={src.source_id} value={src.source_id}>
                  {src.source_name}
                </option>
              ))}
            </select>
          </div>

          {/* Region Filter (FR-11) */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '4px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Geographic Region (FR-11)
            </label>
            <select
              data-testid="filter-region"
              value={filters.region || ''}
              onChange={(e) => handleInputChange('region', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                fontSize: '13px',
              }}
            >
              <option value="">All Geographic Regions</option>
              {availableRegions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Error Banner */}
      {error && (
        <div
          data-testid="campaign-matrix-error"
          style={{
            padding: '16px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            backgroundColor: 'var(--color-error-container, #ffdad6)',
            color: 'var(--color-on-error-container, #93000a)',
            border: '1px solid var(--color-error, #ba1a1a)',
            fontSize: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={handleRefreshClick}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              backgroundColor: 'var(--color-error, #ba1a1a)',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. Loading Skeleton */}
      {isLoading && (
        <div
          data-testid="campaign-matrix-loading"
          style={{
            padding: '32px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-lg, 0.5rem)',
            border: '1px dashed var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div
            style={{
              fontSize: '16px',
              fontWeight: 500,
              color: 'var(--color-primary, #59452b)',
              marginBottom: '8px',
            }}
          >
            Analyzing Campaign Comparison Metrics...
          </div>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Evaluating spend, attribution, quality scores, and conversion unit economics across selected campaigns.
          </div>
        </div>
      )}

      {/* 5. Summary Highlights Bar */}
      {!isLoading && summary && comparedItems.length > 0 && (
        <div
          className="campaign-summary-cards"
          data-testid="campaign-summary-panel"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Summary Card 1: Total Compared & Spend */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              padding: '16px',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)', fontWeight: 500 }}>
              COMPARED CAMPAIGNS
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-primary, #59452b)', margin: '4px 0' }}>
              {summary.total_campaigns_compared} Campaigns
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
              Spend: <strong>{formatCurrency(summary.total_spend_across_campaigns)}</strong>
            </div>
          </div>

          {/* Summary Card 2: Best ROI */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              padding: '16px',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--color-trend-up, #2e6b38)', fontWeight: 600 }}>
              🏆 BEST ROI PERFORMER
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-on-surface, #1b1c19)', margin: '4px 0' }}>
              {summary.best_roi_campaign_name || 'N/A'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
              Average ROI: <strong>{formatPercentage(summary.average_roi_percentage)}</strong>
            </div>
          </div>

          {/* Summary Card 3: Top Conversion */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              padding: '16px',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
          >
            <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: 600 }}>
              ⚡ HIGHEST CONVERSION RATE
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-on-surface, #1b1c19)', margin: '4px 0' }}>
              {summary.best_conversion_campaign_name || 'N/A'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
              Total Revenue: <strong>{formatCurrency(summary.total_revenue_across_campaigns)}</strong>
            </div>
          </div>

          {/* Summary Card 4: Volume Leader */}
          <div
            style={{
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              padding: '16px',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
          >
            <div style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>
              📈 HIGHEST LEAD VOLUME
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-on-surface, #1b1c19)', margin: '4px 0' }}>
              {summary.highest_lead_volume_campaign_name || 'N/A'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
              Total Leads: <strong>{formatNumber(summary.total_leads_across_campaigns)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* 6. Main Evaluation Matrix Area (FR-10) */}
      {!isLoading && comparedItems.length === 0 ? (
        <div
          data-testid="campaign-matrix-empty"
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-lg, 0.5rem)',
            border: '1px dashed var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div
            style={{
              fontSize: '18px',
              fontFamily: 'var(--font-serif, Georgia, serif)',
              color: 'var(--color-primary, #59452b)',
              marginBottom: '8px',
            }}
          >
            Select Marketing Campaigns for Evaluation
          </div>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              maxWidth: '560px',
              margin: '0 auto 16px auto',
            }}
          >
            Please select 2 or more marketing campaigns from the filter panel above to generate a side-by-side performance evaluation matrix.
          </p>
          {effectiveCampaigns.length > 0 && (
            <button
              type="button"
              data-testid="quick-select-all-btn"
              onClick={handleSelectAllCampaigns}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                backgroundColor: 'var(--color-primary, #59452b)',
                color: 'var(--color-on-primary, #ffffff)',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Compare All Available Campaigns
            </button>
          )}
        </div>
      ) : (
        !isLoading && (
          <>
            {viewMode === 'matrix' ? (
              /* VIEW MODE 1: SIDE-BY-SIDE MATRIX TABLE (FR-10) */
              <div
                className="campaign-matrix-table-container"
                data-testid="campaign-matrix-table"
                style={{
                  width: '100%',
                  overflowX: 'auto',
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  borderRadius: 'var(--radius-lg, 0.5rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                }}
              >
                <table
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
                        borderBottom: '2px solid var(--color-outline-variant, #d1c4b9)',
                      }}
                    >
                      <th
                        style={{
                          padding: '16px',
                          minWidth: '220px',
                          fontWeight: 700,
                          color: 'var(--color-primary, #59452b)',
                          fontSize: '14px',
                          position: 'sticky',
                          left: 0,
                          backgroundColor: 'var(--color-surface-container, #f0eee9)',
                          zIndex: 2,
                        }}
                      >
                        Performance Metric
                      </th>
                      {comparedItems.map((item) => {
                        const badges = getBestPerformerBadges(item, summary);
                        return (
                          <th
                            key={item.campaign_id}
                            data-testid={`matrix-col-header-${item.campaign_id}`}
                            style={{
                              padding: '16px',
                              minWidth: '200px',
                              verticalAlign: 'top',
                              borderLeft: '1px solid var(--color-outline-variant, #d1c4b9)',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onCampaignSelect) onCampaignSelect(item.campaign_id);
                                  if (onCampaignClick) onCampaignClick(item);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  textAlign: 'left',
                                  fontFamily: 'var(--font-serif, Georgia, serif)',
                                  fontSize: '16px',
                                  fontWeight: 600,
                                  color: 'var(--color-primary, #59452b)',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                }}
                              >
                                {item.campaign_name}
                              </button>
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--color-on-surface-variant, #4e453d)',
                                }}
                              >
                                {formatDateDisplay(item.start_timestamp)} – {formatDateDisplay(item.end_timestamp)}
                              </div>
                              {/* Best performer badges */}
                              {badges.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                  {badges.map((b, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        padding: '2px 6px',
                                        borderRadius: 'var(--radius-sm, 0.125rem)',
                                        backgroundColor: b.badgeBg,
                                        color: b.color,
                                      }}
                                    >
                                      {b.label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1: Budget Allocated */}
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)' }}>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        Budget Allocated
                      </td>
                      {comparedItems.map((item) => (
                        <td
                          key={item.campaign_id}
                          style={{
                            padding: '12px 16px',
                            borderLeft: '1px solid var(--color-outline-variant, #d1c4b9)',
                          }}
                        >
                          {formatCurrency(item.budget_amount)}
                        </td>
                      ))}
                    </tr>

                    {/* Row 2: Spend Incurred */}
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)' }}>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        Spend Incurred
                      </td>
                      {comparedItems.map((item) => (
                        <td
                          key={item.campaign_id}
                          style={{
                            padding: '12px 16px',
                            borderLeft: '1px solid var(--color-outline-variant, #d1c4b9)',
                          }}
                        >
                          {formatCurrency(item.spent_amount)}
                        </td>
                      ))}
                    </tr>

                    {/* Row 3: Leads Acquired */}
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)' }}>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        Leads Acquired
                      </td>
                      {comparedItems.map((item) => {
                        const isMax = item.leads_generated === maxValues.maxLeads && maxValues.maxLeads > 0;
                        return (
                          <td
                            key={item.campaign_id}
                            style={{
                              padding: '12px 16px',
                              borderLeft: '1px solid var(--color-outline-variant, #d1c4b9)',
                              fontWeight: isMax ? 700 : 400,
                              backgroundColor: isMax ? 'rgba(254, 243, 199, 0.3)' : 'transparent',
                            }}
                          >
                            {formatNumber(item.leads_generated)}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Row 4: Average Quality Score */}
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)' }}>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        Avg Lead Quality Score
                      </td>
                      {comparedItems.map((item) => {
                        const qBadge = getQualityBadge(item.average_quality_score);
                        return (
                          <td
                            key={item.campaign_id}
                            style={{
                              padding: '12px 16px',
                              borderLeft: '1px solid var(--color-outline-variant, #d1c4b9)',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm, 0.125rem)',
                                backgroundColor: qBadge.badgeBg,
                                color: qBadge.color,
                                fontWeight: 600,
                                fontSize: '12px',
                              }}
                            >
                              {item.average_quality_score.toFixed(1)} / 100 ({qBadge.label})
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Row 5: Converted Leads */}
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)' }}>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        Converted Won Leads
                      </td>
                      {comparedItems.map((item) => (
                        <td
                          key={item.campaign_id}
                          style={{
                            padding: '12px 16px',
                            borderLeft: '1px solid var(--color-outline-variant, #d1c4b9)',
                          }}
                        >
                          {formatNumber(item.converted_leads)}
                        </td>
                      ))}
                    </tr>

                    {/* Row 6: Lead Conversion Rate */}
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)' }}>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        Overall Conversion Rate
                      </td>
                      {comparedItems.map((item) => {
                        const isMax =
                          item.overall_conversion_rate === maxValues.maxConversion &&
                          maxValues.maxConversion > 0;
                        return (
                          <td
                            key={item.campaign_id}
                            style={{
                              padding: '12px 16px',
                              borderLeft: '1px solid var(--color-outline-variant, #d1c4b9)',
                              fontWeight: isMax ? 700 : 400,
                              backgroundColor: isMax ? 'rgba(224, 242, 254, 0.4)' : 'transparent',
                            }}
                          >
                            <span
                              style={{
                                color: isMax ? '#0369a1' : 'var(--color-on-surface, #1b1c19)',
                              }}
                            >
                              {item.overall_conversion_rate.toFixed(1)}% {isMax ? '⚡' : ''}
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Row 7: Attributed Revenue */}
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)' }}>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        Attributed Deal Revenue
                      </td>
                      {comparedItems.map((item) => {
                        const isMax =
                          item.attributed_revenue === maxValues.maxRevenue &&
                          maxValues.maxRevenue > 0;
                        return (
                          <td
                            key={item.campaign_id}
                            style={{
                              padding: '12px 16px',
                              borderLeft: '1px solid var(--color-outline-variant, #d1c4b9)',
                              fontWeight: isMax ? 700 : 400,
                            }}
                          >
                            {formatCurrency(item.attributed_revenue)}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Row 8: Return on Investment (ROI %) */}
                    <tr
                      style={{
                        borderBottom: '2px solid var(--color-outline-variant, #d1c4b9)',
                        backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                      }}
                    >
                      <td
                        style={{
                          padding: '14px 16px',
                          fontWeight: 700,
                          color: 'var(--color-primary, #59452b)',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                        }}
                      >
                        Total ROI Percentage
                      </td>
                      {comparedItems.map((item) => {
                        const roiBadge = getROIBadge(item.total_roi_percentage);
                        const isMax =
                          item.total_roi_percentage === maxValues.maxRoi &&
                          maxValues.maxRoi > 0;

                        return (
                          <td
                            key={item.campaign_id}
                            style={{
                              padding: '14px 16px',
                              borderLeft: '1px solid var(--color-outline-variant, #d1c4b9)',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: 'var(--radius-sm, 0.125rem)',
                                backgroundColor: roiBadge.badgeBg,
                                color: roiBadge.color,
                                fontWeight: 700,
                                fontSize: '13px',
                              }}
                            >
                              {formatPercentage(item.total_roi_percentage)} {isMax ? '🏆' : ''}
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Row 9: Cost Per Lead (CPL) */}
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)' }}>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        Cost Per Lead (CPL)
                      </td>
                      {comparedItems.map((item) => {
                        const isMin =
                          item.cost_per_lead === maxValues.minCpl &&
                          item.cost_per_lead > 0;
                        return (
                          <td
                            key={item.campaign_id}
                            style={{
                              padding: '12px 16px',
                              borderLeft: '1px solid var(--color-outline-variant, #d1c4b9)',
                              fontWeight: isMin ? 700 : 400,
                              color: isMin ? 'var(--color-trend-up, #2e6b38)' : 'inherit',
                            }}
                          >
                            {formatCurrency(item.cost_per_lead)} {isMin ? '(Lowest)' : ''}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Row 10: Cost Per Conversion (CPA) */}
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)' }}>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        Cost Per Conversion (CPA)
                      </td>
                      {comparedItems.map((item) => {
                        const isMin =
                          item.cost_per_conversion === maxValues.minCpa &&
                          item.cost_per_conversion > 0;
                        return (
                          <td
                            key={item.campaign_id}
                            style={{
                              padding: '12px 16px',
                              borderLeft: '1px solid var(--color-outline-variant, #d1c4b9)',
                              fontWeight: isMin ? 700 : 400,
                              color: isMin ? 'var(--color-trend-up, #2e6b38)' : 'inherit',
                            }}
                          >
                            {formatCurrency(item.cost_per_conversion)} {isMin ? '(Lowest)' : ''}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              /* VIEW MODE 2: COMPARISON CARDS GRID (FR-10) */
              <div
                className="campaign-comparison-cards-grid"
                data-testid="campaign-cards-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '20px',
                }}
              >
                {comparedItems.map((item) => {
                  const badges = getBestPerformerBadges(item, summary);
                  const roiBadge = getROIBadge(item.total_roi_percentage);
                  const qBadge = getQualityBadge(item.average_quality_score);

                  return (
                    <div
                      key={item.campaign_id}
                      data-testid={`campaign-card-${item.campaign_id}`}
                      style={{
                        backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                        borderRadius: 'var(--radius-lg, 0.5rem)',
                        padding: '20px',
                        border: '1px solid var(--color-outline-variant, #d1c4b9)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      {/* Card Header */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (onCampaignSelect) onCampaignSelect(item.campaign_id);
                              if (onCampaignClick) onCampaignClick(item);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              textAlign: 'left',
                              fontFamily: 'var(--font-serif, Georgia, serif)',
                              fontSize: '18px',
                              fontWeight: 600,
                              color: 'var(--color-primary, #59452b)',
                              cursor: 'pointer',
                            }}
                          >
                            {item.campaign_name}
                          </button>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm, 0.125rem)',
                              backgroundColor: roiBadge.badgeBg,
                              color: roiBadge.color,
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            ROI: {formatPercentage(item.total_roi_percentage)}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)', marginTop: '2px' }}>
                          {formatDateDisplay(item.start_timestamp)} – {formatDateDisplay(item.end_timestamp)}
                        </div>

                        {badges.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                            {badges.map((b, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-sm, 0.125rem)',
                                  backgroundColor: b.badgeBg,
                                  color: b.color,
                                }}
                              >
                                {b.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <hr style={{ border: 'none', borderTop: '1px solid var(--color-outline-variant, #d1c4b9)', margin: 0 }} />

                      {/* Card Key Metrics List */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                        <div>
                          <div style={{ color: 'var(--color-on-surface-variant, #4e453d)', fontSize: '11px' }}>BUDGET / SPEND</div>
                          <div style={{ fontWeight: 600 }}>{formatCurrency(item.spent_amount)} / {formatCurrency(item.budget_amount)}</div>
                        </div>

                        <div>
                          <div style={{ color: 'var(--color-on-surface-variant, #4e453d)', fontSize: '11px' }}>LEADS GENERATED</div>
                          <div style={{ fontWeight: 600 }}>{formatNumber(item.leads_generated)} leads</div>
                        </div>

                        <div>
                          <div style={{ color: 'var(--color-on-surface-variant, #4e453d)', fontSize: '11px' }}>CONVERSION RATE</div>
                          <div style={{ fontWeight: 600, color: '#0369a1' }}>{item.overall_conversion_rate.toFixed(1)}%</div>
                        </div>

                        <div>
                          <div style={{ color: 'var(--color-on-surface-variant, #4e453d)', fontSize: '11px' }}>REVENUE</div>
                          <div style={{ fontWeight: 600, color: 'var(--color-primary, #59452b)' }}>{formatCurrency(item.attributed_revenue)}</div>
                        </div>

                        <div>
                          <div style={{ color: 'var(--color-on-surface-variant, #4e453d)', fontSize: '11px' }}>QUALITY SCORE</div>
                          <div style={{ fontWeight: 600, color: qBadge.color }}>{item.average_quality_score.toFixed(1)} ({qBadge.label})</div>
                        </div>

                        <div>
                          <div style={{ color: 'var(--color-on-surface-variant, #4e453d)', fontSize: '11px' }}>UNIT COSTS (CPL / CPA)</div>
                          <div style={{ fontWeight: 600 }}>{formatCurrency(item.cost_per_lead)} / {formatCurrency(item.cost_per_conversion)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
};

export default CampaignMatrix;
