import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContractList } from '../src/components/clm/ContractList';
import { ContractDetail } from '../src/services/clm_client';
import * as clmClientModule from '../src/services/clm_client';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

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
    clauses: [
      {
        id: 'cls-3',
        contract_id: 'cnt-002',
        title: 'Termination for Convenience',
        clause_type: 'TERMINATION',
        content: 'Either party may terminate this agreement with 30 days written notice.',
      },
    ],
    sla_commitments: [],
  },
  {
    id: 'cnt-003',
    contract_number: 'CNT-2025-088',
    title: 'Legacy Hosting Maintenance Agreement',
    counterparty: 'Gamma Infrastructure',
    status: 'EXPIRED',
    effective_on: '2025-01-01',
    expires_on: '2025-12-31',
    auto_renew: false,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-12-31T00:00:00Z',
    clauses: [],
    sla_commitments: [],
  },
];

describe('ContractList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders contract repository list with initial contracts [FR-1, FR-7]', () => {
    render(<ContractList initialContracts={sampleContracts} autoFetch={false} />);

    expect(screen.getByTestId('contract-list')).toBeInTheDocument();
    expect(screen.getByText('Contract Repository')).toBeInTheDocument();
    expect(screen.getByTestId('results-count')).toHaveTextContent('Showing 3 agreements');

    // Contract titles
    expect(screen.getByText('Master Cloud Services Agreement')).toBeInTheDocument();
    expect(screen.getByText('Software Development Consulting MSA')).toBeInTheDocument();
    expect(screen.getByText('Legacy Hosting Maintenance Agreement')).toBeInTheDocument();

    // Clause highlights and special terms [FR-1]
    expect(screen.getByText('Data Privacy & Protection')).toBeInTheDocument();
    expect(screen.getByText('Custom Support Tier Term')).toBeInTheDocument();
    expect(screen.getByText('Special Term')).toBeInTheDocument();

    // SLA commitments [FR-1]
    expect(screen.getByText('Platform Uptime SLA')).toBeInTheDocument();
    expect(screen.getByText('Target: 99.95%')).toBeInTheDocument();
    expect(screen.getByText('Penalty: 10% service credit per 0.1% downtime')).toBeInTheDocument();
  });

  it('filters contracts by keyword search [FR-7]', () => {
    render(<ContractList initialContracts={sampleContracts} autoFetch={false} />);

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Consulting' } });

    expect(screen.getByTestId('results-count')).toHaveTextContent('Showing 1 agreement');
    expect(screen.getByText('Software Development Consulting MSA')).toBeInTheDocument();
    expect(screen.queryByText('Master Cloud Services Agreement')).not.toBeInTheDocument();
  });

  it('filters contracts by status dropdown [FR-7]', () => {
    render(<ContractList initialContracts={sampleContracts} autoFetch={false} />);

    const statusFilter = screen.getByTestId('status-filter');
    fireEvent.change(statusFilter, { target: { value: 'ACTIVE' } });

    expect(screen.getByTestId('results-count')).toHaveTextContent('Showing 1 agreement');
    expect(screen.getByText('Master Cloud Services Agreement')).toBeInTheDocument();
    expect(screen.queryByText('Software Development Consulting MSA')).not.toBeInTheDocument();
  });

  it('filters contracts by counterparty input [FR-7]', () => {
    render(<ContractList initialContracts={sampleContracts} autoFetch={false} />);

    const counterpartyInput = screen.getByTestId('counterparty-filter');
    fireEvent.change(counterpartyInput, { target: { value: 'Gamma' } });

    expect(screen.getByTestId('results-count')).toHaveTextContent('Showing 1 agreement');
    expect(screen.getByText('Legacy Hosting Maintenance Agreement')).toBeInTheDocument();
    expect(screen.queryByText('Acme Cloud Solutions')).not.toBeInTheDocument();
  });

  it('resets all active filters when Clear Filters button is clicked', () => {
    render(<ContractList initialContracts={sampleContracts} autoFetch={false} />);

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Master' } });
    fireEvent.change(screen.getByTestId('status-filter'), { target: { value: 'ACTIVE' } });

    expect(screen.getByTestId('results-count')).toHaveTextContent('Showing 1 agreement');

    const clearButton = screen.getByTestId('clear-filters');
    fireEvent.click(clearButton);

    expect(screen.getByTestId('results-count')).toHaveTextContent('Showing 3 agreements');
    expect((screen.getByTestId('search-input') as HTMLInputElement).value).toBe('');
    expect((screen.getByTestId('status-filter') as HTMLSelectElement).value).toBe('');
  });

  it('calls searchContracts API when autoFetch is true and handles loading state', async () => {
    const searchSpy = vi.spyOn(clmClientModule, 'searchContracts').mockResolvedValueOnce(sampleContracts);

    render(<ContractList autoFetch={true} />);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(searchSpy).toHaveBeenCalled();
    expect(screen.getByText('Master Cloud Services Agreement')).toBeInTheDocument();
  });

  it('displays error message and retry button when searchContracts API fails', async () => {
    const searchSpy = vi
      .spyOn(clmClientModule, 'searchContracts')
      .mockRejectedValueOnce(new Error('Network error loading contracts'));

    render(<ContractList autoFetch={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error loading contracts')).toBeInTheDocument();

    // Retry
    searchSpy.mockResolvedValueOnce(sampleContracts);
    const retryBtn = screen.getByText('Retry');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Master Cloud Services Agreement')).toBeInTheDocument();
    });
  });

  it('displays empty state when no contracts match the filters', () => {
    render(<ContractList initialContracts={sampleContracts} autoFetch={false} />);

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'NonexistentTitle' } });

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No active contracts found')).toBeInTheDocument();
  });

  it('invokes onContractSelect when a contract card is clicked', () => {
    const onSelect = vi.fn();
    render(<ContractList initialContracts={sampleContracts} autoFetch={false} onContractSelect={onSelect} />);

    const card = screen.getByTestId('contract-card-cnt-001');
    fireEvent.click(card);

    expect(onSelect).toHaveBeenCalledWith(sampleContracts[0]);
  });
});
