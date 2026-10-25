'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedRoute, useAuth } from '../../../components/protected_route';
import { NavMenu } from '../../../components/nav_menu';
import { SLATimer } from '../../../components/tickets/SLATimer';
import { CommunicationThread } from '../../../components/tickets/CommunicationThread';
import { CSATModal } from '../../../components/tickets/CSATModal';
import { CurrentUserResponse } from '../../../services/auth';
import {
  getTicketDetail as defaultGetTicketDetail,
  addTicketReply as defaultAddTicketReply,
  updateTicketStatus as defaultUpdateTicketStatus,
  submitCSAT as defaultSubmitCSAT,
  deleteTicket as defaultDeleteTicket,
  Ticket,
  TicketDetail,
  TicketEvent,
  TicketSeverity,
  TicketStatus,
  ReplyCreate,
  StatusUpdate,
  CSATCreate,
  CSATResponse,
} from '../../../services/tickets';

/**
 * Component properties for Support Ticket Detail View Page.
 */
export interface TicketDetailPageProps {
  /** Next.js App Router route params object or promise containing ticket id */
  params?: { id: string } | Promise<{ id: string }>;
  /** Explicit ticket ID override */
  ticketId?: string;
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Preloaded initial ticket detail record */
  initialTicket?: TicketDetail | null;
  /** Whether the component should automatically fetch ticket data on mount (default: true) */
  autoFetch?: boolean;
  /** Custom ticket detail fetcher function override */
  fetchTicket?: (id: string) => Promise<TicketDetail>;
  /** Custom reply creation handler override */
  onAddReply?: (ticketId: string, payload: ReplyCreate) => Promise<TicketEvent>;
  /** Custom status update handler override */
  onUpdateStatus?: (ticketId: string, payload: StatusUpdate) => Promise<Ticket>;
  /** Custom CSAT survey submission handler override */
  onSubmitCSAT?: (ticketId: string, payload: CSATCreate) => Promise<CSATResponse>;
  /** Custom ticket deletion handler override */
  onDeleteTicket?: (ticketId: string) => Promise<void>;
  /** Optional custom container CSS class name */
  className?: string;
}

/**
 * Helper to compute status badge visual styling and display text.
 */
function getStatusBadgeStyle(status?: string): { bg: string; color: string; border: string; label: string } {
  const norm = (status || '').toUpperCase();
  switch (norm) {
    case 'NEW':
      return { bg: 'var(--color-surface-container, #f0eee9)', color: 'var(--color-primary, #59452b)', border: 'var(--color-outline-variant, #d1c4b9)', label: 'New' };
    case 'IN_PROGRESS':
      return { bg: 'var(--color-tertiary-fixed, #d0e4ff)', color: 'var(--color-on-tertiary-fixed, #071d30)', border: 'var(--color-tertiary, #374a5f)', label: 'In Progress' };
    case 'ESCALATED':
      return { bg: 'var(--color-error-container, #ffdad6)', color: 'var(--color-on-error-container, #93000a)', border: 'var(--color-error, #ba1a1a)', label: 'Escalated' };
    case 'RESOLVED':
      return { bg: '#e8f5e9', color: '#1b4332', border: '#2e6b38', label: 'Resolved' };
    case 'CLOSED':
      return { bg: 'var(--color-surface-dim, #dbdad5)', color: 'var(--color-on-surface-variant, #4e453d)', border: 'var(--color-outline, #80756b)', label: 'Closed' };
    default:
      return { bg: 'var(--color-surface-container-high, #eae8e3)', color: 'var(--color-on-surface, #1b1c19)', border: 'var(--color-outline-variant, #d1c4b9)', label: status || 'Unknown' };
  }
}

/**
 * Helper to compute severity badge visual styling.
 */
function getSeverityBadgeStyle(severity?: string): { bg: string; color: string; label: string } {
  const norm = (severity || '').toUpperCase();
  switch (norm) {
    case 'P1':
      return { bg: '#ba1a1a', color: '#ffffff', label: 'P1 Critical' };
    case 'P2':
      return { bg: '#735c41', color: '#ffffff', label: 'P2 High' };
    case 'P3':
      return { bg: '#4f6278', color: '#ffffff', label: 'P3 Standard' };
    default:
      return { bg: '#80756b', color: '#ffffff', label: severity || 'Standard' };
  }
}

/**
 * Format ISO timestamp into human-readable date and time string.
 */
