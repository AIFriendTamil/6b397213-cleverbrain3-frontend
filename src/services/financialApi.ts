/**
 * Financial Operations and Notification Central Hub API Client Service.
 * Provides typed methods and data schemas for AR aging, ARR trends, quote workflows,
 * invoice tracking, notification preferences matrix, and central in-app notification hub.
 */

import { apiClient, ApiClient, ApiClientOptions } from '../lib/api_client';

// ============================================================================
// Data Types and Interfaces
// ============================================================================

/**
 * AR Aging bucket summary response schema.
 */
export interface ArAgingResponse {
  account_id: string;
  current_balance: number;
  bucket_30_balance: number;
  bucket_60_balance: number;
  bucket_90_plus_balance: number;
  total_outstanding: number;
  as_of_timestamp: string;
}

/**
 * Alias for ArAgingResponse.
 */
export type ArAgingBucketSummary = ArAgingResponse;

/**
 * Single Annual Recurring Revenue (ARR) trend data point.
 */
export interface ArrTrendDataPoint {
  id: string;
  account_id: string;
  metric_period: string;
  arr_value: number;
  currency: string;
  original_currency: string;
  recorded_at: string;
}

/**
 * Overall financial dashboard summary response.
 */
export interface FinancialDashboardSummary {
  account_id: string;
  ar_aging: ArAgingResponse;
  arr_trends: ArrTrendDataPoint[];
  total_arr: number;
  target_currency: string;
  calculated_at: string;
}

/**
 * Commercial quote lifecycle status.
 */
export type QuoteStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | string;

/**
 * Single step in a multi-step quote approval workflow.
 */
export interface QuoteApprovalStep {
  id: string;
  quote_id: string;
  approver_id?: string | null;
  step_number: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  comment?: string | null;
  decided_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Commercial quote entity representation.
 */
export interface Quote {
  id: string;
  account_id: string;
  title: string;
  status: QuoteStatus;
  total_amount: number;
  created_at: string;
  updated_at: string;
  approval_steps: QuoteApprovalStep[];
  approvals: QuoteApprovalStep[];
}

/**
 * Payload for creating a new quote.
 */
export interface QuoteCreatePayload {
  account_id: string;
  title: string;
  total_amount: number;
  approver_ids?: string[];
}

/**
 * Payload for submitting a draft quote for approval.
 */
export interface QuoteSubmitPayload {
  approver_ids: string[];
}

/**
 * Payload for submitting a manager approval decision.
 */
export interface QuoteApprovalDecisionPayload {
  step_number: number;
  decision: 'APPROVED' | 'REJECTED' | string;
  comment?: string | null;
  approver_id?: string | null;
}

/**
 * Invoice payment status.
 */
export type InvoicePaymentStatus = 'UNPAID' | 'PAID' | 'OVERDUE' | 'PARTIALLY_PAID' | string;

/**
 * Invoice entity representation.
 */
export interface Invoice {
  id: string;
  account_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  payment_status: InvoicePaymentStatus;
  created_at: string;
}

/**
 * Payload for creating a new invoice record.
 */
export interface InvoiceCreatePayload {
  account_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount: number;
  payment_status?: InvoicePaymentStatus;
}

/**
 * Payload for updating invoice payment status.
 */
export interface InvoiceUpdateStatusPayload {
  payment_status: InvoicePaymentStatus;
}

/**
 * Payload for updating general invoice details.
 */
export interface InvoiceUpdatePayload {
  amount?: number;
  payment_status?: InvoicePaymentStatus;
  issue_date?: string;
  due_date?: string;
}

/**
 * Notification category classification.
 */
export type NotificationCategory = 'Financial' | 'Milestone' | 'SLA' | string;

/**
 * User notification preference matrix entry for a category.
 */
export interface NotificationPreference {
  id: string;
  user_id: string;
  category: NotificationCategory;
  channel_email: boolean;
  channel_sms: boolean;
  channel_in_app: boolean;
  phone_number?: string | null;
  updated_at: string;
}

/**
 * Payload for updating a single category preference entry.
 */
export interface NotificationPreferenceUpdate {
  category: NotificationCategory;
  channel_email?: boolean;
  channel_sms?: boolean;
  channel_in_app?: boolean;
  phone_number?: string | null;
}

/**
 * Payload for bulk updating preferences matrix.
 */
export interface NotificationPreferenceMatrixUpdate {
  preferences: NotificationPreferenceUpdate[];
}

/**
 * In-app central notification item.
 */
export interface NotificationItem {
  id: string;
  user_id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

/**
 * Alias for NotificationItem.
 */
export type Notification = NotificationItem;

/**
 * Payload for toggling notification read status.
 */
export interface NotificationReadUpdate {
  is_read: boolean;
}

/**
 * Request payload for bulk marking notifications as read.
 */
export interface MarkAllReadRequest {
  category?: NotificationCategory;
}

/**
 * Response payload for bulk mark all read operation.
 */
export interface MarkAllReadResponse {
  marked_count: number;
  message: string;
}

// ============================================================================
// Service Class Implementation
// ============================================================================

export class FinancialApiService {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  // --------------------------------------------------------------------------
  // Financial Dashboard / AR Aging & ARR Trends
  // --------------------------------------------------------------------------

