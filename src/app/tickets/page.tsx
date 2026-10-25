'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ProtectedRoute, useAuth } from '../../components/protected_route';
import { NavMenu } from '../../components/nav_menu';
import { SLATimer } from '../../components/tickets/SLATimer';
import { CurrentUserResponse } from '../../services/auth';
import {
  listTickets as defaultListTickets,
  createTicket as defaultCreateTicket,
  deleteTicket as defaultDeleteTicket,
  Ticket,
  TicketSeverity,
  TicketStatus,
  TicketCreate,
  ListTicketsParams,
  PaginatedTickets,
} from '../../services/tickets';

/**
 * Component properties for Support Ticket Dashboard Page.
 */
export interface TicketsPageProps {
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Initial array of tickets passed down for pre-loaded server/test state */
  initialTickets?: Ticket[];
  /** Initial total ticket count */
  initialTotal?: number;
  /** Initial status filter value ('NEW', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED', or '') */
  initialStatus?: string;
  /** Initial severity filter value ('P1', 'P2', 'P3', or '') */
  initialSeverity?: string;
  /** Initial organization ID filter query */
  initialOrganizationId?: string;
  /** Whether the component should automatically fetch tickets on mount/filter change (default: true) */
  autoFetch?: boolean;
  /** Custom ticket list fetcher for testing or custom client injection */
  fetchTickets?: (params?: ListTicketsParams) => Promise<PaginatedTickets>;
  /** Custom ticket creation handler */
  onCreateTicket?: (payload: TicketCreate) => Promise<Ticket>;
  /** Custom ticket deletion handler */
  onDeleteTicket?: (id: string) => Promise<void>;
  /** Optional custom container CSS class name */
  className?: string;
}

/**
 * Inner Ticket Dashboard content component consuming active user session context.
 * Renders page navigation header, ticket creation form/modal, listing search filters,
 * SLA timers, severity badges, and paginated ticket data table.
 * Styled following the Linen & Logic editorial design system.
 */
