import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ArrTrendChart,
  formatCurrency,
  formatPercentage,
  formatPeriodLabel,
  sortTrendDataPoints,
  calculateArrMetrics,
} from '../src/components/financial/ArrTrendChart';
import { ArrTrendDataPoint } from '../src/services/financialApi';

describe('ArrTrendChart Component & Utilities', () => {
  const mockTrendData: ArrTrendDataPoint[] = [
    {
      id: 'arr-1',
      account_id: 'acc-123',
      metric_period: '2025-Q1',
      arr_value: 1000000,
      currency: 'USD',
      original_currency: 'USD',
      recorded_at: '2025-03-31T00:00:00Z',
    },
    {
      id: 'arr-2',
      account_id: 'acc-123',
      metric_period: '2025-Q2',
      arr_value: 1100000,
      currency: 'USD',
      original_currency: 'USD',
      recorded_at: '2025-06-30T00:00:00Z',
    },
    {
      id: 'arr-3',
      account_id: 'acc-123',
      metric_period: '2025-Q3',
      arr_value: 1050000,
      currency: 'USD',
      original_currency: 'USD',
      recorded_at: '2025-09-30T00:00:00Z',
    },
    {
      id: 'arr-4',
      account_id: 'acc-123',
      metric_period: '2025-Q4',
      arr_value: 1250000,
      currency: 'USD',
      original_currency: 'USD',
      recorded_at: '2025-12-31T00:00:00Z',
    },
  ];

  describe('Utility Helper Functions', () => {
    it('formats monetary values properly across currencies and edge values', () => {
      expect(formatCurrency(1250000)).toBe('$1,250,000');
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(null)).toBe('$0');
      expect(formatCurrency(undefined)).toBe('$0');
      expect(formatCurrency(NaN)).toBe('$0');
      expect(formatCurrency(-50000)).toBe('-$50,000');
      expect(formatCurrency(1000, 'EUR')).toBe('€1,000');
      expect(formatCurrency(1000, 'GBP')).toBe('£1,000');
    });

    it('formats float percentage strings accurately', () => {
      expect(formatPercentage(12.5)).toBe('+12.5%');
      expect(formatPercentage(-4.8)).toBe('-4.8%');
      expect(formatPercentage(0)).toBe('0.0%');
      expect(formatPercentage(null)).toBe('0.0%');
      expect(formatPercentage(undefined)).toBe('0.0%');
    });

    it('formats metric period strings correctly', () => {
      expect(formatPeriodLabel('2025-Q1')).toBe('Q1 2025');
      expect(formatPeriodLabel('2025Q2')).toBe('Q2 2025');
      expect(formatPeriodLabel('2025-01')).toBe('Jan 2025');
      expect(formatPeriodLabel('2025-12')).toBe('Dec 2025');
      expect(formatPeriodLabel('2026')).toBe('2026');
      expect(formatPeriodLabel(null)).toBe('N/A');
    });

    it('sorts trend data points chronologically', () => {
      const unorderedData: ArrTrendDataPoint[] = [
        { ...mockTrendData[3] },
        { ...mockTrendData[0] },
        { ...mockTrendData[2] },
        { ...mockTrendData[1] },
      ];

      const sorted = sortTrendDataPoints(unorderedData);
      expect(sorted[0].metric_period).toBe('2025-Q1');
      expect(sorted[1].metric_period).toBe('2025-Q2');
      expect(sorted[2].metric_period).toBe('2025-Q3');
      expect(sorted[3].metric_period).toBe('2025-Q4');
    });

    it('calculates derived ARR metrics correctly', () => {
      const metrics = calculateArrMetrics(mockTrendData);

      expect(metrics.currentArr).toBe(1250000);
      expect(metrics.peakArr).toBe(1250000);
      expect(metrics.lowestArr).toBe(1000000);
      expect(metrics.averageArr).toBe(1100000); // (1000k + 1100k + 1050k + 1250k) / 4 = 1100k
      expect(metrics.latestPeriod).toBe('2025-Q4');
      expect(metrics.priorPeriodArr).toBe(1050000);
      expect(metrics.periodGrowthAmount).toBe(200000); // 1250k - 1050k
      expect(metrics.periodGrowthPercentage).toBeCloseTo(19.047, 1); // (200k / 1050k) * 100
      expect(metrics.isGrowthPositive).toBe(true);
      expect(metrics.historicCount).toBe(3);
      expect(metrics.dataPointsCount).toBe(4);
    });

    it('handles empty and null data in calculateArrMetrics cleanly', () => {
      const metrics = calculateArrMetrics([]);
      expect(metrics.currentArr).toBe(0);
      expect(metrics.peakArr).toBe(0);
      expect(metrics.averageArr).toBe(0);
      expect(metrics.dataPointsCount).toBe(0);
      expect(metrics.latestPeriod).toBeNull();
    });
  });

  describe('Component Rendering', () => {
    it('renders header, account context, and target currency tag', () => {
      render(
        <ArrTrendChart
          data={mockTrendData}
          accountId="acc-123"
          targetCurrency="USD"
        />
      );

      expect(screen.getByTestId('arr-trend-chart-title')).toHaveTextContent(
        'ARR Trends & Historic Revenue'
      );
      expect(screen.getByTestId('arr-trend-chart-account-id')).toHaveTextContent(
        'acc-123'
      );
      expect(screen.getByTestId('arr-trend-chart-currency-tag')).toHaveTextContent(
        'USD'
      );
    });

    it('renders all KPI summary cards with formatted metrics', () => {
      render(<ArrTrendChart data={mockTrendData} />);

      expect(screen.getByTestId('arr-trend-chart-kpi-current')).toBeInTheDocument();
      expect(screen.getByTestId('arr-trend-chart-kpi-peak')).toBeInTheDocument();
      expect(screen.getByTestId('arr-trend-chart-kpi-growth')).toBeInTheDocument();
      expect(screen.getByTestId('arr-trend-chart-kpi-average')).toBeInTheDocument();

      expect(screen.getByTestId('arr-trend-chart-current-val')).toHaveTextContent('$1,250,000');
      expect(screen.getByTestId('arr-trend-chart-peak-val')).toHaveTextContent('$1,250,000');
      expect(screen.getByTestId('arr-trend-chart-growth-val')).toHaveTextContent('$200,000');
      expect(screen.getByTestId('arr-trend-chart-average-val')).toHaveTextContent('$1,100,000');
    });

    it('renders visual column bars for all trend periods with current period tag', () => {
      render(<ArrTrendChart data={mockTrendData} />);

      expect(screen.getByTestId('arr-trend-chart-bar-2025-Q1')).toBeInTheDocument();
      expect(screen.getByTestId('arr-trend-chart-bar-2025-Q2')).toBeInTheDocument();
      expect(screen.getByTestId('arr-trend-chart-bar-2025-Q3')).toBeInTheDocument();
      expect(screen.getByTestId('arr-trend-chart-bar-2025-Q4')).toBeInTheDocument();

      expect(screen.getByTestId('arr-trend-chart-bar-value-2025-Q4')).toHaveTextContent('$1,250,000');
      expect(screen.getByTestId('arr-trend-chart-tag-current')).toHaveTextContent('Current');
    });

    it('handles clicking a column bar to select a period and display detail card', () => {
      const onSelectMock = vi.fn();
      const onClickMock = vi.fn();

      render(
        <ArrTrendChart
          data={mockTrendData}
          onPeriodSelect={onSelectMock}
          onPeriodClick={onClickMock}
        />
      );

      const q2Bar = screen.getByTestId('arr-trend-chart-bar-2025-Q2');
      fireEvent.click(q2Bar);

      expect(onSelectMock).toHaveBeenCalledWith('2025-Q2');
      expect(onClickMock).toHaveBeenCalledWith('2025-Q2');

      expect(screen.getByTestId('arr-trend-chart-selected-detail')).toBeInTheDocument();
      expect(screen.getByTestId('arr-trend-chart-selected-period-name')).toHaveTextContent('Q2 2025');
      expect(screen.getByTestId('arr-trend-chart-selected-arr-val')).toHaveTextContent('$1,100,000');
    });

    it('renders historical breakdown table and allows clicking row to select period', () => {
      const onSelectMock = vi.fn();

      render(<ArrTrendChart data={mockTrendData} onPeriodSelect={onSelectMock} />);

      expect(screen.getByTestId('arr-trend-chart-table')).toBeInTheDocument();

      const q3Row = screen.getByTestId('arr-trend-chart-row-2025-Q3');
      expect(q3Row).toBeInTheDocument();

      fireEvent.click(q3Row);
      expect(onSelectMock).toHaveBeenCalledWith('2025-Q3');
    });

    it('triggers period range selection and manual refresh button', () => {
      const onRangeChangeMock = vi.fn();
      const onRefreshMock = vi.fn();

      render(
        <ArrTrendChart
          data={mockTrendData}
          onPeriodRangeChange={onRangeChangeMock}
          onRefresh={onRefreshMock}
        />
      );

      const range1YBtn = screen.getByTestId('arr-trend-chart-range-1Y');
      fireEvent.click(range1YBtn);
      expect(onRangeChangeMock).toHaveBeenCalledWith('1Y');

      const refreshBtn = screen.getByTestId('arr-trend-chart-refresh-btn');
      fireEvent.click(refreshBtn);
      expect(onRefreshMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading, Error, and Empty States', () => {
    it('renders loading state skeleton when isLoading is true', () => {
      render(<ArrTrendChart isLoading={true} />);

      expect(screen.getByTestId('arr-trend-chart-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('arr-trend-chart-title')).not.toBeInTheDocument();
    });

    it('renders error banner with retry button when error prop is provided', () => {
      const onRefreshMock = vi.fn();

      render(
        <ArrTrendChart
          error="Failed to connect to financial analytics endpoint"
          onRefresh={onRefreshMock}
        />
      );

      expect(screen.getByTestId('arr-trend-chart-error')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to connect to financial analytics endpoint')
      ).toBeInTheDocument();

      const retryBtn = screen.getByTestId('arr-trend-chart-retry-btn');
      fireEvent.click(retryBtn);
      expect(onRefreshMock).toHaveBeenCalledTimes(1);
    });

    it('renders empty state when data array is empty or null', () => {
      render(<ArrTrendChart data={[]} accountId="acc-empty-999" />);

      expect(screen.getByTestId('arr-trend-chart-empty')).toBeInTheDocument();
      expect(screen.getByText('No ARR Trend Data Available')).toBeInTheDocument();
      expect(screen.getByText(/acc-empty-999/)).toBeInTheDocument();
    });
  });
});