function formatDateTime(isoString?: string | null): string {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Inner Ticket Detail View content component consuming active user session context.
 * Integrates live SLA timer, chronological audit communication feed, status lifecycle controls,
 * and CSAT survey prompt modal styled per Linen & Logic design system guidelines.
 */
function _TicketDetailContent({
  params,
  ticketId: explicitTicketId,
  user: explicitUser,
  onLogout,
  initialTicket,
  autoFetch = true,
  fetchTicket: customFetchTicket,
  onAddReply: customOnAddReply,
  onUpdateStatus: customOnUpdateStatus,
  onSubmitCSAT: customOnSubmitCSAT,
  onDeleteTicket: customOnDeleteTicket,
  className = '',
}: TicketDetailPageProps) {
  const router = useRouter();
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  // Resolve target ticket ID from prop override, params object, or Promise
  const [resolvedId, setResolvedId] = useState<string>(() => {
    if (explicitTicketId) return explicitTicketId;
    if (params && 'id' in params && typeof (params as any).id === 'string') {
      return (params as any).id;
    }
    return '';
  });

  useEffect(() => {
    if (explicitTicketId) {
      setResolvedId(explicitTicketId);
    } else if (params) {
      if (typeof (params as any).then === 'function') {
        (params as Promise<{ id: string }>).then((res) => {
          if (res?.id) setResolvedId(res.id);
        });
      } else if ('id' in params && typeof (params as any).id === 'string') {
        setResolvedId((params as any).id);
      }
    }
  }, [params, explicitTicketId]);

  // Data and UI state
  const [ticket, setTicket] = useState<TicketDetail | null>(initialTicket || null);
  const [isLoading, setIsLoading] = useState<boolean>(autoFetch && !initialTicket && Boolean(resolvedId));
  const [error, setError] = useState<string | null>(null);

  // Status update form state
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>('NEW');
  const [selectedSeverity, setSelectedSeverity] = useState<TicketSeverity>('P3');
  const [assignedAgentInput, setAssignedAgentInput] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState<string | null>(null);

  // CSAT survey state
  const [isCSATModalOpen, setIsCSATModalOpen] = useState<boolean>(false);
  const [hasSubmittedCSAT, setHasSubmittedCSAT] = useState<boolean>(false);
  const [csatResponse, setCsatResponse] = useState<CSATResponse | null>(null);

  // Deletion state
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Sync ticket form inputs when ticket data is set
  useEffect(() => {
    if (ticket) {
      setSelectedStatus(ticket.status || 'NEW');
      setSelectedSeverity(ticket.severity || 'P3');
      setAssignedAgentInput(ticket.assigned_agent_id || '');

      // Check if CSAT survey was already recorded in audit events
      const csatEvent = ticket.events?.find((e) => e.event_type === 'CSAT_SUBMITTED');
      if (csatEvent) {
        setHasSubmittedCSAT(true);
      }
    }
  }, [ticket]);

  /**
   * Fetch full ticket detail including events list from API.
   */
  const loadTicket = useCallback(async () => {
    if (!resolvedId) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = customFetchTicket
        ? await customFetchTicket(resolvedId)
        : await defaultGetTicketDetail(resolvedId);

      setTicket(data);
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch ticket details. Please verify the ID or authorization.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedId, customFetchTicket]);

  // Trigger initial ticket load if resolvedId is available and no initialTicket provided
  useEffect(() => {
    if (resolvedId && !initialTicket && autoFetch) {
      loadTicket();
    }
  }, [resolvedId, initialTicket, autoFetch, loadTicket]);

  /**
   * Handle adding a comment, reply, or file attachment to the ticket thread.
   */
  const handleAddReply = async (payload: ReplyCreate): Promise<TicketEvent> => {
    if (!resolvedId) throw new Error('Missing ticket ID for reply submission.');

    try {
      const newEvent = customOnAddReply
        ? await customOnAddReply(resolvedId, payload)
        : await defaultAddTicketReply(resolvedId, payload);

      if (ticket) {
        setTicket({
          ...ticket,
          events: [...(ticket.events || []), newEvent],
          updated_at: new Date().toISOString(),
        });
      } else {
        await loadTicket();
      }

      return newEvent;
    } catch (err: any) {
      throw err;
    }
  };

  /**
   * Handle ticket status, severity, or agent assignment updates.
   */
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedId || !ticket) return;

    setIsUpdatingStatus(true);
    setStatusUpdateError(null);
    setStatusUpdateSuccess(null);

    try {
      const payload: StatusUpdate = {
        status: selectedStatus,
        severity: selectedSeverity,
      };
      if (assignedAgentInput.trim()) {
        payload.assigned_agent_id = assignedAgentInput.trim();
      }

      const updated = customOnUpdateStatus
        ? await customOnUpdateStatus(resolvedId, payload)
        : await defaultUpdateTicketStatus(resolvedId, payload);

      setTicket((prev) =>
        prev
          ? {
              ...prev,
              status: updated.status,
              severity: updated.severity,
              assigned_agent_id: updated.assigned_agent_id,
              escalation_tier: updated.escalation_tier,
              updated_at: updated.updated_at,
              resolved_at: updated.resolved_at || prev.resolved_at,
            }
          : null
      );

      setStatusUpdateSuccess(`Ticket status updated to "${updated.status}".`);

      // Refresh ticket detail to pull updated audit log events
      await loadTicket();

      // Automatically prompt CSAT survey if ticket transitions to RESOLVED or CLOSED
      if ((updated.status === 'RESOLVED' || updated.status === 'CLOSED') && !hasSubmittedCSAT) {
        setIsCSATModalOpen(true);
      }
    } catch (err: any) {
      setStatusUpdateError(err?.message || 'Failed to update ticket status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  /**
   * Handle submitting CSAT rating feedback survey.
   */
  const handleCSATSubmit = async (rating: number, feedbackText?: string): Promise<CSATResponse> => {
    if (!resolvedId) throw new Error('Missing ticket ID for CSAT submission.');

    try {
      const payload: CSATCreate = { rating, feedback_text: feedbackText };
      const res = customOnSubmitCSAT
        ? await customOnSubmitCSAT(resolvedId, payload)
        : await defaultSubmitCSAT(resolvedId, payload);

      setHasSubmittedCSAT(true);
      setCsatResponse(res);
      setIsCSATModalOpen(false);

      // Refresh ticket to include CSAT_SUBMITTED event in chronological stream
      await loadTicket();
      return res;
    } catch (err: any) {
      throw err;
    }
  };

  /**
   * Handle deleting the support ticket.
   */
  const handleDeleteTicket = async () => {
    if (!resolvedId) return;

    if (!window.confirm('Are you sure you want to delete this support ticket? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      if (customOnDeleteTicket) {
        await customOnDeleteTicket(resolvedId);
      } else {
        await defaultDeleteTicket(resolvedId);
      }
      router.push('/tickets');
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete support ticket.');
      setIsDeleting(false);
    }
  };

  const statusBadge = getStatusBadgeStyle(ticket?.status);
  const severityBadge = getSeverityBadgeStyle(ticket?.severity);
  const isResolvedOrClosed = ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED';

  return (
    <div
      className={className}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-background, #fbf9f4)',
        color: 'var(--color-on-background, #1b1c19)',
        fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
      }}
    >
      {/* Page Header Navigation Bar */}
      <NavMenu user={user} onLogout={onLogout} activePath="/tickets" />

      {/* Main Ticket Detail View Viewport */}
      <main
        data-testid="ticket-detail-page"
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '32px 24px 64px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Top Breadcrumb & Navigation Link */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link
            href="/tickets"
            data-testid="back-to-tickets-link"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--color-primary, #59452b)',
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
            }}
          >
            ← Back to Support Tickets
          </Link>

          {ticket && (
            <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
              Ticket ID: <code data-testid="ticket-id-display" style={{ fontWeight: 600 }}>{ticket.id}</code>
            </div>
          )}
        </div>

        {/* Global Loading State */}
        {isLoading && (
          <div
            data-testid="loading-indicator"
            style={{
              padding: '48px',
              textAlign: 'center',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              fontSize: '15px',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
          >
            Loading support ticket details and event history...
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div
            data-testid="error-banner"
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              backgroundColor: 'var(--color-error-container, #ffdad6)',
              color: 'var(--color-on-error-container, #93000a)',
              border: '1px solid var(--color-error, #ba1a1a)',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={loadTicket}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--color-on-error-container, #93000a)',
                border: '1px solid var(--color-error, #ba1a1a)',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                padding: '4px 10px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Ticket Header Metadata Card */}
        {ticket && (
          <>
            <div
              data-testid="ticket-header-card"
              style={{
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                padding: '24px 28px',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span
                      data-testid="ticket-severity-badge"
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm, 0.125rem)',
                        backgroundColor: severityBadge.bg,
                        color: severityBadge.color,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {severityBadge.label}
                    </span>

                    <span
                      data-testid="ticket-status-badge"
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        backgroundColor: statusBadge.bg,
                        color: statusBadge.color,
                        border: `1px solid ${statusBadge.border}`,
                      }}
                    >
                      {statusBadge.label}
                    </span>

                    <span
                      data-testid="ticket-tier-badge"
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full, 9999px)',
                        backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                        border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      }}
                    >
                      Escalation Tier {ticket.escalation_tier || 1}
                    </span>
                  </div>

                  <h1
                    data-testid="ticket-title"
                    style={{
                      fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                      fontSize: '28px',
                      fontWeight: 400,
                      lineHeight: 1.2,
                      color: 'var(--color-on-surface, #1b1c19)',
                      margin: 0,
                    }}
                  >
                    {ticket.title}
                  </h1>
                </div>

                {/* CSAT Trigger Action / Indicator for Resolved Tickets */}
                {isResolvedOrClosed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {hasSubmittedCSAT ? (
                      <span
                        data-testid="csat-submitted-badge"
                        style={{
                          fontSize: '13px',
                          color: '#2e6b38',
                          backgroundColor: '#e8f5e9',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          border: '1px solid #2e6b38',
                          fontWeight: 500,
                        }}
                      >
                        ⭐ CSAT Feedback Recorded
                      </span>
                    ) : (
                      <button
                        type="button"
                        data-testid="open-csat-modal-button"
                        onClick={() => setIsCSATModalOpen(true)}
                        style={{
                          backgroundColor: 'var(--color-primary, #59452b)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          padding: '8px 16px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        ⭐ Submit CSAT Survey
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Ticket Description */}
              <div
                data-testid="ticket-description"
                style={{
                  fontSize: '15px',
                  lineHeight: 1.6,
                  color: 'var(--color-on-surface, #1b1c19)',
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {ticket.description}
              </div>

              {/* Ticket Metadata Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--color-outline-variant, #d1c4b9)',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--color-outline, #80756b)', display: 'block' }}>Organization ID</span>
                  <strong style={{ color: 'var(--color-on-surface, #1b1c19)' }}>{ticket.organization_id || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-outline, #80756b)', display: 'block' }}>Creator User ID</span>
                  <strong style={{ color: 'var(--color-on-surface, #1b1c19)' }}>{ticket.creator_user_id || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-outline, #80756b)', display: 'block' }}>Assigned Agent</span>
                  <strong style={{ color: 'var(--color-on-surface, #1b1c19)' }}>
                    {ticket.assigned_agent_id ? ticket.assigned_agent_id : 'Unassigned'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-outline, #80756b)', display: 'block' }}>Created On</span>
                  <strong style={{ color: 'var(--color-on-surface, #1b1c19)' }}>{formatDateTime(ticket.created_at)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-outline, #80756b)', display: 'block' }}>Last Updated</span>
                  <strong style={{ color: 'var(--color-on-surface, #1b1c19)' }}>{formatDateTime(ticket.updated_at)}</strong>
                </div>
                {ticket.resolved_at && (
                  <div>
                    <span style={{ color: 'var(--color-outline, #80756b)', display: 'block' }}>Resolved On</span>
                    <strong style={{ color: 'var(--color-on-surface, #1b1c19)' }}>{formatDateTime(ticket.resolved_at)}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Post-Resolution CSAT Banner Prompt */}
            {isResolvedOrClosed && !hasSubmittedCSAT && (
              <div
                data-testid="csat-prompt-banner"
                style={{
                  backgroundColor: '#fdddbb',
                  color: '#281804',
                  border: '1px solid #735c41',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <strong style={{ fontSize: '15px', display: 'block' }}>
                    This ticket has been {ticket.status.toLowerCase()}. How did we do?
                  </strong>
                  <span style={{ fontSize: '13px', opacity: 0.9 }}>
                    Your feedback helps us continuously improve our service quality and SLA performance.
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="banner-csat-button"
                  onClick={() => setIsCSATModalOpen(true)}
                  style={{
                    backgroundColor: 'var(--color-primary, #59452b)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Rate Our Service ⭐
                </button>
              </div>
            )}

            {/* 2-Column Main Content Layout */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '24px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
                {/* Left Column: Lifecycle Management Form & Communication Thread */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Status Lifecycle & Severity Update Box */}
                  <section
                    data-testid="status-update-section"
                    style={{
                      backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                      borderRadius: 'var(--radius-md, 0.375rem)',
                      padding: '20px 24px',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
                    }}
                  >
                    <h2
                      style={{
                        fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                        fontSize: '18px',
                        fontWeight: 400,
                        margin: '0 0 16px 0',
                        color: 'var(--color-on-surface, #1b1c19)',
                      }}
                    >
                      Ticket Status & Severity Management
                    </h2>

                    {statusUpdateError && (
                      <div
                        data-testid="status-update-error"
                        style={{
                          padding: '10px 14px',
                          marginBottom: '16px',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          backgroundColor: '#ffdad6',
                          color: '#93000a',
                          border: '1px solid #ba1a1a',
                          fontSize: '13px',
                        }}
                      >
                        {statusUpdateError}
                      </div>
                    )}

                    {statusUpdateSuccess && (
                      <div
                        data-testid="status-update-success"
                        style={{
                          padding: '10px 14px',
                          marginBottom: '16px',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          backgroundColor: '#e8f5e9',
                          color: '#1b4332',
                          border: '1px solid #2e6b38',
                          fontSize: '13px',
                        }}
                      >
                        {statusUpdateSuccess}
                      </div>
                    )}

                    <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label
                            htmlFor="status-select"
                            style={{
                              display: 'block',
                              fontSize: '12px',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: 'var(--color-on-surface-variant, #4e453d)',
                              marginBottom: '6px',
                            }}
                          >
                            Lifecycle Status
                          </label>
                          <select
                            id="status-select"
                            data-testid="status-select"
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value as TicketStatus)}
                            disabled={isUpdatingStatus}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-sm, 0.125rem)',
                              border: '1px solid var(--color-outline-variant, #d1c4b9)',
                              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                              fontSize: '14px',
                              color: 'var(--color-on-surface, #1b1c19)',
                            }}
                          >
                            <option value="NEW">NEW</option>
                            <option value="IN_PROGRESS">IN_PROGRESS</option>
                            <option value="ESCALATED">ESCALATED</option>
                            <option value="RESOLVED">RESOLVED</option>
                            <option value="CLOSED">CLOSED</option>
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor="severity-select"
                            style={{
                              display: 'block',
                              fontSize: '12px',
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: 'var(--color-on-surface-variant, #4e453d)',
                              marginBottom: '6px',
                            }}
                          >
                            Severity Classification
                          </label>
                          <select
                            id="severity-select"
                            data-testid="severity-select"
                            value={selectedSeverity}
                            onChange={(e) => setSelectedSeverity(e.target.value as TicketSeverity)}
                            disabled={isUpdatingStatus}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-sm, 0.125rem)',
                              border: '1px solid var(--color-outline-variant, #d1c4b9)',
                              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                              fontSize: '14px',
                              color: 'var(--color-on-surface, #1b1c19)',
                            }}
                          >
                            <option value="P1">P1 - Critical (1h Response / 4h Res)</option>
                            <option value="P2">P2 - High (4h Response / 24h Res)</option>
                            <option value="P3">P3 - Standard (24h Response / 72h Res)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="assigned-agent-input"
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'var(--color-on-surface-variant, #4e453d)',
                            marginBottom: '6px',
                          }}
                        >
                          Assigned Agent ID
                        </label>
                        <input
                          id="assigned-agent-input"
                          type="text"
                          data-testid="assigned-agent-input"
                          value={assignedAgentInput}
                          onChange={(e) => setAssignedAgentInput(e.target.value)}
                          placeholder="e.g. usr-agent-101"
                          disabled={isUpdatingStatus}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm, 0.125rem)',
                            border: '1px solid var(--color-outline-variant, #d1c4b9)',
                            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                            fontSize: '14px',
                            color: 'var(--color-on-surface, #1b1c19)',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button
                          type="submit"
                          data-testid="update-status-button"
                          disabled={isUpdatingStatus}
                          style={{
                            backgroundColor: 'var(--color-primary, #59452b)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 'var(--radius-sm, 0.125rem)',
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
                            opacity: isUpdatingStatus ? 0.7 : 1,
                          }}
                        >
                          {isUpdatingStatus ? 'Updating Status...' : 'Save Lifecycle Changes'}
                        </button>
                      </div>
                    </form>
                  </section>

                  {/* Communication Feed & Chronological Audit Log Thread */}
                  <section
                    data-testid="communication-thread-container"
                    style={{
                      backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                      borderRadius: 'var(--radius-md, 0.375rem)',
                      padding: '24px',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
                    }}
                  >
                    <CommunicationThread
                      ticketId={resolvedId}
                      events={ticket.events || []}
                      onAddReply={handleAddReply}
                      currentUserId={user?.user_id}
                      disabled={ticket.status === 'CLOSED'}
                      data-testid="communication-thread"
                    />
                  </section>
                </div>

                {/* Right Column: Live SLA Countdown Timers & Danger Zone Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Live SLA Countdown Timer Card */}
                  <section
                    data-testid="sla-timer-container"
                    style={{
                      backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                      borderRadius: 'var(--radius-md, 0.375rem)',
                      padding: '24px',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
                    }}
                  >
                    <h2
                      style={{
                        fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                        fontSize: '18px',
                        fontWeight: 400,
                        margin: '0 0 16px 0',
                        color: 'var(--color-on-surface, #1b1c19)',
                      }}
                    >
                      SLA Performance Tracking
                    </h2>

                    <SLATimer
                      ticket={ticket}
                      targetType="both"
                      status={ticket.status}
                      severity={ticket.severity}
                      isBreached={ticket.is_sla_breached}
                      data-testid="sla-timer-section"
                    />
                  </section>

                  {/* Ticket Danger Zone & Record Management Box */}
                  <section
                    data-testid="ticket-actions-section"
                    style={{
                      backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                      borderRadius: 'var(--radius-md, 0.375rem)',
                      padding: '20px 24px',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        margin: '0 0 12px 0',
                        color: '#ba1a1a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Record Management
                    </h3>

                    {deleteError && (
                      <div
                        data-testid="delete-error-message"
                        style={{
                          padding: '8px 12px',
                          marginBottom: '12px',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          backgroundColor: '#ffdad6',
                          color: '#93000a',
                          border: '1px solid #ba1a1a',
                          fontSize: '13px',
                        }}
                      >
                        {deleteError}
                      </div>
                    )}

                    <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)', marginBottom: '16px' }}>
                      Permanently remove this support ticket and associated event history from the platform.
                    </p>

                    <button
                      type="button"
                      data-testid="delete-ticket-button"
                      onClick={handleDeleteTicket}
                      disabled={isDeleting}
                      style={{
                        width: '100%',
                        backgroundColor: 'transparent',
                        color: '#ba1a1a',
                        border: '1px solid #ba1a1a',
                        borderRadius: 'var(--radius-sm, 0.125rem)',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        opacity: isDeleting ? 0.6 : 1,
                      }}
                    >
                      {isDeleting ? 'Deleting Support Ticket...' : 'Delete Support Ticket'}
                    </button>
                  </section>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* CSAT Rating Feedback Survey Modal */}
      <CSATModal
        ticketId={resolvedId}
        ticket={ticket}
        isOpen={isCSATModalOpen}
        onClose={() => setIsCSATModalOpen(false)}
        onSubmit={handleCSATSubmit}
        onSuccess={() => {
          setHasSubmittedCSAT(true);
        }}
        data-testid="csat-modal"
      />
    </div>
  );
}

