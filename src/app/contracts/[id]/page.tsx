'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedRoute, useAuth } from '../../../components/protected_route';
import { NavMenu } from '../../../components/nav_menu';
import { ContractDetail } from '../../../components/clm/ContractDetail';
import { AmendmentTimeline } from '../../../components/clm/AmendmentTimeline';
import { DocumentRepository } from '../../../components/clm/DocumentRepository';
import { CurrentUserResponse } from '../../../services/auth';
import {
  ContractDetail as IContractDetail,
  AmendmentAuditLog,
  DocumentVersion,
  getContractDetail,
} from '../../../services/clm_client';

export interface ContractDetailPageProps {
  /** Next.js App Router route params object or promise containing contract id */
  params?: { id: string } | Promise<{ id: string }>;
  /** Explicit contract ID override */
  contractId?: string;
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Preloaded initial contract detail record */
  initialContract?: IContractDetail | null;
  /** Preloaded initial amendment audit log records */
  initialAmendments?: AmendmentAuditLog[];
  /** Preloaded initial document version records */
  initialDocuments?: DocumentVersion[];
  /** Initial active tab ('overview' | 'amendments' | 'documents' | 'all') */
  initialTab?: 'overview' | 'amendments' | 'documents' | 'all' | string;
  /** Roles override string for RBAC filtering */
  roles?: string;
  /** Whether components should auto-fetch data from API */
  autoFetch?: boolean;
  /** Optional custom container CSS class name */
  className?: string;
}

/**
 * Status badge style and label helper for page header banner.
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
 * Inner Contract Detail content component consuming active user session context.
 * Integrates overview clause highlights, SLA terms, amendment audit trail timeline,
 * and document repository version history in a unified tabbed layout following
 * the Linen & Logic editorial design system.
 */
