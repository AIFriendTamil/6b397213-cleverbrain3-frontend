'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProtectedRoute, useAuth } from '../../components/protected_route';
import { NavMenu } from '../../components/nav_menu';
import {
  CampaignMatrix,
  CampaignMatrixFilterParams,
} from '../../components/campaigns/CampaignMatrix';
import { CurrentUserResponse } from '../../services/auth';
import {
  Campaign,
  CampaignComparisonMatrix,
  CampaignComparisonItem,
  getAcquisitionSources,
  getCampaigns,
  getTerritoryHeatmap,
} from '../../services/api_client';

export interface CampaignsPageProps {
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Preloaded campaign comparison matrix data */
  initialMatrix?: CampaignComparisonMatrix | null;
  /** Preloaded campaign comparison matrix data (alias for initialMatrix) */
  initialData?: CampaignComparisonMatrix | null;
  /** Preloaded list of available campaigns */
  initialCampaigns?: Campaign[] | null;
  /** Available campaigns selector options */
  availableCampaigns?: Campaign[] | null;
  /** Initial filter parameters */
  initialFilters?: CampaignMatrixFilterParams;
  /** Callback fired whenever user changes filter parameters */
  onFilterChange?: (filters: CampaignMatrixFilterParams) => void;
  /** Callback fired when a campaign header or card is selected */
  onCampaignSelect?: (campaignId: string) => void;
  /** Callback fired when a campaign row or card is clicked */
  onCampaignClick?: (campaign: CampaignComparisonItem) => void;
  /** Available lead sources selector options */
  availableSources?: Array<{ source_id: string; source_name: string }>;
  /** Available regions selector options */
  availableRegions?: string[];
  /** Loading state indicator override */
  isLoading?: boolean;
  /** Error message override */
  error?: string | null;
  /** Callback fired to trigger a manual data refresh */
  onRefresh?: () => void;
  /** Whether components auto-fetch filter options and matrix data from backend API (default: true) */
  autoFetch?: boolean;
  /** Custom container CSS class name */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Inner Campaign Performance Comparison Content Component consuming active user session context.
 * Renders page navigation header, eyebrow badge, quick-action links to related analytics hubs
 * (Acquisition & ROI, Funnel Analytics, Territory Heatmap, Sales Meetings), and the CampaignMatrix component.
 * Conforms to the Linen & Logic editorial design system.
 */
function _CampaignsPageContent({
  user: explicitUser,
  onLogout,
  initialMatrix,
  initialData,
  initialCampaigns,
  availableCampaigns: availableCampaignsProp,
  initialFilters,
  onFilterChange,
  onCampaignSelect,
  onCampaignClick,
  availableSources: availableSourcesProp,
  availableRegions: availableRegionsProp,
  isLoading,
  error,
  onRefresh,
  autoFetch = true,
  className = '',
  'data-testid': testId = 'campaigns-page',
}: CampaignsPageProps) {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  const [sourcesOptions, setSourcesOptions] = useState<Array<{ source_id: string; source_name: string }>>(
    availableSourcesProp ?? []
  );
  const [regionsOptions, setRegionsOptions] = useState<string[]>(availableRegionsProp ?? []);
  const [campaignsOptions, setCampaignsOptions] = useState<Campaign[]>(
    availableCampaignsProp ?? initialCampaigns ?? []
  );

  useEffect(() => {
    if (availableSourcesProp !== undefined) {
      setSourcesOptions(availableSourcesProp);
    }
  }, [availableSourcesProp]);

  useEffect(() => {
    if (availableRegionsProp !== undefined) {
      setRegionsOptions(availableRegionsProp);
    }
  }, [availableRegionsProp]);

  useEffect(() => {
    if (availableCampaignsProp !== undefined) {
      setCampaignsOptions(availableCampaignsProp || []);
    } else if (initialCampaigns !== undefined) {
      setCampaignsOptions(initialCampaigns || []);
    }
  }, [availableCampaignsProp, initialCampaigns]);

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

    if (availableCampaignsProp === undefined && initialCampaigns === undefined) {
      getCampaigns()
        .then((list) => {
          if (list && Array.isArray(list)) {
            setCampaignsOptions(list);
          }
        })
        .catch(() => {
          /* ignore filter option fetch failures */
        });
    }
  }, [autoFetch, availableSourcesProp, availableRegionsProp, availableCampaignsProp, initialCampaigns]);

  if (!user) {
    return null;
  }

  // Determine effective matrix prop for CampaignMatrix:
  // If initialMatrix or initialData is provided, use it.
  // If autoFetch is false and neither is provided, pass null (disabled auto-fetch).
  // If autoFetch is true and neither is provided, pass undefined so CampaignMatrix auto-fetches.
  const effectiveMatrix =
    initialMatrix !== undefined && initialMatrix !== null
      ? initialMatrix
      : initialData !== undefined && initialData !== null
      ? initialData
      : autoFetch
      ? undefined
      : null;

  // Determine effective availableCampaigns prop for CampaignMatrix:
  const effectiveCampaigns =
    availableCampaignsProp !== undefined
      ? availableCampaignsProp
      : initialCampaigns !== undefined
      ? initialCampaigns
      : autoFetch
      ? (campaignsOptions.length > 0 ? campaignsOptions : undefined)
      : [];

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
          data-testid="campaigns-header"
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
                data-testid="campaigns-eyebrow"
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
                Marketing Campaign Performance
              </span>
              <h1
                data-testid="campaigns-title"
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '32px',
                  fontWeight: 400,
                  margin: 0,
                  color: 'var(--color-on-surface, #1b1c19)',
                  lineHeight: '1.2',
                }}
              >
                Campaign Comparison Matrix
              </h1>
              <p
                data-testid="campaigns-description"
                style={{
                  fontSize: '15px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginTop: '8px',
                  marginBottom: 0,
                  maxWidth: '720px',
                  lineHeight: '1.5',
                }}
              >
                Compare side-by-side performance metrics across marketing campaigns, evaluate ROI, conversion efficiency, cost per lead, and lead quality.
              </p>
            </div>

            {/* Quick action links to related analytics hubs */}
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
                data-testid="acquisition-roi-link"
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
                <span>Lead Acquisition & ROI</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/funnel"
                data-testid="funnel-analytics-link"
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
                <span>Funnel Analytics</span>
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
                data-testid="sales-meetings-link"
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

        {/* Campaign Matrix Component Section */}
        <section data-testid="campaigns-matrix-section">
          <CampaignMatrix
            matrix={effectiveMatrix}
            availableCampaigns={effectiveCampaigns}
            availableSources={sourcesOptions}
            availableRegions={regionsOptions}
            initialFilters={initialFilters}
            onFilterChange={onFilterChange}
            onCampaignSelect={onCampaignSelect}
            onCampaignClick={onCampaignClick}
            isLoading={isLoading}
            error={error}
            onRefresh={onRefresh}
          />
        </section>
      </main>
    </div>
  );
}