/**
 * Main Ticket Detail View Page route component for `/tickets/[id]`.
 * Intercepts unauthenticated access via ProtectedRoute guard and integrates
 * live SLA countdown timer, communication thread feed, status lifecycle updates, and CSAT modal.
 */
export default function TicketDetailPage(props: any = {}) {
  const {
    params,
    ticketId,
    user: initialUser,
    fetchUser,
    onLogout,
    initialTicket,
    autoFetch = true,
    fetchTicket,
    onAddReply,
    onUpdateStatus,
    onSubmitCSAT,
    onDeleteTicket,
    className = '',
  } = props || {};

  if (initialUser) {
    return (
      <_TicketDetailContent
        params={params}
        ticketId={ticketId}
        user={initialUser}
        onLogout={onLogout}
        initialTicket={initialTicket}
        autoFetch={autoFetch}
        fetchTicket={fetchTicket}
        onAddReply={onAddReply}
        onUpdateStatus={onUpdateStatus}
        onSubmitCSAT={onSubmitCSAT}
        onDeleteTicket={onDeleteTicket}
        className={className}
      />
    );
  }

  return (
    <ProtectedRoute fetchUser={fetchUser}>
      <_TicketDetailContent
        params={params}
        ticketId={ticketId}
        onLogout={onLogout}
        initialTicket={initialTicket}
        autoFetch={autoFetch}
        fetchTicket={fetchTicket}
        onAddReply={onAddReply}
        onUpdateStatus={onUpdateStatus}
        onSubmitCSAT={onSubmitCSAT}
        onDeleteTicket={onDeleteTicket}
        className={className}
      />
    </ProtectedRoute>
  );
}
