import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContractDetailPage, { ContractDetailContent } from '../src/app/contracts/[id]/page';
import { CurrentUserResponse } from '../src/services/auth';
import { ContractDetail as IContractDetail, AmendmentAuditLog, DocumentVersion } from '../src/services/clm_client';
import * as clmClientModule from '../src/services/clm_client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/contracts/cnt-100',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockUser: CurrentUserResponse = {
  user_id: 'usr-legal-lead',
  email: 'counsel@example.com',
  full_name: 'Lead Counsel',
  tenant_id: 'tnt-legal-100',
};

const sampleContract: IContractDetail = {
  id: 'cnt-100',
  contract_number: 'CNT-2026-100',
  title: 'Enterprise Enterprise Cloud & AI Services Agreement',
  counterparty: 'Acme Mega Corp',
  status: 'ACTIVE',
  effective_on: '2026-01-01',
  expires_on: '2026-12-31',
  auto_renew: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
  clauses: [
    {
      id: 'cls-101',
      contract_id: 'cnt-100',
      title: 'Mutual Non-Disclosure & Confidentiality',
      clause_type: 'CONFIDENTIALITY',
      content: 'Both parties agree to hold non-public technical data in strict confidence for 5 years.',
    },
    {
      id: 'cls-102',
      contract_id: 'cnt-100',
      title: 'Custom VIP SLA & Extended Warranty Term',
      clause_type: 'SPECIAL_TERM',
      content: 'Dedicated designated enterprise engineer assigned with 15-minute response time SLA.',
    },
  ],
  sla_commitments: [
    {
      id: 'sla-101',
      contract_id: 'cnt-100',
      metric_name: 'Monthly Uptime Guarantee',
      target_value: '99.99%',
      penalty_terms: '15% service credit per 0.05% downtime below target',
    },
  ],
};

const sampleAmendments: AmendmentAuditLog[] = [
  {
    id: 'amd-001',
    contract_id: 'cnt-100',
    amendment_number: 1,
    summary: 'Extended contract term by 12 months with updated annual inflation pricing index adjustment.',
    user_id: 'usr-legal-lead',
    timestamp: '2026-02-01T10:00:00Z',
    integrity_hash: 'hmac_sha256_001_8a7f9c2d4e6b1a3f5c7e9d2b4f6a8c0e1d3f5b7a9c2d4e6b1a3f5c7e9d2b4f6a',
  },
];

const sampleDocuments: DocumentVersion[] = [
  {
    id: 'doc-v1',
    contract_id: 'cnt-100',
    version_number: 1,
    file_path: '/storage/contracts/cnt-100/v1_master_agreement.pdf',
    file_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    file_size_bytes: 1048576,
    uploaded_by_user_id: 'usr-legal-lead',
    uploaded_at: '2026-01-15T09:00:00Z',
  },
];

