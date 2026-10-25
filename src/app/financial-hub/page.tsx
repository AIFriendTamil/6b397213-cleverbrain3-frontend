'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute, useAuth } from '../../components/protected_route';
import { NavMenu } from '../../components/nav_menu';
import { CurrentUserResponse } from '../../services/auth';
import { ArAgingChart } from '../../components/financial/ArAgingChart';
import { ArrTrendChart } from '../../components/financial/ArrTrendChart';
import { QuoteApprovalTable } from '../../components/financial/QuoteApprovalTable';
import { InvoiceListTable } from '../../components/financial/InvoiceListTable';
import {
  ArAgingResponse,
  ArrTrendDataPoint,
  Quote,
  Invoice,
  getArAging,
  getArrTrends,
  getQuotes,
  getInvoices,
} from '../../services/financialApi';

export interface FinancialHubPageProps {
  /** Explicit authenticated user context override (useful for injection or testing) */
  user?: CurrentUserResponse | null;
  /** Custom session fetcher passed to ProtectedRoute */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Custom logout handler */
  onLogout?: () => Promise<void>;
  /** Preloaded AR aging data response */
  initialArAging?: ArAgingResponse | null;
  /** Preloaded ARR trend data points */
  initialArrTrends?: ArrTrendDataPoint[] | null;
  /** Preloaded commercial quotes list */
  initialQuotes?: Quote[] | null;
  /** Preloaded invoice records list */
  initialInvoices?: Invoice[] | null;
  /** Custom fetcher for AR aging data */
  fetchArAging?: (params?: { account_id?: string; force_recalculate?: boolean }) => Promise<ArAgingResponse>;
  /** Custom fetcher for ARR trend data */
  fetchArrTrends?: (params?: { account_id?: string; period_range?: string; target_currency?: string }) => Promise<ArrTrendDataPoint[]>;
  /** Custom fetcher for commercial quotes */
  fetchQuotes?: (params?: { account_id?: string; status?: string }) => Promise<Quote[]>;
  /** Custom fetcher for invoice records */
  fetchInvoices?: (params?: { account_id?: string; payment_status?: string }) => Promise<Invoice[]>;
  /** Whether to automatically fetch backend data on mount (default: true) */
  autoFetch?: boolean;
  /** Initial account ID filter */
  initialAccountId?: string;
  /** Initial target currency setting (default: 'USD') */
  initialCurrency?: string;
  /** Initial period range setting (default: 'ALL') */
  initialPeriodRange?: string;
  /** Custom CSS class name override */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

export type FinancialHubTab = 'ALL' | 'AR_AGING' | 'ARR_TRENDS' | 'QUOTES' | 'INVOICES';

/**
 * Inner Financial Hub Content component consuming active user session context.
 * Integrates AR aging buckets, ARR trends, commercial quotes approval table,
 * and invoice list tracking following the Linen & Logic design system.
 */
function FinancialHubPageContent({
  user: explicitUser,
  onLogout,
  initialArAging = null,
  initialArrTrends = null,
  initialQuotes = null,
  initialInvoices = null,
  fetchArAging: customFetchArAging,
  fetchArrTrends: customFetchArrTrends,
  fetchQuotes: customFetchQuotes,
  fetchInvoices: customFetchInvoices,
  autoFetch = true,
  initialAccountId = '',
  initialCurrency = 'USD',
  initialPeriodRange = 'ALL',
  className = '',
  'data-testid': testId = 'financial-hub-page',
}: FinancialHubPageProps) {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  // Filter state
  const [accountIdFilter, setAccountIdFilter] = useState<string>(initialAccountId);
  const [targetCurrency, setTargetCurrency] = useState<string>(initialCurrency);
  const [periodRange, setPeriodRange] = useState<string>(initialPeriodRange);
  const [activeTab, setActiveTab] = useState<FinancialHubTab>('ALL');

  // Data state
  const [arAgingData, setArAgingData] = useState<ArAgingResponse | null>(initialArAging);
  const [arrTrendsData, setArrTrendsData] = useState<ArrTrendDataPoint[] | null>(initialArrTrends);
  const [quotesData, setQuotesData] = useState<Quote[] | null>(initialQuotes);
  const [invoicesData, setInvoicesData] = useState<Invoice[] | null>(initialInvoices);

  // Loading & error states
  const [isLoadingAging, setIsLoadingAging] = useState<boolean>(autoFetch && !initialArAging);
  const [isLoadingTrends, setIsLoadingTrends] = useState<boolean>(autoFetch && !initialArrTrends);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState<boolean>(autoFetch && !initialQuotes);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState<boolean>(autoFetch && !initialInvoices);

  const [agingError, setAgingError] = useState<string | null>(null);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  const [isRefreshingAll, setIsRefreshingAll] = useState<boolean>(false);

  // Memoized fetcher functions
  const fetchAgingFn = useCallback(
    async (accId?: string) => {
      const fn = customFetchArAging || getArAging;
      return fn({ account_id: accId || undefined });
    },
    [customFetchArAging]
  );

  const fetchTrendsFn = useCallback(
    async (accId?: string, range?: string, curr?: string) => {
      const fn = customFetchArrTrends || getArrTrends;
      return fn({
        account_id: accId || undefined,
        period_range: range || undefined,
        target_currency: curr || undefined,
      });
    },
    [customFetchArrTrends]
  );

  const fetchQuotesFn = useCallback(
    async (accId?: string) => {
      const fn = customFetchQuotes || getQuotes;
      return fn({ account_id: accId || undefined });
    },
    [customFetchQuotes]
  );

  const fetchInvoicesFn = useCallback(
    async (accId?: string) => {
      const fn = customFetchInvoices || getInvoices;
      return fn({ account_id: accId || undefined });
    },
    [customFetchInvoices]
  );

  // Load all financial dashboard data
  const loadAllData = useCallback(
    async (accId: string, range: string, curr: string) => {
      setIsLoadingAging(true);
      setIsLoadingTrends(true);
      setIsLoadingQuotes(true);
      setIsLoadingInvoices(true);

      setAgingError(null);
      setTrendsError(null);
      setQuotesError(null);
      setInvoicesError(null);

      // Fetch AR Aging
      fetchAgingFn(accId)
        .then((data) => setArAgingData(data))
        .catch((err) => setAgingError(err?.message || 'Failed to load AR aging data'))
        .finally(() => setIsLoadingAging(false));

      // Fetch ARR Trends
      fetchTrendsFn(accId, range, curr)
        .then((data) => setArrTrendsData(data))
        .catch((err) => setTrendsError(err?.message || 'Failed to load ARR trends data'))
        .finally(() => setIsLoadingTrends(false));

      // Fetch Quotes
      fetchQuotesFn(accId)
        .then((data) => setQuotesData(data))
        .catch((err) => setQuotesError(err?.message || 'Failed to load quotes data'))
        .finally(() => setIsLoadingQuotes(false));

      // Fetch Invoices
      fetchInvoicesFn(accId)
        .then((data) => setInvoicesData(data))
        .catch((err) => setInvoicesError(err?.message || 'Failed to load invoices data'))
        .finally(() => setIsLoadingInvoices(false));
    },
    [fetchAgingFn, fetchTrendsFn, fetchQuotesFn, fetchInvoicesFn]
  );

  // Auto fetch on mount or filter change if autoFetch is true
  useEffect(() => {
    if (autoFetch) {
      loadAllData(accountIdFilter, periodRange, targetCurrency);
    }
  }, [autoFetch, accountIdFilter, periodRange, targetCurrency, loadAllData]);

  // Global manual refresh handler
  const handleRefreshAll = async () => {
    setIsRefreshingAll(true);
    await loadAllData(accountIdFilter, periodRange, targetCurrency);
    setIsRefreshingAll(false);
  };

  if (!user) {
    return null;
  }

  // Calculate high-level summary KPIs
  const totalArOutstanding = arAgingData?.total_outstanding ?? 0;
  const latestArrPoint = arrTrendsData && arrTrendsData.length > 0 ? arrTrendsData[arrTrendsData.length - 1] : null;
  const currentArrValue = latestArrPoint?.arr_value ?? 0;

  const pendingQuotes = quotesData ? quotesData.filter((q) => (q.status || '').toUpperCase() === 'PENDING_APPROVAL') : [];
  const overdueInvoices = invoicesData ? invoicesData.filter((i) => (i.payment_status || '').toUpperCase() === 'OVERDUE') : [];

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
        {/* Header Section */}
        <header
          data-testid="financial-hub-header"
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
                data-testid="financial-hub-eyebrow"
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
                Financial Operations & Transparency
              </span>
              <h1
                data-testid="financial-hub-title"
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '32px',
                  fontWeight: 400,
                  margin: 0,
                  color: 'var(--color-on-surface, #1b1c19)',
                  lineHeight: '1.2',
                }}
              >
                Financial Operations Central Hub
              </h1>
              <p
                data-testid="financial-hub-description"
                style={{
                  fontSize: '15px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginTop: '8px',
                  marginBottom: 0,
                  maxWidth: '780px',
                  lineHeight: '1.5',
                }}
              >
                Consolidated commercial insights, AR aging bucket breakdown, ARR growth trends, quote approval workflows, and invoice payment tracking.
              </p>
            </div>

            {/* Links to Notification Matrix and Notification Hub */}
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
                href="/settings/notifications"
                data-testid="notification-settings-link"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  color: 'var(--color-primary, #59452b)',
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: '0 1px 2px rgba(115, 92, 65, 0.05)',
                }}
              >
                <span>⚙ Alert Preferences</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/notifications"
                data-testid="notification-hub-link"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  color: 'var(--color-primary, #59452b)',
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: '0 1px 2px rgba(115, 92, 65, 0.05)',
                }}
              >
                <span>🔔 Notification Hub</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          {/* Global Filter & Control Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              marginTop: '24px',
              padding: '16px',
              backgroundColor: 'var(--color-surface-container, #f0eee9)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
              {/* Account Filter Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label
                  htmlFor="account-id-filter"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-on-surface-variant, #4e453d)',
                  }}
                >
                  Account Filter:
                </label>
                <input
                  id="account-id-filter"
                  type="text"
                  placeholder="All Accounts..."
                  value={accountIdFilter}
                  onChange={(e) => setAccountIdFilter(e.target.value)}
                  data-testid="account-id-input"
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    borderRadius: 'var(--radius-default, 0.25rem)',
                    border: '1px solid var(--color-outline, #80756b)',
                    backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                    color: 'var(--color-on-surface, #1b1c19)',
                    outline: 'none',
                    minWidth: '180px',
                  }}
                />
              </div>

              {/* Currency Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label
                  htmlFor="currency-selector"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-on-surface-variant, #4e453d)',
                  }}
                >
                  Currency:
                </label>
                <select
                  id="currency-selector"
                  value={targetCurrency}
                  onChange={(e) => setTargetCurrency(e.target.value)}
                  data-testid="currency-select"
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    borderRadius: 'var(--radius-default, 0.25rem)',
                    border: '1px solid var(--color-outline, #80756b)',
                    backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                    color: 'var(--color-on-surface, #1b1c19)',
                  }}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              {/* Period Range Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label
                  htmlFor="period-range-selector"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-on-surface-variant, #4e453d)',
                  }}
                >
                  ARR Period:
                </label>
                <select
                  id="period-range-selector"
                  value={periodRange}
                  onChange={(e) => setPeriodRange(e.target.value)}
                  data-testid="period-range-select"
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    borderRadius: 'var(--radius-default, 0.25rem)',
                    border: '1px solid var(--color-outline, #80756b)',
                    backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                    color: 'var(--color-on-surface, #1b1c19)',
                  }}
                >
                  <option value="1Y">Last 1 Year</option>
                  <option value="2Y">Last 2 Years</option>
                  <option value="ALL">All Recorded Time</option>
                </select>
              </div>
            </div>

            {/* Refresh All Data Button */}
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={isRefreshingAll}
              data-testid="refresh-all-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-on-primary, #ffffff)',
                backgroundColor: 'var(--color-primary, #59452b)',
                border: 'none',
                borderRadius: 'var(--radius-default, 0.25rem)',
                cursor: isRefreshingAll ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 2px rgba(115, 92, 65, 0.15)',
              }}
            >
              🔄 {isRefreshingAll ? 'Refreshing...' : 'Refresh All Metrics'}
            </button>
          </div>
        </header>

        {/* High-Level Overview Strip */}
        <section
          data-testid="financial-hub-kpis"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          {/* Outstanding AR KPI */}
          <div
            style={{
              padding: '18px',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              boxShadow: '0 2px 6px rgba(115, 92, 65, 0.04)',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Outstanding AR Balance
            </span>
            <div
              data-testid="kpi-outstanding-ar"
              style={{
                fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
                fontSize: '26px',
                fontWeight: 500,
                color: 'var(--color-primary, #59452b)',
                marginTop: '4px',
              }}
            >
              ${totalArOutstanding.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
              Current + 30/60/90+ days overdue
            </span>
          </div>

          {/* Current ARR KPI */}
          <div
            style={{
              padding: '18px',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              boxShadow: '0 2px 6px rgba(115, 92, 65, 0.04)',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Current Annual Recurring Revenue
            </span>
            <div
              data-testid="kpi-current-arr"
              style={{
                fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
                fontSize: '26px',
                fontWeight: 500,
                color: 'var(--color-tertiary, #374a5f)',
                marginTop: '4px',
              }}
            >
              ${currentArrValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
              Latest period: {latestArrPoint?.metric_period || 'N/A'}
            </span>
          </div>

          {/* Pending Quotes KPI */}
          <div
            style={{
              padding: '18px',
              backgroundColor: pendingQuotes.length > 0 ? '#fef3c7' : 'var(--color-surface-container-lowest, #ffffff)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: pendingQuotes.length > 0 ? '1px solid #fde68a' : '1px solid var(--color-outline-variant, #d1c4b9)',
              boxShadow: '0 2px 6px rgba(115, 92, 65, 0.04)',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: pendingQuotes.length > 0 ? '#92400e' : 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Quotes Awaiting Approval
            </span>
            <div
              data-testid="kpi-pending-quotes"
              style={{
                fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
                fontSize: '26px',
                fontWeight: 500,
                color: pendingQuotes.length > 0 ? '#78350f' : 'var(--color-on-surface, #1b1c19)',
                marginTop: '4px',
              }}
            >
              {pendingQuotes.length} Quote{pendingQuotes.length === 1 ? '' : 's'}
            </div>
            <span style={{ fontSize: '12px', color: pendingQuotes.length > 0 ? '#92400e' : 'var(--color-on-surface-variant, #4e453d)' }}>
              Requires manager sign-off
            </span>
          </div>

          {/* Overdue Invoices KPI */}
          <div
            style={{
              padding: '18px',
              backgroundColor: overdueInvoices.length > 0 ? 'var(--color-trend-down-bg, #fdf0ed)' : 'var(--color-surface-container-lowest, #ffffff)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: overdueInvoices.length > 0 ? '1px solid #ffcdd2' : '1px solid var(--color-outline-variant, #d1c4b9)',
              boxShadow: '0 2px 6px rgba(115, 92, 65, 0.04)',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: overdueInvoices.length > 0 ? 'var(--color-secondary, #a43b2c)' : 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Overdue Invoices
            </span>
            <div
              data-testid="kpi-overdue-invoices"
              style={{
                fontFamily: 'var(--font-serif, "Libre Caslon Text", serif)',
                fontSize: '26px',
                fontWeight: 500,
                color: overdueInvoices.length > 0 ? 'var(--color-secondary, #a43b2c)' : 'var(--color-on-surface, #1b1c19)',
                marginTop: '4px',
              }}
            >
              {overdueInvoices.length} Invoice{overdueInvoices.length === 1 ? '' : 's'}
            </div>
            <span style={{ fontSize: '12px', color: overdueInvoices.length > 0 ? 'var(--color-secondary, #a43b2c)' : 'var(--color-on-surface-variant, #4e453d)' }}>
              Past due payment schedules
            </span>
          </div>
        </section>

        {/* Section Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '28px',
            borderBottom: '2px solid var(--color-outline-variant, #d1c4b9)',
            paddingBottom: '2px',
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'ALL', label: 'All Operations' },
            { id: 'AR_AGING', label: 'AR Aging Buckets' },
            { id: 'ARR_TRENDS', label: 'ARR Trends' },
            { id: 'QUOTES', label: 'Quotes & Approvals' },
            { id: 'INVOICES', label: 'Invoices & Billing' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as FinancialHubTab)}
                data-testid={`financial-tab-${tab.id.toLowerCase()}`}
                style={{
                  padding: '10px 18px',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--color-primary, #59452b)' : 'var(--color-on-surface-variant, #4e453d)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '3px solid var(--color-primary, #59452b)' : '3px solid transparent',
                  cursor: 'pointer',
                  marginBottom: '-2px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modular Sections Container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {/* Section 1: AR Aging Buckets Visualization [FR-1] */}
          {(activeTab === 'ALL' || activeTab === 'AR_AGING') && (
            <section data-testid="ar-aging-section">
              <ArAgingChart
                data={arAgingData}
                accountId={accountIdFilter}
                isLoading={isLoadingAging}
                error={agingError}
                onRefresh={() => fetchAgingFn(accountIdFilter).then((d) => setArAgingData(d))}
                data-testid="ar-aging-chart-component"
              />
            </section>
          )}

          {/* Section 2: Historic & Current ARR Trends [FR-2] */}
          {(activeTab === 'ALL' || activeTab === 'ARR_TRENDS') && (
            <section data-testid="arr-trend-section">
              <ArrTrendChart
                data={arrTrendsData}
                accountId={accountIdFilter}
                isLoading={isLoadingTrends}
                error={trendsError}
                periodRange={periodRange}
                onPeriodRangeChange={(r) => setPeriodRange(r)}
                targetCurrency={targetCurrency}
                onRefresh={() => fetchTrendsFn(accountIdFilter, periodRange, targetCurrency).then((d) => setArrTrendsData(d))}
                data-testid="arr-trend-chart-component"
              />
            </section>
          )}

          {/* Section 3: Commercial Quote Approvals [FR-3, FR-4] */}
          {(activeTab === 'ALL' || activeTab === 'QUOTES') && (
            <section data-testid="quote-approval-section">
              <QuoteApprovalTable
                quotes={quotesData}
                currentUserId={user.user_id}
                isLoading={isLoadingQuotes}
                error={quotesError}
                onRefresh={() => fetchQuotesFn(accountIdFilter).then((d) => setQuotesData(d))}
                data-testid="quote-approval-table-component"
              />
            </section>
          )}

          {/* Section 4: Invoices & Payment Tracking [FR-5] */}
          {(activeTab === 'ALL' || activeTab === 'INVOICES') && (
            <section data-testid="invoice-list-section">
              <InvoiceListTable
                invoices={invoicesData}
                accountId={accountIdFilter}
                isLoading={isLoadingInvoices}
                error={invoicesError}
                onRefresh={() => fetchInvoicesFn(accountIdFilter).then((d) => setInvoicesData(d))}
                data-testid="invoice-list-table-component"
              />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Main Financial Operations Central Hub Page Route Component.
 * Intercepts unauthenticated requests using ProtectedRoute guard and renders active session context.
 */
export default function FinancialHubPage(props: any = {}) {
  const {
    user: initialUser,
    fetchUser,
    onLogout,
    initialArAging,
    initialArrTrends,
    initialQuotes,
    initialInvoices,
    fetchArAging,
    fetchArrTrends,
    fetchQuotes,
    fetchInvoices,
    autoFetch = true,
    initialAccountId,
    initialCurrency,
    initialPeriodRange,
    className = '',
    'data-testid': testId = 'financial-hub-page',
  } = props || {};
  if (initialUser) {
    return (
      <FinancialHubPageContent
        user={initialUser}
        onLogout={onLogout}
        initialArAging={initialArAging}
        initialArrTrends={initialArrTrends}
        initialQuotes={initialQuotes}
        initialInvoices={initialInvoices}
        fetchArAging={fetchArAging}
        fetchArrTrends={fetchArrTrends}
        fetchQuotes={fetchQuotes}
        fetchInvoices={fetchInvoices}
        autoFetch={autoFetch}
        initialAccountId={initialAccountId}
        initialCurrency={initialCurrency}
        initialPeriodRange={initialPeriodRange}
        className={className}
        data-testid={testId}
      />
    );
  }

  return (
    <ProtectedRoute fetchUser={fetchUser}>
      <FinancialHubPageContent
        onLogout={onLogout}
        initialArAging={initialArAging}
        initialArrTrends={initialArrTrends}
        initialQuotes={initialQuotes}
        initialInvoices={initialInvoices}
        fetchArAging={fetchArAging}
        fetchArrTrends={fetchArrTrends}
        fetchQuotes={fetchQuotes}
        fetchInvoices={fetchInvoices}
        autoFetch={autoFetch}
        initialAccountId={initialAccountId}
        initialCurrency={initialCurrency}
        initialPeriodRange={initialPeriodRange}
        className={className}
        data-testid={testId}
      />
    </ProtectedRoute>
  );
}