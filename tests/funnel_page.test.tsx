import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FunnelPage, { FunnelPageContent } from '../src/app/funnel/page';
import { CurrentUserResponse } from '../src/services/auth';
import { FunnelStageMetrics, StageLeadDrillDownResponse } from '../src/services/api_client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/funnel',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockUser: CurrentUserResponse = {
  user_id: 'usr-funnel-101',
  email: 'growth.director@example.com',
  full_name: 'Growth Director',
  tenant_id: 'tnt-growth-202',
};

const mockStages: FunnelStageMetrics[] = [
  {
    stage_id: 'stage-lead-inflow',
    stage_name: 'Lead Inflow',
    stage_order: 1,
    lead_count: 500,
    conversion_rate_percentage: 100.0,
    target_conversion_rate: 100.0,
    is_bottleneck: false,
  },
  {
    stage_id: 'stage-mql',
    stage_name: 'Marketing Qualified Lead (MQL)',
    stage_order: 2,
    lead_count: 300,
    conversion_rate_percentage: 60.0,
    target_conversion_rate: 70.0,
    is_bottleneck: true,
  },
  {
    stage_id: 'stage-closed-won',
    stage_name: 'Closed Won Opportunity',
    stage_order: 3,
    lead_count: 120,
    conversion_rate_percentage: 40.0,
    target_conversion_rate: 35.0,
    is_bottleneck: false,
  },
];

const mockDrillDownLeads: StageLeadDrillDownResponse = {
  stage_id: 'stage-mql',
  stage_name: 'Marketing Qualified Lead (MQL)',
  total_leads: 1,
  page: 1,
  limit: 5,
  leads: [
    {
      lead_id: 'lead-999',
      source_id: 'src-google',
      campaign_id: 'camp-summer',
      quality_score: 82,
      status_stage: 'stage-mql',
      region_name: 'North America',
      state_code: 'NY',
      postal_code: '10001',
      deal_value: 30000,
      created_timestamp: '2026-05-10T08:00:00Z',
      time_in_stage_days: 4.2,
    },
  ],
};

describe('FunnelPage Route Component', () => {
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
      <FunnelPage
        fetchUser={mockFetchUser}
        autoFetch={false}
        initialStages={mockStages}
      />
    );

    expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading session...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('funnel-page')).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users to /login when fetchUser rejects', async () => {
    const mockFetchUser = vi.fn().mockRejectedValue(new Error('Unauthorized'));

    render(<FunnelPage fetchUser={mockFetchUser} autoFetch={false} />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders header, navigation links, and funnel chart when initialUser is supplied', () => {
    render(
      <FunnelPage
        user={mockUser}
        autoFetch={false}
        initialStages={mockStages}
      />
    );

    expect(screen.getByTestId('funnel-page')).toBeInTheDocument();
    expect(screen.getByTestId('funnel-header')).toBeInTheDocument();
    expect(screen.getByTestId('funnel-eyebrow')).toHaveTextContent('Lead Acquisition & Funnel Analytics');
    expect(screen.getByTestId('funnel-title')).toHaveTextContent('Conversion Funnel & Operational Bottlenecks');
    expect(screen.getByTestId('funnel-description')).toBeInTheDocument();

    // Quick action links
    expect(screen.getByTestId('acquisition-dashboard-link')).toHaveAttribute('href', '/acquisition');
    expect(screen.getByTestId('campaign-matrix-link')).toHaveAttribute('href', '/campaigns');
    expect(screen.getByTestId('territory-heatmap-link')).toHaveAttribute('href', '/territory');
    expect(screen.getByTestId('meetings-calendar-link')).toHaveAttribute('href', '/meetings');

    // FunnelChart section and content
    expect(screen.getByTestId('funnel-chart-section')).toBeInTheDocument();
    expect(screen.getByTestId('funnel-chart')).toBeInTheDocument();
    expect(screen.getByText('Lead Inflow')).toBeInTheDocument();
    expect(screen.getByText('Marketing Qualified Lead (MQL)')).toBeInTheDocument();
  });

  it('passes selectedStageId and selectedStageLeads down to FunnelChart', () => {
    render(
      <FunnelPageContent
        user={mockUser}
        autoFetch={false}
        initialStages={mockStages}
        selectedStageId="stage-mql"
        selectedStageLeads={mockDrillDownLeads}
      />
    );

    expect(screen.getByTestId('funnel-drill-down')).toBeInTheDocument();
    expect(screen.getByTestId('drill-down-title')).toHaveTextContent('Marketing Qualified Lead (MQL) — Lead Drill-Down Details');
    expect(screen.getByText('lead-999')).toBeInTheDocument();
    expect(screen.getByText('North America')).toBeInTheDocument();
  });

  it('fires callbacks onStageSelect when stage is clicked', () => {
    const handleStageSelect = vi.fn();

    render(
      <FunnelPageContent
        user={mockUser}
        autoFetch={false}
        initialStages={mockStages}
        onStageSelect={handleStageSelect}
      />
    );

    const mqlStageCard = screen.getByTestId('stage-card-stage-mql');
    fireEvent.click(mqlStageCard);

    expect(handleStageSelect).toHaveBeenCalledWith('stage-mql');
  });
});
