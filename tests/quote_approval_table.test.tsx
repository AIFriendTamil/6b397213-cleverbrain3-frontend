import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  QuoteApprovalTable,
  formatCurrency,
  formatDate,
  calculateQuoteMetrics,
  getQuoteStatusBadge,
  DEFAULT_MOCK_QUOTES,
} from '../src/components/financial/QuoteApprovalTable';
import { Quote } from '../src/services/financialApi';

// Mock financialApi service calls
vi.mock('../src/services/financialApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/financialApi')>();
  return {
    ...actual,
    processQuoteApproval: vi.fn().mockResolvedValue({
      id: 'q-101',
      account_id: 'acc-acme-corp',
      title: 'Enterprise Platform Subscription & Onboarding',
      status: 'APPROVED',
      total_amount: 145000,
      created_at: '2026-10-22T09:30:00Z',
      updated_at: '2026-10-22T10:15:00Z',
      approval_steps: [],
      approvals: [],
    }),
    submitQuoteForApproval: vi.fn().mockResolvedValue({
      id: 'q-103',
      account_id: 'acc-stark-tech',
      title: 'Multi-Region Infrastructure Expansion Package',
      status: 'PENDING_APPROVAL',
      total_amount: 210000,
      created_at: '2026-10-23T08:45:00Z',
      updated_at: '2026-10-23T08:45:00Z',
      approval_steps: [],
      approvals: [],
    }),
    createQuote: vi.fn().mockResolvedValue({
      id: 'q-999',
      account_id: 'acc-new-corp',
      title: 'Brand New Quote Title',
      status: 'DRAFT',
      total_amount: 95000,
      created_at: '2026-10-24T12:00:00Z',
      updated_at: '2026-10-24T12:00:00Z',
      approval_steps: [],
      approvals: [],
    }),
    deleteQuote: vi.fn().mockResolvedValue(undefined),
  };
});

