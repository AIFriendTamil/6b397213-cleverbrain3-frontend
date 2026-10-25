'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Invoice,
  InvoicePaymentStatus,
  InvoiceCreatePayload,
  InvoiceUpdateStatusPayload,
  updateInvoiceStatus,
  createInvoice,
  deleteInvoice,
} from '../../services/financialApi';

export interface InvoiceListTableProps {
  /** Array of invoice records passed from parent component or page */
  invoices?: Invoice[] | null;
  /** Optional account ID filter label */
  accountId?: string;
  /** ID of currently selected invoice for highlighting or detail view */
  selectedInvoiceId?: string | null;
  /** Callback fired when an invoice row or item is clicked or selected */
  onInvoiceSelect?: (invoiceId: string | null) => void;
  /** Payment status filter setting ('ALL' | 'UNPAID' | 'PAID' | 'OVERDUE' | 'PARTIALLY_PAID') */
  statusFilter?: InvoicePaymentStatus | 'ALL';
  /** Callback fired when payment status filter selection changes */
  onStatusFilterChange?: (status: InvoicePaymentStatus | 'ALL') => void;
  /** Callback fired when an invoice's payment status is updated */
  onUpdateInvoiceStatus?: (invoiceId: string, status: InvoicePaymentStatus) => Promise<void> | void;
  /** Callback fired when a new invoice is created */
  onCreateInvoice?: (payload: InvoiceCreatePayload) => Promise<void> | void;
  /** Callback fired when an invoice is deleted */
  onDeleteInvoice?: (invoiceId: string) => Promise<void> | void;
  /** Callback fired to trigger a data refresh */
  onRefresh?: () => void;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Error message string if data fetching or action failed */
  error?: string | null;
  /** Custom CSS class name override */
  className?: string;
  /** Custom test ID attribute override */
  'data-testid'?: string;
}

/**
 * Summary metrics aggregated across invoice records.
 */
export interface InvoiceMetricsSummary {
  totalCount: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
  overdueCount: number;
  overdueAmount: number;
  partiallyPaidCount: number;
  partiallyPaidAmount: number;
  outstandingAmount: number;
}

/**
 * Default mock invoice dataset adhering to Linen & Logic domain contracts.
 */
export const DEFAULT_MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-101',
    account_id: 'acc-acme-corp',
    invoice_number: 'INV-2026-001',
    issue_date: '2026-10-01',
    due_date: '2026-10-31',
    amount: 145000,
    payment_status: 'PAID',
    created_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'inv-102',
    account_id: 'acc-stark-tech',
    invoice_number: 'INV-2026-002',
    issue_date: '2026-10-10',
    due_date: '2026-11-09',
    amount: 68500,
    payment_status: 'UNPAID',
    created_at: '2026-10-10T09:15:00Z',
  },
  {
    id: 'inv-103',
    account_id: 'acc-wayne-ent',
    invoice_number: 'INV-2026-003',
    issue_date: '2026-09-15',
    due_date: '2026-10-15',
    amount: 210000,
    payment_status: 'OVERDUE',
    created_at: '2026-09-15T11:30:00Z',
  },
  {
    id: 'inv-104',
    account_id: 'acc-cyberdyne',
    invoice_number: 'INV-2026-004',
    issue_date: '2026-10-18',
    due_date: '2026-11-17',
    amount: 32000,
    payment_status: 'PARTIALLY_PAID',
    created_at: '2026-10-18T14:20:00Z',
  },
  {
    id: 'inv-105',
    account_id: 'acc-oscorp',
    invoice_number: 'INV-2026-005',
    issue_date: '2026-09-01',
    due_date: '2026-10-01',
    amount: 87500,
    payment_status: 'OVERDUE',
    created_at: '2026-09-01T10:00:00Z',
  },
];

/**
 * Format raw numerical amount into standard currency string ($145,000).
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
 * Format ISO timestamp or date string into human-friendly date format.
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
    });
  } catch {
    return dateString;
  }
}

/**
 * Calculate day difference and overdue status for due dates.
 */
