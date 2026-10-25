'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ProtectedRoute, useAuth } from '../../components/protected_route';
import { NavMenu } from '../../components/nav_menu';
import { CurrentUserResponse } from '../../services/auth';
import { FunnelChart } from '../../components/deals/FunnelChart';
import { MilestoneTracker } from '../../components/deals/MilestoneTracker';
import { StakeholderGraph } from '../../components/deals/StakeholderGraph';
import { TimelineForecast } from '../../components/deals/TimelineForecast';

import {
  PipelineFilterParams,
  PipelineFunnelSummary,
  Deal,
  Milestone,
  StakeholderGraphResponse,
  DealForecastResponse,
  MilestoneStatus,
  StakeholderCreate,
  getPipelineFunnel,
  getDeals,
  getDealMilestones,
  getStakeholders,
  getForecast,
  updateMilestone,
  createStakeholder,
} from '../../services/api_client';

export interface DealsPageProps {
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Preloaded pipeline funnel summary data */
  initialFunnel?: PipelineFunnelSummary | null;
  /** Preloaded deals array */
  initialDeals?: Deal[] | null;
  /** Preloaded milestones array for selected deal */
  initialMilestones?: Milestone[] | null;
  /** Preloaded stakeholder graph response for selected deal */
  initialStakeholders?: StakeholderGraphResponse | null;
  /** Preloaded timeline forecast response for selected deal */
  initialForecast?: DealForecastResponse | null;
  /** Initial selected deal ID */
  initialSelectedDealId?: string | null;
  /** Custom fetcher override for pipeline funnel */
  fetchFunnel?: (params?: PipelineFilterParams) => Promise<PipelineFunnelSummary>;
  /** Custom fetcher override for deals list */
  fetchDealsList?: (params?: PipelineFilterParams) => Promise<Deal[]>;
  /** Custom fetcher override for milestones */
  fetchMilestones?: (dealId: string) => Promise<Milestone[]>;
  /** Custom fetcher override for stakeholders */
  fetchStakeholdersGraph?: (dealId: string) => Promise<StakeholderGraphResponse>;
  /** Custom fetcher override for timeline forecast */
  fetchTimelineForecast?: (dealId: string) => Promise<DealForecastResponse>;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
  /** Custom container CSS class name */
  className?: string;
}

/**
 * Format currency for deal summary header.
 */