describe('QuoteApprovalTable Component & Helper Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Formatter and Helper Functions', () => {
    it('formats monetary values correctly', () => {
      expect(formatCurrency(145000)).toBe('$145,000');
      expect(formatCurrency(68500.5)).toBe('$68,500.5');
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(null)).toBe('$0');
      expect(formatCurrency(undefined)).toBe('$0');
    });

    it('formats ISO timestamps to friendly dates', () => {
      expect(formatDate('2026-10-22T09:30:00Z')).toContain('2026');
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate(undefined)).toBe('N/A');
    });

    it('calculates aggregate metrics across quotes correctly', () => {
      const summary = calculateQuoteMetrics(DEFAULT_MOCK_QUOTES);
      expect(summary.totalCount).toBe(4);
      expect(summary.totalAmount).toBe(145000 + 68500 + 210000 + 32000); // 455500
      expect(summary.pendingCount).toBe(1);
      expect(summary.approvedCount).toBe(1);
      expect(summary.draftCount).toBe(1);
      expect(summary.rejectedCount).toBe(1);
      expect(summary.pendingAmount).toBe(145000);
      expect(summary.approvedAmount).toBe(68500);
    });

    it('returns appropriate badge styling configurations', () => {
      expect(getQuoteStatusBadge('APPROVED').label).toBe('Approved');
      expect(getQuoteStatusBadge('PENDING_APPROVAL').label).toBe('Pending Approval');
      expect(getQuoteStatusBadge('REJECTED').label).toBe('Rejected');
      expect(getQuoteStatusBadge('DRAFT').label).toBe('Draft');
    });
  });

  describe('Component Rendering', () => {
    it('renders component header, KPI cards, and default quotes table', () => {
      render(<QuoteApprovalTable quotes={DEFAULT_MOCK_QUOTES} />);

      expect(screen.getByText('Quote Status & Approval Decisions')).toBeInTheDocument();
      expect(screen.getByTestId('quote-approval-table-metrics')).toBeInTheDocument();

      expect(screen.getByTestId('quote-approval-table-kpi-total')).toHaveTextContent('4');
      expect(screen.getByTestId('quote-approval-table-kpi-pending')).toHaveTextContent('1');
      expect(screen.getByTestId('quote-approval-table-kpi-approved')).toHaveTextContent('1');

      expect(screen.getByTestId('quote-approval-table-row-q-101')).toBeInTheDocument();
      expect(screen.getByTestId('quote-approval-table-row-q-102')).toBeInTheDocument();
      expect(screen.getByTestId('quote-approval-table-row-q-103')).toBeInTheDocument();
      expect(screen.getByTestId('quote-approval-table-row-q-104')).toBeInTheDocument();
    });

    it('renders loading indicator when isLoading prop is true', () => {
      render(<QuoteApprovalTable isLoading={true} />);
      expect(screen.getByTestId('quote-approval-table-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading commercial quotes and approval workflows...')).toBeInTheDocument();
    });

    it('renders error message banner when error prop is passed', () => {
      render(<QuoteApprovalTable error="Failed to connect to API endpoint" />);
      expect(screen.getByTestId('quote-approval-table-error')).toHaveTextContent('Failed to connect to API endpoint');
    });
  });

  describe('Filtering and Searching', () => {
    it('filters quote rows by status selection button', () => {
      render(<QuoteApprovalTable quotes={DEFAULT_MOCK_QUOTES} />);

      // Filter Pending Approval
      const pendingFilterBtn = screen.getByTestId('quote-approval-table-filter-pending_approval');
      fireEvent.click(pendingFilterBtn);

      expect(screen.getByTestId('quote-approval-table-row-q-101')).toBeInTheDocument();
      expect(screen.queryByTestId('quote-approval-table-row-q-102')).not.toBeInTheDocument();
      expect(screen.queryByTestId('quote-approval-table-row-q-103')).not.toBeInTheDocument();

      // Filter Approved
      const approvedFilterBtn = screen.getByTestId('quote-approval-table-filter-approved');
      fireEvent.click(approvedFilterBtn);

      expect(screen.queryByTestId('quote-approval-table-row-q-101')).not.toBeInTheDocument();
      expect(screen.getByTestId('quote-approval-table-row-q-102')).toBeInTheDocument();
    });

    it('filters quote rows by search query input', () => {
      render(<QuoteApprovalTable quotes={DEFAULT_MOCK_QUOTES} />);

      const searchInput = screen.getByTestId('quote-approval-table-search-input');
      fireEvent.change(searchInput, { target: { value: 'stark-tech' } });

      expect(screen.queryByTestId('quote-approval-table-row-q-101')).not.toBeInTheDocument();
      expect(screen.getByTestId('quote-approval-table-row-q-103')).toBeInTheDocument();
    });

    it('displays empty state message when search query yields no matches', () => {
      render(<QuoteApprovalTable quotes={DEFAULT_MOCK_QUOTES} />);

      const searchInput = screen.getByTestId('quote-approval-table-search-input');
      fireEvent.change(searchInput, { target: { value: 'nonexistent-query-xyz' } });

      expect(screen.getByTestId('quote-approval-table-empty')).toHaveTextContent('No quotes found matching criteria.');
    });
  });

  describe('Multi-Step Approval Sequence and Decision Actions', () => {
    it('expands row to reveal multi-step approval workflow sequence', () => {
      render(<QuoteApprovalTable quotes={DEFAULT_MOCK_QUOTES} />);

      const expandBtn = screen.getByTestId('quote-approval-table-row-expand-btn-q-101');
      fireEvent.click(expandBtn);

      expect(screen.getByTestId('quote-approval-table-details-q-101')).toBeInTheDocument();
      expect(screen.getByText('Multi-Step Approval Sequence')).toBeInTheDocument();

      // Step 1 approved, Step 2 pending, Step 3 pending
      expect(screen.getByTestId('quote-approval-table-step-step-101-1')).toHaveTextContent('✓ Approved');
      expect(screen.getByTestId('quote-approval-table-step-step-101-2')).toHaveTextContent('⏱ Pending');
      expect(screen.getByTestId('quote-approval-table-step-step-101-3')).toHaveTextContent('⏱ Pending');
    });

    it('handles submitting an approval decision on active pending step via callback', async () => {
      const handleApproveStep = vi.fn().mockResolvedValue(undefined);
      render(<QuoteApprovalTable quotes={DEFAULT_MOCK_QUOTES} onApproveStep={handleApproveStep} />);

      // Expand q-101 row (Step 2 is pending)
      fireEvent.click(screen.getByTestId('quote-approval-table-row-expand-btn-q-101'));

      const commentInput = screen.getByTestId('quote-approval-table-comment-input-q-101');
      fireEvent.change(commentInput, { target: { value: 'Commercial terms look solid.' } });

      const submitBtn = screen.getByTestId('quote-approval-table-submit-decision-btn-q-101');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleApproveStep).toHaveBeenCalledWith('q-101', {
          step_number: 2,
          decision: 'APPROVED',
          comment: 'Commercial terms look solid.',
          approver_id: 'mgr-finance-01',
        });
      });
    });

    it('handles submitting a rejection decision on active pending step', async () => {
      const handleApproveStep = vi.fn().mockResolvedValue(undefined);
      render(<QuoteApprovalTable quotes={DEFAULT_MOCK_QUOTES} onApproveStep={handleApproveStep} />);

      // Expand q-101 row
      fireEvent.click(screen.getByTestId('quote-approval-table-row-expand-btn-q-101'));

      // Click Reject button option
      const rejectOptionBtn = screen.getByTestId('quote-approval-table-reject-btn-q-101');
      fireEvent.click(rejectOptionBtn);

      const submitBtn = screen.getByTestId('quote-approval-table-submit-decision-btn-q-101');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleApproveStep).toHaveBeenCalledWith('q-101', {
          step_number: 2,
          decision: 'REJECTED',
          comment: undefined,
          approver_id: 'mgr-finance-01',
        });
      });
    });

    it('submits a Draft quote for multi-step approval sequence', async () => {
      const handleSubmitApproval = vi.fn().mockResolvedValue(undefined);
      render(<QuoteApprovalTable quotes={DEFAULT_MOCK_QUOTES} onSubmitForApproval={handleSubmitApproval} />);

      // Expand draft quote q-103
      fireEvent.click(screen.getByTestId('quote-approval-table-row-expand-btn-q-103'));

      const submitApprovalBtn = screen.getByTestId('quote-approval-table-submit-approval-btn-q-103');
      fireEvent.click(submitApprovalBtn);

      await waitFor(() => {
        expect(handleSubmitApproval).toHaveBeenCalledWith('q-103', {
          approver_ids: ['mgr-finance-01', 'vp-commercial-02'],
        });
      });
    });
  });

  describe('New Quote Creation & Deletion', () => {
    it('opens create quote modal and submits new quote form', async () => {
      const handleCreateQuote = vi.fn().mockResolvedValue(undefined);
      render(<QuoteApprovalTable quotes={DEFAULT_MOCK_QUOTES} onCreateQuote={handleCreateQuote} />);

      const createBtn = screen.getByTestId('quote-approval-table-create-quote-btn');
      fireEvent.click(createBtn);

      expect(screen.getByTestId('quote-approval-table-new-quote-modal')).toBeInTheDocument();

      const titleInput = screen.getByPlaceholderText('e.g. Enterprise Software License Q4');
      const accountInput = screen.getByPlaceholderText('e.g. acc-acme-corp');
      const amountInput = screen.getByPlaceholderText('e.g. 125000');

      fireEvent.change(titleInput, { target: { value: 'New Custom License Proposal' } });
      fireEvent.change(accountInput, { target: { value: 'acc-new-customer' } });
      fireEvent.change(amountInput, { target: { value: '95000' } });

      const submitModalBtn = screen.getByText('Create Quote');
      fireEvent.click(submitModalBtn);

      await waitFor(() => {
        expect(handleCreateQuote).toHaveBeenCalledWith({
          account_id: 'acc-new-customer',
          title: 'New Custom License Proposal',
          total_amount: 95000,
          approver_ids: ['mgr-finance-01', 'vp-commercial-02'],
        });
      });
    });

    it('handles quote deletion for draft quotes', async () => {
      const handleDeleteQuote = vi.fn().mockResolvedValue(undefined);
      window.confirm = vi.fn().mockReturnValue(true);

      render(<QuoteApprovalTable quotes={DEFAULT_MOCK_QUOTES} onDeleteQuote={handleDeleteQuote} />);

      const deleteBtn = screen.getByTestId('quote-approval-table-delete-btn-q-103');
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(handleDeleteQuote).toHaveBeenCalledWith('q-103');
      });
    });
  });
});
