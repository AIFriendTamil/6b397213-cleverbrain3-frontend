import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ESignatureHub } from '../src/components/clm/ESignatureHub';
import { ESignatureRequest } from '../src/services/clm_client';
import * as clmClientModule from '../src/services/clm_client';

const sampleRequests: ESignatureRequest[] = [
  {
    id: 'esign-001',
    contract_id: 'cnt-100',
    provider_ref_id: 'docusign-req-001',
    execution_status: 'PENDING',
    recipient_name: 'Alice Smith',
    recipient_email: 'alice.smith@acmecorp.com',
    status_updated_at: '2026-03-01T12:00:00Z',
    created_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'esign-002',
    contract_id: 'cnt-100',
    provider_ref_id: 'docusign-req-002',
    execution_status: 'SIGNED',
    recipient_name: 'Bob Jones',
    recipient_email: 'bob.jones@partnerorg.org',
    status_updated_at: '2026-03-02T15:30:00Z',
    created_at: '2026-03-01T11:00:00Z',
  },
  {
    id: 'esign-003',
    contract_id: 'cnt-200',
    provider_ref_id: 'docusign-req-003',
    execution_status: 'DECLINED',
    recipient_name: 'Carol White',
    recipient_email: 'carol.white@vendorinc.com',
    status_updated_at: '2026-03-03T09:15:00Z',
    created_at: '2026-03-01T14:00:00Z',
  },
];

