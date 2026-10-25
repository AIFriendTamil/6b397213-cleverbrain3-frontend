'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ContractDetail as IContractDetail,
  ClauseHighlight,
  SLACommitment,
  getContractDetail,
  deleteContract,
} from '../../services/clm_client';

export interface ContractDetailProps {
  /** Contract ID to load from API when direct contract object is not provided */
  contractId?: string;
  /** Direct contract detail object */
  initialContract?: IContractDetail | null;
  /** Direct contract detail object alias */
  contract?: IContractDetail | null;
  /** Optional user roles override for RBAC filtering */
  roles?: string;
  /** Callback triggered when contract is loaded or refreshed */
  onContractLoaded?: (contract: IContractDetail) => void;
  /** Callback triggered on clicking back button */
  onBack?: () => void;
  /** Callback triggered on edit request */
  onEdit?: (contract: IContractDetail) => void;
  /** Callback triggered on successful contract deletion */
  onDelete?: (contractId: string) => void;
  /** Auto-fetch from API if contractId is supplied. Defaults to true */
  autoFetch?: boolean;
  /** Custom CSS class name */
  className?: string;
  /** Custom data-testid attribute */
  'data-testid'?: string;
}

/**
 * Status badge style and label helper.
 */
function getStatusBadgeConfig(status: string): { bg: string; color: string; border: string; label: string } {
  const norm = (status || '').toUpperCase();
  switch (norm) {
    case 'ACTIVE':
      return {
        bg: 'var(--color-trend-up-bg, #e8f5e9)',
        color: 'var(--color-trend-up, #2e6b38)',
        border: 'var(--color-trend-up, #2e6b38)',
        label: 'Active',
      };
    case 'DRAFT':
      return {
        bg: 'var(--color-surface-container-high, #eae8e3)',
        color: 'var(--color-on-surface-variant, #4e453d)',
        border: 'var(--color-outline-variant, #d1c4b9)',
        label: 'Draft',
      };
    case 'EXPIRED':
      return {
        bg: 'var(--color-trend-down-bg, #fdf0ed)',
        color: 'var(--color-trend-down, #a43b2c)',
        border: 'var(--color-trend-down, #a43b2c)',
        label: 'Expired',
      };
    case 'TERMINATED':
      return {
        bg: 'var(--color-surface-dim, #dbdad5)',
        color: 'var(--color-on-surface-variant, #4e453d)',
        border: 'var(--color-outline, #80756b)',
        label: 'Terminated',
      };
    default:
      return {
        bg: 'var(--color-surface-container, #f0eee9)',
        color: 'var(--color-on-surface, #1b1c19)',
        border: 'var(--color-outline-variant, #d1c4b9)',
        label: status || 'Unknown',
      };
  }
}

/**
 * Clause type badge helper.
 */
function getClauseTypeBadgeConfig(clauseType: string): { label: string; bg: string; color: string; border: string } {
  const norm = (clauseType || '').toUpperCase();
  switch (norm) {
    case 'SPECIAL_TERM':
      return {
        label: 'Special Term',
        bg: 'var(--color-primary-container, #735c41)',
        color: 'var(--color-on-primary, #ffffff)',
        border: 'var(--color-primary, #59452b)',
      };
    case 'CONFIDENTIALITY':
      return {
        label: 'Confidentiality',
        bg: 'var(--color-surface-container-high, #eae8e3)',
        color: 'var(--color-on-surface, #1b1c19)',
        border: 'var(--color-outline-variant, #d1c4b9)',
      };
    case 'TERMINATION':
      return {
        label: 'Termination',
        bg: 'var(--color-surface-container-high, #eae8e3)',
        color: 'var(--color-secondary, #a43b2c)',
        border: 'var(--color-outline-variant, #d1c4b9)',
      };
    case 'INDEMNIFICATION':
      return {
        label: 'Indemnification',
        bg: 'var(--color-surface-container-high, #eae8e3)',
        color: 'var(--color-on-surface, #1b1c19)',
        border: 'var(--color-outline-variant, #d1c4b9)',
      };
    case 'GOVERNING_LAW':
      return {
        label: 'Governing Law',
        bg: 'var(--color-surface-container-high, #eae8e3)',
        color: 'var(--color-on-surface, #1b1c19)',
        border: 'var(--color-outline-variant, #d1c4b9)',
      };
    default:
      return {
        label: clauseType,
        bg: 'var(--color-surface-container, #f0eee9)',
        color: 'var(--color-on-surface, #1b1c19)',
        border: 'var(--color-outline-variant, #d1c4b9)',
      };
  }
}

