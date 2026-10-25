import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FinancialHubPage, { FinancialHubPageContent } from '../src/app/financial-hub/page';
import { CurrentUserResponse } from '../src/services/auth';
import {
  ArAgingResponse,
  ArrTrendDataPoint,
  Quote,
  Invoice,
  getArAging,
  getArrTrends,
  getQuotes,
  getInvoices,
} from '../src/services/financialApi';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/financial-hub',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock financial API service
vi.mock('../src/services/financialApi', async () => {
  const actual = await vi.importActual<typeof import('../src/services/financialApi')>('../src/services/financialApi');
  return {
    ...actual,
    getArAging: vi.fn(),
    getArrTrends: vi.fn(),
    getQuotes: vi.fn(),
    getInvoices: vi.fn(),
  };
});

const mockUser: CurrentUserResponse = {
  user_id: 'usr-fin-lead-01',
  email: 'cfo@example.com',
  full_name: 'Chief Financial Officer',
  tenant_id: 'tnt-corp-101',
};

const mockArAging: ArAgingResponse = {
  account_id: 'acc-acme-corp',
  current_balance: 100000,
  bucket_30_balance: 30000,
  bucket_60_balance: 15000,
  bucket_90_plus_balance: 5000,
  total_outstanding: 150000,
  as_of_timestamp: '2026-10-24T12:00:00Z',
};

const mockArrTrends: ArrTrendDataPoint[] = [
  {
    id: 'arr-1',
    account_id: 'acc-acme-corp',
    metric_period: '2025-Q4',
    arr_value: 1200000,
    currency: 'USD',
    original_currency: 'USD',
    recorded_at: '2025-12-31T23:59:59Z',
  },
  {
    id: 'arr-2',
    account_id: 'acc-acme-corp',
    metric_period: '2026-Q1',
    arr_value: 1350000,
    currency: 'USD',
    original_currency: 'USD',
    recorded_at: '2026-03-31T23:59:59Z',
  },
];

const mockQuotes: Quote[] = [
  {
    id: 'q-101',
    account_id: 'acc-acme-corp',
    title: 'Enterprise License Renewal',
    status: 'PENDING_APPROVAL',
    total_amount: 145000,
    created_at: '2026-10-22T09:30:00Z',
    updated_at: '2026-10-22T10:15:00Z',
    approval_steps: [
      {
        id: 'step-1',
        quote_id: 'q-101',
        approver_id: 'mgr-finance-01',
        step_number: 1,
        status: 'PENDING',
        comment: null,
        decided_at: null,
        created_at: '2026-10-22T09:30:00Z',
        updated_at: '2026-10-22T09:30:00Z',
      },
    ],
    approvals: [],
  },
];

const mockInvoices: Invoice[] = [
  {
    id: 'inv-101',
    account_id: 'acc-acme-corp',
    invoice_number: 'INV-2026-001',
    issue_date: '2026-09-01',
    due_date: '2026-10-01',
    amount: 50000,
    payment_status: 'OVERDUE',
    created_at: '2026-09-01T08:00:00Z',
  },
];

