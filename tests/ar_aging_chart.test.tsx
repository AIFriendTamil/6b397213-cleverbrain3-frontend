import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ArAgingChart,
  formatCurrency,
  formatPercentage,
  formatAsOfDate,
  calculateBucketMetrics,
} from '../src/components/financial/ArAgingChart';
import { ArAgingResponse } from '../src/services/financialApi';

describe('ArAgingChart Component', () => {
  const mockAgingData: ArAgingResponse = {
    account_id: 'acc-test-123',
    current_balance: 50000,
    bucket_30_balance: 20000,
    bucket_60_balance: 10000,
    bucket_90_plus_balance: 20000,
    total_outstanding: 100000,
    as_of_timestamp: '2026-10-24T14:00:00Z',
  };

  describe('Formatter and Helper Utilities', () => {
    it('formats monetary values correctly', () => {
      expect(formatCurrency(100000)).toBe('$100,000');
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(null)).toBe('$0');
      expect(formatCurrency(undefined)).toBe('$0');
    });

    it('formats percentage values correctly', () => {
      expect(formatPercentage(50)).toBe('50.0%');
      expect(formatPercentage(20)).toBe('20.0%');
      expect(formatPercentage(0)).toBe('0.0%');
      expect(formatPercentage(null)).toBe('0.0%');
    });

    it('formats as of timestamp correctly', () => {
      expect(formatAsOfDate('2026-10-24T14:00:00Z')).toContain('2026');
      expect(formatAsOfDate(null)).toBe('As of current date');
    });

    it('calculates bucket metrics and percentages accurately', () => {
      const derived = calculateBucketMetrics(mockAgingData);
      expect(derived.totalOutstanding).toBe(100000);
      expect(derived.totalOverdue).toBe(50000); // 20k + 10k + 20k
      expect(derived.overduePercentage).toBe(50);
      expect(derived.buckets.current.percentage).toBe(50);
      expect(derived.buckets.bucket_30.percentage).toBe(20);
      expect(derived.buckets.bucket_60.percentage).toBe(10);
      expect(derived.buckets.bucket_90_plus.percentage).toBe(20);
    });
  });

  describe('Component Rendering', () => {
    it('renders header title, account ID, and timestamp', () => {
      render(<ArAgingChart data={mockAgingData} accountId="acc-test-123" />);

      expect(screen.getByText('AR Aging Buckets')).toBeInTheDocument();
      expect(screen.getByText('Account: acc-test-123')).toBeInTheDocument();
      expect(screen.getByTestId('ar-aging-chart-total-outstanding')).toHaveTextContent('$100,000');
      expect(screen.getByTestId('ar-aging-chart-total-overdue')).toHaveTextContent('$50,000');
      expect(screen.getByTestId('ar-aging-chart-overdue-ratio')).toHaveTextContent('50.0%');
    });

    it('renders all 4 bucket cards with formatted amounts and risk badges', () => {
      render(<ArAgingChart data={mockAgingData} />);

      expect(screen.getByTestId('ar-aging-chart-card-current')).toBeInTheDocument();
      expect(screen.getByTestId('ar-aging-chart-card-bucket_30')).toBeInTheDocument();
      expect(screen.getByTestId('ar-aging-chart-card-bucket_60')).toBeInTheDocument();
      expect(screen.getByTestId('ar-aging-chart-card-bucket_90_plus')).toBeInTheDocument();

      expect(screen.getByTestId('ar-aging-chart-card-value-current')).toHaveTextContent('$50,000');
      expect(screen.getByTestId('ar-aging-chart-card-value-bucket_30')).toHaveTextContent('$20,000');
      expect(screen.getByTestId('ar-aging-chart-card-value-bucket_60')).toHaveTextContent('$10,000');
      expect(screen.getByTestId('ar-aging-chart-card-value-bucket_90_plus')).toHaveTextContent('$20,000');

      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.getByText('Moderate')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('toggles between Amount ($) and Share (%) view modes', () => {
      render(<ArAgingChart data={mockAgingData} showPercentageToggle={true} />);

      const pctBtn = screen.getByTestId('ar-aging-chart-view-pct-btn');
      fireEvent.click(pctBtn);

      expect(screen.getByTestId('ar-aging-chart-card-value-current')).toHaveTextContent('50.0%');
      expect(screen.getByTestId('ar-aging-chart-card-value-bucket_30')).toHaveTextContent('20.0%');

      const amountBtn = screen.getByTestId('ar-aging-chart-view-amount-btn');
      fireEvent.click(amountBtn);

      expect(screen.getByTestId('ar-aging-chart-card-value-current')).toHaveTextContent('$50,000');
    });

    it('handles interactive bucket selection and displays detail panel', () => {
      const onBucketSelectMock = vi.fn();
      const onBucketClickMock = vi.fn();

      render(
        <ArAgingChart
          data={mockAgingData}
          onBucketSelect={onBucketSelectMock}
          onBucketClick={onBucketClickMock}
        />
      );

      const bucket60Card = screen.getByTestId('ar-aging-chart-card-bucket_60');
      fireEvent.click(bucket60Card);

      expect(onBucketSelectMock).toHaveBeenCalledWith('bucket_60');
      expect(onBucketClickMock).toHaveBeenCalledWith('bucket_60');

      expect(screen.getByTestId('ar-aging-chart-bucket-detail-panel')).toBeInTheDocument();
      expect(screen.getByText('Bucket Overview: 31–60 Days Overdue')).toBeInTheDocument();
    });

    it('clears bucket selection when clear button is clicked', () => {
      const onBucketSelectMock = vi.fn();
      render(
        <ArAgingChart
          data={mockAgingData}
          selectedBucket="bucket_90_plus"
          onBucketSelect={onBucketSelectMock}
        />
      );

      expect(screen.getByTestId('ar-aging-chart-bucket-detail-panel')).toBeInTheDocument();

      const clearBtn = screen.getByTestId('ar-aging-chart-clear-selection-btn');
      fireEvent.click(clearBtn);

      expect(onBucketSelectMock).toHaveBeenCalledWith(null);
    });

    it('renders loading skeleton state when isLoading is true', () => {
      render(<ArAgingChart isLoading={true} />);

      expect(screen.getByTestId('ar-aging-chart-loading')).toBeInTheDocument();
    });

    it('renders error state banner when error prop is provided', () => {
      const onRefreshMock = vi.fn();
      render(<ArAgingChart error="Network Error: 500 Internal Server Error" onRefresh={onRefreshMock} />);

      expect(screen.getByTestId('ar-aging-chart-error')).toBeInTheDocument();
      expect(screen.getByText('Network Error: 500 Internal Server Error')).toBeInTheDocument();

      const retryBtn = screen.getByTestId('ar-aging-chart-retry-btn');
      fireEvent.click(retryBtn);
      expect(onRefreshMock).toHaveBeenCalledTimes(1);
    });

    it('renders zero balance empty state when total outstanding is 0', () => {
      const emptyData: ArAgingResponse = {
        account_id: 'acc-zero',
        current_balance: 0,
        bucket_30_balance: 0,
        bucket_60_balance: 0,
        bucket_90_plus_balance: 0,
        total_outstanding: 0,
        as_of_timestamp: '2026-10-24T14:00:00Z',
      };

      render(<ArAgingChart data={emptyData} />);

      expect(screen.getByTestId('ar-aging-chart-empty-state')).toBeInTheDocument();
      expect(screen.getByText('No outstanding accounts receivable balances currently exist.')).toBeInTheDocument();
    });
  });
});
