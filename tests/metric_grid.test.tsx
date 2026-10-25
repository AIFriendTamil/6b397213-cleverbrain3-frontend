import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetricGrid } from '../src/components/dashboard/MetricGrid';
import { DomainMetrics } from '../src/services/dashboard';

describe('MetricGrid Component', () => {
  const mockMetrics: DomainMetrics[] = [
    {
      domain_name: 'sales',
      display_name: 'Sales Pipeline',
      status: 'active',
      detail_url: '/sales',
      kpis: [
        {
          key: 'pipeline_value',
          label: 'Pipeline Value',
          value: 1250000,
          unit: 'currency',
          trend_direction: 'up',
          trend_percentage: 12.5,
        },
      ],
    },
    {
      domain_name: 'leads',
      display_name: 'Lead Channels',
      status: 'active',
      detail_url: '/leads',
      kpis: [
        {
          key: 'conversion_rate',
          label: 'Conversion Rate',
          value: 18.4,
          unit: 'percentage',
          trend_direction: 'down',
          trend_percentage: 3.2,
        },
      ],
    },
    {
      domain_name: 'support',
      display_name: 'Support Queue',
      status: 'active',
      detail_url: '/support',
      kpis: [
        {
          key: 'open_tickets',
          label: 'Open Tickets',
          value: 15,
          unit: 'tickets',
          trend_direction: 'down',
          trend_percentage: 8.5,
        },
      ],
    },
    {
      domain_name: 'finance',
      display_name: 'Financial Accounts',
      status: 'active',
      detail_url: '/finance',
      kpis: [
        {
          key: 'net_revenue',
          label: 'Net Revenue',
          value: 5400000,
          unit: '$',
          trend_direction: 'up',
          trend_percentage: 15.0,
        },
      ],
    },
  ];

  it('renders responsive metric grid container and all 4 domain KPI cards when metrics array is supplied', () => {
    render(<MetricGrid metrics={mockMetrics} />);

    const grid = screen.getByTestId('metric-grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass('metric-grid', 'metric-grid-responsive');

    // Verify all 4 KPI cards render distinctly for sales, leads, support, and finance
    expect(screen.getByTestId('kpi-card-sales')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-leads')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-support')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-finance')).toBeInTheDocument();
  });

  it('renders header section with title, subtitle, timestamp, and refresh button', () => {
    const handleRefresh = vi.fn();
    const testTimestamp = '2026-10-24T14:00:00Z';

    render(
      <MetricGrid
        metrics={mockMetrics}
        title="Executive Performance"
        subtitle="Real-time operational summary"
        lastUpdatedAt={testTimestamp}
        onRefresh={handleRefresh}
      />
    );

    expect(screen.getByTestId('metric-grid-title')).toHaveTextContent('Executive Performance');
    expect(screen.getByTestId('metric-grid-subtitle')).toHaveTextContent('Real-time operational summary');
    expect(screen.getByTestId('metric-grid-timestamp')).toHaveTextContent(/Last updated:/);

    const refreshBtn = screen.getByTestId('metric-grid-refresh-btn');
    expect(refreshBtn).toBeInTheDocument();

    fireEvent.click(refreshBtn);
    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders loading skeleton cards when isLoading is true', () => {
    render(<MetricGrid isLoading={true} />);

    expect(screen.getByTestId('metric-grid-loading')).toBeInTheDocument();
    const skeletons = screen.getAllByTestId('metric-grid-skeleton-item');
    expect(skeletons).toHaveLength(4);
  });

  it('renders error state banner and retry button when error is present', () => {
    const handleRetry = vi.fn();

    render(
      <MetricGrid
        error="Unable to connect to operational metrics backend."
        onRefresh={handleRetry}
      />
    );

    const errorContainer = screen.getByTestId('metric-grid-error');
    expect(errorContainer).toBeInTheDocument();
    expect(errorContainer).toHaveTextContent('Unable to connect to operational metrics backend.');

    const retryBtn = screen.getByTestId('metric-grid-retry-btn');
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when metrics array is empty and no children provided', () => {
    const handleRefresh = vi.fn();

    render(
      <MetricGrid
        metrics={[]}
        emptyMessage="No domains available for current tenant."
        onRefresh={handleRefresh}
      />
    );

    const emptyContainer = screen.getByTestId('metric-grid-empty');
    expect(emptyContainer).toBeInTheDocument();
    expect(emptyContainer).toHaveTextContent('No domains available for current tenant.');

    const refreshBtn = screen.getByTestId('metric-grid-empty-refresh-btn');
    expect(refreshBtn).toBeInTheDocument();

    fireEvent.click(refreshBtn);
    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders custom children inside the grid layout', () => {
    render(
      <MetricGrid>
        <div data-testid="custom-card-1">Custom Card 1</div>
        <div data-testid="custom-card-2">Custom Card 2</div>
      </MetricGrid>
    );

    expect(screen.getByTestId('metric-grid')).toBeInTheDocument();
    expect(screen.getByTestId('custom-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('custom-card-2')).toBeInTheDocument();
  });

  it('supports explicit column layout override when columns prop is supplied', () => {
    render(<MetricGrid metrics={mockMetrics} columns={2} />);

    const grid = screen.getByTestId('metric-grid');
    expect(grid).toHaveStyle({ gridTemplateColumns: 'repeat(2, 1fr)' });
  });

  it('supports custom test ID attribute override', () => {
    render(<MetricGrid metrics={mockMetrics} data-testid="custom-metric-grid" />);

    expect(screen.getByTestId('custom-metric-grid-container')).toBeInTheDocument();
    expect(screen.getByTestId('custom-metric-grid')).toBeInTheDocument();
  });
});
