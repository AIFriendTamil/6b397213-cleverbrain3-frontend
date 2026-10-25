'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute, useAuth } from '../../components/protected_route';
import { NavMenu } from '../../components/nav_menu';
import { CurrentUserResponse } from '../../services/auth';
import { MetricGrid } from '../../components/dashboard/MetricGrid';
import {
  getDashboardMetrics,
  triggerDashboardRefresh,
  DashboardMetricsResponse,
  GetMetricsOptions,
} from '../../services/dashboard';

export interface DashboardPageProps {
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Optional preloaded initial dashboard metrics response */
  initialMetrics?: DashboardMetricsResponse | null;
  /** Custom metrics fetcher function for test injection or custom API behavior */
  fetchMetrics?: (options?: GetMetricsOptions) => Promise<DashboardMetricsResponse>;
  /** Custom refresh trigger function */
  triggerRefresh?: () => Promise<void>;
  /** Live polling interval in milliseconds (default: 30000ms; set to 0 to disable auto-polling) */
  pollingInterval?: number;
  /** Initial baseline comparison period ('prior_month' or 'prior_quarter', default: 'prior_month') */
  defaultBaseline?: string;
  /** Roles override string */
  roles?: string;
  /** X-User-Roles header override string */
  xUserRoles?: string;
  /** X-User-Role header override string */
  xUserRole?: string;
}

/**
 * Inner Dashboard content component consuming active user session context.
 * Displays active user profile details, tenant isolation context, executive KPI cards,
 * live polling status, ISO update timestamps, and permitted portal hub cards.
 * Styled following the Linen & Logic editorial design system.
 */
