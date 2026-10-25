'use client';

import React from 'react';
import { KPICard } from './KPICard';
import { DomainMetrics } from '../../services/dashboard';

export interface MetricGridProps {
  /** Array of operational domain metrics from backend API */
  metrics?: DomainMetrics[];
  /** Flag indicating loading state */
  isLoading?: boolean;
  /** Error message or Error object if metrics fetch failed */
  error?: string | Error | null;
  /** Callback for refresh or retry action */
  onRefresh?: () => void;
  /** Timestamp string indicating when metrics were last updated */
  lastUpdatedAt?: string | Date;
  /** Section title header */
  title?: string;
  /** Section subtitle or description */
  subtitle?: string;
  /** Custom message rendered when metrics array is empty */
  emptyMessage?: string;
  /** Explicit column layout count for grid ('auto', 1, 2, 3, or 4) */
  columns?: 1 | 2 | 3 | 4 | 'auto';
  /** Grid spacing gap override (default: '24px') */
  gap?: string | number;
  /** Custom children nodes to render within grid layout */
  children?: React.ReactNode;
  /** Optional custom CSS class name */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Format timestamp into human-readable string representation.
 */
function formatTimestamp(value?: string | Date): string {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  try {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleString();
    }
  } catch {
    // Fall back to raw string if parsing fails
  }
  return String(value);
}

/**
 * MetricGrid component provides a responsive grid layout for executive KPI dashboard cards
 * across desktop (4 columns), tablet (2 columns), and mobile (1 column) display resolutions.
 * Adheres to Linen & Logic design system tokens and accessibility requirements.
 */
export function MetricGrid({
  metrics,
  isLoading = false,
  error = null,
  onRefresh,
  lastUpdatedAt,
  title,
  subtitle,
  emptyMessage = 'No operational metrics available.',
  columns,
  gap = 'var(--spacing-gutter, 24px)',
  children,
  className = '',
  'data-testid': customTestId,
}: MetricGridProps) {
  const containerTestId = customTestId || 'metric-grid';
  const errorMessage = error instanceof Error ? error.message : error;

  // Determine inline grid column style if explicit column count is supplied
  const gridColumnStyle: React.CSSProperties = {};
  if (typeof columns === 'number') {
    gridColumnStyle.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  } else if (columns === 'auto') {
    gridColumnStyle.gridTemplateColumns = 'repeat(auto-fit, minmax(260px, 1fr))';
  }

  const hasMetrics = Array.isArray(metrics) && metrics.length > 0;
  const hasChildren = Boolean(children);

  return (
    <section
      data-testid={`${containerTestId}-container`}
      className={`metric-grid-section ${className}`.trim()}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Header section with optional title, subtitle, timestamp, and refresh action */}
      {(title || subtitle || lastUpdatedAt || onRefresh) && (
        <div
          data-testid="metric-grid-header"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '1rem',
            marginBottom: '0.5rem',
          }}
        >
          <div>
            {title && (
              <h2
                data-testid="metric-grid-title"
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '1.5rem',
                  fontWeight: 400,
                  color: 'var(--color-primary, #59452b)',
                  margin: '0 0 0.25rem 0',
                  lineHeight: 1.2,
                }}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                data-testid="metric-grid-subtitle"
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  margin: 0,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            {lastUpdatedAt && (
              <span
                data-testid="metric-grid-timestamp"
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--color-outline, #80756b)',
                  fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                }}
              >
                Last updated: {formatTimestamp(lastUpdatedAt)}
              </span>
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                data-testid="metric-grid-refresh-btn"
                aria-label="Refresh operational metrics"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.375rem 0.75rem',
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  color: 'var(--color-primary, #59452b)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-default, 0.25rem)',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
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
                <span>Refresh</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading Skeleton State */}
      {isLoading ? (
        <div
          data-testid="metric-grid-loading"
          className="metric-grid metric-grid-responsive"
          aria-busy="true"
          aria-label="Loading operational metrics"
          style={{
            display: 'grid',
            gap: typeof gap === 'number' ? `${gap}px` : gap,
            width: '100%',
            ...gridColumnStyle,
          }}
        >
          {[1, 2, 3, 4].map((index) => (
            <div
              key={index}
              data-testid="metric-grid-skeleton-item"
              style={{
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                padding: '1.25rem',
                height: '180px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                animation: 'pulse 1.5s infinite ease-in-out',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: '40%',
                    height: '16px',
                    backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                  }}
                />
                <div
                  style={{
                    width: '20%',
                    height: '20px',
                    backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                  }}
                />
              </div>
              <div
                style={{
                  width: '60%',
                  height: '32px',
                  backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                  margin: '1rem 0',
                }}
              />
              <div
                style={{
                  width: '30%',
                  height: '14px',
                  backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                }}
              />
            </div>
          ))}
        </div>
      ) : errorMessage && !hasMetrics && !hasChildren ? (
        /* Error State */
        <div
          data-testid="metric-grid-error"
          role="alert"
          style={{
            padding: '1.5rem',
            backgroundColor: 'var(--color-error-container, #ffdad6)',
            color: 'var(--color-on-error-container, #93000a)',
            border: '1px solid var(--color-error, #ba1a1a)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              fontWeight: 500,
              fontSize: '1rem',
            }}
          >
            Failed to load operational metrics
          </div>
          <div
            style={{
              fontSize: '0.875rem',
              opacity: 0.9,
            }}
          >
            {errorMessage}
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              data-testid="metric-grid-retry-btn"
              style={{
                marginTop: '0.25rem',
                padding: '0.375rem 1rem',
                backgroundColor: 'var(--color-error, #ba1a1a)',
                color: 'var(--color-on-error, #ffffff)',
                border: 'none',
                borderRadius: 'var(--radius-default, 0.25rem)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Retry Loading
            </button>
          )}
        </div>
      ) : !hasMetrics && !hasChildren ? (
        /* Empty State */
        <div
          data-testid="metric-grid-empty"
          style={{
            padding: '2.5rem 1.5rem',
            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
            border: '1px dashed var(--color-outline-variant, #d1c4b9)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '0.75rem',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.9375rem',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            {emptyMessage}
          </p>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              data-testid="metric-grid-empty-refresh-btn"
              style={{
                padding: '0.375rem 0.875rem',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                color: 'var(--color-primary, #59452b)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-default, 0.25rem)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Refresh Data
            </button>
          )}
        </div>
      ) : (
        /* Active Grid Layout */
        <div
          data-testid={containerTestId}
          className={`metric-grid metric-grid-responsive`}
          style={{
            display: 'grid',
            gap: typeof gap === 'number' ? `${gap}px` : gap,
            width: '100%',
            ...gridColumnStyle,
          }}
        >
          {/* Render KPI cards from metrics data */}
          {hasMetrics &&
            metrics!.map((domain) => (
              <KPICard
                key={domain.domain_name}
                domain={domain}
                domainName={domain.domain_name}
                displayName={domain.display_name}
                status={domain.status}
                detailUrl={domain.detail_url}
                kpis={domain.kpis}
              />
            ))}

          {/* Render any passed children */}
          {children}
        </div>
      )}
    </section>
  );
}

export default MetricGrid;
