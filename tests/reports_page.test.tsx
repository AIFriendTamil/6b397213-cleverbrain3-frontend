import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportsPage, { ReportsPageContent } from '../src/app/reports/page';
import { CurrentUserResponse } from '../src/services/auth';
import { PerformanceReport, getPerformanceReport } from '../src/services/tickets';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/reports',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock tickets API service
vi.mock('../src/services/tickets', async () => {
  const actual = await vi.importActual<typeof import('../src/services/tickets')>('../src/services/tickets');
  return {
    ...actual,
    getPerformanceReport: vi.fn(),
  };
});

const mockUser: CurrentUserResponse = {
  user_id: 'usr-support-lead-01',
  email: 'manager@example.com',
  full_name: 'Support Manager',
  tenant_id: 'tnt-org-101',
};

const sampleReport: PerformanceReport = {
  start_time: '2026-01-01T00:00:00Z',
  end_time: '2026-12-31T23:59:59Z',
  organization_id: 'tnt-org-101',
  total_tickets: 100,
  open_tickets: 15,
  resolved_tickets: 85,
  mttr: {
    total_resolved_tickets: 85,
    average_seconds: 14400,
    average_hours: 4.0,
    formatted_mttr: '4h 0m',
  },
  sla_compliance: {
    total_tickets: 100,
    compliant_tickets: 92,
    breached_tickets: 8,
    compliance_percentage: 92.0,
  },
  csat: {
    total_responses: 50,
    average_rating: 4.6,
    satisfied_count: 45,
    satisfaction_percentage: 90.0,
    rating_distribution: {
      5: 35,
      4: 10,
      3: 3,
      2: 1,
      1: 1,
    },
  },
  severity_breakdown: {
    P1: {
      total_tickets: 20,
      mttr: {
        total_resolved_tickets: 20,
        average_seconds: 7200,
        average_hours: 2.0,
        formatted_mttr: '2h 0m',
      },
      sla_compliance: {
        total_tickets: 20,
        compliant_tickets: 19,
        breached_tickets: 1,
        compliance_percentage: 95.0,
      },
      csat: {
        total_responses: 15,
        average_rating: 4.8,
        satisfied_count: 14,
        satisfaction_percentage: 93.3,
        rating_distribution: { 5: 12, 4: 2, 3: 1 },
      },
    },
    P2: {
      total_tickets: 30,
      mttr: {
        total_resolved_tickets: 28,
        average_seconds: 18000,
        average_hours: 5.0,
        formatted_mttr: '5h 0m',
      },
      sla_compliance: {
        total_tickets: 30,
        compliant_tickets: 27,
        breached_tickets: 3,
        compliance_percentage: 90.0,
      },
      csat: {
        total_responses: 20,
        average_rating: 4.5,
        satisfied_count: 18,
        satisfaction_percentage: 90.0,
        rating_distribution: { 5: 12, 4: 6, 2: 2 },
      },
    },
    P3: {
      total_tickets: 50,
      mttr: {
        total_resolved_tickets: 37,
        average_seconds: 28800,
        average_hours: 8.0,
        formatted_mttr: '8h 0m',
      },
      sla_compliance: {
        total_tickets: 50,
        compliant_tickets: 46,
        breached_tickets: 4,
        compliance_percentage: 92.0,
      },
      csat: {
        total_responses: 15,
        average_rating: 4.4,
        satisfied_count: 13,
        satisfaction_percentage: 86.7,
        rating_distribution: { 5: 8, 4: 5, 3: 1, 1: 1 },
      },
    },
  },
};

const emptyReport: PerformanceReport = {
  total_tickets: 0,
  open_tickets: 0,
  resolved_tickets: 0,
  mttr: {
    total_resolved_tickets: 0,
    average_seconds: 0,
    average_hours: 0,
    formatted_mttr: '0m',
  },
  sla_compliance: {
    total_tickets: 0,
    compliant_tickets: 0,
    breached_tickets: 0,
    compliance_percentage: 100.0,
  },
  csat: {
    total_responses: 0,
    average_rating: 0,
    satisfied_count: 0,
    satisfaction_percentage: 0,
    rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  },
  severity_breakdown: {},
};