describe('ESignatureHub Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders title, summary KPI stats grid, and request cards correctly when initialRequests is provided', () => {
    render(<ESignatureHub initialRequests={sampleRequests} autoFetch={false} />);

    expect(screen.getByTestId('esignature-hub-title')).toHaveTextContent('E-Signature Tracking Hub');

    // Stat KPI cards
    expect(screen.getByTestId('stat-total-requests')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-pending-requests')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-signed-requests')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-declined-requests')).toHaveTextContent('1');

    // Request items
    const items = screen.getAllByTestId('esign-request-item');
    expect(items).toHaveLength(3);

    const names = screen.getAllByTestId('esign-recipient-name');
    expect(names[0]).toHaveTextContent('👤 Alice Smith');
    expect(names[1]).toHaveTextContent('👤 Bob Jones');
    expect(names[2]).toHaveTextContent('👤 Carol White');

    const emails = screen.getAllByTestId('esign-recipient-email');
    expect(emails[0]).toHaveTextContent('✉️ alice.smith@acmecorp.com');

    const badges = screen.getAllByTestId('esign-status-badge');
    expect(badges[0]).toHaveTextContent('⏳ Pending Execution');
    expect(badges[1]).toHaveTextContent('✓ Signed');
    expect(badges[2]).toHaveTextContent('✕ Declined');
  });

  it('renders empty state when no e-signature requests are provided and allows toggling request creation form', () => {
    render(<ESignatureHub initialRequests={[]} autoFetch={false} />);

    expect(screen.getByTestId('esign-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No E-Signature Requests Found')).toBeInTheDocument();

    const toggleBtn = screen.getByTestId('esignature-form-toggle');
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('esignature-form')).toBeInTheDocument();
  });

  it('fetches e-signature requests automatically from backend API when autoFetch is true', async () => {
    const listRequestsSpy = vi
      .spyOn(clmClientModule, 'listESignatureRequests')
      .mockResolvedValueOnce(sampleRequests);

    render(<ESignatureHub contractId="cnt-100" autoFetch={true} roles="ADMIN" />);

    expect(screen.getByTestId('esign-loading-state')).toBeInTheDocument();

    await waitFor(() => {
      expect(listRequestsSpy).toHaveBeenCalledWith({
        contract_id: 'cnt-100',
        roles: 'ADMIN',
      });
      expect(screen.queryByTestId('esign-loading-state')).not.toBeInTheDocument();
    });

    expect(screen.getAllByTestId('esign-request-item')).toHaveLength(3);
  });

  it('renders error state when API fetch fails and provides retry button', async () => {
    const listRequestsSpy = vi
      .spyOn(clmClientModule, 'listESignatureRequests')
      .mockRejectedValueOnce(new Error('Connection error loading e-signatures'))
      .mockResolvedValueOnce(sampleRequests);

    render(<ESignatureHub autoFetch={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('esign-error-state')).toBeInTheDocument();
      expect(screen.getByText(/Connection error loading e-signatures/)).toBeInTheDocument();
    });

    const retryBtn = screen.getByTestId('esign-retry-button');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(listRequestsSpy).toHaveBeenCalledTimes(2);
      expect(screen.queryByTestId('esign-error-state')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('esign-request-item')).toHaveLength(3);
    });
  });

  it('validates required fields when dispatching e-signature request form', () => {
    render(<ESignatureHub initialRequests={sampleRequests} autoFetch={false} />);

    const toggleBtn = screen.getByTestId('esignature-form-toggle');
    fireEvent.click(toggleBtn);

    const submitBtn = screen.getByTestId('esign-submit-button');
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('esign-form-error')).toHaveTextContent('Contract ID is required.');

    // Fill contract ID
    fireEvent.change(screen.getByTestId('esign-contract-id-input'), {
      target: { value: 'cnt-100' },
    });
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('esign-form-error')).toHaveTextContent('Recipient signer name is required.');

    // Fill recipient name
    fireEvent.change(screen.getByTestId('esign-recipient-name-input'), {
      target: { value: 'David Miller' },
    });
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('esign-form-error')).toHaveTextContent('A valid recipient email address is required.');
  });

  it('dispatches a new e-signature request successfully and invokes onRequestCreated callback', async () => {
    const onRequestCreatedSpy = vi.fn();
    const newRequest: ESignatureRequest = {
      id: 'esign-004',
      contract_id: 'cnt-100',
      provider_ref_id: 'docusign-req-004',
      execution_status: 'PENDING',
      recipient_name: 'David Miller',
      recipient_email: 'david.miller@enterprise.com',
      status_updated_at: '2026-03-05T08:00:00Z',
      created_at: '2026-03-05T08:00:00Z',
    };

    const createRequestSpy = vi
      .spyOn(clmClientModule, 'createESignatureRequest')
      .mockResolvedValueOnce(newRequest);

    render(
      <ESignatureHub
        contractId="cnt-100"
        initialRequests={sampleRequests}
        onRequestCreated={onRequestCreatedSpy}
        autoFetch={false}
      />
    );

    const toggleBtn = screen.getByTestId('esignature-form-toggle');
    fireEvent.click(toggleBtn);

    fireEvent.change(screen.getByTestId('esign-recipient-name-input'), {
      target: { value: 'David Miller' },
    });
    fireEvent.change(screen.getByTestId('esign-recipient-email-input'), {
      target: { value: 'david.miller@enterprise.com' },
    });
    fireEvent.change(screen.getByTestId('esign-subject-input'), {
      target: { value: 'Please sign SLA agreement' },
    });

    const submitBtn = screen.getByTestId('esign-submit-button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createRequestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          contract_id: 'cnt-100',
          recipient_name: 'David Miller',
          recipient_email: 'david.miller@enterprise.com',
          subject: 'Please sign SLA agreement',
        }),
        { roles: undefined }
      );
      expect(onRequestCreatedSpy).toHaveBeenCalledWith(newRequest);
    });

    expect(screen.getByTestId('esign-form-success')).toHaveTextContent(
      'E-signature execution request dispatched to David Miller.'
    );
  });

  it('filters requests list based on search input query', () => {
    render(<ESignatureHub initialRequests={sampleRequests} autoFetch={false} />);

    const searchInput = screen.getByTestId('esign-search-input');
    fireEvent.change(searchInput, { target: { value: 'Bob' } });

    const items = screen.getAllByTestId('esign-request-item');
    expect(items).toHaveLength(1);
    expect(screen.getByTestId('esign-recipient-name')).toHaveTextContent('👤 Bob Jones');
  });

  it('filters requests list based on status selector dropdown', () => {
    render(<ESignatureHub initialRequests={sampleRequests} autoFetch={false} />);

    const statusFilter = screen.getByTestId('esign-status-filter');

    // Select SIGNED
    fireEvent.change(statusFilter, { target: { value: 'SIGNED' } });
    let items = screen.getAllByTestId('esign-request-item');
    expect(items).toHaveLength(1);
    expect(screen.getByTestId('esign-recipient-name')).toHaveTextContent('👤 Bob Jones');

    // Select DECLINED
    fireEvent.change(statusFilter, { target: { value: 'DECLINED' } });
    items = screen.getAllByTestId('esign-request-item');
    expect(items).toHaveLength(1);
    expect(screen.getByTestId('esign-recipient-name')).toHaveTextContent('👤 Carol White');
  });

  it('hides send request button when readOnly prop is true', () => {
    render(<ESignatureHub initialRequests={sampleRequests} readOnly={true} autoFetch={false} />);

    expect(screen.queryByTestId('esignature-form-toggle')).not.toBeInTheDocument();
  });

  it('simulates webhook status update when "Mark Signed" button is clicked on pending request', async () => {
    const onStatusUpdatedSpy = vi.fn();
    const webhookSpy = vi
      .spyOn(clmClientModule, 'postESignatureWebhook')
      .mockResolvedValueOnce({
        status: 'acknowledged',
        execution_status: 'SIGNED',
      });

    render(
      <ESignatureHub
        initialRequests={sampleRequests}
        onStatusUpdated={onStatusUpdatedSpy}
        autoFetch={false}
      />
    );

    const markSignedBtn = screen.getByTestId('esign-simulate-webhook-button');
    fireEvent.click(markSignedBtn);

    await waitFor(() => {
      expect(webhookSpy).toHaveBeenCalledWith('mock_provider', expect.objectContaining({
        execution_status: 'SIGNED',
        provider_ref_id: 'docusign-req-001',
      }));
      expect(onStatusUpdatedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'esign-001',
          execution_status: 'SIGNED',
        })
      );
    });
  });
});
