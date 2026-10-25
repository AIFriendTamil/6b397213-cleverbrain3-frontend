import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ESignaturePage, { ESignaturePageContent } from '../src/app/contracts/esignature/page';
import { CurrentUserResponse } from '../src/services/auth';
import { ESignatureRequest } from '../src/services/clm_client';
import * as clmClientModule from '../src/services/clm_client';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/contracts/esignature',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockUser: CurrentUserResponse = {
  user_id: 'usr-legal-456',
  email: 'compliance.officer@example.com',
  full_name: 'Compliance Officer',
  tenant_id: 'tnt-legal-999',
};

const sampleRequests: ESignatureRequest[] = [
  {
    id: 'esign-101',
    contract_id: 'cnt-001',
    provider_ref_id: 'docusign-req-101',
    execution_status: 'PENDING',
    recipient_name: 'David Vance',
    recipient_email: 'david.vance@acme.com',
    status_updated_at: '2026-03-01T10:00:00Z',
    created_at: '2026-03-01T09:00:00Z',
  },
  {
    id: 'esign-102',
    contract_id: 'cnt-002',
    provider_ref_id: 'docusign-req-102',
    execution_status: 'SIGNED',
    recipient_name: 'Elena Rostova',
    recipient_email: 'elena.rostova@globex.org',
    status_updated_at: '2026-03-02T14:20:00Z',
    created_at: '2026-03-01T11:00:00Z',
  },
];

describe('ESignaturePage Route Component', () => {
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
      <ESignaturePage
        fetchUser={mockFetchUser}
        autoFetch={false}
        initialRequests={sampleRequests}
      />
    );

    expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading session...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('esignature-page')).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users to /login when fetchUser rejects', async () => {
    const mockFetchUser = vi.fn().mockRejectedValue(new Error('Unauthorized'));

    render(<ESignaturePage fetchUser={mockFetchUser} autoFetch={false} />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders header, title, eyebrow, description, navigation links, and ESignatureHub when user is provided', () => {
    render(
      <ESignaturePage
        user={mockUser}
        autoFetch={false}
        initialRequests={sampleRequests}
      />
    );

    expect(screen.getByTestId('esignature-page')).toBeInTheDocument();
    expect(screen.getByTestId('esignature-header')).toBeInTheDocument();
    expect(screen.getByTestId('esignature-eyebrow')).toHaveTextContent(
      'Contract Lifecycle Management • E-Signature Tracking Hub'
    );
    expect(screen.getByTestId('esignature-title')).toHaveTextContent('E-Signature Tracking Hub');
    expect(screen.getByTestId('esignature-description')).toHaveTextContent(
      'Monitor pending agreement executions'
    );

    // Link back to Contract Repository
    const backLink = screen.getByTestId('back-to-contracts-link');
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/contracts');

    // Hub component rendering
    expect(screen.getByTestId('esignature-hub-section')).toBeInTheDocument();
    expect(screen.getByTestId('stat-total-requests')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-pending-requests')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-signed-requests')).toHaveTextContent('1');
  });

  it('displays scoped contract badge when contractId prop is provided and allows clearing it', () => {
    render(
      <ESignaturePage
        user={mockUser}
        contractId="cnt-001"
        autoFetch={false}
        initialRequests={sampleRequests}
      />
    );

    expect(screen.getByTestId('contract-scope-badge')).toHaveTextContent('Scoped to Contract ID: cnt-001');

    const clearBtn = screen.getByTestId('clear-contract-scope-button');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    expect(screen.queryByTestId('contract-scope-badge')).not.toBeInTheDocument();
  });

  it('passes autoFetch, contractId, and callback props through to ESignatureHub correctly', async () => {
    const listRequestsSpy = vi
      .spyOn(clmClientModule, 'listESignatureRequests')
      .mockResolvedValueOnce(sampleRequests);

    render(
      <ESignaturePageContent
        user={mockUser}
        contractId="cnt-001"
        autoFetch={true}
        roles="LEGAL_ADMIN"
      />
    );

    await waitFor(() => {
      expect(listRequestsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          contract_id: 'cnt-001',
          roles: 'LEGAL_ADMIN',
        })
      );
    });
  });
});
