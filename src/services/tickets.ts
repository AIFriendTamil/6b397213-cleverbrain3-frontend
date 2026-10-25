/**
 * Support Ticket and Escalation Management API client service module.
 * Provides typed methods for ticket CRUD, replies, file attachments,
 * status lifecycle updates, CSAT survey submission, and performance reporting.
 */

import { apiClient, ApiClient, ApiClientOptions, ApiError } from '../lib/api_client';

/**
 * Ticket severity classification enum values.
 */
export type TicketSeverity = 'P1' | 'P2' | 'P3' | string;

/**
 * Ticket status lifecycle state enum values.
 */
export type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED' | string;

/**
 * Ticket audit event type enum values.
 */
export type TicketEventType =
  | 'TICKET_CREATED'
  | 'STATUS_CHANGE'
  | 'COMMENT'
  | 'ESCALATION_TRIGGERED'
  | 'ATTACHMENT_ADDED'
  | 'CSAT_SUBMITTED'
  | string;

/**
 * Ticket creation payload.
 */
export interface TicketCreate {
  title: string;
  description: string;
  severity?: TicketSeverity;
  organization_id?: string;
  file?: File | Blob;
}

/**
 * Ticket summary representation schema.
 */
export interface Ticket {
  id: string;
  title: string;
  description: string;
  severity: TicketSeverity;
  status: TicketStatus;
  escalation_tier: number;
  organization_id: string;
  creator_user_id: string;
  assigned_agent_id?: string | null;
  response_due_at: string;
  resolution_due_at: string;
  is_sla_breached: boolean;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

/**
 * Paginated tickets list response schema.
 */
export interface PaginatedTickets {
  items: Ticket[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * Ticket audit event item schema.
 */
export interface TicketEvent {
  id: string;
  ticket_id: string;
  author_id: string;
  event_type: TicketEventType;
  content?: string | null;
  attachment_url?: string | null;
  attachment_filename?: string | null;
  created_at: string;
}

/**
 * Detailed ticket view schema with event history array.
 */
export interface TicketDetail extends Ticket {
  events: TicketEvent[];
}

/**
 * Ticket reply / comment payload.
 */
export interface ReplyCreate {
  content?: string;
  file?: File | Blob;
}

/**
 * Ticket status or severity update payload.
 */
export interface StatusUpdate {
  status?: TicketStatus;
  severity?: TicketSeverity;
  assigned_agent_id?: string;
  comment?: string;
}

/**
 * CSAT survey submission payload.
 */
export interface CSATCreate {
  rating: number; // 1 to 5
  feedback_text?: string;
}

/**
 * CSAT survey response schema.
 */
export interface CSATResponse {
  id: string;
  ticket_id: string;
  rating: number;
  feedback_text?: string | null;
  user_id: string;
  submitted_at: string;
}

/**
 * Query filter parameters for ticket list queries.
 */
export interface ListTicketsParams {
  status?: TicketStatus;
  severity?: TicketSeverity;
  organization_id?: string;
  assigned_agent_id?: string;
  creator_user_id?: string;
  is_sla_breached?: boolean;
  page?: number;
  limit?: number;
  roles?: string;
  x_user_roles?: string;
  x_user_role?: string;
}

/**
 * Query filter parameters for operational performance reporting.
 */
export interface PerformanceReportParams {
  start_time?: string;
  end_time?: string;
  organization_id?: string;
  severity?: TicketSeverity;
  roles?: string;
  x_user_roles?: string;
  x_user_role?: string;
}

/**
 * Mean Time To Resolution (MTTR) metrics schema.
 */
export interface MTTRMetrics {
  total_resolved_tickets: number;
  average_seconds: number;
  average_hours: number;
  formatted_mttr: string;
}

/**
 * SLA compliance metrics schema.
 */
export interface SLAMetrics {
  total_tickets: number;
  compliant_tickets: number;
  breached_tickets: number;
  compliance_percentage: number;
}

/**
 * CSAT survey metrics schema.
 */
export interface CSATMetrics {
  total_responses: number;
  average_rating: number;
  satisfied_count: number;
  satisfaction_percentage: number;
  rating_distribution: Record<number, number>;
}

/**
 * Severity-level performance breakdown schema.
 */
export interface SeverityPerformance {
  total_tickets: number;
  mttr: MTTRMetrics;
  sla_compliance: SLAMetrics;
  csat: CSATMetrics;
}

/**
 * Operational performance report schema.
 */
export interface PerformanceReport {
  start_time?: string | null;
  end_time?: string | null;
  organization_id?: string | null;
  total_tickets: number;
  open_tickets: number;
  resolved_tickets: number;
  mttr: MTTRMetrics;
  sla_compliance: SLAMetrics;
  csat: CSATMetrics;
  severity_breakdown: Record<string, SeverityPerformance>;
}

/**
 * Service class for interacting with support ticket APIs.
 */
export class TicketsService {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  /**
   * Helper to append user role headers if supplied in options/params.
   */
  private buildHeaders(
    params?: { roles?: string; x_user_roles?: string; x_user_role?: string },
    options?: ApiClientOptions
  ): Record<string, string> {
    const customHeaders: Record<string, string> = {
      ...((options?.headers as Record<string, string>) || {}),
    };
    const roleVal = params?.x_user_roles || params?.x_user_role || params?.roles;
    if (roleVal && !customHeaders['X-User-Roles']) {
      customHeaders['X-User-Roles'] = roleVal;
    }
    return customHeaders;
  }

  /**
   * Submit a new support ticket with optional attachment file.
   * [FR-1]
   */
  public async createTicket(
    payload: TicketCreate,
    options?: ApiClientOptions
  ): Promise<Ticket> {
    const headers = this.buildHeaders(undefined, options);

    if (payload.file) {
      const formData = new FormData();
      formData.append('title', payload.title);
      formData.append('description', payload.description);
      if (payload.severity) formData.append('severity', payload.severity);
      if (payload.organization_id) formData.append('organization_id', payload.organization_id);
      formData.append('file', payload.file);

      return this.client.request<Ticket>('/api/v1/tickets', {
        ...options,
        method: 'POST',
        body: formData,
        headers,
      });
    }

    return this.client.post<Ticket>(
      '/api/v1/tickets',
      {
        title: payload.title,
        description: payload.description,
        severity: payload.severity || 'P3',
        organization_id: payload.organization_id,
      },
      {
        ...options,
        headers,
      }
    );
  }

  /**
   * Query paginated list of tickets for authorized tenant.
   * [FR-3, FR-9]
   */
  public async listTickets(
    params?: ListTicketsParams,
    options?: ApiClientOptions
  ): Promise<PaginatedTickets> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.status !== undefined) queryParams.status = params.status;
    if (params?.severity !== undefined) queryParams.severity = params.severity;
    if (params?.organization_id !== undefined) queryParams.organization_id = params.organization_id;
    if (params?.assigned_agent_id !== undefined) queryParams.assigned_agent_id = params.assigned_agent_id;
    if (params?.creator_user_id !== undefined) queryParams.creator_user_id = params.creator_user_id;
    if (params?.is_sla_breached !== undefined) queryParams.is_sla_breached = params.is_sla_breached;
    if (params?.page !== undefined) queryParams.page = params.page;
    if (params?.limit !== undefined) queryParams.limit = params.limit;

    const headers = this.buildHeaders(params, options);

    return this.client.get<PaginatedTickets>('/api/v1/tickets', {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
      headers,
    });
  }