/**
 * Calculate days remaining until expiration date string (YYYY-MM-DD).
 */
function calculateDaysRemaining(expirationDateStr: string): number | null {
  if (!expirationDateStr) return null;
  const target = new Date(expirationDateStr);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  // Strip time portion for date-only comparison
  const utc1 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const utc2 = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Contract detail viewer component displaying key clause highlights,
 * SLA commitments, and special terms.
 */
export const ContractDetail: React.FC<ContractDetailProps> = ({
  contractId,
  initialContract,
  contract: contractProp,
  roles,
  onContractLoaded,
  onBack,
  onEdit,
  onDelete,
  autoFetch = true,
  className = '',
  'data-testid': testId = 'contract-detail-container',
}) => {
  const effectiveInitialContract = contractProp ?? initialContract ?? null;

  const [contract, setContract] = useState<IContractDetail | null>(effectiveInitialContract);
  const [loading, setLoading] = useState<boolean>(!effectiveInitialContract && Boolean(contractId) && autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteConfirm, setDeleteConfirm] = useState<boolean>(false);
  const [activeClauseFilter, setActiveClauseFilter] = useState<string>('ALL');

  const resolvedId = contractId || contract?.id;

  const fetchContractData = useCallback(async () => {
    if (!resolvedId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getContractDetail(resolvedId, { roles });
      setContract(data);
      if (onContractLoaded) {
        onContractLoaded(data);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to load contract details from server.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [resolvedId, roles, onContractLoaded]);

  useEffect(() => {
    if (effectiveInitialContract) {
      setContract(effectiveInitialContract);
      setError(null);
      setLoading(false);
    } else if (contractId && autoFetch) {
      fetchContractData();
    }
  }, [contractId, effectiveInitialContract, autoFetch, fetchContractData]);

  const handleDelete = async () => {
    if (!contract?.id) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteContract(contract.id, { roles });
      if (onDelete) {
        onDelete(contract.id);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete contract record.';
      setError(msg);
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  // Extract special terms and clause list
  const clauses = useMemo(() => contract?.clauses || [], [contract?.clauses]);
  const slaCommitments = useMemo(() => contract?.sla_commitments || [], [contract?.sla_commitments]);

  const specialTerms = useMemo(() => {
    return clauses.filter((c) => (c.clause_type || '').toUpperCase() === 'SPECIAL_TERM');
  }, [clauses]);

  const filteredClauses = useMemo(() => {
    if (activeClauseFilter === 'ALL') return clauses;
    return clauses.filter((c) => (c.clause_type || '').toUpperCase() === activeClauseFilter);
  }, [clauses, activeClauseFilter]);

  const daysRemaining = useMemo(() => {
    if (!contract?.expires_on) return null;
    return calculateDaysRemaining(contract.expires_on);
  }, [contract?.expires_on]);

  const statusBadge = useMemo(() => {
    if (!contract?.status) return null;
    return getStatusBadgeConfig(contract.status);
  }, [contract?.status]);

  if (loading) {
    return (
      <div
        className={`contract-detail-loading ${className}`}
        data-testid="contract-detail-loading"
        style={{
          padding: '2rem',
          backgroundColor: 'var(--color-surface, #fbf9f4)',
          borderRadius: 'var(--radius-lg, 0.5rem)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
          textAlign: 'center',
          color: 'var(--color-on-surface-variant, #4e453d)',
        }}
      >
        <div style={{ fontSize: '1.125rem', fontFamily: 'var(--font-serif, serif)', marginBottom: '0.5rem' }}>
          Loading contract details...
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-outline, #80756b)', margin: 0 }}>
          Retrieving clause highlights, SLA commitments, and terms.
        </p>
      </div>
    );
  }

  if (error && !contract) {
    return (
      <div
        className={`contract-detail-error ${className}`}
        data-testid="contract-detail-error"
        style={{
          padding: '2rem',
          backgroundColor: 'var(--color-error-container, #ffdad6)',
          color: 'var(--color-on-error-container, #93000a)',
          borderRadius: 'var(--radius-lg, 0.5rem)',
          border: '1px solid var(--color-error, #ba1a1a)',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-serif, serif)', fontSize: '1.25rem' }}>
          Unable to load contract
        </h2>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem' }}>{error}</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={fetchContractData}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--color-secondary, #a43b2c)',
              color: 'var(--color-on-secondary, #ffffff)',
              border: 'none',
              borderRadius: 'var(--radius-md, 0.375rem)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
            data-testid="contract-retry-btn"
          >
            Retry Loading
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                color: 'var(--color-on-surface, #1b1c19)',
                border: '1px solid var(--color-outline, #80756b)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                cursor: 'pointer',
              }}
            >
              Back to List
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div
        className={`contract-detail-not-found ${className}`}
        data-testid="contract-detail-not-found"
        style={{
          padding: '2rem',
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          color: 'var(--color-on-surface-variant, #4e453d)',
          borderRadius: 'var(--radius-lg, 0.5rem)',
          border: '1px dashed var(--color-outline-variant, #d1c4b9)',
          textAlign: 'center',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-serif, serif)', fontSize: '1.25rem' }}>
          Contract Not Found
        </h2>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem' }}>
          No contract record was provided or found for the specified reference.
        </p>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--color-primary, #59452b)',
              color: 'var(--color-on-primary, #ffffff)',
              border: 'none',
              borderRadius: 'var(--radius-md, 0.375rem)',
              cursor: 'pointer',
            }}
          >
            Return to Contract Repository
          </button>
        ) : (
          <Link
            href="/contracts"
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--color-primary, #59452b)',
              color: 'var(--color-on-primary, #ffffff)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              textDecoration: 'none',
            }}
          >
            Return to Contract Repository
          </Link>
        )}
      </div>
    );
  }

  return (
    <article
      className={`contract-detail-container ${className}`}
      data-testid={testId}
      style={{
        backgroundColor: 'var(--color-surface, #fbf9f4)',
        color: 'var(--color-on-surface, #1b1c19)',
        borderRadius: 'var(--radius-lg, 0.5rem)',
        border: '1px solid var(--color-outline-variant, #d1c4b9)',
        padding: '1.75rem',
        boxShadow: '0 2px 8px rgba(115, 92, 65, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      {/* Top Header & Navigation */}
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
          paddingBottom: '1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary, #59452b)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  marginBottom: '0.5rem',
                }}
                data-testid="contract-back-btn"
              >
                ← Back to Contracts
              </button>
            ) : (
              <Link
                href="/contracts"
                style={{
                  color: 'var(--color-primary, #59452b)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  marginBottom: '0.5rem',
                }}
                data-testid="contract-back-link"
              >
                ← Back to Contracts
              </Link>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  fontFamily: 'var(--font-sans, sans-serif)',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
                data-testid="contract-detail-number"
              >
                {contract.contract_number}
              </span>
              {statusBadge && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.15rem 0.6rem',
                    borderRadius: 'var(--radius-full, 9999px)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    backgroundColor: statusBadge.bg,
                    color: statusBadge.color,
                    border: `1px solid ${statusBadge.border}`,
                  }}
                  data-testid="contract-detail-status"
                >
                  {statusBadge.label}
                </span>
              )}
            </div>
            <h1
              style={{
                margin: '0.25rem 0 0 0',
                fontFamily: 'var(--font-serif, serif)',
                fontSize: '1.75rem',
                fontWeight: 400,
                color: 'var(--color-on-surface, #1b1c19)',
                lineHeight: 1.25,
              }}
              data-testid="contract-detail-title"
            >
              {contract.title}
            </h1>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={fetchContractData}
              title="Refresh contract details"
              style={{
                padding: '0.4rem 0.75rem',
                backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                color: 'var(--color-on-surface, #1b1c19)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
              data-testid="contract-refresh-btn"
            >
              Refresh
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(contract)}
                style={{
                  padding: '0.4rem 0.75rem',
                  backgroundColor: 'var(--color-surface-container-high, #eae8e3)',
                  color: 'var(--color-on-surface, #1b1c19)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
                data-testid="contract-edit-btn"
              >
                Edit
              </button>
            )}
            {deleteConfirm ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    padding: '0.4rem 0.75rem',
                    backgroundColor: 'var(--color-error, #ba1a1a)',
                    color: 'var(--color-on-error, #ffffff)',
                    border: 'none',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                  }}
                  data-testid="contract-delete-confirm"
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                  style={{
                    padding: '0.4rem 0.6rem',
                    backgroundColor: 'transparent',
                    color: 'var(--color-on-surface, #1b1c19)',
                    border: '1px solid var(--color-outline, #80756b)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                style={{
                  padding: '0.4rem 0.75rem',
                  backgroundColor: 'transparent',
                  color: 'var(--color-secondary, #a43b2c)',
                  border: '1px solid var(--color-secondary, #a43b2c)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
                data-testid="contract-delete-btn"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--color-error-container, #ffdad6)',
              color: 'var(--color-on-error-container, #93000a)',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}
      </header>

      {/* Contract Metadata & Key Dates Grid */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          padding: '1.25rem',
          backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          border: '1px solid var(--color-outline-variant, #d1c4b9)',
        }}
        data-testid="contract-detail-metadata-grid"
      >
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginBottom: '0.25rem',
            }}
          >
            Counterparty
          </div>
          <div
            style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-on-surface, #1b1c19)' }}
            data-testid="contract-detail-counterparty"
          >
            {contract.counterparty}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginBottom: '0.25rem',
            }}
          >
            Effective Date
          </div>
          <div style={{ fontSize: '0.9375rem', color: 'var(--color-on-surface, #1b1c19)' }}>
            {contract.effective_on}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginBottom: '0.25rem',
            }}
          >
            Expiration Date
          </div>
          <div
            style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-on-surface, #1b1c19)' }}
            data-testid="contract-detail-expiration"
          >
            {contract.expires_on}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-on-surface-variant, #4e453d)',
              marginBottom: '0.25rem',
            }}
          >
            Renewal Terms
          </div>
          <div style={{ fontSize: '0.9375rem', color: 'var(--color-on-surface, #1b1c19)' }}>
            {contract.auto_renew ? (
              <span
                style={{
                  color: 'var(--color-trend-up, #2e6b38)',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                ✓ Auto-Renews
              </span>
            ) : (
              <span style={{ color: 'var(--color-on-surface-variant, #4e453d)' }}>Manual Renewal</span>
            )}
          </div>
        </div>

        {daysRemaining !== null && (
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-on-surface-variant, #4e453d)',
                marginBottom: '0.25rem',
              }}
            >
              Time to Renewal / Expiry
            </div>
            <div
              style={{
                fontSize: '0.9375rem',
                fontWeight: 600,
                color:
                  daysRemaining < 0
                    ? 'var(--color-trend-down, #a43b2c)'
                    : daysRemaining <= 30
                    ? 'var(--color-secondary, #a43b2c)'
                    : daysRemaining <= 90
                    ? 'var(--color-primary-container, #735c41)'
                    : 'var(--color-trend-up, #2e6b38)',
              }}
              data-testid="contract-detail-days-remaining"
            >
              {daysRemaining < 0
                ? `Expired ${Math.abs(daysRemaining)} days ago`
                : daysRemaining === 0
                ? 'Expires today'
                : `${daysRemaining} days remaining`}
            </div>
          </div>
        )}
      </section>

      {/* Special Terms Highlight Section (FR-1 & Story 1) */}
      <section
        className="special-terms-section"
        data-testid="special-terms-section"
        style={{
          backgroundColor: 'var(--color-surface-container, #f0eee9)',
          borderRadius: 'var(--radius-md, 0.375rem)',
          borderLeft: '4px solid var(--color-primary-container, #735c41)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif, serif)',
              fontSize: '1.125rem',
              color: 'var(--color-primary, #59452b)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            ★ Special Terms & Non-Standard Provisions
          </h2>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.15rem 0.5rem',
              backgroundColor: 'var(--color-primary-container, #735c41)',
              color: 'var(--color-on-primary, #ffffff)',
              borderRadius: 'var(--radius-full, 9999px)',
              fontWeight: 600,
            }}
            data-testid="special-terms-count"
          >
            {specialTerms.length} {specialTerms.length === 1 ? 'term' : 'terms'}
          </span>
        </div>

        {specialTerms.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {specialTerms.map((term, index) => (
              <div
                key={term.id || `special-${index}`}
                data-testid="special-term-item"
                style={{
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  padding: '0.875rem 1rem',
                  borderRadius: 'var(--radius-sm, 0.125rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    color: 'var(--color-on-surface, #1b1c19)',
                    marginBottom: '0.25rem',
                  }}
                  data-testid="special-term-title"
                >
                  {term.title}
                </div>
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    lineHeight: 1.5,
                  }}
                  data-testid="special-term-content"
                >
                  {term.content}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: '0.875rem',
              fontStyle: 'italic',
              color: 'var(--color-on-surface-variant, #4e453d)',
            }}
            data-testid="no-special-terms-msg"
          >
            No special terms or non-standard provisions specified for this contract.
          </p>
        )}
      </section>

      {/* Key Clause Highlights Section (FR-1 & Story 1) */}
      <section
        className="clauses-section"
        data-testid="clauses-section"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-serif, serif)',
              fontSize: '1.25rem',
              color: 'var(--color-on-surface, #1b1c19)',
            }}
          >
            Key Clause Highlights ({clauses.length})
          </h2>

          {/* Clause Filter Buttons */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {[
              { key: 'ALL', label: 'All' },
              { key: 'SPECIAL_TERM', label: 'Special Terms' },
              { key: 'CONFIDENTIALITY', label: 'Confidentiality' },
              { key: 'TERMINATION', label: 'Termination' },
              { key: 'INDEMNIFICATION', label: 'Indemnification' },
              { key: 'GOVERNING_LAW', label: 'Governing Law' },
            ].map((f) => {
              const active = activeClauseFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActiveClauseFilter(f.key)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    borderRadius: 'var(--radius-sm, 0.125rem)',
                    border: active
                      ? '1px solid var(--color-primary, #59452b)'
                      : '1px solid var(--color-outline-variant, #d1c4b9)',
                    backgroundColor: active
                      ? 'var(--color-primary, #59452b)'
                      : 'var(--color-surface-container-low, #f5f3ee)',
                    color: active ? 'var(--color-on-primary, #ffffff)' : 'var(--color-on-surface, #1b1c19)',
                    cursor: 'pointer',
                    fontWeight: active ? 600 : 400,
                  }}
                  data-testid={`clause-filter-${f.key}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredClauses.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredClauses.map((clause, idx) => {
              const badge = getClauseTypeBadgeConfig(clause.clause_type);
              return (
                <div
                  key={clause.id || `clause-${idx}`}
                  data-testid="clause-item"
                  style={{
                    backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                    borderRadius: 'var(--radius-md, 0.375rem)',
                    border: '1px solid var(--color-outline-variant, #d1c4b9)',
                    padding: '1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem',
                      gap: '0.5rem',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.9375rem',
                        color: 'var(--color-on-surface, #1b1c19)',
                      }}
                      data-testid="clause-title"
                    >
                      {clause.title}
                    </span>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-full, 9999px)',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        whiteSpace: 'nowrap',
                      }}
                      data-testid="clause-badge"
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-on-surface-variant, #4e453d)',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-line',
                    }}
                    data-testid="clause-content"
                  >
                    {clause.content}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px dashed var(--color-outline-variant, #d1c4b9)',
              textAlign: 'center',
              color: 'var(--color-on-surface-variant, #4e453d)',
              fontSize: '0.875rem',
            }}
            data-testid="no-clauses-msg"
          >
            {clauses.length === 0
              ? 'No clause highlights recorded for this agreement.'
              : 'No clause highlights match the selected filter category.'}
          </div>
        )}
      </section>

      {/* SLA Commitments Section (FR-1 & Story 1) */}
      <section
        className="sla-commitments-section"
        data-testid="sla-commitments-section"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif, serif)',
            fontSize: '1.25rem',
            color: 'var(--color-on-surface, #1b1c19)',
          }}
        >
          SLA Commitments & Performance Standards ({slaCommitments.length})
        </h2>

        {slaCommitments.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {slaCommitments.map((sla, idx) => (
              <div
                key={sla.id || `sla-${idx}`}
                data-testid="sla-item"
                style={{
                  backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div
                  style={{
                    fontSize: '0.8125rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-on-surface-variant, #4e453d)',
                    fontWeight: 600,
                  }}
                  data-testid="sla-metric-name"
                >
                  {sla.metric_name}
                </div>
                <div
                  style={{
                    fontSize: '1.5rem',
                    fontFamily: 'var(--font-serif, serif)',
                    color: 'var(--color-primary, #59452b)',
                    fontWeight: 500,
                  }}
                  data-testid="sla-target-value"
                >
                  {sla.target_value}
                </div>
                {sla.penalty_terms ? (
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--color-secondary, #a43b2c)',
                      borderTop: '1px dashed var(--color-outline-variant, #d1c4b9)',
                      paddingTop: '0.375rem',
                      marginTop: '0.25rem',
                    }}
                    data-testid="sla-penalty-terms"
                  >
                    <span style={{ fontWeight: 600 }}>Penalty Terms:</span> {sla.penalty_terms}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--color-outline, #80756b)',
                      fontStyle: 'italic',
                    }}
                  >
                    No penalty terms specified.
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              borderRadius: 'var(--radius-md, 0.375rem)',
              border: '1px dashed var(--color-outline-variant, #d1c4b9)',
              textAlign: 'center',
              color: 'var(--color-on-surface-variant, #4e453d)',
              fontSize: '0.875rem',
            }}
            data-testid="no-sla-msg"
          >
            No SLA commitments specified for this agreement.
          </div>
        )}
      </section>

      {/* Footer Navigation / Sub-view Links */}
      <footer
        style={{
          borderTop: '1px solid var(--color-outline-variant, #d1c4b9)',
          paddingTop: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontSize: '0.875rem',
        }}
      >
        <div style={{ color: 'var(--color-outline, #80756b)' }}>
          Record created: {contract.created_at ? new Date(contract.created_at).toLocaleDateString() : 'N/A'} •
          Last updated: {contract.updated_at ? new Date(contract.updated_at).toLocaleDateString() : 'N/A'}
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link
            href={`/contracts/${contract.id}/amendments`}
            style={{
              color: 'var(--color-primary, #59452b)',
              fontWeight: 500,
              textDecoration: 'none',
            }}
            data-testid="contract-amendments-link"
          >
            View Amendment Log →
          </Link>
          <Link
            href={`/contracts/${contract.id}/documents`}
            style={{
              color: 'var(--color-primary, #59452b)',
              fontWeight: 500,
              textDecoration: 'none',
            }}
            data-testid="contract-documents-link"
          >
            View Documents →
          </Link>
        </div>
      </footer>
    </article>
  );
};

export default ContractDetail;
