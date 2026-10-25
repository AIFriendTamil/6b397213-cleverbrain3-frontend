import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CampaignsPage, { CampaignsPageContent } from '../src/app/campaigns/page';
import { CurrentUserResponse } from '../src/services/auth';
import {
  Campaign,
  CampaignComparisonMatrix,
  getAcquisitionSources,
  getCampaigns,
  getTerritoryHeatmap,
  compareCampaigns,
} from '../src/services/api_client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/campaigns',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock API client services
vi.mock('../src/services/api_client', async () => {
  const actual = await vi.importActual<typeof import('../src/services/api_client')>('../src/services/api_client');
  return {
    ...actual,
    getAcquisitionSources: vi.fn(),
    getCampaigns: vi.fn(),
    getTerritoryHeatmap: vi.fn(),
    compareCampaigns: vi.fn(),
  };
});

const mockUser: CurrentUserResponse = {
  user_id: 'usr-cmp-999',
  email: 'campaign.lead@example.com',
  full_name: 'Campaign Manager',
  tenant_id: 'tnt-campaign-101',
};

const mockCampaigns: Campaign[] = [
  {
    campaign_id: 'cmp-001',
    campaign_name: 'Q3 Enterprise Search',
    budget_amount: 50000,
    spent_amount: 45000,
    created_timestamp: '2026-06-01T00:00:00Z',
  },
  {
    campaign_id: 'cmp-002',
    campaign_name: 'Social Retargeting',
    budget_amount: 25000,
    spent_amount: 22000,
    created_timestamp: '2026-06-01T00:00:00Z',
  },
];

const mockMatrix: CampaignComparisonMatrix = {
  campaigns: [
    {
      campaign_id: 'cmp-001',
      campaign_name: 'Q3 Enterprise Search',
      budget_amount: 50000,
      spent_amount: 45000,
      leads_generated: 450,
      average_quality_score: 82.5,
      converted_leads: 90,
      overall_conversion_rate: 20.0,
      attributed_revenue: 180000,
      total_roi_percentage: 300.0,
      cost_per_lead: 100.0,
      cost_per_conversion: 500.0,
    },
    {
      campaign_id: 'cmp-002',
      campaign_name: 'Social Retargeting',
      budget_amount: 25000,
      spent_amount: 22000,
      leads_generated: 220,
      average_quality_score: 68.0,
      converted_leads: 22,
      overall_conversion_rate: 10.0,
      attributed_revenue: 44000,
      total_roi_percentage: 100.0,
      cost_per_lead: 100.0,
      cost_per_conversion: 1000.0,
    },
  ],
  summary: {
    total_campaigns_compared: 2,
    best_roi_campaign_id: 'cmp-001',
    best_roi_campaign_name: 'Q3 Enterprise Search',
    best_conversion_campaign_id: 'cmp-001',
    best_conversion_campaign_name: 'Q3 Enterprise Search',
    highest_lead_volume_campaign_id: 'cmp-001',
    highest_lead_volume_campaign_name: 'Q3 Enterprise Search',
    total_spend_across_campaigns: 67000,
    total_revenue_across_campaigns: 224000,
    total_leads_across_campaigns: 670,
    average_roi_percentage: 200.0,
  },
};

describe('CampaignsPage Route Component (Feature 005 - T029)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAcquisitionSources).mockResolvedValue([
      { source_id: 'src-1', source_name: 'Paid Search', total_leads: 10, average_quality_score: 80, total_spend: 100, attributed_revenue: 200, calculated_roi_percentage: 100 },
    ]);
    vi.mocked(getCampaigns).mockResolvedValue(mockCampaigns);
    vi.mocked(getTerritoryHeatmap).mockResolvedValue([
      { region_name: 'North America', opportunity_count: 5, total_deal_value: 50000, average_quality_score: 80, density_score: 10, latitude: 0, longitude: 0 },
    ]);
    vi.mocked(compareCampaigns).mockResolvedValue(mockMatrix);
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
      <CampaignsPage
        fetchUser={mockFetchUser}
        autoFetch={false}
        initialMatrix={mockMatrix}
        initialCampaigns={mockCampaigns}
      />
    );

    expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading session...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('campaigns-page')).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users to /login when fetchUser rejects', async () => {
    const mockFetchUser = vi.fn().mockRejectedValue(new Error('Unauthorized'));

    render(<CampaignsPage fetchUser={mockFetchUser} autoFetch={false} />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders header, title, eyebrow, description, navigation links, and campaign matrix when authenticated', async () => {
    const mockFetchUser = vi.fn().mockResolvedValue(mockUser);

    render(
      <CampaignsPage
        fetchUser={mockFetchUser}
        autoFetch={false}
        initialMatrix={mockMatrix}
        initialCampaigns={mockCampaigns}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('campaigns-page')).toBeInTheDocument();
    });

    expect(screen.getByTestId('campaigns-header')).toBeInTheDocument();
    expect(screen.getByTestId('campaigns-eyebrow')).toHaveTextContent('Marketing Campaign Performance');
    expect(screen.getByTestId('campaigns-title')).toHaveTextContent('Campaign Comparison Matrix');
    expect(screen.getByTestId('campaigns-description')).toHaveTextContent('Compare side-by-side performance metrics across marketing campaigns');

    // Verify quick action navigation links
    expect(screen.getByTestId('acquisition-roi-link')).toHaveAttribute('href', '/acquisition');
    expect(screen.getByTestId('funnel-analytics-link')).toHaveAttribute('href', '/funnel');
    expect(screen.getByTestId('territory-heatmap-link')).toHaveAttribute('href', '/territory');
    expect(screen.getByTestId('sales-meetings-link')).toHaveAttribute('href', '/meetings');

    // Verify campaign matrix section
    expect(screen.getByTestId('campaigns-matrix-section')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-matrix-component')).toBeInTheDocument();
  });

  it('renders CampaignsPageContent directly when explicit user is provided', async () => {
    render(
      <CampaignsPageContent
        user={mockUser}
        autoFetch={false}
        initialMatrix={mockMatrix}
        initialCampaigns={mockCampaigns}
      />
    );

    expect(screen.getByTestId('campaigns-page')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-matrix-component')).toBeInTheDocument();
    expect(screen.getByText('Q3 Enterprise Search')).toBeInTheDocument();
  });

  it('triggers onFilterChange callback when filters in CampaignMatrix change', async () => {
    const onFilterChangeMock = vi.fn();

    render(
      <CampaignsPageContent
        user={mockUser}
        autoFetch={false}
        initialMatrix={mockMatrix}
        initialCampaigns={mockCampaigns}
        onFilterChange={onFilterChangeMock}
      />
    );

    expect(screen.getByTestId('campaigns-page')).toBeInTheDocument();

    // Toggle filter drawer if closed
    const toggleBtn = screen.getByTestId('toggle-filters-button');
    fireEvent.click(toggleBtn);

    // Change start timestamp filter
    const startDateInput = screen.getByTestId('filter-start-date-input');
    fireEvent.change(startDateInput, { target: { value: '2026-01-01' } });

    expect(onFilterChangeMock).toHaveBeenCalled();
  });

  it('auto-fetches available sources, regions, and campaigns when autoFetch is true', async () => {
    render(
      <CampaignsPageContent
        user={mockUser}
        autoFetch={true}
        initialMatrix={mockMatrix}
      />
    );

    await waitFor(() => {
      expect(getAcquisitionSources).toHaveBeenCalled();
      expect(getTerritoryHeatmap).toHaveBeenCalled();
      expect(getCampaigns).toHaveBeenCalled();
    });
  });
});
