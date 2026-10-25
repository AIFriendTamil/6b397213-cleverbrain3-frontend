import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  TimelineForecast,
  formatDate,
  formatConfidenceScore,
  getConfidenceStyle,
  calculateDateVarianceDays,
  filterAndSortEstimates,
} from '../src/components/deals/TimelineForecast';
import { DealForecastResponse, Milestone } from '../src/services/api_client';
import * as apiClientModule from '../src/services/api_client';

vi.mock('../src/services/api_client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/api_client')>();
  return {
    ...actual,
    getForecast: vi.fn(),
  };
});

describe('TimelineForecast Component', () => {
  const mockForecast: DealForecastResponse = {
    deal_id: 'deal-101',
    predicted_close_date: '2026-12-15T00:00:00Z',
    confidence_score: 0.88,
    is_fallback: false,
    model_version: 'ai_predictor_v2',
    details: {
      historical_deals_count: 145,
      pipeline_velocity_days: 42.5,
    },
    milestone_estimates: [
      {
        milestone_id: 'ms-1',
        milestone_title: 'Security & Compliance Review',
        estimated_completion_date: '2026-11-10T00:00:00Z',
        confidence_score: 0.92,
      },
      {
        milestone_id: 'ms-2',
        milestone_title: 'Legal Contract Terms Signoff',
        estimated_completion_date: '2026-11-25T00:00:00Z',
        confidence_score: 0.75,
      },
      {
        milestone_id: 'ms-3',
        milestone_title: 'Executive Sponsor Approval',
        estimated_completion_date: '2026-12-05T00:00:00Z',
        confidence_score: 0.45,
      },
    ],
  };

  const mockMilestones: Milestone[] = [
    {
      id: 'ms-1',
      deal_id: 'deal-101',
      title: 'Security & Compliance Review',
      target_date: '2026-11-05T00:00:00Z',
      status: 'IN_PROGRESS',
      critical_tasks: [],
    },
    {
      id: 'ms-2',
      deal_id: 'deal-101',
      title: 'Legal Contract Terms Signoff',
      target_date: '2026-11-20T00:00:00Z',
      status: 'PENDING',
      critical_tasks: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Formatter & Utility Helpers', () => {
    it('formats ISO dates correctly', () => {
      expect(formatDate('2026-12-15T00:00:00Z')).toBe('Dec 15, 2026');
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate('')).toBe('N/A');
      expect(formatDate('invalid-date')).toBe('invalid-date');
    });

    it('formats confidence scores to percentages', () => {
      expect(formatConfidenceScore(0.88)).toBe('88.0%');
      expect(formatConfidenceScore(0.452)).toBe('45.2%');
      expect(formatConfidenceScore(92)).toBe('92.0%');
      expect(formatConfidenceScore(null)).toBe('0%');
    });

    it('returns appropriate confidence visual styles', () => {
      const highStyle = getConfidenceStyle(0.85);
      expect(highStyle.label).toBe('High Confidence');
      expect(highStyle.badgeBg).toBe('#e8f5e9');

      const medStyle = getConfidenceStyle(0.65);
      expect(medStyle.label).toBe('Medium Confidence');
      expect(medStyle.badgeBg).toBe('#e7f1ff');

      const lowStyle = getConfidenceStyle(0.3);
      expect(lowStyle.label).toBe('Low Confidence');
      expect(lowStyle.badgeBg).toBe('#fdf0ed');

      const unknownStyle = getConfidenceStyle(null);
      expect(unknownStyle.label).toBe('Unknown');
    });

    it('calculates date variance in days correctly', () => {
      // Estimated is 5 days after target -> 5 days delayed
      const variance = calculateDateVarianceDays('2026-11-05T00:00:00Z', '2026-11-10T00:00:00Z');
      expect(variance).toBe(5);

      // Estimated is 2 days before target -> -2 days ahead
      const ahead = calculateDateVarianceDays('2026-11-10T00:00:00Z', '2026-11-08T00:00:00Z');
      expect(ahead).toBe(-2);

      expect(calculateDateVarianceDays(null, '2026-11-10')).toBeNull();
    });

    it('filters and sorts milestone estimates accurately', () => {
      const estimates = mockForecast.milestone_estimates;

      // Filter by search term
      const searchResult = filterAndSortEstimates(estimates, 'legal', 0);
      expect(searchResult.length).toBe(1);
      expect(searchResult[0].milestone_id).toBe('ms-2');

      // Filter by confidence threshold (>= 80%)
      const highConfResult = filterAndSortEstimates(estimates, '', 80);
      expect(highConfResult.length).toBe(1);
      expect(highConfResult[0].milestone_id).toBe('ms-1');

      // Sort by confidence descending
      const sortedByConf = filterAndSortEstimates(estimates, '', 0, 'confidence', 'desc');
      expect(sortedByConf[0].milestone_id).toBe('ms-1'); // 0.92
      expect(sortedByConf[2].milestone_id).toBe('ms-3'); // 0.45
    });
  });

  describe('Component Rendering & Interactive Behavior', () => {
    it('renders predicted close date, confidence score, and model version', () => {
      render(
        <TimelineForecast
          forecast={mockForecast}
          milestones={mockMilestones}
          data-testid="test-forecast"
        />
      );

      expect(screen.getByTestId('test-forecast')).toBeInTheDocument();
      expect(screen.getByTestId('predicted-close-date')).toHaveTextContent('Dec 15, 2026');
      expect(screen.getByTestId('overall-confidence-score')).toHaveTextContent('88.0%');
      expect(screen.getByText('Security & Compliance Review')).toBeInTheDocument();
      expect(screen.getByText('Legal Contract Terms Signoff')).toBeInTheDocument();
    });

    it('renders fallback notice banner when is_fallback is true (NFR-4)', () => {
      const fallbackForecast: DealForecastResponse = {
        ...mockForecast,
        is_fallback: true,
      };

      render(<TimelineForecast forecast={fallbackForecast} />);

      expect(screen.getByTestId('fallback-notice-banner')).toBeInTheDocument();
      expect(screen.getByText(/Historical Velocity Fallback Model Active/i)).toBeInTheDocument();
    });

    it('switches view modes between timeline, cards, and table', () => {
      render(<TimelineForecast forecast={mockForecast} />);

      // Default is timeline view
      expect(screen.getByTestId('timeline-view-container')).toBeInTheDocument();

      // Switch to Cards view
      fireEvent.click(screen.getByTestId('view-cards-btn'));
      expect(screen.getByTestId('cards-view-container')).toBeInTheDocument();

      // Switch to Table view
      fireEvent.click(screen.getByTestId('view-table-btn'));
      expect(screen.getByTestId('table-view-container')).toBeInTheDocument();
    });

    it('filters estimates using search input and confidence select', () => {
      render(<TimelineForecast forecast={mockForecast} />);

      const searchInput = screen.getByTestId('search-milestone-input');
      fireEvent.change(searchInput, { target: { value: 'Executive' } });

      expect(screen.getByText('Executive Sponsor Approval')).toBeInTheDocument();
      expect(screen.queryByText('Security & Compliance Review')).not.toBeInTheDocument();

      // Reset search, set high confidence filter
      fireEvent.change(searchInput, { target: { value: '' } });
      const confSelect = screen.getByTestId('confidence-filter-select');
      fireEvent.change(confSelect, { target: { value: '80' } });

      expect(screen.getByText('Security & Compliance Review')).toBeInTheDocument();
      expect(screen.queryByText('Executive Sponsor Approval')).not.toBeInTheDocument();
    });

    it('triggers callbacks when clicking milestone estimates and recalculate button', () => {
      const onSelect = vi.fn();
      const onClick = vi.fn();
      const onRefresh = vi.fn();

      render(
        <TimelineForecast
          forecast={mockForecast}
          onMilestoneSelect={onSelect}
          onMilestoneClick={onClick}
          onRefreshForecast={onRefresh}
        />
      );

      // Click milestone estimate
      const item = screen.getByTestId('milestone-forecast-item-ms-1');
      fireEvent.click(item);

      expect(onSelect).toHaveBeenCalledWith('ms-1');
      expect(onClick).toHaveBeenCalled();

      // Click recalculate button
      const refreshBtn = screen.getByTestId('recalculate-forecast-btn');
      fireEvent.click(refreshBtn);

      expect(onRefresh).toHaveBeenCalledWith(true);
    });

    it('toggles model details modal when clicked', () => {
      render(<TimelineForecast forecast={mockForecast} />);

      const toggleBtn = screen.getByTestId('toggle-details-btn');
      fireEvent.click(toggleBtn);

      expect(screen.getByTestId('model-details-panel')).toBeInTheDocument();
      expect(screen.getByText(/145/)).toBeInTheDocument();
    });

    it('fetches forecast automatically when dealId is provided without external forecast prop', async () => {
      vi.mocked(apiClientModule.getForecast).mockResolvedValueOnce(mockForecast);

      render(<TimelineForecast dealId="deal-202" />);

      await waitFor(() => {
        expect(apiClientModule.getForecast).toHaveBeenCalledWith('deal-202', {
          deal_id: 'deal-202',
          include_milestones: true,
        });
      });

      expect(await screen.findByTestId('predicted-close-date')).toHaveTextContent('Dec 15, 2026');
    });

    it('renders loading and error states properly', () => {
      const { rerender } = render(<TimelineForecast isLoading={true} />);
      expect(screen.getByText(/Calculating AI timeline predictions/i)).toBeInTheDocument();

      rerender(<TimelineForecast error="Model service timeout" />);
      expect(screen.getByText('Forecast Generation Failed')).toBeInTheDocument();
      expect(screen.getByText('Model service timeout')).toBeInTheDocument();
    });
  });
});
