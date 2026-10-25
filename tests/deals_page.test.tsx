import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DealsPage, { DealsContent } from '../src/app/deals/page';
import { CurrentUserResponse } from '../src/services/auth';
import {
  PipelineFunnelSummary,
  Deal,
  Milestone,
  StakeholderGraphResponse,
  DealForecastResponse,
} from '../src/services/api_client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/deals',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockUser: CurrentUserResponse = {
  user_id: 'usr-deals-101',
  email: 'sales.lead@example.com',
  full_name: 'Sales Director',
  tenant_id: 'tnt-sales-999',
};

const mockFunnelSummary: PipelineFunnelSummary = {
  total_deals: 10,
  total_pipeline_value: 2000000,
  total_weighted_value: 900000,
  overall_average_win_probability: 0.45,
  overall_average_deal_age_days: 30.0,
  stages: [
    {
      stage_id: 'stage-qualification',
      stage_name: 'Qualification',
      display_order: 1,
      deal_count: 4,
      total_monetary_value: 800000,
      average_monetary_value: 200000,
      average_win_probability: 0.2,
      weighted_monetary_value: 160000,
      average_deal_age_days: 14.0,
      conversion_rate_from_previous: 1.0,
    },
    {
      stage_id: 'stage-proposal',
      stage_name: 'Proposal & Negotiation',
      display_order: 2,
      deal_count: 6,
      total_monetary_value: 1200000,
      average_monetary_value: 200000,
      average_win_probability: 0.6,
      weighted_monetary_value: 720000,
      average_deal_age_days: 35.0,
      conversion_rate_from_previous: 0.85,
    },
  ],
};

const mockDeals: Deal[] = [
  {
    id: 'deal-001',
    title: 'Acme Enterprise License',
    monetary_value: 500000,
    stage_id: 'stage-proposal',
    win_probability: 0.65,
    assigned_team_member_id: 'usr-rep-101',
  },
  {
    id: 'deal-002',
    title: 'Globex Cloud Expansion',
    monetary_value: 300000,
    stage_id: 'stage-qualification',
    win_probability: 0.25,
    assigned_team_member_id: 'usr-rep-102',
  },
];

const mockMilestones: Milestone[] = [
  {
    id: 'ms-001',
    deal_id: 'deal-001',
    title: 'Technical Proof of Concept',
    target_date: '2026-11-15',
    status: 'IN_PROGRESS',
    color_code: 'blue',
    critical_tasks: [
      {
        id: 'tsk-001',
        milestone_id: 'ms-001',
        title: 'Security Compliance Audit',
        due_date: '2026-11-01',
        is_critical: true,
        is_overdue: false,
        escalated_to_supervisor: false,
      },
    ],
  },
];

const mockStakeholders: StakeholderGraphResponse = {
  deal_id: 'deal-001',
  nodes: [
    {
      id: 'stk-001',
      name: 'Alice Smith',
      org_role: 'Chief Technology Officer',
      contact_email: 'alice@acme.com',
      deal_id: 'deal-001',
      subordinate_ids: [],
    },
  ],
  edges: [],
  dag_edges: [],
  has_cycles: false,
  detected_cycles: [],
  root_stakeholder_ids: ['stk-001'],
};

const mockForecast: DealForecastResponse = {
  deal_id: 'deal-001',
  predicted_close_date: '2026-12-15',
  confidence_score: 0.82,
  is_fallback: false,
  milestone_estimates: [
    {
      milestone_id: 'ms-001',
      milestone_title: 'Technical Proof of Concept',
      estimated_completion_date: '2026-11-12',
      confidence_score: 0.88,
    },
  ],
};

