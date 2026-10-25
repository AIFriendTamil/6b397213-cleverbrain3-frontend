import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContractsPage from '../src/app/contracts/page';
import { CurrentUserResponse } from '../src/services/auth';
import { ContractDetail } from '../src/services/clm_client';
import * as clmClientModule from '../src/services/clm_client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/contracts',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockUser: CurrentUserResponse = {
  user_id: 'usr-contracts-123',
  email: 'legal.officer@example.com',
  full_name: 'Legal Counsel',
  tenant_id: 'tnt-legal-999',
};

const sampleContracts: ContractDetail[] = [
  {
    id: 'cnt-001',
    contract_number: 'CNT-2026-001',
    title: 'Master Cloud Services Agreement',
    counterparty: 'Acme Cloud Solutions',
    status: 'ACTIVE',
    effective_on: '2026-01-01',
    expires_on: '2026-12-31',
    auto_renew: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    clauses: [
      {
        id: 'cls-1',
        contract_id: 'cnt-001',
        title: 'Data Privacy & Protection',
        clause_type: 'CONFIDENTIALITY',
        content: 'All customer data shall be encrypted in transit and at rest using AES-256.',
      },
      {
        id: 'cls-2',
        contract_id: 'cnt-001',
        title: 'Custom Support Tier Term',
        clause_type: 'SPECIAL_TERM',
        content: 'Dedicated technical account manager provided 24/7.',
      },
    ],
    sla_commitments: [
      {
        id: 'sla-1',
        contract_id: 'cnt-001',
        metric_name: 'Platform Uptime SLA',
        target_value: '99.95%',
        penalty_terms: '10% service credit per 0.1% downtime',
      },
    ],
  },
  {
    id: 'cnt-002',
    contract_number: 'CNT-2026-002',
    title: 'Software Development Consulting MSA',
    counterparty: 'Beta Tech Global',
    status: 'DRAFT',
    effective_on: '2026-02-01',
    expires_on: '2026-08-01',
    auto_renew: false,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    clauses: [],
    sla_commitments: [],
  },
];

describe('ContractsPage Route Component', () => {
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

    render(<ContractsPage fetchUser={mockFetchUser} autoFetch={false} initialContracts={sampleContracts} />);

    expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading session...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('contracts-page')).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users to /login when fetchUser rejects', async () => {
    const mockFetchUser = vi.fn().mockRejectedValue(new Error('Unauthorized'));

    render(<ContractsPage fetchUser={mockFetchUser} autoFetch={false} />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders repository header, title, description, and link to e-signature hub when authenticated', async () => {
    const mockFetchUser = vi.fn().mockResolvedValue(mockUser);

    render(
      <ContractsPage
        fetchUser={mockFetchUser}
        autoFetch={false}
        initialContracts={sampleContracts}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('contracts-page')).toBeInTheDocument();
    });

    // Page header elements
    expect(screen.getByTestId('contracts-header')).toBeInTheDocument();
    expect(screen.getByTestId('contracts-eyebrow')).toHaveTextContent(
      'Contract Lifecycle Management • Repository'
    );
    expect(screen.getByTestId('contracts-title')).toHaveTextContent('Contract Repository');
    expect(screen.getByTestId('contracts-description')).toHaveTextContent(
      'Search and filter active legal agreements'
    );

    // E-signature hub quick action link
    const esignLink = screen.getByTestId('esignature-hub-link');
    expect(esignLink).toBeInTheDocument();
    expect(esignLink).toHaveAttribute('href', '/contracts/esignature');

    // Contract list container
    expect(screen.getByTestId('contracts-list-section')).toBeInTheDocument();
    expect(screen.getByTestId('contract-list')).toBeInTheDocument();
    expect(screen.getByText('Master Cloud Services Agreement')).toBeInTheDocument();
    expect(screen.getByText('Software Development Consulting MSA')).toBeInTheDocument();
  });

  it('renders directly when explicit user prop is passed', () => {
    render(
      <ContractsPage
        user={mockUser}
        autoFetch={false}
        initialContracts={sampleContracts}
      />
    );

    expect(screen.getByTestId('contracts-page')).toBeInTheDocument();
    expect(screen.getByTestId('contracts-title')).toHaveTextContent('Contract Repository');
    expect(screen.getByText('Acme Cloud Solutions')).toBeInTheDocument();
  });

  it('passes initial filters down to ContractList component', () => {
    render(
      <ContractsPage
        user={mockUser}
        autoFetch={false}
        initialContracts={sampleContracts}
        initialStatus="ACTIVE"
        initialKeyword="Master"
      />
    );

    expect(screen.getByTestId('contracts-page')).toBeInTheDocument();
    expect(screen.getByText('Master Cloud Services Agreement')).toBeInTheDocument();
    expect(screen.queryByText('Software Development Consulting MSA')).not.toBeInTheDocument();
  });

  it('handles user logout action via NavMenu', async () => {
    const mockOnLogout = vi.fn().mockResolvedValue(undefined);

    render(
      <ContractsPage
        user={mockUser}
        onLogout={mockOnLogout}
        autoFetch={false}
        initialContracts={sampleContracts}
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

  it('triggers searchContracts API call when autoFetch is enabled and filters are adjusted', async () => {
    const mockSearchContracts = vi
      .spyOn(clmClientModule, 'searchContracts')
      .mockResolvedValue(sampleContracts);

    render(
      <ContractsPage
        user={mockUser}
        autoFetch={true}
      />
    );

    await waitFor(() => {
      expect(mockSearchContracts).toHaveBeenCalled();
    });

    // Change status filter
    const statusSelect = screen.getByTestId('status-filter-select');
    fireEvent.change(statusSelect, { target: { value: 'ACTIVE' } });

    await waitFor(() => {
      expect(mockSearchContracts).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ACTIVE',
        })
      );
    });
  });
});
