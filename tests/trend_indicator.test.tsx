import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TrendIndicator } from '../src/components/dashboard/TrendIndicator';

describe('TrendIndicator Component', () => {
  it('renders upward trend indicator with directional arrow and formatted percentage', () => {
    render(
      <TrendIndicator
        direction="up"
        percentage={12.5}
        baselineLabel="vs prior month"
      />
    );

    const indicator = screen.getByTestId('trend-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute('aria-label', 'Upward trend: +12.5% vs prior month');

    const arrow = screen.getByTestId('trend-arrow-up');
    expect(arrow).toBeInTheDocument();

    const value = screen.getByTestId('trend-value');
    expect(value).toHaveTextContent('+12.5%');

    const baseline = screen.getByTestId('trend-baseline');
    expect(baseline).toHaveTextContent('vs prior month');
  });

  it('renders downward trend indicator with directional arrow and formatted percentage', () => {
    render(
      <TrendIndicator
        trend_direction="down"
        trend_percentage={8.3}
        baselineLabel="vs prior quarter"
      />
    );

    const indicator = screen.getByTestId('trend-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute('aria-label', 'Downward trend: -8.3% vs prior quarter');

    const arrow = screen.getByTestId('trend-arrow-down');
    expect(arrow).toBeInTheDocument();

    const value = screen.getByTestId('trend-value');
    expect(value).toHaveTextContent('-8.3%');

    const baseline = screen.getByTestId('trend-baseline');
    expect(baseline).toHaveTextContent('vs prior quarter');
  });

  it('renders flat trend indicator when direction is flat or 0 percentage', () => {
    render(
      <TrendIndicator
        direction="flat"
        percentage={0}
        baselineLabel="vs baseline"
      />
    );

    const indicator = screen.getByTestId('trend-indicator');
    expect(indicator).toBeInTheDocument();

    const arrow = screen.getByTestId('trend-arrow-flat');
    expect(arrow).toBeInTheDocument();

    const value = screen.getByTestId('trend-value');
    expect(value).toHaveTextContent('0%');
  });

  it('supports custom test ID and custom class name', () => {
    render(
      <TrendIndicator
        direction="up"
        percentage={5}
        className="custom-trend-class"
        data-testid="custom-trend-indicator"
      />
    );

    const indicator = screen.getByTestId('custom-trend-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass('custom-trend-class');
  });

  it('handles negative percentage input cleanly for downward trend', () => {
    render(
      <TrendIndicator
        direction="down"
        percentage={-15.2}
        baselineLabel="vs prior month"
      />
    );

    const value = screen.getByTestId('trend-value');
    expect(value).toHaveTextContent('-15.2%');
  });
});
