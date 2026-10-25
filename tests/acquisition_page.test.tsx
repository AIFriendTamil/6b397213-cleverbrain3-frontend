import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AcquisitionPage, { AcquisitionPageContent } from '../src/app/acquisition/page';
import { CurrentUserResponse } from '../src/services/auth';
import { AcquisitionSummary, SourceROIMetrics } from '../src/services/api_client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/acquisition',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockUser: CurrentUserResponse = {
  user_id: 'usr-acq-789',
  email: 'growth.lead@example.com',
  full_name: 'Growth Lead',
  tenant_id: 'tnt-growth-101',
};

const mockSources: SourceROIMetrics[] = [
  {
    source_id: 'src-google-ads',
    source_name: 'Google Ads Search',
    total_leads: 120,
    average_quality_score: 85.0,
    total_spend: 8000,
    attributed_revenue: 24000,
    calculated_roi_percentage: 200.0,
  },
  {
    source_id: 'src-linkedin-sponsored',
    source_name: 'LinkedIn Sponsored Content',
    total_leads: 60,
    average_quality_score: 72.0,
    total_spend: 12000,
    attributed_revenue: 18000,
    calculated_roi_percentage: 50.0,
  },
];

const mockSummary: AcquisitionSummary = {
  total_sources: 2,
  total_leads: 180,
  overall_average_quality_score: 80.7,
  total_spend: 20000,
  total_attributed_revenue: 42000,
  overall_roi_percentage: 110.0,
  sources: mockSources,
};

describe('AcquisitionPage Route Component', () => {
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
      <AcquisitionPage
        fetchUser={mockFetchUser}
        autoFetch={false}
        initialSummary={mockSummary}
        initialSources={mockSources}
      />
    );

    expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading session...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('acquisition-page')).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users to /login when fetchUser rejects', async () => {
    const mockFetchUser = vi.fn().mockRejectedValue(new Error('Unauthorized'));

    render(<AcquisitionPage fetchUser={mockFetchUser} autoFetch={false} />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders header, title, eyebrow, description, navigation links, and dashboard when authenticated', async () => {
    const mockFetchUser = vi.fn().mockResolvedValue(mockUser);

    render(
      <AcquisitionPage
        fetchUser={mockFetchUser}
        autoFetch={false}
        initialSummary={mockSummary}
        initialSources={mockSources}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('acquisition-page')).toBeInTheDocument();
    });

    // Header elements
    expect(screen.getByTestId('acquisition-header')).toBeInTheDocument();
    expect(screen.getByTestId('acquisition-eyebrow')).toHaveTextContent(
      'Lead Acquisition & Funnel Analytics'
    );
    expect(screen.getByTestId('acquisition-title')).toHaveTextContent(
      'Lead Acquisition & ROI Dashboard'
    );
    expect(screen.getByTestId('acquisition-description')).toHaveTextContent(
      'Track lead acquisition channels'
    );

    // Navigation links
    const funnelLink = screen.getByTestId('funnel-analytics-link');
    expect(funnelLink).toBeInTheDocument();
    expect(funnelLink).toHaveAttribute('href', '/funnel');

    const campaignLink = screen.getByTestId('campaign-matrix-link');
    expect(campaignLink).toBeInTheDocument();
    expect(campaignLink).toHaveAttribute('href', '/campaigns');

    const territoryLink = screen.getByTestId('territory-heatmap-link');
    expect(territoryLink).toBeInTheDocument();
    expect(territoryLink).toHaveAttribute('href', '/territory');

    // Dashboard section
    expect(screen.getByTestId('acquisition-dashboard-section')).toBeInTheDocument();
    expect(screen.getByTestId('acquisition-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Google Ads Search')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn Sponsored Content')).toBeInTheDocument();
  });

  it('renders directly when explicit user prop is passed', () => {
    render(
      <AcquisitionPage
        user={mockUser}
        autoFetch={false}
        initialSummary={mockSummary}
        initialSources={mockSources}
      />
    );

    expect(screen.getByTestId('acquisition-page')).toBeInTheDocument();
    expect(screen.getByTestId('acquisition-title')).toHaveTextContent(
      'Lead Acquisition & ROI Dashboard'
    );
    expect(screen.getByText('Google Ads Search')).toBeInTheDocument();
  });

  it('passes onSourceSelect and onFilterChange callbacks to AcquisitionDashboard', () => {
    const mockOnSourceSelect = vi.fn();
    const mockOnFilterChange = vi.fn();

    render(
      <AcquisitionPageContent
        user={mockUser}
        autoFetch={false}
        initialSummary={mockSummary}
        initialSources={mockSources}
        onSourceSelect={mockOnSourceSelect}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.getByTestId('acquisition-dashboard')).toBeInTheDocument();

    // Click on a source row
    const sourceRow = screen.getByText('Google Ads Search');
    fireEvent.click(sourceRow);

    expect(mockOnSourceSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        source_id: 'src-google-ads',
        source_name: 'Google Ads Search',
      })
    );
  });

  it('handles user logout action via NavMenu', async () => {
    const mockOnLogout = vi.fn().mockResolvedValue(undefined);

    render(
      <AcquisitionPage
        user={mockUser}
        onLogout={mockOnLogout}
        autoFetch={false}
        initialSummary={mockSummary}
        initialSources={mockSources}
      />
    );

    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();
    const logoutBtn = screen.getByTestId('nav-logout-btn');
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(mockOnLogout).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
