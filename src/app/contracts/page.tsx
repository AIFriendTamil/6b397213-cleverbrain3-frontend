'use client';

import React from 'react';
import Link from 'next/link';
import { ProtectedRoute, useAuth } from '../../components/protected_route';
import { NavMenu } from '../../components/nav_menu';
import { ContractList } from '../../components/clm/ContractList';
import { CurrentUserResponse } from '../../services/auth';
import { ContractDetail } from '../../services/clm_client';

export interface ContractsPageProps {
  /** Optional explicit user session object to override AuthContext (useful for testing or direct injection) */
  user?: CurrentUserResponse | null;
  /** Optional custom fetchUser function passed down to ProtectedRoute in tests */
  fetchUser?: () => Promise<CurrentUserResponse>;
  /** Optional custom logout handler */
  onLogout?: () => Promise<void>;
  /** Initial array of contract records passed to ContractList */
  initialContracts?: ContractDetail[];
  /** Initial status filter value (e.g. "ACTIVE", "DRAFT", "EXPIRED", "TERMINATED", or "") */
  initialStatus?: string;
  /** Initial counterparty search query */
  initialCounterparty?: string;
  /** Initial keyword search query */
  initialKeyword?: string;
  /** Initial renewal timeframe in days (30, 60, or 90) */
  initialRenewalDays?: number | null;
  /** Selection handler invoked when a contract is chosen */
  onContractSelect?: (contract: ContractDetail) => void;
  /** Roles override string for RBAC filtering */
  roles?: string;
  /** Whether ContractList should auto-fetch from backend API */
  autoFetch?: boolean;
  /** Optional custom container CSS class name */
  className?: string;
}

/**
 * Inner Contract Repository content component consuming active user session context.
 * Renders page navigation header, brand badge, quick-action link to e-signature hub,
 * and the ContractList component for search, filtering, and term highlight inspection.
 * Conforms to the Linen & Logic editorial design system.
 */
function ContractsContent({
  user: explicitUser,
  onLogout,
  initialContracts,
  initialStatus = '',
  initialCounterparty = '',
  initialKeyword = '',
  initialRenewalDays = null,
  onContractSelect,
  roles,
  autoFetch = true,
  className = '',
}: ContractsPageProps) {
  const contextAuth = useAuth();
  const user = explicitUser !== undefined ? explicitUser : contextAuth.user;

  if (!user) {
    return null;
  }

  return (
    <div
      data-testid="contracts-page"
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
          data-testid="contracts-header"
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
                data-testid="contracts-eyebrow"
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
                Contract Lifecycle Management • Repository
              </span>
              <h1
                data-testid="contracts-title"
                style={{
                  fontFamily: 'var(--font-serif, "Libre Caslon Text", Georgia, serif)',
                  fontSize: '32px',
                  fontWeight: 400,
                  margin: 0,
                  color: 'var(--color-on-surface, #1b1c19)',
                  lineHeight: '1.2',
                }}
              >
                Contract Repository
              </h1>
              <p
                data-testid="contracts-description"
                style={{
                  fontSize: '15px',
                  color: 'var(--color-on-surface-variant, #4e453d)',
                  marginTop: '8px',
                  marginBottom: 0,
                  maxWidth: '720px',
                  lineHeight: '1.5',
                }}
              >
                Search and filter active legal agreements, review key clause highlights, SLA commitments,
                special terms, and track upcoming contract renewals.
              </p>
            </div>

            {/* Quick action link to E-Signature Hub */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                alignSelf: 'center',
              }}
            >
              <Link
                href="/contracts/esignature"
                data-testid="esignature-hub-link"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  backgroundColor: 'var(--color-surface-container-lowest, #ffffff)',
                  border: '1px solid var(--color-outline-variant, #d1c4b9)',
                  borderRadius: 'var(--radius-md, 0.375rem)',
                  color: 'var(--color-primary, #59452b)',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: '0 1px 2px rgba(115, 92, 65, 0.05)',
                }}
              >
                <span>E-Signature Tracking Hub</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Contract Repository List and Filter Component */}
        <section data-testid="contracts-list-section">
          <ContractList
            initialContracts={initialContracts}
            initialStatus={initialStatus}
            initialCounterparty={initialCounterparty}
            initialKeyword={initialKeyword}
            initialRenewalDays={initialRenewalDays}
            onContractSelect={onContractSelect}
            roles={roles}
            autoFetch={autoFetch}
          />
        </section>
      </main>
    </div>
  );
}

/**
 * Main Contract Repository Page component.
 * Intercepts unauthenticated requests using ProtectedRoute guard and renders contract repository interface.
 */
export default function ContractsPage(props: any = {}) {
  const {
    user: initialUser,
    fetchUser,
    onLogout,
    initialContracts,
    initialStatus = '',
    initialCounterparty = '',
    initialKeyword = '',
    initialRenewalDays = null,
    onContractSelect,
    roles,
    autoFetch = true,
    className = '',
  } = props || {};
  if (initialUser) {
    return (
      <ContractsContent
        user={initialUser}
        onLogout={onLogout}
        initialContracts={initialContracts}
        initialStatus={initialStatus}
        initialCounterparty={initialCounterparty}
        initialKeyword={initialKeyword}
        initialRenewalDays={initialRenewalDays}
        onContractSelect={onContractSelect}
        roles={roles}
        autoFetch={autoFetch}
        className={className}
      />
    );
  }

  return (
    <ProtectedRoute fetchUser={fetchUser}>
      <ContractsContent
        onLogout={onLogout}
        initialContracts={initialContracts}
        initialStatus={initialStatus}
        initialCounterparty={initialCounterparty}
        initialKeyword={initialKeyword}
        initialRenewalDays={initialRenewalDays}
        onContractSelect={onContractSelect}
        roles={roles}
        autoFetch={autoFetch}
        className={className}
      />
    </ProtectedRoute>
  );
}