describe('Operational Performance Reports Page Component (T020)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPerformanceReport).mockResolvedValue(sampleReport);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders dashboard header, nav menu, and default KPI metric cards when user and initial report are provided', async () => {
    render(
      <ReportsPageContent
        user={mockUser}
        initialReport={sampleReport}
        autoFetch={false}
      />
    );

    expect(screen.getByTestId('reports-header-title')).toHaveTextContent(
      'Operational Performance Dashboard'
    );
    expect(screen.getByTestId('kpi-value-total-tickets')).toHaveTextContent('100');
    expect(screen.getByTestId('kpi-value-mttr')).toHaveTextContent('4h 0m');
    expect(screen.getByTestId('kpi-value-sla')).toHaveTextContent('92.0%');
    expect(screen.getByTestId('kpi-value-csat')).toHaveTextContent('4.60 / 5.0');
  });

  it('automatically fetches performance report metrics on mount when autoFetch is true and initialReport is null', async () => {
    render(
      <ReportsPageContent
        user={mockUser}
        autoFetch={true}
      />
    );

    await waitFor(() => {
      expect(getPerformanceReport).toHaveBeenCalledWith({
        start_time: undefined,
        end_time: undefined,
        organization_id: undefined,
        severity: undefined,
      });
    });

    expect(await screen.findByTestId('kpi-value-total-tickets')).toHaveTextContent('100');
  });

  it('renders error state when fetching performance report fails and allows retrying', async () => {
    vi.mocked(getPerformanceReport).mockRejectedValueOnce(
      new Error('Failed to retrieve performance metrics from backend API')
    );

    render(
      <ReportsPageContent
        user={mockUser}
        autoFetch={true}
      />
    );

    expect(await screen.findByTestId('reports-error')).toHaveTextContent(
      'Failed to retrieve performance metrics from backend API'
    );

    // Mock successful retry
    vi.mocked(getPerformanceReport).mockResolvedValueOnce(sampleReport);
    const retryBtn = screen.getByTestId('retry-report-button');
    fireEvent.click(retryBtn);

    expect(await screen.findByTestId('kpi-value-total-tickets')).toHaveTextContent('100');
  });

  it('renders empty state message when report total tickets is 0', async () => {
    render(
      <ReportsPageContent
        user={mockUser}
        initialReport={emptyReport}
        autoFetch={false}
      />
    );

    expect(screen.getByTestId('reports-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No Ticket Metrics Available')).toBeInTheDocument();
  });

  it('applies query filters when filter form is submitted', async () => {
    const customFetchReport = vi.fn().mockResolvedValue(sampleReport);

    render(
      <ReportsPageContent
        user={mockUser}
        initialReport={sampleReport}
        autoFetch={false}
        fetchReport={customFetchReport}
      />
    );

    const startTimeInput = screen.getByTestId('start-time-input');
    const endTimeInput = screen.getByTestId('end-time-input');
    const orgIdInput = screen.getByTestId('org-id-input');
    const severitySelect = screen.getByTestId('severity-select');
    const applyBtn = screen.getByTestId('apply-filters-button');

    fireEvent.change(startTimeInput, { target: { value: '2026-06-01T00:00:00Z' } });
    fireEvent.change(endTimeInput, { target: { value: '2026-06-30T23:59:59Z' } });
    fireEvent.change(orgIdInput, { target: { value: 'tnt-org-101' } });
    fireEvent.change(severitySelect, { target: { value: 'P1' } });

    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(customFetchReport).toHaveBeenCalledWith({
        start_time: '2026-06-01T00:00:00Z',
        end_time: '2026-06-30T23:59:59Z',
        organization_id: 'tnt-org-101',
        severity: 'P1',
      });
    });
  });

  it('resets query filters when reset button is clicked', async () => {
    const customFetchReport = vi.fn().mockResolvedValue(sampleReport);

    render(
      <ReportsPageContent
        user={mockUser}
        initialReport={sampleReport}
        initialStartTime="2026-01-01T00:00:00Z"
        initialSeverity="P2"
        autoFetch={false}
        fetchReport={customFetchReport}
      />
    );

    const clearBtn = screen.getByTestId('clear-filters-button');
    fireEvent.click(clearBtn);

    expect(screen.getByTestId('start-time-input')).toHaveValue('');
    expect(screen.getByTestId('severity-select')).toHaveValue('');

    await waitFor(() => {
      expect(customFetchReport).toHaveBeenCalledWith({});
    });
  });

  it('renders CSAT rating distribution section with counts and percentages', async () => {
    render(
      <ReportsPageContent
        user={mockUser}
        initialReport={sampleReport}
        autoFetch={false}
      />
    );

    expect(screen.getByTestId('csat-breakdown-section')).toBeInTheDocument();
    expect(screen.getByTestId('csat-dist-row-5')).toHaveTextContent('5 Stars');
    expect(screen.getByTestId('csat-dist-count-5')).toHaveTextContent('35 (70.0%)');
    expect(screen.getByTestId('csat-dist-count-1')).toHaveTextContent('1 (2.0%)');
  });

  it('renders severity performance breakdown table with P1, P2, and P3 metrics', async () => {
    render(
      <ReportsPageContent
        user={mockUser}
        initialReport={sampleReport}
        autoFetch={false}
      />
    );

    expect(screen.getByTestId('severity-table-section')).toBeInTheDocument();
    expect(screen.getByTestId('sev-table-row-P1')).toHaveTextContent('P1');
    expect(screen.getByTestId('sev-table-row-P1')).toHaveTextContent('2h 0m');
    expect(screen.getByTestId('sev-table-row-P1')).toHaveTextContent('95.0%');

    expect(screen.getByTestId('sev-table-row-P2')).toHaveTextContent('P2');
    expect(screen.getByTestId('sev-table-row-P2')).toHaveTextContent('5h 0m');

    expect(screen.getByTestId('sev-table-row-P3')).toHaveTextContent('P3');
    expect(screen.getByTestId('sev-table-row-P3')).toHaveTextContent('8h 0m');
  });

  it('renders full ProtectedRoute wrapped ReportsPage component', async () => {
    const fetchUser = vi.fn().mockResolvedValue(mockUser);

    render(
      <ReportsPage
        fetchUser={fetchUser}
        user={mockUser}
        initialReport={sampleReport}
        autoFetch={false}
      />
    );

    expect(await screen.findByTestId('reports-page')).toBeInTheDocument();
  });
});