describe('Financial Operations Central Hub Page Route Component (T026)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getArAging).mockResolvedValue(mockArAging);
    vi.mocked(getArrTrends).mockResolvedValue(mockArrTrends);
    vi.mocked(getQuotes).mockResolvedValue(mockQuotes);
    vi.mocked(getInvoices).mockResolvedValue(mockInvoices);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders session loading state initially when session is resolving via ProtectedRoute', async () => {
    const mockFetchUser = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mockUser), 50)
        )
    );

    render(
      <FinancialHubPage
        fetchUser={mockFetchUser}
        autoFetch={false}
        initialArAging={mockArAging}
        initialArrTrends={mockArrTrends}
        initialQuotes={mockQuotes}
        initialInvoices={mockInvoices}
      />
    );

    expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading session...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('financial-hub-page')).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users to /login when fetchUser rejects', async () => {
    const mockFetchUser = vi.fn().mockRejectedValue(new Error('Unauthorized'));

    render(<FinancialHubPage fetchUser={mockFetchUser} autoFetch={false} />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders page header, eyebrow, title, description, and navigation links when authenticated', async () => {
    const mockFetchUser = vi.fn().mockResolvedValue(mockUser);

    render(
      <FinancialHubPage
        fetchUser={mockFetchUser}
        autoFetch={false}
        initialArAging={mockArAging}
        initialArrTrends={mockArrTrends}
        initialQuotes={mockQuotes}
        initialInvoices={mockInvoices}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('financial-hub-page')).toBeInTheDocument();
    });

    expect(screen.getByTestId('financial-hub-header')).toBeInTheDocument();
    expect(screen.getByTestId('financial-hub-eyebrow')).toHaveTextContent(
      'Financial Operations & Transparency'
    );
    expect(screen.getByTestId('financial-hub-title')).toHaveTextContent(
      'Financial Operations Central Hub'
    );
    expect(screen.getByTestId('financial-hub-description')).toHaveTextContent(
      'Consolidated commercial insights'
    );

    // Links to notification settings & notification hub
    const settingsLink = screen.getByTestId('notification-settings-link');
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink).toHaveAttribute('href', '/settings/notifications');

    const hubLink = screen.getByTestId('notification-hub-link');
    expect(hubLink).toBeInTheDocument();
    expect(hubLink).toHaveAttribute('href', '/notifications');
  });

  it('renders directly when explicit user prop is passed', () => {
    render(
      <FinancialHubPage
        user={mockUser}
        autoFetch={false}
        initialArAging={mockArAging}
        initialArrTrends={mockArrTrends}
        initialQuotes={mockQuotes}
        initialInvoices={mockInvoices}
      />
    );

    expect(screen.getByTestId('financial-hub-page')).toBeInTheDocument();
    expect(screen.getByTestId('financial-hub-title')).toHaveTextContent(
      'Financial Operations Central Hub'
    );
  });

  it('automatically fetches all financial datasets on mount when autoFetch is true', async () => {
    render(
      <FinancialHubPage
        user={mockUser}
        autoFetch={true}
      />
    );

    await waitFor(() => {
      expect(getArAging).toHaveBeenCalledWith({ account_id: undefined });
      expect(getArrTrends).toHaveBeenCalledWith({
        account_id: undefined,
        period_range: 'ALL',
        target_currency: 'USD',
      });
      expect(getQuotes).toHaveBeenCalledWith({ account_id: undefined });
      expect(getInvoices).toHaveBeenCalledWith({ account_id: undefined });
    });
  });

  it('renders summary KPI overview cards accurately', () => {
    render(
      <FinancialHubPageContent
        user={mockUser}
        autoFetch={false}
        initialArAging={mockArAging}
        initialArrTrends={mockArrTrends}
        initialQuotes={mockQuotes}
        initialInvoices={mockInvoices}
      />
    );

    expect(screen.getByTestId('financial-hub-kpis')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-outstanding-ar')).toHaveTextContent('$150,000');
    expect(screen.getByTestId('kpi-current-arr')).toHaveTextContent('$1,350,000');
    expect(screen.getByTestId('kpi-pending-quotes')).toHaveTextContent('1 Quote');
    expect(screen.getByTestId('kpi-overdue-invoices')).toHaveTextContent('1 Invoice');
  });

  it('allows switching between section tabs (All, AR Aging, ARR Trends, Quotes, Invoices)', () => {
    render(
      <FinancialHubPageContent
        user={mockUser}
        autoFetch={false}
        initialArAging={mockArAging}
        initialArrTrends={mockArrTrends}
        initialQuotes={mockQuotes}
        initialInvoices={mockInvoices}
      />
    );

    // Initial 'ALL' tab renders all sections
    expect(screen.getByTestId('ar-aging-section')).toBeInTheDocument();
    expect(screen.getByTestId('arr-trend-section')).toBeInTheDocument();
    expect(screen.getByTestId('quote-approval-section')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-list-section')).toBeInTheDocument();

    // Switch to AR Aging tab
    fireEvent.click(screen.getByTestId('financial-tab-ar_aging'));
    expect(screen.getByTestId('ar-aging-section')).toBeInTheDocument();
    expect(screen.queryByTestId('arr-trend-section')).not.toBeInTheDocument();

    // Switch to Quotes tab
    fireEvent.click(screen.getByTestId('financial-tab-quotes'));
    expect(screen.getByTestId('quote-approval-section')).toBeInTheDocument();
    expect(screen.queryByTestId('ar-aging-section')).not.toBeInTheDocument();
  });

  it('triggers global refresh when refresh button is clicked', async () => {
    const mockFetchArAging = vi.fn().mockResolvedValue(mockArAging);
    const mockFetchArrTrends = vi.fn().mockResolvedValue(mockArrTrends);
    const mockFetchQuotes = vi.fn().mockResolvedValue(mockQuotes);
    const mockFetchInvoices = vi.fn().mockResolvedValue(mockInvoices);

    render(
      <FinancialHubPageContent
        user={mockUser}
        autoFetch={false}
        initialArAging={mockArAging}
        initialArrTrends={mockArrTrends}
        initialQuotes={mockQuotes}
        initialInvoices={mockInvoices}
        fetchArAging={mockFetchArAging}
        fetchArrTrends={mockFetchArrTrends}
        fetchQuotes={mockFetchQuotes}
        fetchInvoices={mockFetchInvoices}
      />
    );

    const refreshBtn = screen.getByTestId('refresh-all-btn');
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(mockFetchArAging).toHaveBeenCalledWith({ account_id: undefined });
      expect(mockFetchArrTrends).toHaveBeenCalledWith({
        account_id: undefined,
        period_range: 'ALL',
        target_currency: 'USD',
      });
      expect(mockFetchQuotes).toHaveBeenCalledWith({ account_id: undefined });
      expect(mockFetchInvoices).toHaveBeenCalledWith({ account_id: undefined });
    });
  });

  it('updates data when account filter input changes', async () => {
    render(
      <FinancialHubPageContent
        user={mockUser}
        autoFetch={true}
      />
    );

    const accountInput = screen.getByTestId('account-id-input');
    fireEvent.change(accountInput, { target: { value: 'acc-acme-corp' } });

    await waitFor(() => {
      expect(getArAging).toHaveBeenCalledWith({ account_id: 'acc-acme-corp' });
    });
  });

  it('handles user logout action via NavMenu', async () => {
    const mockOnLogout = vi.fn().mockResolvedValue(undefined);

    render(
      <FinancialHubPage
        user={mockUser}
        onLogout={mockOnLogout}
        autoFetch={false}
        initialArAging={mockArAging}
        initialArrTrends={mockArrTrends}
        initialQuotes={mockQuotes}
        initialInvoices={mockInvoices}
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