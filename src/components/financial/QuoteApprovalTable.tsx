'use client';

import React, { useState, useEffect } from 'react';
import {
  Quote,
  QuoteStatus,
  QuoteApprovalStep,
  QuoteApprovalDecisionPayload,
  QuoteSubmitPayload,
  QuoteCreatePayload,
  processQuoteApproval,
  submitQuoteForApproval,
  createQuote,
  deleteQuote,
} from '../../services/financialApi';

export interface QuoteApprovalTableProps {
  /** Array of quote entity objects from the API */
  quotes?: Quote[] | null;
  /** Currently selected/active quote ID */
  selectedQuoteId?: string | null;
  /** Callback fired when a quote row is clicked or selected */
  onQuoteSelect?: (quoteId: string | null) => void;
  /** Callback fired when a manager submits an approval decision (Approve or Reject) */
  onApproveStep?: (quoteId: string, payload: QuoteApprovalDecisionPayload) => Promise<void> | void;
  /** Callback fired when a quote is submitted for multi-step approval */
  onSubmitForApproval?: (quoteId: string, payload: QuoteSubmitPayload) => Promise<void> | void;
  /** Callback fired when a new quote is created */
  onCreateQuote?: (payload: QuoteCreatePayload) => Promise<void> | void;
  /** Callback fired when a quote is deleted */
  onDeleteQuote?: (quoteId: string) => Promise<void> | void;
  /** Callback fired to trigger a manual data refresh */
  onRefresh?: () => void;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Error message string if data fetching failed */
  error?: string | null;
  /** Currently selected status filter option */
  statusFilter?: QuoteStatus | 'ALL';
  /** Callback fired when status filter selection changes */
  onStatusFilterChange?: (status: QuoteStatus | 'ALL') => void;
  /** Optional ID of current user for approver matching */
  currentUserId?: string | null;
  /** Custom CSS class name override */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Summary metrics aggregated across quote entities.
 */
export interface QuoteMetricsSummary {
  totalCount: number;
  totalAmount: number;
  draftCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingAmount: number;
  approvedAmount: number;
}

/**
 * Format raw numeric amount into currency string ($145,000).
 */
export function formatCurrency(
  amount: number | undefined | null,
  currencyCode: string = 'USD'
): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '$0';
  }
  const symbol = currencyCode === 'EUR' ? '€' : currencyCode === 'GBP' ? '£' : '$';
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${isNegative ? '-' : ''}${symbol}${formatted}`;
}

/**
 * Format ISO timestamp or date string into human-friendly date.
 */
export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Calculate KPI aggregate metrics across a set of quotes.
 */
export function calculateQuoteMetrics(quotes: Quote[] | null | undefined): QuoteMetricsSummary {
  if (!quotes || quotes.length === 0) {
    return {
      totalCount: 0,
      totalAmount: 0,
      draftCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      pendingAmount: 0,
      approvedAmount: 0,
    };
  }

  return quotes.reduce(
    (acc, q) => {
      const amount = Number(q.total_amount) || 0;
      acc.totalCount += 1;
      acc.totalAmount += amount;

      const status = (q.status || '').toUpperCase();
      if (status === 'DRAFT') {
        acc.draftCount += 1;
      } else if (status === 'PENDING_APPROVAL' || status === 'PENDING') {
        acc.pendingCount += 1;
        acc.pendingAmount += amount;
      } else if (status === 'APPROVED') {
        acc.approvedCount += 1;
        acc.approvedAmount += amount;
      } else if (status === 'REJECTED') {
        acc.rejectedCount += 1;
      }

      return acc;
    },
    {
      totalCount: 0,
      totalAmount: 0,
      draftCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      pendingAmount: 0,
      approvedAmount: 0,
    }
  );
}

/**
 * Configuration for quote status badge rendering adhering to Linen & Logic design system.
 */
export function getQuoteStatusBadge(status: string | undefined | null): {
  label: string;
  bgColor: string;
  color: string;
  borderColor: string;
} {
  const normalized = (status || '').toUpperCase();
  switch (normalized) {
    case 'APPROVED':
      return {
        label: 'Approved',
        bgColor: 'var(--color-trend-up-bg, #e8f5e9)',
        color: 'var(--color-trend-up, #2e6b38)',
        borderColor: '#a7f3d0',
      };
    case 'PENDING_APPROVAL':
    case 'PENDING':
      return {
        label: 'Pending Approval',
        bgColor: '#fef3c7',
        color: '#92400e',
        borderColor: '#fde68a',
      };
    case 'REJECTED':
      return {
        label: 'Rejected',
        bgColor: 'var(--color-trend-down-bg, #fdf0ed)',
        color: 'var(--color-trend-down, #a43b2c)',
        borderColor: '#fecaca',
      };
    case 'DRAFT':
    default:
      return {
        label: 'Draft',
        bgColor: 'var(--color-surface-container-high, #eae8e3)',
        color: 'var(--color-on-surface-variant, #4e453d)',
        borderColor: 'var(--color-outline-variant, #d1c4b9)',
      };
  }
}

/**
 * Fallback initial mock quote records for standalone or fallback rendering.
 */
export const DEFAULT_MOCK_QUOTES: Quote[] = [
  {
    id: 'q-101',
    account_id: 'acc-acme-corp',
    title: 'Enterprise Platform Subscription & Onboarding',
    status: 'PENDING_APPROVAL',
    total_amount: 145000,
    created_at: '2026-10-22T09:30:00Z',
    updated_at: '2026-10-22T10:15:00Z',
    approval_steps: [
      {
        id: 'step-101-1',
        quote_id: 'q-101',
        approver_id: 'mgr-finance-01',
        step_number: 1,
        status: 'APPROVED',
        comment: 'Financial terms and discount verified within threshold.',
        decided_at: '2026-10-22T10:15:00Z',
        created_at: '2026-10-22T09:30:00Z',
        updated_at: '2026-10-22T10:15:00Z',
      },
      {
        id: 'step-101-2',
        quote_id: 'q-101',
        approver_id: 'vp-commercial-02',
        step_number: 2,
        status: 'PENDING',
        comment: null,
        decided_at: null,
        created_at: '2026-10-22T09:30:00Z',
        updated_at: '2026-10-22T09:30:00Z',
      },
      {
        id: 'step-101-3',
        quote_id: 'q-101',
        approver_id: 'exec-cfo-03',
        step_number: 3,
        status: 'PENDING',
        comment: null,
        decided_at: null,
        created_at: '2026-10-22T09:30:00Z',
        updated_at: '2026-10-22T09:30:00Z',
      },
    ],
    approvals: [],
  },
  {
    id: 'q-102',
    account_id: 'acc-globex-inc',
    title: 'Professional Services Custom Integration Retainer',
    status: 'APPROVED',
    total_amount: 68500,
    created_at: '2026-10-20T11:00:00Z',
    updated_at: '2026-10-21T14:20:00Z',
    approval_steps: [
      {
        id: 'step-102-1',
        quote_id: 'q-102',
        approver_id: 'mgr-finance-01',
        step_number: 1,
        status: 'APPROVED',
        comment: 'Budget confirmed.',
        decided_at: '2026-10-20T15:00:00Z',
        created_at: '2026-10-20T11:00:00Z',
        updated_at: '2026-10-20T15:00:00Z',
      },
      {
        id: 'step-102-2',
        quote_id: 'q-102',
        approver_id: 'vp-commercial-02',
        step_number: 2,
        status: 'APPROVED',
        comment: 'Commercial sign-off complete.',
        decided_at: '2026-10-21T14:20:00Z',
        created_at: '2026-10-20T11:00:00Z',
        updated_at: '2026-10-21T14:20:00Z',
      },
    ],
    approvals: [],
  },
  {
    id: 'q-103',
    account_id: 'acc-stark-tech',
    title: 'Multi-Region Infrastructure Expansion Package',
    status: 'DRAFT',
    total_amount: 210000,
    created_at: '2026-10-23T08:45:00Z',
    updated_at: '2026-10-23T08:45:00Z',
    approval_steps: [],
    approvals: [],
  },
  {
    id: 'q-104',
    account_id: 'acc-wayne-ent',
    title: 'Annual Software License Maintenance Renewal',
    status: 'REJECTED',
    total_amount: 32000,
    created_at: '2026-10-19T13:10:00Z',
    updated_at: '2026-10-20T09:00:00Z',
    approval_steps: [
      {
        id: 'step-104-1',
        quote_id: 'q-104',
        approver_id: 'mgr-finance-01',
        step_number: 1,
        status: 'REJECTED',
        comment: 'Requested payment schedule non-compliant with standard 30-day terms.',
        decided_at: '2026-10-20T09:00:00Z',
        created_at: '2026-10-19T13:10:00Z',
        updated_at: '2026-10-20T09:00:00Z',
      },
    ],
    approvals: [],
  },
];

/**
 * Quote status tracking and multi-step approval workflow table component.
 */
export const QuoteApprovalTable: React.FC<QuoteApprovalTableProps> = ({
  quotes: initialQuotes,
  selectedQuoteId,
  onQuoteSelect,
  onApproveStep,
  onSubmitForApproval,
  onCreateQuote,
  onDeleteQuote,
  onRefresh,
  isLoading = false,
  error = null,
  statusFilter: controlledStatusFilter,
  onStatusFilterChange,
  currentUserId,
  className = '',
  'data-testid': testId = 'quote-approval-table',
}) => {
  // Local state for interactive quotes list
  const [quotesList, setQuotesList] = useState<Quote[]>(() => {
    return initialQuotes && initialQuotes.length > 0 ? initialQuotes : DEFAULT_MOCK_QUOTES;
  });

  // Keep quotesList synced with prop when props change
  useEffect(() => {
    if (initialQuotes && Array.isArray(initialQuotes)) {
      setQuotesList(initialQuotes);
    }
  }, [initialQuotes]);

  // Filtering & Search
  const [internalStatusFilter, setInternalStatusFilter] = useState<QuoteStatus | 'ALL'>('ALL');
  const activeStatusFilter = controlledStatusFilter !== undefined ? controlledStatusFilter : internalStatusFilter;

  const [searchQuery, setSearchQuery] = useState<string>('');

  // Row expansion for details / approval form
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(selectedQuoteId || null);

  useEffect(() => {
    if (selectedQuoteId !== undefined) {
      setExpandedQuoteId(selectedQuoteId);
    }
  }, [selectedQuoteId]);

  // Decision Form state
  const [decisionType, setDecisionType] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [decisionComment, setDecisionComment] = useState<string>('');
  const [approverIdInput, setApproverIdInput] = useState<string>(currentUserId || 'mgr-finance-01');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Submit Approval Form state (for Draft or Rejected quotes)
  const [submitApproverIds, setSubmitApproverIds] = useState<string>('mgr-finance-01, vp-commercial-02');
  const [isSubmittingForApproval, setIsSubmittingForApproval] = useState<boolean>(false);
  const [submitApprovalError, setSubmitApprovalError] = useState<string | null>(null);

  // New Quote Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newQuoteTitle, setNewQuoteTitle] = useState<string>('');
  const [newQuoteAccountId, setNewQuoteAccountId] = useState<string>('');
  const [newQuoteAmount, setNewQuoteAmount] = useState<string>('');
  const [newQuoteApprovers, setNewQuoteApprovers] = useState<string>('mgr-finance-01, vp-commercial-02');
  const [isCreatingQuote, setIsCreatingQuote] = useState<boolean>(false);
  const [createQuoteError, setCreateQuoteError] = useState<string | null>(null);

  // Status Filter Handler
  const handleFilterChange = (status: QuoteStatus | 'ALL') => {
    if (onStatusFilterChange) {
      onStatusFilterChange(status);
    } else {
      setInternalStatusFilter(status);
    }
  };

  // Helper to extract approval steps from quote
  const getApprovalSteps = (quote: Quote): QuoteApprovalStep[] => {
    const steps = (quote.approval_steps && quote.approval_steps.length > 0)
      ? quote.approval_steps
      : (quote.approvals && quote.approvals.length > 0)
      ? quote.approvals
      : [];
    return [...steps].sort((a, b) => a.step_number - b.step_number);
  };

  // Helper to find the active pending step
  const getActivePendingStep = (quote: Quote): QuoteApprovalStep | null => {
    const steps = getApprovalSteps(quote);
    return steps.find((s) => (s.status || '').toUpperCase() === 'PENDING') || null;
  };

  // Filtered quotes based on status filter and search query
  const filteredQuotes = quotesList.filter((quote) => {
    const matchesStatus =
      activeStatusFilter === 'ALL' ||
      (quote.status || '').toUpperCase() === activeStatusFilter.toUpperCase();

    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      quote.title.toLowerCase().includes(query) ||
      quote.account_id.toLowerCase().includes(query) ||
      quote.id.toLowerCase().includes(query);

    return matchesStatus && matchesQuery;
  });

  // KPI Metrics Calculation
  const metrics = calculateQuoteMetrics(quotesList);

  // Toggle Row Expansion
  const handleToggleExpand = (quoteId: string) => {
    const newExpandedId = expandedQuoteId === quoteId ? null : quoteId;
    setExpandedQuoteId(newExpandedId);
    setDecisionError(null);
    setSubmitApprovalError(null);
    if (onQuoteSelect) {
      onQuoteSelect(newExpandedId);
    }
  };

  // Process Approval or Rejection Decision
  const handleDecisionSubmit = async (quote: Quote, e: React.FormEvent) => {
    e.preventDefault();
    setDecisionError(null);

    const activeStep = getActivePendingStep(quote);
    if (!activeStep) {
      setDecisionError('No pending approval step found for this quote.');
      return;
    }

    setIsSubmittingDecision(true);
    const payload: QuoteApprovalDecisionPayload = {
      step_number: activeStep.step_number,
      decision: decisionType,
      comment: decisionComment.trim() || undefined,
      approver_id: approverIdInput.trim() || currentUserId || undefined,
    };

    try {
      if (onApproveStep) {
        await onApproveStep(quote.id, payload);
      } else {
        await processQuoteApproval(quote.id, payload);
      }

      // Optimistically update local state
      setQuotesList((prev) =>
        prev.map((q) => {
          if (q.id !== quote.id) return q;

          const steps = getApprovalSteps(q);
          const updatedSteps = steps.map((s) => {
            if (s.step_number === activeStep.step_number) {
              return {
                ...s,
                status: decisionType,
                comment: decisionComment.trim() || null,
                approver_id: approverIdInput.trim() || s.approver_id,
                decided_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            }
            return s;
          });

          let newQuoteStatus: QuoteStatus = q.status;
          if (decisionType === 'REJECTED') {
            newQuoteStatus = 'REJECTED';
          } else if (decisionType === 'APPROVED') {
            const hasMorePending = updatedSteps.some((s) => (s.status || '').toUpperCase() === 'PENDING');
            newQuoteStatus = hasMorePending ? 'PENDING_APPROVAL' : 'APPROVED';
          }

          return {
            ...q,
            status: newQuoteStatus,
            updated_at: new Date().toISOString(),
            approval_steps: updatedSteps,
            approvals: updatedSteps,
          };
        })
      );

      setDecisionComment('');
    } catch (err: any) {
      setDecisionError(err?.message || 'Failed to submit approval decision. Please try again.');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Submit Draft / Rejected Quote for Approval
  const handleSubmitForApproval = async (quote: Quote, e: React.FormEvent) => {
    e.preventDefault();
    setSubmitApprovalError(null);

    const approverIdsList = submitApproverIds
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (approverIdsList.length === 0) {
      setSubmitApprovalError('Please enter at least one approver ID.');
      return;
    }

    setIsSubmittingForApproval(true);
    const payload: QuoteSubmitPayload = { approver_ids: approverIdsList };

    try {
      if (onSubmitForApproval) {
        await onSubmitForApproval(quote.id, payload);
      } else {
        await submitQuoteForApproval(quote.id, payload);
      }

      // Optimistically update local state
      setQuotesList((prev) =>
        prev.map((q) => {
          if (q.id !== quote.id) return q;

          const newSteps: QuoteApprovalStep[] = approverIdsList.map((appId, index) => ({
            id: `step-${quote.id}-${index + 1}`,
            quote_id: quote.id,
            approver_id: appId,
            step_number: index + 1,
            status: 'PENDING',
            comment: null,
            decided_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

          return {
            ...q,
            status: 'PENDING_APPROVAL',
            updated_at: new Date().toISOString(),
            approval_steps: newSteps,
            approvals: newSteps,
          };
        })
      );
    } catch (err: any) {
      setSubmitApprovalError(err?.message || 'Failed to submit quote for approval.');
    } finally {
      setIsSubmittingForApproval(false);
    }
  };

  // Create New Quote Handler
  const handleCreateQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateQuoteError(null);

    if (!newQuoteTitle.trim()) {
      setCreateQuoteError('Quote title is required.');
      return;
    }
    if (!newQuoteAccountId.trim()) {
      setCreateQuoteError('Account ID is required.');
      return;
    }
    const amountVal = parseFloat(newQuoteAmount);
    if (isNaN(amountVal) || amountVal < 0) {
      setCreateQuoteError('Please enter a valid monetary amount.');
      return;
    }

    const approverIdsList = newQuoteApprovers
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    setIsCreatingQuote(true);
    const payload: QuoteCreatePayload = {
      account_id: newQuoteAccountId.trim(),
      title: newQuoteTitle.trim(),
      total_amount: amountVal,
      approver_ids: approverIdsList.length > 0 ? approverIdsList : undefined,
    };

    try {
      if (onCreateQuote) {
        await onCreateQuote(payload);
      } else {
        const created = await createQuote(payload);
        setQuotesList((prev) => [created, ...prev]);
      }

      setIsCreateModalOpen(false);
      setNewQuoteTitle('');
      setNewQuoteAccountId('');
      setNewQuoteAmount('');
      setNewQuoteApprovers('mgr-finance-01, vp-commercial-02');
    } catch (err: any) {
      setCreateQuoteError(err?.message || 'Failed to create quote record.');
    } finally {
      setIsCreatingQuote(false);
    }
  };

  // Delete Quote Handler
  const handleDeleteQuoteClick = async (quoteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this quote record?')) {
      return;
    }

    try {
      if (onDeleteQuote) {
        await onDeleteQuote(quoteId);
      } else {
        await deleteQuote(quoteId);
      }
      setQuotesList((prev) => prev.filter((q) => q.id !== quoteId));
      if (expandedQuoteId === quoteId) {
        setExpandedQuoteId(null);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to delete quote record.');
    }
  };

  return (
    <div
      className={`quote-approval-table-container ${className}`}
      data-testid={testId}
      style={{
        backgroundColor: 'var(--color-surface, #fbf9f4)',
        borderRadius: 'var(--radius-lg, 0.5rem)',
        border: '1px solid var(--color-outline-variant, #d1c4b9)',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(115, 92, 65, 0.05)',
      }}
    >
      {/* 1. Header & Controls Bar */}
      <div
        className="quote-approval-header"
        data-testid="quote-approval-table-header"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginBottom: '24px',
          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
          paddingBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
                fontSize: '24px',
                fontWeight: 400,
                color: 'var(--color-primary, #59452b)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              Quote Status & Approval Decisions
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--color-on-surface-variant, #4e453d)',
                margin: '4px 0 0 0',
              }}
            >
              Track commercial quote lifecycles and process multi-step management sign-off workflows.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                data-testid="quote-approval-table-refresh-btn"
                style={{
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  color: 'var(--color-primary, #59452b)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-default, 0.25rem)',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.2s ease',
                }}
              >
                ↻ Refresh
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              data-testid="quote-approval-table-create-quote-btn"
              style={{
                backgroundColor: 'var(--color-primary, #59452b)',
                color: 'var(--color-on-primary, #ffffff)',
                border: 'none',
                borderRadius: 'var(--radius-default, 0.25rem)',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(115, 92, 65, 0.15)',
              }}
            >
              + Create New Quote
            </button>
          </div>
        </div>

        {/* 2. KPI Metrics Bar */}
        <div
          className="quote-metrics-bar"
          data-testid="quote-approval-table-metrics"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            marginTop: '8px',
          }}
        >
          <div
            data-testid="quote-approval-table-kpi-total"
            style={{
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Quotes
            </span>
            <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-on-surface, #1b1c19)', marginTop: '2px' }}>
              {metrics.totalCount} ({formatCurrency(metrics.totalAmount)})
            </div>
          </div>

          <div
            data-testid="quote-approval-table-kpi-pending"
            style={{
              backgroundColor: '#fef3c7',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid #fde68a',
            }}
          >
            <span style={{ fontSize: '12px', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pending Approval
            </span>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#78350f', marginTop: '2px' }}>
              {metrics.pendingCount} ({formatCurrency(metrics.pendingAmount)})
            </div>
          </div>

          <div
            data-testid="quote-approval-table-kpi-approved"
            style={{
              backgroundColor: 'var(--color-trend-up-bg, #e8f5e9)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid #a7f3d0',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--color-trend-up, #2e6b38)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Approved
            </span>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#166534', marginTop: '2px' }}>
              {metrics.approvedCount} ({formatCurrency(metrics.approvedAmount)})
            </div>
          </div>

          <div
            data-testid="quote-approval-table-kpi-rejected"
            style={{
              backgroundColor: 'var(--color-trend-down-bg, #fdf0ed)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid #fecaca',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--color-trend-down, #a43b2c)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rejected / Drafts
            </span>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#991b1b', marginTop: '2px' }}>
              {metrics.rejectedCount} Rejected / {metrics.draftCount} Drafts
            </div>
          </div>
        </div>

        {/* 3. Filter Tabs & Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const).map((status) => {
              const isActive = activeStatusFilter === status;
              const badge = status === 'ALL' ? null : getQuoteStatusBadge(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleFilterChange(status)}
                  data-testid={`quote-approval-table-filter-${status.toLowerCase()}`}
                  style={{
                    backgroundColor: isActive
                      ? 'var(--color-primary, #59452b)'
                      : 'var(--color-surface-container-low, #f5f3ee)',
                    color: isActive ? '#ffffff' : 'var(--color-on-surface, #1b1c19)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    borderRadius: 'var(--radius-full, 9999px)',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {status === 'ALL' ? 'All Quotes' : badge?.label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: '1', minWidth: '200px', maxWidth: '320px' }}>
            <input
              type="text"
              placeholder="Search title, account, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="quote-approval-table-search-input"
              style={{
                width: '100%',
                padding: '7px 12px',
                fontSize: '13px',
                borderRadius: 'var(--radius-default, 0.25rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                color: 'var(--color-on-surface, #1b1c19)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          data-testid="quote-approval-table-error"
          style={{
            backgroundColor: 'var(--color-trend-down-bg, #fdf0ed)',
            color: 'var(--color-trend-down, #a43b2c)',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-default, 0.25rem)',
            padding: '12px 16px',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          <strong>Error loading quotes:</strong> {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div
          data-testid="quote-approval-table-loading"
          style={{
            padding: '40px',
            textAlign: 'center',
            color: 'var(--color-on-surface-variant, #4e453d)',
            fontSize: '14px',
          }}
        >
          <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '2px solid var(--color-primary, #59452b)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '8px' }} />
          <div>Loading commercial quotes and approval workflows...</div>
        </div>
      )}

      {/* 4. Quotes Table */}
      {!isLoading && (
        <div style={{ overflowX: 'auto' }}>
          {filteredQuotes.length === 0 ? (
            <div
              data-testid="quote-approval-table-empty"
              style={{
                padding: '48px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                border: '1px dashed var(--color-outline-variant, #d1c4b9)',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 500 }}>No quotes found matching criteria.</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-outline, #80756b)' }}>
                Try adjusting your search query or status filter.
              </p>
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                    borderBottom: '2px solid var(--color-outline-variant, #d1c4b9)',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    fontWeight: 600,
                  }}
                >
                  <th style={{ padding: '12px 14px' }}>Quote Title & ID</th>
                  <th style={{ padding: '12px 14px' }}>Account ID</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Amount</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px' }}>Approval Workflow</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map((quote) => {
                  const isExpanded = expandedQuoteId === quote.id;
                  const badge = getQuoteStatusBadge(quote.status);
                  const steps = getApprovalSteps(quote);
                  const activeStep = getActivePendingStep(quote);
                  const totalSteps = steps.length;
                  const approvedStepsCount = steps.filter((s) => (s.status || '').toUpperCase() === 'APPROVED').length;

                  return (
                    <React.Fragment key={quote.id}>
                      <tr
                        data-testid={`quote-approval-table-row-${quote.id}`}
                        onClick={() => handleToggleExpand(quote.id)}
                        style={{
                          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
                          backgroundColor: isExpanded
                            ? 'var(--color-surface-container, #f0eee9)'
                            : 'transparent',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-on-surface, #1b1c19)' }}>
                            {quote.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-outline, #80756b)', marginTop: '2px' }}>
                            ID: {quote.id} • Created {formatDate(quote.created_at)}
                          </div>
                        </td>

                        <td style={{ padding: '12px 14px', verticalAlign: 'top', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                          {quote.account_id}
                        </td>

                        <td style={{ padding: '12px 14px', verticalAlign: 'top', textAlign: 'right', fontWeight: 600, color: 'var(--color-primary, #59452b)' }}>
                          {formatCurrency(quote.total_amount)}
                        </td>

                        <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                          <span
                            data-testid={`quote-approval-table-row-status-${quote.id}`}
                            style={{
                              backgroundColor: badge.bgColor,
                              color: badge.color,
                              border: `1px solid ${badge.borderColor}`,
                              borderRadius: 'var(--radius-full, 9999px)',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              display: 'inline-block',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>

                        <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                          {totalSteps === 0 ? (
                            <span style={{ fontSize: '12px', color: 'var(--color-outline, #80756b)', fontStyle: 'italic' }}>
                              No approval steps configured
                            </span>
                          ) : (
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-on-surface, #1b1c19)' }}>
                                {activeStep
                                  ? `Step ${activeStep.step_number} of ${totalSteps}: Pending`
                                  : (quote.status || '').toUpperCase() === 'APPROVED'
                                  ? `All ${totalSteps} steps approved`
                                  : `Completed ${approvedStepsCount} of ${totalSteps} steps`}
                              </div>
                              <div
                                style={{
                                  height: '4px',
                                  width: '100%',
                                  maxWidth: '120px',
                                  backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                                  borderRadius: '2px',
                                  marginTop: '4px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${totalSteps > 0 ? (approvedStepsCount / totalSteps) * 100 : 0}%`,
                                    backgroundColor:
                                      (quote.status || '').toUpperCase() === 'REJECTED'
                                        ? 'var(--color-secondary, #a43b2c)'
                                        : 'var(--color-primary, #59452b)',
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '12px 14px', verticalAlign: 'top', textAlign: 'right' }}>
                          <button
                            type="button"
                            data-testid={`quote-approval-table-row-expand-btn-${quote.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExpand(quote.id);
                            }}
                            style={{
                              backgroundColor: 'transparent',
                              color: 'var(--color-primary, #59452b)',
                              border: '1px solid var(--color-outline-variant, #d1c4b9)',
                              borderRadius: 'var(--radius-default, 0.25rem)',
                              padding: '4px 10px',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              marginRight: '6px',
                            }}
                          >
                            {isExpanded ? 'Hide Workflow' : 'View Workflow'}
                          </button>

                          {(quote.status || '').toUpperCase() === 'DRAFT' && (
                            <button
                              type="button"
                              data-testid={`quote-approval-table-delete-btn-${quote.id}`}
                              onClick={(e) => handleDeleteQuoteClick(quote.id, e)}
                              style={{
                                backgroundColor: 'transparent',
                                color: 'var(--color-secondary, #a43b2c)',
                                border: '1px solid #fecaca',
                                borderRadius: 'var(--radius-default, 0.25rem)',
                                padding: '4px 8px',
                                fontSize: '11px',
                                cursor: 'pointer',
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* 5. Expanded Workflow & Decision Panel */}
                      {isExpanded && (
                        <tr data-testid={`quote-approval-table-details-${quote.id}`}>
                          <td
                            colSpan={6}
                            style={{
                              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                              padding: '20px 24px',
                              borderBottom: '2px solid var(--color-outline-variant, #d1c4b9)',
                            }}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                              {/* Workflow Steps Timeline */}
                              <div>
                                <h4
                                  style={{
                                    fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
                                    fontSize: '16px',
                                    color: 'var(--color-primary, #59452b)',
                                    margin: '0 0 12px 0',
                                  }}
                                >
                                  Multi-Step Approval Sequence
                                </h4>

                                {steps.length === 0 ? (
                                  <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                                    This quote currently has no approval steps assigned. Submit for approval below to assign sign-off steps.
                                  </p>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {steps.map((step) => {
                                      const stepStatus = (step.status || '').toUpperCase();
                                      const isPending = stepStatus === 'PENDING';
                                      const isApproved = stepStatus === 'APPROVED';
                                      const isRejected = stepStatus === 'REJECTED';

                                      return (
                                        <div
                                          key={step.id || `step-${step.step_number}`}
                                          data-testid={`quote-approval-table-step-${step.id || step.step_number}`}
                                          style={{
                                            padding: '12px 14px',
                                            borderRadius: 'var(--radius-md, 0.375rem)',
                                            border: isPending
                                              ? '1px solid #fde68a'
                                              : isApproved
                                              ? '1px solid #a7f3d0'
                                              : '1px solid #fecaca',
                                            backgroundColor: isPending
                                              ? '#fffbeb'
                                              : isApproved
                                              ? '#f0fdf4'
                                              : '#fef2f2',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px',
                                          }}
                                        >
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-on-surface, #1b1c19)' }}>
                                              Step {step.step_number}: {step.approver_id || 'Manager Approver'}
                                            </span>
                                            <span
                                              style={{
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                padding: '2px 8px',
                                                borderRadius: 'var(--radius-full, 9999px)',
                                                color: isApproved ? '#166534' : isRejected ? '#991b1b' : '#92400e',
                                                backgroundColor: isApproved ? '#dcfce7' : isRejected ? '#fee2e2' : '#fef3c7',
                                              }}
                                            >
                                              {isApproved ? '✓ Approved' : isRejected ? '✕ Rejected' : '⏱ Pending'}
                                            </span>
                                          </div>

                                          {step.decided_at && (
                                            <div style={{ fontSize: '11px', color: 'var(--color-outline, #80756b)' }}>
                                              Decided on {formatDate(step.decided_at)}
                                            </div>
                                          )}

                                          {step.comment && (
                                            <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)', marginTop: '2px', fontStyle: 'italic' }}>
                                              "{step.comment}"
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Interactive Action Box */}
                              <div
                                style={{
                                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                                  padding: '16px 20px',
                                  borderRadius: 'var(--radius-md, 0.375rem)',
                                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                                }}
                              >
                                {(quote.status || '').toUpperCase() === 'PENDING_APPROVAL' && activeStep && (
                                  <div>
                                    <h4
                                      style={{
                                        fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
                                        fontSize: '15px',
                                        color: 'var(--color-primary, #59452b)',
                                        margin: '0 0 10px 0',
                                      }}
                                    >
                                      Manager Approval Decision (Step {activeStep.step_number})
                                    </h4>

                                    {decisionError && (
                                      <div
                                        style={{
                                          color: 'var(--color-secondary, #a43b2c)',
                                          fontSize: '12px',
                                          marginBottom: '10px',
                                        }}
                                      >
                                        {decisionError}
                                      </div>
                                    )}

                                    <form onSubmit={(e) => handleDecisionSubmit(quote, e)}>
                                      <div style={{ marginBottom: '10px' }}>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-on-surface-variant, #4e453d)', marginBottom: '4px' }}>
                                          Approver ID
                                        </label>
                                        <input
                                          type="text"
                                          value={approverIdInput}
                                          onChange={(e) => setApproverIdInput(e.target.value)}
                                          placeholder="e.g., mgr-finance-01"
                                          style={{
                                            width: '100%',
                                            padding: '6px 10px',
                                            fontSize: '12px',
                                            borderRadius: 'var(--radius-default, 0.25rem)',
                                            border: '1px solid var(--color-outline-variant, #d1c4b9)',
                                          }}
                                        />
                                      </div>

                                      <div style={{ marginBottom: '10px' }}>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-on-surface-variant, #4e453d)', marginBottom: '4px' }}>
                                          Decision Action
                                        </label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                          <button
                                            type="button"
                                            data-testid={`quote-approval-table-approve-btn-${quote.id}`}
                                            onClick={() => setDecisionType('APPROVED')}
                                            style={{
                                              flex: 1,
                                              padding: '8px',
                                              fontSize: '12px',
                                              fontWeight: 600,
                                              borderRadius: 'var(--radius-default, 0.25rem)',
                                              border: decisionType === 'APPROVED' ? '2px solid #2e6b38' : '1px solid var(--color-outline-variant, #d1c4b9)',
                                              backgroundColor: decisionType === 'APPROVED' ? '#dcfce7' : '#ffffff',
                                              color: decisionType === 'APPROVED' ? '#166534' : 'var(--color-on-surface, #1b1c19)',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            ✓ Approve
                                          </button>

                                          <button
                                            type="button"
                                            data-testid={`quote-approval-table-reject-btn-${quote.id}`}
                                            onClick={() => setDecisionType('REJECTED')}
                                            style={{
                                              flex: 1,
                                              padding: '8px',
                                              fontSize: '12px',
                                              fontWeight: 600,
                                              borderRadius: 'var(--radius-default, 0.25rem)',
                                              border: decisionType === 'REJECTED' ? '2px solid #a43b2c' : '1px solid var(--color-outline-variant, #d1c4b9)',
                                              backgroundColor: decisionType === 'REJECTED' ? '#fee2e2' : '#ffffff',
                                              color: decisionType === 'REJECTED' ? '#991b1b' : 'var(--color-on-surface, #1b1c19)',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            ✕ Reject
                                          </button>
                                        </div>
                                      </div>

                                      <div style={{ marginBottom: '12px' }}>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-on-surface-variant, #4e453d)', marginBottom: '4px' }}>
                                          Approval Comment / Rationale
                                        </label>
                                        <textarea
                                          rows={2}
                                          value={decisionComment}
                                          onChange={(e) => setDecisionComment(e.target.value)}
                                          data-testid={`quote-approval-table-comment-input-${quote.id}`}
                                          placeholder="Enter review notes or decision details..."
                                          style={{
                                            width: '100%',
                                            padding: '6px 10px',
                                            fontSize: '12px',
                                            borderRadius: 'var(--radius-default, 0.25rem)',
                                            border: '1px solid var(--color-outline-variant, #d1c4b9)',
                                            resize: 'vertical',
                                          }}
                                        />
                                      </div>

                                      <button
                                        type="submit"
                                        disabled={isSubmittingDecision}
                                        data-testid={`quote-approval-table-submit-decision-btn-${quote.id}`}
                                        style={{
                                          width: '100%',
                                          padding: '8px',
                                          fontSize: '13px',
                                          fontWeight: 600,
                                          borderRadius: 'var(--radius-default, 0.25rem)',
                                          border: 'none',
                                          backgroundColor: decisionType === 'APPROVED' ? 'var(--color-primary, #59452b)' : 'var(--color-secondary, #a43b2c)',
                                          color: '#ffffff',
                                          cursor: isSubmittingDecision ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        {isSubmittingDecision ? 'Submitting Decision...' : `Submit ${decisionType === 'APPROVED' ? 'Approval' : 'Rejection'}`}
                                      </button>
                                    </form>
                                  </div>
                                )}

                                {((quote.status || '').toUpperCase() === 'DRAFT' || (quote.status || '').toUpperCase() === 'REJECTED') && (
                                  <div>
                                    <h4
                                      style={{
                                        fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
                                        fontSize: '15px',
                                        color: 'var(--color-primary, #59452b)',
                                        margin: '0 0 10px 0',
                                      }}
                                    >
                                      Submit Quote for Management Approval
                                    </h4>

                                    {submitApprovalError && (
                                      <div style={{ color: 'var(--color-secondary, #a43b2c)', fontSize: '12px', marginBottom: '10px' }}>
                                        {submitApprovalError}
                                      </div>
                                    )}

                                    <form onSubmit={(e) => handleSubmitForApproval(quote, e)}>
                                      <div style={{ marginBottom: '12px' }}>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-on-surface-variant, #4e453d)', marginBottom: '4px' }}>
                                          Approver IDs (Comma-separated order)
                                        </label>
                                        <input
                                          type="text"
                                          value={submitApproverIds}
                                          onChange={(e) => setSubmitApproverIds(e.target.value)}
                                          placeholder="mgr-finance-01, vp-commercial-02"
                                          style={{
                                            width: '100%',
                                            padding: '6px 10px',
                                            fontSize: '12px',
                                            borderRadius: 'var(--radius-default, 0.25rem)',
                                            border: '1px solid var(--color-outline-variant, #d1c4b9)',
                                          }}
                                        />
                                      </div>

                                      <button
                                        type="submit"
                                        disabled={isSubmittingForApproval}
                                        data-testid={`quote-approval-table-submit-approval-btn-${quote.id}`}
                                        style={{
                                          width: '100%',
                                          padding: '8px',
                                          fontSize: '13px',
                                          fontWeight: 600,
                                          borderRadius: 'var(--radius-default, 0.25rem)',
                                          border: 'none',
                                          backgroundColor: 'var(--color-primary, #59452b)',
                                          color: '#ffffff',
                                          cursor: isSubmittingForApproval ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        {isSubmittingForApproval ? 'Submitting Workflow...' : 'Submit Quote for Approval'}
                                      </button>
                                    </form>
                                  </div>
                                )}

                                {(quote.status || '').toUpperCase() === 'APPROVED' && (
                                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>✓</div>
                                    <h4 style={{ margin: '0 0 4px 0', color: 'var(--color-trend-up, #2e6b38)' }}>
                                      Quote Fully Approved
                                    </h4>
                                    <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)', margin: 0 }}>
                                      All required management sign-off steps have been completed.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 6. Create New Quote Modal */}
      {isCreateModalOpen && (
        <div
          data-testid="quote-approval-table-new-quote-modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(27, 28, 25, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface, #fbf9f4)',
              borderRadius: 'var(--radius-lg, 0.5rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              maxWidth: '500px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 10px 30px rgba(115, 92, 65, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3
                style={{
                  fontFamily: 'var(--font-serif, Libre Caslon Text, Georgia, serif)',
                  fontSize: '20px',
                  color: 'var(--color-primary, #59452b)',
                  margin: 0,
                }}
              >
                Create New Quote
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                }}
              >
                ✕
              </button>
            </div>

            {createQuoteError && (
              <div
                style={{
                  backgroundColor: 'var(--color-trend-down-bg, #fdf0ed)',
                  color: 'var(--color-trend-down, #a43b2c)',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--radius-default, 0.25rem)',
                  padding: '10px 12px',
                  fontSize: '12px',
                  marginBottom: '14px',
                }}
              >
                {createQuoteError}
              </div>
            )}

            <form onSubmit={handleCreateQuoteSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-on-surface, #1b1c19)', marginBottom: '4px' }}>
                  Quote Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Software License Q4"
                  value={newQuoteTitle}
                  onChange={(e) => setNewQuoteTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-default, 0.25rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-on-surface, #1b1c19)', marginBottom: '4px' }}>
                  Account ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. acc-acme-corp"
                  value={newQuoteAccountId}
                  onChange={(e) => setNewQuoteAccountId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-default, 0.25rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-on-surface, #1b1c19)', marginBottom: '4px' }}>
                  Total Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 125000"
                  value={newQuoteAmount}
                  onChange={(e) => setNewQuoteAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-default, 0.25rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--color-on-surface, #1b1c19)', marginBottom: '4px' }}>
                  Initial Approver IDs (Optional)
                </label>
                <input
                  type="text"
                  placeholder="mgr-finance-01, vp-commercial-02"
                  value={newQuoteApprovers}
                  onChange={(e) => setNewQuoteApprovers(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-default, 0.25rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--color-outline, #80756b)', marginTop: '2px', display: 'block' }}>
                  Comma-separated list of approver user IDs for multi-step workflow
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    borderRadius: 'var(--radius-default, 0.25rem)',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingQuote}
                  style={{
                    backgroundColor: 'var(--color-primary, #59452b)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-default, 0.25rem)',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: isCreatingQuote ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isCreatingQuote ? 'Creating...' : 'Create Quote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuoteApprovalTable;
