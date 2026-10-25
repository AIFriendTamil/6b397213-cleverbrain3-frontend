import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  AcquisitionDashboard,
  formatCurrency,
  formatPercentage,
  getQualityScoreBadge,
  getROIBadge,
} from '../src/components/acquisition/AcquisitionDashboard';
import { AcquisitionSummary, SourceROIMetrics } from '../src/services/api_client';

describe('AcquisitionDashboard Component', () => {
  const mockSources: SourceROIMetrics[] = [
    {
      source_id: 'src-google-paid',
      source_name: 'Google Paid Search',
      total_leads: 150,
      average_quality_score: 82.5,
      total_spend: 10000,
      attributed_revenue: 35000,
      calculated_roi_percentage: 250.0,
    },
    {
      source_id: 'src-organic-seo',
      source_name: 'Organic Search',
      total_leads: 300,
      average_quality_score: 65.0,
      total_spend: 5000,
      attributed_revenue: 12000,
      calculated_roi_percentage: 140.0,
    },
    {
      source_id: 'src-event-booth',
      source_name: 'Trade Show Event',
      total_leads: 40,
      average_quality_score: 35.0,
      total_spend: 15000,
      attributed_revenue: 8000,
      calculated_roi_percentage: -46.7,
    },
  ];

  const mockSummary: AcquisitionSummary = {
    total_sources: 3,
    total_leads: 490,
    overall_average_quality_score: 67.9,
    total_spend: 30000,
    total_attributed_revenue: 55000,
    overall_roi_percentage: 83.3,
    sources: mockSources,
  };

  describe('Formatter Helpers', () => {
    it('formats currency correctly', () => {
      expect(formatCurrency(35000)).toBe('$35,000');
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(null)).toBe('$0');
      expect(formatCurrency(undefined)).toBe('$0');
    });

    it('formats ROI percentage correctly', () => {
      expect(formatPercentage(250)).toBe('+250.0%');
      expect(formatPercentage(-46.7)).toBe('-46.7%');
      expect(formatPercentage(0)).toBe('0.0%');
      expect(formatPercentage(null)).toBe('0.0%');
    });

    it('returns quality score badge tiers', () => {
      expect(getQualityScoreBadge(85).label).toBe('High Quality');
      expect(getQualityScoreBadge(55).label).toBe('Medium Quality');
      expect(getQualityScoreBadge(20).label).toBe('Low Quality');
    });

    it('returns ROI badges for profitable, loss, and breakeven', () => {
      expect(getROIBadge(150).label).toBe('Profitable');
      expect(getROIBadge(-25).label).toBe('Loss');
      expect(getROIBadge(0).label).toBe('Breakeven');
    });
  });

  describe('Dashboard Rendering', () => {
    it('renders dashboard container and header', () => {
      render(<AcquisitionDashboard summary={mockSummary} sources={mockSources} />);

      expect(screen.getByTestId('acquisition-dashboard')).toBeInTheDocument();
      expect(screen.getByText('Lead Acquisition & ROI Analytics')).toBeInTheDocument();
    });

    it('renders summary KPI cards with correct metric values', () => {
      render(<AcquisitionDashboard summary={mockSummary} sources={mockSources} />);

      const kpis = screen.getByTestId('summary-kpis');
      expect(kpis).toBeInTheDocument();

      expect(screen.getByText('Active Sources')).toBeInTheDocument();
      expect(screen.getByText('490')).toBeInTheDocument(); // Total Leads
      expect(screen.getByText('$30,000')).toBeInTheDocument(); // Total Spend
      expect(screen.getByText('$55,000')).toBeInTheDocument(); // Attributed Revenue
      expect(screen.getByText('+83.3%')).toBeInTheDocument(); // Overall ROI
    });

    it('renders report filter controls (FR-11)', () => {
      render(<AcquisitionDashboard summary={mockSummary} sources={mockSources} />);

      const controls = screen.getByTestId('filter-controls');
      expect(controls).toBeInTheDocument();

      expect(screen.getByTestId('filter-start-date')).toBeInTheDocument();
      expect(screen.getByTestId('filter-end-date')).toBeInTheDocument();
      expect(screen.getByTestId('filter-source-id')).toBeInTheDocument();
      expect(screen.getByTestId('filter-region')).toBeInTheDocument();
      expect(screen.getByTestId('filter-campaign')).toBeInTheDocument();
    });

    it('renders table rows for each acquisition source (FR-1, FR-2)', () => {
      render(<AcquisitionDashboard summary={mockSummary} sources={mockSources} />);

      expect(screen.getByTestId('source-row-src-google-paid')).toBeInTheDocument();
      expect(screen.getByTestId('source-row-src-organic-seo')).toBeInTheDocument();
      expect(screen.getByTestId('source-row-src-event-booth')).toBeInTheDocument();

      expect(screen.getByText('Google Paid Search')).toBeInTheDocument();
      expect(screen.getByText('Organic Search')).toBeInTheDocument();
      expect(screen.getByText('Trade Show Event')).toBeInTheDocument();

      expect(screen.getByText('+250.0%')).toBeInTheDocument();
      expect(screen.getByText('-46.7%')).toBeInTheDocument();
    });
  });

  describe('Interactions & Callbacks', () => {
    it('triggers onFilterChange when inputs are updated', () => {
      const handleFilterChange = vi.fn();
      render(
        <AcquisitionDashboard
          summary={mockSummary}
          sources={mockSources}
          onFilterChange={handleFilterChange}
        />
      );

      const regionInput = screen.getByTestId('filter-region');
      fireEvent.change(regionInput, { target: { value: 'North America' } });

      expect(handleFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ region_name: 'North America' })
      );
    });

    it('filters sources table using search input', () => {
      render(<AcquisitionDashboard summary={mockSummary} sources={mockSources} />);

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'Google' } });

      expect(screen.getByTestId('source-row-src-google-paid')).toBeInTheDocument();
      expect(screen.queryByTestId('source-row-src-organic-seo')).not.toBeInTheDocument();
      expect(screen.queryByTestId('source-row-src-event-booth')).not.toBeInTheDocument();
    });

    it('triggers onSourceSelect and onSourceClick when a source row is clicked', () => {
      const handleSourceSelect = vi.fn();
      const handleSourceClick = vi.fn();

      render(
        <AcquisitionDashboard
          summary={mockSummary}
          sources={mockSources}
          onSourceSelect={handleSourceSelect}
          onSourceClick={handleSourceClick}
        />
      );

      const row = screen.getByTestId('source-row-src-google-paid');
      fireEvent.click(row);

      expect(handleSourceSelect).toHaveBeenCalledWith(mockSources[0]);
      expect(handleSourceClick).toHaveBeenCalledWith('src-google-paid');
    });

    it('displays error banner when error prop is provided', () => {
      render(
        <AcquisitionDashboard
          summary={mockSummary}
          sources={mockSources}
          error="Failed to load acquisition sources"
        />
      );

      const errorBanner = screen.getByTestId('error-banner');
      expect(errorBanner).toBeInTheDocument();
      expect(errorBanner).toHaveTextContent('Failed to load acquisition sources');
    });

    it('displays loading state when isLoading is true', () => {
      render(<AcquisitionDashboard sources={[]} isLoading={true} />);

      expect(
        screen.getByText('Loading lead acquisition source metrics...')
      ).toBeInTheDocument();
    });

    it('displays empty state when no sources are available', () => {
      render(<AcquisitionDashboard sources={[]} isLoading={false} />);

      expect(screen.getByText('No acquisition sources found.')).toBeInTheDocument();
    });
  });
});
