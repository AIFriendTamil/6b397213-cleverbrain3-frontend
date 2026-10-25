import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TicketDetailPage, { TicketDetailContent } from '../src/app/tickets/[id]/page';
import { CurrentUserResponse } from '../src/services/auth';
import {
  TicketDetail,
  TicketEvent,
  Ticket,
  CSATResponse,
} from '../src/services/tickets';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/tickets/tkt-100',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: any }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock ticket API service
vi.mock('../src/services/tickets', async () => {
  const actual = await vi.importActual<typeof import('../src/services/tickets')>('../src/services/tickets');
  return {
    ...actual,
    getTicketDetail: vi.fn(),
    addTicketReply: vi.fn(),
    updateTicketStatus: vi.fn(),
    submitCSAT: vi.fn(),
    deleteTicket: vi.fn(),
  };
});

import {
  getTicketDetail,
  addTicketReply,
  updateTicketStatus,
  submitCSAT,
  deleteTicket,
} from '../src/services/tickets';

const mockUser: CurrentUserResponse = {
  user_id: 'usr-agent-777',
  email: 'agent.lead@example.com',
  full_name: 'Lead Support Agent',
  tenant_id: 'tnt-corp-456',
};

const sampleEvents: TicketEvent[] = [
  {
    id: 'evt-001',
    ticket_id: 'tkt-100',
    author_id: 'usr-client-1',
    event_type: 'TICKET_CREATED',
    content: 'Ticket created by customer regarding API authentication failure.',
    created_at: '2026-10-24T10:00:00Z',
  },
  {
    id: 'evt-002',
    ticket_id: 'tkt-100',
    author_id: 'usr-agent-777',
    event_type: 'COMMENT',
    content: 'Investigating JWT token expiration duration settings.',
    created_at: '2026-10-24T10:30:00Z',
  },
];

const sampleTicketDetail: TicketDetail = {
  id: 'tkt-100',
  title: 'JWT Authentication Token Revocation Error',
  description: 'Clients experiencing premature 401 Unauthorized errors during session renewal.',
  severity: 'P1',
  status: 'IN_PROGRESS',
  escalation_tier: 2,
  organization_id: 'tnt-corp-456',
  creator_user_id: 'usr-client-1',
  assigned_agent_id: 'usr-agent-777',
  response_due_at: '2026-10-24T11:00:00Z',
  resolution_due_at: '2026-10-24T14:00:00Z',
  is_sla_breached: false,
  created_at: '2026-10-24T10:00:00Z',
  updated_at: '2026-10-24T10:30:00Z',
  events: sampleEvents,
};