  /**
   * Get details and chronological event history for a support ticket.
   * [FR-3]
   */
  public async getTicket(
    id: string,
    options?: ApiClientOptions
  ): Promise<TicketDetail> {
    const headers = this.buildHeaders(undefined, options);
    return this.client.get<TicketDetail>(`/api/v1/tickets/${encodeURIComponent(id)}`, {
      ...options,
      headers,
    });
  }

  /**
   * Alias for getTicket.
   * [FR-3]
   */
  public async getTicketDetail(
    id: string,
    options?: ApiClientOptions
  ): Promise<TicketDetail> {
    return this.getTicket(id, options);
  }

  /**
   * Add a comment, reply, or file attachment to a ticket.
   * [FR-1, FR-3]
   */
  public async addReply(
    ticketId: string,
    payload: ReplyCreate,
    options?: ApiClientOptions
  ): Promise<TicketEvent> {
    const headers = this.buildHeaders(undefined, options);

    if (payload.file) {
      const formData = new FormData();
      if (payload.content) formData.append('content', payload.content);
      formData.append('file', payload.file);

      return this.client.request<TicketEvent>(
        `/api/v1/tickets/${encodeURIComponent(ticketId)}/replies`,
        {
          ...options,
          method: 'POST',
          body: formData,
          headers,
        }
      );
    }

    return this.client.post<TicketEvent>(
      `/api/v1/tickets/${encodeURIComponent(ticketId)}/replies`,
      {
        content: payload.content,
      },
      {
        ...options,
        headers,
      }
    );
  }

  /**
   * Alias for addReply.
   * [FR-1, FR-3]
   */
  public async addTicketReply(
    ticketId: string,
    payload: ReplyCreate,
    options?: ApiClientOptions
  ): Promise<TicketEvent> {
    return this.addReply(ticketId, payload, options);
  }

  /**
   * Update support ticket status state, severity, or agent assignment.
   * [FR-3]
   */
  public async updateStatus(
    ticketId: string,
    payload: StatusUpdate,
    options?: ApiClientOptions
  ): Promise<Ticket> {
    const headers = this.buildHeaders(undefined, options);
    return this.client.patch<Ticket>(
      `/api/v1/tickets/${encodeURIComponent(ticketId)}/status`,
      payload,
      {
        ...options,
        headers,
      }
    );
  }

  /**
   * Alias for updateStatus.
   * [FR-3]
   */
  public async updateTicketStatus(
    ticketId: string,
    payload: StatusUpdate,
    options?: ApiClientOptions
  ): Promise<Ticket> {
    return this.updateStatus(ticketId, payload, options);
  }

