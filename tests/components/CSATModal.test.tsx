import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CSATModal, getRatingLabel } from '../../src/components/tickets/CSATModal';
import { Ticket, CSATResponse } from '../../src/services/tickets';

describe('CSATModal Utilities', () => {
  it('returns human-readable satisfaction labels for 1-5 ratings', () => {
    expect(getRatingLabel(1)).toBe('Very Dissatisfied');
    expect(getRatingLabel(2)).toBe('Dissatisfied');
    expect(getRatingLabel(3)).toBe('Neutral');
    expect(getRatingLabel(4)).toBe('Satisfied');
    expect(getRatingLabel(5)).toBe('Very Satisfied');
    expect(getRatingLabel(0)).toBe('Select a rating');
    expect(getRatingLabel(6)).toBe('Select a rating');
  });
});

describe('CSATModal Component', () => {
  const mockTicket: Ticket = {
    id: 'ticket-999',
    title: 'VPN Connection Failure',
    description: 'Unable to connect to internal corporate network',
    severity: 'P1',
    status: 'RESOLVED',
    escalation_tier: 1,
    organization_id: 'org-123',
    creator_user_id: 'user-abc',
    response_due_at: '2026-10-24T12:00:00Z',
    resolution_due_at: '2026-10-24T16:00:00Z',
    is_sla_breached: false,
    created_at: '2026-10-24T10:00:00Z',
    updated_at: '2026-10-24T14:00:00Z',
    resolved_at: '2026-10-24T14:00:00Z',
  };

  const mockCSATResponse: CSATResponse = {
    id: 'csat-101',
    ticket_id: 'ticket-999',
    rating: 5,
    feedback_text: 'Excellent and fast resolution!',
    user_id: 'user-abc',
    submitted_at: '2026-10-24T14:05:00Z',
  };

  let mockClose: ReturnType<typeof vi.fn>;
  let mockSubmit: ReturnType<typeof vi.fn>;
  let mockSuccess: ReturnType<typeof vi.fn>;
  let mockTicketsService: any;

  beforeEach(() => {
    mockClose = vi.fn();
    mockSubmit = vi.fn().mockResolvedValue(mockCSATResponse);
    mockSuccess = vi.fn();
    mockTicketsService = {
      submitCSAT: vi.fn().mockResolvedValue(mockCSATResponse),
    };
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CSATModal ticketId="ticket-999" isOpen={false} onClose={mockClose} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders CSAT survey modal when isOpen is true', () => {
    render(
      <CSATModal
        ticket={mockTicket}
        isOpen={true}
        onClose={mockClose}
      />
    );

    expect(screen.getByTestId('csat-modal')).toBeInTheDocument();
    expect(screen.getByText('How was your support experience?')).toBeInTheDocument();
    expect(screen.getByTestId('csat-ticket-title')).toHaveTextContent('VPN Connection Failure');
    expect(screen.getByTestId('csat-submit-button')).toBeInTheDocument();

    // Check 5 rating stars are present
    for (let star = 1; star <= 5; star++) {
      expect(screen.getByTestId(`csat-rating-star-${star}`)).toBeInTheDocument();
    }
  });

  it('updates selected rating and label on star click and hover', () => {
    render(
      <CSATModal
        ticketId="ticket-999"
        isOpen={true}
        onClose={mockClose}
      />
    );

    const star4 = screen.getByTestId('csat-rating-star-4');
    const labelContainer = screen.getByTestId('csat-rating-label');

    // Hover over star 4
    fireEvent.mouseEnter(star4);
    expect(labelContainer).toHaveTextContent('Satisfied');

    // Leave hover
    fireEvent.mouseLeave(screen.getByTestId('csat-rating-stars-container'));
    expect(labelContainer).toHaveTextContent('Select a rating');

    // Click star 5
    fireEvent.click(screen.getByTestId('csat-rating-star-5'));
    expect(labelContainer).toHaveTextContent('Very Satisfied');
  });

  it('displays error message when trying to submit without selecting a rating', async () => {
    render(
      <CSATModal
        ticketId="ticket-999"
        isOpen={true}
        onClose={mockClose}
        onSubmit={mockSubmit}
      />
    );

    const submitBtn = screen.getByTestId('csat-submit-button');
    fireEvent.click(submitBtn);

    expect(await screen.findByTestId('csat-error-alert')).toHaveTextContent(
      'Please select a rating between 1 and 5 stars before submitting.'
    );
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('successfully submits feedback via onSubmit callback prop', async () => {
    render(
      <CSATModal
        ticket={mockTicket}
        isOpen={true}
        onClose={mockClose}
        onSubmit={mockSubmit}
        onSuccess={mockSuccess}
      />
    );

    // Select star 5
    fireEvent.click(screen.getByTestId('csat-rating-star-5'));

    // Type optional comment
    const feedbackInput = screen.getByTestId('csat-feedback-input');
    fireEvent.change(feedbackInput, { target: { value: 'Great service from agent!' } });

    // Submit form
    const submitBtn = screen.getByTestId('csat-submit-button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(5, 'Great service from agent!');
    });

    // Check success screen state
    expect(await screen.findByTestId('csat-success-state')).toBeInTheDocument();
    expect(screen.getByText('Thank You for Your Feedback!')).toBeInTheDocument();
    expect(mockSuccess).toHaveBeenCalledWith(mockCSATResponse);

    // Click done button
    fireEvent.click(screen.getByTestId('csat-success-close-button'));
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('submits CSAT survey using default ticketsService when no onSubmit callback is passed', async () => {
    render(
      <CSATModal
        ticketId="ticket-999"
        isOpen={true}
        onClose={mockClose}
        ticketsService={mockTicketsService}
        onSuccess={mockSuccess}
      />
    );

    // Select star 4
    fireEvent.click(screen.getByTestId('csat-rating-star-4'));

    // Submit form
    fireEvent.click(screen.getByTestId('csat-submit-button'));

    await waitFor(() => {
      expect(mockTicketsService.submitCSAT).toHaveBeenCalledWith('ticket-999', {
        rating: 4,
        feedback_text: undefined,
      });
    });

    expect(await screen.findByTestId('csat-success-state')).toBeInTheDocument();
  });

  it('displays API error message when submission fails', async () => {
    const failedTicketsService = {
      submitCSAT: vi.fn().mockRejectedValue(new Error('Network error submitting feedback')),
    };

    render(
      <CSATModal
        ticketId="ticket-999"
        isOpen={true}
        onClose={mockClose}
        ticketsService={failedTicketsService as any}
      />
    );

    // Select star 3
    fireEvent.click(screen.getByTestId('csat-rating-star-3'));
    fireEvent.click(screen.getByTestId('csat-submit-button'));

    expect(await screen.findByTestId('csat-error-alert')).toHaveTextContent(
      'Network error submitting feedback'
    );
  });

  it('closes modal when close button, cancel button, backdrop, or ESC key is clicked/pressed', () => {
    const { rerender } = render(
      <CSATModal
        ticketId="ticket-999"
        isOpen={true}
        onClose={mockClose}
      />
    );

    // Click close icon button
    fireEvent.click(screen.getByTestId('csat-close-button'));
    expect(mockClose).toHaveBeenCalledTimes(1);

    mockClose.mockClear();

    // Click Skip for now button
    fireEvent.click(screen.getByTestId('csat-cancel-button'));
    expect(mockClose).toHaveBeenCalledTimes(1);

    mockClose.mockClear();

    // Backdrop click
    fireEvent.click(screen.getByTestId('csat-modal'));
    expect(mockClose).toHaveBeenCalledTimes(1);

    mockClose.mockClear();

    // ESC key press
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('respects initialRating and initialFeedback props', () => {
    render(
      <CSATModal
        ticketId="ticket-999"
        isOpen={true}
        initialRating={4}
        initialFeedback="Initial comment"
        onClose={mockClose}
      />
    );

    expect(screen.getByTestId('csat-rating-label')).toHaveTextContent('Satisfied');
    expect(screen.getByTestId('csat-feedback-input')).toHaveValue('Initial comment');
  });
});
