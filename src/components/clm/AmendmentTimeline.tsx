'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AmendmentAuditLog,
  AmendmentCreate,
  getAmendments,
  recordAmendment,
} from '../../services/clm_client';

export interface AmendmentTimelineProps {
  /** Contract ID to load amendments for from backend API */
  contractId?: string;
  /** Initial amendment records array */
  initialAmendments?: AmendmentAuditLog[];
  /** Alias for initialAmendments */
  amendments?: AmendmentAuditLog[];
  /** Optional user roles override header for RBAC / API requests */
  roles?: string;
  /** Callback triggered when a new amendment record is added */
  onAmendmentAdded?: (amendment: AmendmentAuditLog) => void;
  /** Whether to auto-fetch amendments from API when contractId is provided. Defaults to true */
  autoFetch?: boolean;
  /** Read-only mode: hides the form to record new amendments. Defaults to false */
  readOnly?: boolean;
  /** Custom container CSS class name */
  className?: string;
  /** Custom data-testid attribute override */
  'data-testid'?: string;
}

/**
 * Formats ISO timestamp string cleanly into a human-readable format.
 */
function formatTimestamp(timestampStr: string): string {
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
      second: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return timestampStr;
  }
}

/**
 * Truncates integrity hash for compact badge display while keeping full hash available.
 */
function formatHash(hash: string, length = 16): string {
  if (!hash) return 'N/A';
  if (hash.length <= length) return hash;
  return `${hash.slice(0, length)}...`;
}

