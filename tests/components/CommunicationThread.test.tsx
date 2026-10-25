import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  CommunicationThread,
  sortEventsChronologically,
  formatEventTimestamp,
  formatFileSize,
  validateAttachmentFile,
  getEventTypeBadge,
  MAX_ATTACHMENT_SIZE_BYTES,
} from '../../src/components/tickets/CommunicationThread';
import { TicketEvent } from '../../src/services/tickets';

describe('CommunicationThread Utilities', () => {
  it('sorts events chronologically ascending and descending', () => {
    const events: TicketEvent[] = [
      {
        id: 'event-3',
        ticket_id: 't-1',
        author_id: 'agent-1',
        event_type: 'COMMENT',
        content: 'Latest comment',
        created_at: '2026-10-24T12:00:00Z',
      },
      {
        id: 'event-1',
        ticket_id: 't-1',
        author_id: 'user-1',
        event_type: 'TICKET_CREATED',
        content: 'Created ticket',
        created_at: '2026-10-24T10:00:00Z',
      },
      {
        id: 'event-2',
        ticket_id: 't-1',
        author_id: 'system',
        event_type: 'STATUS_CHANGE',
        content: 'Status changed',
        created_at: '2026-10-24T11:00:00Z',
      },
    ];

    const sortedAsc = sortEventsChronologically(events, true);
    expect(sortedAsc.map((e) => e.id)).toEqual(['event-1', 'event-2', 'event-3']);

    const sortedDesc = sortEventsChronologically(events, false);
    expect(sortedDesc.map((e) => e.id)).toEqual(['event-3', 'event-2', 'event-1']);
  });

  it('formats ISO timestamps cleanly', () => {
    expect(formatEventTimestamp(null)).toBe('Unknown date');
    expect(formatEventTimestamp(undefined)).toBe('Unknown date');
    expect(formatEventTimestamp('invalid-date')).toBe('invalid-date');

    const formatted = formatEventTimestamp('2026-10-24T10:30:00Z');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('Oct');
  });

  it('formats raw file byte counts into readable units', () => {
    expect(formatFileSize(0)).toBe('');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(1048576 * 5)).toBe('5.0 MB');
  });

  it('validates file size against maximum limit (25MB)', () => {
    expect(validateAttachmentFile(null).valid).toBe(true);

    const smallFile = new File(['a'.repeat(100)], 'small.txt', { type: 'text/plain' });
    expect(validateAttachmentFile(smallFile).valid).toBe(true);

    // Create mock file over 25MB limit
    const hugeFile = {
      name: 'large_video.mp4',
      size: MAX_ATTACHMENT_SIZE_BYTES + 1024,
      type: 'video/mp4',
    } as File;

    const result = validateAttachmentFile(hugeFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum allowed attachment size of 25MB');
  });

  it('returns badge metadata for all ticket event types', () => {
    expect(getEventTypeBadge('TICKET_CREATED').label).toBe('Created');
    expect(getEventTypeBadge('COMMENT').label).toBe('Comment');
    expect(getEventTypeBadge('STATUS_CHANGE').label).toBe('Status Update');
    expect(getEventTypeBadge('ESCALATION_TRIGGERED').label).toBe('Escalated');
    expect(getEventTypeBadge('ATTACHMENT_ADDED').label).toBe('Attachment');
    expect(getEventTypeBadge('CSAT_SUBMITTED').label).toBe('CSAT Survey');
    expect(getEventTypeBadge('CUSTOM_EVENT').label).toBe('CUSTOM_EVENT');
  });
});

