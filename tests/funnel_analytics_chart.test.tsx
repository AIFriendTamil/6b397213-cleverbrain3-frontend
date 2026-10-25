import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  FunnelChart,
  formatPercentage,
  formatCurrency,
  formatDays,
  getQualityBadge,
  getBottleneckDetails,
} from '../src/components/funnel/FunnelChart';
import { FunnelStageMetrics, StageLeadDrillDownResponse } from '../src/services/api_client';

describe('FunnelChart Component (Feature 005)', () => {
  const mockStages: FunnelStageMetrics[] = [
    {
      stage_id: 'stage-lead-inflow',
      stage_name: 'Lead Inflow',
      stage_order: 1,
      lead_count: 500,
      conversion_rate_percentage: 100.0,
      target_conversion_rate: 100.0,
      is_bottleneck: false,
    },
    {
      stage_id: 'stage-mql',
      stage_name: 'Marketing Qualified Lead (MQL)',
      stage_order: 2,
      lead_count: 300,
      conversion_rate_percentage: 60.0,
      target_conversion_rate: 70.0,
      is_bottleneck: true, // Drop-off bottleneck below target
    },
    {
      stage_id: 'stage-sql',
      stage_name: 'Sales Qualified Lead (SQL)',
      stage_order: 3,
      lead_count: 150,
      conversion_rate_percentage: 50.0,
      target_conversion_rate: 45.0,
      is_bottleneck: false,
    },
    {
      stage_id: 'stage-closed-won',
      stage_name: 'Closed Won Opportunity',
      stage_order: 4,
      lead_count: 60,
      conversion_rate_percentage: 40.0,
      target_conversion_rate: 35.0,
      is_bottleneck: false,
    },
  ];

  const mockDrillDownLeads: StageLeadDrillDownResponse = {
    stage_id: 'stage-mql',
    stage_name: 'Marketing Qualified Lead (MQL)',
    total_leads: 2,
    page: 1,
    limit: 5,
    leads: [
      {
        lead_id: 'lead-101',
        source_id: 'src-google',
        campaign_id: 'camp-summer',
        quality_score: 85,
        status_stage: 'stage-mql',
        region_name: 'North America',
        state_code: 'CA',
        postal_code: '90210',
        deal_value: 25000,
        created_timestamp: '2026-05-01T10:00:00Z',
        time_in_stage_days: 3.5,
      },
      {
        lead_id: 'lead-102',
        source_id: 'src-linkedin',
        campaign_id: null,
        quality_score: 45,
        status_stage: 'stage-mql',
        region_name: 'Europe',
        state_code: null,
        postal_code: null,
        deal_value: 12000,
        created_timestamp: '2026-05-02T14:30:00Z',
        time_in_stage_days: 6.1,
      },
    ],
  };

  describe('Formatter & Utility Helpers', () => {
    it('formats percentage numbers correctly', () => {
      expect(formatPercentage(60)).toBe('60.0%');
      expect(formatPercentage(42.856)).toBe('42.9%');
      expect(formatPercentage(0)).toBe('0.0%');
      expect(formatPercentage(null)).toBe('0.0%');
      expect(formatPercentage(undefined)).toBe('0.0%');
    });

    it('formats currency values correctly', () => {
      expect(formatCurrency(25000)).toBe('$25,000');
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(null)).toBe('$0');
    });

    it('formats days count correctly', () => {
      expect(formatDays(3.5)).toBe('3.5 days');
      expect(formatDays(0)).toBe('0.0 days');
      expect(formatDays(null)).toBe('0 days');
    });

    it('returns quality badge configurations', () => {
      expect(getQualityBadge(85).label).toBe('High Quality');
      expect(getQualityBadge(50).label).toBe('Medium');
      expect(getQualityBadge(20).label).toBe('Low Quality');
    });

    it('determines bottleneck details correctly', () => {
      const healthy = getBottleneckDetails(mockStages[0]);
      expect(healthy.isBottleneck).toBe(false);

      const bottleneck = getBottleneckDetails(mockStages[1]);
      expect(bottleneck.isBottleneck).toBe(true);
      expect(bottleneck.gap).toBe(10.0);
    });
  });

  describe('Component Rendering & Layout', () => {
    it('renders funnel chart header and KPI summary cards correctly', () => {
      render(<FunnelChart stages={mockStages} />);

      expect(screen.getByTestId('funnel-chart')).toBeInTheDocument();
      expect(screen.getByText('Conversion Funnel Analytics')).toBeInTheDocument();

      // Check summary KPI values
      expect(screen.getByTestId('summary-entering-leads')).toHaveTextContent('500');
      expect(screen.getByTestId('summary-converted-leads')).toHaveTextContent('60');
      expect(screen.getByTestId('summary-overall-conversion')).toHaveTextContent('12.0%');
      expect(screen.getByTestId('summary-bottleneck-count')).toHaveTextContent('1');
    });

    it('renders sequential funnel stages and highlights bottlenecks (FR-3, FR-4)', () => {
      render(<FunnelChart stages={mockStages} />);

      const listContainer = screen.getByTestId('funnel-stages-list');
      expect(listContainer).toBeInTheDocument();

      // Check Healthy Stage 1
      const stageInflow = screen.getByTestId('funnel-stage-item-stage-lead-inflow');
      expect(stageInflow).toBeInTheDocument();
      expect(stageInflow).toHaveTextContent('Lead Inflow');
      expect(screen.getByTestId('target-badge-stage-lead-inflow')).toHaveTextContent('✓ On Target');

      // Check Bottleneck Stage 2 (FR-4)
      const stageMql = screen.getByTestId('funnel-stage-item-stage-mql');
      expect(stageMql).toBeInTheDocument();
      expect(stageMql).toHaveTextContent('Marketing Qualified Lead (MQL)');
      const bottleneckBadge = screen.getByTestId('bottleneck-badge-stage-mql');
      expect(bottleneckBadge).toBeInTheDocument();
      expect(bottleneckBadge).toHaveTextContent('⚠ Bottleneck (60.0% / Target: 70.0%)');
    });
  });

  describe('Filter Controls & Interactions (FR-11)', () => {
    it('handles filter input changes and triggers onFilterChange on apply', () => {
      const handleFilterChange = vi.fn();

      render(
        <FunnelChart
          stages={mockStages}
          onFilterChange={handleFilterChange}
          availableSources={[{ source_id: 'src-google', source_name: 'Google Ads' }]}
          availableRegions={['North America', 'Europe']}
        />
      );

      const filterBar = screen.getByTestId('funnel-filter-bar');
      expect(filterBar).toBeInTheDocument();

      // Enter filter values
      const startDateInput = screen.getByTestId('filter-start-date');
      fireEvent.change(startDateInput, { target: { value: '2026-01-01' } });

      const endDateInput = screen.getByTestId('filter-end-date');
      fireEvent.change(endDateInput, { target: { value: '2026-06-30' } });

      const sourceSelect = screen.getByTestId('filter-source');
      fireEvent.change(sourceSelect, { target: { value: 'src-google' } });

      const regionSelect = screen.getByTestId('filter-region');
      fireEvent.change(regionSelect, { target: { value: 'North America' } });

      // Click apply filters
      const applyBtn = screen.getByTestId('apply-filters-btn');
      fireEvent.click(applyBtn);

      expect(handleFilterChange).toHaveBeenCalledWith({
        start_timestamp: '2026-01-01',
        end_timestamp: '2026-06-30',
        source_id: 'src-google',
        region_name: 'North America',
      });
    });

    it('resets filters when reset button is clicked', () => {
      const handleFilterChange = vi.fn();

      render(
        <FunnelChart
          stages={mockStages}
          initialFilters={{ source_id: 'src-google' }}
          onFilterChange={handleFilterChange}
        />
      );

      const resetBtn = screen.getByTestId('reset-filters-btn');
      fireEvent.click(resetBtn);

      expect(handleFilterChange).toHaveBeenCalledWith({});
    });
  });

  describe('Stage Selection & Lead Drill-Down (FR-5)', () => {
    it('handles stage item click and displays drill-down lead details', () => {
      const handleStageSelect = vi.fn();
      const handleStageClick = vi.fn();

      render(
        <FunnelChart
          stages={mockStages}
          selectedStageId="stage-mql"
          selectedStageLeads={mockDrillDownLeads}
          onStageSelect={handleStageSelect}
          onStageClick={handleStageClick}
        />
      );

      // Verify drill-down panel is rendered (FR-5)
      const drilldownPanel = screen.getByTestId('stage-drilldown-panel');
      expect(drilldownPanel).toBeInTheDocument();
      expect(screen.getByText('Stage Drill-Down: Marketing Qualified Lead (MQL)')).toBeInTheDocument();

      // Verify leads table items
      expect(screen.getByTestId('lead-item-lead-101')).toBeInTheDocument();
      expect(screen.getByTestId('lead-item-lead-102')).toBeInTheDocument();
      expect(screen.getByText('$25,000')).toBeInTheDocument();
      expect(screen.getByText('North America, CA')).toBeInTheDocument();

      // Click clear drilldown button
      const clearBtn = screen.getByTestId('clear-stage-filter');
      fireEvent.click(clearBtn);

      expect(handleStageSelect).toHaveBeenCalledWith(null);
    });

    it('triggers onLeadClick when a lead row in drill-down is clicked', () => {
      const handleLeadClick = vi.fn();

      render(
        <FunnelChart
          stages={mockStages}
          selectedStageId="stage-mql"
          selectedStageLeads={mockDrillDownLeads}
          onLeadClick={handleLeadClick}
        />
      );

      const leadRow = screen.getByTestId('lead-item-lead-101');
      fireEvent.click(leadRow);

      expect(handleLeadClick).toHaveBeenCalledWith('lead-101');
    });
  });

  describe('Loading, Error, and Empty States', () => {
    it('renders loading indicator when isLoading prop is true', () => {
      render(<FunnelChart isLoading={true} />);

      expect(screen.getByTestId('funnel-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading conversion funnel analytics...')).toBeInTheDocument();
    });

    it('renders error message box when error prop is provided', () => {
      render(<FunnelChart error="Database query timeout" />);

      const errorBox = screen.getByTestId('funnel-error');
      expect(errorBox).toBeInTheDocument();
      expect(screen.getByText('Database query timeout')).toBeInTheDocument();
    });

    it('renders empty state box when stages array is empty', () => {
      render(<FunnelChart stages={[]} />);

      expect(screen.getByTestId('funnel-empty')).toBeInTheDocument();
      expect(screen.getByText('No Funnel Stage Data')).toBeInTheDocument();
    });
  });
});
