import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  InvoiceListTable,
  formatCurrency,
  formatDate,
  calculateDaysDifference,
  getPaymentStatusBadge,
  calculateInvoiceMetrics,
  DEFAULT_MOCK_INVOICES,
} from '../src/components/financial/InvoiceListTable';
import { Invoice } from '../src/services/financialApi';

// Mock financialApi service calls
vi.mock('../src/services/financialApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/financialApi')>();
  return {
    ...actual,
    updateInvoiceStatus: vi.fn().mockResolvedValue({
      id: 'inv-102',
      account_id: 'acc-stark-tech',
      invoice_number: 'INV-2026-002',
      issue_date: '2026-10-10',
      due_date: '2026-11-09',
      amount: 68500,
      payment_status: 'PAID',
      created_at: '2026-10-10T09:15:00Z',
    }),
    createInvoice: vi.fn().mockResolvedValue({
      id: 'inv-999',
      account_id: 'acc-acme-corp',
      invoice_number: 'INV-2026-999',
      issue_date: '2026-10-25',
      due_date: '2026-11-25',
      amount: 50000,
      payment_status: 'UNPAID',
      created_at: '2026-10-25T12:00:00Z',
    }),
    deleteInvoice: vi.fn().mockResolvedValue(undefined),
  };
});

