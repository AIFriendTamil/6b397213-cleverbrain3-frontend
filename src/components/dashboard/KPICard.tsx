'use client';

import React from 'react';
import Link from 'next/link';
import { TrendIndicator } from './TrendIndicator';
import { DomainMetrics, KPIData } from '../../services/dashboard';

export interface KPICardProps {
  /** Domain operational metrics payload from backend API */
  domain?: DomainMetrics;
  /** Explicit domain identifier override (e.g. 'sales', 'leads', 'support', 'finance') */
  domainName?: string;
  /** Display title for the KPI card */
  displayName?: string;
  /** Status of the module ('active', 'no_data', 'error', 'unconfigured') */
  status?: 'active' | 'no_data' | 'error' | 'unconfigured' | string;
  /** Deep-link URL to operational view */
  detailUrl?: string;
  /** List of KPI metrics to display */
  kpis?: KPIData[];
  /** Optional error message when status is 'error' */
  errorMessage?: string;
  /** Optional empty state message or explanation tooltip */
  emptyMessage?: string;
  /** Optional custom CSS class name */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Visual style configuration per operational domain per Linen & Logic design system tokens.
 */
interface DomainStyleConfig {
  badgeBg: string;
  badgeColor: string;
  accentColor: string;
  label: string;
}

const DOMAIN_STYLES: Record<string, DomainStyleConfig> = {
  sales: {
    badgeBg: 'var(--color-primary-container, #735c41)',
    badgeColor: 'var(--color-on-primary-container, #f5d6b4)',
    accentColor: 'var(--color-primary, #59452b)',
    label: 'Sales',
  },
  leads: {
    badgeBg: 'var(--color-secondary-container, #fd7d69)',
    badgeColor: 'var(--color-on-secondary-container, #71160b)',
    accentColor: 'var(--color-secondary, #a43b2c)',
    label: 'Leads',
  },
  support: {
    badgeBg: 'var(--color-tertiary-container, #4f6278)',
    badgeColor: 'var(--color-on-tertiary-container, #caddf8)',
    accentColor: 'var(--color-tertiary, #374a5f)',
    label: 'Support',
  },
  finance: {
    badgeBg: '#e8f5e9',
    badgeColor: '#1b5e20',
    accentColor: '#2e6b38',
    label: 'Finance',
  },
};

const DEFAULT_DOMAIN_STYLE: DomainStyleConfig = {
  badgeBg: 'var(--color-surface-container-high, #eae8e3)',
  badgeColor: 'var(--color-on-surface-variant, #4e453d)',
  accentColor: 'var(--color-primary, #59452b)',
  label: 'Domain',
};

/**
 * Generate fallback title for operational domains when display_name is omitted.
 */
function getDomainFallbackTitle(domainName: string): string {
  switch (domainName.toLowerCase()) {
    case 'sales':
      return 'Sales Pipeline';
    case 'leads':
      return 'Lead Channels';
    case 'support':
      return 'Support Queue';
    case 'finance':
      return 'Financial Accounts';
    default:
      if (!domainName) return 'Operational Domain';
      return `${domainName.charAt(0).toUpperCase() + domainName.slice(1)} Domain`;
  }
}

/**
 * Format raw numerical KPI value according to metric unit type.
 */
export function formatKPIValue(value: number | undefined | null, unit?: string): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A';
  }

  const normalizedUnit = (unit || '').toLowerCase().trim();

  if (normalizedUnit === 'currency' || normalizedUnit === '$' || normalizedUnit === 'usd') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (normalizedUnit === 'percentage' || normalizedUnit === '%') {
    const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(1);
    return `${formatted}%`;
  }

  const formattedNumber = new Intl.NumberFormat('en-US').format(value);

  if (!unit || normalizedUnit === 'count' || normalizedUnit === 'number' || normalizedUnit === 'items') {
    return formattedNumber;
  }

  if (unit.startsWith('$')) {
    return `$${formattedNumber}${unit.slice(1)}`;
  }

  return `${formattedNumber} ${unit}`;
}

/**
 * KPICard component rendering operational metrics, directional trends, deep-link navigation,
 * empty states with tooltips, and isolated error display per domain.
 */