  /**
   * Retrieve Accounts Receivable (AR) aging bucket balances.
   */
  public async getArAging(
    params?: { account_id?: string; force_recalculate?: boolean },
    options?: ApiClientOptions
  ): Promise<ArAgingResponse> {
    return this.client.get<ArAgingResponse>('/api/v1/financial/ar-aging', {
      ...options,
      params: {
        ...(params?.account_id ? { account_id: params.account_id } : {}),
        ...(params?.force_recalculate !== undefined ? { force_recalculate: params.force_recalculate } : {}),
        ...(options?.params || {}),
      },
    });
  }

  /**
   * Retrieve Annual Recurring Revenue (ARR) trend data points.
   */
  public async getArrTrends(
    params?: { account_id?: string; period_range?: string; target_currency?: string },
    options?: ApiClientOptions
  ): Promise<ArrTrendDataPoint[]> {
    return this.client.get<ArrTrendDataPoint[]>('/api/v1/financial/arr-trends', {
      ...options,
      params: {
        ...(params?.account_id ? { account_id: params.account_id } : {}),
        ...(params?.period_range ? { period_range: params.period_range } : {}),
        ...(params?.target_currency ? { target_currency: params.target_currency } : {}),
        ...(options?.params || {}),
      },
    });
  }

  /**
   * Retrieve overall financial dashboard overview data (aging + trends + total ARR).
   */
  public async getFinancialDashboard(
    params?: { account_id?: string; target_currency?: string },
    options?: ApiClientOptions
  ): Promise<FinancialDashboardSummary> {
    return this.client.get<FinancialDashboardSummary>('/api/v1/financial/dashboard', {
      ...options,
      params: {
        ...(params?.account_id ? { account_id: params.account_id } : {}),
        ...(params?.target_currency ? { target_currency: params.target_currency } : {}),
        ...(options?.params || {}),
      },
    });
  }

  // --------------------------------------------------------------------------
  // Commercial Quotes & Approval Workflows
  // --------------------------------------------------------------------------

  /**
   * List quotes optionally filtered by account ID and lifecycle status.
   */
  public async getQuotes(
    params?: { account_id?: string; status?: string },
    options?: ApiClientOptions
  ): Promise<Quote[]> {
    return this.client.get<Quote[]>('/api/v1/financial/quotes', {
      ...options,
      params: {
        ...(params?.account_id ? { account_id: params.account_id } : {}),
        ...(params?.status ? { status: params.status } : {}),
        ...(options?.params || {}),
      },
    });
  }

  /**
   * Create a new commercial quote record.
   */
  public async createQuote(
    payload: QuoteCreatePayload,
    options?: ApiClientOptions
  ): Promise<Quote> {
    return this.client.post<Quote>('/api/v1/financial/quotes', payload, options);
  }

  /**
   * Get a single quote record by quote ID.
   */
  public async getQuoteById(
    quoteId: string,
    options?: ApiClientOptions
  ): Promise<Quote> {
    return this.client.get<Quote>(`/api/v1/financial/quotes/${quoteId}`, options);
  }

  /**
   * Submit a draft quote for multi-step management approval sequence.
   */
  public async submitQuoteForApproval(
    quoteId: string,
    payload: QuoteSubmitPayload,
    options?: ApiClientOptions
  ): Promise<Quote> {
    return this.client.post<Quote>(
      `/api/v1/financial/quotes/${quoteId}/submit`,
      payload,
      options
    );
  }

  /**
   * Submit a manager approval decision for a specific workflow step.
   */
  public async approveQuote(
    quoteId: string,
    payload: QuoteApprovalDecisionPayload,
    options?: ApiClientOptions
  ): Promise<Quote> {
    return this.client.post<Quote>(
      `/api/v1/financial/quotes/${quoteId}/approve`,
      payload,
      options
    );
  }

