import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TicketsService,
  ticketsService,
  createTicket,
  listTickets,
  getTicket,
  getTicketDetail,
  addReply,
  addTicketReply,
  updateStatus,
  updateTicketStatus,
  submitCSAT,
  deleteTicket,
  getPerformanceReport,
  downloadAttachment,
  Ticket,
  TicketDetail,
  TicketEvent,
  CSATResponse,
  PaginatedTickets,
  PerformanceReport,
} from '../src/services/tickets';
import { ApiClient } from '../src/lib/api_client';

describe('TicketsService', () => {
  let mockClient: ApiClient;
  let service: TicketsService;

  beforeEach(() => {
    mockClient = new ApiClient('http://localhost:8000');
    service = new TicketsService(mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTicket', () => {
    it('should POST new ticket with JSON payload when no file is attached', async () => {
      const mockTicket: Ticket = {
        id: 'tkt-1',
        title: 'Login issue',
        description: 'Unable to login to portal',
        severity: 'P2',
        status: 'NEW',
        escalation_tier: 1,
        organization_id: 'org-123',
        creator_user_id: 'usr-1',
        assigned_agent_id: null,
        response_due_at: '2026-03-30T14:00:00Z',
        resolution_due_at: '2026-03-31T10:00:00Z',
        is_sla_breached: false,
        created_at: '2026-03-30T10:00:00Z',
        updated_at: '2026-03-30T10:00:00Z',
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(mockTicket);

      const result = await service.createTicket({
        title: 'Login issue',
        description: 'Unable to login to portal',
        severity: 'P2',
        organization_id: 'org-123',
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/tickets',
        {
          title: 'Login issue',
          description: 'Unable to login to portal',
          severity: 'P2',
          organization_id: 'org-123',
        },
        expect.objectContaining({})
      );
      expect(result).toEqual(mockTicket);
    });

    it('should send FormData payload when a file attachment is provided', async () => {
      const mockTicket: Ticket = {
        id: 'tkt-2',
        title: 'Bug report',
        description: 'See attachment',
        severity: 'P1',
        status: 'NEW',
        escalation_tier: 1,
        organization_id: 'org-123',
        creator_user_id: 'usr-1',
        assigned_agent_id: null,
        response_due_at: '2026-03-30T11:00:00Z',
        resolution_due_at: '2026-03-30T14:00:00Z',
        is_sla_breached: false,
        created_at: '2026-03-30T10:00:00Z',
        updated_at: '2026-03-30T10:00:00Z',
      };

      vi.spyOn(mockClient, 'request').mockResolvedValueOnce(mockTicket);

      const mockFile = new File(['content'], 'error.log', { type: 'text/plain' });
      const result = await service.createTicket({
        title: 'Bug report',
        description: 'See attachment',
        severity: 'P1',
        file: mockFile,
      });

      expect(mockClient.request).toHaveBeenCalledWith(
        '/api/v1/tickets',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(result).toEqual(mockTicket);
    });
  });

  describe('listTickets', () => {
    it('should fetch paginated tickets list with query parameters and role headers', async () => {
      const mockResponse: PaginatedTickets = {
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        pages: 0,
      };

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockResponse);

      const result = await service.listTickets({
        status: 'NEW',
        severity: 'P1',
        page: 1,
        limit: 10,
        roles: 'support_agent',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/tickets',
        expect.objectContaining({
          params: expect.objectContaining({
            status: 'NEW',
            severity: 'P1',
            page: 1,
            limit: 10,
          }),
          headers: expect.objectContaining({
            'X-User-Roles': 'support_agent',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getTicket / getTicketDetail', () => {
    it('should fetch ticket detail with audit event history', async () => {
      const mockTicketDetail: TicketDetail = {
        id: 'tkt-1',
        title: 'Issue',
        description: 'Detail',
        severity: 'P3',
        status: 'IN_PROGRESS',
        escalation_tier: 1,
        organization_id: 'org-1',
        creator_user_id: 'usr-1',
        response_due_at: '2026-03-30T10:00:00Z',
        resolution_due_at: '2026-03-30T10:00:00Z',
        is_sla_breached: false,
        created_at: '2026-03-30T10:00:00Z',
        updated_at: '2026-03-30T10:00:00Z',
        events: [
          {
            id: 'evt-1',
            ticket_id: 'tkt-1',
            author_id: 'usr-1',
            event_type: 'TICKET_CREATED',
            content: 'Ticket created',
            created_at: '2026-03-30T10:00:00Z',
          },
        ],
      };

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockTicketDetail);

      const result = await service.getTicket('tkt-1');
      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/tickets/tkt-1', expect.anything());
      expect(result).toEqual(mockTicketDetail);
    });

    it('should support getTicketDetail alias', async () => {
      vi.spyOn(mockClient, 'get').mockResolvedValueOnce({ id: 'tkt-1' } as any);
      await service.getTicketDetail('tkt-1');
      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/tickets/tkt-1', expect.anything());
    });
  });

  describe('addReply / addTicketReply', () => {
    it('should POST JSON reply when no file attached', async () => {
      const mockEvent: TicketEvent = {
        id: 'evt-2',
        ticket_id: 'tkt-1',
        author_id: 'usr-2',
        event_type: 'COMMENT',
        content: 'Working on it',
        created_at: '2026-03-30T11:00:00Z',
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(mockEvent);

      const result = await service.addReply('tkt-1', { content: 'Working on it' });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/tickets/tkt-1/replies',
        { content: 'Working on it' },
        expect.anything()
      );
      expect(result).toEqual(mockEvent);
    });

    it('should send FormData when file attached to reply', async () => {
      const mockEvent: TicketEvent = {
        id: 'evt-3',
        ticket_id: 'tkt-1',
        author_id: 'usr-2',
        event_type: 'ATTACHMENT_ADDED',
        content: 'Screenshot attached',
        attachment_filename: 'screen.png',
        created_at: '2026-03-30T11:00:00Z',
      };

      vi.spyOn(mockClient, 'request').mockResolvedValueOnce(mockEvent);

      const file = new File(['png'], 'screen.png', { type: 'image/png' });
      const result = await service.addTicketReply('tkt-1', {
        content: 'Screenshot attached',
        file,
      });

      expect(mockClient.request).toHaveBeenCalledWith(
        '/api/v1/tickets/tkt-1/replies',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(result).toEqual(mockEvent);
    });
  });

  describe('updateStatus / updateTicketStatus', () => {
    it('should PATCH ticket status and severity', async () => {
      const mockTicket: Ticket = {
        id: 'tkt-1',
        title: 'Issue',
        description: 'Desc',
        severity: 'P1',
        status: 'RESOLVED',
        escalation_tier: 1,
        organization_id: 'org-1',
        creator_user_id: 'usr-1',
        response_due_at: '2026-03-30T10:00:00Z',
        resolution_due_at: '2026-03-30T10:00:00Z',
        is_sla_breached: false,
        created_at: '2026-03-30T10:00:00Z',
        updated_at: '2026-03-30T12:00:00Z',
      };

      vi.spyOn(mockClient, 'patch').mockResolvedValueOnce(mockTicket);

      const result = await service.updateStatus('tkt-1', {
        status: 'RESOLVED',
        comment: 'Resolved issue',
      });

      expect(mockClient.patch).toHaveBeenCalledWith(
        '/api/v1/tickets/tkt-1/status',
        { status: 'RESOLVED', comment: 'Resolved issue' },
        expect.anything()
      );
      expect(result).toEqual(mockTicket);
    });

    it('should support updateTicketStatus alias', async () => {
      vi.spyOn(mockClient, 'patch').mockResolvedValueOnce({ id: 'tkt-1' } as any);
      await service.updateTicketStatus('tkt-1', { status: 'CLOSED' });
      expect(mockClient.patch).toHaveBeenCalledWith(
        '/api/v1/tickets/tkt-1/status',
        { status: 'CLOSED' },
        expect.anything()
      );
    });
  });

  describe('submitCSAT', () => {
    it('should POST CSAT survey response', async () => {
      const mockCSAT: CSATResponse = {
        id: 'csat-1',
        ticket_id: 'tkt-1',
        rating: 5,
        feedback_text: 'Great support!',
        user_id: 'usr-1',
        submitted_at: '2026-03-30T12:30:00Z',
      };

      vi.spyOn(mockClient, 'post').mockResolvedValueOnce(mockCSAT);

      const result = await service.submitCSAT('tkt-1', {
        rating: 5,
        feedback_text: 'Great support!',
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/tickets/tkt-1/csat',
        { rating: 5, feedback_text: 'Great support!' },
        expect.anything()
      );
      expect(result).toEqual(mockCSAT);
    });
  });

  describe('deleteTicket', () => {
    it('should send DELETE request to ticket endpoint', async () => {
      vi.spyOn(mockClient, 'delete').mockResolvedValueOnce(undefined as any);

      await service.deleteTicket('tkt-1');

      expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/tickets/tkt-1', expect.anything());
    });
  });

  describe('getPerformanceReport', () => {
    it('should GET operational performance metrics report', async () => {
      const mockReport: PerformanceReport = {
        total_tickets: 10,
        open_tickets: 2,
        resolved_tickets: 8,
        mttr: {
          total_resolved_tickets: 8,
          average_seconds: 3600,
          average_hours: 1.0,
          formatted_mttr: '1h 0m',
        },
        sla_compliance: {
          total_tickets: 10,
          compliant_tickets: 9,
          breached_tickets: 1,
          compliance_percentage: 90.0,
        },
        csat: {
          total_responses: 5,
          average_rating: 4.8,
          satisfied_count: 5,
          satisfaction_percentage: 100.0,
          rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 4 },
        },
        severity_breakdown: {},
      };

      vi.spyOn(mockClient, 'get').mockResolvedValueOnce(mockReport);

      const result = await service.getPerformanceReport({
        organization_id: 'org-1',
        severity: 'P1',
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/v1/reports/performance',
        expect.objectContaining({
          params: expect.objectContaining({
            organization_id: 'org-1',
            severity: 'P1',
          }),
        })
      );
      expect(result).toEqual(mockReport);
    });
  });

  describe('downloadAttachment', () => {
    it('should fetch attachment file blob from download endpoint', async () => {
      const mockBlob = new Blob(['attachment data'], { type: 'text/plain' });
      const globalFetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(mockBlob, { status: 200, headers: { 'content-type': 'text/plain' } })
      );

      const result = await service.downloadAttachment('tkt-1', 'logfile.txt');

      expect(globalFetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/tickets/tkt-1/attachments/logfile.txt'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('standalone exported functions', () => {
    it('should delegate standalone function calls to default ticketsService instance', async () => {
      vi.spyOn(ticketsService, 'listTickets').mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        pages: 0,
      });

      const res = await listTickets();
      expect(ticketsService.listTickets).toHaveBeenCalled();
      expect(res.total).toBe(0);
    });
  });
});
