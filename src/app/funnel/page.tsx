'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProtectedRoute, useAuth } from '../../components/protected_route';
import { NavMenu } from '../../components/nav_menu';
import { FunnelChart, ConversionFunnelFilterParams } from '../../components/funnel/FunnelChart';
import { CurrentUserResponse } from '../../services/auth';
import {
  FunnelStageMetrics,
  StageLeadDrillDownResponse,
  getAcquisitionSources,
  getCampaigns,
  getTerritoryHeatmap,
} from '../../services/api_client';

export interface FunnelPageProps {
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Preloaded funnel stages array */
  initialStages?: FunnelStageMetrics[] | null;
  /** Currently selected stage ID for lead drill-down */
  selectedStageId?: string | null;
  /** Preloaded drill-down leads response */
  selectedStageLeads?: StageLeadDrillDownResponse | null;
  /** Initial filter parameters */
  initialFilters?: ConversionFunnelFilterParams;
  /** Filter change callback */
  onFilterChange?: (filters: ConversionFunnelFilterParams) => void;
  /** Stage selection callback */
  onStageSelect?: (stageId: string | null) => void;
  /** Stage click callback */
  onStageClick?: (stage: FunnelStageMetrics) => void;
  /** Lead row click callback */
  onLeadClick?: (leadId: string) => void;
  /** Available lead sources selector options */
  availableSources?: Array<{ source_id: string; source_name: string }>;
  /** Available campaigns selector options */
  availableCampaigns?: Array<{ campaign_id: string; campaign_name: string }>;
  /** Available regions selector options */
  availableRegions?: string[];
  /** Loading state indicator override */
  isLoading?: boolean;
  /** Drill-down loading state override */
  isDrillDownLoading?: boolean;
  /** Error message override */
  error?: string | null;
  /** Whether components auto-fetch filter options from backend API */
  autoFetch?: boolean;
  /** Custom container CSS class name */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Inner Funnel Analytics Page Content Component consuming active user session context.
 * Renders page navigation header, brand badge, quick-action links to related analytics hubs
 * (Acquisition & ROI, Campaign Matrix, Territory Heatmap, Meetings), and the FunnelChart component.
 * Conforms to the Linen & Logic editorial design system.
 */
function FunnelPageContent({
  user: explicitUser,
  onLogout,
  initialStages,
  selectedStageId,
  selectedStageLeads,
  initialFilters,
  onFilterChange,
  onStageSelect,
  onStageClick,
  onLeadClick,
  availableSources: availableSourcesProp,
  availableCampaigns: availableCampaignsProp,
  availableRegions: availableRegionsProp,
  isLoading,
  isDrillDownLoading,
  error,
  autoFetch = true,
  className = '',
  'data-testid': testId = 'funnel-page',
}: FunnelPageProps) {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  const [sourcesOptions, setSourcesOptions] = useState<Array<{ source_id: string; source_name: string }>>(
    availableSourcesProp ?? []
  );
  const [campaignsOptions, setCampaignsOptions] = useState<Array<{ campaign_id: string; campaign_name: string }>>(
    availableCampaignsProp ?? []
  );
  const [regionsOptions, setRegionsOptions] = useState<string[]>(availableRegionsProp ?? []);

  useEffect(() => {
    if (availableSourcesProp !== undefined) {
      setSourcesOptions(availableSourcesProp);
    }
  }, [availableSourcesProp]);

  useEffect(() => {
    if (availableCampaignsProp !== undefined) {
      setCampaignsOptions(availableCampaignsProp);
    }
  }, [availableCampaignsProp]);

  useEffect(() => {
    if (availableRegionsProp !== undefined) {
      setRegionsOptions(availableRegionsProp);
    }
  }, [availableRegionsProp]);

  useEffect(() => {
    if (!autoFetch) return;

    if (availableSourcesProp === undefined) {
      getAcquisitionSources()
        .then((sources) => {
          if (sources && Array.isArray(sources)) {
            setSourcesOptions(sources.map((s) => ({ source_id: s.source_id, source_name: s.source_name })));
          }
        })
        .catch(() => {
          /* ignore filter option fetch failures */
        });
    }

    if (availableCampaignsProp === undefined) {
      getCampaigns()
        .then((campaigns) => {
          if (campaigns && Array.isArray(campaigns)) {
            setCampaignsOptions(campaigns.map((c) => ({ campaign_id: c.campaign_id, campaign_name: c.campaign_name })));
          }
        })
        .catch(() => {
          /* ignore filter option fetch failures */
        });
    }

    if (availableRegionsProp === undefined) {
      getTerritoryHeatmap()
        .then((items) => {
          if (items && Array.isArray(items)) {
            const uniqueRegions = Array.from(new Set(items.map((i) => i.region_name))).filter(Boolean);
            setRegionsOptions(uniqueRegions);
          }
        })
        .catch(() => {
          /* ignore filter option fetch failures */
        });
    }
  }, [autoFetch, availableSourcesProp, availableCampaignsProp, availableRegionsProp]);

  if (!user) {
    return null;
  }

  return (
    <div
      data-testid={testId}
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
        {/* Page Header Section */}
        <header
          data-testid="funnel-header"
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
                data-testid="funnel-eyebrow"
                style={{
                  display: 'inline-block',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--color-primary-container, #735c41)',
                  marginBottom: '6px',
                }}
              >
                Lead Acquisition & Funnel Analytics
              </span>
              <h1
                data-testid="funnel-title"
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '32px',
                  fontWeight: 400,
                  margin: 0,
                  color: 'var(--color-on-surface, #1b1c19)',
                  lineHeight: '1.2',
                }}
              >
                Conversion Funnel & Operational Bottlenecks
              </h1>
              <p
                data-testid="funnel-description"
                style={{
                  fontSize: '15px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginTop: '8px',
                  marginBottom: 0,
                  maxWidth: '720px',
                  lineHeight: '1.5',
                }}
              >
                Track lead progression across pipeline stages, identify operational bottlenecks where conversion rates fall below target thresholds, and drill down into individual lead records.
              </p>
            </div>