/**
 * Main Campaign Performance Comparison Page component.
 * Intercepts unauthenticated requests using ProtectedRoute guard and renders campaign matrix comparison interface.
 */
export default function CampaignsPage(props: any = {}) {
  const {
    user: initialUser,
    fetchUser,
    onLogout,
    initialMatrix,
    initialData,
    initialCampaigns,
    availableCampaigns,
    initialFilters,
    onFilterChange,
    onCampaignSelect,
    onCampaignClick,
    availableSources,
    availableRegions,
    isLoading,
    error,
    onRefresh,
    autoFetch = true,
    className = '',
    'data-testid': testId = 'campaigns-page',
  } = props || {};

  if (initialUser) {
    return (
      <_CampaignsPageContent
        user={initialUser}
        onLogout={onLogout}
        initialMatrix={initialMatrix}
        initialData={initialData}
        initialCampaigns={initialCampaigns}
        availableCampaigns={availableCampaigns}
        initialFilters={initialFilters}
        onFilterChange={onFilterChange}
        onCampaignSelect={onCampaignSelect}
        onCampaignClick={onCampaignClick}
        availableSources={availableSources}
        availableRegions={availableRegions}
        isLoading={isLoading}
        error={error}
        onRefresh={onRefresh}
        autoFetch={autoFetch}
        className={className}
        data-testid={testId}
      />
    );
  }

  return (
    <ProtectedRoute fetchUser={fetchUser}>
      <_CampaignsPageContent
        onLogout={onLogout}
        initialMatrix={initialMatrix}
        initialData={initialData}
        initialCampaigns={initialCampaigns}
        availableCampaigns={availableCampaigns}
        initialFilters={initialFilters}
        onFilterChange={onFilterChange}
        onCampaignSelect={onCampaignSelect}
        onCampaignClick={onCampaignClick}
        availableSources={availableSources}
        availableRegions={availableRegions}
        isLoading={isLoading}
        error={error}
        onRefresh={onRefresh}
        autoFetch={autoFetch}
        className={className}
        data-testid={testId}
      />
    </ProtectedRoute>
  );
}