describe('Support Ticket Detail View Page Component (T019)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTicketDetail).mockResolvedValue(sampleTicketDetail);
    // Suppress window.confirm prompt in tests
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading indicator when ticket detail is fetching', async () => {
    vi.mocked(getTicketDetail).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <TicketDetailContent
        ticketId="tkt-100"
        user={mockUser}
        autoFetch={true}
      />
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders ticket details, status badge, severity badge, SLA timer, and communication feed when loaded', async () => {
    render(
      <TicketDetailContent
        ticketId="tkt-100"
        user={mockUser}
        initialTicket={sampleTicketDetail}
      />
    );

    // Verify main page elements
    expect(screen.getByTestId('ticket-detail-page')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-title')).toHaveTextContent('JWT Authentication Token Revocation Error');
    expect(screen.getByTestId('ticket-id-display')).toHaveTextContent('tkt-100');
    expect(screen.getByTestId('ticket-severity-badge')).toHaveTextContent('P1 Critical');
    expect(screen.getByTestId('ticket-status-badge')).toHaveTextContent('In Progress');
    expect(screen.getByTestId('ticket-tier-badge')).toHaveTextContent('Escalation Tier 2');

    // Verify description
    expect(screen.getByTestId('ticket-description')).toHaveTextContent(
      'Clients experiencing premature 401 Unauthorized errors during session renewal.'
    );

    // Verify integrated sub-components
    expect(screen.getByTestId('status-update-section')).toBeInTheDocument();
    expect(screen.getByTestId('communication-thread-container')).toBeInTheDocument();
    expect(screen.getByTestId('sla-timer-container')).toBeInTheDocument();
  });

  it('handles ticket status and severity updates via form submission', async () => {
    const updatedTicket: Ticket = {
      ...sampleTicketDetail,
      status: 'ESCALATED',
      severity: 'P1',
      escalation_tier: 3,
      updated_at: '2026-10-24T11:00:00Z',
    };
    vi.mocked(updateTicketStatus).mockResolvedValue(updatedTicket);

    render(
      <TicketDetailContent
        ticketId="tkt-100"
        user={mockUser}
        initialTicket={sampleTicketDetail}
      />
    );

    // Change status select dropdown to ESCALATED
    const statusSelect = screen.getByTestId('status-select');
    fireEvent.change(statusSelect, { target: { value: 'ESCALATED' } });

    // Submit status update form
    const updateButton = screen.getByTestId('update-status-button');
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(updateTicketStatus).toHaveBeenCalledWith('tkt-100', {
        status: 'ESCALATED',
        severity: 'P1',
        assigned_agent_id: 'usr-agent-777',
      });
      expect(screen.getByTestId('status-update-success')).toHaveTextContent('Ticket status updated to "ESCALATED".');
    });
  });

  it('handles reply and comment submission in communication thread', async () => {
    const newReplyEvent: TicketEvent = {
      id: 'evt-003',
      ticket_id: 'tkt-100',
      author_id: 'usr-agent-777',
      event_type: 'COMMENT',
      content: 'Resolved underlying JWT expiry issue in production deployment.',
      created_at: '2026-10-24T11:30:00Z',
    };
    vi.mocked(addTicketReply).mockResolvedValue(newReplyEvent);

    render(
      <TicketDetailContent
        ticketId="tkt-100"
        user={mockUser}
        initialTicket={sampleTicketDetail}
      />
    );

    // Find reply text area in CommunicationThread
    const replyTextarea = screen.getByTestId('reply-textarea');
    fireEvent.change(replyTextarea, {
      target: { value: 'Resolved underlying JWT expiry issue in production deployment.' },
    });

    // Click submit reply button
    const submitReplyButton = screen.getByTestId('submit-reply-button');
    fireEvent.click(submitReplyButton);

    await waitFor(() => {
      expect(addTicketReply).toHaveBeenCalledWith('tkt-100', {
        content: 'Resolved underlying JWT expiry issue in production deployment.',
      });
      expect(screen.getByText('Resolved underlying JWT expiry issue in production deployment.')).toBeInTheDocument();
    });
  });

  it('prompts CSAT modal when ticket status transitions to RESOLVED', async () => {
    const resolvedTicket: Ticket = {
      ...sampleTicketDetail,
      status: 'RESOLVED',
      resolved_at: '2026-10-24T12:00:00Z',
    };
    vi.mocked(updateTicketStatus).mockResolvedValue(resolvedTicket);

    render(
      <TicketDetailContent
        ticketId="tkt-100"
        user={mockUser}
        initialTicket={sampleTicketDetail}
      />
    );

    // Change status select to RESOLVED
    const statusSelect = screen.getByTestId('status-select');
    fireEvent.change(statusSelect, { target: { value: 'RESOLVED' } });

    const updateButton = screen.getByTestId('update-status-button');
    fireEvent.click(updateButton);

    // Verify CSAT Modal opens after transitioning to RESOLVED
    await waitFor(() => {
      expect(screen.getByTestId('csat-modal')).toBeInTheDocument();
    });
  });

  it('submits CSAT feedback survey via CSAT modal', async () => {
    const csatRes: CSATResponse = {
      id: 'csat-001',
      ticket_id: 'tkt-100',
      rating: 5,
      feedback_text: 'Excellent fast resolution by support team!',
      user_id: 'usr-client-1',
      submitted_at: '2026-10-24T12:05:00Z',
    };
    vi.mocked(submitCSAT).mockResolvedValue(csatRes);

    const resolvedDetail: TicketDetail = {
      ...sampleTicketDetail,
      status: 'RESOLVED',
    };

    render(
      <TicketDetailContent
        ticketId="tkt-100"
        user={mockUser}
        initialTicket={resolvedDetail}
      />
    );

    // Click CSAT prompt button
    const csatBtn = screen.getByTestId('open-csat-modal-button');
    fireEvent.click(csatBtn);

    expect(screen.getByTestId('csat-modal')).toBeInTheDocument();

    // Select star 5
    const star5 = screen.getByTestId('star-rating-5');
    fireEvent.click(star5);

    // Add feedback text
    const feedbackInput = screen.getByTestId('csat-feedback-input');
    fireEvent.change(feedbackInput, { target: { value: 'Excellent fast resolution by support team!' } });

    // Submit CSAT
    const submitBtn = screen.getByTestId('submit-csat-button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitCSAT).toHaveBeenCalledWith('tkt-100', {
        rating: 5,
        feedback_text: 'Excellent fast resolution by support team!',
      });
      expect(screen.getByTestId('csat-submitted-badge')).toBeInTheDocument();
    });
  });

  it('deletes ticket and redirects to /tickets on confirm', async () => {
    vi.mocked(deleteTicket).mockResolvedValue();

    render(
      <TicketDetailContent
        ticketId="tkt-100"
        user={mockUser}
        initialTicket={sampleTicketDetail}
      />
    );

    const deleteBtn = screen.getByTestId('delete-ticket-button');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteTicket).toHaveBeenCalledWith('tkt-100');
      expect(mockPush).toHaveBeenCalledWith('/tickets');
    });
  });

  it('renders error banner when ticket fetch fails', async () => {
    vi.mocked(getTicketDetail).mockRejectedValue(new Error('Ticket record not found.'));

    render(
      <TicketDetailPage
        ticketId="tkt-missing"
        user={mockUser}
        autoFetch={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toHaveTextContent('Ticket record not found.');
    });
  });
});