function _DashboardContent({
  user: explicitUser,
  onLogout,
  initialMetrics,
  fetchMetrics: customFetchMetrics,
  triggerRefresh: customTriggerRefresh,
  pollingInterval = 30000,
  defaultBaseline = 'prior_month',
  roles,
  xUserRoles,
  xUserRole,
}: DashboardPageProps) {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  const [metricsData, setMetricsData] = useState<DashboardMetricsResponse | null>(
    initialMetrics || null
  );
  const [isLoadingMetrics, setIsLoadingMetrics] = useState<boolean>(!initialMetrics);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [baseline, setBaseline] = useState<string>(defaultBaseline);

  const getMetricsFn = useCallback(
    async (opts?: GetMetricsOptions) => {
      if (customFetchMetrics) {
        return customFetchMetrics(opts);
      }
      return getDashboardMetrics({
        baseline: opts?.baseline || baseline,
        roles: roles || (user as any)?.roles || (user as any)?.role,
        x_user_roles: xUserRoles,
        x_user_role: xUserRole,
      });
    },
    [customFetchMetrics, baseline, roles, xUserRoles, xUserRole, user]
  );

  const triggerRefreshFn = useCallback(async () => {
    if (customTriggerRefresh) {
      return customTriggerRefresh();
    }
    return triggerDashboardRefresh(
      {},
      {
        roles: roles || (user as any)?.roles || (user as any)?.role,
        x_user_roles: xUserRoles,
        x_user_role: xUserRole,
      }
    );
  }, [customTriggerRefresh, roles, xUserRoles, xUserRole, user]);

  // Handle metric fetching and periodic live polling
  useEffect(() => {
    let isMounted = true;

    const runFetch = async (showLoadingState: boolean) => {
      if (showLoadingState && !metricsData) {
        setIsLoadingMetrics(true);
      }
      try {
        const data = await getMetricsFn({ baseline });
        if (isMounted) {
          setMetricsData(data);
          setMetricsError(null);
        }
      } catch (err) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : String(err);
          setMetricsError(msg);
        }
      } finally {
        if (isMounted && showLoadingState) {
          setIsLoadingMetrics(false);
        }
      }
    };

    runFetch(!initialMetrics);

    let timer: NodeJS.Timeout | null = null;
    if (pollingInterval && pollingInterval > 0) {
      timer = setInterval(() => {
        runFetch(false);
      }, pollingInterval);
    }

    return () => {
      isMounted = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [baseline, getMetricsFn, pollingInterval, initialMetrics]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await triggerRefreshFn();
      const data = await getMetricsFn({ baseline });
      setMetricsData(data);
      setMetricsError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMetricsError(msg);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!user) {
    return null;
  }

  const effectiveRoles =
    roles ||
    xUserRoles ||
    xUserRole ||
    (user as any)?.roles ||
    (user as any)?.role ||
    '';

  const isPermissionDeniedError =
    metricsError !== null &&
    (metricsError.includes('403') ||
      metricsError.toLowerCase().includes('forbidden') ||
      metricsError.toLowerCase().includes('access denied') ||
      metricsError.toLowerCase().includes('permission denied') ||
      metricsError.toLowerCase().includes('unauthorized domain'));

  const hasNoAuthorizedMetrics =
    !isLoadingMetrics &&
    !metricsError &&
    metricsData !== null &&
    Array.isArray(metricsData.metrics) &&
    metricsData.metrics.length === 0;

  const showPermissionDeniedView = isPermissionDeniedError || hasNoAuthorizedMetrics;

  const lastUpdatedISO = metricsData?.last_updated_at || '';

  return (
    <div
      data-testid="dashboard-page"
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
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '40px 24px 80px',
        }}
      >
        {/* Header section */}
        <header style={{ marginBottom: '32px' }}>
          <span
            data-testid="dashboard-badge"
            style={{
              fontSize: '12px',
              fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
              fontWeight: '500',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--color-primary, #59452b)',
              marginBottom: '8px',
              display: 'block',
            }}
          >
            Portal Hub &bull; Active Session
          </span>
          <h1
            data-testid="dashboard-title"
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
              fontSize: '36px',
              fontWeight: '400',
              color: 'var(--color-primary, #59452b)',
              margin: '0 0 12px 0',
              lineHeight: '1.2',
            }}
          >
            Welcome, {user.full_name || 'User'}
          </h1>
          <p
            data-testid="dashboard-subtitle"
            style={{
              fontSize: '16px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              margin: 0,
            }}
          >
            Manage your account, view tenant isolation details, and track real-time operational KPIs.
          </p>
        </header>

        {/* Executive Performance Dashboard Section */}
        <section
          data-testid="executive-dashboard-section"
          style={{
            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            borderRadius: 'var(--radius-lg, 0.5rem)',
            padding: '28px',
            marginBottom: '40px',
            boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
          }}
        >
          {/* Executive Dashboard Header & Control Bar */}
          <div
            data-testid="executive-dashboard-header"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '24px',
              paddingBottom: '20px',
              borderBottom: '1px solid var(--color-surface-container-high, #eae8e3)',
            }}
          >
            <div>
              <h2
                data-testid="executive-dashboard-title"
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '24px',
                  fontWeight: '400',
                  color: 'var(--color-primary, #59452b)',
                  margin: '0 0 6px 0',
                }}
              >
                Executive Performance Dashboard
              </h2>
              <p
                data-testid="executive-dashboard-subtitle"
                style={{
                  fontSize: '14px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  margin: 0,
                }}
              >
                Consolidated real-time operational metrics across sales, leads, support, and finance.
              </p>
            </div>

            {/* Controls, Timestamp, and Polling Badge */}
            <div
              data-testid="dashboard-controls-bar"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              {/* Baseline Period Selector */}
              <div
                data-testid="baseline-selector"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <label
                  htmlFor="baseline-period-select"
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-outline, #80756b)',
                    fontWeight: '500',
                  }}
                >
                  Baseline:
                </label>
                <select
                  id="baseline-period-select"
                  data-testid="baseline-select"
                  value={baseline}
                  onChange={(e) => setBaseline(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                    color: 'var(--color-on-surface, #1b1c19)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="prior_month">Prior Month</option>
                  <option value="prior_quarter">Prior Quarter</option>
                </select>
              </div>

              {/* Live Polling Status Indicator */}
              <div
                data-testid="live-polling-badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: 'var(--color-primary, #59452b)',
                  backgroundColor: 'var(--color-surface-container, #f0eee9)',
                  borderRadius: 'var(--radius-full, 9999px)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                }}
              >
                <span
                  data-testid="live-polling-dot"
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: pollingInterval > 0 ? '#2e7d32' : '#80756b',
                    display: 'inline-block',
                  }}
                />
                <span data-testid="live-polling-text">
                  {pollingInterval > 0
                    ? `Live Polling (${Math.round(pollingInterval / 1000)}s)`
                    : 'Polling Off'}
                </span>
              </div>

              {/* Last Updated Timestamp */}
              <div
                data-testid="last-updated-timestamp"
                data-iso-timestamp={lastUpdatedISO}
                style={{
                  fontSize: '13px',
                  color: 'var(--color-outline, #80756b)',
                  fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                }}
              >
                <span style={{ fontWeight: '500' }}>Updated: </span>
                <span data-testid="dashboard-last-updated">{lastUpdatedISO || 'N/A'}</span>
              </div>

              {/* Manual Refresh Button */}
              <button
                type="button"
                data-testid="dashboard-refresh-btn"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'var(--color-on-primary, #ffffff)',
                  backgroundColor: 'var(--color-primary, #59452b)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                  opacity: isRefreshing ? 0.7 : 1,
                  transition: 'background-color 0.15s ease',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21.5 2v6h-6M2.5 22v-6h6" />
                  <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.3L2.5 16" />
                </svg>
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Permission Denied / Masked Modules View OR Active Metric Grid */}
          {showPermissionDeniedView ? (
            <div
              data-testid="permission-denied-view"
              role="alert"
              style={{
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                padding: '32px 24px',
                textAlign: 'center',
                margin: '16px 0',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  margin: '0 auto 16px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-error-container, #ffdad6)',
                  color: 'var(--color-on-error-container, #93000a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>

              <h3
                data-testid="permission-denied-title"
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '20px',
                  fontWeight: '400',
                  color: 'var(--color-primary, #59452b)',
                  margin: '0 0 8px 0',
                }}
              >
                Access Restricted: Unauthorized Operational Modules
              </h3>

              <p
                data-testid="permission-denied-message"
                style={{
                  fontSize: '14px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  maxWidth: '520px',
                  margin: '0 auto 20px',
                  lineHeight: '1.5',
                }}
              >
                {isPermissionDeniedError
                  ? metricsError
                  : 'Your account role does not have permission to view any operational metric modules. Unauthorized modules have been masked for security.'}
              </p>

              <div
                data-testid="unauthorized-modules-masked-msg"
                style={{
                  display: 'inline-block',
                  fontSize: '12px',
                  fontWeight: '500',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  padding: '6px 12px',
                  backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                }}
              >
                Role-based Masking Active
              </div>
            </div>
          ) : (
            <>
              {metricsData &&
                Array.isArray(metricsData.metrics) &&
                metricsData.metrics.length > 0 &&
                metricsData.metrics.length < 4 && (
                  <div
                    data-testid="unauthorized-modules-masked-msg"
                    style={{
                      marginBottom: '16px',
                      padding: '8px 14px',
                      backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      fontSize: '13px',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-primary, #59452b)',
                        display: 'inline-block',
                      }}
                    />
                    <span>
                      Role-Based Access Control: Showing {metricsData.metrics.length} authorized operational module
                      {metricsData.metrics.length > 1 ? 's' : ''}. Unauthorized modules are masked.
                    </span>
                  </div>
                )}

              <MetricGrid
                metrics={metricsData?.metrics}
                isLoading={isLoadingMetrics}
                error={metricsError}
                onRefresh={handleManualRefresh}
                lastUpdatedAt={lastUpdatedISO}
                data-testid="metric-grid"
              />
            </>
          )}
        </section>

        {/* Active Session Context Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
            marginBottom: '48px',
          }}
        >
          {/* User Profile Card */}
          <section
            data-testid="user-context-card"
            style={{
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              padding: '28px',
              boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                borderBottom: '1px solid var(--color-surface-container-high, #eae8e3)',
                paddingBottom: '16px',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '20px',
                  fontWeight: '400',
                  margin: 0,
                  color: 'var(--color-primary, #59452b)',
                }}
              >
                User Session Profile
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '4px 8px',
                  backgroundColor: 'var(--color-surface-container, #f0eee9)',
                  color: 'var(--color-primary, #59452b)',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                }}
              >
                Authenticated
              </span>
            </div>

            <dl style={{ margin: 0, display: 'grid', gap: '16px' }}>
              <div>
                <dt
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-outline, #80756b)',
                    marginBottom: '4px',
                  }}
                >
                  Full Name
                </dt>
                <dd
                  data-testid="user-full-name"
                  style={{
                    fontSize: '16px',
                    fontWeight: '500',
                    color: 'var(--color-on-surface, #1b1c19)',
                    margin: 0,
                  }}
                >
                  {user.full_name}
                </dd>
              </div>

              <div>
                <dt
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-outline, #80756b)',
                    marginBottom: '4px',
                  }}
                >
                  Email Address
                </dt>
                <dd
                  data-testid="user-email"
                  style={{
                    fontSize: '16px',
                    color: 'var(--color-on-surface, #1b1c19)',
                    margin: 0,
                  }}
                >
                  {user.email}
                </dd>
              </div>

              <div>
                <dt
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-outline, #80756b)',
                    marginBottom: '4px',
                  }}
                >
                  User Identifier
                </dt>
                <dd
                  data-testid="user-id"
                  style={{
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    margin: 0,
                  }}
                >
                  {user.user_id}
                </dd>
              </div>

              {effectiveRoles ? (
                <div>
                  <dt
                    style={{
                      fontSize: '12px',
                      fontWeight: '500',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: 'var(--color-outline, #80756b)',
                      marginBottom: '4px',
                    }}
                  >
                    Role Scope
                  </dt>
                  <dd
                    data-testid="user-role-badge"
                    style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'var(--color-primary, #59452b)',
                      margin: 0,
                    }}
                  >
                    {effectiveRoles}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          {/* Tenant Context Card */}
          <section
            data-testid="tenant-context-card"
            style={{
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              padding: '28px',
              boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                borderBottom: '1px solid var(--color-surface-container-high, #eae8e3)',
                paddingBottom: '16px',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '20px',
                  fontWeight: '400',
                  margin: 0,
                  color: 'var(--color-primary, #59452b)',
                }}
              >
                Tenant & Isolation Context
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '4px 8px',
                  backgroundColor: 'var(--color-surface-container, #f0eee9)',
                  color: 'var(--color-primary, #59452b)',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                }}
              >
                Isolated Context
              </span>
            </div>

            <dl style={{ margin: 0, display: 'grid', gap: '16px' }}>
              <div>
                <dt
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-outline, #80756b)',
                    marginBottom: '4px',
                  }}
                >
                  Active Tenant ID
                </dt>
                <dd
                  data-testid="tenant-id"
                  style={{
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    fontWeight: '600',
                    color: 'var(--color-primary, #59452b)',
                    margin: 0,
                  }}
                >
                  {user.tenant_id}
                </dd>
              </div>

              <div>
                <dt
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-outline, #80756b)',
                    marginBottom: '4px',
                  }}
                >
                  Tenant Isolation Mode
                </dt>
                <dd
                  data-testid="tenant-isolation-mode"
                  style={{
                    fontSize: '14px',
                    color: 'var(--color-on-surface, #1b1c19)',
                    margin: 0,
                  }}
                >
                  Strict Server-Side Tenant Isolation
                </dd>
              </div>

              <div>
                <dt
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-outline, #80756b)',
                    marginBottom: '4px',
                  }}
                >
                  Session Security
                </dt>
                <dd
                  data-testid="session-security-status"
                  style={{
                    fontSize: '14px',
                    color: 'var(--color-on-surface, #1b1c19)',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#2e7d32',
                      display: 'inline-block',
                    }}
                  />
                  Active & Authenticated Session
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Portal Hub Overview Section */}
        <section
          data-testid="portal-hubs-section"
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            borderRadius: 'var(--radius-lg, 0.5rem)',
            padding: '32px',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
              fontSize: '24px',
              fontWeight: '400',
              color: 'var(--color-primary, #59452b)',
              marginTop: 0,
              marginBottom: '12px',
            }}
          >
            Permitted Portal Hubs
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginBottom: '24px',
            }}
          >
            Access features, operational tools, and services permitted for your active tenant session.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '20px',
            }}
          >
            <div
              data-testid="hub-card-overview"
              style={{
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                padding: '20px',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '18px',
                  fontWeight: '400',
                  margin: '0 0 8px 0',
                  color: 'var(--color-primary, #59452b)',
                }}
              >
                Hub Overview
              </h3>
              <p style={{ fontSize: '13px', color: '#4e453d', margin: 0 }}>
                Centralized hub monitoring active sessions, tenant resources, and platform metrics.
              </p>
            </div>

            <div
              data-testid="hub-card-settings"
              style={{
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                padding: '20px',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '18px',
                  fontWeight: '400',
                  margin: '0 0 8px 0',
                  color: 'var(--color-primary, #59452b)',
                }}
              >
                Tenant Settings
              </h3>
              <p style={{ fontSize: '13px', color: '#4e453d', margin: 0 }}>
                Configure tenant organization preferences, profile settings, and security controls.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * Main Portal Dashboard Page component.
 * Intercepts unauthenticated requests using ProtectedRoute guard and renders active session context.
 */
export default function DashboardPage(props: any = {}) {
  const {
    user: initialUser,
    fetchUser,
    onLogout,
    initialMetrics,
    fetchMetrics,
    triggerRefresh,
    pollingInterval = 30000,
    defaultBaseline = 'prior_month',
    roles,
    xUserRoles,
    xUserRole,
  } = props || {};

  if (initialUser) {
    return (
      <_DashboardContent
        user={initialUser}
        onLogout={onLogout}
        initialMetrics={initialMetrics}
        fetchMetrics={fetchMetrics}
        triggerRefresh={triggerRefresh}
        pollingInterval={pollingInterval}
        defaultBaseline={defaultBaseline}
        roles={roles}
        xUserRoles={xUserRoles}
        xUserRole={xUserRole}
      />
    );
  }

  return (
    <ProtectedRoute fetchUser={fetchUser}>
      <_DashboardContent
        onLogout={onLogout}
        initialMetrics={initialMetrics}
        fetchMetrics={fetchMetrics}
        triggerRefresh={triggerRefresh}
        pollingInterval={pollingInterval}
        defaultBaseline={defaultBaseline}
        roles={roles}
        xUserRoles={xUserRoles}
        xUserRole={xUserRole}
      />
    </ProtectedRoute>
  );
}
