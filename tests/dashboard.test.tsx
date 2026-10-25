import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardPage from '../src/app/dashboard/page';
import { CurrentUserResponse } from '../src/services/auth';
import { DashboardMetricsResponse } from '../src/services/dashboard';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/dashboard',
}));

describe('DashboardPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockUser: CurrentUserResponse = {
    user_id: 'usr-dashboard-123',
    email: 'dashboard.user@example.com',
    full_name: 'Dashboard Tester',
    tenant_id: 'tnt-dashboard-456',
  };

  const mockMetricsResponse: DashboardMetricsResponse = {
    last_updated_at: '2026-10-24T12:00:00Z',
    metrics: [
      {
        domain_name: 'sales',
        display_name: 'Sales Pipeline',
        status: 'active',
        detail_url: '/sales',
        kpis: [
          {
            key: 'pipeline_value',
            label: 'Pipeline Value',
            value: 1250000,
            unit: 'currency',
            trend_direction: 'up',
            trend_percentage: 12.5,
          },
        ],
      },
      {
        domain_name: 'leads',
        display_name: 'Lead Channels',
        status: 'active',
        detail_url: '/leads',
        kpis: [
          {
            key: 'conversion_rate',
            label: 'Conversion Rate',
            value: 18.4,
            unit: 'percentage',
            trend_direction: 'down',
            trend_percentage: 3.2,
          },
        ],
      },
      {
        domain_name: 'support',
        display_name: 'Support Queue',
        status: 'active',
        detail_url: '/support',
        kpis: [
          {
            key: 'open_tickets',
            label: 'Open Tickets',
            value: 15,
            unit: 'tickets',
            trend_direction: 'down',
            trend_percentage: 8.5,
          },
        ],
      },
      {
        domain_name: 'finance',
        display_name: 'Financial Accounts',
        status: 'active',
        detail_url: '/finance',
        kpis: [
          {
            key: 'net_revenue',
            label: 'Net Revenue',
            value: 5400000,
            unit: '$',
            trend_direction: 'up',
            trend_percentage: 15.0,
          },
        ],
      },
    ],
  };

  it('renders loading session indicator initially when unauthenticated state is resolving', async () => {
    const mockFetchUser = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mockUser), 50)
        )
    );

    render(<DashboardPage fetchUser={mockFetchUser} pollingInterval={0} />);

    expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading session...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users to /login when fetchUser rejects', async () => {
    const mockFetchUser = vi.fn().mockRejectedValue(new Error('Unauthorized'));

    render(<DashboardPage fetchUser={mockFetchUser} pollingInterval={0} />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders active user session details and tenant context when authenticated', async () => {
    const mockFetchUser = vi.fn().mockResolvedValue(mockUser);

    render(<DashboardPage fetchUser={mockFetchUser} pollingInterval={0} />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });

    // Header and title
    expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Welcome, Dashboard Tester');
    expect(screen.getByTestId('dashboard-badge')).toHaveTextContent('Portal Hub • Active Session');

    // User session profile card
    expect(screen.getByTestId('user-context-card')).toBeInTheDocument();
    expect(screen.getByTestId('user-full-name')).toHaveTextContent('Dashboard Tester');
    expect(screen.getByTestId('user-email')).toHaveTextContent('dashboard.user@example.com');
    expect(screen.getByTestId('user-id')).toHaveTextContent('usr-dashboard-123');

    // Tenant context card
    expect(screen.getByTestId('tenant-context-card')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-id')).toHaveTextContent('tnt-dashboard-456');
    expect(screen.getByTestId('tenant-isolation-mode')).toHaveTextContent(
      'Strict Server-Side Tenant Isolation'
    );
    expect(screen.getByTestId('session-security-status')).toHaveTextContent(
      'Active & Authenticated Session'
    );

    // Permitted hubs section
    expect(screen.getByTestId('portal-hubs-section')).toBeInTheDocument();
    expect(screen.getByTestId('hub-card-overview')).toBeInTheDocument();
    expect(screen.getByTestId('hub-card-settings')).toBeInTheDocument();
  });

  it('renders directly when explicit user prop is passed', () => {
    render(<DashboardPage user={mockUser} pollingInterval={0} />);

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.getByTestId('user-full-name')).toHaveTextContent('Dashboard Tester');
    expect(screen.getByTestId('tenant-id')).toHaveTextContent('tnt-dashboard-456');
  });

  it('renders NavMenu with active user info and handles logout click', async () => {
    const mockOnLogout = vi.fn().mockResolvedValue(undefined);

    render(<DashboardPage user={mockUser} onLogout={mockOnLogout} pollingInterval={0} />);

    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();
    expect(screen.getByTestId('nav-user-name')).toHaveTextContent('Dashboard Tester');
    expect(screen.getByTestId('nav-tenant-id')).toHaveTextContent('Tenant: tnt-dashboard-456');

    const logoutBtn = screen.getByTestId('nav-logout-btn');
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(mockOnLogout).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders executive dashboard header, controls, ISO timestamp, and metric cards', () => {
    render(
      <DashboardPage
        user={mockUser}
        initialMetrics={mockMetricsResponse}
        pollingInterval={10000}
      />
    );

    expect(screen.getByTestId('executive-dashboard-section')).toBeInTheDocument();
    expect(screen.getByTestId('executive-dashboard-title')).toHaveTextContent(
      'Executive Performance Dashboard'
    );
    expect(screen.getByTestId('baseline-selector')).toBeInTheDocument();
    expect(screen.getByTestId('live-polling-badge')).toHaveTextContent('Live Polling (10s)');

    // ISO timestamp display check [FR-7]
    const timestampElem = screen.getByTestId('last-updated-timestamp');
    expect(timestampElem).toBeInTheDocument();
    expect(timestampElem).toHaveAttribute('data-iso-timestamp', '2026-10-24T12:00:00Z');
    expect(screen.getByTestId('dashboard-last-updated')).toHaveTextContent('2026-10-24T12:00:00Z');

    // KPI cards check [FR-1]
    expect(screen.getByTestId('kpi-card-sales')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-leads')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-support')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-finance')).toBeInTheDocument();
  });

  it('triggers manual refresh and re-fetches metrics on refresh button click', async () => {
    const mockFetchMetrics = vi.fn().mockResolvedValue(mockMetricsResponse);
    const mockTriggerRefresh = vi.fn().mockResolvedValue({ status: 'refresh_initiated', job_id: 'job-123' });

    render(
      <DashboardPage
        user={mockUser}
        initialMetrics={mockMetricsResponse}
        fetchMetrics={mockFetchMetrics}
        triggerRefresh={mockTriggerRefresh}
        pollingInterval={0}
      />
    );

    const refreshBtn = screen.getByTestId('dashboard-refresh-btn');
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(mockTriggerRefresh).toHaveBeenCalledTimes(1);
      expect(mockFetchMetrics).toHaveBeenCalled();
    });
  });

  it('re-fetches metrics when baseline dropdown selection changes', async () => {
    const mockFetchMetrics = vi.fn().mockResolvedValue(mockMetricsResponse);

    render(
      <DashboardPage
        user={mockUser}
        initialMetrics={mockMetricsResponse}
        fetchMetrics={mockFetchMetrics}
        pollingInterval={0}
      />
    );

    const select = screen.getByTestId('baseline-select');
    fireEvent.change(select, { target: { value: 'prior_quarter' } });

    await waitFor(() => {
      expect(mockFetchMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ baseline: 'prior_quarter' })
      );
    });
  });

  it('executes live polling periodically when pollingInterval is provided', async () => {
    vi.useFakeTimers();
    const mockFetchMetrics = vi.fn().mockResolvedValue(mockMetricsResponse);

    render(
      <DashboardPage
        user={mockUser}
        initialMetrics={mockMetricsResponse}
        fetchMetrics={mockFetchMetrics}
        pollingInterval={5000}
      />
    );

    expect(mockFetchMetrics).not.toHaveBeenCalled();

    // Advance fake timers by 5000ms
    vi.advanceTimersByTime(5000);

    expect(mockFetchMetrics).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);

    expect(mockFetchMetrics).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('renders only authorized operational modules and masks unauthorized modules for restricted roles [FR-6]', () => {
    const restrictedMetricsResponse: DashboardMetricsResponse = {
      last_updated_at: '2026-10-24T12:00:00Z',
      metrics: [
        {
          domain_name: 'sales',
          display_name: 'Sales Pipeline',
          status: 'active',
          detail_url: '/sales',
          kpis: [
            {
              key: 'pipeline_value',
              label: 'Pipeline Value',
              value: 1250000,
              unit: 'currency',
              trend_direction: 'up',
              trend_percentage: 12.5,
            },
          ],
        },
      ],
    };

    render(
      <DashboardPage
        user={mockUser}
        initialMetrics={restrictedMetricsResponse}
        roles="sales_rep"
        pollingInterval={0}
      />
    );

    // Authorized module rendered
    expect(screen.getByTestId('kpi-card-sales')).toBeInTheDocument();

    // Unauthorized modules masked/hidden
    expect(screen.queryByTestId('kpi-card-leads')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kpi-card-support')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kpi-card-finance')).not.toBeInTheDocument();

    // Unauthorized masking notice displayed
    expect(screen.getByTestId('unauthorized-modules-masked-msg')).toBeInTheDocument();
    expect(screen.getByTestId('user-role-badge')).toHaveTextContent('sales_rep');
  });

  it('renders permission denied view when user has no authorized operational modules or API returns 403 [FR-6]', async () => {
    const mockFetchMetrics = vi
      .fn()
      .mockRejectedValue(new Error('403 Forbidden: User role has no authorized dashboard domains.'));

    render(
      <DashboardPage
        user={mockUser}
        fetchMetrics={mockFetchMetrics}
        roles="restricted_user"
        pollingInterval={0}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('permission-denied-view')).toBeInTheDocument();
    });

    expect(screen.getByTestId('permission-denied-title')).toHaveTextContent(
      'Access Restricted: Unauthorized Operational Modules'
    );
    expect(screen.getByTestId('permission-denied-message')).toHaveTextContent('403 Forbidden');
    expect(screen.getByTestId('unauthorized-modules-masked-msg')).toBeInTheDocument();
  });

  it('renders permission denied view when metrics array is empty due to role restrictions [FR-6]', () => {
    const emptyMetricsResponse: DashboardMetricsResponse = {
      last_updated_at: '2026-10-24T12:00:00Z',
      metrics: [],
    };

    render(
      <DashboardPage
        user={mockUser}
        initialMetrics={emptyMetricsResponse}
        roles="no_permissions_role"
        pollingInterval={0}
      />
    );

    expect(screen.getByTestId('permission-denied-view')).toBeInTheDocument();
    expect(screen.getByTestId('permission-denied-title')).toHaveTextContent(
      'Access Restricted: Unauthorized Operational Modules'
    );
    expect(screen.getByTestId('unauthorized-modules-masked-msg')).toBeInTheDocument();
  });
});