describe('CommunicationThread Component', () => {
  const mockEvents: TicketEvent[] = [
    {
      id: 'evt-1',
      ticket_id: 'ticket-101',
      author_id: 'customer-1',
      event_type: 'TICKET_CREATED',
      content: 'Server responsiveness issue in region us-east',
      created_at: '2026-10-24T08:00:00Z',
    },
    {
      id: 'evt-2',
      ticket_id: 'ticket-101',
      author_id: 'agent-42',
      event_type: 'COMMENT',
      content: 'Investigating load balance distribution.',
      attachment_url: '/uploads/logs.txt',
      attachment_filename: 'logs.txt',
      created_at: '2026-10-24T08:30:00Z',
    },
    {
      id: 'evt-3',
      ticket_id: 'ticket-101',
      author_id: 'system',
      event_type: 'ESCALATION_TRIGGERED',
      content: 'Ticket escalated to Tier 2 engineering team.',
      created_at: '2026-10-24T09:00:00Z',
    },
  ];

  it('renders chronological feed with event items and author details', () => {
    render(
      <CommunicationThread
        ticketId="ticket-101"
        events={mockEvents}
        currentUserId="customer-1"
      />
    );

    expect(screen.getByText('Communication Feed & Audit Trail')).toBeInTheDocument();
    expect(screen.getByText('3 events')).toBeInTheDocument();

    const items = screen.getAllByTestId('event-item');
    expect(items.length).toBe(3);

    expect(screen.getByText('customer-1 (You)')).toBeInTheDocument();
    expect(screen.getByText('agent-42')).toBeInTheDocument();
    expect(screen.getByText('system')).toBeInTheDocument();

    expect(screen.getByText('Investigating load balance distribution.')).toBeInTheDocument();
    expect(screen.getByText('logs.txt')).toBeInTheDocument();
    expect(screen.getByText('Download ⬇')).toBeInTheDocument();
  });

  it('renders empty state when no events are provided', () => {
    render(<CommunicationThread ticketId="ticket-101" events={[]} />);

    expect(screen.getByTestId('communication-thread-empty')).toBeInTheDocument();
    expect(
      screen.getByText('No events recorded yet for this support ticket.')
    ).toBeInTheDocument();
  });

  it('renders loading state when isLoading is true', () => {
    render(<CommunicationThread ticketId="ticket-101" isLoading={true} />);

    expect(screen.getByTestId('communication-thread-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading activity log...')).toBeInTheDocument();
  });

  it('toggles sort order between oldest first and newest first', () => {
    render(<CommunicationThread ticketId="ticket-101" events={mockEvents} />);

    const sortButton = screen.getByTestId('sort-toggle-button');
    expect(sortButton).toHaveTextContent('Oldest First');

    let items = screen.getAllByTestId('event-item');
    expect(items[0]).toHaveAttribute('data-event-id', 'evt-1');

    fireEvent.click(sortButton);

    expect(sortButton).toHaveTextContent('Newest First');
    items = screen.getAllByTestId('event-item');
    expect(items[0]).toHaveAttribute('data-event-id', 'evt-3');
  });

  it('allows user to submit a text comment reply', async () => {
    const handleAddReply = vi.fn().mockResolvedValue({
      id: 'evt-4',
      ticket_id: 'ticket-101',
      author_id: 'current-user',
      event_type: 'COMMENT',
      content: 'Thanks for looking into this.',
      created_at: new Date().toISOString(),
    });

    render(
      <CommunicationThread
        ticketId="ticket-101"
        events={mockEvents}
        onAddReply={handleAddReply}
      />
    );

    const textarea = screen.getByTestId('reply-textarea');
    const submitButton = screen.getByTestId('submit-reply-button');

    expect(submitButton).toBeDisabled();

    fireEvent.change(textarea, { target: { value: 'Thanks for looking into this.' } });
    expect(submitButton).not.toBeDisabled();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(handleAddReply).toHaveBeenCalledWith({
        content: 'Thanks for looking into this.',
      });
    });

    expect(textarea).toHaveValue('');
  });

  it('allows user to attach a valid file and post a reply', async () => {
    const handleAddReply = vi.fn().mockResolvedValue(undefined);

    render(
      <CommunicationThread
        ticketId="ticket-101"
        events={mockEvents}
        onAddReply={handleAddReply}
      />
    );

    const fileInput = screen.getByTestId('reply-file-input');
    const validFile = new File(['log data'], 'app_diagnostics.log', {
      type: 'text/plain',
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    expect(screen.getByTestId('selected-file-chip')).toBeInTheDocument();
    expect(screen.getByText('app_diagnostics.log')).toBeInTheDocument();

    const submitButton = screen.getByTestId('submit-reply-button');
    expect(submitButton).not.toBeDisabled();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(handleAddReply).toHaveBeenCalledWith({
        file: validFile,
      });
    });

    expect(screen.queryByTestId('selected-file-chip')).not.toBeInTheDocument();
  });

  it('displays error and disables submit when file exceeds 25MB', () => {
    render(<CommunicationThread ticketId="ticket-101" events={mockEvents} />);

    const fileInput = screen.getByTestId('reply-file-input');
    const hugeFile = {
      name: 'large_dump.zip',
      size: MAX_ATTACHMENT_SIZE_BYTES + 5000,
      type: 'application/zip',
    } as File;

    fireEvent.change(fileInput, { target: { files: [hugeFile] } });

    const errorMessage = screen.getByTestId('reply-error-message');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveTextContent('exceeds maximum allowed attachment size of 25MB');

    const submitButton = screen.getByTestId('submit-reply-button');
    expect(submitButton).toBeDisabled();
  });

  it('renders disabled state when disabled prop is true', () => {
    render(
      <CommunicationThread
        ticketId="ticket-101"
        events={mockEvents}
        disabled={true}
      />
    );

    expect(screen.getByTestId('reply-disabled-banner')).toBeInTheDocument();
    expect(
      screen.getByText('Comments and replies are disabled for this ticket.')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('reply-form')).not.toBeInTheDocument();
  });

  it('handles and displays submit error when onAddReply fails', async () => {
    const handleAddReply = vi.fn().mockRejectedValue(new Error('Network error posting reply'));

    render(
      <CommunicationThread
        ticketId="ticket-101"
        events={mockEvents}
        onAddReply={handleAddReply}
      />
    );

    const textarea = screen.getByTestId('reply-textarea');
    fireEvent.change(textarea, { target: { value: 'Test failing comment' } });

    const submitButton = screen.getByTestId('submit-reply-button');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByTestId('reply-error-message')).toHaveTextContent(
        'Network error posting reply'
      );
    });
  });
});
