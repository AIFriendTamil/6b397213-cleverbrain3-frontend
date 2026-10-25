'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProtectedRoute, useAuth } from '../../components/protected_route';
import { NavMenu } from '../../components/nav_menu';
import { CalendarView } from '../../components/meetings/CalendarView';
import { CurrentUserResponse } from '../../services/auth';
import {
  MeetingEvent,
  MeetingBrief,
  MeetingFilterParams,
  getScheduledMeetings,
  getFunnelStageLeads,
} from '../../services/api_client';

export interface MeetingsPageProps {
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Preloaded list of scheduled meeting events */
  initialEvents?: MeetingEvent[] | null;
  /** Currently selected meeting ID for brief drawer display */
  selectedMeetingId?: string | null;
  /** Initial meeting filter parameters */
  initialFilters?: MeetingFilterParams;
  /** Callback fired whenever user changes filter parameters */
  onFilterChange?: (filters: MeetingFilterParams) => void;
  /** Callback fired when a meeting event is selected or clicked */
  onMeetingSelect?: (meeting: MeetingEvent | null) => void;
  /** Callback fired when a new meeting is scheduled */
  onScheduleMeeting?: (meeting: MeetingEvent) => void;
  /** Callback fired when brief is refreshed or loaded */
  onBriefRefresh?: (brief: MeetingBrief) => void;
  /** Available leads for filter dropdown or scheduling form */
  availableLeads?: Array<{ lead_id: string; title_text?: string; name?: string; quality_score?: number }>;
  /** Override loading state */
  isLoading?: boolean;
  /** Override error message string */
  error?: string | null;
  /** Manual data refresh callback */
  onRefresh?: () => void;
  /** Whether components auto-fetch data on mount (default: true) */
  autoFetch?: boolean;
  /** Custom container CSS class name */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Inner Sales Meeting Management Content Component consuming active user session context.
 * Renders page navigation header, brand badge, quick-action links to related analytics hubs
 * (Acquisition & ROI, Funnel Analytics, Campaign Matrix, Territory Heatmap), and the CalendarView component.
 * Conforms to the Linen & Logic editorial design system.
 */
function _MeetingsPageContent({
  user: explicitUser,
  onLogout,
  initialEvents,
  selectedMeetingId = null,
  initialFilters,
  onFilterChange,
  onMeetingSelect,
  onScheduleMeeting,
  onBriefRefresh,
  availableLeads: availableLeadsProp,
  isLoading,
  error,
  onRefresh,
  autoFetch = true,
  className = '',
  'data-testid': testId = 'meetings-page',
}: MeetingsPageProps) {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  const [leadsOptions, setLeadsOptions] = useState<
    Array<{ lead_id: string; title_text?: string; name?: string; quality_score?: number }>
  >(availableLeadsProp ?? []);

  useEffect(() => {
    if (availableLeadsProp !== undefined) {
      setLeadsOptions(availableLeadsProp);
    }
  }, [availableLeadsProp]);

  useEffect(() => {
    if (autoFetch && availableLeadsProp === undefined) {
      // Attempt to fetch sample leads for calendar form selector
      getFunnelStageLeads('stage-mql', { page: 1, limit: 10 })
        .then((res) => {
          if (res && Array.isArray(res.leads)) {
            const mapped = res.leads.map((l) => ({
              lead_id: l.lead_id,
              title_text: `Lead #${l.lead_id.slice(-6)} (${l.region_name || 'General'})`,
              name: `Lead ${l.lead_id}`,
              quality_score: l.quality_score,
            }));
            setLeadsOptions(mapped);
          }
        })
        .catch(() => {
          // Silently handle fallback if drilldown API is unavailable
        });
    }
  }, [autoFetch, availableLeadsProp]);

  if (!user) {
    return null;
  }

  // Determine effective events prop for CalendarView:
  const effectiveEvents =
    initialEvents !== undefined && initialEvents !== null
      ? initialEvents
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
          data-testid="meetings-header"
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
                data-testid="meetings-eyebrow"
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
                Sales Meeting Management
              </span>
              <h1
                data-testid="meetings-title"
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '32px',
                  fontWeight: 400,
                  margin: 0,
                  color: 'var(--color-on-surface, #1b1c19)',
                  lineHeight: '1.2',
                }}
              >
                Sales Meetings & Prep Briefs
              </h1>
              <p
                data-testid="meetings-description"
                style={{
                  fontSize: '15px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginTop: '8px',
                  marginBottom: 0,
                  maxWidth: '720px',
                  lineHeight: '1.5',
                }}
              >
                Schedule and manage sales meetings with leads, sync calendar events, and access synthesized AI preparation briefs featuring lead interaction history and background notes.
              </p>
            </div>

            {/* Quick action links to Acquisition, Funnel, Campaign, and Territory Hubs */}
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
            </div>
          </div>
        </header>

        {/* Sales Meeting Management Calendar Section */}
        <section data-testid="calendar-view-section">
          <CalendarView
            events={effectiveEvents}
            selectedMeetingId={selectedMeetingId}
            initialFilters={initialFilters}
            onFilterChange={onFilterChange}
            onMeetingSelect={onMeetingSelect}
            onScheduleMeeting={onScheduleMeeting}
            onBriefRefresh={onBriefRefresh}
            availableLeads={leadsOptions}
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
 * Main Sales Meeting Management Page component.
 * Intercepts unauthenticated requests using ProtectedRoute guard and renders sales meeting calendar interface.
 */
export default function MeetingsPage(props: any = {}) {
  const {
    user: initialUser,
    fetchUser,
    onLogout,
    initialEvents,
    selectedMeetingId,
    initialFilters,
    onFilterChange,
    onMeetingSelect,
    onScheduleMeeting,
    onBriefRefresh,
    availableLeads,
    isLoading,
    error,
    onRefresh,
    autoFetch = true,
    className = '',
    'data-testid': testId = 'meetings-page',
  } = props || {};

  if (initialUser) {
    return (
      <_MeetingsPageContent
        user={initialUser}
        onLogout={onLogout}
        initialEvents={initialEvents}
        selectedMeetingId={selectedMeetingId}
        initialFilters={initialFilters}
        onFilterChange={onFilterChange}
        onMeetingSelect={onMeetingSelect}
        onScheduleMeeting={onScheduleMeeting}
        onBriefRefresh={onBriefRefresh}
        availableLeads={availableLeads}
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
      <_MeetingsPageContent
        onLogout={onLogout}
        initialEvents={initialEvents}
        selectedMeetingId={selectedMeetingId}
        initialFilters={initialFilters}
        onFilterChange={onFilterChange}
        onMeetingSelect={onMeetingSelect}
        onScheduleMeeting={onScheduleMeeting}
        onBriefRefresh={onBriefRefresh}
        availableLeads={availableLeads}
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