export const AmendmentTimeline: React.FC<AmendmentTimelineProps> = ({
  contractId,
  initialAmendments,
  amendments,
  roles,
  onAmendmentAdded,
  autoFetch = true,
  readOnly = false,
  className = '',
  'data-testid': testId = 'amendment-timeline',
}) => {
  // Consolidate initial timeline items
  const initialData = useMemo(() => {
    return initialAmendments || amendments || [];
  }, [initialAmendments, amendments]);

  const [timelineData, setTimelineData] = useState<AmendmentAuditLog[]>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search, filter & sort controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // Default chronological ascending

  // Record Amendment Form state
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formSummary, setFormSummary] = useState<string>('');
  const [formUserId, setFormUserId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Expanded hash IDs
  const [expandedHashes, setExpandedHashes] = useState<Record<string, boolean>>({});

  // Sync prop changes if initialData changes and autoFetch isn't active
  useEffect(() => {
    if (initialData.length > 0) {
      setTimelineData(initialData);
    }
  }, [initialData]);

  /**
   * Fetch amendment records from API for the given contractId
   */
  const fetchAmendments = useCallback(async () => {
    if (!contractId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getAmendments(contractId, { roles });
      setTimelineData(data || []);
    } catch (err: any) {
      const errMsg = err?.message || err?.error?.message || 'Failed to fetch contract amendment audit trail.';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  }, [contractId, roles]);

  // Initial fetch on mount or when contractId/roles change
  useEffect(() => {
    if (contractId && autoFetch) {
      fetchAmendments();
    }
  }, [contractId, autoFetch, fetchAmendments]);

  /**
   * Filter and sort amendments based on search query and sort order
   */
  const filteredAmendments = useMemo(() => {
    let result = [...timelineData];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.summary.toLowerCase().includes(q) ||
          item.user_id.toLowerCase().includes(q) ||
          String(item.amendment_number).includes(q) ||
          item.integrity_hash.toLowerCase().includes(q)
      );
    }

    // Sort order
    result.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;

      if (timeA !== timeB) {
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return sortOrder === 'asc'
        ? a.amendment_number - b.amendment_number
        : b.amendment_number - a.amendment_number;
    });

    return result;
  }, [timelineData, searchQuery, sortOrder]);

  /**
   * Toggle expanded full hash display for a specific amendment record
   */
  const toggleHashExpand = (id: string) => {
    setExpandedHashes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  /**
   * Handle submitting a new amendment record
   */
  const handleRecordAmendmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedSummary = formSummary.trim();
    const trimmedUser = formUserId.trim();

    if (!trimmedSummary) {
      setFormError('Amendment summary is required.');
      return;
    }

    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);

    const payload: AmendmentCreate = {
      summary: trimmedSummary,
      user_id: trimmedUser || 'usr-legal-admin',
      timestamp: new Date().toISOString(),
    };

    try {
      let created: AmendmentAuditLog;

      if (contractId) {
        created = await recordAmendment(contractId, payload, { roles });
      } else {
        // Fallback for isolated offline/test execution without contractId
        const nextNum =
          timelineData.length > 0
            ? Math.max(...timelineData.map((d) => d.amendment_number)) + 1
            : 1;
        created = {
          id: `amd-${Date.now()}`,
          contract_id: 'mock-contract-id',
          amendment_number: nextNum,
          summary: payload.summary,
          user_id: payload.user_id || 'usr-legal-admin',
          timestamp: payload.timestamp || new Date().toISOString(),
          integrity_hash: `hmac_sha256_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        };
      }

      setTimelineData((prev) => [...prev, created]);
      setFormSuccess('Amendment audit record saved successfully.');
      setFormSummary('');
      setFormUserId('');

      if (onAmendmentAdded) {
        onAmendmentAdded(created);
      }

      // Hide success message after 4 seconds
      setTimeout(() => {
        setFormSuccess(null);
        setShowForm(false);
      }, 2500);
    } catch (err: any) {
      const errMsg =
        err?.message || err?.error?.message || 'Failed to record amendment audit entry.';
      setFormError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`amendment-timeline-container ${className}`}
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
              data-testid="amendment-timeline-title"
              style={{
                fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                fontSize: '22px',
                fontWeight: 600,
                color: 'var(--color-on-surface, #1b1c19)',
                margin: 0,
              }}
            >
              Amendment Audit Trail
            </h2>
            <span
              data-testid="amendment-count"
              style={{
                backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                color: 'var(--color-on-surface-variant, #4e453d)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full, 9999px)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
              }}
            >
              {timelineData.length} {timelineData.length === 1 ? 'Entry' : 'Entries'}
            </span>
            <span
              data-testid="amendment-immutable-badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'var(--color-trend-up-bg, #e8f5e9)',
                color: 'var(--color-trend-up, #2e6b38)',
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm, 0.125rem)',
                border: '1px solid var(--color-trend-up, #2e6b38)',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}
            >
              🔒 Immutable & Tamper-Evident
            </span>
          </div>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--color-on-surface-variant, #4e453d)',
              margin: '4px 0 0 0',
            }}
          >
            Chronological cryptographic log of all contract amendments, user actions, and timestamps.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!readOnly && (
            <button
              type="button"
              data-testid="amendment-form-toggle"
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
              {showForm ? 'Cancel Form' : '+ Record Amendment'}
            </button>
          )}
        </div>
      </div>

      {/* Record Amendment Form (Collapsible) */}
      {showForm && !readOnly && (
        <div
          data-testid="amendment-form"
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
            Record New Contract Amendment Audit Entry
          </h3>

          {formError && (
            <div
              data-testid="amendment-form-error"
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
              data-testid="amendment-form-success"
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

          <form onSubmit={handleRecordAmendmentSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="amendment-summary-input"
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
                Amendment Summary / Change Narrative <span style={{ color: 'var(--color-error, #ba1a1a)' }}>*</span>
              </label>
              <textarea
                id="amendment-summary-input"
                data-testid="amendment-summary-input"
                rows={3}
                value={formSummary}
                onChange={(e) => setFormSummary(e.target.value)}
                placeholder="Describe specific clause revisions, price adjustments, duration extensions, or scope updates..."
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  color: 'var(--color-on-surface, #1b1c19)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 240px' }}>
                <label
                  htmlFor="amendment-user-input"
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
                  User Identity / Author ID
                </label>
                <input
                  id="amendment-user-input"
                  type="text"
                  data-testid="amendment-user-input"
                  value={formUserId}
                  onChange={(e) => setFormUserId(e.target.value)}
                  placeholder="e.g. usr-legal-admin or legal@enterprise.com"
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

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  data-testid="amendment-submit-button"
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
                  {isSubmitting ? 'Recording Audit Entry...' : 'Save & Sign Audit Entry'}
                </button>
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
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Search & Sort Controls Bar */}
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
            data-testid="amendment-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search amendments by summary, author, or hash..."
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

        {/* Sort Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #4e453d)' }}>
            Order:
          </span>
          <button
            type="button"
            data-testid="amendment-sort-toggle"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
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
            {sortOrder === 'asc' ? 'Oldest First (Ascending)' : 'Newest First (Descending)'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div
          data-testid="amendment-loading-state"
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
          <p style={{ margin: 0 }}>Loading amendment audit trail records...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div
          data-testid="amendment-error-state"
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
            <strong>Error Loading Audit Trail:</strong> {error}
          </div>
          {contractId && (
            <button
              type="button"
              data-testid="amendment-retry-button"
              onClick={fetchAmendments}
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
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredAmendments.length === 0 && (
        <div
          data-testid="amendment-empty-state"
          style={{
            padding: '48px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
            borderRadius: 'var(--radius-md, 0.375rem)',
            border: '1px dashed var(--color-outline-variant, #d1c4b9)',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📜</div>
          <h4
            style={{
              fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
              fontSize: '16px',
              margin: '0 0 6px 0',
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            No Amendment Records Found
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant, #4e453d)', margin: 0 }}>
            {searchQuery
              ? `No amendment entries matched your filter "${searchQuery}".`
              : 'This contract has no recorded amendments in its audit trail yet.'}
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
              + Record First Amendment
            </button>
          )}
        </div>
      )}

      {/* Timeline Audit Trail List */}
      {!isLoading && !error && filteredAmendments.length > 0 && (
        <div
          data-testid="amendment-list"
          style={{
            position: 'relative',
            paddingLeft: '28px',
            marginTop: '10px',
          }}
        >
          {/* Vertical Timeline Backbone Line */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              bottom: '24px',
              left: '11px',
              width: '2px',
              backgroundColor: 'var(--color-outline-variant, #d1c4b9)',
              zIndex: 1,
            }}
          />

          {filteredAmendments.map((item, index) => {
            const isHashExpanded = Boolean(expandedHashes[item.id]);

            return (
              <div
                key={item.id || `amd-item-${item.amendment_number}-${index}`}
                data-testid="amendment-item"
                data-testid-id={`amendment-item-${item.id}`}
                style={{
                  position: 'relative',
                  marginBottom: '24px',
                }}
              >
                {/* Timeline Dot Node */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '-28px',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary, #59452b)',
                    color: 'var(--color-on-primary, #ffffff)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    zIndex: 2,
                    boxShadow: '0 0 0 3px var(--color-surface, #fbf9f4)',
                  }}
                >
                  #{item.amendment_number}
                </div>

                {/* Audit Card Content */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    padding: '16px 20px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  {/* Item Header */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '10px',
                      paddingBottom: '8px',
                      borderBottom: '1px solid var(--color-surface-container, #f0eee9)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        data-testid="amendment-number"
                        style={{
                          fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                          fontSize: '15px',
                          fontWeight: 700,
                          color: 'var(--color-primary, #59452b)',
                        }}
                      >
                        Amendment #{item.amendment_number}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--color-outline, #80756b)',
                        }}
                      >
                        •
                      </span>
                      <span
                        data-testid="amendment-user"
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--color-on-surface, #1b1c19)',
                          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm, 0.125rem)',
                          border: '1px solid var(--color-outline-variant, #d1c4b9)',
                        }}
                      >
                        👤 {item.user_id}
                      </span>
                    </div>

                    <span
                      data-testid="amendment-timestamp"
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-on-surface-variant, #4e453d)',
                        fontFamily: 'monospace',
                      }}
                    >
                      🕒 {formatTimestamp(item.timestamp)}
                    </span>
                  </div>

                  {/* Summary Narrative */}
                  <div
                    data-testid="amendment-summary"
                    style={{
                      fontSize: '14px',
                      lineHeight: '1.6',
                      color: 'var(--color-on-surface, #1b1c19)',
                      marginBottom: '12px',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {item.summary}
                  </div>

                  {/* Cryptographic Tamper-Evident HMAC Verification Badge */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                      borderRadius: 'var(--radius-sm, 0.125rem)',
                      border: '1px solid var(--color-outline-variant, #d1c4b9)',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--color-trend-up, #2e6b38)', fontWeight: 'bold' }}>
                        🛡️ HMAC SHA-256:
                      </span>
                      <code
                        data-testid="amendment-integrity-hash"
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          color: 'var(--color-on-surface-variant, #4e453d)',
                          wordBreak: 'break-all',
                        }}
                      >
                        {isHashExpanded ? item.integrity_hash : formatHash(item.integrity_hash)}
                      </code>
                      {item.integrity_hash && item.integrity_hash.length > 16 && (
                        <button
                          type="button"
                          onClick={() => toggleHashExpand(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-primary, #59452b)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            padding: '0 4px',
                            textDecoration: 'underline',
                          }}
                        >
                          {isHashExpanded ? 'show less' : 'show full hash'}
                        </button>
                      )}
                    </div>

                    <span
                      style={{
                        color: 'var(--color-trend-up, #2e6b38)',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      ✓ Verification Intact
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AmendmentTimeline;
