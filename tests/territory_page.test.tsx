import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TerritoryPage, { TerritoryPageContent } from '../src/app/territory/page';
import { CurrentUserResponse } from '../src/services/auth';
import { TerritoryDensityMetrics } from '../src/services/api_client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/territory',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockUser: CurrentUserResponse = {
  user_id: 'usr-ter-789',
  email: 'territory.manager@example.com',
  full_name: 'Territory Manager',
  tenant_id: 'tnt-growth-101',
};

const mockMetrics: TerritoryDensityMetrics[] = [
  {
    region_name: 'North America',
    opportunity_count: 250,
    total_deal_value: 1250000.0,
    average_quality_score: 82.5,
    density_score: 50.0,
    latitude: 37.7749,
    longitude: -122.4194,
  },
  {
    region_name: 'Europe',
    opportunity_count: 120,
    total_deal_value: 680000.0,
    average_quality_score: 65.0,
    density_score: 24.0,
    latitude: 48.8566,
    longitude: 2.3522,
  },
];

const mockUnmappedMetric: TerritoryDensityMetrics = {
  region_name: 'Unmapped Region',
  opportunity_count: 40,
  total_deal_value: 120000.0,
  average_quality_score: 50.0,
  density_score: 8.0,
  latitude: 0.0,
  longitude: 0.0,
};

describe('TerritoryPage Route Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders session loading state initially when session is resolving', async () => {
    const mockFetchUser = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mockUser), 50)
        )
    );

    render(
      <TerritoryPage
        fetchUser={mockFetchUser}
        autoFetch={false}
        initialData={mockMetrics}
        initialUnmappedData={mockUnmappedMetric}
      />
    );

    expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading session...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('territory-page')).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users to /login when fetchUser rejects', async () => {
    const mockFetchUser = vi.fn().mockRejectedValue(new Error('Unauthorized'));

    render(<TerritoryPage fetchUser={mockFetchUser} autoFetch={false} />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders Territory reporting page header and quick links when authenticated', () => {
    render(
      <TerritoryPageContent
        user={mockUser}
        autoFetch={false}
        initialData={mockMetrics}
        initialUnmappedData={mockUnmappedMetric}
      />
    );

    expect(screen.getByTestId('territory-page')).toBeInTheDocument();
    expect(screen.getByTestId('territory-header')).toBeInTheDocument();
    expect(screen.getByTestId('territory-eyebrow')).toHaveTextContent('Lead Acquisition & Territory Analytics');
    expect(screen.getByTestId('territory-title')).toHaveTextContent('Territory Opportunity Heatmap & Regional Reporting');
    expect(screen.getByTestId('territory-description')).toBeInTheDocument();

    // Verify quick action navigation links
    expect(screen.getByTestId('acquisition-dashboard-link')).toHaveAttribute('href', '/acquisition');
    expect(screen.getByTestId('funnel-analytics-link')).toHaveAttribute('href', '/funnel');
    expect(screen.getByTestId('campaign-matrix-link')).toHaveAttribute('href', '/campaigns');
    expect(screen.getByTestId('meetings-calendar-link')).toHaveAttribute('href', '/meetings');
  });

  it('passes initial data and handles filter changes in HeatMap component', () => {
    const handleFilterChange = vi.fn();

    render(
      <TerritoryPageContent
        user={mockUser}
        autoFetch={false}
        initialData={mockMetrics}
        initialUnmappedData={mockUnmappedMetric}
        onFilterChange={handleFilterChange}
        availableRegions={['North America', 'Europe']}
      />
    );

    expect(screen.getByTestId('territory-heatmap-section')).toBeInTheDocument();
    expect(screen.getByTestId('territory-heatmap')).toBeInTheDocument();

    // Trigger filter update in HeatMap
    const applyButton = screen.getByTestId('heatmap-apply-filters-button');
    fireEvent.click(applyButton);

    expect(handleFilterChange).toHaveBeenCalled();
  });
});