  /**
   * Alias for approveQuote to process an approval or rejection step.
   */
  public async processQuoteApproval(
    quoteId: string,
    payload: QuoteApprovalDecisionPayload,
    options?: ApiClientOptions
  ): Promise<Quote> {
    return this.approveQuote(quoteId, payload, options);
  }

  /**
   * Delete a quote record.
   */
  public async deleteQuote(
    quoteId: string,
    options?: ApiClientOptions
  ): Promise<void> {
    await this.client.delete<null>(`/api/v1/financial/quotes/${quoteId}`, options);
  }

  // --------------------------------------------------------------------------
  // Invoices & Payment Tracking
  // --------------------------------------------------------------------------

  /**
   * List invoices optionally filtered by account ID and payment status.
   */
  public async getInvoices(
    params?: { account_id?: string; payment_status?: string },
    options?: ApiClientOptions
  ): Promise<Invoice[]> {
    return this.client.get<Invoice[]>('/api/v1/financial/invoices', {
      ...options,
      params: {
        ...(params?.account_id ? { account_id: params.account_id } : {}),
        ...(params?.payment_status ? { payment_status: params.payment_status } : {}),
        ...(options?.params || {}),
      },
    });
  }

  /**
   * Create a new invoice record.
   */
  public async createInvoice(
    payload: InvoiceCreatePayload,
    options?: ApiClientOptions
  ): Promise<Invoice> {
    return this.client.post<Invoice>('/api/v1/financial/invoices', payload, options);
  }

  /**
   * Get invoice details by invoice ID.
   */
  public async getInvoiceById(
    invoiceId: string,
    options?: ApiClientOptions
  ): Promise<Invoice> {
    return this.client.get<Invoice>(`/api/v1/financial/invoices/${invoiceId}`, options);
  }

  /**
   * Update payment status of an existing invoice.
   */
  public async updateInvoiceStatus(
    invoiceId: string,
    paymentStatus: InvoicePaymentStatus,
    options?: ApiClientOptions
  ): Promise<Invoice> {
    return this.client.patch<Invoice>(
      `/api/v1/financial/invoices/${invoiceId}/status`,
      { payment_status: paymentStatus },
      options
    );
  }

  /**
   * Update details of an existing invoice.
   */
  public async updateInvoice(
    invoiceId: string,
    payload: InvoiceUpdatePayload,
    options?: ApiClientOptions
  ): Promise<Invoice> {
    return this.client.patch<Invoice>(
      `/api/v1/financial/invoices/${invoiceId}`,
      payload,
      options
    );
  }

  /**
   * Delete an invoice record by ID.
   */
  public async deleteInvoice(
    invoiceId: string,
    options?: ApiClientOptions
  ): Promise<void> {
    await this.client.delete<null>(`/api/v1/financial/invoices/${invoiceId}`, options);
  }

  // --------------------------------------------------------------------------
  // Notification Preferences Matrix
  // --------------------------------------------------------------------------

  /**
   * Get notification channel preferences for authenticated user across categories.
   */
  public async getNotificationPreferences(
    options?: ApiClientOptions
  ): Promise<NotificationPreference[]> {
    return this.client.get<NotificationPreference[]>('/api/v1/notifications/preferences', options);
  }

  /**
   * Update notification channel preference matrix for authenticated user.
   */
  public async updateNotificationPreferences(
    payload: NotificationPreferenceUpdate[] | NotificationPreferenceMatrixUpdate,
    options?: ApiClientOptions
  ): Promise<NotificationPreference[]> {
    return this.client.put<NotificationPreference[]>(
      '/api/v1/notifications/preferences',
      payload,
      options
    );
  }

  // --------------------------------------------------------------------------
  // Central Notification Hub
  // --------------------------------------------------------------------------

  /**
   * Retrieve in-app notification alerts for authenticated user.
   */
  public async getNotifications(
    params?: { category?: string; is_read?: boolean },
    options?: ApiClientOptions
  ): Promise<NotificationItem[]> {
    return this.client.get<NotificationItem[]>('/api/v1/notifications/hub', {
      ...options,
      params: {
        ...(params?.category ? { category: params.category } : {}),
        ...(params?.is_read !== undefined ? { is_read: params.is_read } : {}),
        ...(options?.params || {}),
      },
    });
  }

  /**
   * Update read state of a specific in-app notification.
   */
  public async updateNotificationReadStatus(
    notificationId: string,
    isRead: boolean = true,
    options?: ApiClientOptions
  ): Promise<NotificationItem> {
    return this.client.patch<NotificationItem>(
      `/api/v1/notifications/hub/${notificationId}/read`,
      { is_read: isRead },
      options
    );
  }