function ContractDetailContent({
  params,
  contractId: explicitContractId,
  user: explicitUser,
  onLogout,
  initialContract,
  initialAmendments,
  initialDocuments,
  initialTab = 'overview',
  roles,
  autoFetch = true,
  className = '',
}: ContractDetailPageProps) {
  const router = useRouter();
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  // Resolve target contract ID from explicit prop, params object, or resolved Promise
  const [resolvedId, setResolvedId] = useState<string>(() => {
    if (explicitContractId) return explicitContractId;
    if (params && 'id' in params && typeof (params as any).id === 'string') {
      return (params as any).id;
    }
    return '';
  });

  useEffect(() => {
    if (explicitContractId) {
      setResolvedId(explicitContractId);
    } else if (params) {
      if (typeof (params as any).then === 'function') {
        (params as Promise<{ id: string }>).then((res) => {
          if (res?.id) setResolvedId(res.id);
        });
      } else if ('id' in params && typeof (params as any).id === 'string') {
        setResolvedId((params as any).id);
      }
    }
  }, [params, explicitContractId]);

  // Contract metadata state for header banner
  const [contract, setContract] = useState<IContractDetail | null>(initialContract || null);
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Sync initialContract when passed
  useEffect(() => {
    if (initialContract) {
      setContract(initialContract);
    }
  }, [initialContract]);

  // Fetch header contract summary if resolvedId is available and no initialContract
  useEffect(() => {
    let isMounted = true;
    if (resolvedId && !contract && autoFetch) {
      getContractDetail(resolvedId, { roles })
        .then((data) => {
          if (isMounted && data) {
            setContract(data);
          }
        })
        .catch(() => {
          // Ignore header summary errors; child ContractDetail component will display error state
        });
    }
    return () => {
      isMounted = false;
    };
  }, [resolvedId, contract, autoFetch, roles]);

  const handleContractLoaded = useCallback((loaded: IContractDetail) => {
    setContract(loaded);
  }, []);

  const handleBack = useCallback(() => {
    if (router && typeof router.push === 'function') {
      router.push('/contracts');
    }
  }, [router]);

  const handleDelete = useCallback(() => {
    if (router && typeof router.push === 'function') {
      router.push('/contracts');
    }
  }, [router]);

  if (!user) {
    return null;
  }

  const badgeConfig = getStatusBadgeConfig(contract?.status || '');

  return (
    <div
      data-testid="contract-detail-page"
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
        {/* Top Navigation & Breadcrumbs Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <Link
            href="/contracts"
            data-testid="back-to-contracts-link"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--color-primary, #59452b)',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm, 0.125rem)',
              backgroundColor: 'var(--color-surface-container-low, #f5f3ee)',
              border: '1px solid var(--color-outline-variant, #d1c4b9)',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            <span aria-hidden="true">←</span>
            <span>Back to Contract Repository</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              href="/contracts/esignature"
              data-testid="esignature-hub-link"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-md, 0.375rem)',
                color: 'var(--color-primary, #59452b)',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(115, 92, 65, 0.05)',
              }}
            >
              <span>E-Signature Tracking Hub</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* Contract Header Summary Section */}
        <header
          data-testid="contract-detail-header"
          style={{
            backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
            borderRadius: 'var(--radius-lg, 0.5rem)',
            border: '1px solid var(--color-outline-variant, #d1c4b9)',
            padding: '24px 28px',
            marginBottom: '32px',
            boxShadow: '0 1px 3px rgba(115, 92, 65, 0.06)',
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
            <div style={{ flex: '1 1 600px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span
                  data-testid="contract-detail-eyebrow"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--color-primary-container, #735c41)',
                  }}
                >
                  Contract Lifecycle Management • Detail View
                </span>
                {contract?.status && (
                  <span
                    data-testid="contract-detail-status"
                    style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 'var(--radius-full, 9999px)',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: badgeConfig.bg,
                      color: badgeConfig.color,
                      border: `1px solid ${badgeConfig.border}`,
                    }}
                  >
                    {badgeConfig.label}
                  </span>
                )}
              </div>

              <h1
                data-testid="contract-detail-title"
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '28px',
                  fontWeight: 400,
                  margin: '0 0 10px 0',
                  color: 'var(--color-on-surface, #1b1c19)',
                  lineHeight: '1.25',
                }}
              >
                {contract?.title || `Contract Record (${resolvedId || 'Loading...'})`}
              </h1>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '16px 24px',
                  fontSize: '14px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                }}
              >
                {contract?.contract_number && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 600 }}>Contract #:</span>
                    <span data-testid="contract-detail-number">{contract.contract_number}</span>
                  </div>
                )}
                {contract?.counterparty && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 600 }}>Counterparty:</span>
                    <span data-testid="contract-detail-counterparty">{contract.counterparty}</span>
                  </div>
                )}
                {contract?.effective_on && (
                  <div>
                    <span style={{ fontWeight: 600 }}>Effective:</span> {contract.effective_on}
                  </div>
                )}
                {contract?.expires_on && (
                  <div>
                    <span style={{ fontWeight: 600 }}>Expires:</span> {contract.expires_on}
                  </div>
                )}
                {contract?.auto_renew !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontWeight: 600 }}>Auto-Renew:</span>
                    <span>{contract.auto_renew ? 'Yes 🔄' : 'No'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Tab Navigation Controls */}
        <nav
          data-testid="contract-detail-tabs"
          aria-label="Contract Detail Sections"
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--color-outline-variant, #d1c4b9)',
            marginBottom: '28px',
            overflowX: 'auto',
          }}
        >
          <button
            type="button"
            data-testid="tab-overview"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: activeTab === 'overview' ? 600 : 400,
              color: activeTab === 'overview' ? 'var(--color-primary, #59452b)' : 'var(--color-on-surface-variant, #4e453d)',
              backgroundColor: activeTab === 'overview' ? 'var(--color-surface-container-lowest, #ffffff)' : 'transparent',
              borderTop: activeTab === 'overview' ? '2px solid var(--color-primary, #59452b)' : '2px solid transparent',
              borderLeft: activeTab === 'overview' ? '1px solid var(--color-outline-variant, #d1c4b9)' : 'none',
              borderRight: activeTab === 'overview' ? '1px solid var(--color-outline-variant, #d1c4b9)' : 'none',
              borderBottom: 'none',
              borderRadius: 'var(--radius-sm, 0.125rem) var(--radius-sm, 0.125rem) 0 0',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            📋 Overview & Terms
          </button>

          <button
            type="button"
            data-testid="tab-amendments"
            onClick={() => setActiveTab('amendments')}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: activeTab === 'amendments' ? 600 : 400,
              color: activeTab === 'amendments' ? 'var(--color-primary, #59452b)' : 'var(--color-on-surface-variant, #4e453d)',
              backgroundColor: activeTab === 'amendments' ? 'var(--color-surface-container-lowest, #ffffff)' : 'transparent',
              borderTop: activeTab === 'amendments' ? '2px solid var(--color-primary, #59452b)' : '2px solid transparent',
              borderLeft: activeTab === 'amendments' ? '1px solid var(--color-outline-variant, #d1c4b9)' : 'none',
              borderRight: activeTab === 'amendments' ? '1px solid var(--color-outline-variant, #d1c4b9)' : 'none',
              borderBottom: 'none',
              borderRadius: 'var(--radius-sm, 0.125rem) var(--radius-sm, 0.125rem) 0 0',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            📜 Amendment Audit Trail
          </button>

          <button
            type="button"
            data-testid="tab-documents"
            onClick={() => setActiveTab('documents')}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: activeTab === 'documents' ? 600 : 400,
              color: activeTab === 'documents' ? 'var(--color-primary, #59452b)' : 'var(--color-on-surface-variant, #4e453d)',
              backgroundColor: activeTab === 'documents' ? 'var(--color-surface-container-lowest, #ffffff)' : 'transparent',
              borderTop: activeTab === 'documents' ? '2px solid var(--color-primary, #59452b)' : '2px solid transparent',
              borderLeft: activeTab === 'documents' ? '1px solid var(--color-outline-variant, #d1c4b9)' : 'none',
              borderRight: activeTab === 'documents' ? '1px solid var(--color-outline-variant, #d1c4b9)' : 'none',
              borderBottom: 'none',
              borderRadius: 'var(--radius-sm, 0.125rem) var(--radius-sm, 0.125rem) 0 0',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            📁 Document Versions
          </button>

          <button
            type="button"
            data-testid="tab-all"
            onClick={() => setActiveTab('all')}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: activeTab === 'all' ? 600 : 400,
              color: activeTab === 'all' ? 'var(--color-primary, #59452b)' : 'var(--color-on-surface-variant, #4e453d)',
              backgroundColor: activeTab === 'all' ? 'var(--color-surface-container-lowest, #ffffff)' : 'transparent',
              borderTop: activeTab === 'all' ? '2px solid var(--color-primary, #59452b)' : '2px solid transparent',
              borderLeft: activeTab === 'all' ? '1px solid var(--color-outline-variant, #d1c4b9)' : 'none',
              borderRight: activeTab === 'all' ? '1px solid var(--color-outline-variant, #d1c4b9)' : 'none',
              borderBottom: 'none',
              borderRadius: 'var(--radius-sm, 0.125rem) var(--radius-sm, 0.125rem) 0 0',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            🔍 All Sections
          </button>
        </nav>

        {/* Tab Content Display Area */}
        {(activeTab === 'overview' || activeTab === 'all') && (
          <section data-testid="overview-section" style={{ marginBottom: activeTab === 'all' ? '48px' : '0' }}>
            <ContractDetail
              contractId={resolvedId}
              initialContract={initialContract || contract}
              roles={roles}
              autoFetch={autoFetch}
              onContractLoaded={handleContractLoaded}
              onBack={handleBack}
              onDelete={handleDelete}
            />
          </section>
        )}

        {(activeTab === 'amendments' || activeTab === 'all') && (
          <section data-testid="amendments-section" style={{ marginBottom: activeTab === 'all' ? '48px' : '0' }}>
            <AmendmentTimeline
              contractId={resolvedId}
              initialAmendments={initialAmendments}
              roles={roles}
              autoFetch={autoFetch}
            />
          </section>
        )}

        {(activeTab === 'documents' || activeTab === 'all') && (
          <section data-testid="documents-section">
            <DocumentRepository
              contractId={resolvedId}
              initialDocuments={initialDocuments}
              roles={roles}
              autoFetch={autoFetch}
            />
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * Main Contract Detail View Page route component for `/contracts/[id]`.
 * Intercepts unauthenticated access via ProtectedRoute guard and integrates
 * clause highlights, SLA terms, amendment audit trail, and document versions.
 */
export default function ContractDetailPage(props: any = {}) {
  const {
    params,
    contractId,
    user: initialUser,
    fetchUser,
    onLogout,
    initialContract,
    initialAmendments,
    initialDocuments,
    initialTab = 'overview',
    roles,
    autoFetch = true,
    className = '',
  } = props || {};
  if (initialUser) {
    return (
      <ContractDetailContent
        params={params}
        contractId={contractId}
        user={initialUser}
        onLogout={onLogout}
        initialContract={initialContract}
        initialAmendments={initialAmendments}
        initialDocuments={initialDocuments}
        initialTab={initialTab}
        roles={roles}
        autoFetch={autoFetch}
        className={className}
      />
    );
  }

  return (
    <ProtectedRoute fetchUser={fetchUser}>
      <ContractDetailContent
        params={params}
        contractId={contractId}
        onLogout={onLogout}
        initialContract={initialContract}
        initialAmendments={initialAmendments}
        initialDocuments={initialDocuments}
        initialTab={initialTab}
        roles={roles}
        autoFetch={autoFetch}
        className={className}
      />
    </ProtectedRoute>
  );
}
