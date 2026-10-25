import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  FunnelChart,
  formatCurrency,
  formatPercentage,
  formatDays,
} from '../src/components/deals/FunnelChart';
import { PipelineFunnelSummary } from '../src/services/api_client';

describe('FunnelChart Component', () => {
  const mockFunnelSummary: PipelineFunnelSummary = {
    total_deals: 12,
    total_pipeline_value: 1500000,
    total_weighted_value: 625000,
    overall_average_win_probability: 0.45,
    overall_average_deal_age_days: 28.5,
    stages: [
      {
        stage_id: 'stage-qualification',
        stage_name: 'Qualification',
        display_order: 1,
        deal_count: 5,
        total_monetary_value: 500000,
        average_monetary_value: 100000,
        average_win_probability: 0.2,
        weighted_monetary_value: 100000,
        average_deal_age_days: 12.4,
        conversion_rate_from_previous: 1.0,
      },
      {
        stage_id: 'stage-proposal',
        stage_name: 'Proposal & Negotiation',
        display_order: 2,
        deal_count: 4,
        total_monetary_value: 600000,
        average_monetary_value: 150000,
        average_win_probability: 0.5,
        weighted_monetary_value: 300000,
        average_deal_age_days: 34.1,
        conversion_rate_from_previous: 0.8,
      },
      {
        stage_id: 'stage-closed-won',
        stage_name: 'Closed Won',
        display_order: 3,
        deal_count: 3,
        total_monetary_value: 400000,
        average_monetary_value: 133333.33,
        average_win_probability: 1.0,
        weighted_monetary_value: 400000,
        average_deal_age_days: 45.0,
        conversion_rate_from_previous: 0.75,
      },
    ],
  };

  describe('Formatter Helpers', () => {
    it('formats monetary values to currency', () => {
      expect(formatCurrency(1500000)).toBe('$1,500,000');
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(null)).toBe('$0');
      expect(formatCurrency(undefined)).toBe('$0');
    });

    it('formats probabilities to percentage strings', () => {
      expect(formatPercentage(0.45)).toBe('45.0%');
      expect(formatPercentage(0.8)).toBe('80.0%');
      expect(formatPercentage(75)).toBe('75.0%');
      expect(formatPercentage(0)).toBe('0.0%');
      expect(formatPercentage(null)).toBe('0%');
    });

    it('formats deal age to days strings', () => {
      expect(formatDays(28.5)).toBe('28.5 days');
      expect(formatDays(0)).toBe('0.0 days');
      expect(formatDays(null)).toBe('0 days');
    });
  });

  describe('FunnelChart Rendering & Interaction', () => {
    it('renders pipeline summary header and stage metrics correctly', () => {
      render(<FunnelChart summary={mockFunnelSummary} />);

      const chartContainer = screen.getByTestId('funnel-chart');
      expect(chartContainer).toBeInTheDocument();

      // Summary Header Checks
      expect(screen.getByTestId('funnel-summary')).toBeInTheDocument();
      expect(screen.getByTestId('summary-total-value')).toHaveTextContent('$1,500,000');
      expect(screen.getByTestId('summary-weighted-value')).toHaveTextContent('$625,000');
      expect(screen.getByTestId('summary-total-deals')).toHaveTextContent('12');
      expect(screen.getByTestId('summary-avg-probability')).toHaveTextContent('45.0%');
      expect(screen.getByTestId('summary-avg-age')).toHaveTextContent('28.5 days');

      // Stage Items Checks
      const stageQualification = screen.getByTestId('funnel-stage-item-stage-qualification');
      expect(stageQualification).toBeInTheDocument();
      expect(stageQualification).toHaveTextContent('Qualification');
      expect(stageQualification).toHaveTextContent('5 deals');
      expect(stageQualification).toHaveTextContent('$500,000');
      expect(stageQualification).toHaveTextContent('Weighted: $100,000');
      expect(stageQualification).toHaveTextContent('Avg Age: 12.4 days');
      expect(stageQualification).toHaveTextContent('Win Prob: 20.0%');
      expect(stageQualification).toHaveTextContent('Conversion: 100.0%');

      const stageProposal = screen.getByTestId('funnel-stage-item-stage-proposal');
      expect(stageProposal).toBeInTheDocument();
      expect(stageProposal).toHaveTextContent('Proposal & Negotiation');
      expect(stageProposal).toHaveTextContent('4 deals');
      expect(stageProposal).toHaveTextContent('$600,000');

      const stageClosed = screen.getByTestId('funnel-stage-item-stage-closed-won');
      expect(stageClosed).toBeInTheDocument();
      expect(stageClosed).toHaveTextContent('Closed Won');
      expect(stageClosed).toHaveTextContent('3 deals');
    });

    it('handles stage selection click and triggers callbacks', () => {
      const handleStageSelect = vi.fn();
      const handleStageClick = vi.fn();

      render(
        <FunnelChart
          summary={mockFunnelSummary}
          onStageSelect={handleStageSelect}
          onStageClick={handleStageClick}
        />
      );

      const stageProposal = screen.getByTestId('funnel-stage-item-stage-proposal');
      fireEvent.click(stageProposal);

      expect(handleStageSelect).toHaveBeenCalledWith('stage-proposal');
      expect(handleStageClick).toHaveBeenCalledWith('stage-proposal');
    });

    it('highlights selected stage and displays reset stage filter button', () => {
      const handleStageSelect = vi.fn();

      render(
        <FunnelChart
          summary={mockFunnelSummary}
          selectedStageId="stage-proposal"
          onStageSelect={handleStageSelect}
        />
      );

      const stageProposal = screen.getByTestId('funnel-stage-item-stage-proposal');
      expect(stageProposal).toHaveAttribute('data-selected', 'true');

      const clearBtn = screen.getByTestId('clear-stage-filter');
      expect(clearBtn).toBeInTheDocument();

      fireEvent.click(clearBtn);
      expect(handleStageSelect).toHaveBeenCalledWith(null);
    });

    it('renders loading state correctly when isLoading is true', () => {
      render(<FunnelChart isLoading={true} />);

      expect(screen.getByTestId('funnel-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading pipeline funnel metrics...')).toBeInTheDocument();
    });

    it('renders error state correctly when error prop is provided', () => {
      render(<FunnelChart error="Server connection timeout" />);

      const errorBox = screen.getByTestId('funnel-error');
      expect(errorBox).toBeInTheDocument();
      expect(errorBox).toHaveTextContent('Error loading funnel metrics: Server connection timeout');
    });

    it('renders empty state when no deals or stages exist', () => {
      render(
        <FunnelChart
          summary={{
            total_deals: 0,
            total_pipeline_value: 0,
            total_weighted_value: 0,
            overall_average_win_probability: 0,
            overall_average_deal_age_days: 0,
            stages: [],
          }}
        />
      );

      expect(screen.getByTestId('funnel-empty')).toBeInTheDocument();
      expect(screen.getByText('No Pipeline Data Available')).toBeInTheDocument();
    });
  });
});