  /**
   * Bulk mark all unread notifications as read.
   */
  public async markAllNotificationsAsRead(
    params?: { category?: string },
    options?: ApiClientOptions
  ): Promise<MarkAllReadResponse> {
    return this.client.post<MarkAllReadResponse>(
      '/api/v1/notifications/hub/mark-all-read',
      params?.category ? { category: params.category } : {},
      options
    );
  }

  /**
   * Delete an in-app notification record by ID.
   */
  public async deleteNotification(
    notificationId: string,
    options?: ApiClientOptions
  ): Promise<void> {
    await this.client.delete<null>(`/api/v1/notifications/hub/${notificationId}`, options);
  }
}

// Default instance export
export const financialApi = new FinancialApiService();

// Direct export of standalone helper functions for convenient React hook usage
export const getArAging = (params?: { account_id?: string; force_recalculate?: boolean }, options?: ApiClientOptions) =>
  financialApi.getArAging(params, options);

export const getArrTrends = (params?: { account_id?: string; period_range?: string; target_currency?: string }, options?: ApiClientOptions) =>
  financialApi.getArrTrends(params, options);

export const getFinancialDashboard = (params?: { account_id?: string; target_currency?: string }, options?: ApiClientOptions) =>
  financialApi.getFinancialDashboard(params, options);

export const getQuotes = (params?: { account_id?: string; status?: string }, options?: ApiClientOptions) =>
  financialApi.getQuotes(params, options);

export const createQuote = (payload: QuoteCreatePayload, options?: ApiClientOptions) =>
  financialApi.createQuote(payload, options);

export const getQuoteById = (quoteId: string, options?: ApiClientOptions) =>
  financialApi.getQuoteById(quoteId, options);

export const submitQuoteForApproval = (quoteId: string, payload: QuoteSubmitPayload, options?: ApiClientOptions) =>
  financialApi.submitQuoteForApproval(quoteId, payload, options);

export const approveQuote = (quoteId: string, payload: QuoteApprovalDecisionPayload, options?: ApiClientOptions) =>
  financialApi.approveQuote(quoteId, payload, options);

export const processQuoteApproval = (quoteId: string, payload: QuoteApprovalDecisionPayload, options?: ApiClientOptions) =>
  financialApi.processQuoteApproval(quoteId, payload, options);

export const deleteQuote = (quoteId: string, options?: ApiClientOptions) =>
  financialApi.deleteQuote(quoteId, options);

export const getInvoices = (params?: { account_id?: string; payment_status?: string }, options?: ApiClientOptions) =>
  financialApi.getInvoices(params, options);

export const createInvoice = (payload: InvoiceCreatePayload, options?: ApiClientOptions) =>
  financialApi.createInvoice(payload, options);

export const getInvoiceById = (invoiceId: string, options?: ApiClientOptions) =>
  financialApi.getInvoiceById(invoiceId, options);

export const updateInvoiceStatus = (invoiceId: string, paymentStatus: InvoicePaymentStatus, options?: ApiClientOptions) =>
  financialApi.updateInvoiceStatus(invoiceId, paymentStatus, options);

export const updateInvoice = (invoiceId: string, payload: InvoiceUpdatePayload, options?: ApiClientOptions) =>
  financialApi.updateInvoice(invoiceId, payload, options);

export const deleteInvoice = (invoiceId: string, options?: ApiClientOptions) =>
  financialApi.deleteInvoice(invoiceId, options);

export const getNotificationPreferences = (options?: ApiClientOptions) =>
  financialApi.getNotificationPreferences(options);

export const updateNotificationPreferences = (payload: NotificationPreferenceUpdate[] | NotificationPreferenceMatrixUpdate, options?: ApiClientOptions) =>
  financialApi.updateNotificationPreferences(payload, options);

export const getNotifications = (params?: { category?: string; is_read?: boolean }, options?: ApiClientOptions) =>
  financialApi.getNotifications(params, options);

export const updateNotificationReadStatus = (notificationId: string, isRead: boolean = true, options?: ApiClientOptions) =>
  financialApi.updateNotificationReadStatus(notificationId, isRead, options);

export const markAllNotificationsAsRead = (params?: { category?: string }, options?: ApiClientOptions) =>
  financialApi.markAllNotificationsAsRead(params, options);

export const deleteNotification = (notificationId: string, options?: ApiClientOptions) =>
  financialApi.deleteNotification(notificationId, options);

export default financialApi;