export function KPICard({
  domain,
  domainName,
  displayName,
  status,
  detailUrl,
  kpis,
  errorMessage,
  emptyMessage,
  className = '',
  'data-testid': customTestId,
}: KPICardProps) {
  // Resolve props from domain object or explicit overrides
  const resolvedDomainName = (domainName || domain?.domain_name || 'general').toLowerCase();
  const resolvedDisplayName = displayName || domain?.display_name || getDomainFallbackTitle(resolvedDomainName);
  const resolvedStatus = (status || domain?.status || 'active').toLowerCase();
  const resolvedDetailUrl = detailUrl || domain?.detail_url || '';
  const resolvedKpis = kpis || domain?.kpis || [];

  const styleConfig = DOMAIN_STYLES[resolvedDomainName] || {
    ...DEFAULT_DOMAIN_STYLE,
    label: resolvedDomainName.charAt(0).toUpperCase() + resolvedDomainName.slice(1),
  };

  const isErrorState = resolvedStatus === 'error';
  const isEmptyState =
    resolvedStatus === 'no_data' ||
    resolvedStatus === 'unconfigured' ||
    (!isErrorState && resolvedKpis.length === 0);

  const containerTestId = customTestId || `kpi-card-${resolvedDomainName}`;

  const tooltipText =
    emptyMessage ||
    (resolvedStatus === 'unconfigured'
      ? 'This operational module is not yet configured or connected.'
      : 'No operational data currently available for this domain.');

  return (
    <div
      data-testid={containerTestId}
      data-domain={resolvedDomainName}
      data-status={resolvedStatus}
      className={`kpi-card kpi-card-${resolvedDomainName} kpi-card-status-${resolvedStatus} ${className}`}
      style={{
        backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
        border: '1px solid var(--color-outline-variant, #d1c4b9)',
        borderRadius: 'var(--radius-md, 0.375rem)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(115, 92, 65, 0.05)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        position: 'relative',
        minHeight: '180px',
      }}
    >
      {/* Header section with domain title, badge, and optional header link */}
      <div>
        <div
          data-testid="kpi-card-header"
          className="kpi-card-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3
              data-testid="kpi-card-title"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.25rem',
                fontWeight: 400,
                color: 'var(--color-on-surface, #1b1c19)',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {resolvedDisplayName}
            </h3>
            <span
              data-testid="kpi-card-domain-badge"
              style={{
                padding: '0.125rem 0.5rem',
                borderRadius: 'var(--radius-full, 9999px)',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                backgroundColor: styleConfig.badgeBg,
                color: styleConfig.badgeColor,
              }}
            >
              {styleConfig.label}
            </span>
          </div>
        </div>

        {/* Content Body: Active KPIs, Empty State, or Isolated Error State */}
        {isErrorState ? (
          <div
            data-testid="kpi-card-error"
            style={{
              padding: '0.875rem 1rem',
              backgroundColor: 'var(--color-error-container, #ffdad6)',
              color: 'var(--color-on-error-container, #93000a)',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              borderLeft: '4px solid var(--color-error, #ba1a1a)',
              fontSize: '0.875rem',
              margin: '0.5rem 0',
            }}
          >
            <div
              data-testid="kpi-card-error-notice"
              style={{
                fontWeight: 600,
                marginBottom: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              <span aria-hidden="true">&#9888;</span>
              <span>Module Unavailable</span>
            </div>
            <div data-testid="kpi-card-error-message" style={{ fontSize: '0.8125rem', opacity: 0.9 }}>
              {errorMessage || 'An error occurred while fetching metrics for this operational domain.'}
            </div>
          </div>
        ) : isEmptyState ? (
          <div
            data-testid="kpi-card-empty-state"
            style={{
              padding: '1rem 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '0.5rem',
            }}
          >
            <div
              data-testid="kpi-card-empty-notice"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '2rem',
                fontWeight: 400,
                color: 'var(--color-outline, #80756b)',
                lineHeight: 1,
              }}
            >
              N/A
            </div>
            <div
              data-testid="kpi-empty-tooltip"
              title={tooltipText}
              aria-label={tooltipText}
              style={{
                fontSize: '0.8125rem',
                color: 'var(--color-on-surface-variant, #4e453d)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                cursor: 'help',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                padding: '0.25rem 0.5rem',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px dashed var(--color-outline-variant, #d1c4b9)',
              }}
            >
              <span aria-hidden="true">&#9432;</span>
              <span data-testid="kpi-card-empty-text">{tooltipText}</span>
            </div>
          </div>
        ) : (
          <div
            data-testid="kpi-metrics-list"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              margin: '0.5rem 0',
            }}
          >
            {resolvedKpis.map((kpi, idx) => (
              <div
                key={kpi.key || idx}
                data-testid={`kpi-item-${kpi.key || idx}`}
                className="kpi-item"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span
                    data-testid="kpi-label"
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'var(--color-on-surface-variant, #4e453d)',
                    }}
                  >
                    {kpi.label}
                  </span>
                  <TrendIndicator
                    direction={kpi.trend_direction}
                    percentage={kpi.trend_percentage}
                    data-testid={`trend-indicator-${kpi.key || idx}`}
                  />
                </div>
                <div
                  data-testid="kpi-value"
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.75rem',
                    fontWeight: 400,
                    color: 'var(--color-on-surface, #1b1c19)',
                    lineHeight: 1.2,
                  }}
                >
                  {formatKPIValue(kpi.value, kpi.unit)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with Deep-Link Navigation */}
      {resolvedDetailUrl && (
        <div
          data-testid="kpi-card-footer"
          style={{
            marginTop: '1.25rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--color-surface-container-high, #eae8e3)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <Link
            href={resolvedDetailUrl}
            data-testid="kpi-card-deep-link"
            aria-label={`View ${resolvedDisplayName} operational view`}
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: styleConfig.accentColor,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              textDecoration: 'none',
            }}
          >
            <span>View Operational View</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      )}
    </div>
  );
}
