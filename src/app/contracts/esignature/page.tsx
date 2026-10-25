'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProtectedRoute, useAuth } from '../../../components/protected_route';
import { NavMenu } from '../../../components/nav_menu';
import { ESignatureHub } from '../../../components/clm/ESignatureHub';
import { CurrentUserResponse } from '../../../services/auth';
import { ESignatureRequest } from '../../../services/clm_client';

export interface ESignaturePageProps {
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Optional contract ID filter to pre-scope e-signature requests */
  contractId?: string;
  /** Initial e-signature requests array passed to ESignatureHub */
  initialRequests?: ESignatureRequest[];
  /** Alias for initialRequests */
  requests?: ESignatureRequest[];
  /** Roles override string for RBAC filtering */
  roles?: string;
  /** Whether ESignatureHub should auto-fetch from backend API */
  autoFetch?: boolean;
  /** Read-only mode for ESignatureHub */
  readOnly?: boolean;
  /** Optional callback triggered when a new e-signature request is created */
  onRequestCreated?: (request: ESignatureRequest) => void;
  /** Optional callback triggered when an e-signature request status is updated */
  onStatusUpdated?: (request: ESignatureRequest) => void;
  /** Optional custom container CSS class name */
  className?: string;
}

/**
 * Inner E-Signature Tracking Hub content component consuming active user session context.
 * Renders header navigation, editorial page title, contract scoping badge, quick action links,
 * and the ESignatureHub component for monitoring pending executions, signers, and signature status.
 * Conforms to the Linen & Logic editorial design system.
 */
function ESignaturePageContent({
  user: explicitUser,
  onLogout,
  contractId,
  initialRequests,
  requests,
  roles,
  autoFetch = true,
  readOnly = false,
  onRequestCreated,
  onStatusUpdated,
  className = '',
}: ESignaturePageProps) {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  const [activeContractId, setActiveContractId] = useState<string | undefined>(contractId);

  useEffect(() => {
    if (contractId !== undefined) {
      setActiveContractId(contractId);
    }
  }, [contractId]);

  if (!user) {
    return null;
  }

  return (
    <div
      data-testid="esignature-page"
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

          {activeContractId && (
            <div
              data-testid="contract-scope-badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                backgroundColor: 'var(--color-surface-container, #f0eee9)',
                border: '1px solid var(--color-outline-variant, #d1c4b9)',
                borderRadius: 'var(--radius-full, 9999px)',
                fontSize: '13px',
                color: 'var(--color-on-surface-variant, #4e453d)',
              }}
            >
              <span>Scoped to Contract ID: <strong>{activeContractId}</strong></span>
              <button
                type="button"
                data-testid="clear-contract-scope-button"
                onClick={() => setActiveContractId(undefined)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-secondary, #a43b2c)',
                  fontWeight: 600,
                  fontSize: '14px',
                  padding: '0 2px',
                  lineHeight: 1,
                }}
                title="Clear Contract Scoping Filter"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Page Header Section */}
        <header
          data-testid="esignature-header"
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
              <span
                data-testid="esignature-eyebrow"
                style={{
                  display: 'inline-block',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--color-primary-container, #735c41)',
                  marginBottom: '6px',
                }}
              >
                Contract Lifecycle Management • E-Signature Tracking Hub
              </span>
              <h1
                data-testid="esignature-title"
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '32px',
                  fontWeight: 400,
                  margin: 0,
                  color: 'var(--color-on-surface, #1b1c19)',
                  lineHeight: '1.2',
                }}
              >
                E-Signature Tracking Hub
              </h1>
              <p
                data-testid="esignature-description"
                style={{
                  fontSize: '15px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginTop: '8px',
                  marginBottom: 0,
                  maxWidth: '780px',
                  lineHeight: '1.5',
                }}
              >
                Monitor pending agreement executions, track recipient signers and real-time execution statuses,
                dispatch new signature requests, and test provider webhook events across legal agreements.
              </p>
            </div>
          </div>
        </header>

        {/* E-Signature Tracking Hub Dashboard Component */}
        <section data-testid="esignature-hub-section">
          <ESignatureHub
            contractId={activeContractId}
            initialRequests={initialRequests}
            requests={requests}
            roles={roles}
            autoFetch={autoFetch}
            readOnly={readOnly}
            onRequestCreated={onRequestCreated}
            onStatusUpdated={onStatusUpdated}
          />
        </section>
      </main>
    </div>
  );
}

/**
 * Main E-Signature Tracking Hub Page route component.
 * Intercepts unauthenticated access attempts using ProtectedRoute guard and renders e-signature dashboard.
 */
export default function ESignaturePage(props: any = {}) {
  const {
    user: initialUser,
    fetchUser,
    onLogout,
    contractId,
    initialRequests,
    requests,
    roles,
    autoFetch = true,
    readOnly = false,
    onRequestCreated,
    onStatusUpdated,
    className = '',
  } = props || {};
  if (initialUser) {
    return (
      <ESignaturePageContent
        user={initialUser}
        onLogout={onLogout}
        contractId={contractId}
        initialRequests={initialRequests}
        requests={requests}
        roles={roles}
        autoFetch={autoFetch}
        readOnly={readOnly}
        onRequestCreated={onRequestCreated}
        onStatusUpdated={onStatusUpdated}
        className={className}
      />
    );
  }

  return (
    <ProtectedRoute fetchUser={fetchUser}>
      <ESignaturePageContent
        onLogout={onLogout}
        contractId={contractId}
        initialRequests={initialRequests}
        requests={requests}
        roles={roles}
        autoFetch={autoFetch}
        readOnly={readOnly}
        onRequestCreated={onRequestCreated}
        onStatusUpdated={onStatusUpdated}
        className={className}
      />
    </ProtectedRoute>
  );
}
