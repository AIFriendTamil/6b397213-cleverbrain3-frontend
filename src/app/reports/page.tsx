'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute, useAuth } from '../../components/protected_route';
import { NavMenu } from '../../components/nav_menu';
import { CurrentUserResponse } from '../../services/auth';
import {
  getPerformanceReport as defaultGetPerformanceReport,
  PerformanceReport,
  PerformanceReportParams,
  SeverityPerformance,
} from '../../services/tickets';

/**
 * Properties for Operational Performance Reports Page Component.
 */
export interface ReportsPageProps {
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Initial pre-loaded performance report object */
  initialReport?: PerformanceReport | null;
  /** Initial start_time filter query value */
  initialStartTime?: string;
  /** Initial end_time filter query value */
  initialEndTime?: string;
  /** Initial organization_id filter query value */
  initialOrganizationId?: string;
  /** Initial severity filter query value ('P1', 'P2', 'P3', or '') */
  initialSeverity?: string;
  /** Whether the component should automatically fetch metrics on mount/filter submission (default: true) */
  autoFetch?: boolean;
  /** Custom performance report fetcher function for testing or custom client injection */
  fetchReport?: (params?: PerformanceReportParams) => Promise<PerformanceReport>;
  /** Custom container CSS class name */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Inner Operational Performance Dashboard Content Component consuming active user session context.
 * Renders page navigation header, query filter controls (time range, org, severity), MTTR KPI metrics,
 * SLA compliance metrics, CSAT satisfaction ratings distribution, and severity breakdown table.
 * Styled following the Linen & Logic editorial design system.
 */
function _ReportsPageContent({
  user: explicitUser,
  onLogout,
  initialReport = null,
  initialStartTime = '',
  initialEndTime = '',
  initialOrganizationId = '',
  initialSeverity = '',
  autoFetch = true,
  fetchReport: customFetchReport,
  className = '',
  'data-testid': testId = 'reports-page',
}: ReportsPageProps) {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  // Filter input states
  const [startTime, setStartTime] = useState<string>(initialStartTime);
  const [endTime, setEndTime] = useState<string>(initialEndTime);
  const [organizationId, setOrganizationId] = useState<string>(initialOrganizationId);
  const [severity, setSeverity] = useState<string>(initialSeverity);

  // Active filters applied in report fetch
  const [appliedParams, setAppliedParams] = useState<PerformanceReportParams>({
    start_time: initialStartTime || undefined,
    end_time: initialEndTime || undefined,
    organization_id: initialOrganizationId || undefined,
    severity: initialSeverity || undefined,
  });

  // Report data states
  const [report, setReport] = useState<PerformanceReport | null>(initialReport);
  const [isLoading, setIsLoading] = useState<boolean>(autoFetch && !initialReport);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load operational performance report metrics from API.
   */
  const loadReport = useCallback(
    async (paramsToFetch: PerformanceReportParams) => {
      setIsLoading(true);
      setError(null);
      try {
        const fetcher = customFetchReport || defaultGetPerformanceReport;
        const data = await fetcher(paramsToFetch);
        setReport(data);
      } catch (err: any) {
        const msg = err?.message || 'Failed to load operational performance report.';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [customFetchReport]
  );

  // Fetch report on mount if autoFetch is true and initialReport is null
  useEffect(() => {
    if (autoFetch && !initialReport) {
      loadReport(appliedParams);
    }
  }, [autoFetch, initialReport, appliedParams, loadReport]);

  /**
   * Handle Apply Filters click.
   */
  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams: PerformanceReportParams = {
      start_time: startTime.trim() || undefined,
      end_time: endTime.trim() || undefined,
      organization_id: organizationId.trim() || undefined,
      severity: severity || undefined,
    };
    setAppliedParams(newParams);
    loadReport(newParams);
  };

  /**
   * Handle Clear / Reset Filters click.
   */
  const handleClearFilters = () => {
    setStartTime('');
    setEndTime('');
    setOrganizationId('');
    setSeverity('');
    const emptyParams: PerformanceReportParams = {};
    setAppliedParams(emptyParams);
    loadReport(emptyParams);
  };

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
        {/* Header Breadcrumb & Section Info */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: 'var(--color-outline, #80756b)',
              marginBottom: '8px',
            }}
          >
            <Link
              href="/dashboard"
              style={{ color: 'inherit', textDecoration: 'none' }}
              className="hover:underline"
            >
              Portal Hub
            </Link>
            <span>/</span>
            <Link
              href="/tickets"
              style={{ color: 'inherit', textDecoration: 'none' }}
              className="hover:underline"
            >
              Support Tickets
            </Link>
            <span>/</span>
            <span style={{ color: 'var(--color-on-surface, #1b1c19)', fontWeight: 500 }}>
              Performance Reports
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <h1
                data-testid="reports-header-title"
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '32px',
                  fontWeight: 400,
                  lineHeight: 1.2,
                  color: 'var(--color-on-surface, #1b1c19)',
                  margin: '0 0 8px 0',
                }}
              >
                Operational Performance Dashboard
              </h1>
              <p
                style={{
                  fontSize: '15px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  margin: 0,
                }}
              >
                Track Mean Time To Resolution (MTTR), SLA compliance rates, and Customer Satisfaction (CSAT) metrics.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Link
                href="/tickets"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-surface-container, #f0eee9)',
                  color: 'var(--color-primary, #59452b)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                &larr; Return to Ticket Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <section
          data-testid="reports-filter-section"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '6px',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            padding: '20px 24px',
            marginBottom: '32px',
            boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
          }}
        >
          <form onSubmit={handleApplyFilters}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                alignItems: 'flex-end',
              }}
            >
              {/* Start Time Filter */}
              <div>
                <label
                  htmlFor="start-time-input"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '6px',
                  }}
                >
                  Start Time (ISO/Date)
                </label>
                <input
                  id="start-time-input"
                  data-testid="start-time-input"
                  type="text"
                  placeholder="e.g. 2026-01-01T00:00:00Z"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: '#ffffff',
                    fontSize: '14px',
                    color: 'var(--color-on-surface, #1b1c19)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* End Time Filter */}
              <div>
                <label
                  htmlFor="end-time-input"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '6px',
                  }}
                >
                  End Time (ISO/Date)
                </label>
                <input
                  id="end-time-input"
                  data-testid="end-time-input"
                  type="text"
                  placeholder="e.g. 2026-12-31T23:59:59Z"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: '#ffffff',
                    fontSize: '14px',
                    color: 'var(--color-on-surface, #1b1c19)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Organization Filter */}
              <div>
                <label
                  htmlFor="org-id-input"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '6px',
                  }}
                >
                  Organization ID
                </label>
                <input
                  id="org-id-input"
                  data-testid="org-id-input"
                  type="text"
                  placeholder="e.g. tnt-org-101"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: '#ffffff',
                    fontSize: '14px',
                    color: 'var(--color-on-surface, #1b1c19)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Severity Filter */}
              <div>
                <label
                  htmlFor="severity-select"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '6px',
                  }}
                >
                  Severity
                </label>
                <select
                  id="severity-select"
                  data-testid="severity-select"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: '#ffffff',
                    fontSize: '14px',
                    color: 'var(--color-on-surface, #1b1c19)',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">All Severities</option>
                  <option value="P1">P1 - Critical</option>
                  <option value="P2">P2 - High</option>
                  <option value="P3">P3 - Normal</option>
                </select>
              </div>

              {/* Filter Buttons */}
              <div style={{ display: 'flex', gap: '8px', minWidth: '220px' }}>
                <button
                  type="submit"
                  data-testid="apply-filters-button"
                  style={{
                    flex: 1,
                    padding: '9px 16px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-primary, #59452b)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Apply Filters
                </button>
                <button
                  type="button"
                  data-testid="clear-filters-button"
                  onClick={handleClearFilters}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                    color: 'var(--color-on-surface, #1b1c19)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Loading Indicator State */}
        {isLoading && (
          <div
            data-testid="reports-loading"
            style={{
              padding: '48px',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '6px',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              marginBottom: '32px',
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
            <p
              style={{
                marginTop: '16px',
                fontSize: '15px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Calculating MTTR, SLA compliance rates, and CSAT scores...
            </p>
          </div>
        )}

        {/* Error Alert Banner */}
        {error && !isLoading && (
          <div
            data-testid="reports-error"
            style={{
              padding: '16px 20px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-error-container, #ffdad6)',
              color: 'var(--color-on-error-container, #93000a)',
              border: '1px solid var(--color-error, #ba1a1a)',
              marginBottom: '32px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <strong style={{ display: 'block', marginBottom: '4px' }}>
                Error Loading Performance Report
              </strong>
              <span>{error}</span>
            </div>
            <button
              type="button"
              data-testid="retry-report-button"
              onClick={() => loadReport(appliedParams)}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                backgroundColor: 'var(--color-error, #ba1a1a)',
                color: '#ffffff',
                border: 'none',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Operational Performance Results View */}
        {!isLoading && !error && report && (
          <div>
            {/* Empty State Banner when 0 total tickets */}
            {report.total_tickets === 0 && (
              <div
                data-testid="reports-empty-state"
                style={{
                  padding: '40px',
                  textAlign: 'center',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px dashed var(--color-outline, #80756b)',
                  marginBottom: '32px',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                    fontSize: '20px',
                    margin: '0 0 8px 0',
                    color: 'var(--color-on-surface, #1b1c19)',
                  }}
                >
                  No Ticket Metrics Available
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    maxWidth: '500px',
                    margin: '0 auto',
                  }}
                >
                  There are no support ticket records matching the specified filters or date range.
                  Try clearing or adjusting your search filters.
                </p>
              </div>
            )}

            {/* Top KPI Metric Cards Grid */}
            <div
              data-testid="reports-kpi-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '20px',
                marginBottom: '32px',
              }}
            >
              {/* Ticket Volume Summary Card */}
              <div
                data-testid="kpi-card-tickets"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '8px',
                  }}
                >
                  Ticket Volume Summary
                </div>
                <div
                  data-testid="kpi-value-total-tickets"
                  style={{
                    fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                    fontSize: '36px',
                    fontWeight: 400,
                    color: 'var(--color-on-surface, #1b1c19)',
                    lineHeight: 1,
                    marginBottom: '12px',
                  }}
                >
                  {report.total_tickets}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--color-surface-container-high, #eae8e3)',
                    paddingTop: '8px',
                  }}
                >
                  <span>Open: <strong data-testid="kpi-open-tickets">{report.open_tickets}</strong></span>
                  <span>Resolved: <strong data-testid="kpi-resolved-tickets">{report.resolved_tickets}</strong></span>
                </div>
              </div>

              {/* MTTR Card */}
              <div
                data-testid="kpi-card-mttr"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '8px',
                  }}
                >
                  Mean Time To Resolution (MTTR)
                </div>
                <div
                  data-testid="kpi-value-mttr"
                  style={{
                    fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                    fontSize: '32px',
                    fontWeight: 400,
                    color: 'var(--color-primary, #59452b)',
                    lineHeight: 1,
                    marginBottom: '12px',
                  }}
                >
                  {report.mttr.formatted_mttr || `${report.mttr.average_hours.toFixed(1)}h`}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    borderTop: '1px solid var(--color-surface-container-high, #eae8e3)',
                    paddingTop: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Average: <strong data-testid="kpi-mttr-hours">{report.mttr.average_hours.toFixed(1)} hrs</strong></span>
                  <span>Evaluated: <strong data-testid="kpi-mttr-count">{report.mttr.total_resolved_tickets} resolved</strong></span>
                </div>
              </div>

              {/* SLA Compliance Card */}
              <div
                data-testid="kpi-card-sla"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '8px',
                  }}
                >
                  SLA Compliance Rate
                </div>
                <div
                  data-testid="kpi-value-sla"
                  style={{
                    fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                    fontSize: '36px',
                    fontWeight: 400,
                    color:
                      report.sla_compliance.compliance_percentage >= 90
                        ? '#2e7d32'
                        : '#ba1a1a',
                    lineHeight: 1,
                    marginBottom: '12px',
                  }}
                >
                  {report.sla_compliance.compliance_percentage.toFixed(1)}%
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    borderTop: '1px solid var(--color-surface-container-high, #eae8e3)',
                    paddingTop: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Compliant: <strong data-testid="kpi-sla-compliant" style={{ color: '#2e7d32' }}>{report.sla_compliance.compliant_tickets}</strong></span>
                  <span>Breached: <strong data-testid="kpi-sla-breached" style={{ color: '#ba1a1a' }}>{report.sla_compliance.breached_tickets}</strong></span>
                </div>
              </div>

              {/* CSAT Rating Card */}
              <div
                data-testid="kpi-card-csat"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '8px',
                  }}
                >
                  CSAT Average Score
                </div>
                <div
                  data-testid="kpi-value-csat"
                  style={{
                    fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                    fontSize: '36px',
                    fontWeight: 400,
                    color: 'var(--color-primary, #59452b)',
                    lineHeight: 1,
                    marginBottom: '12px',
                  }}
                >
                  {report.csat.average_rating > 0
                    ? `${report.csat.average_rating.toFixed(2)} / 5.0`
                    : 'N/A'}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    borderTop: '1px solid var(--color-surface-container-high, #eae8e3)',
                    paddingTop: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Satisfaction: <strong data-testid="kpi-csat-pct">{report.csat.satisfaction_percentage.toFixed(1)}%</strong></span>
                  <span>Responses: <strong data-testid="kpi-csat-responses">{report.csat.total_responses}</strong></span>
                </div>
              </div>
            </div>

            {/* CSAT Rating Breakdown & Severity Performance Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '24px',
                marginBottom: '32px',
              }}
            >
              {/* CSAT Distribution Breakdown Visualizer */}
              <section
                data-testid="csat-breakdown-section"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                    fontSize: '20px',
                    fontWeight: 400,
                    margin: '0 0 4px 0',
                    color: 'var(--color-on-surface, #1b1c19)',
                  }}
                >
                  CSAT Survey Rating Distribution
                </h3>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    margin: '0 0 20px 0',
                  }}
                >
                  Distribution of customer rating scores on a 1 to 5 scale (4+ considered satisfied).
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[5, 4, 3, 2, 1].map((score) => {
                    const count = report.csat.rating_distribution
                      ? report.csat.rating_distribution[score] || 0
                      : 0;
                    const pct =
                      report.csat.total_responses > 0
                        ? ((count / report.csat.total_responses) * 100).toFixed(1)
                        : '0.0';

                    return (
                      <div
                        key={score}
                        data-testid={`csat-dist-row-${score}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          fontSize: '14px',
                        }}
                      >
                        <span
                          style={{
                            width: '60px',
                            fontWeight: 500,
                            color: 'var(--color-on-surface, #1b1c19)',
                          }}
                        >
                          {score} Star{score > 1 ? 's' : ''}
                        </span>

                        <div
                          style={{
                            flex: 1,
                            height: '10px',
                            backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                            borderRadius: '5px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            data-testid={`csat-dist-bar-${score}`}
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              backgroundColor:
                                score >= 4
                                  ? 'var(--color-primary, #59452b)'
                                  : score === 3
                                  ? 'var(--color-surface-tint, #715a3f)'
                                  : 'var(--color-secondary, #a43b2c)',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>

                        <span
                          data-testid={`csat-dist-count-${score}`}
                          style={{
                            width: '70px',
                            textAlign: 'right',
                            fontSize: '13px',
                            color: 'var(--color-on-surface-variant, #4e453d)',
                          }}
                        >
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Severity Performance Overview Cards */}
              <section
                data-testid="severity-overview-section"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                    fontSize: '20px',
                    fontWeight: 400,
                    margin: '0 0 4px 0',
                    color: 'var(--color-on-surface, #1b1c19)',
                  }}
                >
                  Severity Summary Quick View
                </h3>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    margin: '0 0 20px 0',
                  }}
                >
                  Aggregated MTTR and SLA performance across ticket urgency levels.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {['P1', 'P2', 'P3'].map((sevKey) => {
                    const sevData: SeverityPerformance | undefined =
                      report.severity_breakdown ? report.severity_breakdown[sevKey] : undefined;

                    if (!sevData) {
                      return null;
                    }

                    const badgeBg =
                      sevKey === 'P1'
                        ? '#ffebee'
                        : sevKey === 'P2'
                        ? '#fff3e0'
                        : '#f1f8e9';
                    const badgeText =
                      sevKey === 'P1'
                        ? '#c62828'
                        : sevKey === 'P2'
                        ? '#e65100'
                        : '#33691e';

                    return (
                      <div
                        key={sevKey}
                        data-testid={`sev-summary-card-${sevKey}`}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          border: '1px solid var(--color-outline-variant, #d1c4b9)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: badgeBg,
                              color: badgeText,
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            {sevKey}
                          </span>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: '#1b1c19' }}>
                              {sevData.total_tickets} Total Tickets
                            </div>
                            <div style={{ fontSize: '12px', color: '#4e453d' }}>
                              MTTR: {sevData.mttr.formatted_mttr || `${sevData.mttr.average_hours.toFixed(1)}h`}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color:
                                sevData.sla_compliance.compliance_percentage >= 90
                                  ? '#2e7d32'
                                  : '#ba1a1a',
                            }}
                          >
                            {sevData.sla_compliance.compliance_percentage.toFixed(1)}% SLA
                          </div>
                          <div style={{ fontSize: '12px', color: '#4e453d' }}>
                            CSAT: {sevData.csat.average_rating > 0 ? `${sevData.csat.average_rating.toFixed(1)}★` : 'N/A'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Detailed Severity Breakdown Data Table */}
            <section
              data-testid="severity-table-section"
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '6px',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(115, 92, 65, 0.05)',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '20px',
                  fontWeight: 400,
                  margin: '0 0 16px 0',
                  color: 'var(--color-on-surface, #1b1c19)',
                }}
              >
                Severity Level Performance Breakdown
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: '14px',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: '2px solid var(--color-outline-variant, #d1c4b9)',
                        backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                      }}
                    >
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Severity Level</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Total Tickets</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>MTTR (Formatted)</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>MTTR (Avg Hours)</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>SLA Compliance %</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Compliant / Breached</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>CSAT Avg Rating</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>CSAT Responses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(report.severity_breakdown || {}).length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            padding: '24px',
                            textAlign: 'center',
                            color: 'var(--color-on-surface-variant, #4e453d)',
                          }}
                        >
                          No severity breakdown metrics available for this query context.
                        </td>
                      </tr>
                    ) : (
                      Object.entries(report.severity_breakdown).map(([sevKey, sevData]) => (
                        <tr
                          key={sevKey}
                          data-testid={`sev-table-row-${sevKey}`}
                          style={{
                            borderBottom: '1px solid var(--color-surface-container-high, #eae8e3)',
                          }}
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                backgroundColor:
                                  sevKey === 'P1'
                                    ? '#ffebee'
                                    : sevKey === 'P2'
                                    ? '#fff3e0'
                                    : '#f1f8e9',
                                color:
                                  sevKey === 'P1'
                                    ? '#c62828'
                                    : sevKey === 'P2'
                                    ? '#e65100'
                                    : '#33691e',
                                fontSize: '12px',
                              }}
                            >
                              {sevKey}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>{sevData.total_tickets}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                            {sevData.mttr.formatted_mttr || 'N/A'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {sevData.mttr.average_hours.toFixed(1)} hrs
                          </td>
                          <td
                            style={{
                              padding: '12px 16px',
                              fontWeight: 600,
                              color:
                                sevData.sla_compliance.compliance_percentage >= 90
                                  ? '#2e7d32'
                                  : '#ba1a1a',
                            }}
                          >
                            {sevData.sla_compliance.compliance_percentage.toFixed(1)}%
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ color: '#2e7d32' }}>
                              {sevData.sla_compliance.compliant_tickets}
                            </span>
                            {' / '}
                            <span style={{ color: '#ba1a1a' }}>
                              {sevData.sla_compliance.breached_tickets}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                            {sevData.csat.average_rating > 0
                              ? `${sevData.csat.average_rating.toFixed(2)} / 5.0`
                              : 'N/A'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {sevData.csat.total_responses}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Page component wrapper for Operational Performance Reports Page.
 * Enforces session authentication via ProtectedRoute component guard.
 */
export default function ReportsPage(props: any = {}) {
  return (
    <ProtectedRoute fetchUser={props?.fetchUser}>
      <_ReportsPageContent {...props} />
    </ProtectedRoute>
  );
}