function _TicketsPageContent({
  user: explicitUser,
  onLogout,
  initialTickets = [],
  initialTotal,
  initialStatus = '',
  initialSeverity = '',
  initialOrganizationId = '',
  autoFetch = true,
  fetchTickets: customFetchTickets,
  onCreateTicket: customOnCreateTicket,
  onDeleteTicket: customOnDeleteTicket,
  className = '',
}: TicketsPageProps) {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [severityFilter, setSeverityFilter] = useState<string>(initialSeverity);
  const [organizationFilter, setOrganizationFilter] = useState<string>(initialOrganizationId);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);

  // Data state
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [total, setTotal] = useState<number>(
    initialTotal !== undefined ? initialTotal : initialTickets.length
  );
  const [isLoading, setIsLoading] = useState<boolean>(autoFetch && initialTickets.length === 0);
  const [error, setError] = useState<string | null>(null);

  // Ticket creation state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Form input fields state
  const [titleInput, setTitleInput] = useState<string>('');
  const [descriptionInput, setDescriptionInput] = useState<string>('');
  const [severityInput, setSeverityInput] = useState<TicketSeverity>('P3');
  const [organizationInput, setOrganizationInput] = useState<string>(user?.tenant_id || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Deletion state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Update default organization input if user loads asynchronously
  useEffect(() => {
    if (user?.tenant_id && !organizationInput) {
      setOrganizationInput(user.tenant_id);
    }
  }, [user?.tenant_id, organizationInput]);

  /**
   * Fetch paginated support tickets based on current search filters.
   */
  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params: ListTicketsParams = {
        page,
        limit,
      };

      if (statusFilter && statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (severityFilter && severityFilter !== 'ALL') {
        params.severity = severityFilter;
      }
      if (organizationFilter.trim()) {
        params.organization_id = organizationFilter.trim();
      }

      const response = customFetchTickets
        ? await customFetchTickets(params)
        : await defaultListTickets(params);

      setTickets(response.items || []);
      setTotal(response.total !== undefined ? response.total : (response.items || []).length);
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch support tickets. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    limit,
    statusFilter,
    severityFilter,
    organizationFilter,
    customFetchTickets,
  ]);

  // Trigger ticket fetching when filters or page change
  useEffect(() => {
    if (autoFetch) {
      loadTickets();
    }
  }, [autoFetch, loadTickets]);

  /**
   * Handle filter form submission.
   */
  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadTickets();
  };

  /**
   * Reset filter parameters to default values.
   */
  const handleResetFilters = () => {
    setStatusFilter('');
    setSeverityFilter('');
    setOrganizationFilter('');
    setPage(1);
  };

  /**
   * Handle ticket creation form submission.
   */
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    if (!titleInput.trim()) {
      setCreateError('Ticket summary/title is required.');
      return;
    }
    if (!descriptionInput.trim()) {
      setCreateError('Ticket detailed description is required.');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload: TicketCreate = {
        title: titleInput.trim(),
        description: descriptionInput.trim(),
        severity: severityInput || 'P3',
        organization_id: organizationInput.trim() || user?.tenant_id || 'default-org',
        ...(selectedFile ? { file: selectedFile } : {}),
      };

      const newTicket = customOnCreateTicket
        ? await customOnCreateTicket(payload)
        : await defaultCreateTicket(payload);

      setCreateSuccess(`Ticket #${newTicket.id || 'created'} submitted successfully.`);
      setTitleInput('');
      setDescriptionInput('');
      setSeverityInput('P3');
      setSelectedFile(null);

      // Refresh list
      await loadTickets();

      // Close modal after brief delay
      setTimeout(() => {
        setIsCreateModalOpen(false);
        setCreateSuccess(null);
      }, 1200);
    } catch (err: any) {
      const msg = err?.message || 'Failed to submit support ticket. Please verify payload.';
      setCreateError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle ticket deletion request.
   */
  const handleDeleteTicket = async (ticketId: string) => {
    if (!ticketId) return;

    try {
      setDeletingId(ticketId);
      setDeleteError(null);

      if (customOnDeleteTicket) {
        await customOnDeleteTicket(ticketId);
      } else {
        await defaultDeleteTicket(ticketId);
      }

      // Remove locally or reload
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      const msg = err?.message || `Failed to delete ticket #${ticketId}.`;
      setDeleteError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  // Helper for status badge style
  const getStatusBadgeStyle = (status: string) => {
    const norm = (status || '').toUpperCase();
    switch (norm) {
      case 'NEW':
        return {
          backgroundColor: '#d0e4ff',
          color: '#071d30',
          border: '1px solid #b4c8e2',
        };
      case 'IN_PROGRESS':
        return {
          backgroundColor: '#f5d6b4',
          color: '#58432a',
          border: '1px solid #e0c1a1',
        };
      case 'ESCALATED':
        return {
          backgroundColor: '#ffdad4',
          color: '#842417',
          border: '1px solid #fd7d69',
        };
      case 'RESOLVED':
        return {
          backgroundColor: '#e4e2dd',
          color: '#1b1c19',
          border: '1px solid #80756b',
        };
      case 'CLOSED':
        return {
          backgroundColor: '#dbdad5',
          color: '#4e453d',
          border: '1px solid #80756b',
        };
      default:
        return {
          backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
          color: 'var(--color-on-surface, #1b1c19)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
        };
    }
  };

  // Helper for severity badge style
  const getSeverityBadgeStyle = (severity: string) => {
    const norm = (severity || '').toUpperCase();
    switch (norm) {
      case 'P1':
        return {
          backgroundColor: '#ffdad6',
          color: '#93000a',
          fontWeight: '600' as const,
          border: '1px solid #ba1a1a',
        };
      case 'P2':
        return {
          backgroundColor: '#f5d6b4',
          color: '#58432a',
          fontWeight: '500' as const,
          border: '1px solid #735c41',
        };
      case 'P3':
      default:
        return {
          backgroundColor: '#caddf8',
          color: '#35485d',
          fontWeight: '400' as const,
          border: '1px solid #4f6278',
        };
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div
      data-testid="tickets-page"
      className={className}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-background, #fbf9f4)',
        color: 'var(--color-on-background, #1b1c19)',
        fontFamily: 'var(--font-sans, "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif)',
      }}
    >
      <NavMenu user={user} onLogout={onLogout} />

      <main
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '32px 24px 64px 24px',
        }}
      >
        {/* Page Header Section */}
        <header
          data-testid="tickets-header"
          style={{
            marginBottom: '32px',
            borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
            paddingBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '16px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--color-surface-tint, #715a3f)',
                  marginBottom: '8px',
                }}
              >
                Support & Escalation Operations
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '32px',
                  fontWeight: '400',
                  margin: 0,
                  color: 'var(--color-primary, #59452b)',
                  lineHeight: '1.2',
                }}
              >
                Support Ticket Dashboard
              </h1>
              <p
                style={{
                  fontSize: '15px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginTop: '8px',
                  marginBottom: 0,
                  maxWidth: '720px',
                }}
              >
                Submit support tickets with attachments, track status lifecycles, enforce multi-tenant organization access control, and monitor automated SLA compliance.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                data-testid="open-create-ticket-button"
                onClick={() => setIsCreateModalOpen(!isCreateModalOpen)}
                style={{
                  backgroundColor: 'var(--color-primary, #59452b)',
                  color: 'var(--color-on-primary, #ffffff)',
                  border: 'none',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(115, 92, 65, 0.1)',
                  transition: 'background-color 0.2s ease',
                }}
              >
                {isCreateModalOpen ? 'Cancel Ticket' : '+ New Support Ticket'}
              </button>
            </div>
          </div>
        </header>

        {/* Global Delete Error Alert */}
        {deleteError && (
          <div
            data-testid="delete-ticket-error"
            style={{
              backgroundColor: '#ffdad6',
              color: '#93000a',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              marginBottom: '24px',
              fontSize: '14px',
              border: '1px solid #ba1a1a',
            }}
          >
            {deleteError}
          </div>
        )}

        {/* Ticket Creation Modal / Form Card [FR-1, US-01] */}
        {isCreateModalOpen && (
          <section
            data-testid="create-ticket-modal"
            style={{
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              padding: '24px',
              marginBottom: '32px',
              boxShadow: '0 4px 12px rgba(115, 92, 65, 0.08)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                fontSize: '20px',
                fontWeight: '400',
                marginTop: 0,
                marginBottom: '16px',
                color: 'var(--color-primary, #59452b)',
              }}
            >
              Submit New Support Ticket
            </h2>

            {createError && (
              <div
                data-testid="create-ticket-error"
                style={{
                  backgroundColor: '#ffdad6',
                  color: '#93000a',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  marginBottom: '16px',
                  fontSize: '14px',
                  border: '1px solid #ba1a1a',
                }}
              >
                {createError}
              </div>
            )}

            {createSuccess && (
              <div
                data-testid="create-ticket-success"
                style={{
                  backgroundColor: '#d0e4ff',
                  color: '#071d30',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  marginBottom: '16px',
                  fontSize: '14px',
                  border: '1px solid #b4c8e2',
                }}
              >
                {createSuccess}
              </div>
            )}

            <form data-testid="create-ticket-form" onSubmit={handleCreateTicket}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <div>
                  <label
                    htmlFor="ticket-title"
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '500',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                      marginBottom: '6px',
                    }}
                  >
                    Ticket Summary / Title *
                  </label>
                  <input
                    id="ticket-title"
                    type="text"
                    data-testid="ticket-title-input"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="e.g. Critical API Latency Spike on Order Checkout"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      border: '1px solid var(--color-outline, #80756b)',
                      backgroundColor: 'var(--color-surface, #fbf9f4)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="ticket-description"
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '500',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                      marginBottom: '6px',
                    }}
                  >
                    Detailed Description *
                  </label>
                  <textarea
                    id="ticket-description"
                    data-testid="ticket-description-input"
                    rows={4}
                    value={descriptionInput}
                    onChange={(e) => setDescriptionInput(e.target.value)}
                    placeholder="Provide full details, steps to reproduce, or incident timeline..."
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      border: '1px solid var(--color-outline, #80756b)',
                      backgroundColor: 'var(--color-surface, #fbf9f4)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <div>
                    <label
                      htmlFor="ticket-severity"
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '500',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                        marginBottom: '6px',
                      }}
                    >
                      Severity Level *
                    </label>
                    <select
                      id="ticket-severity"
                      data-testid="ticket-severity-select"
                      value={severityInput}
                      onChange={(e) => setSeverityInput(e.target.value as TicketSeverity)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '14px',
                        borderRadius: 'var(--radius-sm, 0.125rem)',
                        border: '1px solid var(--color-outline, #80756b)',
                        backgroundColor: 'var(--color-surface, #fbf9f4)',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="P1">P1 - Critical (4h Resolution SLA)</option>
                      <option value="P2">P2 - Major (24h Resolution SLA)</option>
                      <option value="P3">P3 - Minor (72h Resolution SLA)</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="ticket-organization"
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '500',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                        marginBottom: '6px',
                      }}
                    >
                      Organization / Tenant ID * [FR-10]
                    </label>
                    <input
                      id="ticket-organization"
                      type="text"
                      data-testid="ticket-organization-input"
                      value={organizationInput}
                      onChange={(e) => setOrganizationInput(e.target.value)}
                      placeholder="e.g. org-acme-corp"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '14px',
                        borderRadius: 'var(--radius-sm, 0.125rem)',
                        border: '1px solid var(--color-outline, #80756b)',
                        backgroundColor: 'var(--color-surface, #fbf9f4)',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ticket-file"
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '500',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                        marginBottom: '6px',
                      }}
                    >
                      Attachment File (Optional)
                    </label>
                    <input
                      id="ticket-file"
                      type="file"
                      data-testid="ticket-file-input"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '13px',
                        borderRadius: 'var(--radius-sm, 0.125rem)',
                        border: '1px solid var(--color-outline, #80756b)',
                        backgroundColor: 'var(--color-surface, #fbf9f4)',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '24px',
                }}
              >
                <button
                  type="button"
                  data-testid="cancel-ticket-button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    padding: '8px 16px',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-ticket-button"
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: 'var(--color-primary, #59452b)',
                    color: 'var(--color-on-primary, #ffffff)',
                    border: 'none',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    padding: '8px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Support Ticket'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Search & Listing Filters Section [FR-3, FR-10, US-01] */}
        <section
          data-testid="ticket-filters"
          style={{
            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '20px',
            marginBottom: '32px',
          }}
        >
          <form onSubmit={handleApplyFilters}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                alignItems: 'end',
              }}
            >
              <div>
                <label
                  htmlFor="filter-status-select"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '6px',
                  }}
                >
                  Status Filter
                </label>
                <select
                  id="filter-status-select"
                  data-testid="filter-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="NEW">New</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="ESCALATED">Escalated</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-severity-select"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '6px',
                  }}
                >
                  Severity Filter
                </label>
                <select
                  id="filter-severity-select"
                  data-testid="filter-severity"
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  }}
                >
                  <option value="">All Severities</option>
                  <option value="P1">P1 - Critical</option>
                  <option value="P2">P2 - Major</option>
                  <option value="P3">P3 - Minor</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-organization-input"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '6px',
                  }}
                >
                  Organization ID [FR-10]
                </label>
                <input
                  id="filter-organization-input"
                  type="text"
                  data-testid="filter-organization-id"
                  value={organizationFilter}
                  onChange={(e) => setOrganizationFilter(e.target.value)}
                  placeholder="Filter by Organization ID..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  data-testid="apply-filters-button"
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--color-primary, #59452b)',
                    color: 'var(--color-on-primary, #ffffff)',
                    border: 'none',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  Apply Filters
                </button>

                <button
                  type="button"
                  data-testid="reset-filters-button"
                  onClick={handleResetFilters}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Tickets Listing Table Container [FR-3, FR-10, US-01] */}
        <section data-testid="ticket-list-container">
          {isLoading ? (
            <div
              data-testid="tickets-loading"
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              Loading support tickets...
            </div>
          ) : error ? (
            <div
              data-testid="tickets-error"
              style={{
                backgroundColor: '#ffdad6',
                color: '#93000a',
                padding: '16px 20px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                border: '1px solid #ba1a1a',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          ) : tickets.length === 0 ? (
            <div
              data-testid="tickets-empty-state"
              style={{
                textAlign: 'center',
                padding: '64px 24px',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '20px',
                  fontWeight: '400',
                  margin: '0 0 8px 0',
                  color: 'var(--color-primary, #59452b)',
                }}
              >
                No Support Tickets Found
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  margin: '0 0 20px 0',
                }}
              >
                No support tickets match the selected filters or active organization context.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                style={{
                  backgroundColor: 'var(--color-primary, #59452b)',
                  color: 'var(--color-on-primary, #ffffff)',
                  border: 'none',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Submit New Ticket
              </button>
            </div>
          ) : (
            <div
              style={{
                overflowX: 'auto',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
              }}
            >
              <table
                data-testid="tickets-table"
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '14px',
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
                      backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                    }}
                  >
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Ticket Summary</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Severity</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Tier</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>Organization</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500' }}>SLA Target</th>
                    <th style={{ padding: '12px 16px', fontWeight: '500', textAlign: 'right' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      data-testid={`ticket-row-${ticket.id}`}
                      style={{
                        borderBottom: '1px solid var(--color-surface-container-highest, #e4e2dd)',
                      }}
                    >
                      <td style={{ padding: '16px' }}>
                        <Link
                          href={`/tickets/${ticket.id}`}
                          data-testid={`ticket-link-${ticket.id}`}
                          style={{
                            fontWeight: '500',
                            color: 'var(--color-primary, #59452b)',
                            textDecoration: 'none',
                          }}
                        >
                          {ticket.title}
                        </Link>
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--color-on-surface-variant, #4e453d)',
                            marginTop: '4px',
                          }}
                        >
                          ID: #{ticket.id}
                        </div>
                      </td>

                      <td style={{ padding: '16px' }}>
                        <span
                          data-testid={`severity-badge-${ticket.id}`}
                          style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm, 0.125rem)',
                            fontSize: '12px',
                            ...getSeverityBadgeStyle(ticket.severity),
                          }}
                        >
                          {ticket.severity || 'P3'}
                        </span>
                      </td>

                      <td style={{ padding: '16px' }}>
                        <span
                          data-testid={`status-badge-${ticket.id}`}
                          style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm, 0.125rem)',
                            fontSize: '12px',
                            fontWeight: '500',
                            ...getStatusBadgeStyle(ticket.status),
                          }}
                        >
                          {ticket.status}
                        </span>
                      </td>

                      <td style={{ padding: '16px' }}>
                        <span
                          data-testid={`tier-badge-${ticket.id}`}
                          style={{
                            fontSize: '13px',
                            color: 'var(--color-on-surface-variant, #4e453d)',
                          }}
                        >
                          Tier {ticket.escalation_tier || 1}
                        </span>
                      </td>

                      <td style={{ padding: '16px' }}>
                        <span
                          data-testid={`org-badge-${ticket.id}`}
                          style={{
                            fontSize: '13px',
                            color: 'var(--color-on-surface-variant, #4e453d)',
                          }}
                        >
                          {ticket.organization_id}
                        </span>
                      </td>

                      <td style={{ padding: '16px' }}>
                        <SLATimer
                          ticket={ticket}
                          compact
                          data-testid={`sla-timer-${ticket.id}`}
                        />
                      </td>

                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <Link
                            href={`/tickets/${ticket.id}`}
                            style={{
                              fontSize: '13px',
                              color: 'var(--color-primary, #59452b)',
                              textDecoration: 'none',
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm, 0.125rem)',
                              border: '1px solid var(--color-outline-variant, #d1c4b9)',
                            }}
                          >
                            View
                          </Link>
                          <button
                            type="button"
                            data-testid={`delete-ticket-button-${ticket.id}`}
                            onClick={() => handleDeleteTicket(ticket.id)}
                            disabled={deletingId === ticket.id}
                            style={{
                              fontSize: '13px',
                              color: '#ba1a1a',
                              backgroundColor: 'transparent',
                              border: '1px solid #ffdad6',
                              borderRadius: 'var(--radius-sm, 0.125rem)',
                              padding: '4px 8px',
                              cursor: deletingId === ticket.id ? 'not-allowed' : 'pointer',
                              opacity: deletingId === ticket.id ? 0.6 : 1,
                            }}
                          >
                            {deletingId === ticket.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              <div
                data-testid="pagination-controls"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  borderTop: '1px solid var(--color-outline-variant, #d1c4b9)',
                }}
              >
                <div
                  data-testid="tickets-page-indicator"
                  style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)' }}
                >
                  Page {page} of {totalPages} ({total} total tickets)
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    data-testid="prev-page-button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    style={{
                      backgroundColor: 'transparent',
                      color: page <= 1 ? '#80756b' : 'var(--color-primary, #59452b)',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      padding: '6px 12px',
                      fontSize: '13px',
                      cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    data-testid="next-page-button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      backgroundColor: 'transparent',
                      color: page >= totalPages ? '#80756b' : 'var(--color-primary, #59452b)',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      padding: '6px 12px',
                      fontSize: '13px',
                      cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// Export aliases (internal reference)
const TicketsPageContent = _TicketsPageContent;
const TicketsContent = _TicketsPageContent;

/**
 * Support Ticket Dashboard Page Route Component.
 * Intercepts unauthenticated requests using ProtectedRoute and renders support ticket dashboard.
 */
export default function TicketsPage(props: any = {}) {
  if (props?.user) {
    return <_TicketsPageContent {...props} />;
  }

  return (
    <ProtectedRoute fetchUser={props?.fetchUser}>
      <_TicketsPageContent {...props} />
    </ProtectedRoute>
  );
}
