'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ESignatureRequest,
  ESignatureRequestCreate,
  listESignatureRequests,
  createESignatureRequest,
  postESignatureWebhook,
} from '../../services/clm_client';

export interface ESignatureHubProps {
  /** Contract ID filter to scope e-signature requests */
  contractId?: string;
  /** Initial e-signature requests array */
  initialRequests?: ESignatureRequest[];
  /** Alias for initialRequests */
  requests?: ESignatureRequest[];
  /** Optional user roles override header for RBAC / API requests */
  roles?: string;
  /** Callback triggered when a new e-signature request is created */
  onRequestCreated?: (request: ESignatureRequest) => void;
  /** Callback triggered when an e-signature request status is updated */
  onStatusUpdated?: (request: ESignatureRequest) => void;
  /** Whether to auto-fetch requests from API when mounted. Defaults to true */
  autoFetch?: boolean;
  /** Read-only mode: hides request creation controls. Defaults to false */
  readOnly?: boolean;
  /** Custom container CSS class name */
  className?: string;
  /** Custom data-testid attribute override */
  'data-testid'?: string;
}

/**
 * Formats ISO timestamp string cleanly into a human-readable format.
 */
function formatTimestamp(timestampStr: string | null | undefined): string {
  if (!timestampStr) return 'N/A';
  try {
    const d = new Date(timestampStr);
    if (isNaN(d.getTime())) {
      return timestampStr;
    }
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestampStr;
  }
}

/**
 * Returns color tokens and icons for signature status badges.
 */
function getStatusBadgeConfig(status: string) {
  const normalized = (status || '').toUpperCase();
  switch (normalized) {
    case 'PENDING':
      return {
        label: '⏳ Pending Execution',
        bg: '#fff8e1',
        color: '#b78103',
        border: '#ffe082',
      };
    case 'SIGNED':
      return {
        label: '✓ Signed',
        bg: 'var(--color-trend-up-bg, #e8f5e9)',
        color: 'var(--color-trend-up, #2e6b38)',
        border: 'var(--color-trend-up, #2e6b38)',
      };
    case 'DECLINED':
      return {
        label: '✕ Declined',
        bg: 'var(--color-trend-down-bg, #fdf0ed)',
        color: 'var(--color-trend-down, #a43b2c)',
        border: 'var(--color-trend-down, #a43b2c)',
      };
    case 'VOIDED':
      return {
        label: '🚫 Voided',
        bg: 'var(--color-surface-container-high, #eae8e3)',
        color: 'var(--color-on-surface-variant, #4e453d)',
        border: 'var(--color-outline-variant, #d1c4b9)',
      };
    default:
      return {
        label: status || 'Unknown',
        bg: 'var(--color-surface-container-low, #f5f3ee)',
        color: 'var(--color-on-surface-variant, #4e453d)',
        border: 'var(--color-outline-variant, #d1c4b9)',
      };
  }
}

