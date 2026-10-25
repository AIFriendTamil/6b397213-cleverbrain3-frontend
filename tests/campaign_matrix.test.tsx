import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  CampaignMatrix,
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatDateDisplay,
  getROIBadge,
  getQualityBadge,
  getBestPerformerBadges,
} from '../src/components/campaigns/CampaignMatrix';
import {
  Campaign,
  CampaignComparisonMatrix,
  CampaignComparisonItem,
  CampaignComparisonSummary,
} from '../src/services/api_client';

// Mock API client services
vi.mock('../src/services/api_client', async () => {
  const actual = await vi.importActual<typeof import('../src/services/api_client')>('../src/services/api_client');
  return {
    ...actual,
    getCampaigns: vi.fn(),
    compareCampaigns: vi.fn(),
  };
});

import { getCampaigns, compareCampaigns } from '../src/services/api_client';

describe('CampaignMatrix Component (Feature 005 - T028)', () => {
  const mockCampaignList: Campaign[] = [
    {
      campaign_id: 'camp-001',
      campaign_name: 'Q3 Enterprise Search Ads',
      budget_amount: 50000,
      spent_amount: 42000,
      start_timestamp: '2026-07-01T00:00:00Z',
      end_timestamp: '2026-09-30T00:00:00Z',
      created_timestamp: '2026-06-15T00:00:00Z',
    },
    {
      campaign_id: 'camp-002',
      campaign_name: 'Q3 Social Retargeting',
      budget_amount: 30000,
      spent_amount: 28000,
      start_timestamp: '2026-07-01T00:00:00Z',
      end_timestamp: '2026-09-30T00:00:00Z',
      created_timestamp: '2026-06-15T00:00:00Z',
    },
    {
      campaign_id: 'camp-003',
      campaign_name: 'Q4 Content Marketing Blast',
      budget_amount: 20000,
      spent_amount: 15000,
      start_timestamp: '2026-10-01T00:00:00Z',
      end_timestamp: '2026-12-31T00:00:00Z',
      created_timestamp: '2026-09-15T00:00:00Z',
    },
  ];

  const mockItem1: CampaignComparisonItem = {
    campaign_id: 'camp-001',
    campaign_name: 'Q3 Enterprise Search Ads',
    budget_amount: 50000,
    spent_amount: 42000,
    leads_generated: 150,
    average_quality_score: 82.5,
    converted_leads: 30,
    overall_conversion_rate: 20.0,
    attributed_revenue: 150000,
    total_roi_percentage: 257.1,
    cost_per_lead: 280.0,
    cost_per_conversion: 1400.0,
    start_timestamp: '2026-07-01T00:00:00Z',
    end_timestamp: '2026-09-30T00:00:00Z',
  };

  const mockItem2: CampaignComparisonItem = {
    campaign_id: 'camp-002',
    campaign_name: 'Q3 Social Retargeting',
    budget_amount: 30000,
    spent_amount: 28000,
    leads_generated: 220,
    average_quality_score: 65.0,
    converted_leads: 22,
    overall_conversion_rate: 10.0,
    attributed_revenue: 66000,
    total_roi_percentage: 135.7,
    cost_per_lead: 127.27,
    cost_per_conversion: 1272.73,
    start_timestamp: '2026-07-01T00:00:00Z',
    end_timestamp: '2026-09-30T00:00:00Z',
  };

  const mockSummary: CampaignComparisonSummary = {
    total_campaigns_compared: 2,
    best_roi_campaign_id: 'camp-001',
    best_roi_campaign_name: 'Q3 Enterprise Search Ads',
    best_conversion_campaign_id: 'camp-001',
    best_conversion_campaign_name: 'Q3 Enterprise Search Ads',
    highest_lead_volume_campaign_id: 'camp-002',
    highest_lead_volume_campaign_name: 'Q3 Social Retargeting',
    total_spend_across_campaigns: 70000,
    total_revenue_across_campaigns: 216000,
    total_leads_across_campaigns: 370,
    average_roi_percentage: 196.4,
  };

  const mockMatrixData: CampaignComparisonMatrix = {
    campaigns: [mockItem1, mockItem2],
    summary: mockSummary,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCampaigns).mockResolvedValue(mockCampaignList);
    vi.mocked(compareCampaigns).mockResolvedValue(mockMatrixData);
  });

  describe('Utility Helper Functions', () => {
    it('formats currency correctly', () => {
      expect(formatCurrency(150000)).toContain('150,000');
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(null)).toBe('$0');
    });

    it('formats percentages with directional sign', () => {
      expect(formatPercentage(257.14)).toBe('+257.1%');
      expect(formatPercentage(-12.5)).toBe('-12.5%');
      expect(formatPercentage(0)).toBe('0.0%');
    });

    it('formats raw numbers with commas', () => {
      expect(formatNumber(1250)).toBe('1,250');
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(null)).toBe('0');
    });

    it('formats date strings', () => {
      expect(formatDateDisplay('2026-07-01T00:00:00Z')).toContain('2026');
      expect(formatDateDisplay(null)).toBe('N/A');
    });

    it('returns quality badge config based on score', () => {
      expect(getQualityBadge(85).label).toBe('High Quality');
      expect(getQualityBadge(55).label).toBe('Medium Quality');
      expect(getQualityBadge(25).label).toBe('Low Quality');
    });

    it('returns ROI badge config based on ROI value', () => {
      expect(getROIBadge(120).label).toBe('Positive ROI');
      expect(getROIBadge(-15).label).toBe('Negative ROI');
      expect(getROIBadge(0).label).toBe('Breakeven');
    });

    it('calculates best performer badges from summary', () => {
      const badgesItem1 = getBestPerformerBadges(mockItem1, mockSummary);
      expect(badgesItem1.some((b) => b.label.includes('Best ROI'))).toBe(true);
      expect(badgesItem1.some((b) => b.label.includes('Top Conversion'))).toBe(true);

      const badgesItem2 = getBestPerformerBadges(mockItem2, mockSummary);
      expect(badgesItem2.some((b) => b.label.includes('Highest Volume'))).toBe(true);
    });
  });

  describe('Render and Interaction Behavior', () => {
    it('renders with pre-loaded matrix data props', () => {
      render(
        <CampaignMatrix
          matrix={mockMatrixData}
          availableCampaigns={mockCampaignList}
        />
      );

      // Check title and headers
      expect(screen.getByText('Campaign Evaluation Matrix')).toBeInDocument();
      expect(screen.getByTestId('campaign-summary-panel')).toBeInDocument();

      // Check summary card content
      expect(screen.getByText('2 Campaigns')).toBeInDocument();

      // Check table column headers
      expect(screen.getByTestId('matrix-col-header-camp-001')).toBeInDocument();
      expect(screen.getByTestId('matrix-col-header-camp-002')).toBeInDocument();

      // Check matrix metric rows rendered
      expect(screen.getByText('Budget Allocated')).toBeInDocument();
      expect(screen.getByText('Spend Incurred')).toBeInDocument();
      expect(screen.getByText('Total ROI Percentage')).toBeInDocument();
    });

    it('switches between Side-by-Side Table and Comparison Cards view', async () => {
      render(
        <CampaignMatrix
          matrix={mockMatrixData}
          availableCampaigns={mockCampaignList}
        />
      );

      // Initially in matrix table view
      expect(screen.getByTestId('campaign-matrix-table')).toBeInDocument();

      // Click Comparison Cards view mode
      fireEvent.click(screen.getByTestId('view-mode-cards'));

      // Matrix table replaced by cards grid
      expect(screen.queryByTestId('campaign-matrix-table')).not.toBeInDocument();
      expect(screen.getByTestId('campaign-cards-grid')).toBeInDocument();
      expect(screen.getByTestId('campaign-card-camp-001')).toBeInDocument();
      expect(screen.getByTestId('campaign-card-camp-002')).toBeInDocument();
    });

    it('fetches data on mount when props are not provided', async () => {
      render(<CampaignMatrix />);

      await waitFor(() => {
        expect(getCampaigns).toHaveBeenCalled();
        expect(compareCampaigns).toHaveBeenCalled();
      });

      expect(screen.getByText('2 Campaigns')).toBeInDocument();
    });

    it('handles campaign selection chip toggling and filter callbacks', async () => {
      const onFilterChange = vi.fn();

      render(
        <CampaignMatrix
          matrix={mockMatrixData}
          availableCampaigns={mockCampaignList}
          onFilterChange={onFilterChange}
        />
      );

      // Click Q4 Content Marketing Blast campaign chip to add to comparison
      const chip = screen.getByTestId('campaign-chip-camp-003');
      fireEvent.click(chip);

      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          campaign_ids: ['camp-003'],
        })
      );
    });

    it('handles date range, lead source, and region filter inputs (FR-11)', () => {
      const onFilterChange = vi.fn();
      const sources = [{ source_id: 'src-1', source_name: 'Google Ads' }];
      const regions = ['West Region', 'East Region'];

      render(
        <CampaignMatrix
          matrix={mockMatrixData}
          availableCampaigns={mockCampaignList}
          availableSources={sources}
          availableRegions={regions}
          onFilterChange={onFilterChange}
        />
      );

      // Change start date
      fireEvent.change(screen.getByTestId('filter-start-timestamp'), {
        target: { value: '2026-07-01' },
      });
      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ start_timestamp: '2026-07-01' })
      );

      // Change lead source
      fireEvent.change(screen.getByTestId('filter-lead-source'), {
        target: { value: 'src-1' },
      });
      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ lead_source: 'src-1' })
      );

      // Change region
      fireEvent.change(screen.getByTestId('filter-region'), {
        target: { value: 'West Region' },
      });
      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'West Region' })
      );
    });

    it('renders empty state when matrix has no campaigns compared', () => {
      render(
        <CampaignMatrix
          matrix={{ campaigns: [], summary: { ...mockSummary, total_campaigns_compared: 0 } }}
          availableCampaigns={mockCampaignList}
        />
      );

      expect(screen.getByTestId('campaign-matrix-empty')).toBeInDocument();
      expect(
        screen.getByText('Select Marketing Campaigns for Evaluation')
      ).toBeInDocument();
    });

    it('renders error state and handles retry click', () => {
      const onRefresh = vi.fn();

      render(
        <CampaignMatrix
          error="Network failure loading matrix"
          onRefresh={onRefresh}
        />
      );

      expect(screen.getByTestId('campaign-matrix-error')).toBeInDocument();
      expect(screen.getByText(/Network failure loading matrix/)).toBeInDocument();

      fireEvent.click(screen.getByText('Retry'));
      expect(onRefresh).toHaveBeenCalled();
    });
  });
});