            {/* Quick action navigation links */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '12px',
                alignSelf: 'center',
              }}
            >
              <Link
                href="/acquisition"
                data-testid="acquisition-dashboard-link"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  color: 'var(--color-primary, #59452b)',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: '0 1px 2px rgba(115, 92, 65, 0.05)',
                }}
              >
                <span>Acquisition & ROI</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/campaigns"
                data-testid="campaign-matrix-link"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  color: 'var(--color-primary, #59452b)',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: '0 1px 2px rgba(115, 92, 65, 0.05)',
                }}
              >
                <span>Campaign Matrix</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/territory"
                data-testid="territory-heatmap-link"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  color: 'var(--color-primary, #59452b)',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: '0 1px 2px rgba(115, 92, 65, 0.05)',
                }}
              >
                <span>Territory Heatmap</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/meetings"
                data-testid="meetings-calendar-link"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  color: 'var(--color-primary, #59452b)',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: '0 1px 2px rgba(115, 92, 65, 0.05)',
                }}
              >
                <span>Sales Meetings</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Funnel Analytics Chart Section */}
        <section data-testid="funnel-chart-section">
          <FunnelChart
            stages={initialStages}
            selectedStageId={selectedStageId}
            selectedStageLeads={selectedStageLeads}
            initialFilters={initialFilters}
            onFilterChange={onFilterChange}
            onStageSelect={onStageSelect}
            onStageClick={onStageClick}
            onLeadClick={onLeadClick}
            availableSources={sourcesOptions}
            availableCampaigns={campaignsOptions}
            availableRegions={regionsOptions}
            isLoading={isLoading}
            isDrillDownLoading={isDrillDownLoading}
            error={error}
          />
        </section>
      </main>
    </div>
  );
}

/**
 * Main Funnel Analytics Page component.
 * Intercepts unauthenticated requests using ProtectedRoute guard and renders conversion funnel analytics interface.
 */
export default function FunnelPage(props: any = {}) {
  const {
    user: initialUser,
    fetchUser,
    onLogout,
    initialStages,
    selectedStageId,
    selectedStageLeads,
    initialFilters,
    onFilterChange,
    onStageSelect,
    onStageClick,
    onLeadClick,
    availableSources,
    availableCampaigns,
    availableRegions,
    isLoading,
    isDrillDownLoading,
    error,
    autoFetch = true,
    className = '',
    'data-testid': testId = 'funnel-page',
  } = props || {};
  if (initialUser) {
    return (
      <FunnelPageContent
        user={initialUser}
        onLogout={onLogout}
        initialStages={initialStages}
        selectedStageId={selectedStageId}
        selectedStageLeads={selectedStageLeads}
        initialFilters={initialFilters}
        onFilterChange={onFilterChange}
        onStageSelect={onStageSelect}
        onStageClick={onStageClick}
        onLeadClick={onLeadClick}
        availableSources={availableSources}
        availableCampaigns={availableCampaigns}
        availableRegions={availableRegions}
        isLoading={isLoading}
        isDrillDownLoading={isDrillDownLoading}
        error={error}
        autoFetch={autoFetch}
        className={className}
        data-testid={testId}
      />
    );
  }

  return (
    <ProtectedRoute fetchUser={fetchUser}>
      <FunnelPageContent
        onLogout={onLogout}
        initialStages={initialStages}
        selectedStageId={selectedStageId}
        selectedStageLeads={selectedStageLeads}
        initialFilters={initialFilters}
        onFilterChange={onFilterChange}
        onStageSelect={onStageSelect}
        onStageClick={onStageClick}
        onLeadClick={onLeadClick}
        availableSources={availableSources}
        availableCampaigns={availableCampaigns}
        availableRegions={availableRegions}
        isLoading={isLoading}
        isDrillDownLoading={isDrillDownLoading}
        error={error}
        autoFetch={autoFetch}
        className={className}
        data-testid={testId}
      />
    </ProtectedRoute>
  );
}