  /**
   * Submit post-resolution CSAT survey feedback rating and comments.
   * [FR-8]
   */
  public async submitCSAT(
    ticketId: string,
    payload: CSATCreate,
    options?: ApiClientOptions
  ): Promise<CSATResponse> {
    const headers = this.buildHeaders(undefined, options);
    return this.client.post<CSATResponse>(
      `/api/v1/tickets/${encodeURIComponent(ticketId)}/csat`,
      payload,
      {
        ...options,
        headers,
      }
    );
  }

  /**
   * Delete support ticket record.
   * [FR-3]
   */
  public async deleteTicket(
    ticketId: string,
    options?: ApiClientOptions
  ): Promise<void> {
    const headers = this.buildHeaders(undefined, options);
    await this.client.delete<void>(`/api/v1/tickets/${encodeURIComponent(ticketId)}`, {
      ...options,
      headers,
    });
  }

  /**
   * Query operational performance metrics (MTTR, SLA compliance, CSAT statistics).
   * [FR-9]
   */
  public async getPerformanceReport(
    params?: PerformanceReportParams,
    options?: ApiClientOptions
  ): Promise<PerformanceReport> {
    const queryParams: Record<string, string | number | boolean | undefined | null> = {};
    if (params?.start_time !== undefined) queryParams.start_time = params.start_time;
    if (params?.end_time !== undefined) queryParams.end_time = params.end_time;
    if (params?.organization_id !== undefined) queryParams.organization_id = params.organization_id;
    if (params?.severity !== undefined) queryParams.severity = params.severity;

    const headers = this.buildHeaders(params, options);

    return this.client.get<PerformanceReport>('/api/v1/reports/performance', {
      ...options,
      params: {
        ...queryParams,
        ...(options?.params || {}),
      },
      headers,
    });
  }

  /**
   * Download stored ticket attachment file as Blob.
   * [FR-1]
   */
  public async downloadAttachment(
    ticketId: string,
    filename: string,
    options?: ApiClientOptions
  ): Promise<Blob> {
    const headers = this.buildHeaders(undefined, options);
    const endpoint = `/api/v1/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(filename)}`;
    const base = options?.baseUrl || (this.client as any).baseUrl || 'http://localhost:8000';
    const url = `${base.replace(/\/$/, '')}${endpoint}`;

    const activeToken = options?.token ?? this.client.getSessionToken();
    if (activeToken) {
      headers['X-Session-ID'] = activeToken;
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: options?.credentials || 'include',
    });

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {
        // Fallback
      }
      throw new ApiError(errorMessage, response.status, 'DOWNLOAD_ERROR');
    }

    return response.blob();
  }
}

// Export class alias
export { TicketsService as TicketsClient };

// Singleton instances
export const ticketsService = new TicketsService();
export const ticketsClient = ticketsService;

// Standalone exported functions
export const createTicket = (
  payload: TicketCreate,
  options?: ApiClientOptions
): Promise<Ticket> => ticketsService.createTicket(payload, options);

export const listTickets = (
  params?: ListTicketsParams,
  options?: ApiClientOptions
): Promise<PaginatedTickets> => ticketsService.listTickets(params, options);

export const getTicket = (
  id: string,
  options?: ApiClientOptions
): Promise<TicketDetail> => ticketsService.getTicket(id, options);

export const getTicketDetail = (
  id: string,
  options?: ApiClientOptions
): Promise<TicketDetail> => ticketsService.getTicketDetail(id, options);

export const addReply = (
  ticketId: string,
  payload: ReplyCreate,
  options?: ApiClientOptions
): Promise<TicketEvent> => ticketsService.addReply(ticketId, payload, options);

export const addTicketReply = (
  ticketId: string,
  payload: ReplyCreate,
  options?: ApiClientOptions
): Promise<TicketEvent> => ticketsService.addTicketReply(ticketId, payload, options);

export const updateStatus = (
  ticketId: string,
  payload: StatusUpdate,
  options?: ApiClientOptions
): Promise<Ticket> => ticketsService.updateStatus(ticketId, payload, options);

export const updateTicketStatus = (
  ticketId: string,
  payload: StatusUpdate,
  options?: ApiClientOptions
): Promise<Ticket> => ticketsService.updateTicketStatus(ticketId, payload, options);

export const submitCSAT = (
  ticketId: string,
  payload: CSATCreate,
  options?: ApiClientOptions
): Promise<CSATResponse> => ticketsService.submitCSAT(ticketId, payload, options);

export const deleteTicket = (
  ticketId: string,
  options?: ApiClientOptions
): Promise<void> => ticketsService.deleteTicket(ticketId, options);

export const getPerformanceReport = (
  params?: PerformanceReportParams,
  options?: ApiClientOptions
): Promise<PerformanceReport> => ticketsService.getPerformanceReport(params, options);

export const downloadAttachment = (
  ticketId: string,
  filename: string,
  options?: ApiClientOptions
): Promise<Blob> => ticketsService.downloadAttachment(ticketId, filename, options);
