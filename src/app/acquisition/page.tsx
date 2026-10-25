'use client';

import React from 'react';
import Link from 'next/link';
import { ProtectedRoute, useAuth } from '../../components/protected_route';
import { NavMenu } from '../../components/nav_menu';
import { AcquisitionDashboard } from '../../components/acquisition/AcquisitionDashboard';
import { CurrentUserResponse } from '../../services/auth';
import {
  AcquisitionSummary,
  SourceROIMetrics,
  AcquisitionFilterParams,
} from '../../services/api_client';

export interface AcquisitionPageProps {
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Preloaded acquisition summary metrics */
  initialSummary?: AcquisitionSummary | null;
  /** Preloaded list of individual lead source ROI metrics */
  initialSources?: SourceROIMetrics[] | null;
  /** Initial acquisition filter parameters */
  initialFilters?: AcquisitionFilterParams;
  /** Callback fired whenever user changes filter parameters */
  onFilterChange?: (filters: AcquisitionFilterParams) => void;
  /** Callback fired when a source row is selected */
  onSourceSelect?: (source: SourceROIMetrics) => void;
  /** Callback fired when a source ID is clicked */
  onSourceClick?: (sourceId: string) => void;
  /** Whether the component auto-fetches metrics on mount (default: true) */
  autoFetch?: boolean;
  /** Custom container CSS class name */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Inner Lead Acquisition Dashboard Content Component consuming active user session context.
 * Renders page navigation header, brand badge, quick-action links to related analytics hubs
 * (Funnel Analytics, Campaign Matrix, Territory Heatmap), and the AcquisitionDashboard component.
 * Conforms to the Linen & Logic editorial design system.
 */
function _AcquisitionPageContent({
  user: explicitUser,
  onLogout,
  initialSummary,
  initialSources,
  initialFilters,
  onFilterChange,
  onSourceSelect,
  onSourceClick,
  autoFetch = true,
  className = '',
  'data-testid': testId = 'acquisition-page',
}: AcquisitionPageProps) {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  if (!user) {
    return null;
  }

  // Determine effective sources prop for AcquisitionDashboard:
  // If initialSources is provided, pass it. If autoFetch is false and initialSources is undefined, pass [].
  const effectiveSources =
    initialSources !== undefined && initialSources !== null
      ? initialSources
      : autoFetch
      ? undefined
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
          data-testid="acquisition-header"
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
                data-testid="acquisition-eyebrow"
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
                data-testid="acquisition-title"
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '32px',
                  fontWeight: 400,
                  margin: 0,
                  color: 'var(--color-on-surface, #1b1c19)',
                  lineHeight: '1.2',
                }}
              >
                Lead Acquisition & ROI Dashboard
              </h1>
              <p
                data-testid="acquisition-description"
                style={{
                  fontSize: '15px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginTop: '8px',
                  marginBottom: 0,
                  maxWidth: '720px',
                  lineHeight: '1.5',
                }}
              >
                Track lead acquisition channels, evaluate quality scores, monitor marketing spend, and calculate return on investment (ROI).
              </p>
            </div>

            {/* Quick action links to Funnel, Campaign, and Territory Hubs */}
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
                <span>Campaign Comparison</span>
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
            </div>
          </div>
        </header>

        {/* Lead Acquisition & ROI Component */}
        <section data-testid="acquisition-dashboard-section">
          <AcquisitionDashboard
            summary={initialSummary}
            sources={effectiveSources}
            initialFilters={initialFilters}
            onFilterChange={onFilterChange}
            onSourceSelect={onSourceSelect}
            onSourceClick={onSourceClick}
          />
        </section>
      </main>
    </div>
  );
}

/**
 * Main Lead Acquisition Dashboard Page component.
 * Intercepts unauthenticated requests using ProtectedRoute guard and renders acquisition analytics interface.
 */
export default function AcquisitionPage(props: any = {}) {
  const {
    user: initialUser,
    fetchUser,
    onLogout,
    initialSummary,
    initialSources,
    initialFilters,
    onFilterChange,
    onSourceSelect,
    onSourceClick,
    autoFetch = true,
    className = '',
    'data-testid': testId = 'acquisition-page',
  } = props || {};

  if (initialUser) {
    return (
      <_AcquisitionPageContent
        user={initialUser}
        onLogout={onLogout}
        initialSummary={initialSummary}
        initialSources={initialSources}
        initialFilters={initialFilters}
        onFilterChange={onFilterChange}
        onSourceSelect={onSourceSelect}
        onSourceClick={onSourceClick}
        autoFetch={autoFetch}
        className={className}
        data-testid={testId}
      />
    );
  }

  return (
    <ProtectedRoute fetchUser={fetchUser}>
      <_AcquisitionPageContent
        onLogout={onLogout}
        initialSummary={initialSummary}
        initialSources={initialSources}
        initialFilters={initialFilters}
        onFilterChange={onFilterChange}
        onSourceSelect={onSourceSelect}
        onSourceClick={onSourceClick}
        autoFetch={autoFetch}
        className={className}
        data-testid={testId}
      />
    </ProtectedRoute>
  );
}