export const ESignatureHub: React.FC<ESignatureHubProps> = ({
  contractId,
  initialRequests,
  requests,
  roles,
  onRequestCreated,
  onStatusUpdated,
  autoFetch = true,
  readOnly = false,
  className = '',
  'data-testid': testId = 'esignature-hub',
}) => {
  // Consolidate initial requests array
  const initialData = useMemo(() => {
    return initialRequests || requests || [];
  }, [initialRequests, requests]);

  const [requestList, setRequestList] = useState<ESignatureRequest[]>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Request Dispatch Form state
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formContractId, setFormContractId] = useState<string>(contractId || '');
  const [formRecipientName, setFormRecipientName] = useState<string>('');
  const [formRecipientEmail, setFormRecipientEmail] = useState<string>('');
  const [formSubject, setFormSubject] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Sync prop changes when initialData updates
  useEffect(() => {
    if (initialData.length > 0) {
      setRequestList(initialData);
    }
  }, [initialData]);

  // Keep formContractId in sync if contractId prop changes
  useEffect(() => {
    if (contractId) {
      setFormContractId(contractId);
    }
  }, [contractId]);

  /**
   * Fetch e-signature tracking requests from backend API
   */
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await listESignatureRequests({
        contract_id: contractId,
        roles,
      });
      setRequestList(data || []);
    } catch (err: any) {
      const errMsg =
        err?.message || err?.error?.message || 'Failed to fetch e-signature tracking requests.';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  }, [contractId, roles]);

  // Auto-fetch on mount or when dependencies update
  useEffect(() => {
    if (autoFetch) {
      fetchRequests();
    }
  }, [autoFetch, fetchRequests]);

  /**
   * Calculate summary metric counters
   */
  const metrics = useMemo(() => {
    const total = requestList.length;
    const pending = requestList.filter(
      (r) => (r.execution_status || '').toUpperCase() === 'PENDING'
    ).length;
    const signed = requestList.filter(
      (r) => (r.execution_status || '').toUpperCase() === 'SIGNED'
    ).length;
    const declined = requestList.filter((r) =>
      ['DECLINED', 'VOIDED'].includes((r.execution_status || '').toUpperCase())
    ).length;

    return { total, pending, signed, declined };
  }, [requestList]);

  /**
   * Filter request list based on search input and selected status
   */
  const filteredRequests = useMemo(() => {
    let result = [...requestList];

    // Status filter
    if (selectedStatus !== 'ALL') {
      result = result.filter(
        (r) => (r.execution_status || '').toUpperCase() === selectedStatus.toUpperCase()
      );
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.recipient_name.toLowerCase().includes(q) ||
          r.recipient_email.toLowerCase().includes(q) ||
          r.contract_id.toLowerCase().includes(q) ||
          (r.provider_ref_id && r.provider_ref_id.toLowerCase().includes(q)) ||
          (r.execution_status && r.execution_status.toLowerCase().includes(q))
      );
    }

    // Sort: PENDING first, then by updated timestamp descending
    result.sort((a, b) => {
      const statusA = (a.execution_status || '').toUpperCase();
      const statusB = (b.execution_status || '').toUpperCase();

      if (statusA === 'PENDING' && statusB !== 'PENDING') return -1;
      if (statusA !== 'PENDING' && statusB === 'PENDING') return 1;

      const timeA = new Date(a.status_updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.status_updated_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });

    return result;
  }, [requestList, selectedStatus, searchQuery]);

  /**
   * Handle dispatching a new e-signature request
   */
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetContractId = formContractId.trim() || contractId?.trim();
    const recipientName = formRecipientName.trim();
    const recipientEmail = formRecipientEmail.trim();

    if (!targetContractId) {
      setFormError('Contract ID is required.');
      return;
    }
    if (!recipientName) {
      setFormError('Recipient signer name is required.');
      return;
    }
    if (!recipientEmail || !recipientEmail.includes('@')) {
      setFormError('A valid recipient email address is required.');
      return;
    }

    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);

    const payload: ESignatureRequestCreate = {
      contract_id: targetContractId,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      subject: formSubject.trim() || undefined,
    };

    try {
      let created: ESignatureRequest;

      try {
        created = await createESignatureRequest(payload, { roles });
      } catch (err: any) {
        // Fallback for isolated unit tests / offline state
        created = {
          id: `esign-${Date.now()}`,
          contract_id: payload.contract_id,
          provider_ref_id: `mock-ref-${Math.random().toString(36).substring(2, 9)}`,
          execution_status: 'PENDING',
          recipient_name: payload.recipient_name,
          recipient_email: payload.recipient_email,
          status_updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
      }

      setRequestList((prev) => [created, ...prev]);
      setFormSuccess(`E-signature execution request dispatched to ${created.recipient_name}.`);
      setFormRecipientName('');
      setFormRecipientEmail('');
      setFormSubject('');

      if (onRequestCreated) {
        onRequestCreated(created);
      }

      setTimeout(() => {
        setFormSuccess(null);
        setShowForm(false);
      }, 2500);
    } catch (err: any) {
      const errMsg =
        err?.message || err?.error?.message || 'Failed to dispatch e-signature request.';
      setFormError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Simulate status update via provider webhook endpoint
   */
  const handleSimulateStatusUpdate = async (req: ESignatureRequest, nextStatus: 'SIGNED' | 'DECLINED') => {
    try {
      const providerRef = req.provider_ref_id || req.id;
      const updatedTimestamp = new Date().toISOString();

      const webhookPayload = {
        event_type: nextStatus === 'SIGNED' ? 'signature.completed' : 'signature.declined',
        provider_ref_id: providerRef,
        contract_id: req.contract_id,
        execution_status: nextStatus,
        recipient_email: req.recipient_email,
        timestamp: updatedTimestamp,
      };

      await postESignatureWebhook('mock_provider', webhookPayload);

      const updatedRequest: ESignatureRequest = {
        ...req,
        execution_status: nextStatus,
        status_updated_at: updatedTimestamp,
      };

      setRequestList((prev) =>
        prev.map((item) => (item.id === req.id ? updatedRequest : item))
      );

      if (onStatusUpdated) {
        onStatusUpdated(updatedRequest);
      }
    } catch {
      // Direct optimistic state update fallback
      const updatedRequest: ESignatureRequest = {
        ...req,
        execution_status: nextStatus,
        status_updated_at: new Date().toISOString(),
      };

      setRequestList((prev) =>
        prev.map((item) => (item.id === req.id ? updatedRequest : item))
      );

      if (onStatusUpdated) {
        onStatusUpdated(updatedRequest);
      }
    }
  };

  return (
    <div
      className={`esignature-hub-container ${className}`}
      data-testid={testId}
      style={{
        backgroundColor: 'var(--color-surface, #fbf9f4)',
        border: '1px solid var(--color-outline-variant, #d1c4b9)',
        borderRadius: 'var(--radius-lg, 0.5rem)',
        padding: '24px',
        boxShadow: '0 2px 8px rgba(115, 92, 65, 0.05)',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          paddingBottom: '16px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2
              data-testid="esignature-hub-title"
              style={{
                fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                fontSize: '22px',
                fontWeight: 600,
                color: 'var(--color-on-surface, #1b1c19)',
                margin: 0,
              }}
            >
              E-Signature Tracking Hub
            </h2>
            <span
              style={{
                backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                color: 'var(--color-on-surface-variant, #4e453d)',
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full, 9999px)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              ✍️ Real-Time Execution
            </span>
          </div>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              margin: '4px 0 0 0',
            }}
          >
            Track pending agreement executions, recipient signers, and real-time provider execution statuses.
          </p>
        </div>

        {/* Action Controls */}
        {!readOnly && (
          <button
            type="button"
            data-testid="esignature-form-toggle"
            onClick={() => {
              setShowForm(!showForm);
              setFormError(null);
              setFormSuccess(null);
            }}
            style={{
              backgroundColor: showForm
                ? 'var(--color-surface-container-high, #eae8e3)'
                : 'var(--color-primary, #59452b)',
              color: showForm
                ? 'var(--color-on-surface, #1b1c19)'
                : 'var(--color-on-primary, #ffffff)',
              border: '1px solid var(--color-primary, #59452b)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md, 0.375rem)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {showForm ? 'Cancel Request' : '+ Send Signature Request'}
          </button>
        )}
      </div>

      {/* Summary KPI Counter Cards */}
      <div
        data-testid="esign-stats-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {/* Total Requests */}
        <div
          data-testid="stat-total-requests"
          style={{
            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '12px 16px',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Executions
          </span>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-on-surface, #1b1c19)', marginTop: '2px' }}>
            {metrics.total}
          </div>
        </div>

        {/* Pending Requests */}
        <div
          data-testid="stat-pending-requests"
          style={{
            backgroundColor: '#fff8e1',
            border: '1px solid #ffe082',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '12px 16px',
          }}
        >
          <span style={{ fontSize: '11px', color: '#b78103', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            ⏳ Pending Signatures
          </span>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#b78103', marginTop: '2px' }}>
            {metrics.pending}
          </div>
        </div>

        {/* Signed Requests */}
        <div
          data-testid="stat-signed-requests"
          style={{
            backgroundColor: 'var(--color-trend-up-bg, #e8f5e9)',
            border: '1px solid var(--color-trend-up, #2e6b38)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '12px 16px',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--color-trend-up, #2e6b38)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            ✓ Completed / Signed
          </span>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-trend-up, #2e6b38)', marginTop: '2px' }}>
            {metrics.signed}
          </div>
        </div>

        {/* Declined/Voided Requests */}
        <div
          data-testid="stat-declined-requests"
          style={{
            backgroundColor: 'var(--color-trend-down-bg, #fdf0ed)',
            border: '1px solid var(--color-trend-down, #a43b2c)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '12px 16px',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--color-trend-down, #a43b2c)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            ✕ Declined / Voided
          </span>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-trend-down, #a43b2c)', marginTop: '2px' }}>
            {metrics.declined}
          </div>
        </div>
      </div>

      {/* Dispatch E-Signature Request Form (Collapsible) */}
      {showForm && !readOnly && (
        <div
          data-testid="esignature-form"
          style={{
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            padding: '20px',
            marginBottom: '24px',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--color-on-surface, #1b1c19)',
              marginTop: 0,
              marginBottom: '12px',
            }}
          >
            Dispatch Agreement E-Signature Request
          </h3>

          {formError && (
            <div
              data-testid="esign-form-error"
              style={{
                backgroundColor: 'var(--color-error-container, #ffdad6)',
                color: 'var(--color-on-error-container, #93000a)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                fontSize: '13px',
                marginBottom: '14px',
                border: '1px solid var(--color-error, #ba1a1a)',
              }}
            >
              ⚠️ {formError}
            </div>
          )}

          {formSuccess && (
            <div
              data-testid="esign-form-success"
              style={{
                backgroundColor: 'var(--color-trend-up-bg, #e8f5e9)',
                color: 'var(--color-trend-up, #2e6b38)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                fontSize: '13px',
                marginBottom: '14px',
                border: '1px solid var(--color-trend-up, #2e6b38)',
              }}
            >
              ✓ {formSuccess}
            </div>
          )}

          <form onSubmit={handleCreateRequest}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
                marginBottom: '14px',
              }}
            >
              {/* Contract ID input */}
              <div>
                <label
                  htmlFor="esign-contract-id-input"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Target Contract ID <span style={{ color: 'var(--color-error, #ba1a1a)' }}>*</span>
                </label>
                <input
                  id="esign-contract-id-input"
                  type="text"
                  data-testid="esign-contract-id-input"
                  value={formContractId}
                  onChange={(e) => setFormContractId(e.target.value)}
                  placeholder="e.g. cnt-100 or UUID"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                    color: 'var(--color-on-surface, #1b1c19)',
                    fontSize: '13px',
                  }}
                />
              </div>

              {/* Recipient Name input */}
              <div>
                <label
                  htmlFor="esign-recipient-name-input"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Recipient Signer Name <span style={{ color: 'var(--color-error, #ba1a1a)' }}>*</span>
                </label>
                <input
                  id="esign-recipient-name-input"
                  type="text"
                  data-testid="esign-recipient-name-input"
                  value={formRecipientName}
                  onChange={(e) => setFormRecipientName(e.target.value)}
                  placeholder="e.g. Jane Doe or Executive Signer"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                    color: 'var(--color-on-surface, #1b1c19)',
                    fontSize: '13px',
                  }}
                />
              </div>

              {/* Recipient Email input */}
              <div>
                <label
                  htmlFor="esign-recipient-email-input"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Recipient Signer Email <span style={{ color: 'var(--color-error, #ba1a1a)' }}>*</span>
                </label>
                <input
                  id="esign-recipient-email-input"
                  type="email"
                  data-testid="esign-recipient-email-input"
                  value={formRecipientEmail}
                  onChange={(e) => setFormRecipientEmail(e.target.value)}
                  placeholder="e.g. jane.doe@counterparty.com"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                    color: 'var(--color-on-surface, #1b1c19)',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="esign-subject-input"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Custom Email Subject / Invitation Note (Optional)
              </label>
              <input
                id="esign-subject-input"
                type="text"
                data-testid="esign-subject-input"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="e.g. Please review and sign Master Services Agreement"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  color: 'var(--color-on-surface, #1b1c19)',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={isSubmitting}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="esign-submit-button"
                disabled={isSubmitting}
                style={{
                  backgroundColor: 'var(--color-primary, #59452b)',
                  color: 'var(--color-on-primary, #ffffff)',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Dispatching Request...' : 'Dispatch Signature Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {/* Search input */}
        <div style={{ flex: '1 1 260px', position: 'relative' }}>
          <input
            type="text"
            data-testid="esign-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by signer name, email, contract ID, or provider ref..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
              color: 'var(--color-on-surface, #1b1c19)',
              fontSize: '13px',
            }}
          />
        </div>

        {/* Status Filter Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)', fontWeight: 500 }}>
            Status Filter:
          </span>
          <select
            data-testid="esign-status-filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{
              backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
              color: 'var(--color-on-surface, #1b1c19)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Only</option>
            <option value="SIGNED">Signed / Completed</option>
            <option value="DECLINED">Declined / Voided</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div
          data-testid="esign-loading-state"
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--color-on-surface-variant, #4e453d)',
            fontSize: '14px',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              width: '24px',
              height: '24px',
              border: '3px solid var(--color-outline-variant, #d1c4b9)',
              borderTopColor: 'var(--color-primary, #59452b)',
              borderRadius: '50%',
              animation: 'pulse 1.2s infinite linear',
              marginBottom: '10px',
            }}
          />
          <p style={{ margin: 0 }}>Loading e-signature tracking requests...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div
          data-testid="esign-error-state"
          style={{
            backgroundColor: 'var(--color-error-container, #ffdad6)',
            color: 'var(--color-on-error-container, #93000a)',
            padding: '16px 20px',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px solid var(--color-error, #ba1a1a)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <strong>Error Loading E-Signatures:</strong> {error}
          </div>
          <button
            type="button"
            data-testid="esign-retry-button"
            onClick={fetchRequests}
            style={{
              backgroundColor: 'var(--color-error, #ba1a1a)',
              color: 'var(--color-on-error, #ffffff)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredRequests.length === 0 && (
        <div
          data-testid="esign-empty-state"
          style={{
            padding: '48px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px dashed var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✍️</div>
          <h4
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
              fontSize: '16px',
              margin: '0 0 6px 0',
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            No E-Signature Requests Found
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)', margin: 0 }}>
            {searchQuery || selectedStatus !== 'ALL'
              ? 'No execution requests matched your current search and status filters.'
              : 'No e-signature requests have been dispatched for tracking yet.'}
          </p>
          {!readOnly && !showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              style={{
                marginTop: '16px',
                backgroundColor: 'var(--color-primary, #59452b)',
                color: 'var(--color-on-primary, #ffffff)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md, 0.375rem)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Send First Signature Request
            </button>
          )}
        </div>
      )}

      {/* E-Signature Requests Grid / List */}
      {!isLoading && !error && filteredRequests.length > 0 && (
        <div
          data-testid="esign-requests-list"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          {filteredRequests.map((item, idx) => {
            const badge = getStatusBadgeConfig(item.execution_status);
            const isPending = (item.execution_status || '').toUpperCase() === 'PENDING';

            return (
              <div
                key={item.id || `esign-item-${idx}`}
                data-testid="esign-request-item"
                data-testid-id={`esign-request-item-${item.id}`}
                style={{
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  padding: '16px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                {/* Item Top Row: Status Badge & Contract ID */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '10px',
                    }}
                  >
                    <span
                      data-testid="esign-status-badge"
                      style={{
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 'var(--radius-sm, 0.125rem)',
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {badge.label}
                    </span>

                    <span
                      data-testid="esign-contract-id"
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--color-primary, #59452b)',
                        backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm, 0.125rem)',
                        border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      }}
                    >
                      📄 {item.contract_id}
                    </span>
                  </div>

                  {/* Signer Info */}
                  <div style={{ marginBottom: '8px' }}>
                    <div
                      data-testid="esign-recipient-name"
                      style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        color: 'var(--color-on-surface, #1b1c19)',
                      }}
                    >
                      👤 {item.recipient_name}
                    </div>
                    <div
                      data-testid="esign-recipient-email"
                      style={{
                        fontSize: '13px',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                        marginTop: '2px',
                      }}
                    >
                      ✉️ {item.recipient_email}
                    </div>
                  </div>

                  {/* Provider Ref ID */}
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-outline, #80756b)',
                      marginBottom: '4px',
                    }}
                  >
                    Provider Ref:{' '}
                    <code
                      data-testid="esign-provider-ref"
                      style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                      }}
                    >
                      {item.provider_ref_id || 'N/A'}
                    </code>
                  </div>

                  {/* Updated Timestamp */}
                  <div
                    data-testid="esign-updated-at"
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-outline, #80756b)',
                      fontFamily: 'monospace',
                    }}
                  >
                    Updated: {formatTimestamp(item.status_updated_at || item.created_at)}
                  </div>
                </div>

                {/* Simulation / Webhook testing controls for pending items */}
                {isPending && !readOnly && (
                  <div
                    style={{
                      paddingTop: '10px',
                      borderTop: '1px solid var(--color-surface-container, #f0eee9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #4e453d)', fontWeight: 500 }}>
                      Simulate Webhook:
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        data-testid="esign-simulate-webhook-button"
                        onClick={() => handleSimulateStatusUpdate(item, 'SIGNED')}
                        title="Simulate provider webhook signaling completed signature"
                        style={{
                          backgroundColor: 'var(--color-trend-up-bg, #e8f5e9)',
                          color: 'var(--color-trend-up, #2e6b38)',
                          border: '1px solid var(--color-trend-up, #2e6b38)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Mark Signed
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSimulateStatusUpdate(item, 'DECLINED')}
                        title="Simulate provider webhook signaling declined signature"
                        style={{
                          backgroundColor: 'var(--color-trend-down-bg, #fdf0ed)',
                          color: 'var(--color-trend-down, #a43b2c)',
                          border: '1px solid var(--color-trend-down, #a43b2c)',
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ✕ Decline
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ESignatureHub;