describe('ContractDetailPage Route Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders session resolving loading state initially when session is loading', async () => {
    const mockFetchUser = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mockUser), 50)
        )
    );

    render(<ContractDetailPage fetchUser={mockFetchUser} params={{ id: 'cnt-100' }} autoFetch={false} />);

    expect(screen.getByTestId('auth-loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Verifying user credentials and permissions...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('contract-detail-page')).toBeInTheDocument();
    });
  });

  it('renders page header, title, counterparty, contract number, and status badge when initialUser and initialContract are supplied', () => {
    render(
      <ContractDetailPage
        user={mockUser}
        params={{ id: 'cnt-100' }}
        initialContract={sampleContract}
        initialAmendments={sampleAmendments}
        initialDocuments={sampleDocuments}
        autoFetch={false}
      />
    );

    expect(screen.getByTestId('contract-detail-page')).toBeInTheDocument();
    expect(screen.getByTestId('contract-detail-header')).toBeInTheDocument();
    expect(screen.getByTestId('contract-detail-title')).toHaveTextContent('Enterprise Enterprise Cloud & AI Services Agreement');
    expect(screen.getByTestId('contract-detail-number')).toHaveTextContent('CNT-2026-100');
    expect(screen.getByTestId('contract-detail-counterparty')).toHaveTextContent('Acme Mega Corp');
    expect(screen.getByTestId('contract-detail-status')).toHaveTextContent('Active');

    expect(screen.getByTestId('back-to-contracts-link')).toHaveAttribute('href', '/contracts');
    expect(screen.getByTestId('esignature-hub-link')).toHaveAttribute('href', '/contracts/esignature');
  });

  it('renders tab navigation bar with 4 tabs and defaults to Overview & Terms tab', () => {
    render(
      <ContractDetailPage
        user={mockUser}
        params={{ id: 'cnt-100' }}
        initialContract={sampleContract}
        initialAmendments={sampleAmendments}
        initialDocuments={sampleDocuments}
        autoFetch={false}
      />
    );

    const tabsContainer = screen.getByTestId('contract-detail-tabs');
    expect(tabsContainer).toBeInTheDocument();

    expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
    expect(screen.getByTestId('tab-amendments')).toBeInTheDocument();
    expect(screen.getByTestId('tab-documents')).toBeInTheDocument();
    expect(screen.getByTestId('tab-all')).toBeInTheDocument();

    // Default tab is 'overview'
    expect(screen.getByTestId('overview-section')).toBeInTheDocument();
    expect(screen.queryByTestId('amendments-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('documents-section')).not.toBeInTheDocument();

    // Overview section contains clause highlights and SLA commitments
    expect(screen.getByTestId('clause-highlights-title')).toHaveTextContent('Key Clause Highlights & Special Terms');
    expect(screen.getByTestId('sla-commitments-title')).toHaveTextContent('SLA Commitments & Performance Terms');
  });

  it('switches tabs smoothly when clicking on tab buttons', () => {
    render(
      <ContractDetailPage
        user={mockUser}
        params={{ id: 'cnt-100' }}
        initialContract={sampleContract}
        initialAmendments={sampleAmendments}
        initialDocuments={sampleDocuments}
        autoFetch={false}
      />
    );

    // Switch to Amendment Audit Trail tab
    fireEvent.click(screen.getByTestId('tab-amendments'));
    expect(screen.queryByTestId('overview-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('amendments-section')).toBeInTheDocument();
    expect(screen.getByTestId('amendment-timeline-title')).toHaveTextContent('Amendment Audit Trail');

    // Switch to Document Repository tab
    fireEvent.click(screen.getByTestId('tab-documents'));
    expect(screen.queryByTestId('amendments-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('documents-section')).toBeInTheDocument();
    expect(screen.getByTestId('document-repository-title')).toHaveTextContent('Document Repository');

    // Switch to All Sections tab
    fireEvent.click(screen.getByTestId('tab-all'));
    expect(screen.getByTestId('overview-section')).toBeInTheDocument();
    expect(screen.getByTestId('amendments-section')).toBeInTheDocument();
    expect(screen.getByTestId('documents-section')).toBeInTheDocument();
  });

  it('honors initialTab prop when specified as amendments', () => {
    render(
      <ContractDetailPage
        user={mockUser}
        params={{ id: 'cnt-100' }}
        initialContract={sampleContract}
        initialAmendments={sampleAmendments}
        initialDocuments={sampleDocuments}
        initialTab="amendments"
        autoFetch={false}
      />
    );

    expect(screen.queryByTestId('overview-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('amendments-section')).toBeInTheDocument();
    expect(screen.getByTestId('amendment-timeline-title')).toHaveTextContent('Amendment Audit Trail');
  });

  it('resolves contract id from params Promise if params is a Promise', async () => {
    const paramsPromise = Promise.resolve({ id: 'cnt-100' });

    render(
      <ContractDetailPage
        user={mockUser}
        params={paramsPromise}
        initialContract={sampleContract}
        initialAmendments={sampleAmendments}
        initialDocuments={sampleDocuments}
        autoFetch={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('contract-detail-title')).toHaveTextContent('Enterprise Enterprise Cloud & AI Services Agreement');
    });
  });

  it('fetches contract detail from clm_client API when autoFetch is true and initialContract is not passed', async () => {
    vi.spyOn(clmClientModule, 'getContractDetail').mockResolvedValueOnce(sampleContract);

    render(<ContractDetailPage user={mockUser} contractId="cnt-100" autoFetch={true} />);

    await waitFor(() => {
      expect(clmClientModule.getContractDetail).toHaveBeenCalledWith('cnt-100', { roles: undefined });
      expect(screen.getByTestId('contract-detail-title')).toHaveTextContent('Enterprise Enterprise Cloud & AI Services Agreement');
    });
  });
});