export function calculateDaysDifference(dueDateStr: string | undefined | null): {
  days: number;
  isOverdue: boolean;
  label: string;
} {
  if (!dueDateStr) return { days: 0, isOverdue: false, label: 'N/A' };
  try {
    const dueDate = new Date(dueDateStr);
    if (isNaN(dueDate.getTime())) return { days: 0, isOverdue: false, label: 'Invalid Date' };

    const today = new Date();
    const dueMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const diffTime = dueMidnight.getTime() - todayMidnight.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      return { days: diffDays, isOverdue: true, label: `${absDays} day${absDays === 1 ? '' : 's'} overdue` };
    } else if (diffDays === 0) {
      return { days: 0, isOverdue: false, label: 'Due today' };
    } else {
      return { days: diffDays, isOverdue: false, label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}` };
    }
  } catch {
    return { days: 0, isOverdue: false, label: dueDateStr };
  }
}

/**
 * Visual styling and metadata configuration for payment status badges.
 */
export function getPaymentStatusBadge(status: InvoicePaymentStatus | string): {
  label: string;
  bg: string;
  color: string;
  border: string;
  symbol: string;
} {
  const normStatus = (status || '').toUpperCase();
  switch (normStatus) {
    case 'PAID':
      return {
        label: 'Paid',
        bg: 'var(--color-trend-up-bg, #e8f5e9)',
        color: 'var(--color-trend-up, #2e6b38)',
        border: '1px solid #c8e6c9',
        symbol: '✓',
      };
    case 'UNPAID':
      return {
        label: 'Unpaid',
        bg: '#fff8e1',
        color: '#b78103',
        border: '1px solid #ffe082',
        symbol: '⏳',
      };
    case 'OVERDUE':
      return {
        label: 'Overdue',
        bg: 'var(--color-trend-down-bg, #fdf0ed)',
        color: 'var(--color-secondary, #a43b2c)',
        border: '1px solid #ffcdd2',
        symbol: '⚠',
      };
    case 'PARTIALLY_PAID':
      return {
        label: 'Partially Paid',
        bg: '#e3f2fd',
        color: '#0277bd',
        border: '1px solid #bbdefb',
        symbol: '◐',
      };
    default:
      return {
        label: normStatus || 'Unknown',
        bg: 'var(--color-surface-container-high, #eae8e3)',
        color: 'var(--color-on-surface-variant, #4e453d)',
        border: '1px solid var(--color-outline-variant, #d1c4b9)',
        symbol: '•',
      };
  }
}

/**
 * Calculate aggregate summary metrics for a list of invoice entities.
 */
export function calculateInvoiceMetrics(invoices: Invoice[]): InvoiceMetricsSummary {
  const summary: InvoiceMetricsSummary = {
    totalCount: invoices.length,
    totalAmount: 0,
    paidCount: 0,
    paidAmount: 0,
    unpaidCount: 0,
    unpaidAmount: 0,
    overdueCount: 0,
    overdueAmount: 0,
    partiallyPaidCount: 0,
    partiallyPaidAmount: 0,
    outstandingAmount: 0,
  };

  invoices.forEach((inv) => {
    const amt = typeof inv.amount === 'number' ? inv.amount : 0;
    summary.totalAmount += amt;

    const status = (inv.payment_status || '').toUpperCase();
    if (status === 'PAID') {
      summary.paidCount += 1;
      summary.paidAmount += amt;
    } else if (status === 'UNPAID') {
      summary.unpaidCount += 1;
      summary.unpaidAmount += amt;
      summary.outstandingAmount += amt;
    } else if (status === 'OVERDUE') {
      summary.overdueCount += 1;
      summary.overdueAmount += amt;
      summary.outstandingAmount += amt;
    } else if (status === 'PARTIALLY_PAID') {
      summary.partiallyPaidCount += 1;
      summary.partiallyPaidAmount += amt;
      summary.outstandingAmount += amt;
    } else {
      summary.outstandingAmount += amt;
    }
  });

  return summary;
}

/**
 * InvoiceListTable Component: Implements invoice tracking table, payment status filter bar,
 * invoice creation modal, detailed invoice inspect view, and status updates.
 */
export const InvoiceListTable: React.FC<InvoiceListTableProps> = ({
  invoices,
  accountId,
  selectedInvoiceId,
  onInvoiceSelect,
  statusFilter = 'ALL',
  onStatusFilterChange,
  onUpdateInvoiceStatus,
  onCreateInvoice,
  onDeleteInvoice,
  onRefresh,
  isLoading = false,
  error = null,
  className = '',
  'data-testid': testId = 'invoice-list-table',
}) => {
  // Local state management
  const [internalInvoices, setInternalInvoices] = useState<Invoice[]>(invoices || DEFAULT_MOCK_INVOICES);
  const [currentStatusFilter, setCurrentStatusFilter] = useState<InvoicePaymentStatus | 'ALL'>(statusFilter);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'due_date' | 'issue_date' | 'amount' | 'invoice_number'>('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal inspection & creation state
  const [activeSelectedInvoiceId, setActiveSelectedInvoiceId] = useState<string | null>(selectedInvoiceId || null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // New Invoice Form state
  const [newAccountId, setNewAccountId] = useState<string>(accountId || 'acc-acme-corp');
  const [newInvoiceNumber, setNewInvoiceNumber] = useState<string>(
    `INV-2026-${Math.floor(100 + Math.random() * 900)}`
  );
  const [newIssueDate, setNewIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newDueDate, setNewDueDate] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [newAmount, setNewAmount] = useState<string>('50000');
  const [newPaymentStatus, setNewPaymentStatus] = useState<InvoicePaymentStatus>('UNPAID');

  // Sync external props with internal state
  useEffect(() => {
    if (invoices !== undefined && invoices !== null) {
      setInternalInvoices(invoices);
    }
  }, [invoices]);

  useEffect(() => {
    setCurrentStatusFilter(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    setActiveSelectedInvoiceId(selectedInvoiceId || null);
  }, [selectedInvoiceId]);

  // Handle status filter selection change
  const handleFilterChange = (newStatus: InvoicePaymentStatus | 'ALL') => {
    setCurrentStatusFilter(newStatus);
    if (onStatusFilterChange) {
      onStatusFilterChange(newStatus);
    }
  };

  // Filter and sort invoices
  const filteredInvoices = useMemo(() => {
    return internalInvoices.filter((inv) => {
      // Account filter
      if (accountId && inv.account_id !== accountId) {
        return false;
      }

      // Status filter
      if (currentStatusFilter !== 'ALL') {
        const invStatus = (inv.payment_status || '').toUpperCase();
        if (invStatus !== currentStatusFilter.toUpperCase()) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const numMatch = inv.invoice_number?.toLowerCase().includes(query);
        const accMatch = inv.account_id?.toLowerCase().includes(query);
        const amountMatch = inv.amount?.toString().includes(query);
        if (!numMatch && !accMatch && !amountMatch) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'amount') {
        comparison = (a.amount || 0) - (b.amount || 0);
      } else if (sortBy === 'invoice_number') {
        comparison = (a.invoice_number || '').localeCompare(b.invoice_number || '');
      } else if (sortBy === 'issue_date') {
        comparison = new Date(a.issue_date || 0).getTime() - new Date(b.issue_date || 0).getTime();
      } else {
        // default due_date
        comparison = new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [internalInvoices, accountId, currentStatusFilter, searchQuery, sortBy, sortOrder]);

  // Aggregate summary metrics
  const metrics = useMemo(() => {
    const listToCalculate = accountId
      ? internalInvoices.filter((i) => i.account_id === accountId)
      : internalInvoices;
    return calculateInvoiceMetrics(listToCalculate);
  }, [internalInvoices, accountId]);

  // Active selected invoice entity
  const selectedInvoice = useMemo(() => {
    return internalInvoices.find((i) => i.id === activeSelectedInvoiceId) || null;
  }, [internalInvoices, activeSelectedInvoiceId]);

  // Row selection handler
  const handleSelectInvoice = (inv: Invoice) => {
    setActiveSelectedInvoiceId(inv.id);
    setIsDetailOpen(true);
    setActionError(null);
    if (onInvoiceSelect) {
      onInvoiceSelect(inv.id);
    }
  };

  // Status update handler
  const handleStatusUpdate = async (invoiceId: string, newStatus: InvoicePaymentStatus) => {
    setIsUpdatingStatus(true);
    setActionError(null);
    try {
      if (onUpdateInvoiceStatus) {
        await onUpdateInvoiceStatus(invoiceId, newStatus);
      } else {
        await updateInvoiceStatus(invoiceId, newStatus);
      }

      // Update local state optimistic/persistent
      setInternalInvoices((prev) =>
        prev.map((i) => (i.id === invoiceId ? { ...i, payment_status: newStatus } : i))
      );
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update invoice payment status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Create invoice form submission handler
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountId || !newInvoiceNumber || !newAmount) {
      setActionError('Please complete all required invoice fields.');
      return;
    }

    const payload: InvoiceCreatePayload = {
      account_id: newAccountId,
      invoice_number: newInvoiceNumber,
      issue_date: newIssueDate,
      due_date: newDueDate,
      amount: parseFloat(newAmount) || 0,
      payment_status: newPaymentStatus,
    };

    setIsSubmittingCreate(true);
    setActionError(null);
    try {
      if (onCreateInvoice) {
        await onCreateInvoice(payload);
      } else {
        await createInvoice(payload);
      }

      // Local optimistic record
      const createdRecord: Invoice = {
        id: `inv-${Date.now()}`,
        ...payload,
        payment_status: payload.payment_status || 'UNPAID',
        created_at: new Date().toISOString(),
      };
      setInternalInvoices((prev) => [createdRecord, ...prev]);

      setIsCreateOpen(false);
      // Reset form defaults
      setNewInvoiceNumber(`INV-2026-${Math.floor(100 + Math.random() * 900)}`);
      setNewAmount('50000');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create invoice record.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Delete invoice handler
  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!window.confirm('Are you sure you want to delete this invoice record?')) {
      return;
    }

    setIsDeleting(true);
    setActionError(null);
    try {
      if (onDeleteInvoice) {
        await onDeleteInvoice(invoiceId);
      } else {
        await deleteInvoice(invoiceId);
      }

      setInternalInvoices((prev) => prev.filter((i) => i.id !== invoiceId));
      if (activeSelectedInvoiceId === invoiceId) {
        setActiveSelectedInvoiceId(null);
        setIsDetailOpen(false);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete invoice record.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      data-testid={testId}
      className={`invoice-list-table-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        backgroundColor: 'var(--color-surface, #fbf9f4)',
        color: 'var(--color-on-surface, #1b1c19)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Component Header & Actions */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif)',
              fontSize: '24px',
              fontWeight: 400,
              color: 'var(--color-primary, #59452b)',
              letterSpacing: '-0.01em',
            }}
          >
            Invoice Operations & Tracking
          </h2>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Track customer billing schedules, due dates, outstanding balances, and payment lifecycle statuses.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              data-testid="refresh-invoices-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-primary, #59452b)',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-default, 0.25rem)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              🔄 Refresh
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsCreateOpen(true);
              setActionError(null);
            }}
            data-testid="create-invoice-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-on-primary, #ffffff)',
              backgroundColor: 'var(--color-primary, #59452b)',
              border: 'none',
              borderRadius: 'var(--radius-default, 0.25rem)',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(115, 92, 65, 0.1)',
            }}
          >
            ➕ Create Invoice
          </button>
        </div>
      </div>

      {/* Summary KPI Metrics Bar */}
      <div
        className="metric-grid metric-grid-responsive"
        data-testid="invoice-summary-kpis"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Total Invoices Card */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-default, 0.25rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Total Invoices
          </div>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--color-primary, #59452b)',
              margin: '4px 0',
            }}
          >
            {formatCurrency(metrics.totalAmount)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            {metrics.totalCount} invoice{metrics.totalCount === 1 ? '' : 's'} recorded
          </div>
        </div>

        {/* Total Outstanding Card */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-default, 0.25rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Total Outstanding
          </div>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--color-primary-container, #735c41)',
              margin: '4px 0',
            }}
          >
            {formatCurrency(metrics.outstandingAmount)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            Unpaid + Overdue + Partially Paid
          </div>
        </div>

        {/* Total Paid Card */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-default, 0.25rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Collected / Paid
          </div>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--color-trend-up, #2e6b38)',
              margin: '4px 0',
            }}
          >
            {formatCurrency(metrics.paidAmount)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            {metrics.paidCount} invoice{metrics.paidCount === 1 ? '' : 's'} fully settled
          </div>
        </div>

        {/* Total Overdue Card */}
        <div
          style={{
            padding: '16px',
            backgroundColor: metrics.overdueCount > 0 ? 'var(--color-trend-down-bg, #fdf0ed)' : 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-default, 0.25rem)',
            border: metrics.overdueCount > 0 ? '1px solid #ffcdd2' : '1px solid var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: metrics.overdueCount > 0 ? 'var(--color-secondary, #a43b2c)' : 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Overdue Balance
          </div>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: metrics.overdueCount > 0 ? 'var(--color-secondary, #a43b2c)' : 'var(--color-primary, #59452b)',
              margin: '4px 0',
            }}
          >
            {formatCurrency(metrics.overdueAmount)}
          </div>
          <div style={{ fontSize: '12px', color: metrics.overdueCount > 0 ? 'var(--color-secondary, #a43b2c)' : 'var(--color-on-surface-variant, #4e453d)' }}>
            {metrics.overdueCount} invoice{metrics.overdueCount === 1 ? '' : 's'} past due
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {(error || actionError) && (
        <div
          data-testid="invoice-error-banner"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-error-container, #ffdad6)',
            color: 'var(--color-on-error-container, #93000a)',
            border: '1px solid var(--color-error, #ba1a1a)',
            borderRadius: 'var(--radius-default, 0.25rem)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>⚠️ {error || actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Control Toolbar */}
      <div
        data-testid="invoice-filter-bar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px',
          backgroundColor: 'var(--color-surface-container, #f0eee9)',
          borderRadius: 'var(--radius-default, 0.25rem)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
        }}
      >
        {/* Payment Status Filter Buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginRight: '4px',
            }}
          >
            Payment Status:
          </span>

          {(['ALL', 'UNPAID', 'PAID', 'OVERDUE', 'PARTIALLY_PAID'] as const).map((st) => {
            const isActive = currentStatusFilter === st;
            const badge = st === 'ALL' ? null : getPaymentStatusBadge(st);
            
            let count = metrics.totalCount;
            if (st === 'UNPAID') count = metrics.unpaidCount;
            if (st === 'PAID') count = metrics.paidCount;
            if (st === 'OVERDUE') count = metrics.overdueCount;
            if (st === 'PARTIALLY_PAID') count = metrics.partiallyPaidCount;

            return (
              <button
                key={st}
                type="button"
                onClick={() => handleFilterChange(st)}
                data-testid={`filter-btn-${st.toLowerCase()}`}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--color-on-primary, #ffffff)' : 'var(--color-on-surface, #1b1c19)',
                  backgroundColor: isActive ? 'var(--color-primary, #59452b)' : 'var(--color-surface-container-low, #f5f3ee)',
                  border: isActive ? '1px solid var(--color-primary, #59452b)' : '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-full, 9999px)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                {st === 'ALL' ? 'All Invoices' : badge?.label}
                <span
                  style={{
                    padding: '2px 6px',
                    fontSize: '10px',
                    borderRadius: 'var(--radius-full, 9999px)',
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-surface-container-high, #eae8e3)',
                    color: 'inherit',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Sort Controls */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {/* Search Box */}
          <input
            type="text"
            placeholder="Search invoice # or account..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="invoice-search-input"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              border: '1px solid var(--color-outline, #80756b)',
              borderRadius: 'var(--radius-default, 0.25rem)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              color: 'var(--color-on-surface, #1b1c19)',
              outline: 'none',
              minWidth: '200px',
            }}
          />

          {/* Sort By Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            data-testid="invoice-sort-by"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              border: '1px solid var(--color-outline, #80756b)',
              borderRadius: 'var(--radius-default, 0.25rem)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            <option value="due_date">Sort by Due Date</option>
            <option value="issue_date">Sort by Issue Date</option>
            <option value="amount">Sort by Amount</option>
            <option value="invoice_number">Sort by Invoice #</option>
          </select>

          {/* Sort Order Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            data-testid="invoice-sort-order-btn"
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-default, 0.25rem)',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              cursor: 'pointer',
            }}
            title={`Sort direction: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
          >
            {sortOrder === 'asc' ? '⬆ Asc' : '⬇ Desc'}
          </button>
        </div>
      </div>

      {/* Main Invoice List Table */}
      {isLoading ? (
        <div
          data-testid="invoice-loading-state"
          style={{
            padding: '40px',
            textAlign: 'center',
            color: 'var(--color-on-surface-variant, #4e453d)',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-default, 0.25rem)',
          }}
        >
          <p style={{ margin: 0, fontSize: '14px' }}>⌛ Loading invoice tracking data...</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div
          data-testid="invoice-empty-state"
          style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-default, 0.25rem)',
            border: '1px dashed var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 500 }}>
            No invoice records found
          </p>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            {currentStatusFilter !== 'ALL' || searchQuery
              ? 'Try resetting your status filter or search parameters.'
              : 'Create a new invoice to start tracking billing schedules.'}
          </p>
          {(currentStatusFilter !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                handleFilterChange('ALL');
                setSearchQuery('');
              }}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                color: 'var(--color-primary, #59452b)',
                backgroundColor: 'var(--color-surface-container, #f0eee9)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-default, 0.25rem)',
                cursor: 'pointer',
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            overflowX: 'auto',
            borderRadius: 'var(--radius-default, 0.25rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
          }}
        >
          <table
            data-testid="invoice-table"
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
                  backgroundColor: 'var(--color-surface-container, #f0eee9)',
                  borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  fontWeight: 600,
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '12px 16px' }}>Invoice Number</th>
                <th style={{ padding: '12px 16px' }}>Account ID</th>
                <th style={{ padding: '12px 16px' }}>Issue Date</th>
                <th style={{ padding: '12px 16px' }}>Due Date & Status</th>
                <th style={{ padding: '12px 16px' }}>Amount</th>
                <th style={{ padding: '12px 16px' }}>Payment Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => {
                const badge = getPaymentStatusBadge(inv.payment_status);
                const dueDiff = calculateDaysDifference(inv.due_date);
                const isSelected = activeSelectedInvoiceId === inv.id;

                return (
                  <tr
                    key={inv.id}
                    data-testid={`invoice-row-${inv.id}`}
                    onClick={() => handleSelectInvoice(inv)}
                    style={{
                      borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
                      backgroundColor: isSelected
                        ? 'var(--color-surface-container-high, #eae8e3)'
                        : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {/* Invoice Number */}
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-primary, #59452b)' }}>
                      {inv.invoice_number}
                    </td>

                    {/* Account ID */}
                    <td style={{ padding: '12px 16px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                      {inv.account_id}
                    </td>

                    {/* Issue Date */}
                    <td style={{ padding: '12px 16px' }}>
                      {formatDate(inv.issue_date)}
                    </td>

                    {/* Due Date & Days Difference */}
                    <td style={{ padding: '12px 16px' }}>
                      <div>{formatDate(inv.due_date)}</div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: dueDiff.isOverdue ? 600 : 400,
                          color: dueDiff.isOverdue
                            ? 'var(--color-secondary, #a43b2c)'
                            : 'var(--color-on-surface-variant, #4e453d)',
                          marginTop: '2px',
                        }}
                      >
                        {dueDiff.label}
                      </div>
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      {formatCurrency(inv.amount)}
                    </td>

                    {/* Payment Status Badge */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        data-testid={`status-badge-${inv.id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: badge.border,
                          borderRadius: 'var(--radius-full, 9999px)',
                        }}
                      >
                        <span>{badge.symbol}</span>
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    {/* Quick Actions */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectInvoice(inv)}
                          data-testid={`view-details-${inv.id}`}
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 500,
                            color: 'var(--color-primary, #59452b)',
                            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                            border: '1px solid var(--color-outline-variant, #d1c4b9)',
                            borderRadius: 'var(--radius-default, 0.25rem)',
                            cursor: 'pointer',
                          }}
                        >
                          Details
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteInvoice(inv.id)}
                          data-testid={`delete-invoice-${inv.id}`}
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 500,
                            color: 'var(--color-secondary, #a43b2c)',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--color-outline-variant, #d1c4b9)',
                            borderRadius: 'var(--radius-default, 0.25rem)',
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Detail Inspection Modal */}
      {isDetailOpen && selectedInvoice && (
        <div
          data-testid="invoice-detail-modal"
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
          onClick={() => setIsDetailOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface-bright, #fbf9f4)',
              borderRadius: 'var(--radius-lg, 0.5rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 8px 30px rgba(115, 92, 65, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)', textTransform: 'uppercase' }}>
                  Invoice Specification
                </span>
                <h3
                  style={{
                    margin: '2px 0 0 0',
                    fontFamily: 'var(--font-serif)',
                    fontSize: '20px',
                    color: 'var(--color-primary, #59452b)',
                  }}
                >
                  {selectedInvoice.invoice_number}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Details Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
                margin: '20px 0',
                fontSize: '13px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                  Account Identifier
                </div>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{selectedInvoice.account_id}</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                  Total Invoice Amount
                </div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-primary, #59452b)', marginTop: '2px' }}>
                  {formatCurrency(selectedInvoice.amount)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                  Issue Date
                </div>
                <div style={{ fontWeight: 500, marginTop: '2px' }}>{formatDate(selectedInvoice.issue_date)}</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                  Due Date
                </div>
                <div style={{ fontWeight: 500, marginTop: '2px' }}>
                  {formatDate(selectedInvoice.due_date)}
                  <span
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      color: calculateDaysDifference(selectedInvoice.due_date).isOverdue ? 'var(--color-secondary, #a43b2c)' : 'var(--color-on-surface-variant, #4e453d)',
                      fontWeight: calculateDaysDifference(selectedInvoice.due_date).isOverdue ? 600 : 400,
                    }}
                  >
                    {calculateDaysDifference(selectedInvoice.due_date).label}
                  </span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                  Current Status
                </div>
                <div style={{ marginTop: '4px' }}>
                  {(() => {
                    const badge = getPaymentStatusBadge(selectedInvoice.payment_status);
                    return (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: badge.border,
                          borderRadius: 'var(--radius-full, 9999px)',
                        }}
                      >
                        <span>{badge.symbol}</span>
                        <span>{badge.label}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
                  Record ID
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--color-on-surface-variant, #4e453d)', marginTop: '2px' }}>
                  {selectedInvoice.id}
                </div>
              </div>
            </div>

            {/* Quick Status Change Action Section */}
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                borderRadius: 'var(--radius-default, 0.25rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                Update Payment Status:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(['UNPAID', 'PAID', 'OVERDUE', 'PARTIALLY_PAID'] as const).map((st) => {
                  const isCurrent = selectedInvoice.payment_status === st;
                  const badge = getPaymentStatusBadge(st);
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={isCurrent || isUpdatingStatus}
                      onClick={() => handleStatusUpdate(selectedInvoice.id, st)}
                      data-testid={`update-status-btn-${st}`}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: isCurrent ? 600 : 400,
                        backgroundColor: isCurrent ? badge.bg : 'var(--color-surface-container-lowest, #ffffff)',
                        color: isCurrent ? badge.color : 'var(--color-on-surface, #1b1c19)',
                        border: isCurrent ? badge.border : '1px solid var(--color-outline-variant, #d1c4b9)',
                        borderRadius: 'var(--radius-default, 0.25rem)',
                        cursor: isCurrent || isUpdatingStatus ? 'default' : 'pointer',
                        opacity: isUpdatingStatus ? 0.6 : 1,
                      }}
                    >
                      {isCurrent ? `✓ Current: ${badge.label}` : `Mark as ${badge.label}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '16px',
                borderTop: '1px solid var(--color-outline-variant, #d1c4b9)',
              }}
            >
              <button
                type="button"
                onClick={() => handleDeleteInvoice(selectedInvoice.id)}
                disabled={isDeleting}
                data-testid="modal-delete-invoice-btn"
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  color: 'var(--color-secondary, #a43b2c)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-secondary, #a43b2c)',
                  borderRadius: 'var(--radius-default, 0.25rem)',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                {isDeleting ? 'Deleting...' : '🗑 Delete Invoice'}
              </button>

              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                style={{
                  padding: '8px 18px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-on-primary, #ffffff)',
                  backgroundColor: 'var(--color-primary, #59452b)',
                  border: 'none',
                  borderRadius: 'var(--radius-default, 0.25rem)',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Invoice Modal */}
      {isCreateOpen && (
        <div
          data-testid="create-invoice-modal"
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
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface-bright, #fbf9f4)',
              borderRadius: 'var(--radius-lg, 0.5rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 8px 30px rgba(115, 92, 65, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-serif)',
                  fontSize: '20px',
                  color: 'var(--color-primary, #59452b)',
                }}
              >
                Create New Invoice
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginBottom: '4px',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                    }}
                  >
                    Account Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    value={newAccountId}
                    onChange={(e) => setNewAccountId(e.target.value)}
                    data-testid="input-account-id"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: '1px solid var(--color-outline, #80756b)',
                      borderRadius: 'var(--radius-default, 0.25rem)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginBottom: '4px',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                    }}
                  >
                    Invoice Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={newInvoiceNumber}
                    onChange={(e) => setNewInvoiceNumber(e.target.value)}
                    data-testid="input-invoice-number"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: '1px solid var(--color-outline, #80756b)',
                      borderRadius: 'var(--radius-default, 0.25rem)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginBottom: '4px',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                      }}
                    >
                      Issue Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={newIssueDate}
                      onChange={(e) => setNewIssueDate(e.target.value)}
                      data-testid="input-issue-date"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '13px',
                        border: '1px solid var(--color-outline, #80756b)',
                        borderRadius: 'var(--radius-default, 0.25rem)',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginBottom: '4px',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                      }}
                    >
                      Due Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      data-testid="input-due-date"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '13px',
                        border: '1px solid var(--color-outline, #80756b)',
                        borderRadius: 'var(--radius-default, 0.25rem)',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginBottom: '4px',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                      }}
                    >
                      Amount ($ USD) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      data-testid="input-amount"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '13px',
                        border: '1px solid var(--color-outline, #80756b)',
                        borderRadius: 'var(--radius-default, 0.25rem)',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginBottom: '4px',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                      }}
                    >
                      Initial Status
                    </label>
                    <select
                      value={newPaymentStatus}
                      onChange={(e) => setNewPaymentStatus(e.target.value as InvoicePaymentStatus)}
                      data-testid="select-initial-status"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '13px',
                        border: '1px solid var(--color-outline, #80756b)',
                        borderRadius: 'var(--radius-default, 0.25rem)',
                      }}
                    >
                      <option value="UNPAID">Unpaid</option>
                      <option value="PAID">Paid</option>
                      <option value="OVERDUE">Overdue</option>
                      <option value="PARTIALLY_PAID">Partially Paid</option>
                    </select>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--color-outline-variant, #d1c4b9)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    borderRadius: 'var(--radius-default, 0.25rem)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  data-testid="submit-create-invoice"
                  style={{
                    padding: '8px 20px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--color-on-primary, #ffffff)',
                    backgroundColor: 'var(--color-primary, #59452b)',
                    border: 'none',
                    borderRadius: 'var(--radius-default, 0.25rem)',
                    cursor: isSubmittingCreate ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmittingCreate ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceListTable;
