import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TicketsPage, { TicketsPageContent } from '../src/app/tickets/page';
import { CurrentUserResponse } from '../src/services/auth';
import { Ticket, PaginatedTickets, TicketCreate } from '../src/services/tickets';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/tickets',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock API client service
vi.mock('../src/services/tickets', async () => {
  const actual = await vi.importActual<typeof import('../src/services/tickets')>('../src/services/tickets');
  return {
    ...actual,
    listTickets: vi.fn(),
    createTicket: vi.fn(),
    deleteTicket: vi.fn(),
  };
});

import { listTickets, createTicket, deleteTicket } from '../src/services/tickets';

const mockUser: CurrentUserResponse = {
  user_id: 'usr-tickets-999',
  email: 'support.lead@example.com',
  full_name: 'Support Operations Lead',
  tenant_id: 'tnt-support-org-101',
};

const sampleTickets: Ticket[] = [
  {
    id: 'tkt-001',
    title: 'High latency on database connection pool',
    description: 'Intermittent timeouts occurring on database pool checkout during peak hours.',
    severity: 'P1',
    status: 'NEW',
    escalation_tier: 1,
    organization_id: 'tnt-support-org-101',
    creator_user_id: 'usr-001',
    assigned_agent_id: 'usr-agent-1',
    response_due_at: '2026-10-24T13:00:00Z',
    resolution_due_at: '2026-10-24T16:00:00Z',
    is_sla_breached: false,
    created_at: '2026-10-24T12:00:00Z',
    updated_at: '2026-10-24T12:00:00Z',
  },
  {
    id: 'tkt-002',
    title: 'Billing export CSV layout glitch',
    description: 'Header column mismatch on exported billing report.',
    severity: 'P3',
    status: 'IN_PROGRESS',
    escalation_tier: 2,
    organization_id: 'tnt-support-org-101',
    creator_user_id: 'usr-002',
    assigned_agent_id: 'usr-agent-2',
    response_due_at: '2026-10-25T12:00:00Z',
    resolution_due_at: '2026-10-27T12:00:00Z',
    is_sla_breached: false,
    created_at: '2026-10-24T10:00:00Z',
    updated_at: '2026-10-24T11:00:00Z',
  },
];

const paginatedSample: PaginatedTickets = {
  items: sampleTickets,
  total: 2,
  page: 1,
  limit: 10,
  pages: 1,
};

