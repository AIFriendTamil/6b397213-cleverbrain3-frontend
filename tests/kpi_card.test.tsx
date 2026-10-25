import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { KPICard, formatKPIValue } from '../src/components/dashboard/KPICard';
import { DomainMetrics } from '../src/services/dashboard';

describe('KPICard Component', () => {
  const mockSalesDomain: DomainMetrics = {
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
      {
        key: 'deals_won',
        label: 'Deals Won',
        value: 42,
        unit: 'count',
        trend_direction: 'flat',
        trend_percentage: 0,
      },
    ],
  };

  const mockLeadsDomain: DomainMetrics = {
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
  };

  const mockSupportDomain: DomainMetrics = {
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
  };

  const mockFinanceDomain: DomainMetrics = {
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
  };

  it('renders distinct visual KPI card for Sales domain with formatted metrics and deep link', () => {
    render(<KPICard domain={mockSalesDomain} />);

    const card = screen.getByTestId('kpi-card-sales');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('data-domain', 'sales');
    expect(card).toHaveAttribute('data-status', 'active');

    // Title and domain badge
    expect(screen.getByTestId('kpi-card-title')).toHaveTextContent('Sales Pipeline');
    expect(screen.getByTestId('kpi-card-domain-badge')).toHaveTextContent('Sales');

    // KPI Metrics
    const kpiItems = screen.getAllByTestId('kpi-label');
    expect(kpiItems).toHaveLength(2);
    expect(kpiItems[0]).toHaveTextContent('Pipeline Value');
    expect(kpiItems[1]).toHaveTextContent('Deals Won');

    const kpiValues = screen.getAllByTestId('kpi-value');
    expect(kpiValues[0]).toHaveTextContent('$1,250,000');
    expect(kpiValues[1]).toHaveTextContent('42');

    // Deep link navigation
    const deepLink = screen.getByTestId('kpi-card-deep-link');
    expect(deepLink).toBeInTheDocument();
    expect(deepLink).toHaveAttribute('href', '/sales');
  });

  it('renders distinct visual KPI cards for Leads, Support, and Finance domains [FR-2]', () => {
    const { rerender } = render(<KPICard domain={mockLeadsDomain} />);

    expect(screen.getByTestId('kpi-card-leads')).toHaveAttribute('data-domain', 'leads');
    expect(screen.getByTestId('kpi-card-domain-badge')).toHaveTextContent('Leads');
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('18.4%');
    expect(screen.getByTestId('kpi-card-deep-link')).toHaveAttribute('href', '/leads');

    rerender(<KPICard domain={mockSupportDomain} />);
    expect(screen.getByTestId('kpi-card-support')).toHaveAttribute('data-domain', 'support');
    expect(screen.getByTestId('kpi-card-domain-badge')).toHaveTextContent('Support');
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('15 tickets');
    expect(screen.getByTestId('kpi-card-deep-link')).toHaveAttribute('href', '/support');

    rerender(<KPICard domain={mockFinanceDomain} />);
    expect(screen.getByTestId('kpi-card-finance')).toHaveAttribute('data-domain', 'finance');
    expect(screen.getByTestId('kpi-card-domain-badge')).toHaveTextContent('Finance');
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('$5,400,000');
    expect(screen.getByTestId('kpi-card-deep-link')).toHaveAttribute('href', '/finance');
  });

  it('renders empty state notice "N/A" with explanatory tooltip when domain status is no_data [FR-8]', () => {
    const emptyDomain: DomainMetrics = {
      domain_name: 'support',
      display_name: 'Support Queue',
      status: 'no_data',
      detail_url: '/support',
      kpis: [],
    };

    render(<KPICard domain={emptyDomain} />);

    const emptyState = screen.getByTestId('kpi-card-empty-state');
    expect(emptyState).toBeInTheDocument();

    const emptyNotice = screen.getByTestId('kpi-card-empty-notice');
    expect(emptyNotice).toHaveTextContent('N/A');

    const tooltip = screen.getByTestId('kpi-empty-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute('title', 'No operational data currently available for this domain.');
    expect(screen.getByTestId('kpi-card-empty-text')).toHaveTextContent(
      'No operational data currently available for this domain.'
    );
  });

  it('renders empty state for unconfigured modules with custom emptyMessage', () => {
    render(
      <KPICard
        domainName="finance"
        displayName="Financial Accounts"
        status="unconfigured"
        detailUrl="/finance"
        emptyMessage="Finance module connection pending setup."
      />
    );

    expect(screen.getByTestId('kpi-card-empty-notice')).toHaveTextContent('N/A');
    const tooltip = screen.getByTestId('kpi-empty-tooltip');
    expect(tooltip).toHaveAttribute('title', 'Finance module connection pending setup.');
    expect(screen.getByTestId('kpi-card-empty-text')).toHaveTextContent(
      'Finance module connection pending setup.'
    );
  });

  it('renders isolated error state when operational domain has status error', () => {
    const errorDomain: DomainMetrics = {
      domain_name: 'sales',
      display_name: 'Sales Pipeline',
      status: 'error',
      detail_url: '/sales',
      kpis: [],
    };

    render(
      <KPICard
        domain={errorDomain}
        errorMessage="Sales database timed out during metric extraction."
      />
    );

    const errorBlock = screen.getByTestId('kpi-card-error');
    expect(errorBlock).toBeInTheDocument();

    const errorNotice = screen.getByTestId('kpi-card-error-notice');
    expect(errorNotice).toHaveTextContent('Module Unavailable');

    const errorMessageEl = screen.getByTestId('kpi-card-error-message');
    expect(errorMessageEl).toHaveTextContent(
      'Sales database timed out during metric extraction.'
    );

    // Deep link is preserved so user can navigate even during error state
    expect(screen.getByTestId('kpi-card-deep-link')).toHaveAttribute('href', '/sales');
  });

  it('supports explicit component props overrides over domain object', () => {
    render(
      <KPICard
        domainName="leads"
        displayName="Custom Lead Tracker"
        status="active"
        detailUrl="/custom-leads"
        kpis={[
          {
            key: 'cost_per_lead',
            label: 'Cost Per Lead',
            value: 45,
            unit: 'currency',
            trend_direction: 'down',
            trend_percentage: 5.0,
          },
        ]}
      />
    );

    expect(screen.getByTestId('kpi-card-leads')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-title')).toHaveTextContent('Custom Lead Tracker');
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('$45');
    expect(screen.getByTestId('kpi-card-deep-link')).toHaveAttribute('href', '/custom-leads');
  });

  describe('formatKPIValue helper', () => {
    it('formats null, undefined, or NaN values as N/A', () => {
      expect(formatKPIValue(null)).toBe('N/A');
      expect(formatKPIValue(undefined)).toBe('N/A');
      expect(formatKPIValue(NaN)).toBe('N/A');
    });

    it('formats currency values correctly', () => {
      expect(formatKPIValue(1000, 'currency')).toBe('$1,000');
      expect(formatKPIValue(2500000, '$')).toBe('$2,500,000');
      expect(formatKPIValue(0, 'usd')).toBe('$0');
    });

    it('formats percentage values correctly', () => {
      expect(formatKPIValue(12.5, 'percentage')).toBe('12.5%');
      expect(formatKPIValue(50, '%')).toBe('50%');
    });

    it('formats numbers with count and custom units', () => {
      expect(formatKPIValue(1500, 'count')).toBe('1,500');
      expect(formatKPIValue(42, 'tickets')).toBe('42 tickets');
      expect(formatKPIValue(3.5, '$M')).toBe('$3.5M');
    });
  });
});
