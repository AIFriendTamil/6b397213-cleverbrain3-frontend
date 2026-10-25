import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AmendmentTimeline } from '../src/components/clm/AmendmentTimeline';
import { AmendmentAuditLog } from '../src/services/clm_client';
import * as clmClientModule from '../src/services/clm_client';

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
  {
    id: 'amd-002',
    contract_id: 'cnt-100',
    amendment_number: 2,
    summary: 'Added custom SLA response time commitment for tier 1 critical incidents.',
    user_id: 'usr-ops-admin',
    timestamp: '2026-03-15T14:30:00Z',
    integrity_hash: 'hmac_sha256_002_1b3d5f7a9c2e4g6h8j0k2l4m6n8p0q2r4s6t8u0v2w4x6y8z0a2b4c6d8e0f2g4h',
  },
];

describe('AmendmentTimeline Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders amendment timeline header, count badge, immutable badge, and audit items correctly when initialAmendments is provided', () => {
    render(<AmendmentTimeline initialAmendments={sampleAmendments} />);

    expect(screen.getByTestId('amendment-timeline-title')).toHaveTextContent('Amendment Audit Trail');
    expect(screen.getByTestId('amendment-count')).toHaveTextContent('2 Entries');
    expect(screen.getByTestId('amendment-immutable-badge')).toHaveTextContent('🔒 Immutable & Tamper-Evident');

    const items = screen.getAllByTestId('amendment-item');
    expect(items).toHaveLength(2);

    const amendmentNumbers = screen.getAllByTestId('amendment-number');
    expect(amendmentNumbers[0]).toHaveTextContent('Amendment #1');
    expect(amendmentNumbers[1]).toHaveTextContent('Amendment #2');

    const summaries = screen.getAllByTestId('amendment-summary');
    expect(summaries[0]).toHaveTextContent('Extended contract term by 12 months');
    expect(summaries[1]).toHaveTextContent('Added custom SLA response time commitment');

    const users = screen.getAllByTestId('amendment-user');
    expect(users[0]).toHaveTextContent('👤 usr-legal-lead');
    expect(users[1]).toHaveTextContent('👤 usr-ops-admin');

    const hashes = screen.getAllByTestId('amendment-integrity-hash');
    expect(hashes[0]).toHaveTextContent('hmac_sha256_001_...');
  });

  it('renders empty state when no amendments are provided and allows opening amendment record form', () => {
    render(<AmendmentTimeline initialAmendments={[]} />);

    expect(screen.getByTestId('amendment-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No Amendment Records Found')).toBeInTheDocument();

    const recordBtn = screen.getByTestId('amendment-form-toggle');
    expect(recordBtn).toBeInTheDocument();

    fireEvent.click(recordBtn);
    expect(screen.getByTestId('amendment-form')).toBeInTheDocument();
  });

  it('fetches amendments from API automatically when contractId is provided', async () => {
    const getAmendmentsSpy = vi
      .spyOn(clmClientModule, 'getAmendments')
      .mockResolvedValueOnce(sampleAmendments);

    render(<AmendmentTimeline contractId="cnt-100" autoFetch={true} roles="ADMIN" />);

    expect(screen.getByTestId('amendment-loading-state')).toBeInTheDocument();

    await waitFor(() => {
      expect(getAmendmentsSpy).toHaveBeenCalledWith('cnt-100', { roles: 'ADMIN' });
      expect(screen.queryByTestId('amendment-loading-state')).not.toBeInTheDocument();
    });

    expect(screen.getAllByTestId('amendment-item')).toHaveLength(2);
  });

  it('renders error state when API call fails and allows retry', async () => {
    const getAmendmentsSpy = vi
      .spyOn(clmClientModule, 'getAmendments')
      .mockRejectedValueOnce(new Error('Network error loading audit trail'))
      .mockResolvedValueOnce(sampleAmendments);

    render(<AmendmentTimeline contractId="cnt-100" autoFetch={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('amendment-error-state')).toBeInTheDocument();
      expect(screen.getByText(/Network error loading audit trail/)).toBeInTheDocument();
    });

    const retryBtn = screen.getByTestId('amendment-retry-button');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(getAmendmentsSpy).toHaveBeenCalledTimes(2);
      expect(screen.queryByTestId('amendment-error-state')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('amendment-item')).toHaveLength(2);
    });
  });

  it('filters timeline items based on search input query', () => {
    render(<AmendmentTimeline initialAmendments={sampleAmendments} />);

    const searchInput = screen.getByTestId('amendment-search-input');
    fireEvent.change(searchInput, { target: { value: 'custom SLA' } });

    const items = screen.getAllByTestId('amendment-item');
    expect(items).toHaveLength(1);
    expect(screen.getByTestId('amendment-summary')).toHaveTextContent(
      'Added custom SLA response time commitment'
    );
  });

  it('toggles sort order between chronological ascending and descending', () => {
    render(<AmendmentTimeline initialAmendments={sampleAmendments} />);

    let numbers = screen.getAllByTestId('amendment-number');
    expect(numbers[0]).toHaveTextContent('Amendment #1');
    expect(numbers[1]).toHaveTextContent('Amendment #2');

    const sortToggle = screen.getByTestId('amendment-sort-toggle');
    fireEvent.click(sortToggle);

    numbers = screen.getAllByTestId('amendment-number');
    expect(numbers[0]).toHaveTextContent('Amendment #2');
    expect(numbers[1]).toHaveTextContent('Amendment #1');
  });

  it('validates form submission and displays error when summary is empty', () => {
    render(<AmendmentTimeline initialAmendments={sampleAmendments} />);

    const toggleBtn = screen.getByTestId('amendment-form-toggle');
    fireEvent.click(toggleBtn);

    const submitBtn = screen.getByTestId('amendment-submit-button');
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('amendment-form-error')).toHaveTextContent(
      'Amendment summary is required.'
    );
  });

  it('records a new amendment successfully and calls onAmendmentAdded callback', async () => {
    const onAmendmentAddedSpy = vi.fn();
    const newRecord: AmendmentAuditLog = {
      id: 'amd-003',
      contract_id: 'cnt-100',
      amendment_number: 3,
      summary: 'Updated payment terms from Net 30 to Net 45.',
      user_id: 'usr-finance-officer',
      timestamp: '2026-04-01T09:00:00Z',
      integrity_hash: 'hmac_sha256_003_9999',
    };

    const recordAmendmentSpy = vi
      .spyOn(clmClientModule, 'recordAmendment')
      .mockResolvedValueOnce(newRecord);

    render(
      <AmendmentTimeline
        contractId="cnt-100"
        initialAmendments={sampleAmendments}
        onAmendmentAdded={onAmendmentAddedSpy}
        autoFetch={false}
      />
    );

    const toggleBtn = screen.getByTestId('amendment-form-toggle');
    fireEvent.click(toggleBtn);

    const summaryInput = screen.getByTestId('amendment-summary-input');
    const userInput = screen.getByTestId('amendment-user-input');

    fireEvent.change(summaryInput, { target: { value: 'Updated payment terms from Net 30 to Net 45.' } });
    fireEvent.change(userInput, { target: { value: 'usr-finance-officer' } });

    const submitBtn = screen.getByTestId('amendment-submit-button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(recordAmendmentSpy).toHaveBeenCalledWith(
        'cnt-100',
        expect.objectContaining({
          summary: 'Updated payment terms from Net 30 to Net 45.',
          user_id: 'usr-finance-officer',
        }),
        { roles: undefined }
      );
      expect(onAmendmentAddedSpy).toHaveBeenCalledWith(newRecord);
    });

    expect(screen.getByTestId('amendment-form-success')).toHaveTextContent(
      'Amendment audit record saved successfully.'
    );
  });

  it('hides form toggle button when readOnly prop is true', () => {
    render(<AmendmentTimeline initialAmendments={sampleAmendments} readOnly={true} />);

    expect(screen.queryByTestId('amendment-form-toggle')).not.toBeInTheDocument();
  });

  it('expands full integrity hash when "show full hash" button is clicked', () => {
    render(<AmendmentTimeline initialAmendments={sampleAmendments} />);

    const hashElement = screen.getAllByTestId('amendment-integrity-hash')[0];
    expect(hashElement).toHaveTextContent('hmac_sha256_001_...');

    const expandBtn = screen.getByText('show full hash');
    fireEvent.click(expandBtn);

    expect(hashElement).toHaveTextContent(
      'hmac_sha256_001_8a7f9c2d4e6b1a3f5c7e9d2b4f6a8c0e1d3f5b7a9c2d4e6b1a3f5c7e9d2b4f6a'
    );
  });
});
