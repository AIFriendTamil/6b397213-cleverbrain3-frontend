import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContractDetail } from '../src/components/clm/ContractDetail';
import { ContractDetail as IContractDetail } from '../src/services/clm_client';
import * as clmClientModule from '../src/services/clm_client';

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

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
      content: 'Dedicated designated enterprise engineer assigned with 15-minute response response time SLA.',
    },
    {
      id: 'cls-103',
      contract_id: 'cnt-100',
      title: 'Termination for Cause',
      clause_type: 'TERMINATION',
      content: 'Either party may terminate immediately upon material breach uncured within 30 days.',
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
    {
      id: 'sla-102',
      contract_id: 'cnt-100',
      metric_name: 'Critical Incident Response Time',
      target_value: '< 15 mins',
      penalty_terms: '$500 penalty per hour delay',
    },
  ],
};

describe('ContractDetail Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders contract header metadata, title, counterparty, and status badge correctly when initialContract is provided', () => {
    render(<ContractDetail initialContract={sampleContract} />);

    expect(screen.getByTestId('contract-detail-title')).toHaveTextContent(
      'Enterprise Enterprise Cloud & AI Services Agreement'
    );
    expect(screen.getByTestId('contract-detail-number')).toHaveTextContent('CNT-2026-100');
    expect(screen.getByTestId('contract-detail-counterparty')).toHaveTextContent('Acme Mega Corp');
    expect(screen.getByTestId('contract-detail-status')).toHaveTextContent('Active');
    expect(screen.getByTestId('contract-detail-expiration')).toHaveTextContent('2026-12-31');
    expect(screen.getByText('✓ Auto-Renews')).toBeInTheDocument();
  });

  it('renders special terms section and lists special terms clearly', () => {
    render(<ContractDetail initialContract={sampleContract} />);

    const specialTermsSection = screen.getByTestId('special-terms-section');
    expect(specialTermsSection).toBeInTheDocument();
    expect(screen.getByTestId('special-terms-count')).toHaveTextContent('1 term');

    const specialTermItems = screen.getAllByTestId('special-term-item');
    expect(specialTermItems).toHaveLength(1);
    expect(screen.getByTestId('special-term-title')).toHaveTextContent(
      'Custom VIP SLA & Extended Warranty Term'
    );
    expect(screen.getByTestId('special-term-content')).toHaveTextContent(
      'Dedicated designated enterprise engineer assigned with 15-minute response response time SLA.'
    );
  });

  it('renders key clause highlights and filters clauses when filter buttons are clicked', () => {
    render(<ContractDetail initialContract={sampleContract} />);

    const clauseItemsInitial = screen.getAllByTestId('clause-item');
    expect(clauseItemsInitial).toHaveLength(3);

    // Filter by SPECIAL_TERM
    const specialFilterBtn = screen.getByTestId('clause-filter-SPECIAL_TERM');
    fireEvent.click(specialFilterBtn);

    const clauseItemsFiltered = screen.getAllByTestId('clause-item');
    expect(clauseItemsFiltered).toHaveLength(1);
    expect(screen.getByTestId('clause-title')).toHaveTextContent('Custom VIP SLA & Extended Warranty Term');

    // Filter by TERMINATION
    const terminationFilterBtn = screen.getByTestId('clause-filter-TERMINATION');
    fireEvent.click(terminationFilterBtn);

    const clauseItemsTermination = screen.getAllByTestId('clause-item');
    expect(clauseItemsTermination).toHaveLength(1);
    expect(screen.getByTestId('clause-title')).toHaveTextContent('Termination for Cause');

    // Reset filter to ALL
    const allFilterBtn = screen.getByTestId('clause-filter-ALL');
    fireEvent.click(allFilterBtn);
    expect(screen.getAllByTestId('clause-item')).toHaveLength(3);
  });

  it('renders SLA commitments section and items with metric name, target value, and penalty terms', () => {
    render(<ContractDetail initialContract={sampleContract} />);

    const slaItems = screen.getAllByTestId('sla-item');
    expect(slaItems).toHaveLength(2);

    const metricNames = screen.getAllByTestId('sla-metric-name');
    expect(metricNames[0]).toHaveTextContent('Monthly Uptime Guarantee');
    expect(metricNames[1]).toHaveTextContent('Critical Incident Response Time');

    const targetValues = screen.getAllByTestId('sla-target-value');
    expect(targetValues[0]).toHaveTextContent('99.99%');
    expect(targetValues[1]).toHaveTextContent('< 15 mins');

    const penaltyTerms = screen.getAllByTestId('sla-penalty-terms');
    expect(penaltyTerms[0]).toHaveTextContent('15% service credit per 0.05% downtime below target');
  });

  it('renders empty messages when contract has no clauses or SLA commitments', () => {
    const emptyContract: IContractDetail = {
      ...sampleContract,
      id: 'cnt-empty',
      clauses: [],
      sla_commitments: [],
    };

    render(<ContractDetail initialContract={emptyContract} />);

    expect(screen.getByTestId('no-special-terms-msg')).toHaveTextContent(
      'No special terms or non-standard provisions specified for this contract.'
    );
    expect(screen.getByTestId('no-clauses-msg')).toHaveTextContent(
      'No clause highlights recorded for this agreement.'
    );
    expect(screen.getByTestId('no-sla-msg')).toHaveTextContent(
      'No SLA commitments specified for this agreement.'
    );
  });

  it('fetches contract details from API when contractId prop is provided', async () => {
    const getContractDetailSpy = vi
      .spyOn(clmClientModule, 'getContractDetail')
      .mockResolvedValueOnce(sampleContract);

    const onLoadedSpy = vi.fn();

    render(<ContractDetail contractId="cnt-100" roles="legal_admin" onContractLoaded={onLoadedSpy} />);

    expect(screen.getByTestId('contract-detail-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(getContractDetailSpy).toHaveBeenCalledWith('cnt-100', { roles: 'legal_admin' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('contract-detail-title')).toHaveTextContent(
        'Enterprise Enterprise Cloud & AI Services Agreement'
      );
    });

    expect(onLoadedSpy).toHaveBeenCalledWith(sampleContract);
  });

  it('renders error state when API call fails and allows retry', async () => {
    const getContractDetailSpy = vi
      .spyOn(clmClientModule, 'getContractDetail')
      .mockRejectedValueOnce(new Error('Network error fetching contract'))
      .mockResolvedValueOnce(sampleContract);

    render(<ContractDetail contractId="cnt-100" />);

    await waitFor(() => {
      expect(screen.getByTestId('contract-detail-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error fetching contract')).toBeInTheDocument();

    const retryBtn = screen.getByTestId('contract-retry-btn');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('contract-detail-title')).toBeInTheDocument();
    });

    expect(getContractDetailSpy).toHaveBeenCalledTimes(2);
  });

  it('triggers onBack and onEdit callbacks when clicked', () => {
    const onBackSpy = vi.fn();
    const onEditSpy = vi.fn();

    render(<ContractDetail initialContract={sampleContract} onBack={onBackSpy} onEdit={onEditSpy} />);

    const backBtn = screen.getByTestId('contract-back-btn');
    fireEvent.click(backBtn);
    expect(onBackSpy).toHaveBeenCalledTimes(1);

    const editBtn = screen.getByTestId('contract-edit-btn');
    fireEvent.click(editBtn);
    expect(onEditSpy).toHaveBeenCalledWith(sampleContract);
  });

  it('handles contract deletion flow with confirmation prompt and onDelete callback', async () => {
    const deleteContractSpy = vi.spyOn(clmClientModule, 'deleteContract').mockResolvedValueOnce();
    const onDeleteSpy = vi.fn();

    render(<ContractDetail initialContract={sampleContract} onDelete={onDeleteSpy} roles="admin" />);

    const deleteBtn = screen.getByTestId('contract-delete-btn');
    fireEvent.click(deleteBtn);

    const confirmBtn = screen.getByTestId('contract-delete-confirm');
    expect(confirmBtn).toBeInTheDocument();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteContractSpy).toHaveBeenCalledWith('cnt-100', { roles: 'admin' });
    });

    expect(onDeleteSpy).toHaveBeenCalledWith('cnt-100');
  });

  it('renders not found state when initialContract is null and no contractId is provided', () => {
    render(<ContractDetail initialContract={null} autoFetch={false} />);

    expect(screen.getByTestId('contract-detail-not-found')).toBeInTheDocument();
  });
});