describe('Support Tickets Dashboard Page Route Component (T018)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listTickets).mockResolvedValue(paginatedSample);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders dashboard header, nav menu, and default tickets list when user is provided', async () => {
    render(
      <TicketsPageContent
        user={mockUser}
        initialTickets={sampleTickets}
        autoFetch={false}
      />
    );

    expect(screen.getByTestId('tickets-page')).toBeInTheDocument();
    expect(screen.getByTestId('tickets-header')).toBeInTheDocument();
    expect(screen.getByText('Support Ticket Dashboard')).toBeInTheDocument();

    expect(screen.getByTestId('ticket-row-tkt-001')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-row-tkt-002')).toBeInTheDocument();
    expect(screen.getByText('High latency on database connection pool')).toBeInTheDocument();
  });

  it('filters tickets by status, severity, and organization ID when applying filters', async () => {
    const customFetchTickets = vi.fn().mockResolvedValue(paginatedSample);

    render(
      <TicketsPageContent
        user={mockUser}
        fetchTickets={customFetchTickets}
        autoFetch={false}
      />
    );

    const statusSelect = screen.getByTestId('filter-status');
    fireEvent.change(statusSelect, { target: { value: 'NEW' } });

    const severitySelect = screen.getByTestId('filter-severity');
    fireEvent.change(severitySelect, { target: { value: 'P1' } });

    const orgInput = screen.getByTestId('filter-organization-id');
    fireEvent.change(orgInput, { target: { value: 'tnt-support-org-101' } });

    const applyButton = screen.getByTestId('apply-filters-button');
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(customFetchTickets).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'NEW',
          severity: 'P1',
          organization_id: 'tnt-support-org-101',
          page: 1,
          limit: 10,
        })
      );
    });
  });

  it('resets filters when clicking the reset button', async () => {
    render(
      <TicketsPageContent
        user={mockUser}
        initialStatus="NEW"
        initialSeverity="P1"
        initialOrganizationId="test-org"
        autoFetch={false}
      />
    );

    const statusSelect = screen.getByTestId('filter-status') as HTMLSelectElement;
    const severitySelect = screen.getByTestId('filter-severity') as HTMLSelectElement;
    const orgInput = screen.getByTestId('filter-organization-id') as HTMLInputElement;

    expect(statusSelect.value).toBe('NEW');
    expect(severitySelect.value).toBe('P1');
    expect(orgInput.value).toBe('test-org');

    const resetButton = screen.getByTestId('reset-filters-button');
    fireEvent.click(resetButton);

    expect(statusSelect.value).toBe('');
    expect(severitySelect.value).toBe('');
    expect(orgInput.value).toBe('');
  });

  it('opens create ticket form modal, submits new ticket payload, and reloads tickets', async () => {
    const customOnCreate = vi.fn().mockResolvedValue({
      id: 'tkt-new-123',
      title: 'New Escalated Network Issue',
      description: 'Network gateway packet loss detected on router B.',
      severity: 'P1',
      status: 'NEW',
      escalation_tier: 1,
      organization_id: 'tnt-support-org-101',
      creator_user_id: 'usr-tickets-999',
      response_due_at: '2026-10-24T13:00:00Z',
      resolution_due_at: '2026-10-24T16:00:00Z',
      is_sla_breached: false,
      created_at: '2026-10-24T12:00:00Z',
      updated_at: '2026-10-24T12:00:00Z',
    });

    const customFetchTickets = vi.fn().mockResolvedValue(paginatedSample);

    render(
      <TicketsPageContent
        user={mockUser}
        onCreateTicket={customOnCreate}
        fetchTickets={customFetchTickets}
        autoFetch={false}
      />
    );

    const openModalBtn = screen.getByTestId('open-create-ticket-button');
    fireEvent.click(openModalBtn);

    expect(screen.getByTestId('create-ticket-modal')).toBeInTheDocument();

    const titleInput = screen.getByTestId('ticket-title-input');
    fireEvent.change(titleInput, { target: { value: 'New Escalated Network Issue' } });

    const descInput = screen.getByTestId('ticket-description-input');
    fireEvent.change(descInput, { target: { value: 'Network gateway packet loss detected on router B.' } });

    const severitySelect = screen.getByTestId('ticket-severity-select');
    fireEvent.change(severitySelect, { target: { value: 'P1' } });

    const orgInput = screen.getByTestId('ticket-organization-input');
    fireEvent.change(orgInput, { target: { value: 'tnt-support-org-101' } });

    const fileInput = screen.getByTestId('ticket-file-input');
    const dummyFile = new File(['log content'], 'network_dump.log', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [dummyFile] } });

    const submitBtn = screen.getByTestId('submit-ticket-button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(customOnCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Escalated Network Issue',
          description: 'Network gateway packet loss detected on router B.',
          severity: 'P1',
          organization_id: 'tnt-support-org-101',
          file: dummyFile,
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('create-ticket-success')).toBeInTheDocument();
    });
  });

  it('handles ticket deletion correctly when delete button is clicked', async () => {
    const customOnDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <TicketsPageContent
        user={mockUser}
        initialTickets={sampleTickets}
        onDeleteTicket={customOnDelete}
        autoFetch={false}
      />
    );

    const deleteBtn = screen.getByTestId('delete-ticket-button-tkt-001');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(customOnDelete).toHaveBeenCalledWith('tkt-001');
    });

    expect(screen.queryByTestId('ticket-row-tkt-001')).not.toBeInTheDocument();
  });

  it('renders empty state when ticket list is empty', async () => {
    render(
      <TicketsPageContent
        user={mockUser}
        initialTickets={[]}
        autoFetch={false}
      />
    );

    expect(screen.getByTestId('tickets-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No Support Tickets Found')).toBeInTheDocument();
  });

  it('renders error state when fetch fails', async () => {
    const customFetchTickets = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

    render(
      <TicketsPageContent
        user={mockUser}
        fetchTickets={customFetchTickets}
        autoFetch={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('tickets-error')).toBeInTheDocument();
      expect(screen.getByText('Network connection timeout')).toBeInTheDocument();
    });
  });
});