describe('InvoiceListTable Component & Helper Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Formatter and Helper Functions', () => {
    it('formats currency correctly', () => {
      expect(formatCurrency(145000)).toBe('$145,000');
      expect(formatCurrency(68500.5)).toBe('$68,500.5');
      expect(formatCurrency(0)).toBe('$0');
      expect(formatCurrency(null)).toBe('$0');
      expect(formatCurrency(undefined)).toBe('$0');
      expect(formatCurrency(-1000)).toBe('-$1,000');
    });

    it('formats ISO timestamps into human dates', () => {
      expect(formatDate('2026-10-01')).toContain('2026');
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate(undefined)).toBe('N/A');
    });

    it('calculates days difference and overdue status correctly', () => {
      const pastDue = calculateDaysDifference('2020-01-01');
      expect(pastDue.isOverdue).toBe(true);
      expect(pastDue.label).toContain('overdue');

      const futureDue = calculateDaysDifference('2035-12-31');
      expect(futureDue.isOverdue).toBe(false);
      expect(futureDue.label).toContain('Due in');

      expect(calculateDaysDifference(null).label).toBe('N/A');
    });

    it('returns appropriate badge metadata per payment status', () => {
      const paid = getPaymentStatusBadge('PAID');
      expect(paid.label).toBe('Paid');
      expect(paid.symbol).toBe('✓');

      const unpaid = getPaymentStatusBadge('UNPAID');
      expect(unpaid.label).toBe('Unpaid');

      const overdue = getPaymentStatusBadge('OVERDUE');
      expect(overdue.label).toBe('Overdue');

      const partial = getPaymentStatusBadge('PARTIALLY_PAID');
      expect(partial.label).toBe('Partially Paid');
    });

    it('calculates aggregate metrics across invoice records correctly', () => {
      const summary = calculateInvoiceMetrics(DEFAULT_MOCK_INVOICES);
      expect(summary.totalCount).toBe(5);
      expect(summary.paidCount).toBe(1);
      expect(summary.paidAmount).toBe(145000);
      expect(summary.unpaidCount).toBe(1);
      expect(summary.unpaidAmount).toBe(68500);
      expect(summary.overdueCount).toBe(2);
      expect(summary.overdueAmount).toBe(210000 + 87500); // 297500
      expect(summary.partiallyPaidCount).toBe(1);
      expect(summary.partiallyPaidAmount).toBe(32000);
      expect(summary.outstandingAmount).toBe(68500 + 297500 + 32000); // 398000
    });
  });

  describe('InvoiceListTable Component Rendering & Interactions', () => {
    it('renders with default mock invoices when no invoices prop is passed', () => {
      render(<InvoiceListTable />);

      expect(screen.getByText('Invoice Operations & Tracking')).toBeInTheDocument();
      expect(screen.getByTestId('invoice-summary-kpis')).toBeInTheDocument();
      expect(screen.getByTestId('invoice-table')).toBeInTheDocument();

      // Check default invoice rows
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
      expect(screen.getByText('INV-2026-002')).toBeInTheDocument();
      expect(screen.getByText('INV-2026-003')).toBeInTheDocument();
    });

    it('filters invoice list by payment status when filter buttons are clicked', () => {
      const onFilterChange = vi.fn();
      render(<InvoiceListTable onStatusFilterChange={onFilterChange} />);

      // Filter by UNPAID
      const unpaidBtn = screen.getByTestId('filter-btn-unpaid');
      fireEvent.click(unpaidBtn);

      expect(onFilterChange).toHaveBeenCalledWith('UNPAID');
      expect(screen.getByText('INV-2026-002')).toBeInTheDocument();
      expect(screen.queryByText('INV-2026-001')).not.toBeInTheDocument(); // PAID

      // Filter by PAID
      const paidBtn = screen.getByTestId('filter-btn-paid');
      fireEvent.click(paidBtn);

      expect(onFilterChange).toHaveBeenCalledWith('PAID');
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
      expect(screen.queryByText('INV-2026-002')).not.toBeInTheDocument();

      // Reset filter to ALL
      const allBtn = screen.getByTestId('filter-btn-all');
      fireEvent.click(allBtn);

      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
      expect(screen.getByText('INV-2026-002')).toBeInTheDocument();
    });

    it('filters invoices by search query text', () => {
      render(<InvoiceListTable />);

      const searchInput = screen.getByTestId('invoice-search-input');
      fireEvent.change(searchInput, { target: { value: 'acc-stark-tech' } });

      expect(screen.getByText('INV-2026-002')).toBeInTheDocument();
      expect(screen.queryByText('INV-2026-001')).not.toBeInTheDocument();
    });

    it('opens invoice detail modal on row click or details button click', () => {
      const onSelect = vi.fn();
      render(<InvoiceListTable onInvoiceSelect={onSelect} />);

      const detailsBtn = screen.getByTestId('view-details-inv-101');
      fireEvent.click(detailsBtn);

      expect(onSelect).toHaveBeenCalledWith('inv-101');
      expect(screen.getByTestId('invoice-detail-modal')).toBeInTheDocument();
      expect(screen.getByText('Invoice Specification')).toBeInTheDocument();
    });

    it('allows updating payment status inside detail modal', async () => {
      const onUpdateStatus = vi.fn().mockResolvedValue(undefined);
      render(<InvoiceListTable onUpdateInvoiceStatus={onUpdateStatus} />);

      // Open detail modal for inv-102 (UNPAID)
      fireEvent.click(screen.getByTestId('view-details-inv-102'));
      expect(screen.getByTestId('invoice-detail-modal')).toBeInTheDocument();

      // Click Mark as Paid button
      const markPaidBtn = screen.getByTestId('update-status-btn-PAID');
      fireEvent.click(markPaidBtn);

      await waitFor(() => {
        expect(onUpdateStatus).toHaveBeenCalledWith('inv-102', 'PAID');
      });
    });

    it('opens create invoice modal and submits new invoice record', async () => {
      const onCreate = vi.fn().mockResolvedValue(undefined);
      render(<InvoiceListTable onCreateInvoice={onCreate} />);

      // Click Create Invoice button
      const createBtn = screen.getByTestId('create-invoice-btn');
      fireEvent.click(createBtn);

      expect(screen.getByTestId('create-invoice-modal')).toBeInTheDocument();

      // Fill in invoice fields
      fireEvent.change(screen.getByTestId('input-account-id'), { target: { value: 'acc-testing-corp' } });
      fireEvent.change(screen.getByTestId('input-invoice-number'), { target: { value: 'INV-2026-777' } });
      fireEvent.change(screen.getByTestId('input-amount'), { target: { value: '95000' } });

      // Submit form
      const submitBtn = screen.getByTestId('submit-create-invoice');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            account_id: 'acc-testing-corp',
            invoice_number: 'INV-2026-777',
            amount: 95000,
          })
        );
      });
    });

    it('handles delete invoice action with confirmation', async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(<InvoiceListTable onDeleteInvoice={onDelete} />);

      const deleteBtn = screen.getByTestId('delete-invoice-inv-101');
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(onDelete).toHaveBeenCalledWith('inv-101');
      });
    });

    it('displays loading state when isLoading is true', () => {
      render(<InvoiceListTable isLoading={true} />);
      expect(screen.getByTestId('invoice-loading-state')).toBeInTheDocument();
      expect(screen.getByText('⌛ Loading invoice tracking data...')).toBeInTheDocument();
    });

    it('displays empty state when filtered result is empty', () => {
      render(<InvoiceListTable invoices={[]} />);
      expect(screen.getByTestId('invoice-empty-state')).toBeInTheDocument();
      expect(screen.getByText('No invoice records found')).toBeInTheDocument();
    });

    it('displays error banner when error prop is supplied', () => {
      render(<InvoiceListTable error="Failed to connect to billing database" />);
      expect(screen.getByTestId('invoice-error-banner')).toBeInTheDocument();
      expect(screen.getByText(/Failed to connect to billing database/i)).toBeInTheDocument();
    });
  });
});