function formatCurrency(amount?: number | null): string {
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
 * Inner Sales Pipeline Dashboard Content Component consuming user session context.
 * Renders page navigation, filtering controls, pipeline funnel visualization,
 * deal selection, color-coded milestone tracking, stakeholder contact network graph,
 * and predictive AI timeline forecasting.
 */
function DealsContent({
  user: explicitUser,
  onLogout,
  initialFunnel = null,
  initialDeals = null,
  initialMilestones = null,
  initialStakeholders = null,
  initialForecast = null,
  initialSelectedDealId = null,
  fetchFunnel: customFetchFunnel,
  fetchDealsList: customFetchDealsList,
  fetchMilestones: customFetchMilestones,
  fetchStakeholdersGraph: customFetchStakeholders,
  fetchTimelineForecast: customFetchForecast,
  autoFetch = true,
  className = '',
}: DealsPageProps) {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  // Filter state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');
  const [stageId, setStageId] = useState<string>('');
  const [teamMemberId, setTeamMemberId] = useState<string>('');

  // Active filter params applied to queries
  const [appliedFilters, setAppliedFilters] = useState<PipelineFilterParams>({});

  // Funnel & Deals state
  const [funnelSummary, setFunnelSummary] = useState<PipelineFunnelSummary | null>(initialFunnel);
  const [deals, setDeals] = useState<Deal[]>(initialDeals || []);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(
    initialSelectedDealId || (initialDeals && initialDeals.length > 0 ? initialDeals[0].id : null)
  );

  // Selected Deal Detail state
  const [milestones, setMilestones] = useState<Milestone[] | null>(initialMilestones);
  const [stakeholderGraph, setStakeholderGraph] = useState<StakeholderGraphResponse | null>(
    initialStakeholders
  );
  const [timelineForecast, setTimelineForecast] = useState<DealForecastResponse | null>(
    initialForecast
  );

  // Loading & Error states
  const [isLoadingFunnel, setIsLoadingFunnel] = useState<boolean>(false);
  const [funnelError, setFunnelError] = useState<string | null>(null);

  const [isLoadingDeals, setIsLoadingDeals] = useState<boolean>(false);
  const [dealsError, setDealsError] = useState<string | null>(null);

  const [isLoadingMilestones, setIsLoadingMilestones] = useState<boolean>(false);
  const [milestonesError, setMilestonesError] = useState<string | null>(null);

  const [isLoadingStakeholders, setIsLoadingStakeholders] = useState<boolean>(false);
  const [stakeholdersError, setStakeholdersError] = useState<string | null>(null);

  const [isLoadingForecast, setIsLoadingForecast] = useState<boolean>(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  // Active tab selection for deal inspection ('milestones' | 'stakeholders' | 'forecast' | 'all')
  const [activeTab, setActiveTab] = useState<'all' | 'milestones' | 'stakeholders' | 'forecast'>(
    'all'
  );

  // Fetch Funnel Summary
  const loadFunnel = useCallback(
    async (params?: PipelineFilterParams) => {
      setIsLoadingFunnel(true);
      setFunnelError(null);
      try {
        let data: PipelineFunnelSummary;
        if (customFetchFunnel) {
          data = await customFetchFunnel(params);
        } else {
          data = await getPipelineFunnel(params);
        }
        setFunnelSummary(data);
      } catch (err: any) {
        setFunnelError(err?.message || 'Failed to load pipeline funnel summary.');
      } finally {
        setIsLoadingFunnel(false);
      }
    },
    [customFetchFunnel]
  );

  // Fetch Deals List
  const loadDealsList = useCallback(
    async (params?: PipelineFilterParams) => {
      setIsLoadingDeals(true);
      setDealsError(null);
      try {
        let data: Deal[];
        if (customFetchDealsList) {
          data = await customFetchDealsList(params);
        } else {
          data = await getDeals(params);
        }
        setDeals(data);
        if (data.length > 0 && !selectedDealId) {
          setSelectedDealId(data[0].id);
        }
      } catch (err: any) {
        setDealsError(err?.message || 'Failed to load deals list.');
      } finally {
        setIsLoadingDeals(false);
      }
    },
    [customFetchDealsList, selectedDealId]
  );

  // Fetch Milestones for Selected Deal
  const loadMilestones = useCallback(
    async (dealIdToFetch: string) => {
      if (!dealIdToFetch) return;
      setIsLoadingMilestones(true);
      setMilestonesError(null);
      try {
        let data: Milestone[];
        if (customFetchMilestones) {
          data = await customFetchMilestones(dealIdToFetch);
        } else {
          data = await getDealMilestones(dealIdToFetch);
        }
        setMilestones(data);
      } catch (err: any) {
        setMilestonesError(err?.message || 'Failed to load deal milestones.');
      } finally {
        setIsLoadingMilestones(false);
      }
    },
    [customFetchMilestones]
  );

  // Fetch Stakeholder Graph for Selected Deal
  const loadStakeholders = useCallback(
    async (dealIdToFetch: string) => {
      if (!dealIdToFetch) return;
      setIsLoadingStakeholders(true);
      setStakeholdersError(null);
      try {
        let data: StakeholderGraphResponse;
        if (customFetchStakeholders) {
          data = await customFetchStakeholders(dealIdToFetch);
        } else {
          data = await getStakeholders(dealIdToFetch);
        }
        setStakeholderGraph(data);
      } catch (err: any) {
        setStakeholdersError(err?.message || 'Failed to load stakeholder contact network graph.');
      } finally {
        setIsLoadingStakeholders(false);
      }
    },
    [customFetchStakeholders]
  );

  // Fetch Timeline Forecast for Selected Deal
  const loadForecast = useCallback(
    async (dealIdToFetch: string) => {
      if (!dealIdToFetch) return;
      setIsLoadingForecast(true);
      setForecastError(null);
      try {
        let data: DealForecastResponse;
        if (customFetchForecast) {
          data = await customFetchForecast(dealIdToFetch);
        } else {
          data = await getForecast(dealIdToFetch, { deal_id: dealIdToFetch, include_milestones: true });
        }
        setTimelineForecast(data);
      } catch (err: any) {
        setForecastError(err?.message || 'Failed to load timeline forecast.');
      } finally {
        setIsLoadingForecast(false);
      }
    },
    [customFetchForecast]
  );

  // Initial Load & Filter Updates
  useEffect(() => {
    if (!autoFetch) return;
    loadFunnel(appliedFilters);
    loadDealsList(appliedFilters);
  }, [autoFetch, appliedFilters, loadFunnel, loadDealsList]);

  // Selected Deal Updates
  useEffect(() => {
    if (!autoFetch || !selectedDealId) return;
    loadMilestones(selectedDealId);
    loadStakeholders(selectedDealId);
    loadForecast(selectedDealId);
  }, [autoFetch, selectedDealId, loadMilestones, loadStakeholders, loadForecast]);

  // Handle Apply Filters Button Click
  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params: PipelineFilterParams = {};
    if (startDate.trim()) params.start_date = startDate.trim();
    if (endDate.trim()) params.end_date = endDate.trim();
    if (minValue.trim() && !isNaN(Number(minValue))) params.min_value = Number(minValue);
    if (maxValue.trim() && !isNaN(Number(maxValue))) params.max_value = Number(maxValue);
    if (stageId.trim()) params.stage_id = stageId.trim();
    if (teamMemberId.trim()) params.team_member_id = teamMemberId.trim();

    setAppliedFilters(params);
  };

  // Handle Reset Filters Button Click
  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setMinValue('');
    setMaxValue('');
    setStageId('');
    setTeamMemberId('');
    setAppliedFilters({});
  };

  // Handle Stage Selection on Funnel Chart
  const handleFunnelStageSelect = (selectedStage: string | null) => {
    const newStageId = selectedStage || '';
    setStageId(newStageId);
    setAppliedFilters((prev) => ({
      ...prev,
      stage_id: newStageId || undefined,
    }));
  };

  // Milestone Status Update Handler
  const handleMilestoneStatusChange = async (milestoneId: string, newStatus: MilestoneStatus) => {
    if (!selectedDealId) return;
    try {
      await updateMilestone(selectedDealId, milestoneId, { status: newStatus });
      await loadMilestones(selectedDealId);
    } catch (err: any) {
      setMilestonesError(err?.message || 'Failed to update milestone status.');
    }
  };

  // Stakeholder Creation Handler
  const handleCreateStakeholder = async (payload: StakeholderCreate) => {
    if (!selectedDealId) return;
    try {
      await createStakeholder(selectedDealId, payload);
      await loadStakeholders(selectedDealId);
    } catch (err: any) {
      setStakeholdersError(err?.message || 'Failed to create stakeholder.');
    }
  };

  // Forecast Refresh Handler
  const handleRefreshForecast = async () => {
    if (selectedDealId) {
      await loadForecast(selectedDealId);
    }
  };

  // Active selected deal object
  const activeDeal = useMemo(() => {
    return deals.find((d) => d.id === selectedDealId) || null;
  }, [deals, selectedDealId]);

  if (!user) {
    return null;
  }

  return (
    <div
      data-testid="deals-page"
      className={className}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-background, #fbf9f4)',
        color: 'var(--color-on-background, #1b1c19)',
        fontFamily: 'var(--font-sans, "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif)',
      }}
    >
      <NavMenu user={user} onLogout={onLogout} />

      <main
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '32px 24px 64px 24px',
        }}
      >
        {/* Page Header */}
        <header
          data-testid="deals-header"
          style={{
            marginBottom: '32px',
            borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
            paddingBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '16px',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--color-surface-tint, #715a3f)',
                  marginBottom: '4px',
                  display: 'block',
                }}
              >
                Pipeline Intelligence & Revenue Analytics
              </span>
              <h1
                data-testid="deals-page-title"
                style={{
                  fontSize: '32px',
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontWeight: 400,
                  color: 'var(--color-on-surface, #1b1c19)',
                  margin: 0,
                  lineHeight: '1.2',
                }}
              >
                Sales Pipeline Dashboard
              </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                data-testid="refresh-dashboard-button"
                onClick={() => {
                  loadFunnel(appliedFilters);
                  loadDealsList(appliedFilters);
                  if (selectedDealId) {
                    loadMilestones(selectedDealId);
                    loadStakeholders(selectedDealId);
                    loadForecast(selectedDealId);
                  }
                }}
                style={{
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  color: 'var(--color-primary, #59452b)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: '0.25rem',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                }}
              >
                ↻ Refresh All Data
              </button>
            </div>
          </div>
        </header>

        {/* Filter Controls Section */}
        <section
          data-testid="filter-controls-section"
          style={{
            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            padding: '20px 24px',
            marginBottom: '32px',
            boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 500,
                color: 'var(--color-on-surface, #1b1c19)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>🔍</span> Pipeline Visual Filtering
            </h2>
            {Object.keys(appliedFilters).length > 0 && (
              <span
                data-testid="active-filters-badge"
                style={{
                  fontSize: '12px',
                  backgroundColor: 'var(--color-primary-fixed, #fdddbb)',
                  color: 'var(--color-on-primary-fixed, #281804)',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontWeight: 500,
                }}
              >
                {Object.keys(appliedFilters).length} active filter(s)
              </span>
            )}
          </div>

          <form
            onSubmit={handleApplyFilters}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
              alignItems: 'end',
            }}
          >
            {/* Start Date */}
            <div>
              <label
                htmlFor="filter-start-date"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginBottom: '4px',
                }}
              >
                Start Date
              </label>
              <input
                id="filter-start-date"
                type="date"
                data-testid="filter-start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '0.25rem',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'var(--color-surface, #fbf9f4)',
                  fontSize: '13px',
                  color: 'var(--color-on-surface, #1b1c19)',
                }}
              />
            </div>

            {/* End Date */}
            <div>
              <label
                htmlFor="filter-end-date"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginBottom: '4px',
                }}
              >
                End Date
              </label>
              <input
                id="filter-end-date"
                type="date"
                data-testid="filter-end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '0.25rem',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'var(--color-surface, #fbf9f4)',
                  fontSize: '13px',
                  color: 'var(--color-on-surface, #1b1c19)',
                }}
              />
            </div>

            {/* Min Value */}
            <div>
              <label
                htmlFor="filter-min-value"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginBottom: '4px',
                }}
              >
                Min Value ($)
              </label>
              <input
                id="filter-min-value"
                type="number"
                placeholder="e.g. 10000"
                data-testid="filter-min-value"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '0.25rem',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'var(--color-surface, #fbf9f4)',
                  fontSize: '13px',
                  color: 'var(--color-on-surface, #1b1c19)',
                }}
              />
            </div>

            {/* Max Value */}
            <div>
              <label
                htmlFor="filter-max-value"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginBottom: '4px',
                }}
              >
                Max Value ($)
              </label>
              <input
                id="filter-max-value"
                type="number"
                placeholder="e.g. 500000"
                data-testid="filter-max-value"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '0.25rem',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'var(--color-surface, #fbf9f4)',
                  fontSize: '13px',
                  color: 'var(--color-on-surface, #1b1c19)',
                }}
              />
            </div>

            {/* Stage ID */}
            <div>
              <label
                htmlFor="filter-stage-id"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginBottom: '4px',
                }}
              >
                Pipeline Stage ID
              </label>
              <input
                id="filter-stage-id"
                type="text"
                placeholder="e.g. stage-proposal"
                data-testid="filter-stage-id"
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '0.25rem',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'var(--color-surface, #fbf9f4)',
                  fontSize: '13px',
                  color: 'var(--color-on-surface, #1b1c19)',
                }}
              />
            </div>

            {/* Team Member ID */}
            <div>
              <label
                htmlFor="filter-team-member-id"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginBottom: '4px',
                }}
              >
                Team Member ID
              </label>
              <input
                id="filter-team-member-id"
                type="text"
                placeholder="e.g. usr-rep-101"
                data-testid="filter-team-member-id"
                value={teamMemberId}
                onChange={(e) => setTeamMemberId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '0.25rem',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'var(--color-surface, #fbf9f4)',
                  fontSize: '13px',
                  color: 'var(--color-on-surface, #1b1c19)',
                }}
              />
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                gridColumn: '1 / -1',
                justifyContent: 'flex-end',
                marginTop: '8px',
              }}
            >
              <button
                type="button"
                data-testid="reset-filters-button"
                onClick={handleResetFilters}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: '0.25rem',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
              <button
                type="submit"
                data-testid="apply-filters-button"
                style={{
                  backgroundColor: 'var(--color-primary, #59452b)',
                  color: 'var(--color-on-primary, #ffffff)',
                  border: 'none',
                  borderRadius: '0.25rem',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Apply Filters
              </button>
            </div>
          </form>
        </section>

        {/* Funnel Chart Section */}
        <section
          data-testid="funnel-chart-section"
          style={{
            marginBottom: '32px',
          }}
        >
          <FunnelChart
            summary={funnelSummary}
            selectedStageId={appliedFilters.stage_id || null}
            onStageSelect={handleFunnelStageSelect}
            isLoading={isLoadingFunnel}
            error={funnelError}
          />
        </section>

        {/* Deal Selection Bar & Deal Details Section */}
        <section
          data-testid="deals-selection-section"
          style={{
            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            padding: '24px',
            marginBottom: '32px',
            boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              paddingBottom: '20px',
              borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
              marginBottom: '20px',
            }}
          >
            <div>
              <h2
                data-testid="deal-details-heading"
                style={{
                  fontSize: '20px',
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontWeight: 400,
                  color: 'var(--color-on-surface, #1b1c19)',
                  margin: '0 0 4px 0',
                }}
              >
                Deal Deep-Dive Analysis
              </h2>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  margin: 0,
                }}
              >
                Select a deal to inspect milestone progress, stakeholder relationship graph, and AI timeline predictions.
              </p>
            </div>

            {/* Deal Selector Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label
                htmlFor="deal-selector"
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--color-on-surface-variant, #4e453d)',
                }}
              >
                Selected Deal:
              </label>
              <select
                id="deal-selector"
                data-testid="deal-selector"
                value={selectedDealId || ''}
                onChange={(e) => setSelectedDealId(e.target.value || null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '0.25rem',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'var(--color-surface, #fbf9f4)',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--color-on-surface, #1b1c19)',
                  minWidth: '220px',
                }}
              >
                {deals.length === 0 ? (
                  <option value="">No deals available</option>
                ) : (
                  deals.map((deal) => (
                    <option key={deal.id} value={deal.id} data-testid={`deal-option-${deal.id}`}>
                      {deal.title} ({formatCurrency(deal.monetary_value)})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Active Selected Deal Banner */}
          {activeDeal ? (
            <div
              data-testid="active-deal-banner"
              style={{
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: '0.375rem',
                padding: '16px 20px',
                marginBottom: '24px',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--color-surface-tint, #715a3f)',
                  }}
                >
                  Active Deal Context
                </span>
                <h3
                  data-testid="active-deal-title"
                  style={{
                    fontSize: '18px',
                    fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                    fontWeight: 400,
                    color: 'var(--color-on-surface, #1b1c19)',
                    margin: '2px 0 0 0',
                  }}
                >
                  {activeDeal.title}
                </h3>
              </div>

              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                    Monetary Value
                  </span>
                  <span
                    data-testid="active-deal-value"
                    style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-primary, #59452b)' }}
                  >
                    {formatCurrency(activeDeal.monetary_value)}
                  </span>
                </div>

                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                    Pipeline Stage
                  </span>
                  <span
                    data-testid="active-deal-stage"
                    style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-on-surface, #1b1c19)' }}
                  >
                    {activeDeal.stage_id}
                  </span>
                </div>

                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                    Win Probability
                  </span>
                  <span
                    data-testid="active-deal-probability"
                    style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-tertiary, #374a5f)' }}
                  >
                    {(activeDeal.win_probability <= 1 ? activeDeal.win_probability * 100 : activeDeal.win_probability).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div
              data-testid="no-deal-selected-banner"
              style={{
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                border: '1px dashed var(--color-outline-variant, #d1c4b9)',
                borderRadius: '0.375rem',
                padding: '20px',
                textAlign: 'center',
                color: 'var(--color-on-surface-variant, #4e453d)',
                fontSize: '14px',
                marginBottom: '24px',
              }}
            >
              No deal currently selected. Please choose a deal above to inspect detailed analytics.
            </div>
          )}

          {/* View Tab Selector */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
              marginBottom: '24px',
              gap: '8px',
            }}
          >
            {[
              { id: 'all', label: 'All Integrated Analytics' },
              { id: 'milestones', label: 'Milestone Tracker' },
              { id: 'stakeholders', label: 'Stakeholder Graph' },
              { id: 'forecast', label: 'Timeline Forecast' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    border: 'none',
                    borderBottom: isActive ? '2px solid var(--color-primary, #59452b)' : '2px solid transparent',
                    backgroundColor: 'transparent',
                    color: isActive ? 'var(--color-primary, #59452b)' : 'var(--color-on-surface-variant, #4e453d)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content 1: Milestones */}
          {(activeTab === 'all' || activeTab === 'milestones') && (
            <div data-testid="section-milestones" style={{ marginBottom: '32px' }}>
              <MilestoneTracker
                milestones={milestones}
                dealId={selectedDealId || ''}
                isLoading={isLoadingMilestones}
                error={milestonesError}
                onStatusChange={handleMilestoneStatusChange}
              />
            </div>
          )}

          {/* Tab Content 2: Stakeholder Network Graph */}
          {(activeTab === 'all' || activeTab === 'stakeholders') && (
            <div data-testid="section-stakeholders" style={{ marginBottom: '32px' }}>
              <StakeholderGraph
                graphData={stakeholderGraph}
                dealId={selectedDealId || ''}
                isLoading={isLoadingStakeholders}
                error={stakeholdersError}
                onCreateStakeholder={handleCreateStakeholder}
                onRefresh={() => selectedDealId && loadStakeholders(selectedDealId)}
              />
            </div>
          )}

          {/* Tab Content 3: Timeline Forecast */}
          {(activeTab === 'all' || activeTab === 'forecast') && (
            <div data-testid="section-forecast" style={{ marginBottom: '16px' }}>
              <TimelineForecast
                forecast={timelineForecast}
                dealId={selectedDealId || ''}
                milestones={milestones}
                isLoading={isLoadingForecast}
                error={forecastError}
                onRefreshForecast={handleRefreshForecast}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/**
 * Default Page Route Component for `/deals`.
 * Encapsulates inner DealsContent within ProtectedRoute session guard.
 */
export default function DealsPage(props: any = {}) {
  return (
    <ProtectedRoute fetchUser={props.fetchUser}>
      <DealsContent {...props} />
    </ProtectedRoute>
  );
}
