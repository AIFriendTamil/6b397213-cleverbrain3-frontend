import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  HeatMap,
  formatPercentage,
  formatCurrency,
  formatNumber,
  getDensityTier,
  getQualityTier,
  projectLongitudeToX,
  projectLatitudeToY,
} from '../src/components/territory/HeatMap';
import { TerritoryDensityMetrics } from '../src/services/api_client';

describe('HeatMap Component (Feature 005 - T024)', () => {
  const mockTerritoryMetrics: TerritoryDensityMetrics[] = [
    {
      region_name: 'North America',
      opportunity_count: 250,
      total_deal_value: 1250000.0,
      average_quality_score: 82.5,
      density_score: 50.0, // High density
      latitude: 37.7749,
      longitude: -122.4194,
    },
    {
      region_name: 'Europe',
      opportunity_count: 120,
      total_deal_value: 680000.0,
      average_quality_score: 65.0,
      density_score: 24.0, // Medium density
      latitude: 48.8566,
      longitude: 2.3522,
    },
    {
      region_name: 'Asia Pacific',
      opportunity_count: 50,
      total_deal_value: 210000.0,
      average_quality_score: 42.0,
      density_score: 10.0, // Medium density
      latitude: 35.6762,
      longitude: 139.6503,
    },
    {
      region_name: 'Latin America',
      opportunity_count: 20,
      total_deal_value: 80000.0,
      average_quality_score: 35.0,
      density_score: 4.0, // Low density
      latitude: -23.5505,
      longitude: -46.6333,
    },
  ];

  const mockUnmappedMetric: TerritoryDensityMetrics = {
    region_name: 'Unmapped Region',
    opportunity_count: 60,
    total_deal_value: 180000.0,
    average_quality_score: 55.0,
    density_score: 12.0,
    latitude: 0.0,
    longitude: 0.0,
  };

  const mockAvailableSources = [
    { source_id: 'src-google', source_name: 'Google Paid Search' },
    { source_id: 'src-linkedin', source_name: 'LinkedIn Ads' },
  ];

  const mockAvailableCampaigns = [
    { campaign_id: 'camp-q1', campaign_name: 'Q1 Executive Campaign' },
    { campaign_id: 'camp-summer', campaign_name: 'Summer Promo' },
  ];

  const mockAvailableRegions = ['North America', 'Europe', 'Asia Pacific', 'Latin America'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Formatter and Projection Helpers', () => {
    it('formats percentage correctly', () => {
      expect(formatPercentage(50)).toBe('50.0%');
      expect(formatPercentage(12.345)).toBe('12.3%');
      expect(formatPercentage(0)).toBe('0.0%');
      expect(formatPercentage(null)).toBe('0.0%');
      expect(formatPercentage(undefined)).toBe('0.0%');
    });

    it('formats currency correctly', () => {
      expect(formatCurrency(1250000)).toBe('$1,250,000');
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(null)).toBe('$0');
    });

    it('formats numbers with thousand separators', () => {
      expect(formatNumber(1250)).toBe('1,250');
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(null)).toBe('0');
    });

    it('evaluates density tiers based on density score threshold', () => {
      expect(getDensityTier(30).tier).toBe('high');
      expect(getDensityTier(25).tier).toBe('high');
      expect(getDensityTier(15).tier).toBe('medium');
      expect(getDensityTier(5).tier).toBe('low');
      expect(getDensityTier(0).tier).toBe('unmapped');
    });

    it('evaluates quality tiers based on quality score threshold', () => {
      expect(getQualityTier(85).label).toBe('High Quality');
      expect(getQualityTier(50).label).toBe('Moderate');
      expect(getQualityTier(25).label).toBe('Low Quality');
    });

    it('projects latitude and longitude to percentage coordinates', () => {
      const x = projectLongitudeToX(0);
      const y = projectLatitudeToY(0);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(100);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(100);
    });
  });

  describe('Component Rendering', () => {
    it('renders heat map header, title, and summary KPI cards', () => {
      render(
        <HeatMap
          data={mockTerritoryMetrics}
          unmappedData={mockUnmappedMetric}
        />
      );

      expect(screen.getByText('Regional Opportunity Heat Map')).toBeInTheDocument();
      expect(screen.getByTestId('heatmap-summary-cards')).toBeInTheDocument();
      expect(screen.getByText('North America')).toBeInTheDocument(); // Top density
    });

    it('renders view mode buttons and toggles between Map, Cards, and Table views', () => {
      render(<HeatMap data={mockTerritoryMetrics} unmappedData={mockUnmappedMetric} />);

      const mapBtn = screen.getByTestId('heatmap-view-map-btn');
      const cardsBtn = screen.getByTestId('heatmap-view-cards-btn');
      const tableBtn = screen.getByTestId('heatmap-view-table-btn');

      expect(screen.getByTestId('heatmap-map-canvas')).toBeInTheDocument();

      // Switch to Cards View
      fireEvent.click(cardsBtn);
      expect(screen.getByTestId('heatmap-cards-grid')).toBeInTheDocument();
      expect(screen.getByTestId('heatmap-card-north-america')).toBeInTheDocument();

      // Switch to Data Table View
      fireEvent.click(tableBtn);
      expect(screen.getByTestId('heatmap-table-container')).toBeInTheDocument();
      expect(screen.getByTestId('heatmap-table-row-north-america')).toBeInTheDocument();

      // Switch back to Map View
      fireEvent.click(mapBtn);
      expect(screen.getByTestId('heatmap-map-canvas')).toBeInTheDocument();
    });

    it('renders unmapped region card when unmapped data is present', () => {
      render(
        <HeatMap
          data={mockTerritoryMetrics}
          unmappedData={mockUnmappedMetric}
          showUnmappedCard={true}
        />
      );

      expect(screen.getByTestId('heatmap-unmapped-region-card')).toBeInTheDocument();
      expect(screen.getByText('Unmapped Category')).toBeInTheDocument();
    });
  });

  describe('Filter Controls & Interactions (FR-9, FR-11)', () => {
    it('allows entering filter values and triggers onFilterChange on submit', () => {
      const handleFilterChange = vi.fn();

      render(
        <HeatMap
          data={mockTerritoryMetrics}
          availableSources={mockAvailableSources}
          availableCampaigns={mockAvailableCampaigns}
          availableRegions={mockAvailableRegions}
          onFilterChange={handleFilterChange}
        />
      );

      const regionSelect = screen.getByTestId('filter-region-select');
      const minDealInput = screen.getByTestId('filter-min-deal-input');
      const minQualityInput = screen.getByTestId('filter-min-quality-input');
      const startDateInput = screen.getByTestId('filter-start-date-input');
      const endDateInput = screen.getByTestId('filter-end-date-input');
      const sourceSelect = screen.getByTestId('filter-lead-source-select');
      const campaignSelect = screen.getByTestId('filter-campaign-select');
      const applyBtn = screen.getByTestId('heatmap-apply-filters-btn');

      fireEvent.change(regionSelect, { target: { value: 'North America' } });
      fireEvent.change(minDealInput, { target: { value: '50000' } });
      fireEvent.change(minQualityInput, { target: { value: '60' } });
      fireEvent.change(startDateInput, { target: { value: '2026-01-01' } });
      fireEvent.change(endDateInput, { target: { value: '2026-12-31' } });
      fireEvent.change(sourceSelect, { target: { value: 'src-google' } });
      fireEvent.change(campaignSelect, { target: { value: 'camp-q1' } });

      fireEvent.click(applyBtn);

      expect(handleFilterChange).toHaveBeenCalledWith({
        region_name: 'North America',
        min_deal_size: 50000,
        min_quality_score: 60,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        source_id: 'src-google',
        campaign_id: 'camp-q1',
      });
    });

    it('resets filter controls when reset button is clicked', () => {
      const handleFilterChange = vi.fn();

      render(
        <HeatMap
          data={mockTerritoryMetrics}
          initialFilters={{ region_name: 'Europe', min_deal_size: 10000 }}
          onFilterChange={handleFilterChange}
        />
      );

      const resetBtn = screen.getByTestId('heatmap-reset-filters-btn');
      fireEvent.click(resetBtn);

      expect(handleFilterChange).toHaveBeenCalledWith({});
    });
  });

  describe('Region Selection & Detail Focus', () => {
    it('selects region when node/card/row is clicked and shows focus drawer', () => {
      const handleRegionSelect = vi.fn();
      const handleRegionClick = vi.fn();

      render(
        <HeatMap
          data={mockTerritoryMetrics}
          onRegionSelect={handleRegionSelect}
          onRegionClick={handleRegionClick}
        />
      );

      // Switch to Cards View for easy click selection
      fireEvent.click(screen.getByTestId('heatmap-view-cards-btn'));

      const naCard = screen.getByTestId('heatmap-card-north-america');
      fireEvent.click(naCard);

      expect(handleRegionSelect).toHaveBeenCalledWith('North America');
      expect(handleRegionClick).toHaveBeenCalledWith(mockTerritoryMetrics[0]);

      // Verify selected detail focus drawer renders
      expect(screen.getByTestId('heatmap-selected-region-detail')).toBeInTheDocument();
      expect(screen.getByText('Territory Focus Detail')).toBeInTheDocument();

      // Clear selection button
      const clearBtn = screen.getByTestId('heatmap-clear-selection-btn');
      fireEvent.click(clearBtn);

      expect(handleRegionSelect).toHaveBeenCalledWith(null);
      expect(screen.queryByTestId('heatmap-selected-region-detail')).not.toBeInTheDocument();
    });
  });

  describe('Loading, Error, and Empty States', () => {
    it('renders loading indicator when isLoading prop is true', () => {
      render(<HeatMap isLoading={true} />);
      expect(screen.getByTestId('heatmap-loading-state')).toBeInTheDocument();
      expect(screen.getByText(/Loading geographic opportunity heat map metrics/i)).toBeInTheDocument();
    });

    it('renders error message when error prop is provided', () => {
      render(<HeatMap error="Network error loading territory data" />);
      expect(screen.getByTestId('heatmap-error-state')).toBeInTheDocument();
      expect(screen.getByText(/Network error loading territory data/i)).toBeInTheDocument();
    });

    it('renders empty state when data array is empty', () => {
      render(<HeatMap data={[]} unmappedData={null} />);
      expect(screen.getByTestId('heatmap-empty-state')).toBeInTheDocument();
      expect(screen.getByText('No Regional Opportunity Data Found')).toBeInTheDocument();
    });
  });
});