describe('DealsPage Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders page title, header, navigation menu, and filter controls', () => {
    render(
      <DealsContent
        user={mockUser}
        initialFunnel={mockFunnelSummary}
        initialDeals={mockDeals}
        initialMilestones={mockMilestones}
        initialStakeholders={mockStakeholders}
        initialForecast={mockForecast}
        autoFetch={false}
      />
    );

    expect(screen.getByTestId('deals-page')).toBeInTheDocument();
    expect(screen.getByTestId('deals-page-title')).toHaveTextContent('Sales Pipeline Dashboard');
    expect(screen.getByTestId('filter-controls-section')).toBeInTheDocument();

    expect(screen.getByTestId('filter-start-date')).toBeInTheDocument();
    expect(screen.getByTestId('filter-end-date')).toBeInTheDocument();
    expect(screen.getByTestId('filter-min-value')).toBeInTheDocument();
    expect(screen.getByTestId('filter-max-value')).toBeInTheDocument();
    expect(screen.getByTestId('filter-stage-id')).toBeInTheDocument();
    expect(screen.getByTestId('filter-team-member-id')).toBeInTheDocument();

    expect(screen.getByTestId('apply-filters-button')).toBeInTheDocument();
    expect(screen.getByTestId('reset-filters-button')).toBeInTheDocument();
  });

  it('renders integrated FunnelChart, MilestoneTracker, StakeholderGraph, and TimelineForecast components', () => {
    render(
      <DealsContent
        user={mockUser}
        initialFunnel={mockFunnelSummary}
        initialDeals={mockDeals}
        initialMilestones={mockMilestones}
        initialStakeholders={mockStakeholders}
        initialForecast={mockForecast}
        autoFetch={false}
      />
    );

    // FunnelChart
    expect(screen.getByTestId('funnel-chart')).toBeInTheDocument();

    // Active Deal Context Banner
    expect(screen.getByTestId('active-deal-title')).toHaveTextContent('Acme Enterprise License');
    expect(screen.getByTestId('active-deal-value')).toHaveTextContent('$500,000');

    // Integrated Sections
    expect(screen.getByTestId('section-milestones')).toBeInTheDocument();
    expect(screen.getByTestId('section-stakeholders')).toBeInTheDocument();
    expect(screen.getByTestId('section-forecast')).toBeInTheDocument();

    // Content inside integrated components
    expect(screen.getByText('Technical Proof of Concept')).toBeInTheDocument();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Chief Technology Officer')).toBeInTheDocument();
  });

  it('applies filters and invokes custom fetchers when form is submitted', async () => {
    const mockFetchFunnel = vi.fn().mockResolvedValue(mockFunnelSummary);
    const mockFetchDeals = vi.fn().mockResolvedValue(mockDeals);

    render(
      <DealsContent
        user={mockUser}
        fetchFunnel={mockFetchFunnel}
        fetchDealsList={mockFetchDeals}
        initialMilestones={mockMilestones}
        initialStakeholders={mockStakeholders}
        initialForecast={mockForecast}
        autoFetch={false}
      />
    );

    // Fill filter inputs
    fireEvent.change(screen.getByTestId('filter-start-date'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByTestId('filter-min-value'), { target: { value: '100000' } });
    fireEvent.change(screen.getByTestId('filter-stage-id'), { target: { value: 'stage-proposal' } });

    // Submit form
    fireEvent.click(screen.getByTestId('apply-filters-button'));

    await waitFor(() => {
      expect(mockFetchFunnel).toHaveBeenCalledWith({
        start_date: '2026-01-01',
        min_value: 100000,
        stage_id: 'stage-proposal',
      });
      expect(mockFetchDeals).toHaveBeenCalledWith({
        start_date: '2026-01-01',
        min_value: 100000,
        stage_id: 'stage-proposal',
      });
    });

    expect(screen.getByTestId('active-filters-badge')).toHaveTextContent('3 active filter(s)');
  });

  it('switches selected deal using the deal selector dropdown', async () => {
    const mockFetchMilestones = vi.fn().mockResolvedValue(mockMilestones);
    const mockFetchStakeholders = vi.fn().mockResolvedValue(mockStakeholders);
    const mockFetchForecast = vi.fn().mockResolvedValue(mockForecast);

    render(
      <DealsContent
        user={mockUser}
        initialFunnel={mockFunnelSummary}
        initialDeals={mockDeals}
        fetchMilestones={mockFetchMilestones}
        fetchStakeholdersGraph={mockFetchStakeholders}
        fetchTimelineForecast={mockFetchForecast}
        autoFetch={true}
      />
    );

    const selector = screen.getByTestId('deal-selector');
    expect(selector).toHaveValue('deal-001');

    // Change deal selection to deal-002
    fireEvent.change(selector, { target: { value: 'deal-002' } });

    await waitFor(() => {
      expect(mockFetchMilestones).toHaveBeenCalledWith('deal-002');
      expect(mockFetchStakeholders).toHaveBeenCalledWith('deal-002');
      expect(mockFetchForecast).toHaveBeenCalledWith('deal-002');
    });

    expect(screen.getByTestId('active-deal-title')).toHaveTextContent('Globex Cloud Expansion');
  });

  it('filters by view tabs (Milestones, Stakeholders, Forecast)', () => {
    render(
      <DealsContent
        user={mockUser}
        initialFunnel={mockFunnelSummary}
        initialDeals={mockDeals}
        initialMilestones={mockMilestones}
        initialStakeholders={mockStakeholders}
        initialForecast={mockForecast}
        autoFetch={false}
      />
    );

    // Switch to Milestones Tab
    fireEvent.click(screen.getByTestId('tab-milestones'));
    expect(screen.getByTestId('section-milestones')).toBeInTheDocument();
    expect(screen.queryByTestId('section-stakeholders')).not.toBeInTheDocument();
    expect(screen.queryByTestId('section-forecast')).not.toBeInTheDocument();

    // Switch to Stakeholders Tab
    fireEvent.click(screen.getByTestId('tab-stakeholders'));
    expect(screen.queryByTestId('section-milestones')).not.toBeInTheDocument();
    expect(screen.getByTestId('section-stakeholders')).toBeInTheDocument();
    expect(screen.queryByTestId('section-forecast')).not.toBeInTheDocument();

    // Switch to Forecast Tab
    fireEvent.click(screen.getByTestId('tab-forecast'));
    expect(screen.queryByTestId('section-milestones')).not.toBeInTheDocument();
    expect(screen.queryByTestId('section-stakeholders')).not.toBeInTheDocument();
    expect(screen.getByTestId('section-forecast')).toBeInTheDocument();
  });

  it('renders default ProtectedRoute component correctly', async () => {
    const mockFetchUser = vi.fn().mockResolvedValue(mockUser);

    render(
      <DealsPage
        fetchUser={mockFetchUser}
        initialFunnel={mockFunnelSummary}
        initialDeals={mockDeals}
        autoFetch={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('deals-page-title')).toBeInTheDocument();
    });
  });
});
